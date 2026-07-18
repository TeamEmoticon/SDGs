import RecentChecks from "@/components/RecentChecks";
import Analyzer from "@/components/Analyzer";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <Analyzer />
      <div className="px-4 pb-12 sm:px-6">
        <RecentChecks />
      </div>
    </>
  );
}
