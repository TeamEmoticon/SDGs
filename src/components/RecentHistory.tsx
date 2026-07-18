"use client";

import { useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import { RISK_UI } from "@/lib/ui-config";
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
    <section className="section-divider mx-auto mt-12 max-w-2xl border-t-2 pt-7" aria-labelledby="recent-history-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="recent-history-title" className="ink text-xl font-black">
            최근 확인한 글
          </h2>
          <p className="support-copy mt-1">이 기기에만 결과 요약을 저장해요.</p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isClearing}
            className="history-action rounded-xl px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {confirmClear ? "한 번 더 누르면 모두 지워요" : "기록 모두 지우기"}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-5 space-y-3" aria-label="최근 기록을 불러오는 중">
          <div className="shimmer h-20 rounded-xl" />
          <div className="shimmer h-20 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="surface-muted mt-5 border-2 border-dashed border-[var(--line)] p-5 text-center">
          <p className="ink font-extrabold">아직 확인한 글이 없습니다.</p>
          <p className="support-copy mt-1">위에서 문자나 인터넷 글을 확인해 보세요.</p>
        </div>
      ) : (
        <ul className="history-list mt-5">
          {items.map((item) => {
            const risk = RISK_UI[item.riskLevel];
            return (
              <li key={item.id} className="py-5 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`risk-badge ${risk.tone} rounded-full px-2.5 py-1 text-sm`}>
                        {risk.label}
                      </span>
                      <span className="support-copy">
                        {new Date(item.createdAt).toLocaleString("ko-KR", {
                          month: "long",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="ink mt-3 break-words font-semibold leading-relaxed">
                      {item.preview || item.result.ai.summary}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(restoreAnalysisResult(item))}
                      className="button-primary rounded-lg px-3 py-2 text-sm"
                    >
                      다시 보기
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="history-action rounded-lg px-3 py-2 text-sm"
                    >
                      지우기
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
