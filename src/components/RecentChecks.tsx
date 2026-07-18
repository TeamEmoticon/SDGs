// RecentChecks.tsx
// 홈 화면 하단에 최근 확인한 글 목록을 DB에서 불러와 보여주는 서버 컴포넌트
import { db } from "@/db";
import { analyses } from "@/db/schema";
import { desc } from "drizzle-orm";
import { RISK_UI } from "@/lib/ui-config";
import type { RiskLevel } from "@/lib/types";

async function getRecent() {
  try {
    return await db
      .select({
        id: analyses.id,
        riskLevel: analyses.riskLevel,
        infoType: analyses.infoType,
        inputType: analyses.inputType,
        maskedText: analyses.maskedText,
        createdAt: analyses.createdAt,
      })
      .from(analyses)
      .orderBy(desc(analyses.createdAt))
      .limit(6);
  } catch {
    return [];
  }
}

function preview(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean || "(내용 없음)";
}

export default async function RecentChecks() {
  const rows = await getRecent();
  if (rows.length === 0) return null;

  return (
    <section className="mx-auto mt-12 max-w-5xl px-1">
      <div className="mb-4">
        <h2 className="text-lg font-extrabold text-slate-800">최근에 확인한 글</h2>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const level = (r.riskLevel as RiskLevel) in RISK_UI ? (r.riskLevel as RiskLevel) : "caution";
          const ui = RISK_UI[level];
          return (
            <li
              key={r.id}
              className={`rounded-2xl border p-4 ${ui.banner} ${ui.bannerText}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ui.chip}`}>
                  {ui.label}
                </span>
                <span className="text-xs text-slate-500">
                  {r.createdAt.toLocaleDateString("ko-KR", {
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-700">
                {preview(r.maskedText)}
              </p>
              {r.infoType && (
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {r.inputType === "url" ? "주소" : "문자"} · {r.infoType}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
