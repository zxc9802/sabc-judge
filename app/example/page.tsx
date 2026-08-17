import { Topbar } from "@/components/Topbar";
import { VerdictView } from "@/components/VerdictView";
import { EXAMPLE_VERDICT } from "@/lib/example-verdict";

export default function ExamplePage() {
  return (
    <main>
      <Topbar act="示例卷宗" />
      <VerdictView data={EXAMPLE_VERDICT} live={false} />
    </main>
  );
}
