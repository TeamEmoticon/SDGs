// ui-config.ts
// 위험 단계·신호 종류·개인정보 종류에 대한 화면 표시용 라벨과 색상 스타일을 정의한다.
// (이모지 아이콘은 사용하지 않고 텍스트 라벨 + 색상으로만 구분한다)
import type { MessageType, RequestedAction, RiskLevel, Severity, SensitiveKind } from "./types";

/** Display metadata shared across client components (no server-only code). */

export const SENSITIVE_LABEL: Record<SensitiveKind, string> = {
  phone: "전화번호",
  account: "계좌번호",
  code: "인증번호",
  rrn: "주민등록번호",
  card: "카드번호",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "매우 위험",
  high: "위험",
  medium: "주의",
  low: "낮음",
};

export const SEVERITY_STYLE: Record<Severity, string> = {
  critical: "risk-critical",
  high: "risk-danger",
  medium: "risk-caution",
  low: "risk-safe",
};

export const CATEGORY_META: Record<string, { label: string }> = {
  impersonation: { label: "기관 사칭" },
  coercion: { label: "협박·압박" },
  money: { label: "돈·계좌 요구" },
  personalinfo: { label: "개인정보 요구" },
  reward: { label: "당첨·보상 미끼" },
  acquaintance: { label: "지인 사칭" },
  link: { label: "낯선 링크·앱" },
  urgency: { label: "조급함 유도" },
};

export interface RiskUi {
  label: string;
  tone: string;
}

export const RISK_UI: Record<RiskLevel, RiskUi> = {
  safe: {
    label: "안전",
    tone: "risk-safe",
  },
  caution: {
    label: "주의",
    tone: "risk-caution",
  },
  danger: {
    label: "위험",
    tone: "risk-danger",
  },
  critical: {
    label: "고위험",
    tone: "risk-critical",
  },
};

/**
 * 위험 단계별로 화면에 보여주는 설명 문구.
 * 결과 화면(ResultView)과 음성 읽기(buildSpeechText)가 같은 문구를 쓰도록 여기서 공유한다.
 */
export const LEVEL_STORY: Record<RiskLevel, string> = {
  safe: "뚜렷한 보이스피싱 신호가 적습니다.",
  caution: "한 번 더 확인해 주세요.",
  danger: "보이스피싱이 의심됩니다.",
  critical: "보이스피싱 위험이 매우 높습니다. 지금 행동을 멈추세요.",
};

export const MESSAGE_TYPE_LABEL: Record<MessageType, string> = {
  family_impersonation: "가족·지인 사칭",
  government_impersonation: "공공기관 사칭",
  financial_impersonation: "금융기관 사칭",
  delivery_impersonation: "택배·배송 사칭",
  investment_scam: "투자·수익 보장 사기",
  remote_control_scam: "원격제어·화면 공유 사기",
  credential_theft: "인증정보 탈취 시도",
  unknown: "확인이 더 필요한 문자",
};

export const REQUESTED_ACTION_LABEL: Record<RequestedAction, string> = {
  send_money: "돈 보내기",
  open_link: "링크 열기",
  enter_credentials: "인증번호·비밀번호 입력",
  install_app: "앱 설치",
  share_screen: "화면 공유·원격제어 허용",
  call_number: "문자 속 번호로 전화",
  keep_secret: "다른 사람에게 알리지 않기",
  none: "특별한 행동 요구 없음",
};

const IMMEDIATE_ACTIONS: Record<MessageType, readonly string[]> = {
  family_impersonation: [
    "돈을 보내지 마세요.",
    "문자에 답하지 말고 평소 알고 있던 번호로 직접 전화하세요.",
    "다른 가족에게도 확인하세요.",
  ],
  government_impersonation: [
    "문자 속 번호나 링크를 이용하지 마세요.",
    "공식 홈페이지나 카드·통장에서 대표번호를 직접 찾으세요.",
    "인증번호와 비밀번호를 알려주지 마세요.",
  ],
  financial_impersonation: [
    "문자 속 번호나 링크를 이용하지 마세요.",
    "카드·통장 또는 공식 홈페이지에서 대표번호를 직접 찾으세요.",
    "인증번호와 비밀번호를 알려주지 마세요.",
  ],
  delivery_impersonation: [
    "문자 속 링크를 누르지 마세요.",
    "택배사 공식 앱이나 홈페이지에서 배송 상태를 직접 확인하세요.",
    "인증번호와 결제 정보를 입력하지 마세요.",
  ],
  investment_scam: [
    "추가 송금을 멈추세요.",
    "수익 보장이나 원금 보장 말을 믿고 바로 입금하지 마세요.",
    "대화와 송금 기록을 지우지 마세요.",
  ],
  remote_control_scam: [
    "앱을 설치하지 마세요.",
    "화면 공유와 원격제어 요청을 거절하세요.",
    "이미 설치했다면 인터넷 연결을 끊고 도움을 요청하세요.",
  ],
  credential_theft: [
    "인증번호와 비밀번호를 입력하지 마세요.",
    "문자 속 링크와 전화번호를 이용하지 마세요.",
    "공식 앱이나 대표번호로 직접 확인하세요.",
  ],
  unknown: [
    "돈·개인정보·앱 설치를 요구하면 바로 멈추세요.",
    "문자 속 링크나 전화번호 대신 공식 경로로 확인하세요.",
  ],
};

export function getImmediateActions(messageType: MessageType | undefined, riskLevel: RiskLevel): readonly string[] {
  if (messageType !== undefined && messageType !== "unknown") return IMMEDIATE_ACTIONS[messageType];
  return riskLevel === "safe" || riskLevel === "caution"
    ? ["의심되는 부분이 있으면 공식 경로로 한 번 더 확인하세요."]
    : IMMEDIATE_ACTIONS.unknown;
}

export function getAfterActionGuide(messageType: MessageType | undefined, riskLevel: RiskLevel): string {
  if (messageType === "remote_control_scam") {
    return "이미 앱을 설치하거나 화면을 공유했다면 인터넷 연결을 끊고, 112 또는 금융기관 고객센터에 바로 도움을 요청하세요.";
  }
  if (riskLevel === "danger" || riskLevel === "critical") {
    return "이미 돈을 보냈거나 개인정보를 입력했다면 대화와 송금 기록을 보관하고, 112와 금융기관 고객센터에 바로 신고·상담하세요.";
  }
  return "이미 링크를 열었더라도 개인정보를 입력하지 않았다면 창을 닫고, 휴대전화 보안 검사를 해 보세요.";
}
