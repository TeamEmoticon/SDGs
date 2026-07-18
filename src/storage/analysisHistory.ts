import type { AnalysisResult, InputType, RiskLevel } from "@/lib/types";

const STORAGE_KEY = "ansim-analysis-history.v1";
const MAX_ITEMS = 20;

export interface AnalysisHistoryStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem: (key: string) => void;
}

type SavedAnalysisResult = Omit<AnalysisResult, "maskedText">;

export interface AnalysisHistoryItem {
  readonly id: string;
  readonly createdAt: string;
  readonly inputType: InputType;
  readonly sourceUrl: string | null;
  readonly preview: string;
  readonly riskLevel: RiskLevel;
  readonly result: SavedAnalysisResult;
}

function getBrowserStorage(): AnalysisHistoryStorage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return value === "safe" || value === "caution" || value === "danger" || value === "critical";
}

function isHistoryItem(value: unknown): value is AnalysisHistoryItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.createdAt === "string" &&
    (item.inputType === "text" || item.inputType === "url") &&
    (typeof item.sourceUrl === "string" || item.sourceUrl === null) &&
    typeof item.preview === "string" &&
    isRiskLevel(item.riskLevel) &&
    typeof item.result === "object" &&
    item.result !== null
  );
}

function toSavedResult(result: AnalysisResult): SavedAnalysisResult {
  const { maskedText: _maskedText, ...savedResult } = result;
  return savedResult;
}

function writeHistory(items: readonly AnalysisHistoryItem[], storage: AnalysisHistoryStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function discardHistory(storage: AnalysisHistoryStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

export function loadAnalysisHistory(storage: AnalysisHistoryStorage | null = getBrowserStorage()): readonly AnalysisHistoryItem[] {
  if (storage === null) return [];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isHistoryItem)) {
      discardHistory(storage);
      return [];
    }
    return parsed.slice(0, MAX_ITEMS);
  } catch {
    discardHistory(storage);
    return [];
  }
}

export function appendAnalysisHistory(
  result: AnalysisResult,
  storage: AnalysisHistoryStorage | null = getBrowserStorage(),
  id: string = crypto.randomUUID(),
): void {
  if (storage === null) return;

  const item: AnalysisHistoryItem = {
    id,
    createdAt: result.createdAt,
    inputType: result.inputType,
    sourceUrl: result.sourceUrl,
    preview: result.maskedText.slice(0, 80),
    riskLevel: result.riskLevel,
    result: toSavedResult(result),
  };
  const next = [item, ...loadAnalysisHistory(storage).filter((entry) => entry.id !== item.id)].slice(0, MAX_ITEMS);

  try {
    writeHistory(next, storage);
  } catch {
    try {
      writeHistory(next.slice(0, Math.ceil(MAX_ITEMS / 2)), storage);
    } catch {
      return;
    }
  }
}

export function restoreAnalysisResult(item: AnalysisHistoryItem): AnalysisResult {
  return { ...item.result, maskedText: "" };
}

export function removeAnalysisHistory(
  id: string,
  storage: AnalysisHistoryStorage | null = getBrowserStorage(),
): void {
  if (storage === null) return;
  try {
    writeHistory(loadAnalysisHistory(storage).filter((item) => item.id !== id), storage);
  } catch {
    return;
  }
}

export function clearAnalysisHistory(storage: AnalysisHistoryStorage | null = getBrowserStorage()): void {
  if (storage === null) return;
  discardHistory(storage);
}
