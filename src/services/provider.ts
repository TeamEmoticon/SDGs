// provider.ts
// 분석 오케스트레이션과 Gemini 구현의 경계.
// 실제 provider가 없거나 키가 없으면 null을 반환한다(호출부에서 not_configured 처리).
// 한 번의 분석에서 summarize 또는 factCheck 중 최대 한 개만, 최대 1회 호출된다.

import type { AiAnalysis, AiFailureStatus } from "../lib/types";
import { requestGeminiAnalysis, type GeminiSource } from "./gemini.ts";

export type ProviderInput = GeminiSource;

export type ProviderOutcome =
  | { readonly kind: "used"; readonly analysis: AiAnalysis }
  | { readonly kind: "url-unavailable" }
  | { readonly kind: "failure"; readonly status: AiFailureStatus };

export interface AnalysisProvider {
  summarize(input: ProviderInput): Promise<ProviderOutcome>;
  factCheck(input: ProviderInput): Promise<ProviderOutcome>;
}

function toProviderOutcome(outcome: Awaited<ReturnType<typeof requestGeminiAnalysis>>): ProviderOutcome {
  if (outcome.kind === "success") return { kind: "used", analysis: outcome.analysis };
  if (outcome.kind === "url-unavailable") return { kind: "url-unavailable" };
  return { kind: "failure", status: outcome.status };
}

function createGeminiProvider(): AnalysisProvider {
  return {
    async summarize(input) {
      return toProviderOutcome(await requestGeminiAnalysis(input, "summary"));
    },
    async factCheck(input) {
      return toProviderOutcome(await requestGeminiAnalysis(input, "summary"));
    },
  };
}

/** 키가 있으면 Gemini provider, 없으면 null(=not_configured). */
export function createDefaultProvider(): AnalysisProvider | null {
  return process.env.GEMINI_API_KEY ? createGeminiProvider() : null;
}
