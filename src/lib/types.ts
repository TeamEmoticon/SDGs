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

export interface GroundingSource {
  readonly title: string;
  readonly url: string;
}

export interface GroundingEvidence {
  readonly sources: readonly GroundingSource[];
  readonly searchSuggestionHtml?: string;
  readonly hasLinkedSupport?: boolean;
}

export const FACT_CHECK_VERDICTS = ["supported", "contradicted", "mixed", "insufficient_evidence"] as const;

export type FactCheckVerdict = (typeof FACT_CHECK_VERDICTS)[number];

export interface FactCheckResult {
  readonly claimQuote: string;
  readonly verdict: FactCheckVerdict;
  readonly explanation: string;
  readonly evidenceStrength: "linked" | "limited";
}

export const MESSAGE_TYPES = [
  "family_impersonation",
  "government_impersonation",
  "financial_impersonation",
  "delivery_impersonation",
  "investment_scam",
  "remote_control_scam",
  "credential_theft",
  "unknown",
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export const REQUESTED_ACTIONS = [
  "send_money",
  "open_link",
  "enter_credentials",
  "install_app",
  "share_screen",
  "call_number",
  "keep_secret",
  "none",
] as const;

export type RequestedAction = (typeof REQUESTED_ACTIONS)[number];

export interface AiAnalysis {
  readonly summary: string;
  readonly infoType: string;
  readonly actions: readonly string[];
  readonly riskPhrases: readonly string[];
  readonly difficultTerms: readonly DifficultTerm[];
  readonly missingInfo: readonly string[];
  readonly used: boolean;
  readonly messageType?: MessageType;
  readonly requestedActions?: readonly RequestedAction[];
  readonly grounding?: GroundingEvidence;
  readonly factCheck?: FactCheckResult;
}

export interface RiskVerdict {
  readonly level: RiskLevel;
  readonly score: number;
  readonly recommendation: string;
}

/**
 * Which analysis path a message is planned for / actually ran through.
 * RULE_ONLY: obvious scam handled by rules, no AI call.
 * AI_SUMMARY: easy-language AI explanation.
 * GROUNDED_FACT_CHECK: a checkable public claim (grounded fact-check path).
 */
export type AnalysisMode = "RULE_ONLY" | "AI_SUMMARY" | "GROUNDED_FACT_CHECK";

/** Outcome of the (optional) AI provider call for one analysis. */
export type AiStatus =
  | "skipped"
  | "not_configured"
  | "used"
  | "configuration_error"
  | "timeout"
  | "rate_limited"
  | "blocked"
  | "invalid_response"
  | "upstream_error";

/** Every AI failure that must still return a rule-based result (HTTP 200). */
export type AiFailureStatus = Exclude<AiStatus, "skipped" | "not_configured" | "used">;

/** Planned vs. executed analysis path — useful for tests and debugging. */
export interface AnalysisExecution {
  readonly plannedMode: AnalysisMode;
  readonly executedMode: AnalysisMode;
  readonly aiStatus: AiStatus;
  readonly fallbackUsed: boolean;
  readonly routingReasons: readonly string[];
}

/** Non-fatal notice attached to a successful (HTTP 200) analysis. */
export interface ApiWarning {
  readonly code: string;
  readonly message: string;
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
  /** Optional: how this analysis was routed and executed (backward compatible). */
  readonly execution?: AnalysisExecution;
  /** Optional: non-fatal warnings (e.g. AI not configured). */
  readonly warnings?: readonly ApiWarning[];
}
