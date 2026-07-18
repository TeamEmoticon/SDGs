import type { RiskLevel } from "./types.ts";

export const ROUTING_REASONS = {
  impersonationWithMoney: "impersonation_with_money",
  moneyWithUrgency: "money_with_urgency",
  credentialRequestWithLink: "credential_request_with_link",
  remoteControlRequest: "remote_control_request",
  appInstallWithSensitiveRequest: "app_install_with_sensitive_request",
  coercionWithPaymentOrPersonalInfo: "coercion_with_payment_or_personal_info",
  checkablePublicClaim: "checkable_public_claim",
  generalExplanationNeeded: "general_explanation_needed",
} as const;

export type RuleOnlyReason =
  | typeof ROUTING_REASONS.impersonationWithMoney
  | typeof ROUTING_REASONS.moneyWithUrgency
  | typeof ROUTING_REASONS.credentialRequestWithLink
  | typeof ROUTING_REASONS.remoteControlRequest
  | typeof ROUTING_REASONS.appInstallWithSensitiveRequest
  | typeof ROUTING_REASONS.coercionWithPaymentOrPersonalInfo;

export const RULE_ONLY_FLOORS = {
  [ROUTING_REASONS.impersonationWithMoney]: "critical",
  [ROUTING_REASONS.moneyWithUrgency]: "danger",
  [ROUTING_REASONS.credentialRequestWithLink]: "danger",
  [ROUTING_REASONS.remoteControlRequest]: "critical",
  [ROUTING_REASONS.appInstallWithSensitiveRequest]: "danger",
  [ROUTING_REASONS.coercionWithPaymentOrPersonalInfo]: "critical",
} as const satisfies Readonly<Record<RuleOnlyReason, RiskLevel>>;

export function isRuleOnlyReason(reason: string): reason is RuleOnlyReason {
  return (
    reason === ROUTING_REASONS.impersonationWithMoney ||
    reason === ROUTING_REASONS.moneyWithUrgency ||
    reason === ROUTING_REASONS.credentialRequestWithLink ||
    reason === ROUTING_REASONS.remoteControlRequest ||
    reason === ROUTING_REASONS.appInstallWithSensitiveRequest ||
    reason === ROUTING_REASONS.coercionWithPaymentOrPersonalInfo
  );
}
