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
    <Modal open={open} onClose={onClose} title="예시로 연습하기" emoji="💡">
      <p className="mb-4 rounded-2xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">
        아래 예시를 누르면 글이 자동으로 들어가요. &lsquo;이 글 확인하기&rsquo;를 눌러 결과를
        살펴보세요.
      </p>
      <ul className="space-y-3">
        {EXAMPLES.map((ex) => (
          <li key={ex.id}>
            <button
              onClick={() => onPick(ex.content)}
              className="group flex w-full items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 text-left transition hover:border-teal-400 hover:bg-teal-50"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-2xl">
                {ex.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold text-slate-800">{ex.title}</span>
                <span className="block text-sm text-slate-500">{ex.subtitle}</span>
              </span>
              <span className="text-teal-600 opacity-0 transition group-hover:opacity-100" aria-hidden>
                ➜
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={onClose}
        className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3.5 font-bold text-white transition hover:bg-slate-800"
      >
        닫기
      </button>
    </Modal>
  );
}
