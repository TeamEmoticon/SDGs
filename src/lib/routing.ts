// routing.ts
// 적응형 분석 라우터(순수 함수). 규칙 신호 조합과 텍스트 단서로 분석 모드를 결정한다.

import type { AnalysisMode, Signal } from "./types";
import { ROUTING_REASONS, type RuleOnlyReason } from "./routingPolicy.ts";

export interface RoutingDecision {
  readonly mode: AnalysisMode;
  readonly reasons: readonly string[];
}

const CREDENTIAL_REQUEST = /인증\s?번호|비밀\s?번호|보안\s?카드|otp|공동\s?인증서|금융\s?인증서/i;
const FAMILY_IMPERSONATION = /(?:엄마|아빠|할머니|할아버지|누나|언니|형|오빠)\s*(?:나야|저예요)|(?:휴대폰|핸드폰|폰).{0,12}(?:고장|분실|바뀌)/i;
const FINANCIAL_IMPERSONATION = /(?:은행|카드사|금융기관|금감원|금융감독원).{0,24}(?:입니다|안내|보안|직원|상담)/i;
const SECRECY_REQUEST = /(?:다른\s*사람|가족|주변).{0,24}(?:말하지|알리지|비밀로)|(?:비밀로|혼자만).{0,24}(?:진행|처리|송금)/i;

function hasCategory(signals: readonly Signal[], category: string): boolean {
  return signals.some((signal) => signal.category === category);
}

function hasId(signals: readonly Signal[], id: string): boolean {
  return signals.some((signal) => signal.id === id);
}

/** 명백한 사기 조합인지 — 규칙 두 개 이상의 조합(또는 단독으로도 확정적인 요구)으로 판정. */
export function hasCriticalScamCombination(signals: readonly Signal[], text: string): RuleOnlyReason[] {
  const reasons: RuleOnlyReason[] = [];
  const familyImpersonation = hasCategory(signals, "acquaintance") || FAMILY_IMPERSONATION.test(text);
  const authorityImpersonation = hasCategory(signals, "impersonation") || FINANCIAL_IMPERSONATION.test(text);
  const money = hasCategory(signals, "money");
  const urgency = hasCategory(signals, "urgency");
  const link = hasCategory(signals, "link");
  const coercion = hasCategory(signals, "coercion");
  const personalInfo = hasCategory(signals, "personalinfo");
  const appInstall = hasId(signals, "link-install");
  const credentialRequest = hasId(signals, "pinfo-secrets") || CREDENTIAL_REQUEST.test(text);
  const remoteControl = hasCategory(signals, "remote");

  if ((familyImpersonation || authorityImpersonation) && money) reasons.push(ROUTING_REASONS.impersonationWithMoney);
  if (authorityImpersonation && personalInfo) reasons.push(ROUTING_REASONS.impersonationWithPersonalInfo);
  if (money && urgency) reasons.push(ROUTING_REASONS.moneyWithUrgency);
  if (link && urgency) reasons.push(ROUTING_REASONS.linkWithUrgency);
  if (credentialRequest && link) reasons.push(ROUTING_REASONS.credentialRequestWithLink);
  if (remoteControl) reasons.push(ROUTING_REASONS.remoteControlRequest);
  if (appInstall && (money || personalInfo)) reasons.push(ROUTING_REASONS.appInstallWithSensitiveRequest);
  if (coercion && (money || personalInfo)) reasons.push(ROUTING_REASONS.coercionWithPaymentOrPersonalInfo);
  if (SECRECY_REQUEST.test(text) && money) reasons.push(ROUTING_REASONS.secrecyWithMoney);

  return reasons;
}

export function chooseAnalysisMode(signals: readonly Signal[], text: string): RoutingDecision {
  const scamReasons = hasCriticalScamCombination(signals, text);
  if (scamReasons.length > 0) {
    return { mode: "RULE_ONLY", reasons: scamReasons };
  }

  return { mode: "AI_SUMMARY", reasons: [ROUTING_REASONS.generalExplanationNeeded] };
}
