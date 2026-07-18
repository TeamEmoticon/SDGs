import assert from "node:assert/strict";
import test from "node:test";
import { analyzeInput } from "../src/services/analysis.ts";
import type { AnalysisProvider, ProviderOutcome } from "../src/services/provider.ts";
import type { AiAnalysis } from "../src/lib/types.ts";

const usedAnalysis = (riskPhrases: readonly string[] = []): AiAnalysis => ({
  summary: "쉬운 말 요약입니다.",
  infoType: "일반 안내",
  actions: [],
  riskPhrases,
  difficultTerms: [],
  missingInfo: [],
  used: true,
});

class FakeProvider implements AnalysisProvider {
  summarizeCalls = 0;
  factCheckCalls = 0;
  private readonly outcome: ProviderOutcome;
  constructor(outcome: ProviderOutcome = { kind: "used", analysis: usedAnalysis() }) {
    this.outcome = outcome;
  }
  async summarize(): Promise<ProviderOutcome> {
    this.summarizeCalls += 1;
    return this.outcome;
  }
  async factCheck(): Promise<ProviderOutcome> {
    this.factCheckCalls += 1;
    return this.outcome;
  }
}

const req = (content: string) => ({ type: "text" as const, content });

async function successResult(value: unknown, provider: AnalysisProvider | null) {
  const outcome = await analyzeInput(value, provider);
  assert.equal(outcome.kind, "success");
  if (outcome.kind !== "success") throw new Error("unreachable");
  return outcome.result;
}

test("RULE_ONLY 입력은 provider를 호출하지 않는다", async () => {
  const provider = new FakeProvider();
  const result = await successResult(req("지금 즉시 아래 계좌로 입금해 주세요. 늦으면 처리되지 않습니다."), provider);
  assert.equal(provider.summarizeCalls, 0);
  assert.equal(provider.factCheckCalls, 0);
  assert.equal(result.execution?.executedMode, "RULE_ONLY");
  assert.equal(result.execution?.aiStatus, "skipped");
});

test("AI_SUMMARY 입력은 summarize를 최대 1회 호출한다", async () => {
  const provider = new FakeProvider();
  const result = await successResult(req("고객님, 이번 달 카드 대금 결제 예정 안내입니다. 이용해 주셔서 감사합니다."), provider);
  assert.equal(provider.summarizeCalls, 1);
  assert.equal(provider.factCheckCalls, 0);
  assert.equal(result.execution?.executedMode, "AI_SUMMARY");
  assert.equal(result.execution?.aiStatus, "used");
});

test("GROUNDED_FACT_CHECK 입력은 factCheck를 최대 1회 호출한다", async () => {
  const provider = new FakeProvider();
  const result = await successResult(req("다음 달부터 만 65세 이상 모든 국민에게 정부가 매달 30만 원을 지급합니다."), provider);
  assert.equal(provider.factCheckCalls, 1);
  assert.equal(provider.summarizeCalls, 0);
  assert.equal(result.execution?.plannedMode, "GROUNDED_FACT_CHECK");
});

test("키(provider)가 없으면 not_configured로 규칙 폴백한다", async () => {
  const result = await successResult(req("고객님, 이번 달 카드 대금 결제 예정 안내입니다. 이용해 주셔서 감사합니다."), null);
  assert.equal(result.execution?.plannedMode, "AI_SUMMARY");
  assert.equal(result.execution?.executedMode, "RULE_ONLY");
  assert.equal(result.execution?.aiStatus, "not_configured");
  assert.equal(result.execution?.fallbackUsed, true);
  assert.ok(result.warnings?.some((w) => w.code === "AI_NOT_CONFIGURED"));
});

test("AI가 반환한 원문에 없는 quote와 중복은 제거된다", async () => {
  const provider = new FakeProvider({ kind: "used", analysis: usedAnalysis(["다음", "다음", "원문에없는문구"]) });
  const result = await successResult(req("고객님 카드 이용 안내입니다. 다음 달 결제 예정을 알려드립니다."), provider);
  assert.deepEqual(result.ai.riskPhrases, ["다음"]);
});

test("AI 보조 신호만으로는 danger/critical을 만들지 않는다(총합 10점 상한)", async () => {
  const provider = new FakeProvider({ kind: "used", analysis: usedAnalysis(["가격", "나중", "다음", "마트"]) });
  const result = await successResult(req("가격 나중 다음 마트 이용 안내문입니다. 천천히 확인해 주세요."), provider);
  assert.ok(result.riskScore <= 10);
  assert.ok(result.riskLevel === "safe" || result.riskLevel === "caution");
});

test("provider timeout이면 HTTP 200 규칙 폴백(aiStatus=timeout)", async () => {
  const provider = new FakeProvider({ kind: "failure", status: "timeout" });
  const result = await successResult(req("고객님, 이번 달 카드 대금 결제 예정 안내입니다. 이용해 주셔서 감사합니다."), provider);
  assert.equal(result.execution?.aiStatus, "timeout");
  assert.equal(result.execution?.fallbackUsed, true);
  assert.equal(result.ai.used, false);
  assert.ok(result.warnings?.some((w) => w.code === "AI_TIMEOUT"));
});

test("잘못된 요청 형식 → 400 INVALID_REQUEST", async () => {
  const outcome = await analyzeInput({ foo: 1 }, null);
  assert.equal(outcome.kind, "error");
  if (outcome.kind !== "error") return;
  assert.equal(outcome.status, 400);
  assert.equal(outcome.code, "INVALID_REQUEST");
});

test("짧은 입력 → 400 INPUT_TOO_SHORT", async () => {
  const outcome = await analyzeInput(req("짧다"), null);
  assert.equal(outcome.kind, "error");
  if (outcome.kind !== "error") return;
  assert.equal(outcome.status, 400);
  assert.equal(outcome.code, "INPUT_TOO_SHORT");
});

test("긴 입력 → 413 INPUT_TOO_LONG", async () => {
  const outcome = await analyzeInput(req("가".repeat(6001)), null);
  assert.equal(outcome.kind, "error");
  if (outcome.kind !== "error") return;
  assert.equal(outcome.status, 413);
  assert.equal(outcome.code, "INPUT_TOO_LONG");
});

test("잘못된 URL → 422 INVALID_URL", async () => {
  const outcome = await analyzeInput({ type: "url", content: "그냥 문장입니다" }, null);
  assert.equal(outcome.kind, "error");
  if (outcome.kind !== "error") return;
  assert.equal(outcome.status, 422);
  assert.equal(outcome.code, "INVALID_URL");
});

test("로컬/사설 URL → 422 BLOCKED_URL", async () => {
  const outcome = await analyzeInput({ type: "url", content: "http://localhost:3000/x" }, null);
  assert.equal(outcome.kind, "error");
  if (outcome.kind !== "error") return;
  assert.equal(outcome.status, 422);
  assert.equal(outcome.code, "BLOCKED_URL");
});

test("provider 내부 예외는 상위로 전파된다(어댑터에서 500 처리)", async () => {
  const throwing: AnalysisProvider = {
    async summarize() {
      throw new Error("boom");
    },
    async factCheck() {
      throw new Error("boom");
    },
  };
  await assert.rejects(() => analyzeInput(req("고객님, 카드 대금 결제 예정 안내입니다. 감사합니다."), throwing));
});
