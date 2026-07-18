/**
 * Lightweight URL content fetcher.
 *
 * Fetches a web page server-side and extracts readable Korean text without any
 * extra dependencies (no cheerio). If the page can't be read — blocked host,
 * timeout, paywall, non-HTML — the caller falls back to asking the user to paste
 * the text directly, exactly as described in the product flow.
 */

export interface FetchResult {
  ok: boolean;
  title?: string;
  text?: string;
  finalUrl?: string;
  error?: string;
}

function stripHtml(html: string): { title: string; text: string } {
  let title = "";
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) title = decode(titleMatch[1]).slice(0, 200);

  const metaDesc = html.match(
    /<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["']/i,
  );

  // Drop non-content blocks entirely.
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Prefer article/main content when present.
  const main = body.match(/<(?:article|main)[\s\S]*?<\/(?:article|main)>/i);
  if (main) body = main[0];

  // Turn block-level tags into line breaks so paragraphs survive.
  body = body
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  const lines = body
    .split("\n")
    .map((l) => decode(l).replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 3);

  // De-duplicate while preserving order.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const l of lines) {
    if (seen.has(l)) continue;
    seen.add(l);
    unique.push(l);
  }

  let text = unique.join("\n").slice(0, 6000);
  if (text.trim().length < 30 && metaDesc) {
    text = decode(metaDesc[1]).trim();
  }
  return { title, text };
}

function decode(s: string): string {
  try {
    return s
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  } catch {
    return s;
  }
}

export async function fetchUrlContent(rawUrl: string): Promise<FetchResult> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    return { ok: false, error: "invalid_url" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
      },
    });

    if (!res.ok) return { ok: false, error: `status_${res.status}`, finalUrl: res.url };
    const contentType = res.headers.get("content-type") || "";
    if (!/text\/(html|plain)/i.test(contentType)) {
      return { ok: false, error: "not_readable", finalUrl: res.url };
    }

    const html = await res.text();
    const { title, text } = stripHtml(html);
    if (!text || text.trim().length < 20) {
      return { ok: false, error: "too_short", finalUrl: res.url };
    }
    return { ok: true, title, text, finalUrl: res.url || url };
  } catch {
    return { ok: false, error: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}
