import { handleTtsRequest, toAudioBody } from "../../src/services/pollyTts";

export const config = {
  path: "/api/tts",
  rateLimit: {
    windowLimit: 20,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
} as const;

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export default async function tts(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      { error: { code: "METHOD_NOT_ALLOWED", message: "POST 요청만 사용할 수 있습니다." } },
      { status: 405, headers: { Allow: "POST" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_REQUEST", "요청 내용을 읽지 못했습니다.");
  }

  try {
    const result = await handleTtsRequest(body);
    if (result.ok) {
      return new Response(toAudioBody(result.audio), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "private, no-store",
        },
      });
    }
    return errorResponse(result.status, result.code, result.message);
  } catch {
    return errorResponse(500, "INTERNAL_ERROR", "음성을 만드는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
  }
}
