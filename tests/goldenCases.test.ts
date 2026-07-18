// goldenCases.test.ts
// 10개의 실제 문구로 판독률을 측정했을 때 드러난 미탐(#2, #3, #7, #9, #10)을 회귀 테스트로 고정한다.
// 키 없이(provider=null) 규칙 엔진만으로 검증한다 — AI가 꺼져도 지켜져야 할 안전망이기 때문이다.
import assert from "node:assert/strict";
import test from "node:test";
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

// ---- 검증 가능한 공공 주장: GROUNDED_FACT_CHECK ---------------------------

test("정부 지원금 지급 확정 주장 → GROUNDED_FACT_CHECK", async () => {
  const result = await analyze(
    "속보! 정부가 다음 달부터 만 19세 이상 전 국민에게 민생지원금 50만원을 조건 없이 지급하기로 확정 발표했습니다.",
  );
  assert.equal(result.execution?.plannedMode, "GROUNDED_FACT_CHECK");
});

test("건강 완치 은폐 주장(나물/고혈압/당뇨) → GROUNDED_FACT_CHECK", async () => {
  const result = await analyze("이 나물을 3주만 꾸준히 드시면 고혈압과 당뇨가 완치된다고 합니다. 병원에서도 쉬쉬하는 비밀입니다.");
  assert.equal(result.execution?.plannedMode, "GROUNDED_FACT_CHECK");
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
