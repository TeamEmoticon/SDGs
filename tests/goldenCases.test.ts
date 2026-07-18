// goldenCases.test.ts
// 10개의 실제 문구로 판독률을 측정했을 때 드러난 미탐(#2, #3, #7, #9, #10)을 회귀 테스트로 고정한다.
// 키 없이(provider=null) 규칙 엔진만으로 검증한다 — AI가 꺼져도 지켜져야 할 안전망이기 때문이다.
import assert from "node:assert/strict";
import test from "node:test";
import { EXAMPLES } from "../src/lib/examples.ts";
import { analyzeInput } from "../src/services/analysis.ts";
import type { RiskLevel } from "../src/lib/types.ts";

const LEVEL_RANK: Record<RiskLevel, number> = { safe: 0, caution: 1, danger: 2, critical: 3 };
const req = (content: string) => ({ type: "text" as const, content });

async function analyze(text: string) {
  const outcome = await analyzeInput(req(text), null);
  assert.equal(outcome.kind, "success");
  if (outcome.kind !== "success") throw new Error("unreachable");
  return outcome.result;
}

function atLeast(actual: RiskLevel, minimum: RiskLevel): void {
  assert.ok(
    LEVEL_RANK[actual] >= LEVEL_RANK[minimum],
    `expected risk level at least "${minimum}" but got "${actual}"`,
  );
}

// ---- 명백한 사기 조합: RULE_ONLY + 등급 하한 ------------------------------

test("검찰 사칭 협박+송금 → RULE_ONLY, critical", async () => {
  const result = await analyze(
    "[국제발신] 서울중앙지검입니다. 귀하 명의 계좌가 범죄에 연루되어 조사가 필요합니다. 지금 즉시 안전계좌로 전액을 이체하지 않으면 체포영장이 발부됩니다.",
  );
  assert.equal(result.execution?.plannedMode, "RULE_ONLY");
  assert.equal(result.riskLevel, "critical");
});

test("가족 사칭(번호 변경)+구어체 송금 요구 → RULE_ONLY, danger 이상", async () => {
  const result = await analyze("엄마 나 폰 액정 깨져서 번호 바뀌었어. 지금 급하게 30만원만 이 계좌로 보내줄 수 있어? 이따 줄게.");
  assert.equal(result.execution?.plannedMode, "RULE_ONLY");
  atLeast(result.riskLevel, "danger");
});

test("스미싱(인증번호+링크) → RULE_ONLY, danger 이상", async () => {
  const result = await analyze(
    "[Web발신] 택배 배송 불가. 주소지 오류로 반송 예정. 아래 링크에서 본인 인증번호를 입력해 확인하세요. http://bit.ly/parcel-kr",
  );
  assert.equal(result.execution?.plannedMode, "RULE_ONLY");
  atLeast(result.riskLevel, "danger");
});

test("원격제어(팀뷰어) 요구 → RULE_ONLY, critical", async () => {
  const result = await analyze("고객님 컴퓨터가 해킹되었습니다. 복구를 위해 팀뷰어 원격제어 앱을 설치하고 접속 번호를 알려주세요.");
  assert.equal(result.execution?.plannedMode, "RULE_ONLY");
  assert.equal(result.riskLevel, "critical");
});

test("정부 지원금 지급 확정 주장 → AI_SUMMARY", async () => {
  const result = await analyze(
    "속보! 정부가 다음 달부터 만 19세 이상 전 국민에게 민생지원금 50만원을 조건 없이 지급하기로 확정 발표했습니다.",
  );
  assert.equal(result.execution?.plannedMode, "AI_SUMMARY");
});

test("건강 완치 은폐 주장도 → AI_SUMMARY", async () => {
  const result = await analyze("이 나물을 3주만 꾸준히 드시면 고혈압과 당뇨가 완치된다고 합니다. 병원에서도 쉬쉬하는 비밀입니다.");
  assert.equal(result.execution?.plannedMode, "AI_SUMMARY");
});

// ---- 애매한 요청: 규칙 점수는 붙지만 RULE_ONLY까지는 아님 ------------------

test("맥락 없는 계좌번호 요청 → 위험 신호로 인식(safe 아님)", async () => {
  const result = await analyze("안녕하세요 과장님, 지난번 회의 건으로 계좌번호 하나 문자로 남겨주시겠어요? 처리해두겠습니다.");
  assert.notEqual(result.riskLevel, "safe");
});

// ---- 정상 문자: 오탐(과대평가) 없어야 함 ----------------------------------

test("정상 택배 안내 → safe, 신호 없음", async () => {
  const result = await analyze("[CJ대한통운] 고객님의 상품이 오늘 오후 배송 예정입니다. 부재 시 경비실에 보관됩니다. 감사합니다.");
  assert.equal(result.riskLevel, "safe");
  assert.equal(result.signals.length, 0);
});

test("정상 카드 청구 안내 → safe, 신호 없음", async () => {
  const result = await analyze("[신한카드] 3월 청구금액 452,000원이 3월 25일 출금될 예정입니다. 자세한 내역은 앱에서 확인하세요.");
  assert.equal(result.riskLevel, "safe");
  assert.equal(result.signals.length, 0);
});

test("당첨 경품 미끼+단축링크 → 위험 신호(danger 이상)", async () => {
  const result = await analyze(
    "축하합니다! 고객님은 스타벅스 100만원 상품권 당첨자로 선정되셨습니다. 지금 링크를 눌러 수령 정보를 입력하세요. http://event-gift.co",
  );
  atLeast(result.riskLevel, "danger");
});

test("인증번호를 알려주지 말라는 정상 안내 → safe", async () => {
  const result = await analyze("인증번호를 타인에게 알려주지 마세요. 은행 직원도 인증번호를 요구하지 않습니다.");
  assert.equal(result.riskLevel, "safe");
  assert.equal(result.execution?.plannedMode, "AI_SUMMARY");
});

test("원격제어를 요구하지 않는다는 정상 안내 → safe", async () => {
  const result = await analyze("고객센터는 원격제어 앱 설치나 화면 공유를 절대 요구하지 않습니다.");
  assert.equal(result.riskLevel, "safe");
  assert.equal(result.execution?.plannedMode, "AI_SUMMARY");
});

test("송금 사기 예방 안내 → safe", async () => {
  const result = await analyze("사기 예방 안내입니다. 모르는 사람이 송금이나 계좌이체를 요구하면 112에 신고하세요.");
  assert.equal(result.riskLevel, "safe");
});

test("계좌번호를 보내 달라는 일상 요청 → caution", async () => {
  const result = await analyze("엄마, 저녁값 정산하려고 하는데 내 계좌번호 다시 보내줄래?");
  assert.equal(result.riskLevel, "caution");
  assert.equal(result.execution?.plannedMode, "AI_SUMMARY");
});

test("원격제어 RULE_ONLY 결과의 점수는 critical 범위", async () => {
  const result = await analyze("고객님 컴퓨터가 해킹되었습니다. 복구를 위해 팀뷰어 원격제어 앱을 설치하고 접속 번호를 알려주세요.");
  assert.equal(result.riskLevel, "critical");
  assert.ok(result.riskScore >= 85);
});

test("송금 재촉 RULE_ONLY 결과는 danger 점수 구간을 사용한다", async () => {
  const result = await analyze("지금 급하니 오늘 안으로 30만원을 계좌이체로 보내주세요.");
  assert.equal(result.riskLevel, "danger");
  assert.ok(result.riskScore >= 60 && result.riskScore < 85);
});

test("인증번호와 링크를 함께 요구하면 critical로 표시한다", async () => {
  const result = await analyze("아래 링크를 눌러 인증번호를 입력하세요. http://bit.ly/verify-me");
  assert.equal(result.riskLevel, "critical");
  assert.ok(result.riskScore >= 85);
});

for (const example of EXAMPLES) {
  test(`연습 예시 ${example.title}은 안내한 예상 위험 단계와 일치한다`, async () => {
    const result = await analyze(example.content);
    assert.equal(result.riskLevel, example.expectedRisk, example.title);
  });
}

test("예방 표현 뒤 실제 인증 요구가 있으면 RULE_ONLY를 유지한다", async () => {
  const result = await analyze("인증번호는 알려주지 말고 아래 링크에 직접 입력하세요. http://bit.ly/verify-me");
  assert.equal(result.execution?.plannedMode, "RULE_ONLY");
  atLeast(result.riskLevel, "danger");
});

test("정상 정부 정책 뉴스는 사칭 신호 없이 요약만 계획한다", async () => {
  const result = await analyze("정부는 내년 최저임금을 인상한다고 발표했습니다.");
  assert.equal(result.execution?.plannedMode, "AI_SUMMARY");
  assert.equal(result.riskLevel, "safe");
  assert.equal(result.signals.some((signal) => signal.id === "impersonate-agency"), false);
});

test("일반 할인 혜택 광고는 환급 미끼 신호 없이 안전하다", async () => {
  const result = await analyze("가을 할인 이벤트 혜택을 확인하세요.");
  assert.equal(result.riskLevel, "safe");
  assert.equal(result.signals.some((signal) => signal.id === "reward-refund"), false);
});

test("출처를 밝힌 건강 정보는 Grounding 대신 요약한다", async () => {
  const result = await analyze("질병관리청 발표에 따르면 예방접종은 감염 위험을 낮출 수 있습니다.");
  assert.equal(result.execution?.plannedMode, "AI_SUMMARY");
});

test("높임말 앱 설치 요구도 설치 유도 신호로 탐지한다", async () => {
  const result = await analyze("금융감독원입니다. 보안 앱을 설치하시고 주민등록번호와 계좌번호를 입력하세요.");
  assert.equal(result.signals.some((signal) => signal.id === "link-install"), true);
});

test("전각 계좌번호도 마스킹한 뒤 분석한다", async () => {
  const result = await analyze("계좌번호 １２３４５６７８９０１２로 지금 송금하세요.");
  assert.equal(result.mask.counts.account, 1);
  assert.equal(result.maskedText.includes("１２３４５６７８９０１２"), false);
});

test("제로폭 문자가 낀 송금 요구도 탐지한다", async () => {
  const result = await analyze("계\u200b좌이\u200b체로 지금 보내주세요.");
  assert.equal(result.signals.some((signal) => signal.id === "money-transfer"), true);
});

test("인증번호를 요구하지 않는다는 예방 안내는 안전하게 유지한다", async () => {
  const result = await analyze("은행 직원은 인증번호를 요구하지 않습니다. 의심스러운 연락은 고객센터로 확인하세요.");
  assert.equal(result.riskLevel, "safe");
  assert.equal(result.signals.some((signal) => signal.id === "pinfo-secrets"), false);
});

test("계좌이체를 언급해도 실제 송금 요구가 아니면 계좌번호 요청만 남긴다", async () => {
  const result = await analyze("계좌이체로 회비를 보내려고 합니다. 모임 계좌번호를 알려주세요.");
  assert.equal(result.riskLevel, "caution");
  assert.equal(result.signals.some((signal) => signal.id === "money-transfer"), false);
});

test("공식 고객센터 확인을 권하는 앱 설치 예방 안내는 안전하다", async () => {
  const result = await analyze("보안 앱 설치가 필요하다는 연락을 받으면 먼저 공식 고객센터에 확인하세요.");
  assert.equal(result.riskLevel, "safe");
  assert.equal(result.signals.some((signal) => signal.id === "link-install"), false);
});

test("지원금 지급 대상 확대 주장은 요약 경로로 보낸다", async () => {
  const result = await analyze("정부가 재난지원금 지급 대상을 확대한다고 발표했습니다.");
  assert.equal(result.execution?.plannedMode, "AI_SUMMARY");
});

test("개인정보 미제출 처벌 협박은 명백한 사기로 처리한다", async () => {
  const result = await analyze("수사기관입니다. 개인정보를 제출하지 않으면 즉시 처벌을 받습니다. 주민등록번호를 보내세요.");
  assert.equal(result.execution?.plannedMode, "RULE_ONLY");
  assert.equal(result.riskLevel, "critical");
});

test("경찰 사칭과 보증금 미송금 협박은 명백한 사기로 처리한다", async () => {
  const result = await analyze("경찰청 사건 담당자입니다. 보증금을 송금하지 않으면 출석 요구서를 발부합니다.");
  assert.equal(result.execution?.plannedMode, "RULE_ONLY");
  assert.equal(result.riskLevel, "critical");
});
