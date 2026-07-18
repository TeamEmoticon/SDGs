// Modal.tsx
// 하단/중앙에서 뜨는 공용 모달 창(배경 클릭·ESC로 닫기 지원)
"use client";

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center p-0 animate-fade sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="modal-surface modal-scroll relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl animate-pop sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-divider sticky top-0 z-10 flex items-center justify-between gap-3 border-b-2 bg-[var(--surface)] px-5 py-4">
          <h2 className="ink text-xl font-extrabold">{title}</h2>
          <button
            onClick={onClose}
            className="history-action rounded-lg px-3 py-1.5 text-sm"
          >
            닫기
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
