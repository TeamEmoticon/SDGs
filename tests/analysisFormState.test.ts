import assert from "node:assert/strict";
import test from "node:test";
import { canAnalyzeForm, createEmptyAnalysisFormState, getAnalysisContent } from "../src/components/analysisFormState.ts";

test("creates an empty text form when starting another analysis", () => {
  const form = createEmptyAnalysisFormState();

  assert.deepEqual(form, {
    mode: "text",
    text: "",
    url: "",
    error: null,
    urlNote: null,
  });
});

test("does not allow an empty or whitespace-only value to be analyzed", () => {
  assert.equal(canAnalyzeForm("text", "          ", ""), false);
  assert.equal(canAnalyzeForm("url", "", "          "), false);
  assert.equal(getAnalysisContent("text", "  안전한 안내문  ", ""), "안전한 안내문");
});
