const INVISIBLE_OR_DIRECTIONAL = /[\u200B-\u200D\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/g;

export function normalizeAnalysisText(value: string): string {
  return value.normalize("NFKC").replace(INVISIBLE_OR_DIRECTIONAL, "");
}
