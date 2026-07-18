// Analyzer.tsx
// 앱의 전체 화면 흐름(입력 -> 분석 중 -> 결과)과 상단 바(로고, 글자 크기 버튼)를 담당하는 최상위 컴포넌트
// (사용 방법 안내는 보류 상태 — 복원 시 git 히스토리의 HelpModal.tsx 참조)
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAnalysisResult } from "@/lib/analysisResult";
import type { AnalysisResult, InputType } from "@/lib/types";
import { appendAnalysisHistory } from "@/storage/analysisHistory";
import InputView from "./InputView";
import ResultView from "./ResultView";
import ExamplesModal from "./ExamplesModal";
import RecentHistory from "./RecentHistory";

type Screen = "input" | "analyzing" | "result";
export type FontScale = "normal" | "large" | "xl";

const FONT_PX: Record<FontScale, string> = {
  normal: "16px",
  large: "18.5px",
  xl: "21px",
};
const FONT_LABEL: Record<FontScale, string> = {
  normal: "보통",
  large: "크게",
  xl: "아주 크게",
};
const FONT_NEXT: Record<FontScale, FontScale> = {
  normal: "large",
  large: "xl",
  xl: "normal",
};

function isFontScale(value: string | null): value is FontScale {
  return value === "normal" || value === "large" || value === "xl";
}

function readApiMessage(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const message = Reflect.get(value, key);
  return typeof message === "string" ? message : null;
}

function hasApiFlag(value: unknown, key: string): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Reflect.get(value, key) === true;
}

const PIPELINE = [
  { label: "개인정보 가리는 중", sub: "전화번호·계좌번호·인증번호" },
  { label: "위험 신호 찾는 중", sub: "규칙 기반 검사" },
  { label: "내용 이해하는 중", sub: "AI 쉬운 요약·분류" },
  { label: "위험 단계 계산 중", sub: "최종 판정" },
];

export default function Analyzer() {
  const [screen, setScreen] = useState<Screen>("input");
  const [mode, setMode] = useState<InputType>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urlNote, setUrlNote] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState<FontScale>(() => {
    if (typeof window === "undefined") return "normal";
    try {
      const saved = localStorage.getItem("ansim-font");
      return isFontScale(saved) ? saved : "normal";
    } catch {
      return "normal";
    }
  });
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.style.fontSize = FONT_PX[fontScale];
    try {
      localStorage.setItem("ansim-font", fontScale);
    } catch {
      return;
    }
  }, [fontScale]);

  // Drive the pipeline animation while analyzing.
  useEffect(() => {
    if (screen !== "analyzing") return;
    const t = setInterval(() => {
      setLoadingStep((s) => (s < PIPELINE.length ? s + 1 : s));
    }, 650);
    return () => clearInterval(t);
  }, [screen]);

  const scrollTop = () =>
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleAnalyze = useCallback(async () => {
    setError(null);
    setUrlNote(null);
    setLoadingStep(0);
    setScreen("analyzing");
    scrollTop();
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mode,
          content: mode === "text" ? text : url,
        }),
      });
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new Error("분석 결과를 읽지 못했습니다. 다시 시도해 주세요.");
      }
      if (!res.ok) {
        if (hasApiFlag(data, "urlFetchFailed")) {
          setUrlNote(readApiMessage(data, "message") ?? "페이지 내용을 읽지 못했습니다. 글을 직접 붙여넣어 주세요.");
          setMode("text");
          setScreen("input");
          scrollTop();
          return;
        }
        throw new Error(readApiMessage(data, "error") ?? "분석 중 문제가 발생했습니다.");
      }
      if (!isAnalysisResult(data)) throw new Error("분석 결과 형식이 올바르지 않습니다. 다시 시도해 주세요.");
      const analysis = data;
      appendAnalysisHistory(analysis);
      setResult(analysis);
      setScreen("result");
      scrollTop();
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 중 문제가 발생했습니다.");
      setScreen("input");
      scrollTop();
    }
  }, [mode, text, url]);

  const handleReset = () => {
    setResult(null);
    setError(null);
    setUrlNote(null);
    setScreen("input");
    scrollTop();
  };

  const handleHistoryOpen = (savedResult: AnalysisResult): void => {
    setResult(savedResult);
    setError(null);
    setUrlNote(null);
    setScreen("result");
    scrollTop();
  };

  const loadExample = (content: string) => {
    setMode("text");
    setText(content);
    setUrl("");
    setUrlNote(null);
    setError(null);
    setExamplesOpen(false);
    scrollTop();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div ref={topRef} />

      {/* ---------------- Top bar ---------------- */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={handleReset}
            className="flex items-center gap-2.5 text-left"
            aria-label="처음으로"
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-600 text-lg font-extrabold text-white shadow-sm shadow-teal-600/30">
              안
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-extrabold tracking-tight text-slate-900">
                안심글
              </span>
              <span className="block text-[0.7rem] font-semibold text-teal-700">
                SDGs 디지털 안전 도우미
              </span>
            </span>
          </button>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 ring-1 ring-teal-200 sm:inline">
              SDG 16 · 10 · 9
            </span>
            <button
              onClick={() => setFontScale((f) => FONT_NEXT[f])}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50"
              aria-label={`글자 크기: ${FONT_LABEL[fontScale]}`}
              title="글자 크기 바꾸기"
            >
              글자 {FONT_LABEL[fontScale]}
            </button>
          </div>
        </div>
      </header>

      {/* ---------------- Main ---------------- */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {screen === "input" && (
          <>
            <InputView
              mode={mode}
              setMode={setMode}
              text={text}
              setText={setText}
              url={url}
              setUrl={setUrl}
              onAnalyze={handleAnalyze}
              error={error}
              urlNote={urlNote}
              onExamples={() => setExamplesOpen(true)}
            />
            <RecentHistory onOpen={handleHistoryOpen} />
          </>
        )}

        {screen === "analyzing" && (
          <section className="mx-auto max-w-xl py-10 text-center">
            <div className="relative mx-auto mb-8 grid h-24 w-24 place-items-center">
              <span className="pulse-dot absolute inset-0 text-teal-400" />
              <span className="grid h-20 w-20 place-items-center rounded-full bg-teal-600 text-2xl font-extrabold text-white shadow-lg shadow-teal-600/30">
                안
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">글을 확인하고 있어요</h2>
            <p className="mt-2 text-slate-600">잠시만 기다려 주세요. 금방 끝나요.</p>

            <ol className="mt-8 space-y-3 text-left">
              {PIPELINE.map((step, i) => {
                const done = loadingStep > i;
                const active = loadingStep === i;
                return (
                  <li
                    key={step.label}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-500 ${
                      done
                        ? "border-teal-200 bg-teal-50"
                        : active
                          ? "border-teal-300 bg-white shadow-sm"
                          : "border-slate-200 bg-slate-50 opacity-60"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                        done ? "bg-teal-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-800">{step.label}</span>
                        {done && (
                          <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">
                            완료
                          </span>
                        )}
                      </span>
                      <span className="block text-sm text-slate-500">{step.sub}</span>
                    </span>
                    {active && (
                      <span className="ml-auto h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="relative mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <span
                className="absolute top-0 h-full w-1/3 rounded-full bg-teal-500"
                style={{ animation: "indeterminate 1.3s ease-in-out infinite" }}
              />
            </div>
          </section>
        )}

        {screen === "result" && result && (
          <ResultView result={result} onReset={handleReset} />
        )}
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-slate-200 bg-white/60">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 text-sm text-slate-500 sm:px-6">
          <p className="font-bold text-slate-700">안심글 — 누구나 안전하게 디지털을 쓰는 세상</p>
          <p className="mt-2 leading-relaxed">
            이 도구는 유엔 지속가능발전목표(SDGs)의{" "}
            <span className="font-semibold text-slate-600">
              16 평화·정의·강력한 기관, 10 불평등 감소, 9 인프라와 혁신
            </span>{" "}
            실천을 목표로 만들었습니다. 분석 결과는 참고용이며, 의심되는 즉시{" "}
            <span className="font-semibold text-teal-700">112(경찰)</span> ·{" "}
            <span className="font-semibold text-teal-700">1332(금융사기 상담)</span>로 확인하세요.
          </p>
        </div>
      </footer>

      <ExamplesModal
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
        onPick={loadExample}
      />
    </div>
  );
}
