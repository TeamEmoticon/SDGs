import type { AiAnalysis, AiFailureStatus } from "../lib/types";
import {
  hasReadableUrlContext,
  isSafetyBlocked,
  parseGeminiAnalysis,
  parseGeminiJson,
  parseGroundingEvidence,
  readModelText,
} from "./geminiParsing.ts";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const REQUEST_TIMEOUT_MS = 12_000;

const EMPTY_ANALYSIS: AiAnalysis = {
  summary: "",
  infoType: "",
  actions: [],
  riskPhrases: [],
  difficultTerms: [],
  missingInfo: [],
  used: false,
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    infoType: { type: "string" },
    actions: { type: "array", items: { type: "string" }, maxItems: 4 },
    riskPhrases: { type: "array", items: { type: "string" }, maxItems: 5 },
    difficultTerms: {
      type: "array",
      items: {
        type: "object",
        properties: { term: { type: "string" }, easyMeaning: { type: "string" } },
        required: ["term", "easyMeaning"],
      },
      maxItems: 4,
    },
    missingInfo: { type: "array", items: { type: "string" }, maxItems: 4 },
  },
  required: ["summary", "infoType", "actions", "riskPhrases", "difficultTerms", "missingInfo"],
} as const;

export type GeminiSource =
  | { readonly kind: "text"; readonly maskedText: string }
  | { readonly kind: "url"; readonly url: string };

export type GeminiMode = "summary" | "grounded";

export type GeminiOutcome =
  | { readonly kind: "success"; readonly analysis: AiAnalysis }
  | { readonly kind: "url-unavailable" }
  | { readonly kind: "failure"; readonly status: AiFailureStatus };

export type GeminiFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface GeminiRequest {
  readonly url: string;
  readonly init: {
    readonly method: "POST";
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
  };
}

export interface GeminiRequestParams {
  readonly source: GeminiSource;
  readonly mode: GeminiMode;
  readonly apiKey: string;
}

export function httpStatusToFailure(status: number): AiFailureStatus {
  if (status === 401 || status === 403 || status === 404) return "configuration_error";
  if (status === 408 || status === 504) return "timeout";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "upstream_error";
  return "invalid_response";
}

function createPrompt(source: GeminiSource, mode: GeminiMode): string {
  if (mode === "grounded") {
    return `아래 글의 공개적으로 검증할 수 있는 주장을 Google Search로 확인하세요. 검색 결과에 근거한 쉬운 말 요약, 글 종류, 요구 행동, 위험 후보 문구, 어려운 단어 풀이, 부족한 확인 정보를 JSON 객체만으로 반환하세요. 위험 점수나 위험 등급은 반환하지 마세요. 원문에 없는 위험 후보 문구는 반환하지 마세요.\n\n${source.kind === "text" ? source.maskedText : source.url}`;
  }
  if (source.kind === "url") {
    return `다음 공개 웹페이지를 URL Context로 읽고 안전성을 분석하세요. 쉬운 말 요약, 글 종류, 요구 행동, 위험 후보 문구, 어려운 단어 풀이, 부족한 확인 정보를 JSON 객체만으로 반환하세요. 위험 점수나 위험 등급은 반환하지 마세요.\n\n${source.url}`;
  }
  return `아래 글을 분석하세요. 개인정보는 이미 가려졌습니다. 글에 없는 사실을 만들지 말고, 위험 후보 문구는 원문 그대로 반환하세요. 쉬운 말 요약, 글 종류, 요구 행동, 위험 후보 문구, 어려운 단어 풀이, 부족한 확인 정보를 JSON으로 반환하세요. 위험 점수나 위험 등급은 반환하지 마세요.\n\n${source.maskedText}`;
}

function createRequestBody(source: GeminiSource, mode: GeminiMode): string {
  const tool = mode === "grounded" ? { google_search: {} } : source.kind === "url" ? { url_context: {} } : null;
  const body = {
    contents: [{ parts: [{ text: createPrompt(source, mode) }] }],
    ...(tool === null ? {} : { tools: [tool] }),
    ...(tool !== null
      ? {}
      : {
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1_000,
            responseMimeType: "application/json",
            responseJsonSchema: RESPONSE_SCHEMA,
          },
        }),
  };
  return JSON.stringify(body);
}

export function buildGeminiRequest({ source, mode, apiKey }: GeminiRequestParams): GeminiRequest {
  return {
    url: `${GEMINI_ENDPOINT}/${GEMINI_MODEL}:generateContent`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: createRequestBody(source, mode),
    },
  };
}

export async function requestGeminiAnalysis(
  source: GeminiSource,
  mode: GeminiMode,
  fetcher: GeminiFetch = fetch,
): Promise<GeminiOutcome> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { kind: "failure", status: "configuration_error" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const request = buildGeminiRequest({ source, mode, apiKey });

  try {
    const response = await fetcher(request.url, { ...request.init, signal: controller.signal });
    if (!response.ok) return { kind: "failure", status: httpStatusToFailure(response.status) };

    const payload: unknown = await response.json();
    if (isSafetyBlocked(payload)) return { kind: "failure", status: "blocked" };
    if (source.kind === "url" && !hasReadableUrlContext(payload)) return { kind: "url-unavailable" };
    const text = readModelText(payload);
    if (text === null) return { kind: "failure", status: "invalid_response" };
    const parsed = parseGeminiJson(text);
    if (parsed === null) return { kind: "failure", status: "invalid_response" };
    const grounding = mode === "grounded" ? parseGroundingEvidence(payload) : undefined;
    if (mode === "grounded" && grounding === null) return { kind: "failure", status: "invalid_response" };
    const analysis = parseGeminiAnalysis(parsed, source.kind === "text" ? source.maskedText : null, grounding ?? undefined);
    return analysis === null ? { kind: "failure", status: "invalid_response" } : { kind: "success", analysis };
  } catch (error) {
    const status: AiFailureStatus = error instanceof Error && error.name === "AbortError" ? "timeout" : "upstream_error";
    return { kind: "failure", status };
  } finally {
    clearTimeout(timer);
  }
}

export { EMPTY_ANALYSIS, parseGeminiAnalysis, parseGeminiJson, parseGroundingEvidence };
