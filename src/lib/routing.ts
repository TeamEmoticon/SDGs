// routing.ts
// 적응형 분석 라우터(순수 함수). 규칙 신호 조합과 텍스트 단서로 분석 모드를 결정한다.
// 우선순위: ① 명백한 사기 조합 → RULE_ONLY  ② 검증 가능 공공 주장 → GROUNDED_FACT_CHECK  ③ 나머지 → AI_SUMMARY
// 단일 키워드만으로 확정하지 않고 규칙 두 개 이상의 조합을 사용한다.

import type { AnalysisMode, Signal } from "./types";
import { ROUTING_REASONS, type RuleOnlyReason } from "./routingPolicy.ts";

export interface RoutingDecision {
  readonly mode: AnalysisMode;
  readonly reasons: readonly string[];
}

const CREDENTIAL_REQUEST = /인증\s?번호|비밀\s?번호|보안\s?카드|otp|공동\s?인증서|금융\s?인증서/i;

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
  const impersonation = hasCategory(signals, "impersonation") || hasCategory(signals, "acquaintance");
  const money = hasCategory(signals, "money");
  const urgency = hasCategory(signals, "urgency");
  const link = hasCategory(signals, "link");
  const coercion = hasCategory(signals, "coercion");
  const personalInfo = hasCategory(signals, "personalinfo");
  const appInstall = hasId(signals, "link-install");
  const credentialRequest = hasId(signals, "pinfo-secrets") || CREDENTIAL_REQUEST.test(text);
  const remoteControl = hasCategory(signals, "remote");

  if (impersonation && money) reasons.push(ROUTING_REASONS.impersonationWithMoney);
  if (money && urgency) reasons.push(ROUTING_REASONS.moneyWithUrgency);
  if (credentialRequest && link) reasons.push(ROUTING_REASONS.credentialRequestWithLink);
  if (remoteControl) reasons.push(ROUTING_REASONS.remoteControlRequest);
  if (appInstall && (money || personalInfo)) reasons.push(ROUTING_REASONS.appInstallWithSensitiveRequest);
  if (coercion && (money || personalInfo)) reasons.push(ROUTING_REASONS.coercionWithPaymentOrPersonalInfo);

  return reasons;
}

/**
 * 검증 가능한 공공 주장인지 — 공공 주제 + (검증 가능한 주장 형태 또는 은폐 주장) + 의견/광고 아님.
 * 예: "정부가 지급을 확정했다"(주제+주장 형태), "병원에서 쉬쉬하는 비밀"(주제+은폐 주장).
 */
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

  if (hasCheckablePublicClaim(text)) {
    return { mode: "GROUNDED_FACT_CHECK", reasons: [ROUTING_REASONS.checkablePublicClaim] };
  }

  return { mode: "AI_SUMMARY", reasons: [ROUTING_REASONS.generalExplanationNeeded] };
}
