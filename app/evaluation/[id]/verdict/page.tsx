import { Topbar } from "@/components/Topbar";
import { VerdictView, type VerdictViewModel } from "@/components/VerdictView";
import { getEvaluation, getProject, listEvidence, listOpinions } from "@/lib/store";
import { notFound, redirect } from "next/navigation";
import type { Grade } from "@/engine/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function VerdictPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ev = getEvaluation(id);
  if (!ev) notFound();
  if (ev.status === "researching" || ev.status === "scoring" || ev.status === "collecting") {
    redirect(`/evaluation/${id}/research`);
  }
  const project = getProject(ev.projectId);
  const data = toView(ev, project?.title || "未命名提案");
  return (
    <main>
      <Topbar act="第三幕 · 宣判" />
      {ev.status === "failed" ? (
        <div className="mx-auto max-w-xl px-6 py-24 text-center">
          <p className="display text-6xl text-[#c41e1e]">中断</p>
          <p className="mt-6 text-[#b7b0a4]">{ev.error || "取证中断"}</p>
          <a href={`/evaluation/${id}/research`} className="mono mt-8 inline-block border border-[#c41e1e] px-5 py-2 text-xs tracking-[0.2em] text-[#c41e1e]">
            返回重跑
          </a>
        </div>
      ) : (
        <VerdictView data={data} />
      )}
    </main>
  );
}

function toView(
  ev: NonNullable<ReturnType<typeof getEvaluation>>,
  title: string,
): VerdictViewModel {
  const dimensions = JSON.parse(ev.dimensions || "[]");
  const evidence = listEvidence(ev.id).map((e) => ({
    ...e,
    crossValidated: Boolean(e.crossValidated),
  }));
  const opinions = listOpinions(ev.id).map((o) => ({
    dimension: o.dimension,
    persona: o.persona,
    stance: o.stance,
    argument: o.argument,
    evidenceRefs: JSON.parse(o.evidenceRefs || "[]"),
    round: o.round,
    experiential: Boolean(o.experiential),
  }));
  return {
    title,
    grade: (ev.grade as Grade) || "B",
    verdict: ev.verdict || "",
    weighted: Number(ev.weighted || 0),
    customized: Boolean(ev.customized),
    shortboard: ev.shortboard,
    fatalFlaw: ev.fatalFlaw,
    roiCalc: ev.roiCalc,
    degraded: ev.degraded,
    dimensions,
    evidence,
    opinions,
  };
}
