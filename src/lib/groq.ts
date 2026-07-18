import type { GroqResult } from "./types";

/**
 * Groq integration.
 *
 * Calls the OpenAI-compatible Groq chat endpoint (llama-3.3-70b-versatile) with
 * JSON mode to produce three things:
 *   1. an easy-language summary of what the message is about,
 *   2. a classification of the message type,
 *   3. suspicious candidate phrases (verbatim) for the risk calculation.
 *
 * Everything degrades gracefully: if GROQ_API_KEY is missing or the request
 * fails, the rest of the pipeline still runs on rules alone.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `당신은 어르신과 디지털 소외계층을 돕는 "쉬운 말 안전 도우미"입니다.
사용자가 보낸 문자/인터넷 글을 분석해 다음 세 가지를 알려주세요.

1. summary: 누구나 이해할 수 있는 쉬운 말로 1~2문장으로 요약. 전문용어와 어려운 표현은 빼고, 핵심만. 사용자에게 지시하거나 조언하지 말고 중립적으로 설명.
2. infoType: 이 글이 어떤 종류인지 다음 중 정확히 하나를 골라 그대로 적을 것.
   - "일반 안내" / "공공·관공서 안내" / "금융·공과금 알림" / "택배·배송 알림" / "광고·마케팅" / "당첨·이벤트" / "개인 연락" / "사기·피싱 의심"
3. riskPhrases: 사기나 위험으로 의심되는 구절을 원문 그대로 최대 5개까지 배열로. 의심 부분이 없으면 빈 배열.

반드시 아래 JSON 형식으로만 답할 것. 다른 설명, 인사, 마크다운 금지.
{"summary":"...","infoType":"...","riskPhrases":["...","..."]}
주의: 주어진 글에 있는 내용만 사용하고, 없는 사실을 지어내지 말 것.`;

const EMPTY: GroqResult = { summary: "", infoType: "", riskPhrases: [], used: false };

function coerceInfoType(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  return v.length > 40 ? v.slice(0, 40) : v;
}

function coercePhrases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 6);
}

export async function analyzeWithGroq(text: string): Promise<GroqResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return EMPTY;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text.slice(0, 6000) },
        ],
      }),
    });

    if (!res.ok) return EMPTY;

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return EMPTY;

    let parsed: { summary?: unknown; infoType?: unknown; riskPhrases?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      // Fallback: try to locate a JSON object in the response.
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return EMPTY;
      parsed = JSON.parse(match[0]);
    }

    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    return {
      summary,
      infoType: coerceInfoType(parsed.infoType),
      riskPhrases: coercePhrases(parsed.riskPhrases),
      used: true,
    };
  } catch {
    return EMPTY;
  } finally {
    clearTimeout(timer);
  }
}
