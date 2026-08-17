"use client";

import { Topbar } from "@/components/Topbar";
import { useCallback, useEffect, useState } from "react";

type Doc = {
  id: string;
  filename: string;
  kind: string;
  status: string;
  error: string | null;
  summary: string;
  chunk_count: number;
  created_at: string;
};

type Hit = { id: string; heading: string; text: string; filename: string; score: number };

export default function KnowledgePage() {
  const [form, setForm] = useState({
    mainBusiness: "",
    teamCapability: "",
    resources: "",
    strategy: "",
    redLines: "",
  });
  const [saved, setSaved] = useState(false);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [notice, setNotice] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [asking, setAsking] = useState(false);

  const loadDocs = useCallback(() => {
    fetch("/api/knowledge/docs")
      .then((r) => r.json())
      .then((j) => setDocs(j.docs || []));
  }, []);

  useEffect(() => {
    fetch("/api/knowledge")
      .then((r) => r.json())
      .then((j) =>
        setForm({
          mainBusiness: j.mainBusiness || "",
          teamCapability: j.teamCapability || "",
          resources: j.resources || "",
          strategy: j.strategy || "",
          redLines: j.redLines || "",
        }),
      );
    loadDocs();
  }, [loadDocs]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaved(true);
  }

  async function ingest(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    setNotice(`正在切片 ${files.length} 个文件…`);
    const formData = new FormData();
    for (const f of files) formData.append("files", f);
    try {
      const res = await fetch("/api/knowledge/ingest", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "入库失败");
      const ok = (json.results || []).filter((r: { ok: boolean }) => r.ok).length;
      const fail = (json.results || []).filter((r: { ok: boolean; error?: string }) => !r.ok);
      setNotice(
        fail.length
          ? `完成 ${ok} 个；失败：${fail.map((f: { filename: string; error?: string }) => `${f.filename} ${f.error}`).join("；")}`
          : `已切片并写入 FAISS / Qdrant 全量库，共 ${ok} 个文件`,
      );
      loadDocs();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setAsking(true);
    try {
      const res = await fetch("/api/knowledge/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const json = await res.json();
      setHits(json.hits || []);
    } finally {
      setAsking(false);
    }
  }

  const field = (key: keyof typeof form, label: string, hint: string) => (
    <label className="block">
      <div className="mono text-[11px] tracking-[0.18em] text-[#a89263]">{label}</div>
      <p className="mb-2 mt-1 text-xs text-[#7d776c]">{hint}</p>
      <textarea
        rows={4}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full border border-[#2e2c28] bg-transparent p-3 text-[15px] leading-7"
      />
    </label>
  );

  return (
    <main>
      <Topbar act="公司档案" />
      <div className="mx-auto max-w-3xl space-y-12 px-6 py-12">
        <header>
          <h1 className="display text-4xl">公司知识库</h1>
          <p className="mt-3 text-[#9a9386]">
            文档、图片、视频直接拖入。gpt-5.6-luna 切片，embedding 写入 FAISS 热缓存与 Qdrant 全量库。提问时 BM25 + 向量双路检索。
          </p>
        </header>

        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            ingest(Array.from(e.dataTransfer.files || []));
          }}
          className={`court-frame min-h-[220px] px-6 py-12 text-center ${drag ? "border-[#d4af37]" : ""}`}
        >
          <p className="mono text-[11px] tracking-[0.28em] text-[#a89263]">DROP ZONE</p>
          <p className="mt-4 text-xl">把档案拖到这里</p>
          <p className="mt-2 text-sm text-[#7d776c]">PDF / Word / PPT / 图片 / 视频</p>
          <label className="mono mt-6 inline-block cursor-pointer border border-[#d4af37] px-5 py-2 text-[11px] tracking-[0.18em] text-[#d4af37]">
            {busy ? "切片中…" : "选择文件"}
            <input
              type="file"
              multiple
              className="hidden"
              disabled={busy}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm,.mkv"
              onChange={(e) => ingest(Array.from(e.target.files || []))}
            />
          </label>
          {notice ? <p className="mt-6 text-sm text-[#c4a35a]">{notice}</p> : null}
        </section>

        {docs.length ? (
          <section className="space-y-3">
            {docs.map((d) => (
              <div key={d.id} className="flex items-start justify-between border border-[#2e2c28] px-4 py-3">
                <div>
                  <div className="text-[15px]">{d.filename}</div>
                  <div className="mono mt-1 text-[10px] tracking-[0.12em] text-[#7d776c]">
                    {d.kind} · {d.status} · {d.chunk_count} 切片
                    {d.summary ? ` · ${d.summary}` : ""}
                  </div>
                  {d.error ? <p className="mt-1 text-xs text-[#c41e1e]">{d.error}</p> : null}
                </div>
                <button
                  className="mono text-[10px] tracking-[0.14em] text-[#8a8478]"
                  onClick={async () => {
                    await fetch(`/api/knowledge/docs/${d.id}`, { method: "DELETE" });
                    loadDocs();
                  }}
                >
                  删除
                </button>
              </div>
            ))}
          </section>
        ) : null}

        <form onSubmit={ask} className="court-frame p-4">
          <div className="mono text-[11px] tracking-[0.18em] text-[#a89263]">试检索 · BM25 + FAISS</div>
          <div className="mt-3 flex gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="例如：我们现在的获客成本和红线是什么？"
              className="flex-1 bg-transparent text-[15px] placeholder:text-[#5c574e]"
            />
            <button className="mono border border-[#d4af37] px-4 py-2 text-[11px] tracking-[0.16em] text-[#d4af37]">
              {asking ? "检索中" : "问档案"}
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {hits.map((h) => (
              <div key={h.id} className="border-t border-[#2e2c28] pt-3 text-sm leading-7">
                <div className="mono text-[10px] text-[#7d776c]">
                  {h.filename} · {h.heading}
                </div>
                <p className="mt-1 text-[#ece8df]">{h.text}</p>
              </div>
            ))}
          </div>
        </form>

        <form onSubmit={save} className="space-y-8">
          <h2 className="display text-2xl">五块引导式档案</h2>
          <p className="text-sm text-[#7d776c]">可跳过。跳过且无切片时，公司匹配度灰显「未评估」。</p>
          {field("mainBusiness", "01 主营业务", "现在靠什么赚钱，核心品类与渠道。")}
          {field("teamCapability", "02 团队能力", "你们真正擅长的事，以及明显短板。")}
          {field("resources", "03 可投入资源", "钱、人、货盘、牌照、渠道关系。")}
          {field("strategy", "04 战略方向", "未来 12-24 个月想成为什么，不想成为什么。")}
          {field("redLines", "05 红线", "绝对不碰的品类、模式、合规与道德边界。")}
          <button className="mono border border-[#d4af37] bg-[#d4af37] px-6 py-3 text-[11px] tracking-[0.2em] text-[#111]">
            存档
          </button>
          {saved ? <span className="ml-4 text-sm text-[#9ebe8c]">已写入。</span> : null}
        </form>
      </div>
    </main>
  );
}
