import FactCheckResultView from "@/components/FactCheckResultView";
import type { AnalysisResult } from "@/lib/types";
import {
  CATEGORY_META,
  SEVERITY_LABEL,
  SEVERITY_STYLE,
} from "@/lib/ui-config";

interface Props {
  readonly result: AnalysisResult;
}

function getEvidenceSummary(result: AnalysisResult): string {
  const hasRuleEvidence = result.signals.length > 0;
  const hasPublicSources = result.ai.grounding !== undefined;

  if (hasRuleEvidence && hasPublicSources) {
    return "원문에서 찾은 위험 문구와 공개 자료를 함께 확인했습니다.";
  }
  if (hasPublicSources) {
    return "글의 공개 주장을 검색 자료와 연결해 확인했습니다.";
  }
  if (hasRuleEvidence) {
    return "원문에서 찾은 문구를 내부 사기 예방 규칙과 대조했습니다.";
  }
  if (result.execution?.plannedMode === "GROUNDED_FACT_CHECK") {
    return "공개 출처 확인이 완료되지 않아 규칙 검사 결과만 보여드립니다.";
  }
  return "원문에서 송금·인증·사칭 같은 뚜렷한 위험 규칙이 발견되지 않았습니다.";
}

export default function AnalysisEvidenceView({ result }: Props) {
  const shouldOpenRules = result.riskLevel === "danger" || result.riskLevel === "critical";

  return (
    <div className="section-divider mt-7 border-t-2 pt-6">
      <section aria-labelledby="analysis-evidence-title">
        <h2 id="analysis-evidence-title" className="ink text-xl font-black">
          판정 근거
        </h2>
        <p className="ink mt-3 text-lg font-bold leading-relaxed">
          {getEvidenceSummary(result)}
        </p>
        <p className="support-copy mt-3 leading-relaxed">
          규칙 근거는 입력한 글 안에서만 찾으며, 공개 출처는 사실 확인 경로에서 연결된 경우에만 표시합니다.
        </p>
      </section>

      {result.ai.factCheck && <FactCheckResultView factCheck={result.ai.factCheck} />}

      <details className="detail-disclosure mt-5 pt-5" open={shouldOpenRules}>
        <summary>원문에서 찾은 위험 근거 {result.signals.length}개</summary>
        <div className="mt-4">
          {result.signals.length === 0 ? (
            <p className="surface-muted ink rounded-xl p-4 font-semibold leading-relaxed">
              현재 규칙 검사에서는 직접 인용할 위험 문구가 발견되지 않았습니다.
            </p>
          ) : (
            <ul className="space-y-4">
              {result.signals.map((signal) => {
                const category = CATEGORY_META[signal.category] ?? { label: signal.category };
                return (
                  <li key={signal.id} className="section-divider border-b-2 pb-4 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="ink font-extrabold">{signal.label}</span>
                      <span className="surface-muted ink-muted rounded-full px-2.5 py-1 text-sm font-bold">
                        {category.label}
                      </span>
                      <span
                        className={`risk-badge ${SEVERITY_STYLE[signal.severity]} rounded-full px-2.5 py-1 text-sm`}
                      >
                        {SEVERITY_LABEL[signal.severity]}
                      </span>
                    </div>
                    {signal.matched && (
                      <p className="surface-muted ink mt-3 rounded-lg px-3 py-2 font-semibold">
                        원문: “{signal.matched}”
                      </p>
                    )}
                    <p className="ink-muted mt-3 font-semibold leading-relaxed">
                      규칙 설명: {signal.detail}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </details>

      {result.ai.riskPhrases.length > 0 && (
        <details className="detail-disclosure mt-5 pt-5">
          <summary>AI가 원문에서 추가 확인한 문장</summary>
          <ul className="mt-4 space-y-2">
            {result.ai.riskPhrases.map((phrase, index) => (
              <li key={`${phrase}-${index}`} className="surface-muted ink rounded-lg px-3 py-2 font-semibold">
                {phrase}
              </li>
            ))}
          </ul>
        </details>
      )}

      {result.ai.grounding && (
        <section className="section-divider mt-7 border-t-2 pt-6" aria-labelledby="grounding-sources-title">
          <h3 id="grounding-sources-title" className="ink text-xl font-black">
            확인에 사용한 공개 출처
          </h3>
          <p className="support-copy mt-3 leading-relaxed">
            Gemini가 Google 검색으로 연결한 자료입니다. 링크를 열어 날짜와 전체 맥락을 함께 확인하세요.
          </p>
          <ul className="mt-4 space-y-2">
            {result.ai.grounding.sources.map((source) => (
              <li key={source.url} className="surface-muted rounded-lg px-3 py-3">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ink break-all font-bold underline decoration-2 underline-offset-4"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
          {result.ai.grounding.searchSuggestionHtml && (
            <iframe
              title="Google 검색 제안"
              srcDoc={result.ai.grounding.searchSuggestionHtml}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              loading="lazy"
              width="100%"
              height="72"
              className="mt-4 border-0"
            />
          )}
        </section>
      )}
    </div>
  );
}
