import { NextResponse } from "next/server";
import { analyzeInput } from "@/services/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "요청 내용을 읽지 못했습니다." }, { status: 400 });
    }
    const outcome = await analyzeInput(body);
    if (outcome.kind === "success") return NextResponse.json(outcome.result);
    if (outcome.kind === "url-unavailable") return NextResponse.json({ urlFetchFailed: true, message: outcome.message }, { status: 422 });
    return NextResponse.json({ error: outcome.message }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "분석 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
