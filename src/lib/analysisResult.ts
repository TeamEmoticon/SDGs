import type { AnalysisResult, RiskLevel } from "./types";

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return value === "safe" || value === "caution" || value === "danger" || value === "critical";
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isGrounding(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isObject(value)) return false;
  const sources = Reflect.get(value, "sources");
  const searchSuggestionHtml = Reflect.get(value, "searchSuggestionHtml");
  return (
    Array.isArray(sources) &&
    sources.length > 0 &&
    sources.every(
      (source) =>
        isObject(source) &&
        typeof Reflect.get(source, "title") === "string" &&
        Reflect.get(source, "title").trim().length > 0 &&
        isHttpUrl(Reflect.get(source, "url")),
    ) &&
    (searchSuggestionHtml === undefined || typeof searchSuggestionHtml === "string")
  );
}

function isFactCheck(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isObject(value)) return false;
  const verdict = Reflect.get(value, "verdict");
  const evidenceStrength = Reflect.get(value, "evidenceStrength");
  return (
    typeof Reflect.get(value, "claimQuote") === "string" &&
    Reflect.get(value, "claimQuote").trim().length > 0 &&
    typeof Reflect.get(value, "explanation") === "string" &&
    Reflect.get(value, "explanation").trim().length > 0 &&
    (verdict === "supported" || verdict === "contradicted" || verdict === "mixed" || verdict === "insufficient_evidence") &&
    (evidenceStrength === "linked" || evidenceStrength === "limited")
  );
}

export function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (!isObject(value)) return false;
  const inputType = Reflect.get(value, "inputType");
  const mask = Reflect.get(value, "mask");
  const ai = Reflect.get(value, "ai");
  return (
    (inputType === "text" || inputType === "url") &&
    (Reflect.get(value, "sourceUrl") === null || typeof Reflect.get(value, "sourceUrl") === "string") &&
    typeof Reflect.get(value, "maskedText") === "string" &&
    isObject(mask) &&
    typeof Reflect.get(mask, "maskedCount") === "number" &&
    isObject(ai) &&
    typeof Reflect.get(ai, "summary") === "string" &&
    typeof Reflect.get(ai, "infoType") === "string" &&
    Array.isArray(Reflect.get(ai, "riskPhrases")) &&
    typeof Reflect.get(ai, "used") === "boolean" &&
    isGrounding(Reflect.get(ai, "grounding")) &&
    isFactCheck(Reflect.get(ai, "factCheck")) &&
    Array.isArray(Reflect.get(value, "signals")) &&
    isRiskLevel(Reflect.get(value, "riskLevel")) &&
    typeof Reflect.get(value, "riskScore") === "number" &&
    typeof Reflect.get(value, "recommendation") === "string" &&
    typeof Reflect.get(value, "createdAt") === "string"
  );
}
