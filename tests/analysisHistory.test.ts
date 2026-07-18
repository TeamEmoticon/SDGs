import assert from "node:assert/strict";
import test from "node:test";
import {
  appendAnalysisHistory,
  clearAnalysisHistory,
  loadAnalysisHistory,
  removeAnalysisHistory,
  type AnalysisHistoryStorage,
} from "../src/storage/analysisHistory.ts";

const createStorage = (): AnalysisHistoryStorage => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

const createResult = (createdAt: string) => ({
  inputType: "text" as const,
  sourceUrl: null,
  maskedText: "인증번호 ●●●●●●을 입력하세요.",
  mask: {
    maskedCount: 1,
    counts: { phone: 0, account: 0, code: 1, rrn: 0, card: 0 },
  },
  signals: [],
  ai: {
    summary: "인증번호를 요구하는 글입니다.",
    infoType: "금융·공과금 알림",
    actions: ["인증번호 입력"],
    riskPhrases: ["인증번호"],
    difficultTerms: [],
    missingInfo: [],
    used: true,
  },
  riskLevel: "danger" as const,
  riskScore: 30,
  recommendation: "공식 번호로 확인하세요.",
  createdAt,
});

test("stores only a safe projection when an analysis completes", () => {
  const storage = createStorage();

  appendAnalysisHistory(createResult("2026-07-18T00:00:00.000Z"), storage, "first");

  const [item] = loadAnalysisHistory(storage);
  assert.equal(item?.preview, "인증번호 ●●●●●●을 입력하세요.");
  assert.equal(JSON.stringify(item).includes("original"), false);
  assert.equal(JSON.stringify(item).includes("maskedText"), false);
});

test("keeps the newest twenty history items", () => {
  const storage = createStorage();

  for (let index = 0; index < 21; index += 1) {
    appendAnalysisHistory(createResult(`2026-07-18T00:00:${String(index).padStart(2, "0")}.000Z`), storage, String(index));
  }

  const items = loadAnalysisHistory(storage);
  assert.equal(items.length, 20);
  assert.equal(items[0]?.id, "20");
  assert.equal(items.at(-1)?.id, "1");
});

test("returns an empty list when stored history is malformed", () => {
  const storage = createStorage();
  storage.setItem("ansim-analysis-history.v1", "not-json");

  assert.deepEqual(loadAnalysisHistory(storage), []);
  assert.equal(storage.getItem("ansim-analysis-history.v1"), null);
});

test("removes one item and clears all items", () => {
  const storage = createStorage();
  appendAnalysisHistory(createResult("2026-07-18T00:00:00.000Z"), storage, "first");
  appendAnalysisHistory(createResult("2026-07-18T00:01:00.000Z"), storage, "second");

  removeAnalysisHistory("first", storage);
  assert.deepEqual(loadAnalysisHistory(storage).map((item) => item.id), ["second"]);

  clearAnalysisHistory(storage);
  assert.deepEqual(loadAnalysisHistory(storage), []);
});

test("does not surface unavailable storage errors", () => {
  const unavailableStorage: AnalysisHistoryStorage = {
    getItem: () => {
      throw new Error("unavailable");
    },
    setItem: () => {
      throw new Error("unavailable");
    },
    removeItem: () => {
      throw new Error("unavailable");
    },
  };

  assert.deepEqual(loadAnalysisHistory(unavailableStorage), []);
  assert.doesNotThrow(() => appendAnalysisHistory(createResult("2026-07-18T00:00:00.000Z"), unavailableStorage));
  assert.doesNotThrow(() => removeAnalysisHistory("first", unavailableStorage));
  assert.doesNotThrow(() => clearAnalysisHistory(unavailableStorage));
});
