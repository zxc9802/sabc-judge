"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string };

export function Intake() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (!text.trim() && files.length === 0) return;
    setBusy(true);
    setError("");
    const userText = text.trim() || `上传 ${files.map((f) => f.name).join("、")}`;
    setMsgs((m) => [...m, { role: "user", content: userText }]);
    setText("");
    try {
      const form = new FormData();
      form.set("text", userText);
      if (evaluationId) form.set("evaluationId", evaluationId);
      for (const f of files) form.append("files", f);
      const res = await fetch("/api/intake", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "立案失败");
      setEvaluationId(json.evaluationId);
      setFiles([]);
      setMsgs((m) => [...m, { role: "assistant", content: json.assistantMessage }]);
      if (json.ready) {
        router.push(`/evaluation/${json.evaluationId}/research`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const next = Array.from(e.dataTransfer.files || []);
    if (next.length) setFiles((f) => [...f, ...next]);
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-3xl flex-col px-6 pb-10">
      <div className="flex flex-1 flex-col justify-center">
        {msgs.length === 0 ? (
          <div className="rise mb-16 text-center">
            <p className="mono mb-6 text-[11px] tracking-[0.38em] text-[#a89263]">ACT I · 受理</p>
            <h1 className="display text-[42px] leading-[1.15] text-[#f3efe6] sm:text-[58px]">
              说出你的项目。
            </h1>
            <p className="mx-auto mt-6 max-w-md text-[15px] leading-7 text-[#9a9386]">
              拖入文档，或像跟书记员说话一样讲清楚这件事。
              <br />
              判决只认证据。没有来源的结论，不会写进报告。
            </p>
          </div>
        ) : (
          <div ref={box} className="mb-8 max-h-[52vh] space-y-6 overflow-y-auto pr-1">
            {msgs.map((m, i) => (
              <div key={i} className="rise">
                <div className="mono mb-2 text-[10px] tracking-[0.2em] text-[#7d776c]">
                  {m.role === "user" ? "提案人" : "书记员"}
                </div>
                <p className="whitespace-pre-wrap text-[17px] leading-8 text-[#ece8df]">{m.content}</p>
              </div>
            ))}
            {busy ? <p className="mono cursor text-sm text-[#a89263]">正在阅卷</p> : null}
          </div>
        )}

        <form onSubmit={submit} className="court-frame bg-[#0c0c0c]/70 p-4 backdrop-blur-sm">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={`mb-3 border border-dashed px-3 py-2 text-xs text-[#8a8478] ${
              drag ? "border-[#d4af37] text-[#d4af37]" : "border-[#2e2c28]"
            }`}
          >
            <label className="mono cursor-pointer tracking-[0.14em]">
              拖入 PDF / Word / PPT，或点击选择
              <input
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
                onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files || [])])}
              />
            </label>
            {files.length ? (
              <span className="ml-3 text-[#d4af37]">{files.map((f) => f.name).join(" · ")}</span>
            ) : null}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            rows={4}
            placeholder="例如：我们想在抖音做功能性内衣小店，客单价 199，打算投 80 万，三个月出结果……"
            className="w-full resize-none bg-transparent text-[16px] leading-7 placeholder:text-[#5c574e]"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="mono text-[10px] text-[#6f6a61]">⌘ + Enter 提交 · 最多追问两轮</span>
            <button
              disabled={busy}
              className="mono border border-[#d4af37] bg-[#d4af37] px-5 py-2 text-[11px] tracking-[0.2em] text-[#111] disabled:opacity-50"
            >
              {evaluationId ? "补充并继续" : "开始评级"}
            </button>
          </div>
        </form>
        {error ? <p className="mt-3 text-sm text-[#c41e1e]">{error}</p> : null}
      </div>
    </div>
  );
}
