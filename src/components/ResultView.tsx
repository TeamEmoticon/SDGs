"use client";

import { useState } from "react";
import type { AnalysisResult, RiskLevel, SensitiveKind } from "@/lib/types";
import AnalysisEvidenceView from "@/components/AnalysisEvidenceView";
import { RISK_UI, SENSITIVE_LABEL } from "@/lib/ui-config";

interface Props {
  result: AnalysisResult;
  onReset: () => void;
}

const LEVEL_STORY: Record<RiskLevel, string> = {
  safe: "뚜렷한 위험 신호가 적습니다.",
  caution: "한 번 더 확인해 주세요.",
  danger: "사기·피싱일 가능성이 높습니다.",
  critical: "사기·피싱일 가능성이 매우 높습니다. 지금 행동을 멈추세요.",
};

// 낮은 등급에도 항상 표시하는 안내(안전을 보장하지 않는다).
const SAFETY_DISCLAIMER =
  "이 결과가 글의 안전을 보장하지는 않습니다. 금전이나 개인정보를 요구하면 공식 기관에 다시 확인하세요.";

export default function ResultView({ result, onReset }: Props) {
  const ui = RISK_UI[result.riskLevel];
  const [showText, setShowText] = useState(false);
  const score = Math.round(result.riskScore);
  const sensitiveKinds = (Object.keys(result.mask.counts) as SensitiveKind[]).filter(
    (kind) => result.mask.counts[kind] > 0,
  );

  return (
    <div className="animate-fade mx-auto max-w-2xl">
      <section className={`risk-panel ${ui.tone} overflow-hidden rounded-2xl p-5 sm:p-7`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`risk-badge rounded-full px-3 py-1 text-sm ${ui.tone}`}>
            확인 완료 · {result.inputType === "url" ? "인터넷 주소" : "문자·글"}
          </span>
          <span className="support-copy">
            {new Date(result.createdAt).toLocaleString("ko-KR", {
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="mt-5">
          <p className="ink-muted text-base font-extrabold">이 글의 위험 단계</p>
          <p className={`risk-text mt-1 text-4xl font-black leading-tight sm:text-5xl`}>{ui.label}</p>
          <p className="ink mt-4 text-lg font-bold">{LEVEL_STORY[result.riskLevel]}</p>
          <p className="support-copy mt-3 leading-relaxed">{SAFETY_DISCLAIMER}</p>
        </div>

        <div className="mt-6">
          <div className="ink mb-2 flex items-center justify-between text-base font-extrabold">
            <span>위험 점수</span>
            <span className="risk-text">
              {score} <span className="ink-muted">/ 100</span>
            </span>
          </div>
          <div className="risk-meter relative h-4 w-full overflow-hidden rounded-full">
            <span
              className="absolute inset-y-0 left-0 rounded-full transition-[width]"
              style={{ width: `${Math.max(score, 4)}%` }}
            />
          </div>
          <div className="ink-muted mt-2 flex justify-between text-xs font-bold">
            <span>안전</span>
            <span>주의</span>
            <span>위험</span>
            <span>고위험</span>
          </div>
        </div>
      </section>

      <section className="section-divider mt-7 border-t-2 pt-6">
        <h2 className="ink text-xl font-black">지금 할 일</h2>
        <p className="ink mt-3 text-lg font-bold leading-relaxed">{result.recommendation}</p>
      </section>

      <div className="section-divider mt-7 grid gap-6 border-t-2 pt-6 sm:grid-cols-2 sm:gap-0">
        <section className="sm:pr-6">
          <h2 className="ink text-xl font-black">쉬운 말 요약</h2>
          <p className="ink mt-3 text-lg font-semibold leading-relaxed">
            {result.ai.summary || "내용을 요약하지 못했습니다."}
          </p>
          <p className="support-copy mt-3">
            {result.ai.used ? "내용을 알아보기 쉽게 정리했습니다." : "규칙 검사 결과를 바탕으로 정리했습니다."}
          </p>
          {result.warnings?.map((warning) => (
            <p key={warning.code} className="support-copy mt-2">
              {warning.message}
            </p>
          ))}
        </section>
        <section className="section-divider border-t-2 pt-6 sm:border-t-0 sm:border-l-2 sm:pl-6 sm:pt-0">
          <h2 className="ink text-xl font-black">이 글은 어떤 종류인가요?</h2>
          <p className="ink mt-3 text-lg font-bold">{result.ai.infoType || "분류 없음"}</p>
          <p className="support-copy mt-3">
            글의 목적을 분류한 결과입니다. 사기·피싱 의심이면 각별히 조심하세요.
          </p>
        </section>
      </div>

      <AnalysisEvidenceView result={result} />

      <details className="detail-disclosure mt-5 pt-5">
        <summary>걸러낸 개인정보</summary>
        <div className="mt-4">
          {result.mask.maskedCount === 0 ? (
            <p className="ink-muted font-semibold">전화번호·계좌번호·인증번호가 감지되지 않았어요.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {sensitiveKinds.map((kind) => (
                  <span key={kind} className="surface-muted ink rounded-lg px-3 py-2 font-bold">
                    {SENSITIVE_LABEL[kind]} {result.mask.counts[kind]}개
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowText((visible) => !visible)}
                className="history-action mt-4 rounded-lg px-3 py-2 text-sm"
              >
                {showText ? "가려진 글 숨기기" : "개인정보가 가려진 글 보기"}
              </button>
              {showText &&
                (result.maskedText ? (
                  <pre className="modal-scroll ink mt-3 max-h-72 overflow-auto whitespace-pre-wrap border-2 border-[var(--line)] bg-[var(--surface)] p-4 text-sm font-semibold leading-relaxed">
                    {result.maskedText}
                  </pre>
                ) : (
                  <p className="surface-muted ink-muted mt-3 rounded-lg px-3 py-2 font-semibold">
                    기록에는 원문을 저장하지 않았습니다.
                  </p>
                ))}
            </>
          )}
        </div>
      </details>

      <div className="mt-8">
        <button
          type="button"
          onClick={onReset}
          className="button-primary flex w-full items-center justify-center rounded-xl px-6 py-4 text-lg"
        >
          다른 글 확인하기
        </button>
      </div>

      {result.sourceUrl && <p className="support-copy mt-4 break-all text-center">출처: {result.sourceUrl}</p>}
    </div>
  );
}
