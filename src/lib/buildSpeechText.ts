// buildSpeechText.ts
// 분석 결과에서 "음성으로 읽어줄 문장"을 만드는 순수 함수.
// 사용자 원문·마스킹된 원문·점수 숫자·내부 코드명·전체 URL·AI 상태는 읽지 않는다.
// SSML을 쓰지 않고, 문장 사이 마침표로 자연스러운 쉼을 유도한다.

import type { AnalysisResult } from "./types";
import { LEVEL_STORY, REQUESTED_ACTION_LABEL } from "./ui-config.ts";

const MAX_TOTAL_LENGTH = 2_000;
const MAX_REASONS = 3;
const MAX_ACTIONS = 3;
const ORDINALS = ["첫째", "둘째", "셋째"] as const;

const SAFETY_NOTE = "이 결과만으로 안전 여부를 완전히 보장할 수는 없습니다.";
const FALLBACK_TEXT = "분석 결과를 읽을 수 없습니다. 화면의 내용을 확인해 주세요.";

// 이모지·기타 그림문자 대략 범위(음성으로 읽기 전에 제거).
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}]/gu;

// 제어문자(C0/C1)·제로폭·방향 제어 문자·BOM.
const CONTROL_RE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

// 장식/마크다운 기호(문장부호 . , ? ! 는 유지).
const DECORATION_RE = /[*_#`~>|[\]\\{}<>=+^]/g;

/** 한 조각의 텍스트를 음성용으로 정리한다(URL 대체, 태그·마스킹·기호·제어문자 제거). */
function sanitize(input: string): string {
  return input
    .normalize("NFC")
    // URL은 전체를 읽지 않고 "인터넷 주소"로 바꾼다.
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "인터넷 주소")
    // HTML 태그 제거
    .replace(/<[^>]*>/g, " ")
    // ●로 마스킹된 개인정보는 읽지 않는다(마커 제거)
    .replace(/●+/g, " ")
    .replace(EMOJI_RE, " ")
    .replace(CONTROL_RE, " ")
    .replace(DECORATION_RE, " ")
    // 연속 공백 정리
    .replace(/\s+/g, " ")
    .trim();
}

/** 문장이 마침표류로 끝나지 않으면 마침표를 붙여 자연스러운 쉼을 만든다. */
function ensureSentenceEnd(text: string): string {
  return /[.?!]$/.test(text) ? text : `${text}.`;
}

/** 여러 조각을 마침표로 이어 하나의 읽기 문단으로 만든다. */
function joinSentences(parts: readonly string[]): string {
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map(ensureSentenceEnd)
    .join(" ");
}

/** detail 같이 여러 문장인 텍스트에서 첫 문장만 간결하게 뽑는다. */
function firstSentence(text: string): string {
  const cleaned = sanitize(text);
  const end = cleaned.search(/[.?!]/);
  return end === -1 ? cleaned : cleaned.slice(0, end);
}

export function buildSpeechText(result: AnalysisResult): string {
  const levelStory = sanitize(LEVEL_STORY[result.riskLevel] ?? "");
  const parts: string[] = ["분석 결과입니다"];

  // 1) 위험 단계 — 화면과 동일한 문구
  if (levelStory.length > 0) parts.push(levelStory);

  // 2) 쉬운 요약
  const summary = sanitize(result.ai.summary ?? "");
  if (summary.length > 0) parts.push(summary);

  // 3) 주요 위험 이유 최대 3개 (규칙 신호 설명의 첫 문장)
  const reasons = result.signals
    .map((signal) => firstSentence(signal.detail))
    .filter((reason) => reason.length > 0)
    .slice(0, MAX_REASONS);
  if (reasons.length > 0) {
    parts.push("조심해야 할 이유입니다");
    reasons.forEach((reason, index) => parts.push(`${ORDINALS[index]}, ${reason}`));
  }

  // 4) 지금 할 일 최대 3개 — AI가 제안한 행동이 있으면 그것을, 없으면 권장 안내 한 문장을 읽는다.
  const requestedActions = (result.ai.requestedActions ?? [])
    .filter((action) => action !== "none")
    .map((action) => REQUESTED_ACTION_LABEL[action]);
  const actions = (requestedActions.length > 0 ? requestedActions : result.ai.actions)
    .map((action) => sanitize(action))
    .filter((action) => action.length > 0)
    .slice(0, MAX_ACTIONS);
  const recommendation = sanitize(result.recommendation ?? "");
  if (actions.length > 0) {
    parts.push("지금 할 일입니다");
    actions.forEach((action, index) => parts.push(`${ORDINALS[index]}, ${action}`));
  } else if (recommendation.length > 0) {
    parts.push("지금 할 일입니다");
    parts.push(recommendation);
  }

  // 5) 안전 보장 아님 주의 문구
  parts.push(SAFETY_NOTE);

  // 위험 단계/요약/이유/행동/권장이 모두 비어 안내만 남는 경우가 사실상 없지만, 방어적으로 처리한다.
  const meaningful =
    levelStory.length > 0 || summary.length > 0 || reasons.length > 0 || actions.length > 0 || recommendation.length > 0;
  if (!meaningful) return FALLBACK_TEXT;

  const speech = joinSentences(parts);
  return speech.length > MAX_TOTAL_LENGTH ? speech.slice(0, MAX_TOTAL_LENGTH).trim() : speech;
}
