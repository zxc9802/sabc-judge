import { run } from "./db";

export function resetEvaluationArtifacts(evaluationId: string) {
  run("DELETE FROM evidence WHERE evaluation_id = ?", [evaluationId]);
  run("DELETE FROM panel_opinions WHERE evaluation_id = ?", [evaluationId]);
  run("DELETE FROM research_logs WHERE evaluation_id = ?", [evaluationId]);
}
