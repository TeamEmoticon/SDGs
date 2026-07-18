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
  readonly kind: SensitiveKind;
  readonly original: string;
  readonly masked: string;
}

export interface MaskResult {
  /** Full text with sensitive parts replaced by ● markers. */
  readonly text: string;
  readonly maskedCount: number;
  readonly counts: Readonly<Record<SensitiveKind, number>>;
  readonly spans: readonly MaskedSpan[];
}

export interface MaskSummary {
  readonly maskedCount: number;
  readonly counts: Readonly<Record<SensitiveKind, number>>;
}

/** Definition of a single fraud-detection rule. */
export interface RuleDef {
  readonly id: string;
  readonly category: string;
  readonly severity: Severity;
  readonly label: string;
  readonly detail: string;
  readonly keywords?: readonly string[];
  readonly regex?: readonly RegExp[];
  readonly weight?: number;
}

/** A rule-based risk signal matched in the text. */
export interface Signal {
  readonly id: string;
  readonly category: string;
  readonly severity: Severity;
  readonly label: string;
  readonly detail: string;
  /** Short surrounding snippet of the matched text. */
  readonly matched: string;
  readonly weight: number;
}

export interface DifficultTerm {
  readonly term: string;
  readonly easyMeaning: string;
}

export interface AiAnalysis {
  readonly summary: string;
  readonly infoType: string;
  readonly actions: readonly string[];
  readonly riskPhrases: readonly string[];
  readonly difficultTerms: readonly DifficultTerm[];
  readonly missingInfo: readonly string[];
  readonly used: boolean;
}

export interface RiskVerdict {
  readonly level: RiskLevel;
  readonly score: number;
  readonly recommendation: string;
}

export interface AnalysisResult {
  readonly inputType: InputType;
  readonly sourceUrl: string | null;
  readonly maskedText: string;
  readonly mask: MaskSummary;
  readonly signals: readonly Signal[];
  readonly ai: AiAnalysis;
  readonly riskLevel: RiskLevel;
  readonly riskScore: number;
  readonly recommendation: string;
  readonly createdAt: string;
}
