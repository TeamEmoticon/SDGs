# Amazon Polly 결과 읽기 — Codex 이월 문서

> 대상: 다음 작업자(Codex). 브랜치 `feat/amazon-polly-tts`, 커밋 `90e595c`.
> 이 기능은 "긴급 Phase — Amazon Polly 결과 읽기"의 최소 기능 구현이다. 4A/4B의 분석·오류 계약 패턴을 그대로 따랐다(새 구조를 늘리지 않음).

## 1. 지금까지 구현된 것 (동작 확인됨)

분석 결과 화면에 **[결과 소리로 듣기]** 버튼이 있고, 결과의 핵심만 Amazon Polly로 읽어준다.

- **읽는 내용**: 위험 단계(화면과 동일 문구) → 쉬운 요약 → 위험 이유 ≤3 → 지금 할 일 ≤3 → 안전 미보장 주의문구. 원문·마스킹(●)·점수·코드명·전체 URL은 읽지 않고, URL은 "인터넷 주소"로 바꾼다. 최대 2,000자.
- **흐름**: 클라이언트가 `buildSpeechText(result)`로 문장을 만들어 `POST /api/tts {text}` → 서버가 Polly로 MP3 합성 → 브라우저가 Blob으로 즉시 재생.
- **재생/캐시**: 같은 결과를 다시 들을 때는 생성된 Blob을 재사용(Polly 재호출 없음). 새 결과가 오면 `ResultView`가 `key={result.createdAt}`로 버튼을 재마운트해 오디오·object URL·캐시를 정리한다.
- **키 없어도 안전**: `GEMINI_API_KEY`처럼 AWS 키가 없으면 버튼은 503 폴백("음성 다시 시도" + 친절한 안내)만 보이고, 분석·결과·기록 화면은 정상 유지된다. (브라우저로 실검증 완료.)

### 파일 지도
| 파일 | 역할 |
|---|---|
| [src/lib/buildSpeechText.ts](../src/lib/buildSpeechText.ts) | 결과 → 음성 문장(순수 함수). `LEVEL_STORY`를 [ui-config.ts](../src/lib/ui-config.ts)에서 공유(화면과 문구 일치) |
| [src/services/pollyTts.ts](../src/services/pollyTts.ts) | Polly 호출·검증·오류 매핑. `handleTtsRequest`(공통 코어) + `synthesizeSpeech`(주입 가능 client) |
| [src/app/api/tts/route.ts](../src/app/api/tts/route.ts) · [netlify/functions/tts.ts](../netlify/functions/tts.ts) | 얇은 어댑터(둘 다 `handleTtsRequest`만 호출). Netlify는 `config.path="/api/tts"` + netlify.toml 리다이렉트 |
| [src/components/ResultSpeechButton.tsx](../src/components/ResultSpeechButton.tsx) | 재생·중지·재사용·오류·접근성 상태 UI |
| [tests/tts.test.ts](../tests/tts.test.ts) | 19개(네트워크 0회): buildSpeechText·입력검증·Polly mock(명령 설정·AudioStream 없음·AccessDenied·Timeout·Throttling) |

### 오류 계약
400 `INVALID_REQUEST`/`EMPTY_TEXT` · 413 `TEXT_TOO_LONG` · 405 `METHOD_NOT_ALLOWED` · 503 `TTS_NOT_CONFIGURED`/`TTS_PERMISSION_DENIED`/`TTS_UNAVAILABLE` · 429 `TTS_RATE_LIMITED` · 504 `TTS_TIMEOUT` · 500 `INTERNAL_ERROR`. 성공은 `audio/mpeg` + `Cache-Control: private, no-store`.

## 2. 아직 안 한 것 / Codex가 이어서 할 것

### 2-1. 실제 AWS 키 smoke test (완료 조건상 반드시 필요, 최우선)
지금까지는 **키 없는 경로만** 검증했다. 실제 자격 증명으로 아래를 1회 확인해야 "완전 검증"으로 볼 수 있다.

> **환경변수 이름 주의**: 반드시 `POLLY_AWS_ACCESS_KEY_ID` / `POLLY_AWS_SECRET_ACCESS_KEY`를 쓴다.
> `AWS_*` 이름은 Netlify Functions(AWS Lambda)가 **자체 자격 증명을 자동 주입하는 예약 이름**이라
> 사용자가 설정할 수 없고, 코드도 읽지 않는다(과거 이 이름을 썼다가 Lambda 키가 섞여 API 오류가 났다).

1. `project/.env.local`에 `POLLY_AWS_ACCESS_KEY_ID` / `POLLY_AWS_SECRET_ACCESS_KEY`(SynthesizeSpeech 권한만) 입력. 키 값은 출력하지 않는다.
2. `npm run dev` → 사기 예시 분석 → [결과 소리로 듣기] 클릭.
   - 확인: 한국어 발음, MP3 재생, 중지 동작, **다시 듣기 시 `/api/tts` 재호출 없음**(네트워크 탭), 새 분석 시 새 음성 생성, 모바일 Chrome 재생, 최근 기록에서 연 결과 재생.
3. IAM 정책은 `polly:SynthesizeSpeech`만(폭넓은 권한 금지).
4. Netlify에는 같은 키를 **Functions 런타임 secret 환경변수**로만, `POLLY_AWS_*` 이름으로 등록(netlify.toml·저장소 금지). `.env.example`에는 이름만 있다.
5. 확인 후 테스트 키는 회전/폐기.

> 참고: `pollyTts.ts`의 오류 매핑(`httpStatusToFailure` 대응부 `mapAwsError`)은 AWS 오류명/`$metadata.httpStatusCode` 추정에 기반한다. 실제 응답으로 AccessDenied·Throttling·Timeout 매핑이 기대대로인지 확인하면 좋다.

### 2-2. 이번 범위에서 의도적으로 제외한 것(요청 시 별도 Phase)
S3·DB 저장, 음성 영구 저장, 실시간 스트리밍, SSML/발음사전, 음성/속도/높낮이 선택 UI, 여러 음성 비교, 긴 글 비동기 합성, Generative 엔진, 원문 전체 읽기.

### 2-3. 선택 개선 후보(실측 후 판단)
- **브라우저 `speechSynthesis` 폴백**: 현재 기존 브라우저 TTS가 없어 추가하지 않았다(프롬프트 19장: "기존 기능이 없으면 이번 1시간 작업에서 새 폴백까지 추가하지 않는다"). 폴백을 넣는다면 조건은 `TTS_NOT_CONFIGURED`/`TTS_UNAVAILABLE`/`TTS_TIMEOUT`일 때만, Polly와 동시 재생 금지.
- **위험 이유 소스**: 지금은 `signal.detail`의 첫 문장을 읽는다. AI 요약이 더 자연스러운 경우 `ai.riskPhrases`나 별도 요약을 쓸지 검토 가능(원문 인용은 ● 마스킹·URL 처리 유지 필수).

## 3. 유지해야 할 불변식 (건드릴 때 주의)
- **키·자격 증명·읽을 텍스트 원문을 로그·응답에 남기지 않는다.** 오류 로그는 안전한 코드명만(`pollyTts.ts`의 `console.error(\`[tts] ... ${code}\`)`).
- 분석 1건당 Polly 호출은 최대 1회. 같은 결과 재생은 Blob 재사용.
- `node --test`로 실행 → 로컬 value import는 `.ts` 확장자, 파라미터 프로퍼티·enum 금지(strip 모드). 실제 AWS 호출은 테스트에서 하지 않고 `deps.client` 주입으로 검증.
- CSP는 오디오 재생을 위해 `media-src 'self' blob:`가 필요하다([next.config.ts](../next.config.ts)). 지우지 말 것.
- 새 결과 초기화는 effect 안 `setState`가 아니라 `key` 재마운트로 처리한다(`react-hooks/set-state-in-effect` 회피).

## 4. 검증 명령
```
npm run lint && npm run typecheck && npm run build && npm test
```
현재 전부 통과(lint 0 · typecheck 0 · build 성공 · test 115/115). 실제 키 smoke는 위 2-1 참조.
