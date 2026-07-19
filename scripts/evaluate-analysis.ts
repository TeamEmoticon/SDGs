// evaluate-analysis.ts
// 실제 Gemini API(또는 키 없으면 규칙 폴백)로 tests/fixtures/analysis-cases.ts 전체를 분석하고
// reports/analysis-evaluation-results.json에 결과를 남긴다.
//
// 이 스크립트는 npm test(네트워크 0회)에 포함되지 않는다 — 실제 API 호출과 무료 할당량을 소비한다.
// 실행: node --env-file-if-exists=.env.local scripts/evaluate-analysis.ts
// (npm run evaluate:analysis 로도 동일하게 실행된다.)
//
// 원칙(message(5) 2장): API 키·인증 헤더·전체 환경변수·원문 전체를 어디에도 출력·저장하지 않는다.
// 마스킹된 입력 미리보기(최대 80자)만 기록한다.

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeInput } from "../src/services/analysis.ts";
import { maskSensitive } from "../src/lib/masking.ts";
import { parseGeminiJson, readModelText } from "../src/services/geminiParsing.ts";
import { TEST_CASES, type AnalysisTestCase } from "../tests/fixtures/analysis-cases.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(__dirname, "..", "reports", "analysis-evaluation-results.json");

const AI_CALL_DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 4000);
const RATE_LIMIT_RETRY_DELAY_MS = 8000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gitCommitHash(): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: join(__dirname, "..") }).toString().trim();
  } catch {
    return "unknown";
  }
}

// ---- fetch 계측: 소스 코드를 건드리지 않고 호출 횟수·usage·raw riskPhrases 개수만 관찰한다 ----
interface CallObservation {
  count: number;
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null;
  rawRiskPhraseCount: number | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function installFetchObserver(): { observation: CallObservation; restore: () => void } {
  const observation: CallObservation = { count: 0, usage: null, rawRiskPhraseCount: null };
  const realFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    observation.count += 1;
    const response = await realFetch(input, init);
    try {
      const payload: unknown = await response.clone().json();
      if (isObject(payload) && isObject(payload.usageMetadata)) {
        const usage = payload.usageMetadata;
        observation.usage = {
          inputTokens: typeof usage.promptTokenCount === "number" ? usage.promptTokenCount : undefined,
          outputTokens: typeof usage.candidatesTokenCount === "number" ? usage.candidatesTokenCount : undefined,
          totalTokens: typeof usage.totalTokenCount === "number" ? usage.totalTokenCount : undefined,
        };
      }
      const text = readModelText(payload);
      if (text !== null) {
        const parsed = parseGeminiJson(text);
        if (isObject(parsed) && Array.isArray(parsed.riskPhrases)) {
          observation.rawRiskPhraseCount = parsed.riskPhrases.length;
        }
      }
    } catch {
      // 계측 실패는 무시한다 — 실제 분석 흐름에 영향을 주지 않는다.
    }
    return response;
  }) as typeof fetch;

  return {
    observation,
    restore: () => {
      globalThis.fetch = realFetch;
    },
  };
}

function maskedPreview(testCase: AnalysisTestCase): string {
  const source = testCase.inputType === "url" ? testCase.input : maskSensitive(testCase.input).text;
  return source.slice(0, 80);
}

interface EvaluationRecord {
  readonly caseId: string;
  readonly category: string;
  readonly title: string;
  readonly maskedInputPreview: string;
  readonly expected: {
    readonly plannedMode: string;
    readonly acceptableRiskLevels: readonly string[];
    readonly expectedSignalCodes: readonly string[];
    readonly aiCallExpected: boolean;
  };
  readonly actual: {
    readonly outcomeKind: "success" | "error";
    readonly errorCode?: string;
    readonly plannedMode?: string;
    readonly executedMode?: string;
    readonly aiStatus?: string;
    readonly fallbackUsed?: boolean;
    readonly riskLevel?: string;
    readonly riskScore?: number;
    readonly ruleSignalCodes: readonly string[];
    readonly aiSignalCodes: readonly string[];
    readonly rejectedAiSignals: number;
    readonly aiCallCount: number;
    readonly retriedAfterRateLimit: boolean;
    readonly elapsedMs: number;
    readonly inputTokens?: number;
    readonly outputTokens?: number;
    readonly totalTokens?: number;
    readonly groundingUsed?: boolean;
    readonly citationCount?: number;
  };
  readonly evaluation: {
    readonly modeMatched: boolean;
    readonly riskMatched: boolean;
    readonly signalsMatched: boolean;
    readonly callCountValid: boolean;
    readonly passed: boolean;
    readonly notes: string[];
  };
}

async function runOne(testCase: AnalysisTestCase): Promise<EvaluationRecord> {
  const { observation, restore } = installFetchObserver();
  const start = performance.now();
  let retried = false;

  let outcome = await analyzeInput({ type: testCase.inputType, content: testCase.input });
  // 429(rate_limited)면 짧은 대기 후 최대 1회만 재시도한다.
  if (outcome.kind === "success" && outcome.result.execution?.aiStatus === "rate_limited") {
    restore();
    await sleep(RATE_LIMIT_RETRY_DELAY_MS);
    const retryObserver = installFetchObserver();
    outcome = await analyzeInput({ type: testCase.inputType, content: testCase.input });
    observation.count += retryObserver.observation.count;
    observation.usage = retryObserver.observation.usage ?? observation.usage;
    observation.rawRiskPhraseCount = retryObserver.observation.rawRiskPhraseCount ?? observation.rawRiskPhraseCount;
    retryObserver.restore();
    retried = true;
  } else {
    restore();
  }

  const elapsedMs = Math.round(performance.now() - start);
  const notes: string[] = [];

  if (outcome.kind === "error") {
    const expectedError = testCase.expected.expectedOutcome === "error";
    const codeMatches = !testCase.expected.expectedErrorCode || outcome.code === testCase.expected.expectedErrorCode;
    const passed = expectedError && codeMatches;
    if (!expectedError) notes.push(`예상치 못한 오류: ${outcome.code} — ${outcome.message}`);
    else if (!codeMatches) notes.push(`오류 코드 불일치: 예상 ${testCase.expected.expectedErrorCode}, 실제 ${outcome.code}`);

    return {
      caseId: testCase.id,
      category: testCase.category,
      title: testCase.title,
      maskedInputPreview: maskedPreview(testCase),
      expected: {
        plannedMode: testCase.expected.plannedMode,
        acceptableRiskLevels: testCase.expected.acceptableRiskLevels,
        expectedSignalCodes: testCase.expected.expectedSignalCodes ?? [],
        aiCallExpected: testCase.expected.aiCallExpected,
      },
      actual: {
        outcomeKind: "error",
        errorCode: outcome.code,
        ruleSignalCodes: [],
        aiSignalCodes: [],
        rejectedAiSignals: 0,
        aiCallCount: observation.count,
        retriedAfterRateLimit: retried,
        elapsedMs,
      },
      evaluation: {
        modeMatched: true,
        riskMatched: true,
        signalsMatched: true,
        callCountValid: observation.count <= 1,
        passed,
        notes,
      },
    };
  }

  const result = outcome.result;
  const ruleSignalCodes = result.signals.map((s) => s.id);
  const expectedSignals = testCase.expected.expectedSignalCodes ?? [];
  const forbiddenSignals = testCase.expected.forbiddenSignalCodes ?? [];
  const missingExpected = expectedSignals.filter((code) => !ruleSignalCodes.includes(code));
  const presentForbidden = forbiddenSignals.filter((code) => ruleSignalCodes.includes(code));

  const modeMatched = result.execution?.plannedMode === testCase.expected.plannedMode;
  const riskMatched =
    testCase.expected.acceptableRiskLevels.includes("unknown") ||
    testCase.expected.acceptableRiskLevels.includes(result.riskLevel);
  const signalsMatched = missingExpected.length === 0 && presentForbidden.length === 0;
  const callCountValid = observation.count <= 1;

  if (!modeMatched) notes.push(`모드 불일치: 예상 ${testCase.expected.plannedMode}, 실제 ${result.execution?.plannedMode}`);
  if (!riskMatched) notes.push(`위험 등급 범위 밖: 허용 [${testCase.expected.acceptableRiskLevels.join(", ")}], 실제 ${result.riskLevel}`);
  if (missingExpected.length > 0) notes.push(`기대 신호 누락: ${missingExpected.join(", ")}`);
  if (presentForbidden.length > 0) notes.push(`금지 신호 발생(오탐 가능성): ${presentForbidden.join(", ")}`);
  if (!callCountValid) notes.push(`호출 횟수 초과: ${observation.count}회`);

  const rejectedAiSignals =
    result.ai.used && observation.rawRiskPhraseCount !== null
      ? Math.max(0, observation.rawRiskPhraseCount - result.ai.riskPhrases.length)
      : 0;

  return {
    caseId: testCase.id,
    category: testCase.category,
    title: testCase.title,
    maskedInputPreview: maskedPreview(testCase),
    expected: {
      plannedMode: testCase.expected.plannedMode,
      acceptableRiskLevels: testCase.expected.acceptableRiskLevels,
      expectedSignalCodes: expectedSignals,
      aiCallExpected: testCase.expected.aiCallExpected,
    },
    actual: {
      outcomeKind: "success",
      plannedMode: result.execution?.plannedMode,
      executedMode: result.execution?.executedMode,
      aiStatus: result.execution?.aiStatus,
      fallbackUsed: result.execution?.fallbackUsed,
      riskLevel: result.riskLevel,
      riskScore: result.riskScore,
      ruleSignalCodes,
      aiSignalCodes: [], // 이 구현은 signal-code 모델 대신 riskPhrases(원문 검증) 방식을 쓴다 — Phase4B 핸드오프 참조.
      rejectedAiSignals,
      aiCallCount: observation.count,
      retriedAfterRateLimit: retried,
      elapsedMs,
      ...(observation.usage
        ? {
            inputTokens: observation.usage.inputTokens,
            outputTokens: observation.usage.outputTokens,
            totalTokens: observation.usage.totalTokens,
          }
        : {}),
    },
    evaluation: {
      modeMatched,
      riskMatched,
      signalsMatched,
      callCountValid,
      passed: modeMatched && riskMatched && signalsMatched && callCountValid,
      notes,
    },
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

async function main(): Promise<void> {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  console.log(`[evaluate-analysis] GEMINI_API_KEY set: ${hasKey}`);
  console.log(`[evaluate-analysis] running ${TEST_CASES.length} cases (delay ${AI_CALL_DELAY_MS}ms before AI-calling cases)`);

  const records: EvaluationRecord[] = [];
  for (const testCase of TEST_CASES) {
    if (testCase.expected.aiCallExpected && hasKey) {
      await sleep(AI_CALL_DELAY_MS);
    }
    try {
      const record = await runOne(testCase);
      records.push(record);
      console.log(`  [${record.evaluation.passed ? "PASS" : "FAIL"}] ${testCase.id} ${testCase.title}`);
    } catch (error) {
      // 한 사례의 예외가 전체 실행을 막지 않도록 여기서 흡수하고 실패로 기록한다.
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  [ERROR] ${testCase.id} ${testCase.title}: ${message}`);
      records.push({
        caseId: testCase.id,
        category: testCase.category,
        title: testCase.title,
        maskedInputPreview: maskedPreview(testCase),
        expected: {
          plannedMode: testCase.expected.plannedMode,
          acceptableRiskLevels: testCase.expected.acceptableRiskLevels,
          expectedSignalCodes: testCase.expected.expectedSignalCodes ?? [],
          aiCallExpected: testCase.expected.aiCallExpected,
        },
        actual: {
          outcomeKind: "error",
          errorCode: "UNCAUGHT_EXCEPTION",
          ruleSignalCodes: [],
          aiSignalCodes: [],
          rejectedAiSignals: 0,
          aiCallCount: 0,
          retriedAfterRateLimit: false,
          elapsedMs: 0,
        },
        evaluation: {
          modeMatched: false,
          riskMatched: false,
          signalsMatched: false,
          callCountValid: true,
          passed: false,
          notes: [`분석 core에서 처리되지 않은 예외 발생: ${message}`],
        },
      });
    }
  }

  const total = records.length;
  const passed = records.filter((r) => r.evaluation.passed).length;
  const ruleOnlyRecords = records.filter((r) => r.expected.plannedMode === "RULE_ONLY");
  const ruleOnlyZeroCallCompliant = ruleOnlyRecords.filter((r) => r.actual.aiCallCount === 0).length;
  const successRecords = records.filter((r) => r.actual.outcomeKind === "success");
  const aiUsedRecords = successRecords.filter((r) => r.actual.aiStatus === "used");
  const aiAttemptedRecords = successRecords.filter((r) => r.expected.aiCallExpected);
  const fallbackRecords = successRecords.filter(
    (r) => r.actual.aiStatus && r.actual.aiStatus !== "used" && r.actual.aiStatus !== "skipped",
  );
  const elapsed = records.map((r) => r.actual.elapsedMs);
  const tokensIn = successRecords.map((r) => r.actual.inputTokens).filter((v): v is number => typeof v === "number");
  const tokensOut = successRecords.map((r) => r.actual.outputTokens).filter((v): v is number => typeof v === "number");
  const tokensTotal = successRecords.map((r) => r.actual.totalTokens).filter((v): v is number => typeof v === "number");

  const aiStatusCounts: Record<string, number> = {};
  for (const r of successRecords) {
    const status = r.actual.aiStatus ?? "unknown";
    aiStatusCounts[status] = (aiStatusCounts[status] ?? 0) + 1;
  }

  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
      gitCommit: gitCommitHash(),
      testEnvironment: hasKey ? "실제 GEMINI_API_KEY 설정됨" : "GEMINI_API_KEY 미설정(규칙 폴백만 검증)",
      testCount: total,
    },
    summary: {
      passRate: total === 0 ? 0 : Math.round((passed / total) * 1000) / 10,
      modeMatchRate: total === 0 ? 0 : Math.round((records.filter((r) => r.evaluation.modeMatched).length / total) * 1000) / 10,
      riskMatchRate: total === 0 ? 0 : Math.round((records.filter((r) => r.evaluation.riskMatched).length / total) * 1000) / 10,
      signalMatchRate: total === 0 ? 0 : Math.round((records.filter((r) => r.evaluation.signalsMatched).length / total) * 1000) / 10,
      callCountValidRate: total === 0 ? 0 : Math.round((records.filter((r) => r.evaluation.callCountValid).length / total) * 1000) / 10,
      ruleOnlyZeroCallComplianceRate:
        ruleOnlyRecords.length === 0 ? null : Math.round((ruleOnlyZeroCallCompliant / ruleOnlyRecords.length) * 1000) / 10,
      aiSuccessRate: aiAttemptedRecords.length === 0 ? null : Math.round((aiUsedRecords.length / aiAttemptedRecords.length) * 1000) / 10,
      fallbackOccurrences: fallbackRecords.length,
      averageResponseMs: average(elapsed),
      medianResponseMs: median(elapsed),
      slowestResponseMs: elapsed.length === 0 ? null : Math.max(...elapsed),
      averageInputTokens: average(tokensIn),
      averageOutputTokens: average(tokensOut),
      totalTokensUsed: tokensTotal.length === 0 ? "측정 불가" : tokensTotal.reduce((a, b) => a + b, 0),
      aiStatusCounts,
    },
    records,
  };

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  console.log(`[evaluate-analysis] ${passed}/${total} passed (${report.summary.passRate}%)`);
  console.log(`[evaluate-analysis] RULE_ONLY 0회 호출 준수: ${ruleOnlyZeroCallCompliant}/${ruleOnlyRecords.length}`);
  console.log(`[evaluate-analysis] report written: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error("[evaluate-analysis] fatal error:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
