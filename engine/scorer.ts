import type {
  AssumedFields,
  Confidence,
  DimensionKey,
  DimensionScore,
  EvidenceRecord,
  Grade,
  VerdictPayload,
} from "./types";
import { DIMENSION_META, DIMENSIONS } from "./types";

const RELATED: Record<keyof import("./types").Essentials, DimensionKey[]> = {
  what: ["market", "fit"],
  targetCustomer: ["market", "timing"],
  revenueModel: ["roi", "market"],
  budget: ["roi", "fit"],
  timeline: ["timing", "roi"],
};

export function applyPenalties(
  scores: DimensionScore[],
  evidence: EvidenceRecord[],
  assumed: AssumedFields,
): DimensionScore[] {
  return scores.map((dim) => {
    if (dim.skipped) return dim;
    const penalized: string[] = [...(dim.penalized || [])];
    let score = dim.score;
    const dimEv = evidence.filter((e) => e.dimension === dim.key);
    const claims = new Set(dimEv.map((e) => e.claim));
    let validatedClaims = 0;
    for (const claim of claims) {
      const rows = dimEv.filter((e) => e.claim === claim);
      if (rows.some((r) => r.crossValidated)) validatedClaims += 1;
    }
    if (validatedClaims < 2) {
      score = round1(score * 0.9);
      penalized.push("交叉验证不足，分数 ×0.9");
    }
    for (const field of assumed) {
      if (RELATED[field]?.includes(dim.key)) {
        score = round1(score * 0.9);
        penalized.push(`字段「${field}」基于假设，分数 ×0.9`);
        break;
      }
    }
    const confidence: Confidence =
      validatedClaims >= 2 && penalized.length === 0 ? "high" : "low";
    return { ...dim, score: clamp(score), penalized, confidence };
  });
}

export function decideGrade(
  scores: DimensionScore[],
  customized: boolean,
): Omit<VerdictPayload, "verdict"> & { verdict?: string } {
  const active = scores.filter((s) => !s.skipped);
  const weights = active.map((s) => DIMENSION_META[s.key].weight);
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const weighted = round1(
    active.reduce((acc, s) => acc + s.score * (DIMENSION_META[s.key].weight / sumW), 0),
  );

  const fatal = active.find((s) => s.fatal || s.score <= 0);
  const roi = scores.find((s) => s.key === "roi");
  const allGreen = active.every((s) => s.score >= 6);
  const allCross = active.every((s) => s.confidence === "high");
  const short = active.filter((s) => s.score < 6).sort((a, b) => a.score - b.score)[0];

  let grade: Grade = "B";
  if (fatal) grade = "C";
  else if (roi && !roi.skipped && roi.score < 4) grade = "B";
  else if (weighted >= 8 && allGreen && allCross) grade = "S";
  else if (weighted >= 6.5 || (weighted >= 8 && !allGreen)) grade = "A";
  else grade = "B";

  const payload: VerdictPayload = {
    grade,
    verdict: "",
    weighted,
    customized,
    dimensions: scores,
  };

  if (grade === "C") {
    payload.fatalFlaw = fatal?.conclusion || "存在致命缺陷";
  }
  if (grade === "A" && short) {
    payload.shortboard = `短板在「${short.name}」（${short.score}分）：${short.conclusion}`;
  }
  if (grade === "B" && roi && !roi.skipped) {
    payload.roiCalc = roi.conclusion;
  }
  return payload;
}

export function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : round1((s[mid - 1] + s[mid]) / 2);
}

export function clamp(n: number) {
  return Math.max(0, Math.min(10, round1(n)));
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function emptySkippedFit(): DimensionScore {
  return {
    key: "fit",
    name: DIMENSION_META.fit.name,
    score: 0,
    confidence: "low",
    conclusion: "未评估",
    skipped: true,
  };
}

export { DIMENSIONS };
