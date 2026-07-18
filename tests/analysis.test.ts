import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("removes the legacy database and Groq dependencies", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

  assert.equal(dependencies["drizzle-orm"], undefined);
  assert.equal(dependencies.pg, undefined);
  assert.equal(dependencies["groq-sdk"], undefined);
});

test("routes analysis requests to the Netlify function", () => {
  const netlifyConfig = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");

  assert.match(netlifyConfig, /from = "\/api\/analyze"/);
  assert.match(netlifyConfig, /to = "\/.netlify\/functions\/analyze"/);
});
