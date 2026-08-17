import { ensureEvaluationRunning, startResearch } from "@/engine/orchestrator";
import { getEvaluation, listLogs } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const ev = getEvaluation(id);
  if (!ev) {
    return new Response("not found", { status: 404 });
  }

  const url = new URL(req.url);
  const after = Number(url.searchParams.get("after") || "0");

  if (ev.status === "researching" || ev.status === "scoring") {
    void ensureEvaluationRunning(id);
  }

  const encoder = new TextEncoder();
  let last = after;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("hello", { status: ev.status, last });

      const tick = () => {
        if (closed) return;
        try {
          const logs = listLogs(id, last);
          for (const log of logs) {
            last = log.step;
            send("log", log);
          }
          const cur = getEvaluation(id);
          if (!cur) return;
          send("status", { status: cur.status, searchCount: cur.searchCount });
          if (cur.status === "done") {
            send("done", { id, grade: cur.grade, verdict: cur.verdict });
            closed = true;
            controller.close();
            return;
          }
          if (cur.status === "failed") {
            send("failed", { id, error: cur.error });
            closed = true;
            controller.close();
          }
        } catch (err) {
          send("warn", { message: err instanceof Error ? err.message : String(err) });
        }
      };

      tick();
      const iv = setInterval(tick, 900);
      const hb = setInterval(() => send("ping", { t: Date.now() }), 12000);

      const abort = () => {
        closed = true;
        clearInterval(iv);
        clearInterval(hb);
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };
      req.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  await startResearch(id);
  return Response.json({ ok: true });
}
