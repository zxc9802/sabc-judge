export function Topbar({ act }: { act?: string }) {
  return (
    <header className="flex items-center justify-between px-6 py-4 text-[11px] tracking-[0.22em] uppercase text-[#9a9386]">
      <a href="/" className="mono">
        SABC · 立项裁判
      </a>
      <div className="flex items-center gap-6">
        {act ? <span className="mono text-[#d4af37]">{act}</span> : null}
        <a href="/knowledge">知识库</a>
        <a href="/projects">卷宗</a>
        <a href="/example">示例判决</a>
      </div>
    </header>
  );
}
