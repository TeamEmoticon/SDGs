import { analyzeInput } from "../../src/services/analysis";

function errorBody(code: string, message: string): Record<string, unknown> {
  const body: Record<string, unknown> = { error: { code, message } };
  if (code === "URL_UNREADABLE") {
    body.urlFetchFailed = true;
    body.message = message;
  }
  return body;
}

export default async function analyze(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(errorBody("METHOD_NOT_ALLOWED", "POST 요청만 사용할 수 있습니다."), {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(errorBody("INVALID_REQUEST", "요청 내용을 읽지 못했습니다."), { status: 400 });
  }

  try {
    const outcome = await analyzeInput(body);
    if (outcome.kind === "success") return Response.json(outcome.result);
    return Response.json(errorBody(outcome.code, outcome.message), { status: outcome.status });
  } catch {
    return Response.json(errorBody("INTERNAL_ERROR", "분석 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."), {
      status: 500,
    });
  }
}
