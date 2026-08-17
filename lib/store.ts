import { nanoid } from "nanoid";
import { all, get, LOCAL_COMPANY_ID, nowIso, run } from "./db";
import type {
  ChatMessage,
  CompanyProfile,
  DimensionScore,
  Essentials,
  EvaluationStatus,
  EvidenceRecord,
  PanelOpinionRecord,
  ResearchLogKind,
  VerdictPayload,
} from "@/engine/types";

export type CompanyRow = {
  id: string;
  main_business: string;
  team_capability: string;
  resources: string;
  strategy: string;
  red_lines: string;
  extra_docs: string;
  updated_at: string;
};

export type ProjectRow = {
  id: string;
  company_id: string;
  title: string;
  what: string | null;
  target_customer: string | null;
  revenue_model: string | null;
  budget: string | null;
  timeline: string | null;
  assumed: string;
  source_docs: string;
  dialogue: string;
  created_at: string;
};

export type EvaluationRow = {
  id: string;
  project_id: string;
  company_id: string | null;
  status: string;
  grade: string | null;
  verdict: string | null;
  weighted: string | null;
  dimensions: string | null;
  shortboard: string | null;
  fatal_flaw: string | null;
  roi_calc: string | null;
  customized: number;
  degraded: string | null;
  error: string | null;
  search_count: number;
  intake_round: number;
  created_at: string;
  updated_at: string;
};

export type EvidenceRow = {
  id: string;
  evaluation_id: string;
  dimension: string;
  claim: string;
  source_name: string;
  source_url: string;
  published_at: string | null;
  fetched_at: string;
  snapshot: string;
  cross_validated: number;
  confidence: string;
  source_level: string;
};

export type OpinionRow = {
  id: string;
  evaluation_id: string;
  dimension: string;
  persona: string;
  stance: string;
  argument: string;
  evidence_refs: string;
  round: string;
  experiential: number;
};

export type LogRow = {
  id: number;
  evaluation_id: string;
  step: number;
  kind: string;
  action_text: string;
  timestamp: string;
};

function mapCompany(c: CompanyRow) {
  return {
    id: c.id,
    mainBusiness: c.main_business,
    teamCapability: c.team_capability,
    resources: c.resources,
    strategy: c.strategy,
    redLines: c.red_lines,
    extraDocs: c.extra_docs,
    updatedAt: c.updated_at,
  };
}

function mapProject(p: ProjectRow) {
  return {
    id: p.id,
    companyId: p.company_id,
    title: p.title,
    what: p.what,
    targetCustomer: p.target_customer,
    revenueModel: p.revenue_model,
    budget: p.budget,
    timeline: p.timeline,
    assumed: p.assumed,
    sourceDocs: p.source_docs,
    dialogue: p.dialogue,
    createdAt: p.created_at,
  };
}

function mapEval(e: EvaluationRow) {
  return {
    id: e.id,
    projectId: e.project_id,
    companyId: e.company_id,
    status: e.status,
    grade: e.grade,
    verdict: e.verdict,
    weighted: e.weighted,
    dimensions: e.dimensions,
    shortboard: e.shortboard,
    fatalFlaw: e.fatal_flaw,
    roiCalc: e.roi_calc,
    customized: e.customized,
    degraded: e.degraded,
    error: e.error,
    searchCount: e.search_count,
    intakeRound: e.intake_round,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  };
}

function mapEvidence(e: EvidenceRow) {
  return {
    id: e.id,
    evaluationId: e.evaluation_id,
    dimension: e.dimension,
    claim: e.claim,
    sourceName: e.source_name,
    sourceUrl: e.source_url,
    publishedAt: e.published_at,
    fetchedAt: e.fetched_at,
    snapshot: e.snapshot,
    crossValidated: e.cross_validated,
    confidence: e.confidence,
    sourceLevel: e.source_level,
  };
}

function mapOpinion(o: OpinionRow) {
  return {
    id: o.id,
    evaluationId: o.evaluation_id,
    dimension: o.dimension,
    persona: o.persona,
    stance: o.stance,
    argument: o.argument,
    evidenceRefs: o.evidence_refs,
    round: o.round,
    experiential: o.experiential,
  };
}

function mapLog(l: LogRow) {
  return {
    id: l.id,
    evaluationId: l.evaluation_id,
    step: l.step,
    kind: l.kind,
    actionText: l.action_text,
    timestamp: l.timestamp,
  };
}

export function ensureCompany() {
  const row = get<CompanyRow>("SELECT * FROM companies WHERE id = ?", [LOCAL_COMPANY_ID]);
  if (!row) {
    run(
      "INSERT INTO companies (id, updated_at) VALUES (?, ?)",
      [LOCAL_COMPANY_ID, nowIso()],
    );
  }
  return LOCAL_COMPANY_ID;
}

export function getCompany() {
  ensureCompany();
  return mapCompany(get<CompanyRow>("SELECT * FROM companies WHERE id = ?", [LOCAL_COMPANY_ID])!);
}

export function hasKnowledge() {
  const c = getCompany();
  if (c.mainBusiness || c.teamCapability || c.resources || c.strategy || c.redLines) return true;
  const n = get<{ n: number }>("SELECT COUNT(*) as n FROM kb_chunks");
  return Number(n?.n || 0) > 0;
}

export function companyText() {
  const c = getCompany();
  const lines = [
    c.mainBusiness && `主营：${c.mainBusiness}`,
    c.teamCapability && `团队：${c.teamCapability}`,
    c.resources && `资源：${c.resources}`,
    c.strategy && `战略：${c.strategy}`,
    c.redLines && `红线：${c.redLines}`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function saveCompany(p: CompanyProfile) {
  ensureCompany();
  run(
    `UPDATE companies SET main_business=?, team_capability=?, resources=?, strategy=?, red_lines=?, updated_at=? WHERE id=?`,
    [p.mainBusiness, p.teamCapability, p.resources, p.strategy, p.redLines, nowIso(), LOCAL_COMPANY_ID],
  );
}

export function createProject(title: string) {
  const id = nanoid(12);
  run(
    `INSERT INTO projects (id, company_id, title, created_at) VALUES (?, ?, ?, ?)`,
    [id, LOCAL_COMPANY_ID, title, nowIso()],
  );
  return id;
}

export function updateProject(
  id: string,
  patch: Partial<{
    title: string;
    essentials: Essentials;
    assumed: string[];
    dialogue: ChatMessage[];
    sourceDocs: unknown[];
  }>,
) {
  const cur = getProject(id);
  if (!cur) return;
  run(
    `UPDATE projects SET title=?, what=?, target_customer=?, revenue_model=?, budget=?, timeline=?, assumed=?, source_docs=?, dialogue=? WHERE id=?`,
    [
      patch.title ?? cur.title,
      patch.essentials?.what ?? cur.what,
      patch.essentials?.targetCustomer ?? cur.targetCustomer,
      patch.essentials?.revenueModel ?? cur.revenueModel,
      patch.essentials?.budget ?? cur.budget,
      patch.essentials?.timeline ?? cur.timeline,
      patch.assumed ? JSON.stringify(patch.assumed) : cur.assumed,
      patch.sourceDocs ? JSON.stringify(patch.sourceDocs) : cur.sourceDocs,
      patch.dialogue ? JSON.stringify(patch.dialogue) : cur.dialogue,
      id,
    ],
  );
}

export function getProject(id: string) {
  const row = get<ProjectRow>("SELECT * FROM projects WHERE id = ?", [id]);
  return row ? mapProject(row) : undefined;
}

export function listProjects() {
  const ps = all<ProjectRow>("SELECT * FROM projects ORDER BY created_at DESC").map(mapProject);
  const evs = all<EvaluationRow>("SELECT * FROM evaluations ORDER BY created_at DESC").map(mapEval);
  return ps.map((p) => ({
    ...p,
    evaluations: evs.filter((e) => e.projectId === p.id),
  }));
}

export function createEvaluation(projectId: string, useKnowledge: boolean) {
  const running = all<EvaluationRow>(
    `SELECT * FROM evaluations WHERE company_id = ? AND status IN ('collecting','researching','scoring')`,
    [LOCAL_COMPANY_ID],
  );
  if (running.length >= 2) throw new Error("同时进行中的评级不能超过 2 个");
  const id = nanoid(12);
  run(
    `INSERT INTO evaluations (id, project_id, company_id, status, created_at, updated_at) VALUES (?, ?, ?, 'collecting', ?, ?)`,
    [id, projectId, useKnowledge ? LOCAL_COMPANY_ID : null, nowIso(), nowIso()],
  );
  return id;
}

export function getEvaluation(id: string) {
  const row = get<EvaluationRow>("SELECT * FROM evaluations WHERE id = ?", [id]);
  return row ? mapEval(row) : undefined;
}

export function setEvaluation(
  id: string,
  patch: Partial<{
    status: EvaluationStatus;
    grade: string | null;
    verdict: string | null;
    weighted: string | null;
    dimensions: DimensionScore[] | null;
    shortboard: string | null;
    fatalFlaw: string | null;
    roiCalc: string | null;
    customized: number;
    degraded: string | null;
    error: string | null;
    searchCount: number;
    intakeRound: number;
  }>,
) {
  const cur = getEvaluation(id);
  if (!cur) return;
  run(
    `UPDATE evaluations SET
      status=?, grade=?, verdict=?, weighted=?, dimensions=?, shortboard=?, fatal_flaw=?, roi_calc=?,
      customized=?, degraded=?, error=?, search_count=?, intake_round=?, updated_at=?
     WHERE id=?`,
    [
      patch.status ?? cur.status,
      patch.grade === undefined ? cur.grade : patch.grade,
      patch.verdict === undefined ? cur.verdict : patch.verdict,
      patch.weighted === undefined ? cur.weighted : patch.weighted,
      patch.dimensions === undefined
        ? cur.dimensions
        : patch.dimensions
          ? JSON.stringify(patch.dimensions)
          : null,
      patch.shortboard === undefined ? cur.shortboard : patch.shortboard,
      patch.fatalFlaw === undefined ? cur.fatalFlaw : patch.fatalFlaw,
      patch.roiCalc === undefined ? cur.roiCalc : patch.roiCalc,
      patch.customized === undefined ? cur.customized : patch.customized,
      patch.degraded === undefined ? cur.degraded : patch.degraded,
      patch.error === undefined ? cur.error : patch.error,
      patch.searchCount === undefined ? cur.searchCount : patch.searchCount,
      patch.intakeRound === undefined ? cur.intakeRound : patch.intakeRound,
      nowIso(),
      id,
    ],
  );
}

export function insertEvidence(rows: EvidenceRecord[]) {
  for (const r of rows) {
    run(
      `INSERT INTO evidence (
        id, evaluation_id, dimension, claim, source_name, source_url, published_at, fetched_at,
        snapshot, cross_validated, confidence, source_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.evaluationId,
        r.dimension,
        r.claim,
        r.sourceName,
        r.sourceUrl,
        r.publishedAt,
        r.fetchedAt,
        r.snapshot,
        r.crossValidated ? 1 : 0,
        r.confidence,
        r.sourceLevel,
      ],
    );
  }
}

export function listEvidence(evaluationId: string) {
  return all<EvidenceRow>("SELECT * FROM evidence WHERE evaluation_id = ?", [evaluationId]).map(mapEvidence);
}

export function insertOpinions(rows: PanelOpinionRecord[]) {
  for (const r of rows) {
    run(
      `INSERT INTO panel_opinions (
        id, evaluation_id, dimension, persona, stance, argument, evidence_refs, round, experiential
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.evaluationId,
        r.dimension,
        r.persona,
        r.stance,
        r.argument,
        JSON.stringify(r.evidenceRefs),
        r.round,
        r.experiential ? 1 : 0,
      ],
    );
  }
}

export function listOpinions(evaluationId: string) {
  return all<OpinionRow>("SELECT * FROM panel_opinions WHERE evaluation_id = ?", [evaluationId]).map(mapOpinion);
}

export function nextLogStep(evaluationId: string) {
  const row = get<{ step: number }>(
    "SELECT step FROM research_logs WHERE evaluation_id = ? ORDER BY step DESC LIMIT 1",
    [evaluationId],
  );
  return (row?.step ?? 0) + 1;
}

export function appendLog(evaluationId: string, kind: ResearchLogKind, actionText: string) {
  const step = nextLogStep(evaluationId);
  run(
    `INSERT INTO research_logs (evaluation_id, step, kind, action_text, timestamp) VALUES (?, ?, ?, ?, ?)`,
    [evaluationId, step, kind, actionText, nowIso()],
  );
  return step;
}

export function listLogs(evaluationId: string, afterStep = 0) {
  return all<LogRow>(
    "SELECT * FROM research_logs WHERE evaluation_id = ? AND step > ? ORDER BY step ASC",
    [evaluationId, afterStep],
  ).map(mapLog);
}

export function saveVerdict(id: string, payload: VerdictPayload) {
  setEvaluation(id, {
    status: "done",
    grade: payload.grade,
    verdict: payload.verdict,
    weighted: String(payload.weighted),
    dimensions: payload.dimensions,
    shortboard: payload.shortboard || null,
    fatalFlaw: payload.fatalFlaw || null,
    roiCalc: payload.roiCalc || null,
    customized: payload.customized ? 1 : 0,
    degraded: payload.degraded || null,
    error: null,
  });
}
