import assert from "node:assert/strict";
import test from "node:test";
import { isAnalysisResult } from "../src/lib/analysisResult.ts";
import {
  buildGeminiRequest,
  httpStatusToFailure,
  parseGeminiAnalysis,
  parseGeminiJson,
  requestGeminiAnalysis,
} from "../src/services/gemini.ts";

test("보이스피싱 응답에서 원문에 있는 의심 문구만 남긴다", () => {
  const result = parseGeminiAnalysis(
    {
      summary: "카드 정지를 이유로 인증을 요구하는 글입니다.",
      messageType: "financial_impersonation",
      requestedActions: ["open_link", "enter_credentials"],
      signals: [
        { quote: "오늘 안에", code: "urgent_payment" },
        { quote: "원문에 없는 문장", code: "unknown" },
      ],
    },
    "오늘 안에 링크에서 인증번호를 입력하세요.",
  );

  assert.ok(result);
  assert.deepEqual(result.riskPhrases, ["오늘 안에"]);
  assert.equal(result.used, true);
});

test("rejects malformed model data", () => {
  assert.equal(parseGeminiAnalysis({ summary: 12 }, "원문"), null);
});

test("HTTP 상태를 AI 실패 상태로 매핑한다", () => {
  assert.equal(httpStatusToFailure(401), "configuration_error");
  assert.equal(httpStatusToFailure(403), "configuration_error");
  assert.equal(httpStatusToFailure(404), "configuration_error");
  assert.equal(httpStatusToFailure(408), "timeout");
  assert.equal(httpStatusToFailure(429), "rate_limited");
  assert.equal(httpStatusToFailure(500), "upstream_error");
  assert.equal(httpStatusToFailure(503), "upstream_error");
  assert.equal(httpStatusToFailure(400), "invalid_response");
});

test("보이스피싱 요약 요청은 키를 헤더로 보내고 검색 도구를 사용하지 않는다", () => {
  const request = buildGeminiRequest({
    source: { kind: "text", maskedText: "정부 지원금은 다음 달부터 지급됩니다." },
    mode: "summary",
    apiKey: "test-key",
  });

  assert.equal(request.url.includes("test-key"), false);
  assert.equal(request.init.headers["x-goog-api-key"], "test-key");
  const body = JSON.parse(request.init.body);
  assert.equal(body.tools, undefined);
  assert.deepEqual(body.generationConfig.responseJsonSchema.required, ["messageType", "summary", "requestedActions", "signals"]);
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(body.generationConfig.responseJsonSchema.type, "object");
});

test("코드 펜스로 감싼 JSON 응답을 읽는다", () => {
  const parsed = parseGeminiJson('```json\n{"summary":"요약","infoType":"공공 정보","actions":[],"riskPhrases":[],"difficultTerms":[],"missingInfo":[]}\n```');

  assert.deepEqual(parsed, {
    summary: "요약",
    infoType: "공공 정보",
    actions: [],
    riskPhrases: [],
    difficultTerms: [],
    missingInfo: [],
  });
});

test("주입된 fetch로 보이스피싱 요약 응답을 한 번만 처리한다", async () => {
  const previousApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  let calls = 0;

  try {
    const outcome = await requestGeminiAnalysis(
      { kind: "text", maskedText: "엄마, 지금 바로 50만 원만 보내줘." },
      "summary",
      async (_url, init) => {
        calls += 1;
        assert.equal(new Headers(init.headers).get("x-goog-api-key"), "test-key");
        return Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{"messageType":"family_impersonation","summary":"가족을 사칭해 급하게 돈을 보내 달라고 하는 내용입니다.","requestedActions":["send_money"],"signals":[{"quote":"50만 원만 보내줘","code":"urgent_payment"}]}',
                  },
                ],
              },
            },
          ],
        });
      },
    );

    assert.equal(calls, 1);
    assert.equal(outcome.kind, "success");
    if (outcome.kind === "success") assert.equal(outcome.analysis.messageType, "family_impersonation");
  } finally {
    if (previousApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousApiKey;
  }
});

test("URL 입력은 Gemini에 전달하지 않는다", async () => {
  let calls = 0;
  const outcome = await requestGeminiAnalysis(
    { kind: "url", url: "https://short.example/link" },
    "summary",
    async () => {
      calls += 1;
      return Response.json({});
    },
  );

  assert.equal(calls, 0);
  assert.deepEqual(outcome, { kind: "failure", status: "invalid_response" });
});

test("기록 검증기는 옛 기록의 잔여 grounding 필드를 무시하고 통과시킨다", () => {
  // fact-check 기능 제거 전에 저장된 기록에는 ai.grounding 등이 남아 있을 수 있다.
  const result = {
    inputType: "text",
    sourceUrl: null,
    maskedText: "정부 지원금 안내입니다.",
    mask: { maskedCount: 0, counts: { phone: 0, account: 0, code: 0, rrn: 0, card: 0 } },
    signals: [],
    ai: {
      summary: "지원금 안내입니다.",
      infoType: "공공 정보",
      actions: [],
      riskPhrases: [],
      difficultTerms: [],
      missingInfo: [],
      used: true,
      grounding: { sources: [{ title: "IANA", url: "https://www.iana.org/help/example-domains" }] },
    },
    riskLevel: "safe",
    riskScore: 0,
    recommendation: "공식 기관에서 다시 확인하세요.",
    createdAt: "2026-07-19T00:00:00.000Z",
  };

  assert.equal(isAnalysisResult(result), true);
});

test("limits arrays and removes empty values", () => {
  const result = parseGeminiAnalysis(
    {
      summary: "요약",
      infoType: "일반 안내",
      actions: ["", "확인", "A", "B", "C", "D"],
      riskPhrases: [],
      difficultTerms: [],
      missingInfo: ["", "공식 홈페이지"],
    },
    "원문",
  );

  assert.deepEqual(result?.actions, ["확인", "A", "B", "C"]);
  assert.deepEqual(result?.missingInfo, ["공식 홈페이지"]);
});
