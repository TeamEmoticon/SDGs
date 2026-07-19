import {
  MESSAGE_TYPES,
  REQUESTED_ACTIONS,
  type AiAnalysis,
  type DifficultTerm,
  type MessageType,
  type RequestedAction,
} from "../lib/types.ts";

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

function isMessageType(value: string): value is MessageType {
  return MESSAGE_TYPES.some((candidate) => candidate === value);
}

function isRequestedAction(value: string): value is RequestedAction {
  return REQUESTED_ACTIONS.some((candidate) => candidate === value);
}

function readRequestedActions(object: object): readonly RequestedAction[] {
  const value = Reflect.get(object, "requestedActions");
  if (!Array.isArray(value)) return [];
  const actions: RequestedAction[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !isRequestedAction(entry) || actions.includes(entry)) continue;
    actions.push(entry);
    if (actions.length === 4) break;
  }
  return actions;
}

function readSignalQuotes(object: object, sourceText: string | null): readonly string[] {
  const value = Reflect.get(object, "signals");
  if (!Array.isArray(value)) return [];
  const quotes: string[] = [];
  for (const entry of value) {
    if (!isObject(entry)) continue;
    const quote = readString(entry, "quote");
    const code = readString(entry, "code");
    if (quote === null || code === null || quote.length === 0 || code.length === 0) continue;
    if (sourceText !== null && !sourceText.normalize("NFC").includes(quote.normalize("NFC"))) continue;
    if (quotes.includes(quote)) continue;
    quotes.push(quote);
    if (quotes.length === 3) break;
  }
  return quotes;
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
  if (summary === null || summary.length === 0) return null;

  const messageType = readString(value, "messageType");
  if (messageType !== null && isMessageType(messageType)) {
    return {
      summary: summary.slice(0, 500),
      infoType: messageType,
      actions: [],
      riskPhrases: readSignalQuotes(value, sourceText),
      difficultTerms: [],
      missingInfo: [],
      used: true,
      messageType,
      requestedActions: readRequestedActions(value),
    };
  }

  const infoType = readString(value, "infoType");
  if (infoType === null || infoType.length === 0) return null;

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

export function parseGeminiJson(text: string): unknown | null {
  const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const json = fenced?.[1] ?? text.trim();
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isSafetyBlocked(value: unknown): boolean {
  if (!isObject(value)) return false;
  const feedback = Reflect.get(value, "promptFeedback");
  if (isObject(feedback) && typeof Reflect.get(feedback, "blockReason") === "string") return true;
  const candidates = Reflect.get(value, "candidates");
  return Array.isArray(candidates) && candidates.some((candidate) => isObject(candidate) && Reflect.get(candidate, "finishReason") === "SAFETY");
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
