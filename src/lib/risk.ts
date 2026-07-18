import type { AiAnalysis, RiskLevel, RiskVerdict, Signal } from "./types";

/**
 * Final risk computation (done in code, not by the model).
 *
 * Combines the rule-based signal weights with the AI classification and
 * suspicious-phrase extraction into a single 0-100 score and a four-step level:
 * 안전(safe) → 주의(caution) → 위험(danger) → 고위험(critical).
 */

const RECOMMENDATION: Record<RiskLevel, string> = {
  safe:
    "당장 위험한 정보 요구나 돈을 보내라는 내용은 보이지 않습니다. 다만 보낸 사람이나 링크를 모른다면 가볍게 넘기셔도 좋습니다.",
  caution:
    "완전히 안심하기 어려운 부분이 있습니다. 개인정보·인증번호를 요구하거나 돈을 보내라는 내용이 없는지 다시 한 번 살펴보세요.",
  danger:
    "사기·피싱일 가능성이 높습니다. 돈을 보내거나 개인정보·인증번호를 알려주지 마세요. 의심되면 112(경찰)나 1332(금융사기 상담)로 확인해 보세요.",
  critical:
    "여러 위험 신호가 있어 특히 조심해야 합니다. 링크를 누르거나 돈을 보내지 말고 112 또는 1332(금융감독원 콜센터)로 확인해 보세요. 이미 돈을 보냈다면 112에 곧바로 신고하세요.",
};

export function deriveFallback(analysis: AiAnalysis, signals: readonly Signal[]): AiAnalysis {
  if (analysis.used) return analysis;
  const n = signals.length;
  const critical = signals.some((s) => s.severity === "critical");
  if (n === 0) {
    return {
      ...analysis,
      summary: "특별한 위험 단어는 발견하지 못했습니다. 내용을 천천히 다시 확인해 보세요.",
      infoType: "일반 안내",
    };
  }
  const cats = [...new Set(signals.map((s) => s.label))].slice(0, 3).join(", ");
  return {
    ...analysis,
    summary: `규칙 검사에서 ${n}개의 의심 신호를 찾았습니다(${cats}). ${
      critical ? "심각한 신호가 포함되어 있어 주의가 필요합니다." : "내용을 꼼꼼히 확인해 보세요."
    }`,
    infoType: critical ? "사기 의심" : "주의 필요",
  };
}

/** AI 보조 신호가 위험 점수에 더할 수 있는 총합 상한. */
export const AI_SIGNAL_SCORE_CAP = 10;

function levelFromScore(score: number): RiskLevel {
  if (score === 0) return "safe";
  if (score <= 18) return "caution";
  if (score <= 45) return "danger";
  return "critical";
}

/**
 * AI 보조 신호를 검증한다.
 * - 원문(마스킹된 분석 텍스트)에 실제로 존재하는 quote만 남긴다.
 * - 빈 문자열과 중복을 제거한다.
 * (Gemini 파서에서도 1차 필터하지만, 주입된 provider까지 방어하기 위해 여기서 다시 확인한다.)
 */
export function verifyAiAnalysis(analysis: AiAnalysis, sourceText: string): AiAnalysis {
  if (!analysis.used) return analysis;
  const normalizedSource = sourceText.normalize("NFC");
  const seen = new Set<string>();
  const riskPhrases = analysis.riskPhrases.filter((phrase) => {
    const normalized = phrase.normalize("NFC");
    if (normalized.length === 0) return false;
    if (!normalizedSource.includes(normalized)) return false;
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
  if (riskPhrases.length === analysis.riskPhrases.length) return analysis;
  return { ...analysis, riskPhrases };
}

export function calculateRisk(signals: readonly Signal[], analysis: AiAnalysis): RiskVerdict {
  const ruleScore = signals.reduce((sum, s) => sum + s.weight, 0);

  // AI 보조 신호는 총합 최대 10점까지만 더한다.
  const aiScore = analysis.used ? Math.min(analysis.riskPhrases.length * 4, AI_SIGNAL_SCORE_CAP) : 0;
  const score = Math.min(ruleScore + aiScore, 100);

  const hasCritical = signals.some((s) => s.severity === "critical");

  let level = levelFromScore(score);

  // AI 보조 신호만으로는 danger/critical을 만들지 않는다.
  // 규칙 점수 기준 등급이 caution 이하이면 등급 상한을 caution으로 제한한다.
  const ruleLevel = levelFromScore(ruleScore);
  if ((ruleLevel === "safe" || ruleLevel === "caution") && (level === "danger" || level === "critical")) {
    level = "caution";
  }

  // 규칙 기반의 명백한 critical 신호는 등급을 끌어올린다(규칙만으로 확정).
  if (hasCritical && level === "caution") level = "danger";
  if (hasCritical && score >= 50) level = "critical";

  return { level, score, recommendation: RECOMMENDATION[level] };
}

export const RISK_META: Record<
  RiskLevel,
  { label: string; tone: string; score: string; bar: string; ring: string }
> = {
  safe: { label: "안전", tone: "emerald", score: "text-emerald-700", bar: "bg-emerald-500", ring: "ring-emerald-200" },
  caution: { label: "주의", tone: "amber", score: "text-amber-700", bar: "bg-amber-500", ring: "ring-amber-200" },
  danger: { label: "위험", tone: "orange", score: "text-orange-700", bar: "bg-orange-500", ring: "ring-orange-200" },
  critical: { label: "고위험", tone: "red", score: "text-red-700", bar: "bg-red-500", ring: "ring-red-200" },
};

export const LEVEL_ORDER: RiskLevel[] = ["safe", "caution", "danger", "critical"];
