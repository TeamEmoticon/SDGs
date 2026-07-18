import type { MaskResult, MaskedSpan, SensitiveKind } from "./types";

/**
 * Personal-information masking.
 *
 * Detects phone numbers, bank account numbers, verification codes, resident
 * registration numbers (주민등록번호) and card numbers, then replaces the
 * sensitive digits with ● markers while keeping the text readable.
 *
 * Approach: collect every match as a [start, end) range, resolve overlaps by
 * priority, then rebuild the string once so indices never drift.
 */

interface Range {
  start: number;
  end: number;
  kind: SensitiveKind;
  original: string;
}

const CIRCLED = (n: number) => "●".repeat(Math.max(1, n));

/** Replace every digit with ●, keep separators/formatting intact. */
function maskAllDigits(input: string): string {
  return input.replace(/\d/g, "●");
}

/** Keep the last `keep` digits visible, mask the rest of the digits. */
function maskKeepLast(input: string, keep: number): string {
  const digits = input.replace(/\D/g, "");
  const visible = digits.slice(-keep);
  const masked = CIRCLED(Math.max(0, digits.length - keep));
  return `${masked}${visible}`;
}

/** Keep a couple of digits at each end so a real user can still recognize it. */
function maskMiddle(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length <= 4) return CIRCLED(digits.length);
  const head = digits.slice(0, 2);
  const tail = digits.slice(-2);
  const masked = CIRCLED(Math.max(0, digits.length - 4));
  return `${head}${masked}${tail}`;
}

function buildMasked(kind: SensitiveKind, original: string): string {
  switch (kind) {
    case "rrn":
      return maskAllDigits(original);
    case "card":
      return maskKeepLast(original, 4);
    case "phone":
      return maskKeepLast(original, 4);
    case "code":
      return CIRCLED(original.replace(/\D/g, "").length);
    case "account":
      return maskMiddle(original);
  }
}

function toRanges(matches: IterableIterator<RegExpMatchArray>, kind: SensitiveKind): Range[] {
  const out: Range[] = [];
  for (const m of matches) {
    out.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind, original: m[0] });
  }
  return out;
}

/** Verification code: keyword + a nearby 3~8 digit number. */
const CODE_RE =
  /((?:인증번호|인증\s*번호|인증코드|보안코드|인\s*증|OTP|otp|Otp)\s*[:：은는]?\s*)(\d{3,8})/g;

/** Phone numbers (Korean), optionally prefixed with +82. */
const PHONE_RE =
  /(?<!\d)(?:\+82[-.\s]?)?0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g;

/** Resident registration number: 6 digits - 7 digits (first of last 7 is 1-4). */
const RRN_RE = /(?<!\d)\d{6}-[1-4]\d{6}(?!\d)/g;

/** Payment card: four groups of four digits. */
const CARD_RE = /(?<!\d)(?:\d{4}[- ]?){3}\d{4}(?!\d)/g;

/** Long digit run (10-16 digits, separators allowed) used for account context. */
const LONG_NUM_RE = /(?<!\d)\d[\d.\- ]{8,16}\d(?!\d)/g;

const ACCOUNT_HINTS = ["계좌", "입금", "이체", "송금", "가상계좌", "은행", "농협", "국민", "신한", "우리", "하나"];
const CODE_HINTS = ["인증번호", "인증코드", "보안코드", "인증", "OTP", "코드"];

function contextOf(text: string, start: number, end: number): string {
  const a = Math.max(0, start - 14);
  const b = Math.min(text.length, end + 14);
  return text.slice(a, b);
}

export function maskSensitive(raw: string): MaskResult {
  const text = raw.normalize("NFC");
  const counts: Record<SensitiveKind, number> = {
    phone: 0,
    account: 0,
    code: 0,
    rrn: 0,
    card: 0,
  };

  const ranges: Range[] = [];
  ranges.push(...toRanges(text.matchAll(RRN_RE), "rrn"));
  ranges.push(...toRanges(text.matchAll(CARD_RE), "card"));
  ranges.push(...toRanges(text.matchAll(PHONE_RE), "phone"));

  // Verification codes captured via the keyword+digits pattern.
  for (const m of text.matchAll(CODE_RE)) {
    const digitStart = (m.index ?? 0) + m[0].indexOf(m[2]);
    ranges.push({ start: digitStart, end: digitStart + m[2].length, kind: "code", original: m[2] });
  }

  // Account numbers: long digit runs that sit near money/bank keywords.
  for (const m of text.matchAll(LONG_NUM_RE)) {
    const ctx = contextOf(text, m.index ?? 0, (m.index ?? 0) + m[0].length);
    if (!ACCOUNT_HINTS.some((h) => ctx.includes(h))) continue;
    if (CODE_HINTS.some((h) => ctx.includes(h))) continue; // let code rule win
    ranges.push({
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      kind: "account",
      original: m[0].replace(/\s+/g, ""),
    });
  }

  // Resolve overlaps: higher-priority kinds win; ties go to earlier match.
  const priority: Record<SensitiveKind, number> = { rrn: 0, card: 1, phone: 2, code: 3, account: 4 };
  ranges.sort((a, b) => a.start - b.start || priority[a.kind] - priority[b.kind]);

  const accepted: Range[] = [];
  for (const r of ranges) {
    const clash = accepted.find((a) => r.start < a.end && r.end > a.start);
    if (!clash) accepted.push(r);
  }
  accepted.sort((a, b) => a.start - b.start);

  // Rebuild the masked string and collect display spans.
  let out = "";
  let cursor = 0;
  const spans: MaskedSpan[] = [];
  for (const r of accepted) {
    out += text.slice(cursor, r.start);
    const masked = buildMasked(r.kind, r.original);
    out += masked;
    cursor = r.end;
    counts[r.kind] += 1;
    spans.push({ kind: r.kind, original: r.original, masked });
  }
  out += text.slice(cursor);

  return { text: out, maskedCount: spans.length, counts, spans };
}
