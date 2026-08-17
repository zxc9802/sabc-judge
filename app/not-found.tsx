export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="mono text-[11px] tracking-[0.3em] text-[#a89263]">404</p>
      <h1 className="display mt-4 text-5xl">卷宗不存在</h1>
      <a href="/" className="mono mt-8 text-sm tracking-[0.16em] text-[#d4af37]">
        返回受理台
      </a>
    </main>
  );
}
