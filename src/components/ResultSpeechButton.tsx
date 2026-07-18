"use client";

// ResultSpeechButton
// 분석 결과 화면의 핵심 내용을 Amazon Polly(/api/tts)로 읽어준다.
// - 같은 결과를 다시 들을 때는 생성된 MP3 Blob을 재사용(API 재호출 없음)
// - 새 결과가 오면 캐시·오디오·object URL을 정리
// - 로딩 중/중지/오류 상태와 중복 클릭 방지, 고령 사용자 접근성 고려

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import { buildSpeechText } from "@/lib/buildSpeechText";

type SpeechState = "idle" | "loading" | "playing" | "ended" | "error";

const LABEL: Record<SpeechState, string> = {
  idle: "결과 소리로 듣기",
  loading: "음성을 만들고 있습니다",
  playing: "듣기 중지",
  ended: "다시 듣기",
  error: "음성 다시 시도",
};

const STATUS_MESSAGE: Record<SpeechState, string> = {
  idle: "",
  loading: "음성을 만들고 있습니다.",
  playing: "음성 재생을 시작했습니다.",
  ended: "음성 재생이 끝났습니다.",
  error: "음성 읽기 기능을 사용할 수 없습니다.",
};

interface Props {
  readonly result: AnalysisResult;
}

export default function ResultSpeechButton({ result }: Props) {
  const [state, setState] = useState<SpeechState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const cachedTextRef = useRef<string | null>(null);
  const requestingRef = useRef(false); // 로딩 중 중복 fetch 방지(연타 대비)

  const teardown = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    cachedTextRef.current = null;
    requestingRef.current = false;
  }, []);

  // 언마운트 시 오디오·object URL을 정리한다.
  // 새 결과가 오면 상위(ResultView)에서 key로 이 컴포넌트를 재마운트하므로
  // 상태와 캐시는 자연스럽게 초기화된다(effect 안에서 setState 하지 않는다).
  useEffect(() => teardown, [teardown]);

  function attachAudio(url: string): HTMLAudioElement {
    const audio = new Audio(url);
    audio.onended = () => setState("ended");
    audio.onerror = () => {
      setState("error");
      setErrorMessage("소리를 재생하지 못했습니다. 다시 시도해 주세요.");
    };
    audioRef.current = audio;
    return audio;
  }

  async function startPlayback(audio: HTMLAudioElement) {
    audio.currentTime = 0;
    await audio.play();
    setState("playing");
  }

  async function play() {
    const text = buildSpeechText(result);

    // 1) 같은 결과의 Blob이 이미 있으면 재사용(Amazon Polly 재호출 없음).
    if (objectUrlRef.current && cachedTextRef.current === text) {
      const audio = audioRef.current ?? attachAudio(objectUrlRef.current);
      try {
        await startPlayback(audio);
      } catch {
        setState("error");
        setErrorMessage("소리를 재생하지 못했습니다. 다시 시도해 주세요.");
      }
      return;
    }

    // 2) 새로 합성.
    if (requestingRef.current) return;
    requestingRef.current = true;
    setState("loading");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        let message = "현재 음성 읽기 기능을 사용할 수 없습니다. 화면의 글을 확인해 주세요.";
        try {
          const data: unknown = await response.json();
          const fromServer =
            typeof data === "object" && data !== null
              ? Reflect.get(Reflect.get(data, "error") ?? {}, "message")
              : undefined;
          if (typeof fromServer === "string" && fromServer.length > 0) message = fromServer;
        } catch {
          // 본문 파싱 실패는 기본 안내 문구를 사용한다.
        }
        setState("error");
        setErrorMessage(message);
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      cachedTextRef.current = text;
      await startPlayback(attachAudio(url));
    } catch {
      setState("error");
      setErrorMessage("음성을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      requestingRef.current = false;
    }
  }

  function stop() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setState("idle");
  }

  function handleClick() {
    if (state === "loading") return; // 로딩 중 연타 무시
    if (state === "playing") {
      stop();
      return;
    }
    void play();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "loading"}
        aria-busy={state === "loading"}
        className="button-primary flex min-h-[48px] w-full items-center justify-center rounded-xl px-6 py-4 text-lg font-bold disabled:opacity-70"
      >
        {LABEL[state]}
      </button>
      <p className="support-copy mt-2 min-h-[1.25rem]" aria-live="polite">
        {errorMessage ?? STATUS_MESSAGE[state]}
      </p>
    </div>
  );
}
