import { maskSensitive } from "../lib/masking";
import { calculateRisk, deriveFallback } from "../lib/risk";
import { detectSignals } from "../lib/rules";
import type { AnalysisResult, InputType } from "../lib/types";
import { EMPTY_ANALYSIS, requestGeminiAnalysis } from "./gemini";

const TEXT_LIMIT = 6_000;
const URL_LIMIT = 2_048;

export type AnalysisOutcome =
  | { readonly kind: "success"; readonly result: AnalysisResult }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "url-unavailable"; readonly message: string };

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readInput(value: unknown): { readonly type: InputType; readonly content: string } | null {
  if (!isObject(value)) return null;
  const type = Reflect.get(value, "type");
  const content = Reflect.get(value, "content");
  if ((type !== "text" && type !== "url") || typeof content !== "string") return null;
  return { type, content: content.trim() };
}

function isPublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host === "::1") return false;
    if (/^127\.|^10\.|^192\.168\.|^169\.254\./.test(host)) return false;
    const private172 = /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
    return !private172 && !host.startsWith("fc") && !host.startsWith("fd");
  } catch {
    return false;
  }
}

export async function analyzeInput(value: unknown): Promise<AnalysisOutcome> {
  const input = readInput(value);
  if (input === null) return { kind: "invalid", message: "입력 형식을 확인해 주세요." };

  if (input.type === "url") {
    if (input.content.length === 0 || input.content.length > URL_LIMIT || !isPublicUrl(input.content)) {
      return { kind: "invalid", message: "공개 인터넷 주소를 정확히 입력해 주세요." };
    }
    const aiOutcome = await requestGeminiAnalysis({ kind: "url", url: input.content });
    if (aiOutcome.kind !== "success") {
      return {
        kind: "url-unavailable",
        message: "이 페이지의 글을 불러오지 못했습니다. 로그인이 필요하거나 자동 읽기를 막았을 수 있어요. 내용을 복사해서 붙여넣어 주세요.",
      };
    }
    const ai = deriveFallback(aiOutcome.kind === "success" ? aiOutcome.analysis : EMPTY_ANALYSIS, []);
    const verdict = calculateRisk([], ai);
    return {
      kind: "success",
      result: {
        inputType: "url",
        sourceUrl: input.content,
        maskedText: "",
        mask: { maskedCount: 0, counts: { phone: 0, account: 0, code: 0, rrn: 0, card: 0 } },
        signals: [],
        ai,
        riskLevel: verdict.level,
        riskScore: verdict.score,
        recommendation: verdict.recommendation,
        createdAt: new Date().toISOString(),
      },
    };
  }

  if (input.content.length < 10) return { kind: "invalid", message: "확인할 문자나 글을 10자 이상 붙여넣어 주세요." };

  const mask = maskSensitive(input.content.slice(0, TEXT_LIMIT));
  const signals = detectSignals(mask.text);
  const aiOutcome = await requestGeminiAnalysis({ kind: "text", maskedText: mask.text });
  const ai = deriveFallback(aiOutcome.kind === "success" ? aiOutcome.analysis : EMPTY_ANALYSIS, signals);
  const verdict = calculateRisk(signals, ai);

  return {
    kind: "success",
    result: {
      inputType: "text",
      sourceUrl: null,
      maskedText: mask.text,
      mask: { maskedCount: mask.maskedCount, counts: mask.counts },
      signals,
      ai,
      riskLevel: verdict.level,
      riskScore: verdict.score,
      recommendation: verdict.recommendation,
      createdAt: new Date().toISOString(),
    },
  };
}
