"use client";

import { Topbar } from "@/components/Topbar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  title: string;
  createdAt: string;
  evaluations: Array<{
    id: string;
    status: string;
    grade: string | null;
    verdict: string | null;
    createdAt: string;
  }>;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((j) => setProjects(j.projects || []));
  }, []);

  function toggle(id: string) {
    setPicked((xs) => {
      if (xs.includes(id)) return xs.filter((x) => x !== id);
      if (xs.length >= 2) return [xs[1], id];
      return [...xs, id];
    });
  }

  const doneIds = projects.flatMap((p) =>
    p.evaluations.filter((e) => e.status === "done" && e.grade).map((e) => e.id),
  );

  return (
    <main>
      <Topbar act="卷宗" />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-end justify-between">
          <h1 className="display text-4xl">项目卷宗</h1>
          <button
            disabled={picked.length !== 2}
            onClick={() => router.push(`/compare?a=${picked[0]}&b=${picked[1]}`)}
            className="mono border border-[#d4af37] px-4 py-2 text-[11px] tracking-[0.16em] text-[#d4af37] disabled:opacity-30"
          >
            对比已选两项
          </button>
        </div>
        <p className="mt-3 text-sm text-[#7d776c]">勾选两个已宣判项目，看五维并排。</p>
        <div className="mt-10 space-y-4">
          {projects.length === 0 ? (
            <p className="text-[#7d776c]">
              还没有卷宗。去 <a href="/" className="text-[#d4af37]">受理</a> 或先看{" "}
              <a href="/example" className="text-[#d4af37]">示例判决</a>。
            </p>
          ) : null}
          {projects.map((p) => {
            const ev = p.evaluations[0];
            const done = ev?.status === "done" && ev.grade;
            return (
              <div key={p.id} className="court-frame flex items-center justify-between p-5">
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    disabled={!done}
                    checked={Boolean(ev && picked.includes(ev.id))}
                    onChange={() => ev && toggle(ev.id)}
                    className="mt-2"
                  />
                  <div>
                    <div className="text-lg">{p.title}</div>
                    <div className="mono mt-1 text-[11px] text-[#7d776c]">
                      {ev?.status || "无评级"} · {p.createdAt.slice(0, 10)}
                    </div>
                    {ev?.verdict ? <p className="mt-2 text-sm text-[#b7b0a4]">{ev.verdict}</p> : null}
                  </div>
                </div>
                {ev?.grade ? (
                  <a href={`/evaluation/${ev.id}/verdict`} className={`display text-4xl grade-${ev.grade.toLowerCase()}`}>
                    {ev.grade}
                  </a>
                ) : ev ? (
                  <a href={`/evaluation/${ev.id}/research`} className="mono text-xs text-[#a89263]">
                    进入取证
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-8 hidden">{doneIds.length}</p>
      </div>
    </main>
  );
}
