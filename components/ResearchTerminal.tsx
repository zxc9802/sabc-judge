"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Log = {
  step: number;
  kind: string;
  actionText: string;
  timestamp: string;
};

export function ResearchTerminal({ id }: { id: string }) {
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [status, setStatus] = useState("researching");
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ searchCount: 0 });
  const scroller = useRef<HTMLDivElement>(null);
  const last = useRef(0);

  useEffect(() => {
    let es: EventSource | null = null;
    let dead = false;

    const connect = () => {
      if (dead) return;
      es = new EventSource(`/api/evaluations/${id}/stream?after=${last.current}`);
      es.addEventListener("log", (ev) => {
        const row = JSON.parse(ev.data) as Log;
        last.current = Math.max(last.current, row.step);
        setLogs((xs) => (xs.some((x) => x.step === row.step) ? xs : [...xs, row]));
      });
      es.addEventListener("status", (ev) => {
        const row = JSON.parse(ev.data) as { status: string; searchCount: number };
        setStatus(row.status);
        setStats({ searchCount: row.searchCount || 0 });
      });
      es.addEventListener("done", () => {
        setStatus("done");
        setTimeout(() => router.push(`/evaluation/${id}/verdict`), 700);
      });
      es.addEventListener("failed", (ev) => {
        const row = JSON.parse(ev.data) as { error?: string };
        setStatus("failed");
        setError(row.error || "取证中断");
      });
      es.onerror = () => {
        es?.close();
        setTimeout(connect, 1200);
      };
    };
    connect();
    return () => {
      dead = true;
      es?.close();
    };
  }, [id, router]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  const verified = logs.filter((l) => l.kind === "evidence").length;
  const warns = logs.filter((l) => l.kind === "warn").length;

  async function retry() {
    await fetch(`/api/evaluations/${id}/retry`, { method: "POST" });
    setError("");
    setStatus("researching");
    setLogs([]);
    last.current = 0;
    window.location.reload();
  }

  return (
    <div className="scanlines min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-[1fr_220px] gap-0">
        <section ref={scroller} className="h-screen overflow-y-auto px-8 py-10">
          <p className="mono mb-8 text-[11px] tracking-[0.38em] text-[#a89263]">ACT II · 取证直播</p>
          <div className="space-y-2 font-mono text-[13.5px] leading-7 tracking-[0.02em] text-[#d7ccb8]">
            {logs.map((l) => (
              <div key={l.step} className="term-line flex gap-3">
                <span className="text-[#5e584e]">{String(l.step).padStart(3, "0")}</span>
                <span className={tone(l.kind)}>▸ {l.actionText}</span>
              </div>
            ))}
            {status !== "done" && status !== "failed" ? (
              <div className="cursor pt-2 text-[#4af626]">等待下一帧</div>
            ) : null}
            {status === "failed" ? (
              <div className="mt-8 border border-[#c41e1e] p-5 text-[#c41e1e]">
                <p>取证中断。{error}</p>
                <button onClick={retry} className="mt-4 border border-[#c41e1e] px-4 py-2 text-xs tracking-[0.16em]">
                  一键重跑
                </button>
              </div>
            ) : null}
          </div>
        </section>
        <aside className="border-l border-[#262626] px-5 py-10">
          <p className="mono text-[10px] tracking-[0.2em] text-[#6f6a61]">OPS</p>
          <div className="mt-6 space-y-6">
            <Stat label="状态" value={labelStatus(status)} />
            <Stat label="检索次数" value={String(stats.searchCount)} />
            <Stat label="已核实批次" value={String(verified)} />
            <Stat label="告警" value={String(warns)} />
          </div>
          <p className="mono mt-16 text-[10px] leading-5 text-[#5e584e]">
            过程本身就是信任来源。
            <br />
            关页重进将从日志续播。
          </p>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.18em] text-[#6f6a61]">{label}</div>
      <div className="mt-1 font-mono text-xl text-[#ece8df]">{value}</div>
    </div>
  );
}

function tone(kind: string) {
  if (kind === "warn") return "text-[#c41e1e]";
  if (kind === "panel") return "text-[#e4d7a5]";
  if (kind === "evidence") return "text-[#9ebe8c]";
  if (kind === "score") return "text-[#d4af37]";
  return "text-[#d7ccb8]";
}

function labelStatus(s: string) {
  return (
    {
      collecting: "COLLECT",
      researching: "LIVE",
      scoring: "SCORE",
      done: "DONE",
      failed: "FAIL",
    }[s] || s
  );
}
