import assert from "node:assert/strict";
import test from "node:test";
import { httpStatusToFailure, parseGeminiAnalysis } from "../src/services/gemini.ts";

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
  assert.equal(httpStatusToFailure(429), "rate_limited");
  assert.equal(httpStatusToFailure(500), "upstream_error");
  assert.equal(httpStatusToFailure(503), "upstream_error");
  assert.equal(httpStatusToFailure(400), "upstream_error");
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
