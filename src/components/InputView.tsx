"use client";

import type { InputType } from "@/lib/types";

interface Props {
  mode: InputType;
  setMode: (m: InputType) => void;
  text: string;
  setText: (t: string) => void;
  url: string;
  setUrl: (u: string) => void;
  onAnalyze: () => void;
  error: string | null;
  urlNote: string | null;
  onHelp: () => void;
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
  urlNote,
  onHelp,
  onExamples,
}: Props) {
  const canSubmit = (mode === "text" ? text.trim() : url.trim()).length >= 2;

  return (
    <div className="animate-fade">
      {/* Hero */}
      <section className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-4 py-1.5 text-sm font-bold text-teal-700">
          🛡️ 문자·인터넷 글 사기 예방
        </span>
        <h1 className="mx-auto mt-5 max-w-2xl text-balance text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          받은 문자나 인터넷 글이{" "}
          <span className="bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent">
            걱정되시나요?
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-lg text-slate-600">
          글을 붙여넣거나 주소만 적어주세요. <br className="hidden sm:block" />
          위험한 글인지 쉬운 말로 알려드릴게요.
        </p>
      </section>

      {/* Input card */}
      <section className="mx-auto mt-8 max-w-2xl rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(16,24,40,0.07)] sm:p-6">
        {/* Mode tabs */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
          <button
            onClick={() => setMode("text")}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-bold transition ${
              mode === "text"
                ? "bg-white text-teal-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            ✍️ 문자·글 붙여넣기
          </button>
          <button
            onClick={() => setMode("url")}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-bold transition ${
              mode === "url"
                ? "bg-white text-teal-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            🔗 인터넷 주소 넣기
          </button>
        </div>

        {/* URL fetch notice */}
        {urlNote && mode === "text" && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 animate-fade">
            <span className="text-xl" aria-hidden>
              ⚠️
            </span>
            <p className="text-sm font-medium leading-relaxed">{urlNote}</p>
          </div>
        )}

        {/* Inputs */}
        <div className="mt-4">
          {mode === "text" ? (
            <>
              <label htmlFor="text" className="mb-2 block text-sm font-bold text-slate-700">
                확인할 문자나 글을 붙여넣어 주세요
              </label>
              <textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`예)\n[Web발신]\n고객님, 계좌가 정지되었습니다. 확인을 위해 아래 링크를 눌러주세요.\nhttp://...`}
                rows={8}
                className="modal-scroll w-full resize-y rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-lg leading-relaxed text-slate-800 transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white"
              />
              <div className="mt-1.5 flex items-center justify-between px-1 text-xs text-slate-400">
                <span>전화번호·계좌번호·인증번호는 자동으로 가려져요.</span>
                <span>{text.length.toLocaleString()}자</span>
              </div>
            </>
          ) : (
            <>
              <label htmlFor="url" className="mb-2 block text-sm font-bold text-slate-700">
                뉴스·블로그·공공기관 페이지 주소를 넣어주세요
              </label>
              <div className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 transition focus-within:border-teal-500 focus-within:bg-white">
                <span className="text-xl text-slate-400" aria-hidden>
                  🌐
                </span>
                <input
                  id="url"
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full bg-transparent py-4 text-lg text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
              <p className="mt-1.5 px-1 text-xs text-slate-400">
                글을 읽어올 수 없는 페이지면, 글을 복사해 직접 붙여넣어 주세요.
              </p>
            </>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={onAnalyze}
          disabled={!canSubmit}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-6 py-4 text-lg font-extrabold text-white shadow-lg shadow-teal-600/25 transition hover:bg-teal-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          이 글 확인하기 🔍
        </button>
      </section>

      {/* Secondary actions */}
      <section className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-2">
        <button
          onClick={onHelp}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-base font-bold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50"
        >
          📖 사용 방법 듣기
        </button>
        <button
          onClick={onExamples}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-base font-bold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50"
        >
          💡 예시로 연습하기
        </button>
      </section>

      {/* Trust row */}
      <section className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
        {[
          { icon: "🔒", title: "개인정보 보호", desc: "민감한 번호는 가려서 검사해요" },
          { icon: "⚡", title: "빠른 확인", desc: "규칙과 AI로 위험을 찾아요" },
          { icon: "💬", title: "쉬운 말", desc: "어려운 말 없이 알려드려요" },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-center"
          >
            <div className="text-2xl">{f.icon}</div>
            <div className="mt-1 text-sm font-bold text-slate-800">{f.title}</div>
            <div className="text-xs text-slate-500">{f.desc}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
