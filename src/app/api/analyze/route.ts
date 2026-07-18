import { NextResponse } from "next/server";
import { db } from "@/db";
import { analyses } from "@/db/schema";
import { maskSensitive } from "@/lib/masking";
import { detectSignals } from "@/lib/rules";
import { analyzeWithGroq } from "@/lib/groq";
import { calculateRisk, deriveFallback } from "@/lib/risk";
import { fetchUrlContent } from "@/lib/url";
import type { AnalysisResult, InputType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_FETCH_FAILED =
  "이 페이지의 글을 불러오지 못했습니다. 로그인이 필요하거나 긁어오기를 막아둔 페이지일 수 있어요. 내용을 복사해서 아래 칸에 붙여넣어 주세요.";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      type?: string;
      content?: string;
    };
    const type: InputType = body.type === "url" ? "url" : "text";
    let raw = typeof body.content === "string" ? body.content : "";
    let sourceUrl: string | null = null;

    if (type === "url") {
      const url = raw.trim();
      if (!url) {
        return NextResponse.json({ error: "인터넷 주소를 입력해 주세요." }, { status: 400 });
      }
      const fetched = await fetchUrlContent(url);
      if (!fetched.ok || !fetched.text) {
        return NextResponse.json(
          { urlFetchFailed: true, message: URL_FETCH_FAILED },
          { status: 422 },
        );
      }
      raw = (fetched.title ? `${fetched.title}\n` : "") + fetched.text;
      sourceUrl = fetched.finalUrl || url;
    } else {
      if (raw.trim().length < 2) {
        return NextResponse.json(
          { error: "확인할 문자나 글을 붙여넣어 주세요." },
          { status: 400 },
        );
      }
    }

    // Step 1 — mask personal information.
    const mask = maskSensitive(raw.slice(0, 8000));
    // Step 2 — rule-based risk signals (run on the masked text).
    const signals = detectSignals(mask.text);
    // Step 3 — Groq summary / classification / candidate phrases.
    const groqRaw = await analyzeWithGroq(mask.text);
    const groq = deriveFallback(groqRaw, signals);
    // Step 4 — final risk level (computed in code).
    const verdict = calculateRisk(signals, groq);

    const row = {
      inputType: type,
      sourceUrl,
      maskedText: mask.text,
      riskLevel: verdict.level,
      riskScore: verdict.score,
      infoType: groq.infoType || null,
      summary: groq.summary || null,
      riskPhrases: groq.riskPhrases,
      signals,
      groqUsed: groq.used,
    };

    let id: number | null = null;
    try {
      const [inserted] = await db.insert(analyses).values(row).returning({ id: analyses.id });
      id = inserted?.id ?? null;
    } catch {
      // Storing is best-effort; never fail the response because of the DB.
    }

    const result: AnalysisResult = {
      id,
      inputType: type,
      sourceUrl,
      maskedText: mask.text,
      mask,
      signals,
      groq,
      riskLevel: verdict.level,
      riskScore: verdict.score,
      recommendation: verdict.recommendation,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "분석 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
