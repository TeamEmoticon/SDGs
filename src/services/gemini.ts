import type { AiAnalysis, DifficultTerm } from "../lib/types";

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
        properties: {
          term: { type: "string" },
          easyMeaning: { type: "string" },
        },
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

export type GeminiOutcome =
  | { readonly kind: "success"; readonly analysis: AiAnalysis }
  | { readonly kind: "url-unavailable" }
  | { readonly kind: "unavailable" };

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(object: object, key: string): string | null {
  const value = Reflect.get(object, key);
  return typeof value === "string" ? value.trim() : null;
}

function readStringList(object: object, key: string, limit: number): readonly string[] {
  const value = Reflect.get(object, key);
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, limit);
}

function readDifficultTerms(object: object): readonly DifficultTerm[] {
  const value = Reflect.get(object, "difficultTerms");
  if (!Array.isArray(value)) return [];

  const terms: DifficultTerm[] = [];
  for (const entry of value) {
    if (!isObject(entry)) continue;
    const term = readString(entry, "term");
    const easyMeaning = readString(entry, "easyMeaning");
    if (term === null || easyMeaning === null || term.length === 0 || easyMeaning.length === 0) continue;
    terms.push({ term: term.slice(0, 40), easyMeaning: easyMeaning.slice(0, 160) });
    if (terms.length === 4) break;
  }
  return terms;
}

export function parseGeminiAnalysis(value: unknown, sourceText: string | null): AiAnalysis | null {
  if (!isObject(value)) return null;
  const summary = readString(value, "summary");
  const infoType = readString(value, "infoType");
  if (summary === null || infoType === null || summary.length === 0 || infoType.length === 0) return null;

  const riskPhrases = readStringList(value, "riskPhrases", 5).filter((phrase) => {
    if (sourceText === null) return true;
    return sourceText.normalize("NFC").includes(phrase.normalize("NFC"));
  });

  return {
    summary: summary.slice(0, 500),
    infoType: infoType.slice(0, 40),
    actions: readStringList(value, "actions", 4),
    riskPhrases,
    difficultTerms: readDifficultTerms(value),
    missingInfo: readStringList(value, "missingInfo", 4),
    used: true,
  };
}

function createPrompt(source: GeminiSource): string {
  if (source.kind === "url") {
    return `다음 공개 웹페이지를 URL Context로 읽고 안전성을 분석하세요: ${source.url}\n\n쉬운 말 요약, 글 종류, 요구 행동, 위험 후보 문구, 어려운 단어 풀이, 부족한 확인 정보를 JSON으로 반환하세요. 위험 점수나 위험 등급은 반환하지 마세요.`;
  }
  return `아래 글을 분석하세요. 개인정보는 이미 가려졌습니다. 글에 없는 사실을 만들지 말고, 위험 후보 문구는 원문 그대로 반환하세요. 쉬운 말 요약, 글 종류, 요구 행동, 위험 후보 문구, 어려운 단어 풀이, 부족한 확인 정보를 JSON으로 반환하세요. 위험 점수나 위험 등급은 반환하지 마세요.\n\n${source.maskedText}`;
}

function hasReadableUrlContext(value: unknown): boolean {
  if (!isObject(value)) return false;
  const candidates = Reflect.get(value, "candidates");
  if (!Array.isArray(candidates)) return false;

  return candidates.some((candidate) => {
    if (!isObject(candidate)) return false;
    const metadata = Reflect.get(candidate, "urlContextMetadata");
    if (!isObject(metadata)) return false;
    const urls = Reflect.get(metadata, "urlMetadata");
    if (!Array.isArray(urls)) return false;
    return urls.some((url) => isObject(url) && readString(url, "urlRetrievalStatus") === "URL_RETRIEVAL_STATUS_SUCCESS");
  });
}

function readModelText(value: unknown): string | null {
  if (!isObject(value)) return null;
  const candidates = Reflect.get(value, "candidates");
  if (!Array.isArray(candidates)) return null;
  const candidate = candidates[0];
  if (!isObject(candidate)) return null;
  const content = Reflect.get(candidate, "content");
  if (!isObject(content)) return null;
  const parts = Reflect.get(content, "parts");
  if (!Array.isArray(parts)) return null;
  const part = parts[0];
  return isObject(part) ? readString(part, "text") : null;
}

export async function requestGeminiAnalysis(source: GeminiSource): Promise<GeminiOutcome> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { kind: "unavailable" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: createPrompt(source) }] }],
        ...(source.kind === "url" ? { tools: [{ url_context: {} }] } : {}),
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1_000,
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_SCHEMA,
        },
      }),
    });
    if (!response.ok) return { kind: "unavailable" };

    const payload: unknown = await response.json();
    if (source.kind === "url" && !hasReadableUrlContext(payload)) return { kind: "url-unavailable" };
    const text = readModelText(payload);
    if (text === null) return { kind: "unavailable" };
    const parsed: unknown = JSON.parse(text);
    const analysis = parseGeminiAnalysis(parsed, source.kind === "text" ? source.maskedText : null);
    return analysis === null ? { kind: "unavailable" } : { kind: "success", analysis };
  } catch {
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

export { EMPTY_ANALYSIS };
