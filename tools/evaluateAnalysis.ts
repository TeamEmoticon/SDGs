import { analyzeInput } from "../src/services/analysis.ts";
import { createDefaultProvider } from "../src/services/provider.ts";
import type { AnalysisMode, AnalysisResult, RiskLevel } from "../src/lib/types.ts";

interface ExpectedOutcome {
  readonly plannedMode: AnalysisMode;
  readonly riskLevel?: RiskLevel;
  readonly minimumRisk?: RiskLevel;
}

interface EvaluationCase {
  readonly id: string;
  readonly content: string;
  readonly expected: ExpectedOutcome;
}

const RISK_RANK: Record<RiskLevel, number> = { safe: 0, caution: 1, danger: 2, critical: 3 };

const CASES: readonly EvaluationCase[] = [
  { id: "S01", content: "서울중앙지검입니다. 범죄 계좌 조사비를 지금 안전계좌로 이체하지 않으면 체포영장이 발부됩니다.", expected: { plannedMode: "RULE_ONLY", minimumRisk: "critical" } },
  { id: "S02", content: "엄마 나 휴대폰이 고장 나서 번호가 바뀌었어. 지금 이 계좌로 30만원만 보내줄 수 있어?", expected: { plannedMode: "RULE_ONLY", minimumRisk: "danger" } },
  { id: "S03", content: "택배 주소 오류입니다. 아래 링크에서 인증번호를 입력하세요. http://bit.ly/verify-parcel", expected: { plannedMode: "RULE_ONLY", minimumRisk: "danger" } },
  { id: "S04", content: "컴퓨터 복구를 위해 팀뷰어 원격제어 앱을 설치하고 접속 번호를 알려주세요.", expected: { plannedMode: "RULE_ONLY", minimumRisk: "critical" } },
  { id: "S05", content: "지금 바로 아래 계좌로 입금해 주세요. 오늘 안에 보내지 않으면 혜택이 취소됩니다.", expected: { plannedMode: "RULE_ONLY", minimumRisk: "danger" } },
  { id: "S06", content: "금융감독원입니다. 보안 앱을 설치하시고 주민등록번호와 계좌번호를 입력하세요.", expected: { plannedMode: "RULE_ONLY", minimumRisk: "critical" } },
  { id: "S07", content: "수사기관입니다. 개인정보를 제출하지 않으면 즉시 처벌을 받습니다. 주민등록번호를 보내세요.", expected: { plannedMode: "RULE_ONLY", minimumRisk: "critical" } },
  { id: "S08", content: "애니데스크를 설치해 주세요. 원격으로 계좌 인증을 도와드리겠습니다.", expected: { plannedMode: "RULE_ONLY", minimumRisk: "critical" } },
  { id: "S09", content: "카드가 정지되었습니다. http://bit.ly/card-help 에서 OTP 인증번호를 입력해 해제하세요.", expected: { plannedMode: "RULE_ONLY", minimumRisk: "danger" } },
  { id: "S10", content: "사장님, 거래처 대금입니다. 지금 계좌이체로 보내주세요. 늦으면 계약이 취소됩니다.", expected: { plannedMode: "AI_SUMMARY", minimumRisk: "danger" } },
  { id: "S11", content: "경찰청 사건 담당자입니다. 보증금을 송금하지 않으면 출석 요구서를 발부합니다.", expected: { plannedMode: "RULE_ONLY", minimumRisk: "critical" } },
  { id: "S12", content: "화면 공유를 켜고 원격조종 앱을 설치해 주세요. 보안코드를 알려주시면 됩니다.", expected: { plannedMode: "RULE_ONLY", minimumRisk: "critical" } },
  { id: "N01", content: "[신한카드] 3월 청구금액 452,000원이 3월 25일 출금될 예정입니다. 자세한 내역은 앱에서 확인하세요.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "N02", content: "[CJ대한통운] 고객님의 상품이 오늘 오후 배송 예정입니다. 부재 시 경비실에 보관됩니다.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "N03", content: "은행 직원은 인증번호를 요구하지 않습니다. 의심스러운 연락은 고객센터로 확인하세요.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "N04", content: "내일 오후 2시에 병원 진료 예약이 있습니다. 방문이 어려우면 전날까지 연락해 주세요.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "N05", content: "가을 할인 이벤트 혜택을 확인하세요. 매장 방문 고객에게만 적용됩니다.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "N06", content: "이번 주말에는 비가 예상됩니다. 외출하실 때 우산을 준비해 주세요.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "N07", content: "주민센터 문화 강좌 신청은 다음 주 월요일부터 접수합니다. 자세한 일정은 게시판을 확인하세요.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "N08", content: "자동차 보험료 납부일은 4월 10일입니다. 납부가 완료되면 안내 문자가 발송됩니다.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "N09", content: "고객센터는 원격제어 앱 설치나 화면 공유를 절대 요구하지 않습니다.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "N10", content: "사기 예방 안내입니다. 모르는 사람이 송금이나 계좌이체를 요구하면 112에 신고하세요.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "N11", content: "질병관리청 발표에 따르면 예방접종은 감염 위험을 낮출 수 있습니다.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "N12", content: "학교 급식 식단표가 변경되었습니다. 알레르기 정보는 안내문에서 확인할 수 있습니다.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "F01", content: "정부가 다음 달부터 전 국민에게 지원금 50만원을 지급하기로 확정했다고 합니다.", expected: { plannedMode: "GROUNDED_FACT_CHECK", riskLevel: "safe" } },
  { id: "F02", content: "이 나물을 3주만 드시면 고혈압과 당뇨가 완치된다고 합니다. 병원에서도 쉬쉬하는 비밀입니다.", expected: { plannedMode: "GROUNDED_FACT_CHECK", riskLevel: "safe" } },
  { id: "F03", content: "정부는 내년 최저임금을 인상한다고 발표했습니다.", expected: { plannedMode: "GROUNDED_FACT_CHECK", riskLevel: "safe" } },
  { id: "F04", content: "새 법률이 다음 달부터 시행되며 모든 국민에게 무료 건강검진을 제공한다는 기사입니다.", expected: { plannedMode: "GROUNDED_FACT_CHECK", riskLevel: "safe" } },
  { id: "F05", content: "뉴스에서 연금 지급 기준이 폐지된다고 보도했습니다.", expected: { plannedMode: "GROUNDED_FACT_CHECK", riskLevel: "safe" } },
  { id: "F06", content: "의사가 처방약을 끊어도 된다고 하지 않았는데도 이 약초가 암을 완치한다고 합니다.", expected: { plannedMode: "GROUNDED_FACT_CHECK", riskLevel: "safe" } },
  { id: "F07", content: "정부가 재난지원금 지급 대상을 확대한다고 발표했습니다.", expected: { plannedMode: "GROUNDED_FACT_CHECK", riskLevel: "safe" } },
  { id: "F08", content: "병원들이 숨기는 비밀이라며 특정 음식이 치매를 완치한다고 주장합니다.", expected: { plannedMode: "GROUNDED_FACT_CHECK", riskLevel: "safe" } },
  { id: "B01", content: "엄마, 저녁값 정산하려고 하는데 내 계좌번호 다시 보내줄래?", expected: { plannedMode: "AI_SUMMARY", riskLevel: "caution" } },
  { id: "B02", content: "안녕하세요 과장님, 지난번 회의 건으로 계좌번호 하나 문자로 남겨주시겠어요?", expected: { plannedMode: "AI_SUMMARY", riskLevel: "caution" } },
  { id: "B03", content: "계좌이체로 회비를 보내려고 합니다. 모임 계좌번호를 알려주세요.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "caution" } },
  { id: "B04", content: "고객님, 결제일에 잔액이 부족하면 자동이체가 되지 않을 수 있습니다.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "B05", content: "새 휴대폰으로 바꿔서 가족 단체방에 연락처를 다시 등록했습니다.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "B06", content: "계좌번호를 잊어버리셨나요? 앱의 내 계좌 메뉴에서 확인할 수 있습니다.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "caution" } },
  { id: "B07", content: "문자에 있는 링크는 누르지 말고, 공식 앱에서 배송 조회를 해주세요.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
  { id: "B08", content: "보안 앱 설치가 필요하다는 연락을 받으면 먼저 공식 고객센터에 확인하세요.", expected: { plannedMode: "AI_SUMMARY", riskLevel: "safe" } },
];

function meetsExpected(result: AnalysisResult, expected: ExpectedOutcome): boolean {
  if (result.execution?.plannedMode !== expected.plannedMode) return false;
  if (expected.riskLevel !== undefined && result.riskLevel !== expected.riskLevel) return false;
  if (expected.minimumRisk !== undefined && RISK_RANK[result.riskLevel] < RISK_RANK[expected.minimumRisk]) return false;
  return true;
}

async function run(): Promise<void> {
  const live = process.argv.includes("--live");
  const provider = live ? createDefaultProvider() : null;
  if (live && provider === null) throw new Error("--live 실행에는 쉘 환경의 GEMINI_API_KEY가 필요합니다.");

  const rows: Array<Record<string, string | number | boolean>> = [];
  for (const scenario of CASES) {
    const outcome = await analyzeInput({ type: "text", content: scenario.content }, provider);
    if (outcome.kind === "error") {
      rows.push({ id: scenario.id, passed: false, status: outcome.code, mode: "-", risk: "-", ai: "-", sources: 0 });
      continue;
    }
    const result = outcome.result;
    rows.push({
      id: scenario.id,
      passed: meetsExpected(result, scenario.expected),
      status: "success",
      mode: result.execution?.plannedMode ?? "-",
      risk: result.riskLevel,
      ai: result.execution?.aiStatus ?? "-",
      sources: result.ai.grounding?.sources.length ?? 0,
    });
  }

  const passed = rows.filter((row) => row.passed === true).length;
  console.table(rows);
  console.log(JSON.stringify({ mode: live ? "live" : "rules-only", total: CASES.length, passed, accuracy: Number((passed / CASES.length).toFixed(3)) }));
}

void run();
