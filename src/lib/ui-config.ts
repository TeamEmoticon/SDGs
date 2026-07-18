import type { RiskLevel, Severity, SensitiveKind } from "./types";

/** Display metadata shared across client components (no server-only code). */

export const SENSITIVE_LABEL: Record<SensitiveKind, string> = {
  phone: "전화번호",
  account: "계좌번호",
  code: "인증번호",
  rrn: "주민등록번호",
  card: "카드번호",
};

export const SENSITIVE_EMOJI: Record<SensitiveKind, string> = {
  phone: "📞",
  account: "🏦",
  code: "🔑",
  rrn: "🪪",
  card: "💳",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "매우 위험",
  high: "위험",
  medium: "주의",
  low: "낮음",
};

export const SEVERITY_STYLE: Record<Severity, string> = {
  critical: "bg-red-100 text-red-700 ring-red-200",
  high: "bg-orange-100 text-orange-700 ring-orange-200",
  medium: "bg-amber-100 text-amber-700 ring-amber-200",
  low: "bg-sky-100 text-sky-700 ring-sky-200",
};

export const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  impersonation: { label: "기관 사칭", emoji: "🏛️" },
  coercion: { label: "협박·압박", emoji: "⚖️" },
  money: { label: "돈·계좌 요구", emoji: "💰" },
  personalinfo: { label: "개인정보 요구", emoji: "🔐" },
  reward: { label: "당첨·보상 미끼", emoji: "🎁" },
  acquaintance: { label: "지인 사칭", emoji: "👤" },
  link: { label: "낯선 링크·앱", emoji: "🔗" },
  urgency: { label: "조급함 유도", emoji: "⏱️" },
};

export interface RiskUi {
  label: string;
  emoji: string;
  banner: string;
  bannerText: string;
  chip: string;
  bar: string;
  ring: string;
  scoreText: string;
}

export const RISK_UI: Record<RiskLevel, RiskUi> = {
  safe: {
    label: "안전",
    emoji: "🟢",
    banner: "bg-emerald-50 border-emerald-200",
    bannerText: "text-emerald-800",
    chip: "bg-emerald-100 text-emerald-700",
    bar: "bg-emerald-500",
    ring: "ring-emerald-200",
    scoreText: "text-emerald-600",
  },
  caution: {
    label: "주의",
    emoji: "🟡",
    banner: "bg-amber-50 border-amber-200",
    bannerText: "text-amber-800",
    chip: "bg-amber-100 text-amber-700",
    bar: "bg-amber-500",
    ring: "ring-amber-200",
    scoreText: "text-amber-600",
  },
  danger: {
    label: "위험",
    emoji: "🟠",
    banner: "bg-orange-50 border-orange-200",
    bannerText: "text-orange-800",
    chip: "bg-orange-100 text-orange-700",
    bar: "bg-orange-500",
    ring: "ring-orange-200",
    scoreText: "text-orange-600",
  },
  critical: {
    label: "고위험",
    emoji: "🔴",
    banner: "bg-red-50 border-red-200",
    bannerText: "text-red-800",
    chip: "bg-red-100 text-red-700",
    bar: "bg-red-500",
    ring: "ring-red-200",
    scoreText: "text-red-600",
  },
};
