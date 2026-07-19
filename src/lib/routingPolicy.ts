import type { RiskLevel } from "./types.ts";

export const ROUTING_REASONS = {
  impersonationWithMoney: "impersonation_with_money",
  impersonationWithPersonalInfo: "impersonation_with_personal_info",
  moneyWithUrgency: "money_with_urgency",
  linkWithUrgency: "link_with_urgency",
  credentialRequestWithLink: "credential_request_with_link",
  remoteControlRequest: "remote_control_request",
  appInstallWithSensitiveRequest: "app_install_with_sensitive_request",
  coercionWithPaymentOrPersonalInfo: "coercion_with_payment_or_personal_info",
  secrecyWithMoney: "secrecy_with_money",
  generalExplanationNeeded: "general_explanation_needed",
} as const;

export type RuleOnlyReason =
  | typeof ROUTING_REASONS.impersonationWithMoney
  | typeof ROUTING_REASONS.impersonationWithPersonalInfo
  | typeof ROUTING_REASONS.moneyWithUrgency
  | typeof ROUTING_REASONS.linkWithUrgency
  | typeof ROUTING_REASONS.credentialRequestWithLink
  | typeof ROUTING_REASONS.remoteControlRequest
  | typeof ROUTING_REASONS.appInstallWithSensitiveRequest
  | typeof ROUTING_REASONS.coercionWithPaymentOrPersonalInfo
  | typeof ROUTING_REASONS.secrecyWithMoney;

export const RULE_ONLY_FLOORS = {
  [ROUTING_REASONS.impersonationWithMoney]: "critical",
  [ROUTING_REASONS.impersonationWithPersonalInfo]: "critical",
  [ROUTING_REASONS.moneyWithUrgency]: "danger",
  [ROUTING_REASONS.linkWithUrgency]: "danger",
  [ROUTING_REASONS.credentialRequestWithLink]: "critical",
  [ROUTING_REASONS.remoteControlRequest]: "critical",
  [ROUTING_REASONS.appInstallWithSensitiveRequest]: "critical",
  [ROUTING_REASONS.coercionWithPaymentOrPersonalInfo]: "critical",
  [ROUTING_REASONS.secrecyWithMoney]: "critical",
} as const satisfies Readonly<Record<RuleOnlyReason, RiskLevel>>;

export function isRuleOnlyReason(reason: string): reason is RuleOnlyReason {
  return (
    reason === ROUTING_REASONS.impersonationWithMoney ||
    reason === ROUTING_REASONS.impersonationWithPersonalInfo ||
    reason === ROUTING_REASONS.moneyWithUrgency ||
    reason === ROUTING_REASONS.linkWithUrgency ||
    reason === ROUTING_REASONS.credentialRequestWithLink ||
    reason === ROUTING_REASONS.remoteControlRequest ||
    reason === ROUTING_REASONS.appInstallWithSensitiveRequest ||
    reason === ROUTING_REASONS.coercionWithPaymentOrPersonalInfo ||
    reason === ROUTING_REASONS.secrecyWithMoney
  );
}
