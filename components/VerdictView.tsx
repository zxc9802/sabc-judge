import { PERSONAS } from "@/engine/minds/personas";
import { DIMENSION_META, type DimensionKey, type Grade } from "@/engine/types";

export type VerdictViewModel = {
  title: string;
  grade: Grade;
  verdict: string;
  weighted: number;
  customized: boolean;
  shortboard?: string | null;
  fatalFlaw?: string | null;
  roiCalc?: string | null;
  degraded?: string | null;
  dimensions: Array<{
    key: DimensionKey;
    name: string;
    score: number;
    confidence: "high" | "low";
    conclusion: string;
    skipped?: boolean;
    penalized?: string[];
  }>;
  evidence: Array<{
    id: string;
    dimension: string;
    claim: string;
    sourceName: string;
    sourceUrl: string;
    publishedAt?: string | null;
    fetchedAt: string;
    snapshot: string;
    crossValidated: boolean;
    confidence: string;
    sourceLevel: string;
  }>;
  opinions: Array<{
    dimension: string;
    persona: string;
    stance: string;
    argument: string;
    evidenceRefs: string[];
    round: string;
    experiential: boolean;
  }>;
};

const COPY: Record<Grade, string> = {
  S: "立即立项",
  A: "值得做，但有明确短板",
  B: "不建议做",
  C: "完全不可行",
};

export function VerdictView({ data, live = true }: { data: VerdictViewModel; live?: boolean }) {
  const g = data.grade.toLowerCase();
  return (
    <div>
      <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="mono mb-8 text-[11px] tracking-[0.38em] text-[#a89263]">ACT III · 宣判</p>
        <div className={`letter-in display grade-${g} text-[28vw] leading-none sm:text-[220px]`}>{data.grade}</div>
        <p className="rise mt-4 text-2xl text-[#ece8df]" style={{ animationDelay: "0.5s" }}>
          {COPY[data.grade]}
        </p>
        <p className="rise mx-auto mt-6 max-w-xl text-lg leading-8 text-[#b7b0a4]" style={{ animationDelay: "0.8s" }}>
          {data.verdict}
        </p>
        <p className="mono mt-16 animate-pulse text-[10px] tracking-[0.28em] text-[#6f6a61]">向下阅读判决书</p>
      </section>

      <article className="paper-sheet mx-auto min-h-screen max-w-4xl px-8 py-16 sm:px-16">
        <div className="flex items-start justify-between border-b border-[#161410] pb-6">
          <div>
            <p className="mono text-[10px] tracking-[0.28em] text-[#6f6a61]">SABC JUDGMENT</p>
            <h1 className="mt-2 text-3xl">{data.title}</h1>
          </div>
          <div className={`display text-6xl grade-${g}`}>{data.grade}</div>
        </div>

        <p className="mt-8 text-xl leading-9">{data.verdict}</p>
        <p className="mono mt-4 text-[11px] tracking-[0.14em] text-[#6f6a61]">
          加权 {data.weighted.toFixed(1)}
          {data.customized ? " · 已读取公司档案" : " · 市场判断，非为你公司定制的判断"}
          {live ? "" : " · 示例卷宗"}
        </p>

        {!data.customized ? (
          <div className="mt-6 border border-[#161410] px-4 py-3 text-sm">
            公司匹配度未评估。总评级仅基于外部四维。补全知识库后可复评。
          </div>
        ) : null}
        {data.shortboard ? (
          <p className="mt-6 text-sm">
            <b>升 S 短板：</b>
            {data.shortboard}
          </p>
        ) : null}
        {data.fatalFlaw ? (
          <p className="mt-6 text-sm">
            <b>致命缺陷：</b>
            {data.fatalFlaw}
          </p>
        ) : null}
        {data.roiCalc ? (
          <p className="mt-6 text-sm">
            <b>投入产出测算：</b>
            {data.roiCalc}
          </p>
        ) : null}
        {data.degraded ? (
          <p className="mt-4 text-sm text-[#8a3b12]">取证深度降级：{data.degraded}</p>
        ) : null}

        <div className="mt-14 space-y-10">
          {data.dimensions.map((d) => {
            const ev = data.evidence.filter((e) => e.dimension === d.key);
            const panel = data.opinions.filter((o) => o.dimension === d.key);
            return (
              <section key={d.key} className="border-t border-[#cfc6b6] pt-8">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-2xl">{d.name}</h2>
                  <div className="mono text-sm">
                    {d.skipped ? <span className="text-[#8a8478]">未评估</span> : <span>{d.score.toFixed(1)} / 10</span>}
                    {!d.skipped ? (
                      <span className="ml-3">{d.confidence === "high" ? "高置信" : "⚠ 低置信度"}</span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-4 leading-8">{d.conclusion}</p>
                {d.penalized?.length ? (
                  <p className="mt-2 text-xs text-[#8a3b12]">{d.penalized.join("；")}</p>
                ) : null}

                <details className="mt-6">
                  <summary className="mono cursor-pointer text-[11px] tracking-[0.16em]">合议纪要</summary>
                  <div className="mt-4 space-y-4">
                    {panel
                      .filter((o) => o.round !== "clash")
                      .map((o, i) => (
                        <div key={i} className="border-l-2 border-[#161410] pl-4 text-sm leading-7">
                          <div className="mono text-[10px] tracking-[0.14em]">
                            {PERSONAS[o.persona]?.name || (o.persona === "facilitator" ? "主持人" : o.persona)}
                            {" · "}
                            {o.stance === "support" ? "支持" : o.stance === "oppose" ? "反对" : "警告"}
                            {o.experiential ? " · 经验判断" : ""}
                          </div>
                          <p className="mt-1">{o.argument}</p>
                        </div>
                      ))}
                  </div>
                </details>

                <details className="mt-3">
                  <summary className="mono cursor-pointer text-[11px] tracking-[0.16em]">
                    证据条目 {ev.length}
                  </summary>
                  <ul className="mt-4 space-y-4">
                    {ev.map((e) => (
                      <li key={e.id} className="border border-[#cfc6b6] p-4 text-sm">
                        <div className="mono text-[10px] text-[#6f6a61]">
                          {e.id} · {e.sourceName} · {level(e.sourceLevel)} ·{" "}
                          {e.crossValidated ? "交叉验证通过" : "⚠ 低置信度"} · 抓取 {e.fetchedAt.slice(0, 16).replace("T", " ")}
                        </div>
                        <p className="mt-2">{e.claim}</p>
                        <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs underline">
                          {e.sourceUrl}
                        </a>
                        <p className="mt-2 text-xs text-[#6f6a61]">{e.snapshot}</p>
                      </li>
                    ))}
                    {ev.length === 0 ? <p className="text-sm text-[#6f6a61]">本维无合格证据，结论未入报告。</p> : null}
                  </ul>
                </details>
              </section>
            );
          })}
        </div>

        <p className="mono mt-16 text-center text-[10px] tracking-[0.18em] text-[#6f6a61]">
          立项裁判不是算命。没有来源的句子，不会出现在这里。
        </p>
      </article>
    </div>
  );
}

function level(s: string) {
  return { official: "官方", media: "媒体", ugc: "自媒体", unknown: "未分级" }[s] || s;
}

export { DIMENSION_META };
