import { Topbar } from "@/components/Topbar";
import { ResearchTerminal } from "@/components/ResearchTerminal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ResearchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main>
      <Topbar act="第二幕 · 取证" />
      <ResearchTerminal id={id} />
    </main>
  );
}
