"use client";

import Modal from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    emoji: "1️⃣",
    title: "글을 붙여넣거나 주소를 넣어요",
    desc: "걱정되는 문자나 인터넷 글을 통째로 복사해 넣거나, 페이지 주소만 적어도 돼요.",
  },
  {
    emoji: "2️⃣",
    title: "&lsquo;이 글 확인하기&rsquo;를 눌러요",
    desc: "전화번호·계좌번호·인증번호는 자동으로 ●로 가려진 뒤 검사가 시작돼요.",
  },
  {
    emoji: "3️⃣",
    title: "결과를 확인해요",
    desc: "쉬운 말 요약과 함께 위험 단계(안전·주의·위험·고위험)가 색깔로 표시돼요.",
  },
  {
    emoji: "4️⃣",
    title: "의심되면 전화해요",
    desc: "위험·고위험이면 돈을 보내지 말고 112(경찰)나 1332(금융사기 상담)로 확인하세요.",
  },
];

const TIPS = [
  "은행·경찰·검찰은 전화나 문자로 비밀번호·OTP를 절대 묻지 않아요.",
  "당첨·환급을 핑계로 링크를 누르라고 하면 일단 의심하세요.",
  "가족이 번호를 바꿨다며 돈을 요구하면, 꼭 전화로 목소리를 확인하세요.",
  "모르는 링크는 누르지 말고, 앱은 공식 스토어에서만 설치하세요.",
];

export default function HelpModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="사용 방법" emoji="📖">
      <ol className="space-y-4">
        {STEPS.map((s) => (
          <li key={s.title} className="flex gap-3">
            <span className="text-2xl" aria-hidden>
              {s.emoji}
            </span>
            <div>
              <p
                className="font-extrabold text-slate-800"
                dangerouslySetInnerHTML={{ __html: s.title }}
              />
              <p className="text-sm leading-relaxed text-slate-600">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-2xl bg-teal-50 p-4">
        <p className="mb-2 font-extrabold text-teal-800">💡 꼭 기억하세요</p>
        <ul className="space-y-1.5 text-sm text-teal-900">
          {TIPS.map((t) => (
            <li key={t} className="flex gap-2">
              <span aria-hidden>✓</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <a
          href="tel:112"
          className="rounded-2xl bg-red-600 px-4 py-3 text-center font-bold text-white"
        >
          🚨 112 경찰
        </a>
        <a
          href="tel:1332"
          className="rounded-2xl bg-teal-600 px-4 py-3 text-center font-bold text-white"
        >
          ☎️ 1332 금융상담
        </a>
      </div>

      <button
        onClick={onClose}
        className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3.5 font-bold text-white transition hover:bg-slate-800"
      >
        알겠어요
      </button>
    </Modal>
  );
}
