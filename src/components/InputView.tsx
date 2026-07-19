"use client";

import type { InputType } from "@/lib/types";
import { canAnalyzeForm } from "./analysisFormState";
import PwaInstallButton from "./PwaInstallButton";

interface Props {
  mode: InputType;
  setMode: (mode: InputType) => void;
  text: string;
  setText: (text: string) => void;
  url: string;
  setUrl: (url: string) => void;
  onAnalyze: () => void;
  error: string | null;
  onExamples: () => void;
}

export default function InputView({
  mode,
  setMode,
  text,
  setText,
  url,
  setUrl,
  onAnalyze,
  error,
  onExamples,
}: Props) {
  const canSubmit = canAnalyzeForm(mode, text, url);

  return (
    <div className="animate-fade">
      <section className="text-center">
        <p className="hero-eyebrow">의심 문자·메신저 보이스피싱 예방</p>
        <h1 className="hero-heading mx-auto mt-4 max-w-2xl text-balance">
          받은 문자나 링크가 <span className="hero-accent">걱정되시나요?</span>
        </h1>
        <p className="hero-copy mx-auto mt-5 max-w-xl text-balance">
          의심 문자를 붙여넣거나 링크 주소를 적어주세요. <br className="hidden sm:block" />
          상대가 무엇을 요구하는지 쉬운 말로 알려드릴게요.
        </p>
      </section>

      <section className="surface-panel mx-auto mt-8 max-w-2xl rounded-2xl p-4 sm:p-6">
        <div className="mode-tabs grid grid-cols-2 gap-2 rounded-xl p-1.5">
          <button
            type="button"
            onClick={() => setMode("text")}
            className="mode-tab rounded-lg px-3 py-3 text-center text-base leading-tight"
            data-active={mode === "text"}
          >
            문자·글 붙여넣기
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className="mode-tab rounded-lg px-3 py-3 text-center text-base leading-tight"
            data-active={mode === "url"}
          >
            의심 링크 검사
          </button>
        </div>

        <div className="mt-5">
          {mode === "text" ? (
            <>
              <label htmlFor="text" className="field-label mb-2 block">
                확인할 문자·메신저 내용을 붙여넣어 주세요
              </label>
              <textarea
                id="text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={`예)\n[Web발신]\n고객님, 계좌가 정지되었습니다. 확인을 위해 아래 링크를 눌러주세요.\nhttp://...`}
                rows={8}
                className="field-control modal-scroll w-full resize-y rounded-xl p-4 transition"
              />
              <div className="support-copy mt-2 flex items-center justify-between gap-3 px-1">
                <span>전화번호·계좌번호·인증번호는 자동으로 가려져요.</span>
                <span>{text.length.toLocaleString()}자</span>
              </div>
            </>
          ) : (
            <>
              <label htmlFor="url" className="field-label mb-2 block">
                문자에서 받은 의심 링크 주소를 넣어주세요
              </label>
              <div className="field-control flex items-center gap-2 rounded-xl px-4 transition focus-within:border-[var(--action)]">
                <input
                  id="url"
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/link"
                  className="w-full bg-transparent py-4 outline-none"
                />
              </div>
              <p className="support-copy mt-2 px-1">
                링크 주소의 위험 신호만 확인합니다. 사이트 내용의 사실 여부는 판정하지 않아요.
                더 정확한 확인을 위해 링크가 포함된 문자 전체를 함께 붙여넣어 주세요.
              </p>
            </>
          )}
        </div>

        {error && (
          <p className="notice-warning mt-4 rounded-xl px-4 py-3 font-semibold" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canSubmit}
          className="button-primary mt-6 flex w-full items-center justify-center rounded-xl px-6 py-4 text-lg disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:bg-[var(--line)] disabled:shadow-none"
        >
          {mode === "url" ? "링크 위험 신호 확인하기" : "문자 확인하기"}
        </button>
      </section>

      <section className="mx-auto mt-5 max-w-2xl">
        <button
          type="button"
          onClick={onExamples}
          className="button-secondary flex w-full items-center justify-center rounded-xl px-5 py-4 text-base"
        >
          예시로 연습하기
        </button>
      </section>

      <section className="mx-auto mt-4 max-w-2xl" aria-label="앱 설치">
        <PwaInstallButton />
      </section>

      <section className="trust-guidance mx-auto mt-8 max-w-2xl py-5" aria-label="안심글 사용 안내">
        <ul className="grid gap-4 sm:grid-cols-3 sm:gap-0">
          {[
            { title: "개인정보 보호", desc: "민감한 번호는 가려서 검사해요" },
            { title: "빠른 확인", desc: "위험 신호를 차례로 확인해요" },
            { title: "쉬운 말", desc: "어려운 말 없이 알려드려요" },
          ].map((feature) => (
            <li
              key={feature.title}
              className="text-center sm:px-4"
            >
              <strong className="block text-base">{feature.title}</strong>
              <span className="mt-1 block text-sm font-semibold">{feature.desc}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
