import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import nextConfig from "../next.config.ts";

test("sets browser security headers for every application route", async () => {
  const headerRules = await nextConfig.headers?.();

  if (headerRules === undefined) throw new Error("Security header rules are missing.");
  const appRule = headerRules.find((rule) => rule.source === "/:path*");
  if (appRule === undefined) throw new Error("Application security header rule is missing.");

  const values = new Map(appRule.headers.map((header) => [header.key, header.value]));
  assert.match(values.get("Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(values.get("X-Frame-Options"), "DENY");
  assert.equal(values.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(values.get("Permissions-Policy"), "camera=(), microphone=(), geolocation=()");
});

test("limits the public analysis function by client IP", async () => {
  const source = await readFile(new URL("../netlify/functions/analyze.ts", import.meta.url), "utf8");

  assert.match(source, /path:\s*"\/api\/analyze"/);
  assert.match(source, /windowLimit:\s*8/);
  assert.match(source, /windowSize:\s*60/);
  assert.match(source, /aggregateBy:\s*\["ip", "domain"\]/);
});
