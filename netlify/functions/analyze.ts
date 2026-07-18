import { analyzeInput } from "../../src/services/analysis";

export default async function analyze(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "POST 요청만 사용할 수 있습니다." }, { status: 405, headers: { Allow: "POST" } });
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "요청 내용을 읽지 못했습니다." }, { status: 400 });
    }
    const outcome = await analyzeInput(body);
    if (outcome.kind === "success") return Response.json(outcome.result);
    if (outcome.kind === "url-unavailable") return Response.json({ urlFetchFailed: true, message: outcome.message }, { status: 422 });
    return Response.json({ error: outcome.message }, { status: 400 });
  } catch {
    return Response.json({ error: "분석 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
