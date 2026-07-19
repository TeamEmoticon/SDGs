// Analyzer.tsx
// 앱의 전체 화면 흐름(입력 -> 분석 중 -> 결과)과 상단 바(로고, 글자 크기 버튼)를 담당하는 최상위 컴포넌트
// (사용 방법 안내는 보류 상태 — 복원 시 git 히스토리의 HelpModal.tsx 참조)
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAnalysisResult } from "@/lib/analysisResult";
import type { AnalysisResult, InputType } from "@/lib/types";
import { appendAnalysisHistory } from "@/storage/analysisHistory";
import { canAnalyzeForm, createEmptyAnalysisFormState, getAnalysisContent } from "./analysisFormState";
import InputView from "./InputView";
import ResultView from "./ResultView";
import ExamplesModal from "./ExamplesModal";
import RecentHistory from "./RecentHistory";

type Screen = "input" | "analyzing" | "result";
export type FontScale = "normal" | "large" | "xl";
type ContrastMode = "normal" | "high";

const FONT_PX: Record<FontScale, string> = {
  normal: "18px",
  large: "20px",
  xl: "22px",
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

function isContrastMode(value: string | null): value is ContrastMode {
  return value === "normal" || value === "high";
}

// 오류 응답은 { error: { code, message } } 형태(구버전은 { error: "..." } 문자열).
function readErrorMessage(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const err = Reflect.get(value, "error");
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null) {
    const message = Reflect.get(err, "message");
    if (typeof message === "string") return message;
  }
  return null;
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
  const [fontScale, setFontScale] = useState<FontScale>(() => {
    if (typeof window === "undefined") return "normal";
    try {
      const saved = localStorage.getItem("ansim-font");
      return isFontScale(saved) ? saved : "normal";
    } catch {
      return "normal";
    }
  });
  const [contrastMode, setContrastMode] = useState<ContrastMode>(() => {
    if (typeof window === "undefined") return "normal";
    try {
      const saved = localStorage.getItem("ansim-contrast");
      return isContrastMode(saved) ? saved : "normal";
    } catch {
      return "normal";
    }
  });
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    document.documentElement.style.fontSize = FONT_PX[fontScale];
    try {
      localStorage.setItem("ansim-font", fontScale);
    } catch {
      return;
    }
  }, [fontScale]);

  useEffect(() => {
    document.documentElement.dataset.contrast = contrastMode;
    try {
      localStorage.setItem("ansim-contrast", contrastMode);
    } catch {
      return;
    }
  }, [contrastMode]);

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
    if (!canAnalyzeForm(mode, text, url) || requestInFlightRef.current) return;

    const content = getAnalysisContent(mode, text, url);
    requestInFlightRef.current = true;
    setError(null);
    setLoadingStep(0);
    setScreen("analyzing");
    scrollTop();
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mode,
          content,
        }),
      });
      if (res.status === 429) {
        throw new Error("요청이 많습니다. 1분 뒤 다시 시도해 주세요.");
      }
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new Error("분석 결과를 읽지 못했습니다. 다시 시도해 주세요.");
      }
      if (!res.ok) {
        throw new Error(readErrorMessage(data) ?? "분석 중 문제가 발생했습니다.");
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
    } finally {
      requestInFlightRef.current = false;
    }
  }, [mode, text, url]);

  const handleReset = () => {
    const form = createEmptyAnalysisFormState();
    setMode(form.mode);
    setText(form.text);
    setUrl(form.url);
    setResult(null);
    setError(form.error);
    setLoadingStep(0);
    setScreen("input");
    scrollTop();
  };

  const handleHistoryOpen = (savedResult: AnalysisResult): void => {
    setResult(savedResult);
    setError(null);
    setScreen("result");
    scrollTop();
  };

  const loadExample = (content: string) => {
    setMode("text");
    setText(content);
    setUrl("");
    setError(null);
    setExamplesOpen(false);
    scrollTop();
  };

  return (
    <div className="app-shell flex min-h-[100dvh] flex-col">
      <div ref={topRef} />

      {/* ---------------- Top bar ---------------- */}
      <header className="app-header sticky top-0 z-30 border-b-2">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={handleReset}
            className="ink text-xl font-black tracking-tight"
            aria-label="처음으로"
          >
            안심글
          </button>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="hidden border-2 border-[var(--line)] px-3 py-1.5 text-xs font-bold text-[var(--ink-muted)] sm:inline">
              SDG 16 · 10 · 9
            </span>
            <button
              onClick={() => setFontScale((f) => FONT_NEXT[f])}
              className="font-control rounded-xl px-3 py-2 text-sm"
              aria-label={`글자 크기: ${FONT_LABEL[fontScale]}`}
              title="글자 크기 바꾸기"
            >
              글자 {FONT_LABEL[fontScale]}
            </button>
            <button
              type="button"
              onClick={() => setContrastMode((mode) => (mode === "normal" ? "high" : "normal"))}
              className="contrast-control rounded-xl px-3 py-2 text-sm"
              aria-pressed={contrastMode === "high"}
            >
              {contrastMode === "high" ? "일반 화면으로" : "고대비 켜기"}
            </button>
          </div>
        </div>
      </header>

      {/* ---------------- Main ---------------- */}
      <main className="app-main mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-12">
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
              onExamples={() => setExamplesOpen(true)}
            />
            <RecentHistory onOpen={handleHistoryOpen} />
          </>
        )}

        {screen === "analyzing" && (
          <section className="mx-auto max-w-xl py-10 text-center" aria-live="polite">
            <div className="relative mx-auto mb-8 grid h-24 w-24 place-items-center">
              <span className="pulse-dot absolute inset-0 text-[var(--action)]" />
              <span className="brand-mark grid h-20 w-20 place-items-center rounded-full text-2xl font-extrabold">
                안
              </span>
            </div>
            <h2 className="ink text-2xl font-extrabold">글을 확인하고 있어요</h2>
            <p className="ink-muted mt-2">잠시만 기다려 주세요. 금방 끝나요.</p>

            <ol className="mt-8 space-y-3 text-left">
              {PIPELINE.map((step, i) => {
                const done = loadingStep > i;
                const active = loadingStep === i;
                return (
                  <li
                    key={step.label}
                    className={`surface-panel flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-500 ${
                      done
                        ? "bg-[var(--surface-muted)]"
                        : active
                          ? "bg-[var(--surface)]"
                          : "opacity-60"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                        done ? "bg-[var(--action)] text-white" : "surface-muted ink-muted border-2 border-[var(--line)]"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="ink font-bold">{step.label}</span>
                        {done && (
                          <span className="rounded-full bg-[var(--action)] px-2 py-0.5 text-xs font-bold text-white">
                            완료
                          </span>
                        )}
                      </span>
                      <span className="ink-muted block text-sm">{step.sub}</span>
                    </span>
                    {active && (
                      <span className="ml-auto h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[var(--action)] border-t-transparent" />
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="surface-muted relative mt-6 h-2 w-full overflow-hidden rounded-full">
              <span
                className="absolute top-0 h-full w-1/3 rounded-full bg-[var(--action)]"
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
      <footer className="section-divider border-t-2">
        <div className="ink-muted mx-auto w-full max-w-5xl px-4 py-8 text-sm sm:px-6">
          <p className="ink font-bold">안심글 - 보이스피싱과 스미싱 위험을 미리 확인하세요</p>
          <p className="mt-2 leading-relaxed">
            혹시 믿음직하지 못한 정보는{" "}
            <span className="font-semibold text-[var(--action)]">112(경찰)</span> ·{" "}
            <span className="font-semibold text-[var(--action)]">1332(금융사기 상담)</span>로 확인하세요.
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
