import type { FactCheckResult, FactCheckVerdict } from "@/lib/types";

interface Props {
  factCheck: FactCheckResult;
}

const FACT_CHECK_META: Record<FactCheckVerdict, { label: string; description: string }> = {
  supported: {
    label: "확인한 근거와 내용이 대체로 같습니다.",
    description: "검색으로 연결된 공개 자료가 이 주장을 뒷받침합니다.",
  },
  contradicted: {
    label: "확인한 공식 근거와 내용이 다릅니다.",
    description: "공식 기관이나 신뢰할 수 있는 원문을 다시 확인해 주세요.",
  },
  mixed: {
    label: "맞는 내용과 확인이 더 필요한 내용이 섞여 있습니다.",
    description: "일부 내용만 맞을 수 있으니 출처를 열어 전체 맥락을 확인해 주세요.",
  },
  insufficient_evidence: {
    label: "판단하기에 연결된 근거가 충분하지 않습니다.",
    description: "이 결과만 믿고 금전·건강·안전에 관한 결정을 내리지는 마세요.",
  },
};

export default function FactCheckResultView({ factCheck }: Props) {
  const meta = FACT_CHECK_META[factCheck.verdict];
  const evidenceMessage =
    factCheck.evidenceStrength === "linked"
      ? "아래 출처와 연결된 근거를 확인했습니다."
      : "출처는 찾았지만, 이 주장과 직접 연결된 근거는 충분하지 않았습니다.";

  return (
    <section className="section-divider mt-7 border-t-2 pt-6" aria-live="polite">
      <h2 className="ink text-xl font-black">사실 확인 결과</h2>
      <p className="ink mt-3 text-lg font-black leading-relaxed">{meta.label}</p>
      <p className="ink mt-3 text-lg font-semibold leading-relaxed">{factCheck.explanation}</p>
      <p className="surface-muted ink mt-4 rounded-lg px-3 py-3 font-bold leading-relaxed">
        확인한 주장: “{factCheck.claimQuote}”
      </p>
      <p className="support-copy mt-3 leading-relaxed">{evidenceMessage} {meta.description}</p>
    </section>
  );
}
