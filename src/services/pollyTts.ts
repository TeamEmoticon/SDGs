// pollyTts.ts
// Amazon Polly 음성 합성 서비스 + /api/tts 공통 처리(검증·오케스트레이션).
// AWS 호출 로직을 라우트에서 분리해 여기에 둔다. 테스트에서는 client를 주입한다(실제 네트워크 없음).
// 보안: API 키·자격 증명·읽을 텍스트 원문을 로그·응답에 남기지 않는다.

import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

const MAX_TEXT_LENGTH = 2_000;
const TIMEOUT_MS = 10_000;
const DEFAULT_REGION = "ap-northeast-2";
const DEFAULT_VOICE = "Seoyeon";
const DEFAULT_ENGINE = "neural";

export interface TtsSuccess {
  readonly ok: true;
  readonly audio: Uint8Array;
}
export interface TtsFailure {
  readonly ok: false;
  readonly status: number;
  readonly code: string;
  readonly message: string;
}
export type TtsResult = TtsSuccess | TtsFailure;

/** 주입 가능한 최소 클라이언트 인터페이스(테스트용 fake를 받기 위함). */
export interface SpeechClient {
  send(
    command: SynthesizeSpeechCommand,
    options?: { abortSignal?: AbortSignal },
  ): Promise<{ AudioStream?: { transformToByteArray(): Promise<Uint8Array> } }>;
}

export interface SynthesizeDeps {
  readonly client?: SpeechClient;
}

function fail(status: number, code: string, message: string): TtsFailure {
  return { ok: false, status, code, message };
}

/** AWS 자격 증명 환경변수가 있는지(값은 확인만, 노출하지 않음). */
export function isPollyConfigured(): boolean {
  return Boolean(getPollyAccessKeyId() && getPollySecretAccessKey());
}

function getPollyAccessKeyId(): string | undefined {
  return process.env.POLLY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
}

function getPollySecretAccessKey(): string | undefined {
  return process.env.POLLY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
}

function getPollyRegion(): string {
  return process.env.POLLY_AWS_REGION || process.env.AWS_REGION || DEFAULT_REGION;
}

function createPollyClient(): SpeechClient {
  const accessKeyId = getPollyAccessKeyId();
  const secretAccessKey = getPollySecretAccessKey();
  const sessionToken = process.env.POLLY_AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;
  const region = getPollyRegion();

  if (accessKeyId && secretAccessKey) {
    return new PollyClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      },
    }) as unknown as SpeechClient;
  }

  return new PollyClient({ region }) as unknown as SpeechClient;
}

/** 서버에서 다시 한 번 공백·제어문자를 정리한다(클라이언트 검증만 믿지 않는다). */
export function sanitizeServerText(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapAwsError(error: unknown): TtsFailure {
  const name = error instanceof Error ? error.name : "";
  const httpStatus =
    typeof error === "object" && error !== null
      ? ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ?? 0)
      : 0;

  if (name === "AbortError" || name === "TimeoutError") {
    return fail(504, "TTS_TIMEOUT", "음성을 만드는 데 시간이 오래 걸리고 있습니다. 다시 시도해 주세요.");
  }
  if (
    httpStatus === 403 ||
    /AccessDenied|NotAuthorized|UnrecognizedClient|InvalidSignature|ExpiredToken|InvalidClientTokenId/i.test(name)
  ) {
    return fail(503, "TTS_PERMISSION_DENIED", "현재 음성 읽기 기능에 연결할 수 없습니다.");
  }
  if (httpStatus === 429 || /Throttl|TooManyRequests|LimitExceeded/i.test(name)) {
    return fail(429, "TTS_RATE_LIMITED", "현재 음성 요청이 많습니다. 잠시 후 다시 눌러 주세요.");
  }
  return fail(503, "TTS_UNAVAILABLE", "현재 음성 읽기 기능을 사용할 수 없습니다. 화면의 글을 확인해 주세요.");
}

/**
 * 텍스트를 Amazon Polly로 합성해 MP3 바이트를 반환한다.
 * 자격 증명 확인은 handleTtsRequest에서 하며, 여기서는 client가 있으면 그대로 사용한다.
 */
export async function synthesizeSpeech(text: string, deps: SynthesizeDeps = {}): Promise<TtsResult> {
  const client = deps.client ?? createPollyClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const command = new SynthesizeSpeechCommand({
    OutputFormat: "mp3",
    TextType: "text",
    Text: text,
    VoiceId: (process.env.POLLY_VOICE_ID || DEFAULT_VOICE) as SynthesizeSpeechCommand["input"]["VoiceId"],
    Engine: (process.env.POLLY_ENGINE || DEFAULT_ENGINE) as SynthesizeSpeechCommand["input"]["Engine"],
    LanguageCode: "ko-KR",
  });

  try {
    const response = await client.send(command, { abortSignal: controller.signal });
    if (!response.AudioStream) {
      return fail(503, "TTS_UNAVAILABLE", "현재 음성 읽기 기능을 사용할 수 없습니다. 화면의 글을 확인해 주세요.");
    }
    const audio = await response.AudioStream.transformToByteArray();
    if (!audio || audio.length === 0) {
      return fail(503, "TTS_UNAVAILABLE", "현재 음성 읽기 기능을 사용할 수 없습니다. 화면의 글을 확인해 주세요.");
    }
    return { ok: true, audio };
  } catch (error) {
    // 로그에는 오류명과 안전한 코드만 남긴다(자격 증명·텍스트 원문은 남기지 않는다).
    const outcome = mapAwsError(error);
    console.error(`[tts] synthesize failed: ${outcome.code}`);
    return outcome;
  } finally {
    clearTimeout(timer);
  }
}

/** /api/tts 공통 처리: 입력 검증 → 설정 확인 → 합성. Route/Netlify 어댑터가 이 함수만 호출한다. */
export async function handleTtsRequest(body: unknown, deps: SynthesizeDeps = {}): Promise<TtsResult> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail(400, "INVALID_REQUEST", "요청 형식을 확인해 주세요.");
  }
  const text = Reflect.get(body, "text");
  if (typeof text !== "string") {
    return fail(400, "INVALID_REQUEST", "읽을 내용을 확인해 주세요.");
  }
  const cleaned = sanitizeServerText(text);
  if (cleaned.length === 0) {
    return fail(400, "EMPTY_TEXT", "읽을 내용이 없습니다.");
  }
  if (cleaned.length > MAX_TEXT_LENGTH) {
    return fail(413, "TEXT_TOO_LONG", "읽을 내용이 너무 깁니다.");
  }
  if (deps.client === undefined && !isPollyConfigured()) {
    return fail(503, "TTS_NOT_CONFIGURED", "현재 음성 읽기 기능을 사용할 수 없습니다. 화면의 글을 확인해 주세요.");
  }
  return synthesizeSpeech(cleaned, deps);
}

/** MP3 바이트를 HTTP 응답 본문(ArrayBuffer)으로 변환한다(어댑터 공용). */
export function toAudioBody(audio: Uint8Array): ArrayBuffer {
  return audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer;
}

export { MAX_TEXT_LENGTH };
