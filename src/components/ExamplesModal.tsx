// ExamplesModal.tsx
// 연습용 예시 문자 목록을 보여주고, 고르면 입력창에 채워주는 모달
"use client";

import Modal from "./Modal";
import { EXAMPLES } from "@/lib/examples";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (content: string) => void;
}

export default function ExamplesModal({ open, onClose, onPick }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="예시로 연습하기">
      <p className="surface-muted ink-muted mb-4 p-4 font-semibold leading-relaxed">
        아래 예시를 누르면 글이 자동으로 들어가요. &lsquo;이 글 확인하기&rsquo;를 눌러 결과를
        살펴보세요.
      </p>
      <ul className="space-y-3">
        {EXAMPLES.map((ex) => (
          <li key={ex.id}>
            <button
              onClick={() => onPick(ex.content)}
              className="surface-panel flex w-full items-center gap-3 rounded-xl p-4 text-left transition hover:bg-[var(--surface-muted)]"
            >
              <span className="min-w-0 flex-1">
                <span className="ink block font-extrabold">{ex.title}</span>
                <span className="support-copy block">{ex.subtitle}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={onClose}
        className="button-primary mt-5 w-full rounded-xl px-5 py-3.5"
      >
        닫기
      </button>
    </Modal>
  );
}
