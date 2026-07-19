import { NextResponse } from "next/server";
import { analyzeInput } from "@/services/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorBody(code: string, message: string): Record<string, unknown> {
  return { error: { code, message } };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorBody("INVALID_REQUEST", "요청 내용을 읽지 못했습니다."), { status: 400 });
  }

  try {
    const outcome = await analyzeInput(body);
    if (outcome.kind === "success") return NextResponse.json(outcome.result);
    return NextResponse.json(errorBody(outcome.code, outcome.message), { status: outcome.status });
  } catch {
    return NextResponse.json(errorBody("INTERNAL_ERROR", "분석 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."), {
      status: 500,
    });
  }
}
