import type { InputType } from "@/lib/types";

export interface AnalysisFormState {
  readonly mode: InputType;
  readonly text: string;
  readonly url: string;
  readonly error: string | null;
  readonly urlNote: string | null;
}

export function createEmptyAnalysisFormState(): AnalysisFormState {
  return {
    mode: "text",
    text: "",
    url: "",
    error: null,
    urlNote: null,
  };
}

export function getAnalysisContent(mode: InputType, text: string, url: string): string {
  return (mode === "text" ? text : url).trim();
}

export function canAnalyzeForm(mode: InputType, text: string, url: string): boolean {
  const minimumLength = mode === "text" ? 10 : 8;
  return getAnalysisContent(mode, text, url).length >= minimumLength;
}
