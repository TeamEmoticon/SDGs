import type { AnalysisResult, RiskLevel } from "./types";

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return value === "safe" || value === "caution" || value === "danger" || value === "critical";
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
    Array.isArray(Reflect.get(value, "signals")) &&
    isRiskLevel(Reflect.get(value, "riskLevel")) &&
    typeof Reflect.get(value, "riskScore") === "number" &&
    typeof Reflect.get(value, "recommendation") === "string" &&
    typeof Reflect.get(value, "createdAt") === "string"
  );
}
