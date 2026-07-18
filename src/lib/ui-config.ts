// ui-config.ts
// 위험 단계·신호 종류·개인정보 종류에 대한 화면 표시용 라벨과 색상 스타일을 정의한다.
// (이모지 아이콘은 사용하지 않고 텍스트 라벨 + 색상으로만 구분한다)
import type { RiskLevel, Severity, SensitiveKind } from "./types";

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
