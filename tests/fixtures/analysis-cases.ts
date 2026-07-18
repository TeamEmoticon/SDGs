// analysis-cases.ts
// 실제 Gemini API 판독률 검증용 테스트 데이터셋(scripts/evaluate-analysis.ts에서 사용).
// 모든 입력은 명백한 가상 데이터다 — 실제 전화번호·계좌번호·주민등록번호·카드번호·주소·이메일을 쓰지 않는다.
// 단순히 키워드 하나만 바꾼 유사 데이터로 개수를 채우지 않는다: 각 사례는 목적·정보 종류·위험 신호 조합·
// 문장 길이·표현의 직접성·출처 유무·URL 유무·사실 주장과 의견의 차이·특수문자 사용 중 하나 이상이 다르다.

import type { AnalysisMode, RiskLevel } from "../../src/lib/types";

export type TestCategory =
  | "clear_scam"
  | "financial_notice"
  | "delivery"
  | "government"
  | "health"
  | "news"
  | "advertisement"
  | "safe_notice"
  | "ambiguous"
  | "unicode"
  | "invalid_input"
  | "url";

/** acceptableRiskLevels는 정답을 확정하기 어려운 사례를 위해 "unknown"도 허용한다(스펙 4장). */
export type AcceptableRiskLevel = RiskLevel | "unknown";

export interface AnalysisTestCase {
  readonly id: string;
  readonly category: TestCategory;
  readonly title: string;
  readonly inputType: "text" | "url";
  readonly input: string;
  readonly expected: {
    readonly plannedMode: AnalysisMode;
    readonly acceptableRiskLevels: readonly AcceptableRiskLevel[];
    readonly expectedSignalCodes?: readonly string[];
    readonly forbiddenSignalCodes?: readonly string[];
    readonly aiCallExpected: boolean;
    readonly notes: string;
    /**
     * 스펙 인터페이스 확장 필드(선택). 입력 검증 단계에서 구조화 오류(400/413/422)를
     * 반환할 것으로 예상되는 사례에 사용한다 — 이 경우 plannedMode/riskLevel은 해당 없음이며
     * 평가 스크립트는 이 필드가 있으면 오류 코드 일치 여부로만 통과를 판정한다.
     */
    readonly expectedOutcome?: "success" | "error";
    readonly expectedErrorCode?: string;
  };
}

export const TEST_CASES: readonly AnalysisTestCase[] = [
  // ==== A. 명백한 사기 문자 (8) ============================================
  {
    id: "A01",
    category: "clear_scam",
    title: "가족 사칭(번호 변경) + 송금 요구",
    inputType: "text",
    input: "엄마 나 폰 액정 깨져서 번호 바뀌었어. 지금 급하게 30만원만 이 계좌로 보내줄 수 있어? 이따 줄게.",
    expected: {
      plannedMode: "RULE_ONLY",
      acceptableRiskLevels: ["danger", "critical"],
      expectedSignalCodes: ["acquaintance-number"],
      aiCallExpected: false,
      notes: "가족 사칭 문자의 가장 전형적인 형태. impersonation_with_money 조합으로 critical 하한.",
    },
  },
  {
    id: "A02",
    category: "clear_scam",
    title: "검찰 사칭 + 협박 + 송금 요구",
    inputType: "text",
    input: "[국제발신] 서울중앙지검입니다. 귀하 명의 계좌가 범죄에 연루되어 조사가 필요합니다. 지금 즉시 안전계좌로 전액을 이체하지 않으면 체포영장이 발부됩니다.",
    expected: {
      plannedMode: "RULE_ONLY",
      acceptableRiskLevels: ["critical"],
      expectedSignalCodes: ["impersonate-prosecutor", "coercion-warrant", "money-transfer"],
      aiCallExpected: false,
      notes: "기관 사칭+협박+송금 삼중 조합. 가장 명백한 보이스피싱 유형.",
    },
  },
  {
    id: "A03",
    category: "clear_scam",
    title: "인증번호 요구 + 단축 링크",
    inputType: "text",
    input: "[Web발신] 택배 배송 불가. 주소지 오류로 반송 예정입니다. 아래 링크에서 본인 인증번호를 입력해 확인하세요. http://bit.ly/parcel-check-kr",
    expected: {
      plannedMode: "RULE_ONLY",
      acceptableRiskLevels: ["danger", "critical"],
      expectedSignalCodes: ["link-shorturl"],
      aiCallExpected: false,
      notes: "스미싱의 전형적 형태 — 택배 사칭 + 인증번호 + 단축 URL.",
    },
  },
  {
    id: "A04",
    category: "clear_scam",
    title: "비밀번호 단독 요구(링크 없음)",
    inputType: "text",
    input: "고객님 계좌 보안 점검 중입니다. 확인을 위해 인터넷뱅킹 비밀번호와 보안카드 번호를 답장으로 남겨주세요.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["caution", "danger"],
      expectedSignalCodes: ["pinfo-secrets"],
      aiCallExpected: true,
      notes: "비밀번호 요구는 있지만 링크·사칭·긴급성 조합이 없어 RULE_ONLY 문턱을 넘지 못한다 — 규칙 조합 보강이 필요할 수 있는 경계 사례.",
    },
  },
  {
    id: "A05",
    category: "clear_scam",
    title: "원격제어 앱 설치 요구",
    inputType: "text",
    input: "고객님 컴퓨터가 해킹되었습니다. 복구를 위해 팀뷰어 원격제어 앱을 설치하고 접속 번호를 알려주세요.",
    expected: {
      plannedMode: "RULE_ONLY",
      acceptableRiskLevels: ["critical"],
      expectedSignalCodes: ["remote-control"],
      aiCallExpected: false,
      notes: "원격제어 탈취 시도. remote_control_request 조합으로 critical 하한.",
    },
  },
  {
    id: "A06",
    category: "clear_scam",
    title: "화면 공유 요구(앱 이름 없이)",
    inputType: "text",
    input: "보안팀입니다. 지금 화면 공유를 켜시면 제가 원격으로 바이러스를 제거해 드리겠습니다.",
    expected: {
      plannedMode: "RULE_ONLY",
      acceptableRiskLevels: ["critical"],
      expectedSignalCodes: ["remote-control"],
      aiCallExpected: false,
      notes: "특정 앱 이름 없이 '화면 공유'만으로 요구하는 변형 — remote-control 규칙이 앱 이름 없이도 잡는지 확인.",
    },
  },
  {
    id: "A07",
    category: "clear_scam",
    title: "협박(명의도용) + 벌금 결제 요구",
    inputType: "text",
    input: "고객님 명의가 도용되어 범죄에 연루되었습니다. 벌금 300만원을 오늘 안에 납부하지 않으면 형사고소 처리됩니다.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["critical"],
      expectedSignalCodes: ["coercion-warrant", "coercion-crime", "urgency-pressure"],
      aiCallExpected: true,
      notes: "실제 실행 결과 발견: '벌금 납부' 표현은 money-transfer 키워드(송금/이체/입금 등)에 없어 coercion+money 조합이 성립하지 않는다 — AI_SUMMARY로 라우팅되지만 coercion-warrant가 critical severity라 등급 자체는 critical로 정확히 나온다. money 키워드에 '벌금'·'납부' 계열 추가를 검토할 여지(개선 후보, 이번 범위에서는 미수정).",
    },
  },
  {
    id: "A08",
    category: "clear_scam",
    title: "앱 설치 유도 + 개인정보 요구(원격 아님)",
    inputType: "text",
    input: "정부지원금 신청이 승인되었습니다. 전용 앱을 설치하시고 주민등록번호와 계좌번호를 입력해 수령해 주세요.",
    expected: {
      plannedMode: "RULE_ONLY",
      acceptableRiskLevels: ["danger", "critical"],
      expectedSignalCodes: ["link-install", "pinfo-rrn"],
      aiCallExpected: false,
      notes: "원격제어가 아닌 일반 앱 설치+개인정보 조합(app_install_with_sensitive_request). 정부지원금 미끼라는 점에서 D유형과도 경계.",
    },
  },

  // ==== B. 정상 또는 애매한 금융 안내 (5) ===================================
  {
    id: "B01",
    category: "financial_notice",
    title: "정상 카드 결제 알림",
    inputType: "text",
    input: "[신한카드] 3월 청구금액 452,000원이 3월 25일 출금될 예정입니다. 자세한 내역은 앱에서 확인하세요.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe"],
      forbiddenSignalCodes: ["money-transfer", "money-account-request"],
      aiCallExpected: true,
      notes: "정상 청구 안내를 사기로 과도 판정하지 않는지 확인(오탐 회귀).",
    },
  },
  {
    id: "B02",
    category: "financial_notice",
    title: "카드 만료 안내",
    inputType: "text",
    input: "고객님의 국민카드 유효기간이 다음 달 말 만료됩니다. 갱신 카드는 등록하신 주소로 순차 발송될 예정입니다.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe", "caution"],
      aiCallExpected: true,
      notes: "정상 안내지만 '카드'·'등록' 등 금융 어휘가 많아 과대평가되지 않는지 확인.",
    },
  },
  {
    id: "B03",
    category: "financial_notice",
    title: "은행 영업시간 변경 안내",
    inputType: "text",
    input: "안내드립니다. 다음 주 월요일은 전산 작업으로 인해 영업시간이 오전 10시부터 오후 3시까지로 단축 운영됩니다.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe"],
      aiCallExpected: true,
      notes: "완전히 안전한 공지. 오탐 0 기준선 사례.",
    },
  },
  {
    id: "B04",
    category: "financial_notice",
    title: "금융상품 약관 변경 고지",
    inputType: "text",
    input: "적립식 펀드 약관 일부가 개정되어 다음 달부터 적용됩니다. 변경된 약관 전문은 홈페이지 공지사항에서 확인하실 수 있습니다.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe"],
      aiCallExpected: true,
      notes: "긴 공식 고지문. 문장 길이가 긴 안전 사례.",
    },
  },
  {
    id: "B05",
    category: "financial_notice",
    title: "대출 상품 안내(링크 포함, 애매)",
    inputType: "text",
    input: "고객님을 위한 저금리 대환대출 상품이 출시되었습니다. 한도 조회는 아래에서 가능합니다. http://loan-check.example.net",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["caution", "danger"],
      expectedSignalCodes: ["link-shorturl"],
      aiCallExpected: true,
      notes: "대출 광고성 링크 — 정상 광고와 대출 사기의 경계. money 카테고리가 없어 RULE_ONLY까지는 안 감.",
    },
  },

  // ==== C. 택배·생활 안내 (3) ==============================================
  {
    id: "C01",
    category: "delivery",
    title: "정상 배송 완료 안내",
    inputType: "text",
    input: "[우체국택배] 고객님의 상품이 배송 완료되었습니다. 문 앞에 두었으니 확인 부탁드립니다. 이용해 주셔서 감사합니다.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe"],
      aiCallExpected: true,
      notes: "완전히 정상적인 배송 완료 문자.",
    },
  },
  {
    id: "C02",
    category: "delivery",
    title: "주소 확인 요구 의심 문자",
    inputType: "text",
    input: "고객님 상품이 주소 불일치로 반송 예정입니다. 정확한 주소를 다시 남겨주시면 재배송해 드리겠습니다. 아래 링크에서 확인하세요. http://me2.kr/addr-check",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["caution", "danger"],
      expectedSignalCodes: ["link-shorturl"],
      aiCallExpected: true,
      notes: "주소만 요구하는 형태라 개인정보·송금 카테고리가 없어 RULE_ONLY 미도달. 실제로는 스미싱일 가능성이 있는 경계 사례.",
    },
  },
  {
    id: "C03",
    category: "delivery",
    title: "배송비 결제 요구 피싱",
    inputType: "text",
    input: "고객님 상품이 관세 미납으로 보류 중입니다. 배송비 3,500원을 아래 계좌로 입금하시면 즉시 발송해 드립니다. 국민 계좌 신한카드",
    expected: {
      plannedMode: "RULE_ONLY",
      acceptableRiskLevels: ["danger", "critical"],
      expectedSignalCodes: ["money-transfer", "money-virtual", "urgency-pressure"],
      aiCallExpected: false,
      notes: "실제 실행 결과 발견: '입금하시면'(money-transfer)·'국민 계좌'(money-virtual)·'즉시'(urgency)가 모두 걸려 money_with_urgency 조합으로 RULE_ONLY/critical에 정확히 도달한다. 택배사 사칭 자체는 impersonation 규칙에 없지만 다른 신호로 충분히 커버됨.",
    },
  },

  // ==== D. 정부·지원금·정책 주장 (4) ========================================
  {
    id: "D01",
    category: "government",
    title: "정상 공공 안내(주민센터 휴무)",
    inputType: "text",
    input: "안내 말씀드립니다. 이번 주 금요일은 전산 시스템 점검으로 주민센터 민원 업무가 오후 1시부터 중단됩니다.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe"],
      aiCallExpected: true,
      notes: "실제처럼 보이는 정상 공공 안내. 검증 가능한 사실 주장 형태가 아니라 AI_SUMMARY로 남아야 한다.",
    },
  },
  {
    id: "D02",
    category: "government",
    title: "출처 없는 지원금 지급 주장",
    inputType: "text",
    input: "속보! 정부가 다음 달부터 만 19세 이상 전 국민에게 민생지원금 50만원을 조건 없이 지급하기로 확정 발표했습니다.",
    expected: {
      plannedMode: "GROUNDED_FACT_CHECK",
      acceptableRiskLevels: ["safe", "caution"],
      aiCallExpected: true,
      notes: "검증 가능한 공공 주장. Grounding으로 사실 여부 확인이 필요한 전형적 사례.",
    },
  },
  {
    id: "D03",
    category: "government",
    title: "특정 제도 폐지 주장",
    inputType: "text",
    input: "충격! 기초연금 제도가 내년부터 전면 폐지된다고 합니다. 수급자들은 서둘러 신청을 마감해야 한다고 합니다.",
    expected: {
      plannedMode: "GROUNDED_FACT_CHECK",
      acceptableRiskLevels: ["safe", "caution"],
      aiCallExpected: true,
      notes: "제도 폐지 주장 — 검증 가능한 정책 주장의 또 다른 유형.",
    },
  },
  {
    id: "D04",
    category: "government",
    title: "날짜·대상 조건 누락된 정책 안내",
    inputType: "text",
    input: "정부에서 국민 대상 지원금을 지급한다고 합니다. 자세한 대상과 일정은 아직 공개되지 않았습니다.",
    expected: {
      plannedMode: "GROUNDED_FACT_CHECK",
      acceptableRiskLevels: ["safe", "caution", "unknown"],
      aiCallExpected: true,
      notes: "조건이 누락돼 사실 확정이 어려운 경계 사례 — acceptableRiskLevels를 넓게 설정.",
    },
  },

  // ==== E. 건강정보 (4) =====================================================
  {
    id: "E01",
    category: "health",
    title: "특정 식품으로 질병 완치 주장(은폐 프레이밍)",
    inputType: "text",
    input: "이 버섯 추출물을 3일만 드시면 관절염이 완치된다는 이야기가 있습니다. 의사들이 쉬쉬하는 진실이라고 합니다.",
    expected: {
      plannedMode: "GROUNDED_FACT_CHECK",
      acceptableRiskLevels: ["safe", "caution"],
      aiCallExpected: true,
      notes: "건강 완치 주장 + 은폐 프레이밍(쉬쉬). 실제로는 허위 건강정보일 가능성이 높은 사례.",
    },
  },
  {
    id: "E02",
    category: "health",
    title: "약 복용 중단 권유",
    inputType: "text",
    input: "혈압약은 몸에 안 좋으니 끊으시고, 이 차만 꾸준히 드시면 완치됩니다. 병원보다 이게 더 효과적입니다.",
    expected: {
      plannedMode: "GROUNDED_FACT_CHECK",
      acceptableRiskLevels: ["safe", "caution"],
      aiCallExpected: true,
      notes: "약 복용 중단 권유는 실제 위해 가능성이 커 최우선 주의가 필요하지만, 현재 위험 점수 체계는 사기 신호가 아니면 낮게 나온다 — 한계로 기록.",
    },
  },
  {
    id: "E03",
    category: "health",
    title: "병원 진료 일정 안내",
    inputType: "text",
    input: "안녕하세요, 다음 주 화요일 오전 진료 예약이 오후 2시로 변경되었음을 안내드립니다. 문의사항은 병원으로 연락 주세요.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe"],
      aiCallExpected: true,
      notes: "정상 병원 예약 변경 안내. 개인정보 탈취로 오판되지 않는지 확인.",
    },
  },
  {
    id: "E04",
    category: "health",
    title: "출처·연구기관 표시된 일반 건강정보",
    inputType: "text",
    input: "국립암센터 발표에 따르면 규칙적인 운동과 균형 잡힌 식단이 암 예방에 도움이 된다고 합니다. 정기 검진도 함께 권장됩니다.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe"],
      aiCallExpected: true,
      notes: "출처가 명시된 일반적 건강 조언. 검증 가능한 단정적 주장(완치·폐지 등)이 없어 AI_SUMMARY가 맞다.",
    },
  },

  // ==== F. 뉴스·게시글 (3) ==================================================
  {
    id: "F01",
    category: "news",
    title: "숫자·날짜 포함 사실 주장 뉴스",
    inputType: "text",
    input: "정부 발표에 따르면 내년 최저임금이 시간당 11,000원으로 인상되며 1월 1일부터 시행됩니다.",
    expected: {
      plannedMode: "GROUNDED_FACT_CHECK",
      acceptableRiskLevels: ["safe"],
      aiCallExpected: true,
      notes: "날짜·수치가 명확한 정책 뉴스. 검증 가능한 사실 주장의 표준 사례.",
    },
  },
  {
    id: "F02",
    category: "news",
    title: "의견 중심 칼럼형 글",
    inputType: "text",
    input: "개인적으로 요즘 물가가 너무 올라서 힘든 것 같아요. 다들 비슷한 마음이지 않을까 생각합니다.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe"],
      aiCallExpected: true,
      notes: "의견 표현이라 사실 검증 대상이 아니다 — OPINION_OR_AD 필터가 정상 작동하는지 확인.",
    },
  },
  {
    id: "F03",
    category: "news",
    title: "자극적 제목 + 불충분한 근거",
    inputType: "text",
    input: "정부가 숨기는 진실이 있다는 소문이 인터넷에서 빠르게 퍼지고 있습니다. 자세한 내용은 아직 확인되지 않았습니다.",
    expected: {
      plannedMode: "GROUNDED_FACT_CHECK",
      acceptableRiskLevels: ["safe", "unknown"],
      aiCallExpected: true,
      notes: "은폐 프레이밍만 있고 구체적 주장은 없는 클릭베이트형 — 근거 부족 사례로 경계·불확실 항목에도 기재.",
    },
  },

  // ==== G. 안전한 일반 공지 (3) ==============================================
  {
    id: "G01",
    category: "safe_notice",
    title: "아파트 승강기 점검 안내",
    inputType: "text",
    input: "관리사무소입니다. 내일 오전 9시부터 11시까지 정기 승강기 점검이 있을 예정이니 계단 이용에 참고 부탁드립니다.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe"],
      aiCallExpected: true,
      notes: "완전히 안전한 생활 공지.",
    },
  },
  {
    id: "G02",
    category: "safe_notice",
    title: "동호회 행사 일정 변경 안내",
    inputType: "text",
    input: "이번 달 정기 모임이 우천 예보로 인해 다음 주 토요일로 연기되었습니다. 장소는 기존과 동일합니다.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe"],
      aiCallExpected: true,
      notes: "일정 변경 공지. 위험 신호와 무관한 일상 문자.",
    },
  },
  {
    id: "G03",
    category: "safe_notice",
    title: "아파트 관리비 고지 안내(결제 요구 없음)",
    inputType: "text",
    input: "이번 달 관리비 고지서가 발송되었습니다. 자세한 내역은 관리사무소 게시판에서 확인하실 수 있습니다.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe"],
      forbiddenSignalCodes: ["money-account-request", "money-transfer"],
      aiCallExpected: true,
      notes: "'관리비'라는 금전 관련 단어가 있지만 결제·계좌 요구가 없어 오탐이 없어야 한다.",
    },
  },

  // ==== 광고 (1) ============================================================
  {
    id: "ADV01",
    category: "advertisement",
    title: "가을맞이 할인 이벤트 광고",
    inputType: "text",
    input: "가을맞이 특가! 전 제품 50% 할인 이벤트에 지금 참여하고 다양한 혜택을 받아보세요.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe"],
      aiCallExpected: true,
      notes: "일반 광고 문구 — OPINION_OR_AD 필터로 GROUNDED_FACT_CHECK로 새지 않아야 한다.",
    },
  },

  // ==== 애매한 사회공학 사례 (1) =============================================
  {
    id: "AMB01",
    category: "ambiguous",
    title: "직장 동료를 사칭한 소액 대여 요청",
    inputType: "text",
    input: "저기, 지갑을 두고 나와서 그런데 점심값 5만원만 평소 계좌로 빌려줄 수 있어? 오후에 바로 갚을게.",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe", "caution"],
      aiCallExpected: true,
      notes: "가족·지인 사칭 규칙(번호 변경)에는 안 걸리지만 실제로는 사회공학일 수 있는 경계 사례.",
    },
  },

  // ==== H. 특수문자·유니코드·비정상 입력 (8) =================================
  {
    id: "H01",
    category: "invalid_input",
    title: "특수문자만 있는 입력",
    inputType: "text",
    input: "!!!@@@###$$$%%%^^^&&&***(((",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["safe"],
      aiCallExpected: true,
      notes: "의미 없는 특수문자 나열. 앱이 죽지 않고 안전하게 처리되는지 확인.",
    },
  },
  {
    id: "H02",
    category: "unicode",
    title: "전각(fullwidth) 문자로 표기된 계좌 요구",
    inputType: "text",
    input: "고객님 계좌번호：１２３４５６－７８ 로 지금 즉시 송금해 주세요",
    expected: {
      plannedMode: "RULE_ONLY",
      acceptableRiskLevels: ["danger", "critical"],
      expectedSignalCodes: ["money-transfer", "money-account-request", "urgency-pressure"],
      aiCallExpected: false,
      notes: "전각 문자는 숫자·구두점에만 적용했고 한글 키워드(지금 즉시·송금해)는 그대로라 라우팅 자체는 정상적으로 RULE_ONLY에 도달한다. 핵심 확인 대상은 라우팅이 아니라 마스킹: 전각 숫자(１２３４５６)는 \\d 정규식에 안 걸려 mask.counts에 반영되지 않는다 — 개인정보 마스킹 회피 가능성으로 별도 기록.",
    },
  },
  {
    id: "H03",
    category: "unicode",
    title: "Zero-Width 문자로 키워드 분리 시도",
    inputType: "text",
    input: "지금​즉시 아래 계좌​이체 부탁드립니다. 송금해 주시면 감사하겠습니다.",
    expected: {
      plannedMode: "RULE_ONLY",
      acceptableRiskLevels: ["danger", "critical"],
      expectedSignalCodes: ["money-transfer", "urgency-pressure"],
      aiCallExpected: false,
      notes: "제로폭 문자가 결합어 '계좌이체'는 끊었지만, 독립 키워드 '즉시'와 '송금해'는 그대로 남아 money_with_urgency 조합이 성립해 RULE_ONLY에 도달한다. 즉, ZWSP는 복합 키워드(계좌이체) 하나만 부분적으로 회피시킬 뿐 전체 탐지를 무력화하지는 못한다 — 부분 회피 가능성은 실제 위험이므로 별도 기록.",
    },
  },
  {
    id: "H04",
    category: "url",
    title: "키릴 동형문자 URL(구글 스푸핑)",
    inputType: "url",
    input: "https://gооgle.com/account-verify",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["unknown"],
      aiCallExpected: true,
      notes: "'о'가 키릴 문자로 치환된 동형문자 스푸핑 도메인. WHATWG URL의 IDNA 처리로 punycode 변환되어 domain.isPunycode 경고가 뜨는지가 핵심 확인 대상 — 키 유무와 무관하게 실제 페이지를 읽지 못해 오류(URL_UNREADABLE)로 끝날 수 있다.",
      expectedOutcome: "error",
      expectedErrorCode: "URL_UNREADABLE",
    },
  },
  {
    id: "H05",
    category: "unicode",
    title: "방향 제어 문자(RLO) 삽입",
    inputType: "text",
    input: "지금 즉시 아래 계좌로 송‮금해 주세요",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["caution"],
      expectedSignalCodes: ["urgency-pressure"],
      forbiddenSignalCodes: ["money-transfer"],
      aiCallExpected: true,
      notes: "RLO(U+202E)가 '송금해' 키워드 중간에 삽입되어 money-transfer 탐지가 깨진다 — H03과 다른 방식의 키워드 회피 사례.",
    },
  },
  {
    id: "H06",
    category: "invalid_input",
    title: "HTML 태그 포함 입력",
    inputType: "text",
    input: "<script>alert(1)</script> 지금 즉시 아래 계좌로 송금해 주세요",
    expected: {
      plannedMode: "RULE_ONLY",
      acceptableRiskLevels: ["danger", "critical"],
      expectedSignalCodes: ["money-transfer", "urgency-pressure"],
      aiCallExpected: false,
      notes: "HTML 태그가 섞여도 뒤의 사기 문구는 정상 탐지되어야 한다. 태그 자체는 렌더링 시 React가 이스케이프하므로 XSS 위험은 없음(별도 확인 대상 아님).",
    },
  },
  {
    id: "H07",
    category: "invalid_input",
    title: "공백만 있는 입력",
    inputType: "text",
    input: "   \n\t   ",
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["unknown"],
      aiCallExpected: false,
      notes: "trim 후 길이 0 — 입력 검증에서 400 INPUT_TOO_SHORT로 거부되어야 한다.",
      expectedOutcome: "error",
      expectedErrorCode: "INPUT_TOO_SHORT",
    },
  },
  {
    id: "H08",
    category: "invalid_input",
    title: "지나치게 긴 입력(6,000자 초과)",
    inputType: "text",
    input: "안심글 테스트용 반복 문장입니다. ".repeat(300),
    expected: {
      plannedMode: "AI_SUMMARY",
      acceptableRiskLevels: ["unknown"],
      aiCallExpected: false,
      notes: "6,000자 제한 초과 — 413 INPUT_TOO_LONG으로 거부되어야 한다.",
      expectedOutcome: "error",
      expectedErrorCode: "INPUT_TOO_LONG",
    },
  },
];
