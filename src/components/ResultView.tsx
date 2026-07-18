// ResultView.tsx
// 분석 결과 화면: 위험 단계 배너, 요약, 위험 신호 목록, 걸러낸 개인정보를 보여준다
// (전화 걸기 버튼과 사용 방법 안내는 보류 상태 — 복원 시 git 히스토리 참조)
"use client";

import { useState } from "react";
import type { AnalysisResult, RiskLevel, SensitiveKind } from "@/lib/types";
import {
  CATEGORY_META,
  RISK_UI,
  SEVERITY_LABEL,
  SEVERITY_STYLE,
  SENSITIVE_LABEL,
} from "@/lib/ui-config";

interface Props {
  result: AnalysisResult;
  onReset: () => void;
}

const LEVEL_STORY: Record<RiskLevel, string> = {
  safe: "당장 걱정하지 않아도 되는 글입니다.",
  caution: "한 번 더 확인이 필요한 글입니다.",
  danger: "사기·피싱이 의심되는 신호가 있습니다.",
  critical: "여러 위험 신호가 확인되어 특히 조심해야 합니다.",
};

function Card({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "muted";
}) {
  return (
    <section
      className={`rounded-3xl border p-5 sm:p-6 ${
        tone === "muted"
          ? "border-slate-200 bg-slate-50/70"
          : "border-slate-200 bg-white"
      } animate-fade-up`}
    >
      <h3 className="mb-3 text-lg font-extrabold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

export default function ResultView({ result, onReset }: Props) {
  const ui = RISK_UI[result.riskLevel];
  const [showText, setShowText] = useState(false);
  const score = Math.round(result.riskScore);

  const sensitiveKinds = (Object.keys(result.mask.counts) as SensitiveKind[]).filter(
    (k) => result.mask.counts[k] > 0,
  );

  return (
    <div className="animate-fade">
      {/* ---- Risk verdict banner ---- */}
      <section
        className={`overflow-hidden rounded-3xl border-2 ${ui.banner} animate-pop`}
      >
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${ui.chip}`}>
              분석 완료 · {result.inputType === "url" ? "인터넷 주소" : "문자·글"}
            </span>
            <span className="text-sm font-semibold text-slate-500">
              {new Date(result.createdAt).toLocaleString("ko-KR", {
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className="mt-4">
            <p className="text-sm font-bold text-slate-500">이 글의 위험 단계</p>
            <p className={`text-3xl font-extrabold leading-tight sm:text-4xl ${ui.bannerText}`}>
              {ui.label}
            </p>
          </div>

          <p className={`mt-3 text-lg font-semibold ${ui.bannerText}`}>
            {LEVEL_STORY[result.riskLevel]}
          </p>

          {/* Score meter */}
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-sm font-bold">
              <span className="text-slate-600">위험 점수</span>
              <span className={ui.scoreText}>
                {score}
                <span className="text-slate-400"> / 100</span>
              </span>
            </div>
            <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="flex h-full w-full">
                <div className="h-full flex-[18] bg-emerald-300/50" />
                <div className="h-full flex-[27] bg-amber-300/50" />
                <div className="h-full flex-[27] bg-orange-300/50" />
                <div className="h-full flex-[28] bg-red-300/50" />
              </div>
              <div
                className={`absolute top-0 h-full rounded-full ${ui.bar} transition-all`}
                style={{ width: `${Math.max(score, 4)}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[0.65rem] font-semibold text-slate-400">
              <span>안전</span>
              <span>주의</span>
              <span>위험</span>
              <span>고위험</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Recommendation ---- */}
      <section
        className={`mt-4 rounded-3xl border-2 p-5 sm:p-6 animate-fade-up animate-delay-1 ${ui.banner}`}
      >
        <h3 className={`text-lg font-extrabold ${ui.bannerText}`}>어떻게 하면 좋을까요?</h3>
        <p className={`mt-2 text-lg leading-relaxed ${ui.bannerText}`}>{result.recommendation}</p>
      </section>

      {/* ---- Two-column detail cards ---- */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Easy summary */}
        <Card title="쉬운 말 요약">
          <p className="text-lg leading-relaxed text-slate-700">
            {result.ai.summary || "내용을 요약하지 못했습니다."}
          </p>
          {result.ai.used ? (
            <p className="mt-3 text-xs font-semibold text-teal-600">AI가 쉬운 말로 정리했어요</p>
          ) : (
            <p className="mt-3 text-xs font-semibold text-slate-400">
              규칙 검사 결과로 알려드려요 (AI 요약 미사용)
            </p>
          )}
        </Card>

        {/* Info type */}
        <Card title="이 글은 어떤 종류?">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-teal-50 px-4 py-2 text-lg font-extrabold text-teal-700 ring-1 ring-teal-200">
              {result.ai.infoType || "분류 없음"}
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            글의 목적을 분류한 결과예요. &lsquo;사기·피싱 의심&rsquo;이면 각별히 조심하세요.
          </p>
        </Card>
      </div>

      {/* ---- Signals ---- */}
      <Card title={`찾아낸 위험 신호 ${result.signals.length}개`}>
        {result.signals.length === 0 ? (
          <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">
            <p className="font-semibold">규칙 검사에서 위험 신호가 발견되지 않았어요.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {result.signals.map((s) => {
              const cat = CATEGORY_META[s.category] ?? { label: s.category };
              return (
                <li
                  key={s.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-800">{s.label}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {cat.label}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${SEVERITY_STYLE[s.severity]}`}
                    >
                      {SEVERITY_LABEL[s.severity]}
                    </span>
                  </div>
                  {s.matched && (
                    <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-100">
                      &ldquo;{s.matched}&rdquo;
                    </p>
                  )}
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.detail}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ---- AI candidate phrases ---- */}
      {result.ai.riskPhrases.length > 0 && (
        <Card title="AI가 뽑은 의심 구절" tone="muted">
          <ul className="space-y-2">
            {result.ai.riskPhrases.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-slate-700 ring-1 ring-slate-100"
              >
                <span className="mt-0.5 text-amber-500" aria-hidden>
                  -
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ---- Masked personal info ---- */}
      <Card title="걸러낸 개인정보">
        {result.mask.maskedCount === 0 ? (
          <p className="text-slate-500">전화번호·계좌번호·인증번호가 감지되지 않았어요.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2.5">
              {sensitiveKinds.map((k) => (
                <span
                  key={k}
                  className="rounded-2xl bg-slate-100 px-3.5 py-2 text-sm font-bold text-slate-700"
                >
                  {SENSITIVE_LABEL[k]} {result.mask.counts[k]}개
                </span>
              ))}
            </div>
            <button
              onClick={() => setShowText((v) => !v)}
              className="mt-4 text-sm font-bold text-teal-700 underline-offset-4 hover:underline"
            >
              {showText ? "가려진 글 숨기기" : "개인정보가 가려진 글 보기"}
            </button>
            {showText && (result.maskedText ? (
              <pre className="modal-scroll mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-900 p-4 text-sm leading-relaxed text-slate-100 animate-fade">
                {result.maskedText}
              </pre>
            ) : (
              <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">기록에는 원문을 저장하지 않았습니다.</p>
            ))}
          </>
        )}
      </Card>

      {/* ---- Actions ---- */}
      <div className="mt-6">
        <button
          onClick={onReset}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-6 py-4 text-lg font-extrabold text-white shadow-lg shadow-teal-600/25 transition hover:bg-teal-700"
        >
          다른 글 확인하기
        </button>
      </div>

      {result.sourceUrl && (
        <p className="mt-4 break-all text-center text-xs text-slate-400">
          출처: {result.sourceUrl}
        </p>
      )}
    </div>
  );
}
