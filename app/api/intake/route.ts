import { NextResponse } from "next/server";
import { runIntake, type IntakeResult } from "@/engine/intake";
import { startResearch } from "@/engine/orchestrator";
import { parseUploadedFile } from "@/lib/parse";
import {
  createEvaluation,
  createProject,
  getEvaluation,
  getProject,
  hasKnowledge,
  setEvaluation,
  updateProject,
} from "@/lib/store";
import type { ChatMessage, Essentials } from "@/engine/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let text = "";
    let evaluationId: string | undefined;
    let skipKnowledge = false;
    const docs: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      text = String(form.get("text") || "");
      evaluationId = String(form.get("evaluationId") || "") || undefined;
      skipKnowledge = String(form.get("skipKnowledge") || "") === "1";
      const files = form.getAll("files").filter((f): f is File => f instanceof File);
      for (const file of files) {
        const parsed = await parseUploadedFile(file);
        if (parsed.error || !parsed.text) {
          docs.push(`【${file.name} 解析失败，请改粘贴文本】`);
        } else {
          docs.push(`【文档 ${file.name}】\n${parsed.text}`);
        }
      }
    } else {
      const body = (await req.json()) as {
        text?: string;
        evaluationId?: string;
        skipKnowledge?: boolean;
      };
      text = body.text || "";
      evaluationId = body.evaluationId;
      skipKnowledge = Boolean(body.skipKnowledge);
    }

    if (!text.trim() && !docs.length) {
      return NextResponse.json({ error: "请先说出想法或上传文档" }, { status: 400 });
    }

    let projectId: string;
    let evId: string;
    let dialogue: ChatMessage[] = [];
    let previous: Essentials | undefined;
    let round = 0;
    let sourceDocs: unknown[] = [];

    if (evaluationId) {
      const ev = getEvaluation(evaluationId);
      if (!ev) return NextResponse.json({ error: "立案不存在" }, { status: 404 });
      const project = getProject(ev.projectId);
      if (!project) return NextResponse.json({ error: "提案不存在" }, { status: 404 });
      projectId = project.id;
      evId = ev.id;
      dialogue = JSON.parse(project.dialogue || "[]");
      sourceDocs = JSON.parse(project.sourceDocs || "[]");
      previous = {
        what: project.what,
        targetCustomer: project.targetCustomer,
        revenueModel: project.revenueModel,
        budget: project.budget,
        timeline: project.timeline,
      };
      round = ev.intakeRound || 0;
    } else {
      projectId = createProject("未命名提案");
      evId = createEvaluation(projectId, hasKnowledge() && !skipKnowledge);
    }

    dialogue.push({ role: "user", content: text.trim() || "（仅上传文档）" });

    const result: IntakeResult = await runIntake({
      dialogue,
      latestUser: text,
      docsText: docs.join("\n\n"),
      previous,
      round,
    });

    dialogue.push({ role: "assistant", content: result.assistantMessage });
    updateProject(projectId, {
      title: result.title,
      essentials: result.essentials,
      assumed: result.assumed,
      dialogue,
      sourceDocs: docs.length ? [...sourceDocs, { at: new Date().toISOString(), chars: docs.join("").length }] : sourceDocs,
    });

    const nextRound = result.ready ? round : round + 1;
    setEvaluation(evId, { intakeRound: nextRound });

    if (result.ready) {
      void startResearch(evId);
    }

    return NextResponse.json({
      evaluationId: evId,
      projectId,
      ready: result.ready,
      missing: result.missing,
      title: result.title,
      essentials: result.essentials,
      assistantMessage: result.assistantMessage,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
