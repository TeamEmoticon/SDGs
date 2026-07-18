import type { RuleDef } from "./types.ts";

export const SEVERITY_WEIGHT = {
  critical: 26,
  high: 15,
  medium: 8,
  low: 3,
} as const;

export const RULES: readonly RuleDef[] = [
  { id: "impersonate-prosecutor", category: "impersonation", severity: "critical", label: "검찰·수사기관 사칭", detail: "검사·검찰을 내세워 겁을 주는 전형적인 보이스피싱 수법입니다. 진짜 검찰은 전화로 돈이나 정보를 요구하지 않습니다.", keywords: ["검찰", "검사님", "검사가", "검찰청", "지검", "지방검찰", "대검"] },
  { id: "impersonate-agency", category: "impersonation", severity: "high", label: "공공기관·금융기관 사칭", detail: "국세청·금융감독원·경찰 등을 사칭해 신뢰를 얻으려 합니다. 의심되면 공식 홈페이지나 1332로 직접 확인하세요.", keywords: ["국세청", "세무서", "금융감독원", "금감원", "경찰서", "경찰청", "대법원", "법원행정", "행정안전부", "건강보험"] },
  { id: "coercion-warrant", category: "coercion", severity: "critical", label: "영장·체포로 협박", detail: "체포영장·구속영장·출석요구서를 들먹이며 겁을 줍니다. 수사기관의 안내는 문자 링크가 아닌 공식 절차로만 이루어집니다.", keywords: ["영장", "체포영장", "구속영장", "출석요구서", "출석 요구", "구속", "체포", "전과", "형사고소", "고발"], regex: [/제출하지\s?않으면.{0,16}처벌|처벌.{0,16}(?:주민|개인정보|인증)/] },
  { id: "coercion-crime", category: "coercion", severity: "high", label: "범죄 연루·명의도용 압박", detail: "범죄에 연루됐다며 당황하게 만듭니다. 이런 말이 나오면 일단 멈추고 112에 확인하세요.", keywords: ["명의도용", "명의 도용", "범죄에 연루", "범죄연루", "보험사기", "대포통장", "대포 통장", "보석금", "증거금", "벌금"] },
  { id: "money-transfer", category: "money", severity: "critical", label: "송금·계좌이체 요구", detail: "돈을 보내라고 하는 문자는 가장 위험합니다. 어떤 이유든 먼저 송금을 요구하면 사기로 의심하세요.", keywords: ["송금", "계좌이체", "이체해", "이체하", "입금해", "입금하", "돈을 보내", "송금해", "보내주세요", "입금 부탁", "보내줘", "보내줄", "보내줄 수", "보내달라", "부쳐줘", "부쳐줄", "송금 좀", "이체 좀", "입금 좀"] },
  { id: "money-virtual", category: "money", severity: "critical", label: "가상계좌 안내", detail: "입금용 가상계좌를 알려주는 것은 사기의 핵심 신호입니다. 계좌로 돈을 보내기 전에 반드시 1332로 확인하세요.", keywords: ["가상계좌", "가상 계좌", "입금 계좌", "계좌번호:", "계좌번호 :", "은행 계좌", "농협 계좌", "국민 계좌"] },
  { id: "money-account-request", category: "money", severity: "medium", label: "계좌번호 요청", detail: "뚜렷한 설명 없이 계좌번호를 요청하는 것은 주의가 필요합니다. 용도를 정확히 확인하세요.", keywords: ["계좌번호", "계좌 번호", "이 계좌로", "계좌 좀"] },
  { id: "pinfo-secrets", category: "personalinfo", severity: "critical", label: "비밀번호·인증정보 요구", detail: "비밀번호·인증번호·OTP·보안카드·공동인증서는 누구도 물어보지 않습니다. 묻는 순간 사기입니다.", keywords: ["비밀번호", "보안카드", "OTP", "ARS 비밀번호", "공동인증서", "금융인증서", "간편인증", "인증서", "비밀번호 입력", "인증번호", "인증 번호"] },
  { id: "pinfo-rrn", category: "personalinfo", severity: "high", label: "신분증·주민번호 요구", detail: "주민등록번호·신분증 사진을 요구하는 문자를 조심하세요. 정상적인 안내라면 이런 정보를 문자로 요구하지 않습니다.", keywords: ["주민등록번호", "주민번호", "주민 번호", "신분증", "신분 확인", "신분증 사진", "운전면허", "여권"] },
  { id: "reward-prize", category: "reward", severity: "high", label: "당첨·경품 미끼", detail: "당첨됐다며 클릭이나 정보를 유도하는 것은 흔한 사기 미끼입니다. 응모한 적 없는 당첨은 100% 의심하세요.", keywords: ["당첨", "경품", "무료수신", "우승", "100% 당첨", "경품 당첨", "축하드립니다. 당첨", "해피콜"] },
  { id: "reward-refund", category: "reward", severity: "medium", label: "환급·혜택 미끼", detail: "환급금·적립금·혜택이 있다며 링크를 누르게 합니다. 금융기관 환급은 문자 링크가 아닌 공식 앱/창구에서만 진행됩니다.", keywords: ["환급", "환급금", "수령하세요", "수령하", "적립금", "혜택 수령", "환급 혜택", "무료 수신", "무료거부"] },
  { id: "acquaintance-number", category: "acquaintance", severity: "high", label: "지인 사칭 (번호 바뀜)", detail: "가족·지인이 번호를 바꿨다며 접근한 뒤 돈을 요구하는 수법입니다. 번호가 바뀌었다면 전화로 직접 목소리를 확인하세요.", keywords: ["번호가 바뀌", "번호 바뀌", "번호를 변경", "번호가 변경", "폰을 바꿔", "폰 바뀌", "핸드폰 바뀌", "새 번호", "연락처가 변경", "번호가 변경되"] },
  { id: "link-shorturl", category: "link", severity: "high", label: "단축 주소·낯선 링크", detail: "누르면 내 정보를 빼가거나 앱을 설치하게 만드는 링크입니다. 모르는 주소는 절대 누르지 마세요.", regex: [/(?<!\w)(https?:\/\/\S+|bit\.ly\/\S+|me2\.kr\/\S+|tinyurl\.com\/\S+|ko\.gl\/\S+|t\.me\/\S+)/i] },
  { id: "link-install", category: "link", severity: "high", label: "앱 설치·다운로드 유도", detail: "문자로 앱을 설치하라고 하면 사기 앱일 수 있습니다. 앱은 공식 스토어에서만 설치하세요.", keywords: ["앱 설치", "어플 설치", "다운로드", "설치해", "설치하세요", "설치하고", "설치할", "구글플레이", "플레이스토어", "APK", "보안 앱 설치", "원격지원"], regex: [/설치하(?:시|셔|여|고|세|십|기)/i] },
  { id: "remote-control", category: "remote", severity: "critical", label: "원격제어·화면공유 요구", detail: "원격제어·화면공유 앱을 설치시킨 뒤 내 컴퓨터·계좌를 직접 조종하는 수법입니다. 절대 응하지 말고 전화를 끊으세요.", keywords: ["원격제어", "원격 제어", "원격지원", "원격 지원", "화면공유", "화면 공유", "원격조종", "원격 조종", "팀뷰어", "teamviewer", "애니데스크", "anydesk", "퀵서포트", "quicksupport"] },
  { id: "urgency-pressure", category: "urgency", severity: "medium", label: "조급함 유발", detail: "지금·즉시·오늘 안에 하라며 생각할 틈을 주지 않습니다. 시간에 쫓기게 만드는 글은 한 번 의심하세요.", keywords: ["지금 즉시", "지금 바로", "즉시", "오늘 안", "내일까지", "시간 안에", "급합니다", "지연 시", "24시간"], regex: [/(?:오늘|지금|즉시|긴급).{0,12}마감|마감.{0,12}(?:오늘|지금|즉시|긴급)/] },
];
