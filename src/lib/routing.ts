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

// 검증 가능한 공공 주장 판정용
const PUBLIC_TOPIC =
  /건강|질병|백신|접종|암|고혈압|당뇨|혈압|혈당|치매|면역|부작용|의사|병원|제약|정부|정책|지원금|보조금|재난지원|급여|연금|복지|국민|뉴스|보도|기사|연구|논문|통계|법률|법안|시행령/;
const CHECKABLE_CLAIM =
  /지급(한다|합니다|됩니다|예정)?|폐지(된다|됐다|됩니다)?|시행(한다|된다|됩니다)?|완치(된다|됩니다)?|확정(됐다|됩니다)?|확정\s?발표|지급\s?발표|폐지\s?발표|인상|인하|확대(된다|됩니다)?|의무화|무료로\s?제공/;
// 진위를 검증 없이 단정하며 은폐를 주장하는 표현(주제어와 함께면 사실 확인이 필요하다는 강한 신호).
const CONSPIRACY_CLAIM = /쉬쉬|숨기는|알려지지\s?않은|보도하지\s?않는|아무도\s?모르는|비밀입니다/;
const OPINION_OR_AD =
  /제\s?생각|개인적으로|인\s?것\s?같|같아요|같습니다|광고|홍보|할인|세일|특가|구매하세요|이벤트\s?참여/;
const SOURCE_ATTRIBUTION = /(?:에\s?따르면|자료에\s?따르면|발표에\s?따르면)/;
const HEALTH_HARM_CLAIM = /완치|복용.{0,12}중단|약.{0,12}끊|의사.{0,12}필요\s?없/;

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

/** @deprecated 보이스피싱 전용 MVP에서는 실행되지 않는다. 기존 타입 호환을 위해 임시 유지한다. */
export function hasCheckablePublicClaim(text: string): boolean {
  if (!PUBLIC_TOPIC.test(text)) return false;
  if (SOURCE_ATTRIBUTION.test(text) && !HEALTH_HARM_CLAIM.test(text)) return false;
  if (OPINION_OR_AD.test(text) && !HEALTH_HARM_CLAIM.test(text)) return false;
  return CHECKABLE_CLAIM.test(text) || CONSPIRACY_CLAIM.test(text);
}

export function chooseAnalysisMode(signals: readonly Signal[], text: string): RoutingDecision {
  const scamReasons = hasCriticalScamCombination(signals, text);
  if (scamReasons.length > 0) {
    return { mode: "RULE_ONLY", reasons: scamReasons };
  }

  return { mode: "AI_SUMMARY", reasons: [ROUTING_REASONS.generalExplanationNeeded] };
}
