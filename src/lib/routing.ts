// routing.ts
// 적응형 분석 라우터(순수 함수). 규칙 신호 조합과 텍스트 단서로 분석 모드를 결정한다.
// 우선순위: ① 명백한 사기 조합 → RULE_ONLY  ② 검증 가능 공공 주장 → GROUNDED_FACT_CHECK  ③ 나머지 → AI_SUMMARY
// 단일 키워드만으로 확정하지 않고 규칙 두 개 이상의 조합을 사용한다.

import type { AnalysisMode, Signal } from "./types";

export interface RoutingDecision {
  readonly mode: AnalysisMode;
  readonly reasons: readonly string[];
}

// 규칙에 대응되지 않는 개념(원격제어·인증번호 요구)만 텍스트로 보조 판정한다.
const REMOTE_CONTROL = /원격\s?제어|원격\s?지원|화면\s?공유|팀뷰어|teamviewer|애니데스크|anydesk|퀵서포트|quicksupport/i;
const CREDENTIAL_REQUEST = /인증\s?번호|비밀\s?번호|보안\s?카드|otp|공동\s?인증서|금융\s?인증서/i;

// 검증 가능한 공공 주장 판정용
const PUBLIC_TOPIC =
  /건강|질병|백신|접종|암|정부|정책|지원금|보조금|재난지원|급여|연금|복지|국민|뉴스|보도|기사|연구|논문|통계|법률|법안|시행령/;
const CHECKABLE_CLAIM =
  /지급(한다|합니다|됩니다|예정)?|폐지(된다|됐다|됩니다)?|시행(한다|된다|됩니다)?|완치(된다|됩니다)?|확정(됐다|됩니다)?|발표(했다|합니다)?|인상|인하|의무화|무료로\s?제공/;
const OPINION_OR_AD =
  /제\s?생각|개인적으로|인\s?것\s?같|같아요|같습니다|광고|홍보|할인|세일|특가|구매하세요|이벤트\s?참여/;

function hasCategory(signals: readonly Signal[], category: string): boolean {
  return signals.some((signal) => signal.category === category);
}

function hasId(signals: readonly Signal[], id: string): boolean {
  return signals.some((signal) => signal.id === id);
}

/** 명백한 사기 조합인지 — 규칙 두 개 이상의 조합(또는 단독으로도 확정적인 요구)으로 판정. */
export function hasCriticalScamCombination(signals: readonly Signal[], text: string): string[] {
  const reasons: string[] = [];
  const impersonation = hasCategory(signals, "impersonation") || hasCategory(signals, "acquaintance");
  const money = hasCategory(signals, "money");
  const urgency = hasCategory(signals, "urgency");
  const link = hasCategory(signals, "link");
  const coercion = hasCategory(signals, "coercion");
  const personalInfo = hasCategory(signals, "personalinfo");
  const appInstall = hasId(signals, "link-install");
  const credentialRequest = hasId(signals, "pinfo-secrets") || CREDENTIAL_REQUEST.test(text);
  const remoteControl = REMOTE_CONTROL.test(text);

  if (impersonation && money) reasons.push("impersonation_with_money");
  if (money && urgency) reasons.push("money_with_urgency");
  if (credentialRequest && link) reasons.push("credential_request_with_link");
  if (remoteControl) reasons.push("remote_control_request");
  if (appInstall && (money || personalInfo)) reasons.push("app_install_with_sensitive_request");
  if (coercion && (money || personalInfo)) reasons.push("coercion_with_payment_or_personal_info");

  return reasons;
}

/** 검증 가능한 공공 주장인지 — 공공 주제 + 검증 가능한 주장 형태 + 의견/광고 아님. */
export function hasCheckablePublicClaim(text: string): boolean {
  if (OPINION_OR_AD.test(text)) return false;
  return PUBLIC_TOPIC.test(text) && CHECKABLE_CLAIM.test(text);
}

export function chooseAnalysisMode(signals: readonly Signal[], text: string): RoutingDecision {
  const scamReasons = hasCriticalScamCombination(signals, text);
  if (scamReasons.length > 0) {
    return { mode: "RULE_ONLY", reasons: scamReasons };
  }

  if (hasCheckablePublicClaim(text)) {
    return { mode: "GROUNDED_FACT_CHECK", reasons: ["checkable_public_claim"] };
  }

  return { mode: "AI_SUMMARY", reasons: ["general_explanation_needed"] };
}
