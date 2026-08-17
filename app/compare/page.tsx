"use client";

import { Topbar } from "@/components/Topbar";
import { DIMENSION_META, type DimensionKey } from "@/engine/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type Ev = {
  id: string;
  grade: string | null;
  verdict: string | null;
  weighted: string | null;
  dimensions: string | null;
};

function Inner() {
  const sp = useSearchParams();
  const a = sp.get("a");
  const b = sp.get("b");
  const [data, setData] = useState<{ left: Ev; right: Ev } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!a || !b) return;
    fetch(`/api/compare?a=${a}&b=${b}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "对比失败");
        setData(j);
      })
      .catch((e) => setErr(e.message));
  }, [a, b]);

  if (err) return <p className="px-6 py-20 text-center text-[#c41e1e]">{err}</p>;
  if (!data) return <p className="mono px-6 py-20 text-center text-[#7d776c]">装订卷宗…</p>;

  const left = JSON.parse(data.left.dimensions || "[]") as Array<{
    key: DimensionKey;
    name: string;
    score: number;
    skipped?: boolean;
  }>;
  const right = JSON.parse(data.right.dimensions || "[]") as Array<{
    key: DimensionKey;
    name: string;
    score: number;
    skipped?: boolean;
  }>;

  const keys = Object.keys(DIMENSION_META) as DimensionKey[];

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="display text-4xl">并排裁决</h1>
      <div className="mt-10 grid grid-cols-2 gap-6">
        <Col ev={data.left} />
        <Col ev={data.right} />
      </div>
      <table className="mt-12 w-full border-collapse text-sm">
        <thead>
          <tr className="mono text-left text-[11px] tracking-[0.16em] text-[#7d776c]">
            <th className="border-b border-[#2e2c28] py-3">维度</th>
            <th className="border-b border-[#2e2c28] py-3">左</th>
            <th className="border-b border-[#2e2c28] py-3">右</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const L = left.find((d) => d.key === k);
            const R = right.find((d) => d.key === k);
            return (
              <tr key={k}>
                <td className="border-b border-[#2e2c28] py-4">{DIMENSION_META[k].name}</td>
                <td className="border-b border-[#2e2c28] py-4">{fmt(L)}</td>
                <td className="border-b border-[#2e2c28] py-4">{fmt(R)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Col({ ev }: { ev: Ev }) {
  return (
    <a href={`/evaluation/${ev.id}/verdict`} className="court-frame p-6">
      <div className={`display text-6xl grade-${(ev.grade || "b").toLowerCase()}`}>{ev.grade}</div>
      <p className="mt-4 text-[#b7b0a4]">{ev.verdict}</p>
      <p className="mono mt-3 text-[11px] text-[#7d776c]">加权 {ev.weighted}</p>
    </a>
  );
}

function fmt(d?: { score: number; skipped?: boolean }) {
  if (!d) return "—";
  if (d.skipped) return "未评估";
  return d.score.toFixed(1);
}

export default function ComparePage() {
  return (
    <main>
      <Topbar act="对比" />
      <Suspense>
        <Inner />
      </Suspense>
    </main>
  );
}
