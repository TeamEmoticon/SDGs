import {
  FACT_CHECK_VERDICTS,
  type AiAnalysis,
  type DifficultTerm,
  type FactCheckResult,
  type GroundingEvidence,
  type GroundingSource,
} from "../lib/types.ts";

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(object: object, key: string): string | null {
  const value = Reflect.get(object, key);
  return typeof value === "string" ? value.trim() : null;
}

function isFactCheckVerdict(value: string): value is FactCheckResult["verdict"] {
  return FACT_CHECK_VERDICTS.some((candidate) => candidate === value);
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

function readFactCheck(value: object, sourceText: string, grounding: GroundingEvidence): FactCheckResult | null {
  const factCheck = Reflect.get(value, "factCheck");
  if (!isObject(factCheck)) return null;
  const claimQuote = readString(factCheck, "claimQuote");
  const verdict = readString(factCheck, "verdict");
  const explanation = readString(factCheck, "explanation");
  if (claimQuote === null || verdict === null || explanation === null) return null;
  if (!sourceText.normalize("NFC").includes(claimQuote.normalize("NFC"))) return null;
  if (!isFactCheckVerdict(verdict)) return null;

  return {
    claimQuote: claimQuote.slice(0, 240),
    verdict: grounding.hasLinkedSupport === true ? verdict : "insufficient_evidence",
    explanation: explanation.slice(0, 360),
    evidenceStrength: grounding.hasLinkedSupport === true ? "linked" : "limited",
  };
}

export function parseGeminiAnalysis(
  value: unknown,
  sourceText: string | null,
  grounding?: GroundingEvidence,
): AiAnalysis | null {
  if (!isObject(value)) return null;
  const summary = readString(value, "summary");
  const infoType = readString(value, "infoType");
  if (summary === null || infoType === null || summary.length === 0 || infoType.length === 0) return null;

  const riskPhrases = readStringList(value, "riskPhrases", 5).filter((phrase) => {
    if (sourceText === null) return true;
    return sourceText.normalize("NFC").includes(phrase.normalize("NFC"));
  });

  const parsedFactCheck =
    grounding === undefined || sourceText === null ? undefined : readFactCheck(value, sourceText, grounding);
  if (grounding !== undefined && parsedFactCheck === null) return null;
  const factCheck = parsedFactCheck ?? undefined;

  return {
    summary: summary.slice(0, 500),
    infoType: infoType.slice(0, 40),
    actions: readStringList(value, "actions", 4),
    riskPhrases,
    difficultTerms: readDifficultTerms(value),
    missingInfo: readStringList(value, "missingInfo", 4),
    used: true,
    ...(grounding === undefined ? {} : { grounding }),
    ...(factCheck === undefined ? {} : { factCheck }),
  };
}

export function parseGeminiJson(text: string): unknown | null {
  const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const json = fenced?.[1] ?? text.trim();
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function parseGroundingSource(value: unknown): GroundingSource | null {
  if (!isObject(value)) return null;
  const web = Reflect.get(value, "web");
  if (!isObject(web)) return null;
  const title = readString(web, "title");
  const url = readString(web, "uri");
  if (title === null || url === null || title.length === 0 || url.length === 0) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { title: title.slice(0, 120), url };
}

function hasLinkedSupport(metadata: object): boolean {
  const supports = Reflect.get(metadata, "groundingSupports");
  if (!Array.isArray(supports)) return false;
  return supports.some((support) => {
    if (!isObject(support)) return false;
    const segment = Reflect.get(support, "segment");
    const indexes = Reflect.get(support, "groundingChunkIndices");
    return isObject(segment) && Array.isArray(indexes) && indexes.some((index) => Number.isInteger(index) && index >= 0);
  });
}

export function parseGroundingEvidence(value: unknown): GroundingEvidence | null {
  if (!isObject(value)) return null;
  const candidates = Reflect.get(value, "candidates");
  if (!Array.isArray(candidates) || candidates.length === 0 || !isObject(candidates[0])) return null;
  const metadata = Reflect.get(candidates[0], "groundingMetadata");
  if (!isObject(metadata)) return null;
  const chunks = Reflect.get(metadata, "groundingChunks");
  if (!Array.isArray(chunks)) return null;

  const sources: GroundingSource[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const source = parseGroundingSource(chunk);
    if (source === null || seen.has(source.url)) continue;
    seen.add(source.url);
    sources.push(source);
    if (sources.length === 5) break;
  }
  if (sources.length === 0) return null;

  const searchEntryPoint = Reflect.get(metadata, "searchEntryPoint");
  const html = isObject(searchEntryPoint) ? readString(searchEntryPoint, "renderedContent") : null;
  return {
    sources,
    ...(html === null || html.length > 20_000 ? {} : { searchSuggestionHtml: html }),
    ...(hasLinkedSupport(metadata) ? { hasLinkedSupport: true } : {}),
  };
}

export function isSafetyBlocked(value: unknown): boolean {
  if (!isObject(value)) return false;
  const feedback = Reflect.get(value, "promptFeedback");
  if (isObject(feedback) && typeof Reflect.get(feedback, "blockReason") === "string") return true;
  const candidates = Reflect.get(value, "candidates");
  return Array.isArray(candidates) && candidates.some((candidate) => isObject(candidate) && Reflect.get(candidate, "finishReason") === "SAFETY");
}

export function hasReadableUrlContext(value: unknown): boolean {
  if (!isObject(value)) return false;
  const candidates = Reflect.get(value, "candidates");
  if (!Array.isArray(candidates)) return false;

  return candidates.some((candidate) => {
    if (!isObject(candidate)) return false;
    const metadata = Reflect.get(candidate, "urlContextMetadata");
    if (!isObject(metadata)) return false;
    const urls = Reflect.get(metadata, "urlMetadata");
    return Array.isArray(urls) && urls.some((url) => isObject(url) && readString(url, "urlRetrievalStatus") === "URL_RETRIEVAL_STATUS_SUCCESS");
  });
}

export function readModelText(value: unknown): string | null {
  if (!isObject(value)) return null;
  const candidates = Reflect.get(value, "candidates");
  if (!Array.isArray(candidates) || !isObject(candidates[0])) return null;
  const content = Reflect.get(candidates[0], "content");
  if (!isObject(content)) return null;
  const parts = Reflect.get(content, "parts");
  if (!Array.isArray(parts) || !isObject(parts[0])) return null;
  return readString(parts[0], "text");
}
