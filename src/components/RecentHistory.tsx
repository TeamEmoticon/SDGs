"use client";

import { useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import {
  clearAnalysisHistory,
  loadAnalysisHistory,
  removeAnalysisHistory,
  restoreAnalysisResult,
  type AnalysisHistoryItem,
} from "@/storage/analysisHistory";

interface Props {
  readonly onOpen: (result: AnalysisResult) => void;
}

const RISK_LABEL = {
  safe: "안전",
  caution: "주의",
  danger: "위험",
  critical: "고위험",
} as const;

const RISK_CLASS = {
  safe: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  caution: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-orange-50 text-orange-700 ring-orange-200",
  critical: "bg-red-50 text-red-700 ring-red-200",
} as const;

export default function RecentHistory({ onOpen }: Props) {
  const [items, setItems] = useState<readonly AnalysisHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setItems(loadAnalysisHistory());
      setIsLoading(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const refresh = (): void => setItems(loadAnalysisHistory());

  const handleRemove = (id: string): void => {
    removeAnalysisHistory(id);
    refresh();
  };

  const handleClear = (): void => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setIsClearing(true);
    clearAnalysisHistory();
    refresh();
    setIsClearing(false);
    setConfirmClear(false);
  };

  return (
    <section className="mx-auto mt-10 max-w-2xl border-t border-slate-200 pt-8" aria-labelledby="recent-history-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="recent-history-title" className="text-xl font-extrabold text-slate-900">
            최근 확인한 글
          </h2>
          <p className="mt-1 text-sm text-slate-500">이 기기에만 안전한 결과 요약을 저장해요.</p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isClearing}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {confirmClear ? "한 번 더 누르면 모두 지워요" : "기록 모두 지우기"}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3" aria-label="최근 기록을 불러오는 중">
          <div className="shimmer h-24 rounded-2xl" />
          <div className="shimmer h-24 rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 text-center">
          <p className="font-bold text-slate-700">아직 확인한 글이 없습니다.</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">위에서 문자나 인터넷 글을 확인해 보세요.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${RISK_CLASS[item.riskLevel]}`}>
                      {RISK_LABEL[item.riskLevel]}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {new Date(item.createdAt).toLocaleString("ko-KR", {
                        month: "long",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-sm leading-relaxed text-slate-700">{item.preview || item.result.ai.summary}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(restoreAnalysisResult(item))}
                    className="min-h-11 rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-teal-700"
                  >
                    다시 보기
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-red-300 hover:bg-red-50"
                  >
                    지우기
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
