// Shared types used across the analysis pipeline, API routes, and UI.

export type InputType = "text" | "url";

/** Final four-step risk verdict computed by the code. */
export type RiskLevel = "safe" | "caution" | "danger" | "critical";

export type Severity = "critical" | "high" | "medium" | "low";

export type SensitiveKind =
  | "phone"
  | "account"
  | "code"
  | "rrn"
  | "card";

/** A single piece of sensitive information that was detected and masked. */
export interface MaskedSpan {
  kind: SensitiveKind;
  original: string;
  masked: string;
}

export interface MaskResult {
  /** Full text with sensitive parts replaced by ● markers. */
  text: string;
  maskedCount: number;
  counts: Record<SensitiveKind, number>;
  spans: MaskedSpan[];
}

/** Definition of a single fraud-detection rule. */
export interface RuleDef {
  id: string;
  category: string;
  severity: Severity;
  label: string;
  detail: string;
  keywords?: string[];
  regex?: RegExp[];
  weight?: number;
}

/** A rule-based risk signal matched in the text. */
export interface Signal {
  id: string;
  category: string;
  severity: Severity;
  label: string;
  detail: string;
  /** Short surrounding snippet of the matched text. */
  matched: string;
  weight: number;
}

export interface GroqResult {
  /** Easy-language summary. Empty when Groq is unavailable. */
  summary: string;
  /** Classified type of the message. */
  infoType: string;
  /** Suspicious candidate phrases pulled out by the model. */
  riskPhrases: string[];
  /** Whether the model actually produced a result. */
  used: boolean;
}

export interface RiskVerdict {
  level: RiskLevel;
  score: number;
  recommendation: string;
}

export interface AnalysisResult {
  id: number | null;
  inputType: InputType;
  sourceUrl: string | null;
  maskedText: string;
  mask: MaskResult;
  signals: Signal[];
  groq: GroqResult;
  riskLevel: RiskLevel;
  riskScore: number;
  recommendation: string;
  createdAt: string;
}
