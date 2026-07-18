import assert from "node:assert/strict";
import test from "node:test";
import { isAnalysisResult } from "../src/lib/analysisResult.ts";
import {
  buildGeminiRequest,
  httpStatusToFailure,
  parseGeminiAnalysis,
  parseGeminiJson,
  parseGroundingEvidence,
  requestGeminiAnalysis,
} from "../src/services/gemini.ts";

test("keeps only risk phrases that appear in the masked source", () => {
  const result = parseGeminiAnalysis(
    {
      summary: "카드 정지를 이유로 인증을 요구하는 글입니다.",
      infoType: "금융·공과금 알림",
      actions: ["링크 접속", "인증번호 입력"],
      riskPhrases: ["오늘 안에", "원문에 없는 문장"],
      difficultTerms: [{ term: "본인확인", easyMeaning: "내가 맞는지 확인하는 절차" }],
      missingInfo: ["공식 고객센터 번호"],
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

test("grounded 요청은 키를 헤더로 보내고 Google Search 도구를 사용한다", () => {
  const request = buildGeminiRequest({
    source: { kind: "text", maskedText: "정부 지원금은 다음 달부터 지급됩니다." },
    mode: "grounded",
    apiKey: "test-key",
  });

  assert.equal(request.url.includes("test-key"), false);
  assert.equal(request.init.headers["x-goog-api-key"], "test-key");
  const body = JSON.parse(request.init.body);
  assert.deepEqual(body.tools, [{ google_search: {} }]);
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(body.generationConfig.responseJsonSchema.type, "object");
});

test("URL 요청은 URL Context 도구를 사용한다", () => {
  const request = buildGeminiRequest({
    source: { kind: "url", url: "https://www.iana.org/help/example-domains" },
    mode: "summary",
    apiKey: "test-key",
  });

  const body = JSON.parse(request.init.body);
  assert.deepEqual(body.tools, [{ url_context: {} }]);
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(body.generationConfig.responseJsonSchema.type, "object");
});

test("도구 응답의 코드 펜스 JSON과 검증된 출처를 읽는다", () => {
  const parsed = parseGeminiJson('```json\n{"summary":"요약","infoType":"공공 정보","actions":[],"riskPhrases":[],"difficultTerms":[],"missingInfo":[]}\n```');
  const evidence = parseGroundingEvidence({
    candidates: [
      {
        groundingMetadata: {
          searchEntryPoint: { renderedContent: "<div>Google Search</div>" },
          groundingChunks: [
            { web: { title: "IANA", uri: "https://www.iana.org/help/example-domains" } },
            { web: { title: "IANA", uri: "https://www.iana.org/help/example-domains" } },
            { web: { title: "잘못된 출처", uri: "javascript:alert(1)" } },
          ],
        },
      },
    ],
  });

  assert.deepEqual(parsed, {
    summary: "요약",
    infoType: "공공 정보",
    actions: [],
    riskPhrases: [],
    difficultTerms: [],
    missingInfo: [],
  });
  assert.deepEqual(evidence?.sources, [{ title: "IANA", url: "https://www.iana.org/help/example-domains" }]);
  assert.equal(evidence?.searchSuggestionHtml, "<div>Google Search</div>");
});

test("출처가 없는 grounded 응답은 검증에서 제외한다", () => {
  assert.equal(parseGroundingEvidence({ candidates: [{ groundingMetadata: { groundingChunks: [] } }] }), null);
});

test("Grounding은 인용한 주장과 근거 수준을 함께 반환한다", () => {
  const input = "정부가 다음 달부터 모든 국민에게 지원금을 지급한다고 확정 발표했습니다.";
  const evidence = {
    sources: [{ title: "공식 안내", url: "https://www.example.com/notice" }],
    hasLinkedSupport: true,
  };
  const analysis = parseGeminiAnalysis(
    {
      summary: "지원금 지급 주장입니다.",
      infoType: "정부·정책",
      actions: ["공식 안내를 확인하세요."],
      riskPhrases: [],
      difficultTerms: [],
      missingInfo: [],
      factCheck: {
        claimQuote: "정부가 다음 달부터 모든 국민에게 지원금을 지급한다고 확정 발표했습니다.",
        verdict: "contradicted",
        explanation: "공식 발표 자료에서 같은 내용을 확인하지 못했습니다.",
      },
    },
    input,
    evidence,
  );

  assert.deepEqual(Reflect.get(analysis ?? {}, "factCheck"), {
    claimQuote: input,
    verdict: "contradicted",
    explanation: "공식 발표 자료에서 같은 내용을 확인하지 못했습니다.",
    evidenceStrength: "linked",
  });
});

test("연결 근거가 없는 Grounding은 근거 부족으로 낮춘다", () => {
  const input = "이 건강식품을 드시면 암이 완치된다고 합니다.";
  const analysis = parseGeminiAnalysis(
    {
      summary: "건강식품 완치 주장입니다.",
      infoType: "건강 정보",
      actions: ["의료진에게 확인하세요."],
      riskPhrases: [],
      difficultTerms: [],
      missingInfo: [],
      factCheck: {
        claimQuote: "이 건강식품을 드시면 암이 완치된다고 합니다.",
        verdict: "supported",
        explanation: "검색 자료가 있습니다.",
      },
    },
    input,
    { sources: [{ title: "자료", url: "https://www.example.com/health" }] },
  );

  assert.deepEqual(Reflect.get(analysis ?? {}, "factCheck"), {
    claimQuote: input,
    verdict: "insufficient_evidence",
    explanation: "검색 자료가 있습니다.",
    evidenceStrength: "limited",
  });
});

test("주입된 fetch로 grounded 응답을 한 번만 처리한다", async () => {
  const previousApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  let calls = 0;

  try {
    const outcome = await requestGeminiAnalysis(
      { kind: "text", maskedText: "IANA가 example.com을 문서 예시용 도메인으로 관리합니다." },
      "grounded",
      async (_url, init) => {
        calls += 1;
        assert.equal(new Headers(init.headers).get("x-goog-api-key"), "test-key");
        return Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{"summary":"문서 예시 도메인 안내입니다.","infoType":"공공 정보","actions":[],"riskPhrases":[],"difficultTerms":[],"missingInfo":[],"factCheck":{"claimQuote":"IANA가 example.com을 문서 예시용 도메인으로 관리합니다.","verdict":"supported","explanation":"IANA 안내에서 example.com을 문서 예시용으로 설명합니다."}}',
                  },
                ],
              },
              groundingMetadata: {
                groundingChunks: [{ web: { title: "IANA", uri: "https://www.iana.org/help/example-domains" } }],
                groundingSupports: [{ segment: { text: "문서 예시 도메인 안내입니다." }, groundingChunkIndices: [0] }],
              },
            },
          ],
        });
      },
    );

    assert.equal(calls, 1);
    assert.equal(outcome.kind, "success");
    if (outcome.kind === "success") assert.equal(outcome.analysis.grounding?.sources.length, 1);
  } finally {
    if (previousApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousApiKey;
  }
});

test("URL Context 성공과 읽기 실패를 분리한다", async () => {
  const previousApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";

  try {
    const success = await requestGeminiAnalysis(
      { kind: "url", url: "https://www.iana.org/help/example-domains" },
      "summary",
      async () =>
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{"summary":"문서 예시 도메인 안내입니다.","infoType":"웹페이지","actions":[],"riskPhrases":[],"difficultTerms":[],"missingInfo":[]}',
                  },
                ],
              },
              urlContextMetadata: {
                urlMetadata: [{ urlRetrievalStatus: "URL_RETRIEVAL_STATUS_SUCCESS" }],
              },
            },
          ],
        }),
    );
    const unreadable = await requestGeminiAnalysis(
      { kind: "url", url: "https://nonexistent.invalid/" },
      "summary",
      async () =>
        Response.json({
          candidates: [
            {
              content: { parts: [{ text: "{}" }] },
              urlContextMetadata: {
                urlMetadata: [{ urlRetrievalStatus: "URL_RETRIEVAL_STATUS_UNAVAILABLE" }],
              },
            },
          ],
        }),
    );

    assert.equal(success.kind, "success");
    assert.equal(unreadable.kind, "url-unavailable");
  } finally {
    if (previousApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousApiKey;
  }
});

test("클라이언트 결과 검증기는 grounding 출처를 엄격히 검사한다", () => {
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
  assert.equal(
    isAnalysisResult({ ...result, ai: { ...result.ai, grounding: { sources: [{ title: "IANA", url: "javascript:alert(1)" }] } } }),
    false,
  );
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
