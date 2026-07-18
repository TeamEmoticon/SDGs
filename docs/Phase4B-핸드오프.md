# Phase 4B 핸드오프 — 실제 Gemini 연결(요약·Grounding·URL Context)

> 대상: 다음 작업자(Codex).
> Phase 4A(적응형 라우터·provider 경계·오류 계약·점수 상한)는 브랜치 `feat/adaptive-analysis-router`, 커밋 `63712a4`에 완료되어 있다.
> 4B의 목표는 **키를 넣고 실제 Gemini 호출을 켜는 것**이며, 4A가 만든 계약·경계는 그대로 재사용한다(새 오케스트레이션·타입 중복 생성 금지).

---

## 1. 지금 상태(4A가 보장하는 것)

- **라우터** [src/lib/routing.ts](../src/lib/routing.ts): `chooseAnalysisMode(signals, text)` → `RULE_ONLY | AI_SUMMARY | GROUNDED_FACT_CHECK` + 이유 코드.
- **provider 경계** [src/services/provider.ts](../src/services/provider.ts): `AnalysisProvider { summarize, factCheck }`. `createDefaultProvider()`는 `GEMINI_API_KEY`가 있으면 Gemini provider, 없으면 `null`.
- **오케스트레이션** [src/services/analysis.ts](../src/services/analysis.ts) `analyzeInput(value, provider?)`: 검증 → 마스킹 → 규칙 → 라우팅 → provider 최대 1회 → AI 검증 → 점수. Route/Netlify 어댑터는 이 함수만 호출.
- **실행 계약**: 결과에 `execution {plannedMode, executedMode, aiStatus, fallbackUsed, routingReasons}`와 `warnings[]`.
- **오류 계약**: 요청 오류만 HTTP 오류(`{error:{code,message}}`), AI 오류는 규칙 결과가 있으면 HTTP 200 + `aiStatus` + `warnings`.
- **점수 안전장치** [src/lib/risk.ts](../src/lib/risk.ts): AI 보조 총합 ≤10점, AI 단독으로 danger/critical 불가, 규칙 critical floor 유지.
- **테스트**: 네트워크 0회로 45개 통과. Gemini 실제 호출은 아직 없음.

## 2. 4B에서 할 일(우선순위)

### 2-1. 실제 Gemini 요약 켜기 (AI_SUMMARY)
- 이미 구현됨: [src/services/gemini.ts](../src/services/gemini.ts) `requestGeminiAnalysis`가 키가 있을 때 `gemini-3.1-flash-lite`를 호출한다. `provider.summarize`가 이를 감싼다.
- **할 일**: Netlify UI에 `GEMINI_API_KEY` 설정 후 실제 응답으로 파서·스키마 검증. 응답 실패 매핑(`httpStatusToFailure`, timeout=AbortError)이 실제 상태와 맞는지 확인.

### 2-2. Grounded fact-check 구현 (GROUNDED_FACT_CHECK) — 핵심 신규 작업
- **현재는 스텁**: `provider.factCheck`가 grounding 없이 `summarize`로 위임한다([provider.ts](../src/services/provider.ts)의 주석 참조). 이유: 4A는 grounding 미실행 원칙.
- **할 일**: Google Search Grounding을 실제 실행하는 경로를 `gemini.ts`에 추가(`tools:[{google_search:{}}]` + 구조화 출력 병용). 필요하면 `GroundedAnalysis` 타입을 신설(요약과 별개로 근거·출처 포함). `factCheck`가 그 경로를 쓰도록 교체. **분석 1건당 호출 1회** 계약 유지.

### 2-3. URL Context 실제 실행 (URL 입력)
- 이미 배선됨: `gemini.ts`가 url source에 `tools:[{url_context:{}}]`를 넣고, `hasReadableUrlContext`로 읽기 성공을 판정한다. `analyzeUrl`([analysis.ts](../src/services/analysis.ts))이 `provider.summarize({kind:"url"})`를 호출한다.
- **할 일**: 실제 키로 URL Context 성공/실패(422 `URL_UNREADABLE`)를 검증. 도메인 경고([domain.ts](../src/lib/domain.ts))를 결과 `warnings`에 더 풍부하게 반영할지 결정.

### 2-4. 비밀 관리
- `GEMINI_API_KEY`는 **Netlify 런타임 환경변수로만** 설정하고 `netlify.toml`·저장소·클라이언트 번들에 넣지 않는다. `.env.example`에는 이름만.

### 2-5. (선택) AI signal code 모델
- 4A는 스펙의 `ALLOWED_SIGNAL_CODES`/`signal.code` 대신 `riskPhrases`(원문 존재·중복 제거 + 10점 상한)로 안전 목표를 달성했다([risk.ts](../src/lib/risk.ts) `verifyAiAnalysis`). 코드화된 신호가 필요하면 `AiAnalysis`를 확장하고 검증·점수 로직을 함께 갱신.

## 3. 통합 지점(어디를 건드릴지)

| 목적 | 파일 | 지금 상태 |
|---|---|---|
| Gemini 호출/파싱/실패 매핑 | `src/services/gemini.ts` | 요약·URL Context 구현됨, grounding 없음 |
| provider 배선 | `src/services/provider.ts` | factCheck가 summarize로 위임(스텁) |
| 오케스트레이션 | `src/services/analysis.ts` | 모드별 1회 호출·폴백 완성 |
| 타입 | `src/lib/types.ts` | AiStatus/execution/warning 완비, GroundedAnalysis 없음 |
| 테스트 | `tests/analyzeFlow.test.ts` 등 | FakeProvider 주입 패턴 재사용 |

## 4. 테스트 규칙(4B에서도 유지)
- 실제 네트워크 호출 없이 검증(mock fetch 또는 FakeProvider).
- 분석 1건당 provider 호출 ≤1, `summarize`/`factCheck` 동시 호출 금지.
- 잘못된 JSON·과도한 배열·원문에 없는 quote·안전 차단·timeout·429·5xx → 규칙 폴백(HTTP 200).
- `node --test`로 실행하므로 로컬 value import는 `.ts` 확장자 사용(파라미터 프로퍼티·enum 금지 — strip 모드).

## 5. 완료 조건(4B)
- 키가 있으면 요약·URL Context가 실제로 동작하고, grounded fact-check가 실제 grounding으로 근거를 제시한다.
- 키가 없으면 4A와 동일하게 규칙 폴백(회귀 없음).
- 분석 1건당 호출 ≤1 유지. lint/typecheck/build/test 통과, 네트워크 없는 테스트 유지.
- 명시적 요청 전 push/merge 없음. 통합 담당자만 `develop` 병합.

---

## 6. Phase 4B 구현 결과 및 Claude 전달 의도

### 구현 완료

- `src/services/gemini.ts`에서 `summary`와 `grounded` 요청 모드를 분리했다.
- API 키는 URL 쿼리에 넣지 않고 `x-goog-api-key` 헤더로만 전달한다.
- 일반 요약은 기존 구조화 출력 스키마를 유지한다.
- Grounding·URL Context는 도구 응답의 JSON을 앱에서 파싱하고, grounding 출처가 없으면 성공으로 인정하지 않는다.
- 응답 파싱은 `src/services/geminiParsing.ts`로 분리했다.
- `grounding.sources`에는 HTTP(S) 출처만 넣고, 중복 제거·최대 5개·제목 120자 제한을 적용한다.
- `src/components/ResultView.tsx`는 검증된 출처 링크와 sandbox iframe으로 Search Suggestions를 표시한다.
- provider 예외는 텍스트 분석에서 `upstream_error` 규칙 폴백으로, URL 분석에서 `URL_UNREADABLE`로 변환한다.
- 401·403·404는 `configuration_error`, 408·504는 `timeout`, 429는 `rate_limited`로 매핑한다.

### Claude가 이어서 확인할 의도

이 브랜치의 목적은 새 분석 오케스트레이션을 만드는 것이 아니라, 4A의 라우터·provider 경계·오류 계약을 유지한 채 실제 Gemini 응답만 안전하게 연결하는 것이다.

1. 제한된 테스트 키를 직접 `.env.local`에 넣고 키 값은 출력하지 않는다.
2. 다음 입력으로 로컬 `/api/analyze`를 확인한다.
   - 일반 요약: 위험 신호가 없는 카드 결제 안내 문장
   - Grounding: `IANA가 example.com을 문서 예시용 도메인으로 관리한다고 안내합니다.`
   - URL 성공: `https://www.iana.org/help/example-domains`
   - URL 실패: 존재하지 않는 `.invalid` 주소
3. 결과에서 `plannedMode`, `executedMode`, `aiStatus`, `fallbackUsed`, `ai.grounding.sources`만 확인한다. 키·헤더·전체 환경변수는 출력하지 않는다.
4. 같은 키를 Netlify Functions 런타임 환경변수에 직접 등록하고 동일한 네 가지 smoke를 반복한다.
5. 실제 확인 후 키를 회전하거나 폐기한다.

### 자동 검증 결과

- `npm test`: 52개 통과
- `npm run typecheck`: 통과
- `npm run lint`: 통과
- `npm run build`: 통과
- fetch fixture로 실제 네트워크 없는 요약·Grounding·URL Context 성공/실패를 검증했다.
- 현재 키 미설정 브라우저에서는 `AI_NOT_CONFIGURED` 폴백과 URL 읽기 실패 안내가 정상 동작했다.

### 변경 범위 및 주의점

- `package.json`, lock 파일, `netlify.toml`, `.env.example`는 변경하지 않았다.
- AI signal code 확장과 도메인 경고 세분화는 이번 범위에서 제외했다.
- Gemini 호출은 1회지만 Google Search가 내부적으로 여러 검색 쿼리를 실행할 수 있어 비용은 호출 수와 같지 않을 수 있다.
- 실제 키 기반 Gemini·Netlify smoke가 끝나기 전에는 4B를 완전 검증으로 보고하지 않는다.
