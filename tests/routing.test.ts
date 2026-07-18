import assert from "node:assert/strict";
import test from "node:test";
import { detectSignals } from "../src/lib/rules.ts";
import { chooseAnalysisMode } from "../src/lib/routing.ts";

function route(text: string) {
  return chooseAnalysisMode(detectSignals(text), text);
}

test("가족 사칭 + 송금 → RULE_ONLY", () => {
  const decision = route("엄마 나야. 폰 번호가 바뀌었어. 급한데 이 계좌로 송금해줘.");
  assert.equal(decision.mode, "RULE_ONLY");
});

test("송금 + 긴급성 → RULE_ONLY", () => {
  const decision = route("지금 즉시 아래 계좌로 입금해 주세요. 늦으면 처리되지 않습니다.");
  assert.equal(decision.mode, "RULE_ONLY");
});

test("인증번호 + 링크 → RULE_ONLY", () => {
  const decision = route("본인 확인을 위해 인증번호를 아래 링크에서 입력하세요. http://bit.ly/abcd");
  assert.equal(decision.mode, "RULE_ONLY");
});

test("원격제어 요구 → RULE_ONLY", () => {
  const decision = route("고객센터입니다. 화면 공유 앱을 설치하고 원격제어를 허용해 주세요.");
  assert.equal(decision.mode, "RULE_ONLY");
});

test("평범한 카드 이용 안내 → AI_SUMMARY", () => {
  const decision = route("고객님, 이번 달 카드 대금 결제 예정 안내입니다. 이용해 주셔서 감사합니다.");
  assert.equal(decision.mode, "AI_SUMMARY");
});

test("정책 지원금 지급 주장 → GROUNDED_FACT_CHECK", () => {
  const decision = route("다음 달부터 만 65세 이상 모든 국민에게 정부가 매달 30만 원을 지급합니다.");
  assert.equal(decision.mode, "GROUNDED_FACT_CHECK");
});

test("건강 완치 주장 → GROUNDED_FACT_CHECK", () => {
  const decision = route("이 건강식품을 매일 드시면 암이 완치된다고 합니다.");
  assert.equal(decision.mode, "GROUNDED_FACT_CHECK");
});

test("단순 의견문 → AI_SUMMARY", () => {
  const decision = route("저는 요즘 날씨가 참 좋아서 산책하기 좋다고 느꼈어요.");
  assert.equal(decision.mode, "AI_SUMMARY");
});

test("결정 이유 코드를 함께 반환한다", () => {
  const decision = route("지금 즉시 아래 계좌로 입금해 주세요.");
  assert.ok(decision.reasons.length > 0);
});
