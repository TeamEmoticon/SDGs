import { RULES, SEVERITY_WEIGHT } from "./ruleDefinitions.ts";
import type { RuleDef, Signal } from "./types.ts";

const CONTEXT_SENSITIVE_RULE_IDS = new Set(["link-install", "money-transfer", "pinfo-secrets", "remote-control"]);
const SAFETY_ADVISORY =
  /(?:인증번호|비밀번호|otp|보안카드).{0,30}(?:누구에게도|타인에게|직원도).{0,20}(?:알려주지|요구하지).{0,12}(?:마세요|않습니다)|(?:원격제어|화면 공유|앱 설치).{0,30}(?:절대\s*)?요구하지\s?않습니다|(?:사기|피싱)\s?예방.{0,80}(?:송금|계좌이체|입금).{0,40}(?:112|1332|신고)/i;

function snippet(text: string, start: number, length: number): string {
  const a = Math.max(0, start - 6);
  const b = Math.min(text.length, start + length + 12);
  const part = text.slice(a, b).replace(/\s+/g, " ").trim();
  return `${a > 0 ? "…" : ""}${part}${b < text.length ? "…" : ""}`;
}

function context(text: string, start: number, length: number): string {
  return text.slice(Math.max(0, start - 48), Math.min(text.length, start + length + 64));
}

function findMatch(rule: RuleDef, text: string, lower: string): { readonly value: string; readonly at: number } | null {
  for (const regex of rule.regex ?? []) {
    const match = regex.exec(text);
    if (match?.index !== undefined) return { value: match[0], at: match.index };
  }
  for (const keyword of rule.keywords ?? []) {
    const at = lower.indexOf(keyword.toLowerCase());
    if (at >= 0) return { value: keyword, at };
  }
  return null;
}

function isMoneyTransferRequest(matched: string, nearbyText: string): boolean {
  if (!/^(보내|부쳐)/.test(matched)) return true;
  return /(?:돈|금액|\d[\d,]*\s*원|계좌로).{0,20}(?:보내|부쳐)|(?:보내|부쳐).{0,20}(?:돈|금액|\d[\d,]*\s*원|계좌로)/.test(nearbyText);
}

function shouldKeepMatch(rule: RuleDef, matched: string, nearbyText: string): boolean {
  if (CONTEXT_SENSITIVE_RULE_IDS.has(rule.id) && SAFETY_ADVISORY.test(nearbyText)) return false;
  if (rule.id === "money-transfer") return isMoneyTransferRequest(matched, nearbyText);
  return true;
}

export function detectSignals(raw: string): Signal[] {
  const text = raw.normalize("NFC");
  const lower = text.toLowerCase();
  const signals: Signal[] = [];

  for (const rule of RULES) {
    const match = findMatch(rule, text, lower);
    if (match === null) continue;
    const nearbyText = context(text, match.at, match.value.length);
    if (!shouldKeepMatch(rule, match.value, nearbyText)) continue;
    signals.push({
      id: rule.id,
      category: rule.category,
      severity: rule.severity,
      label: rule.label,
      detail: rule.detail,
      matched: snippet(text, match.at, match.value.length),
      weight: SEVERITY_WEIGHT[rule.severity],
    });
  }

  return signals;
}

export { RULES, SEVERITY_WEIGHT };
