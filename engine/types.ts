export const DIMENSIONS = [
  "market",
  "competition",
  "timing",
  "fit",
  "roi",
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number];

export const DIMENSION_META: Record<
  DimensionKey,
  { name: string; weight: number; signature: string }
> = {
  market: { name: "市场空间", weight: 0.25, signature: "市场天花板和集中度怎么算？" },
  competition: { name: "竞争格局", weight: 0.2, signature: "五力里哪一力会绞死你？" },
  timing: { name: "入场时机", weight: 0.15, signature: "为什么是现在？" },
  fit: { name: "公司匹配度", weight: 0.2, signature: "你敢对另外一百件事说不吗？" },
  roi: { name: "投入产出比", weight: 0.2, signature: "最坏能坏到什么程度，你死不死？" },
};

export type Grade = "S" | "A" | "B" | "C";
export type EvaluationStatus =
  | "collecting"
  | "researching"
  | "scoring"
  | "done"
  | "failed";
export type Stance = "support" | "oppose" | "caveat";
export type Confidence = "high" | "low";
export type SourceLevel = "official" | "media" | "ugc" | "unknown";

export type Essentials = {
  what: string | null;
  targetCustomer: string | null;
  revenueModel: string | null;
  budget: string | null;
  timeline: string | null;
};

export type AssumedFields = Array<keyof Essentials>;

export type CompanyProfile = {
  mainBusiness: string;
  teamCapability: string;
  resources: string;
  strategy: string;
  redLines: string;
};

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  summary?: string;
  siteName?: string;
  publishedAt?: string | null;
  sourceLevel: SourceLevel;
  provider?: string;
  providers?: string[];
};

export type ExtractedClaim = {
  claim: string;
  dimension: DimensionKey;
  sourceUrls: string[];
};

export type EvidenceRecord = {
  id: string;
  evaluationId: string;
  dimension: DimensionKey;
  claim: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
  fetchedAt: string;
  snapshot: string;
  crossValidated: boolean;
  confidence: Confidence;
  sourceLevel: SourceLevel;
};

export type PanelOpinionRecord = {
  id: string;
  evaluationId: string;
  dimension: DimensionKey;
  persona: string;
  stance: Stance;
  argument: string;
  evidenceRefs: string[];
  round: "stance" | "clash" | "synthesis";
  experiential: boolean;
};

export type DimensionScore = {
  key: DimensionKey;
  name: string;
  score: number;
  confidence: Confidence;
  conclusion: string;
  skipped?: boolean;
  fatal?: boolean;
  penalized?: string[];
};

export type VerdictPayload = {
  grade: Grade;
  verdict: string;
  weighted: number;
  customized: boolean;
  shortboard?: string;
  fatalFlaw?: string;
  roiCalc?: string;
  dimensions: DimensionScore[];
  degraded?: string | null;
};

export type ResearchLogKind =
  | "system"
  | "search"
  | "evidence"
  | "panel"
  | "score"
  | "warn";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
