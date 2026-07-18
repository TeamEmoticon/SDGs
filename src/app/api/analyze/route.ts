import { NextResponse } from "next/server";
import { analyzeInput } from "@/services/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorBody(code: string, message: string): Record<string, unknown> {
  const body: Record<string, unknown> = { error: { code, message } };
  // 클라이언트가 URL 읽기 실패를 감지해 붙여넣기 모드로 전환할 수 있게 플래그를 유지한다.
  if (code === "URL_UNREADABLE") {
    body.urlFetchFailed = true;
    body.message = message;
  }
  return body;
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
