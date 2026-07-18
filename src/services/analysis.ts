// analysis.ts
// 공통 분석 오케스트레이션(analyzeCore 역할). Next Route와 Netlify Function이 이 함수만 호출한다.
// 흐름: 입력 검증 → 마스킹 → 규칙 탐지 → 모드 선택 → (선택적) provider 1회 실행 → AI 검증 → 점수 → 결과.

import { assessDomain } from "../lib/domain.ts";
import { maskSensitive } from "../lib/masking.ts";
import { calculateRisk, deriveFallback, verifyAiAnalysis } from "../lib/risk.ts";
import { chooseAnalysisMode } from "../lib/routing.ts";
import { detectSignals } from "../lib/rules.ts";
import type {
  AiAnalysis,
  AiStatus,
  AnalysisExecution,
  AnalysisMode,
  AnalysisResult,
  ApiWarning,
  InputType,
  Signal,
} from "../lib/types";
import { EMPTY_ANALYSIS } from "./gemini.ts";
import { createDefaultProvider, type AnalysisProvider, type ProviderInput } from "./provider.ts";

const TEXT_MIN = 10;
const TEXT_LIMIT = 6_000;
const URL_LIMIT = 2_048;

export interface AnalyzeSuccess {
  readonly kind: "success";
  readonly result: AnalysisResult;
}
export interface AnalyzeError {
  readonly kind: "error";
  readonly status: number;
  readonly code: string;
  readonly message: string;
}
export type AnalysisOutcome = AnalyzeSuccess | AnalyzeError;

const EMPTY_MASK = { maskedCount: 0, counts: { phone: 0, account: 0, code: 0, rrn: 0, card: 0 } } as const;

function error(status: number, code: string, message: string): AnalyzeError {
  return { kind: "error", status, code, message };
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readInput(value: unknown): { readonly type: InputType; readonly content: string } | null {
  if (!isObject(value)) return null;
  const type = Reflect.get(value, "type");
  const content = Reflect.get(value, "content");
  if ((type !== "text" && type !== "url") || typeof content !== "string") return null;
  return { type, content: content.trim() };
}

function warningForAiStatus(status: AiStatus): ApiWarning | null {
  switch (status) {
    case "not_configured":
      return { code: "AI_NOT_CONFIGURED", message: "쉬운 말 AI 설명 없이 기본 위험 신호만 확인했습니다." };
    case "configuration_error":
      return { code: "AI_CONFIGURATION_ERROR", message: "AI 설정 문제로 기본 위험 신호만 확인했습니다." };
    case "timeout":
      return { code: "AI_TIMEOUT", message: "AI 설명이 지연되어 기본 위험 신호만 확인했습니다." };
    case "rate_limited":
      return { code: "AI_RATE_LIMITED", message: "요청이 많아 기본 위험 신호만 확인했습니다." };
    case "blocked":
      return { code: "AI_BLOCKED", message: "AI 설명을 제공할 수 없어 기본 위험 신호만 확인했습니다." };
    case "invalid_response":
      return { code: "AI_INVALID_RESPONSE", message: "AI 설명을 이해하지 못해 기본 위험 신호만 확인했습니다." };
    case "upstream_error":
      return { code: "AI_UPSTREAM_ERROR", message: "AI 설명 서버에 문제가 있어 기본 위험 신호만 확인했습니다." };
    default:
      return null; // skipped, used
  }
}

interface AiExecution {
  readonly executedMode: AnalysisMode;
  readonly aiStatus: AiStatus;
  readonly fallbackUsed: boolean;
  readonly ai: AiAnalysis;
}

/** 계획 모드에 따라 provider를 최대 1회 실행하고, 실패 시 규칙 폴백한다. */
async function runAiExecution(
  plannedMode: AnalysisMode,
  signals: readonly Signal[],
  maskedText: string,
  provider: AnalysisProvider | null,
): Promise<AiExecution> {
  const fallback = (aiStatus: AiStatus, executedMode: AnalysisMode = "RULE_ONLY"): AiExecution => ({
    executedMode,
    aiStatus,
    fallbackUsed: executedMode !== plannedMode || aiStatus !== "used",
    ai: deriveFallback(EMPTY_ANALYSIS, signals),
  });

  if (plannedMode === "RULE_ONLY") {
    return { executedMode: "RULE_ONLY", aiStatus: "skipped", fallbackUsed: false, ai: deriveFallback(EMPTY_ANALYSIS, signals) };
  }
  if (provider === null) {
    return fallback("not_configured");
  }

  const input: ProviderInput = { kind: "text", maskedText };
  let outcome: Awaited<ReturnType<AnalysisProvider["summarize"]>>;
  try {
    outcome = plannedMode === "GROUNDED_FACT_CHECK" ? await provider.factCheck(input) : await provider.summarize(input);
  } catch {
    return fallback("upstream_error");
  }

  if (outcome.kind === "used") {
    return {
      executedMode: plannedMode,
      aiStatus: "used",
      fallbackUsed: false,
      ai: verifyAiAnalysis(outcome.analysis, maskedText),
    };
  }
  // text 입력에서는 url-unavailable가 나오지 않지만 안전하게 폴백한다.
  const status: AiStatus = outcome.kind === "failure" ? outcome.status : "invalid_response";
  return fallback(status);
}

async function analyzeText(content: string, provider: AnalysisProvider | null): Promise<AnalysisOutcome> {
  if (content.length < TEXT_MIN) return error(400, "INPUT_TOO_SHORT", "확인할 문자나 글을 10자 이상 붙여넣어 주세요.");
  if (content.length > TEXT_LIMIT) return error(413, "INPUT_TOO_LONG", "글이 너무 깁니다. 6,000자 이하로 붙여넣어 주세요.");

  const mask = maskSensitive(content);
  const signals = detectSignals(mask.text);
  const routing = chooseAnalysisMode(signals, mask.text);
  const { executedMode, aiStatus, fallbackUsed, ai } = await runAiExecution(routing.mode, signals, mask.text, provider);
  const verdict = calculateRisk(signals, ai, routing.reasons);

  const execution: AnalysisExecution = {
    plannedMode: routing.mode,
    executedMode,
    aiStatus,
    fallbackUsed,
    routingReasons: routing.reasons,
  };
  const warning = warningForAiStatus(aiStatus);

  return {
    kind: "success",
    result: {
      inputType: "text",
      sourceUrl: null,
      maskedText: mask.text,
      mask: { maskedCount: mask.maskedCount, counts: mask.counts },
      signals,
      ai,
      riskLevel: verdict.level,
      riskScore: verdict.score,
      recommendation: verdict.recommendation,
      createdAt: new Date().toISOString(),
      execution,
      ...(warning ? { warnings: [warning] } : {}),
    },
  };
}

async function analyzeUrl(content: string, provider: AnalysisProvider | null): Promise<AnalysisOutcome> {
  if (content.length === 0 || content.length > URL_LIMIT) {
    return error(422, "INVALID_URL", "공개 인터넷 주소를 정확히 입력해 주세요.");
  }
  const domain = assessDomain(content);
  if (domain === null) return error(422, "INVALID_URL", "공개 인터넷 주소를 정확히 입력해 주세요.");
  if (domain.isLocalOrPrivate) return error(422, "BLOCKED_URL", "이 주소는 확인할 수 없습니다. 다른 주소를 넣어주세요.");

  const unreadable = error(
    422,
    "URL_UNREADABLE",
    "이 페이지의 글을 불러오지 못했습니다. 로그인이 필요하거나 자동 읽기를 막았을 수 있어요. 내용을 복사해서 붙여넣어 주세요.",
  );

  // 키/‌provider가 없으면 페이지 본문을 읽을 수 없다(4A에서는 URL 실연결 없음).
  if (provider === null) return unreadable;

  let outcome: Awaited<ReturnType<AnalysisProvider["summarize"]>>;
  try {
    outcome = await provider.summarize({ kind: "url", url: content });
  } catch {
    return unreadable;
  }
  if (outcome.kind !== "used") return unreadable;

  const ai = outcome.analysis;
  const verdict = calculateRisk([], ai);
  const execution: AnalysisExecution = {
    plannedMode: "AI_SUMMARY",
    executedMode: "AI_SUMMARY",
    aiStatus: "used",
    fallbackUsed: false,
    routingReasons: ["url_context"],
  };
  const warnings: ApiWarning[] = domain.warnings.length > 0
    ? [{ code: "URL_WARNING", message: "주소에 주의할 점이 있어요. 주소를 한 번 더 확인해 주세요." }]
    : [];

  return {
    kind: "success",
    result: {
      inputType: "url",
      sourceUrl: content,
      maskedText: "",
      mask: EMPTY_MASK,
      signals: [],
      ai,
      riskLevel: verdict.level,
      riskScore: verdict.score,
      recommendation: verdict.recommendation,
      createdAt: new Date().toISOString(),
      execution,
      ...(warnings.length > 0 ? { warnings } : {}),
    },
  };
}

/**
 * 공통 분석 진입점. provider는 주입 가능(테스트에서 fake 주입, 기본값은 키 유무로 결정).
 */
export async function analyzeInput(
  value: unknown,
  provider: AnalysisProvider | null = createDefaultProvider(),
): Promise<AnalysisOutcome> {
  const input = readInput(value);
  if (input === null) return error(400, "INVALID_REQUEST", "입력 형식을 확인해 주세요.");
  return input.type === "url" ? analyzeUrl(input.content, provider) : analyzeText(input.content, provider);
}
