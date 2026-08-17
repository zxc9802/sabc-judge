import { Topbar } from "@/components/Topbar";
import { Intake } from "@/components/Intake";
import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <Topbar act="第一幕 · 受理" />
      <Intake />
      <div className="mx-auto max-w-3xl px-6 pb-12 text-center text-[13px] text-[#7d776c]">
        第一次来？先看一份{" "}
        <Link href="/example" className="text-[#d4af37]">
          预置判决书
        </Link>
        ，三秒知道产品交出什么。
      </div>
    </main>
  );
}
