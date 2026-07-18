import assert from "node:assert/strict";
import test from "node:test";
import { buildSpeechText } from "../src/lib/buildSpeechText.ts";
import { handleTtsRequest, isPollyConfigured, type SpeechClient } from "../src/services/pollyTts.ts";
import type { AnalysisResult, Signal } from "../src/lib/types.ts";

// ---- 테스트용 결과 객체 --------------------------------------------------

function signal(id: string, detail: string): Signal {
  return { id, category: "money", severity: "critical", label: id, detail, matched: "●●●", weight: 26 };
}

function makeResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    inputType: "text",
    sourceUrl: null,
    maskedText: "인증번호 ●●●●●●을 입력하세요.",
    mask: { maskedCount: 1, counts: { phone: 0, account: 0, code: 1, rrn: 0, card: 0 } },
    signals: [],
    ai: {
      summary: "카드가 정지된다며 링크에서 인증을 요구하는 글입니다.",
      infoType: "사기 의심",
      actions: [],
      riskPhrases: [],
      difficultTerms: [],
      missingInfo: [],
      used: true,
    },
    riskLevel: "critical",
    riskScore: 100,
    recommendation: "돈을 보내거나 인증번호를 알려주지 마세요.",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---- buildSpeechText -----------------------------------------------------

test("위험 단계가 화면과 동일한 한국어 문구로 읽힌다", () => {
  const speech = buildSpeechText(makeResult({ riskLevel: "critical" }));
  assert.ok(speech.includes("보이스피싱 위험이 매우 높습니다"));
  const safe = buildSpeechText(makeResult({ riskLevel: "safe" }));
  assert.ok(safe.includes("뚜렷한 보이스피싱 신호가 적습니다"));
});

test("쉬운 요약을 포함한다", () => {
  const speech = buildSpeechText(makeResult());
  assert.ok(speech.includes("카드가 정지된다며"));
});

test("위험 이유는 최대 3개만 읽는다", () => {
  const speech = buildSpeechText(
    makeResult({
      signals: [
        signal("s1", "첫 번째 위험 이유입니다."),
        signal("s2", "두 번째 위험 이유입니다."),
        signal("s3", "세 번째 위험 이유입니다."),
        signal("s4", "네 번째 위험 이유입니다."),
      ],
    }),
  );
  assert.ok(speech.includes("첫 번째 위험 이유"));
  assert.ok(speech.includes("세 번째 위험 이유"));
  assert.ok(!speech.includes("네 번째 위험 이유"));
});

test("권장 행동은 최대 3개만 읽는다", () => {
  const speech = buildSpeechText(
    makeResult({
      ai: {
        ...makeResult().ai,
        actions: ["링크를 누르지 마세요", "고객센터에 전화하세요", "인증번호를 알려주지 마세요", "네 번째 행동입니다"],
      },
    }),
  );
  assert.ok(speech.includes("고객센터에 전화하세요"));
  assert.ok(!speech.includes("네 번째 행동입니다"));
});

test("actions가 없으면 권장 안내 문장을 읽는다", () => {
  const speech = buildSpeechText(makeResult({ ai: { ...makeResult().ai, actions: [] } }));
  assert.ok(speech.includes("돈을 보내거나 인증번호를 알려주지 마세요"));
});

test("마스킹된 개인정보(●)를 읽지 않는다", () => {
  const speech = buildSpeechText(
    makeResult({ ai: { ...makeResult().ai, summary: "계좌번호 ●●●●●●로 송금하라는 글입니다." } }),
  );
  assert.ok(!speech.includes("●"));
});

test("URL은 전체를 읽지 않고 인터넷 주소로 바꾼다", () => {
  const speech = buildSpeechText(
    makeResult({ ai: { ...makeResult().ai, summary: "http://bad.example.com/login 에서 인증하라는 글입니다." } }),
  );
  assert.ok(!speech.includes("http"));
  assert.ok(!speech.includes("example.com"));
  assert.ok(speech.includes("인터넷 주소"));
});

test("전체 문장은 2,000자 이하다", () => {
  const long = "가".repeat(5_000);
  const speech = buildSpeechText(makeResult({ ai: { ...makeResult().ai, summary: long } }));
  assert.ok(speech.length <= 2_000);
});

test("내용이 비어도 안전한 문구를 반환한다(빈 문자열 아님)", () => {
  const speech = buildSpeechText(
    makeResult({
      signals: [],
      recommendation: "",
      ai: { ...makeResult().ai, summary: "", actions: [] },
    }),
  );
  assert.ok(speech.length > 0);
  // 위험 단계 문구는 항상 남으므로 최소한 그것과 주의 문구가 포함된다.
  assert.ok(speech.includes("안전 여부를 완전히 보장할 수는 없습니다"));
});

// ---- /api/tts 입력 검증 (client 미주입, 자격 증명 없음) --------------------

test("빈 문자열 입력은 400 EMPTY_TEXT", async () => {
  const result = await handleTtsRequest({ text: "" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 400);
  assert.equal(result.code, "EMPTY_TEXT");
});

test("공백만 있는 입력은 400 EMPTY_TEXT", async () => {
  const result = await handleTtsRequest({ text: "    \n\t  " });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "EMPTY_TEXT");
});

test("문자열이 아닌 text는 400 INVALID_REQUEST", async () => {
  const result = await handleTtsRequest({ text: 123 });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 400);
  assert.equal(result.code, "INVALID_REQUEST");
});

test("2,000자 초과는 413 TEXT_TOO_LONG", async () => {
  const result = await handleTtsRequest({ text: "안".repeat(2_001) });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 413);
  assert.equal(result.code, "TEXT_TOO_LONG");
});

test("AWS 키가 없으면 503 TTS_NOT_CONFIGURED (실제 호출 없음)", async () => {
  const savedId = process.env.AWS_ACCESS_KEY_ID;
  const savedSecret = process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  try {
    const result = await handleTtsRequest({ text: "위험 신호가 높습니다." });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 503);
    assert.equal(result.code, "TTS_NOT_CONFIGURED");
  } finally {
    if (savedId !== undefined) process.env.AWS_ACCESS_KEY_ID = savedId;
    if (savedSecret !== undefined) process.env.AWS_SECRET_ACCESS_KEY = savedSecret;
  }
});

// ---- Polly 서비스 (주입된 mock client, 실제 SDK 호출 없음) ------------------

test("recognizes POLLY_AWS credentials", () => {
  const savedId = process.env.POLLY_AWS_ACCESS_KEY_ID;
  const savedSecret = process.env.POLLY_AWS_SECRET_ACCESS_KEY;
  const savedAwsId = process.env.AWS_ACCESS_KEY_ID;
  const savedAwsSecret = process.env.AWS_SECRET_ACCESS_KEY;
  process.env.POLLY_AWS_ACCESS_KEY_ID = "test-polly-access-key";
  process.env.POLLY_AWS_SECRET_ACCESS_KEY = "test-polly-secret-key";
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  try {
    assert.equal(isPollyConfigured(), true);
  } finally {
    if (savedId === undefined) delete process.env.POLLY_AWS_ACCESS_KEY_ID;
    else process.env.POLLY_AWS_ACCESS_KEY_ID = savedId;
    if (savedSecret === undefined) delete process.env.POLLY_AWS_SECRET_ACCESS_KEY;
    else process.env.POLLY_AWS_SECRET_ACCESS_KEY = savedSecret;
    if (savedAwsId === undefined) delete process.env.AWS_ACCESS_KEY_ID;
    else process.env.AWS_ACCESS_KEY_ID = savedAwsId;
    if (savedAwsSecret === undefined) delete process.env.AWS_SECRET_ACCESS_KEY;
    else process.env.AWS_SECRET_ACCESS_KEY = savedAwsSecret;
  }
});

interface CommandLike {
  input: {
    VoiceId?: string;
    Engine?: string;
    OutputFormat?: string;
    TextType?: string;
    Text?: string;
    LanguageCode?: string;
  };
}

class FakeSpeechClient implements SpeechClient {
  calls = 0;
  lastInput: CommandLike["input"] | null = null;
  behavior: (command: CommandLike) => Promise<{ AudioStream?: { transformToByteArray(): Promise<Uint8Array> } }>;
  constructor(behavior: FakeSpeechClient["behavior"]) {
    this.behavior = behavior;
  }
  async send(command: unknown): Promise<{ AudioStream?: { transformToByteArray(): Promise<Uint8Array> } }> {
    this.calls += 1;
    const typed = command as CommandLike;
    this.lastInput = typed.input;
    return this.behavior(typed);
  }
}

const okAudio = { AudioStream: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } };

test("성공 시 SynthesizeSpeechCommand를 정확한 설정으로 1회 호출한다", async () => {
  const client = new FakeSpeechClient(async () => okAudio);
  const result = await handleTtsRequest({ text: "위험 신호가 높습니다." }, { client });
  assert.equal(result.ok, true);
  assert.equal(client.calls, 1);
  assert.equal(client.lastInput?.VoiceId, "Seoyeon");
  assert.equal(client.lastInput?.Engine, "neural");
  assert.equal(client.lastInput?.OutputFormat, "mp3");
  assert.equal(client.lastInput?.TextType, "text");
  assert.equal(client.lastInput?.LanguageCode, "ko-KR");
});

test("AudioStream이 없으면 503 TTS_UNAVAILABLE", async () => {
  const client = new FakeSpeechClient(async () => ({}));
  const result = await handleTtsRequest({ text: "위험 신호가 높습니다." }, { client });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 503);
  assert.equal(result.code, "TTS_UNAVAILABLE");
});

test("권한 오류(AccessDenied)는 503 TTS_PERMISSION_DENIED", async () => {
  const client = new FakeSpeechClient(async () => {
    const error = new Error("no");
    error.name = "AccessDeniedException";
    throw error;
  });
  const result = await handleTtsRequest({ text: "위험 신호가 높습니다." }, { client });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "TTS_PERMISSION_DENIED");
});

test("시간 초과(AbortError)는 504 TTS_TIMEOUT", async () => {
  const client = new FakeSpeechClient(async () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  });
  const result = await handleTtsRequest({ text: "위험 신호가 높습니다." }, { client });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 504);
  assert.equal(result.code, "TTS_TIMEOUT");
});

test("요청 제한(Throttling)은 429 TTS_RATE_LIMITED", async () => {
  const client = new FakeSpeechClient(async () => {
    const error = new Error("slow down");
    error.name = "ThrottlingException";
    throw error;
  });
  const result = await handleTtsRequest({ text: "위험 신호가 높습니다." }, { client });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 429);
  assert.equal(result.code, "TTS_RATE_LIMITED");
});
