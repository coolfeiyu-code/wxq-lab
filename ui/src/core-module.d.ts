export interface AssistHero {
  name: string;
  faction: string;
  quality?: number;
}

export interface RankedRow {
  id: string;
  title: string;
  heroes: AssistHero[];
  count: number;
  firstRate: number;
  top3Rate: number;
  avgPlacement: number | null;
  source: string;
  sourceDetail: string;
  playbookId: string | null;
  score: number | null;
  confidence: string;
  reasons: string[];
  weaknesses: string[];
  parts: {
    base: number;
    sampleFactor: number | null;
    commanderFit: number;
    freshness: number;
    score: number | null;
  };
}

export interface RecommendResult {
  formulaId: string;
  formulaText: string;
  commander: string;
  bannedFaction: string;
  snapshotDate: string;
  asOfDate: string;
  freshness: { ageDays: number | null; factor: number; label: string };
  ranked: RankedRow[];
  uncertain: RankedRow[];
  rejected: { id: string; title: string; reason: string }[];
  primary: RankedRow | null;
  alternatives: RankedRow[];
}

export interface MatchDecision {
  id: string;
  at?: string;
  text: string;
  kind?: string;
}

export interface MatchRecord {
  schemaVersion: number;
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'paused' | 'finished';
  gameVersionNote: string;
  invitedCommanders: string[];
  bannedFaction: string | null;
  chosenCommander: string | null;
  recommendation: RecommendResult | null;
  lineupId: string | null;
  lineupTitle: string | null;
  playbookId: string | null;
  playbookVersion: string | null;
  phaseId: string | null;
  hp: number | null;
  gold: number | null;
  level: number | null;
  heroes: { id: string; name: string; level: number | null; items: string[] }[];
  decisions: MatchDecision[];
  transitions: { id: string; at?: string; from?: string; to?: string; reason?: string }[];
  notes: { id: string; at?: string; text: string }[];
  placement: number | null;
  placementRaw: unknown;
  placementError: string | null;
  review: ReviewResult | null;
  reviews: ReviewResult[];
  past: unknown[];
  future: unknown[];
}

export interface ReviewResult {
  engine: string;
  generatedAt: string;
  gameVersionNote: string;
  comparedPlaybook: { id: string; version: string; statsDate: string | null; stageId: string | null; stageTitle: string | null } | null;
  facts: string[];
  inferences: string[];
  unknowns: string[];
  improvements: string[];
  principle: string;
  notUsed: string;
}

export interface PlaybookItem { kind: 'fact' | 'inference' | 'unverified' | string; text: string }
export interface PlaybookStage { id: string; title: string; items: PlaybookItem[] }
export interface Playbook {
  id: string;
  version: string;
  title: string;
  compTitle: string;
  statsDate: string;
  updatedAt: string;
  status: string;
  heroes: string[];
  bannedIf: string[];
  stats: { count: number; firstRate: number; top3Rate: number; avgPlacement: number };
  sources: { kind: string; path: string; queriedAt?: string; updatedAt?: string }[];
  risks: string[];
  stages: PlaybookStage[];
}

export interface TrackOp {
  type: string;
  field?: string;
  value?: unknown;
  item?: Record<string, unknown>;
  id?: string;
  patch?: Record<string, unknown>;
  review?: ReviewResult;
}

export interface Summary {
  playerCount: number;
  definition: string;
  total: number;
  finished: number;
  validSample: number;
  excludedInvalid: number;
  excludedMissingPlacement: number;
  sample: number;
  firstCount: number;
  top3Count: number;
  firstRate: number | null;
  top3Rate: number | null;
  avgPlacement: number | null;
  byCommander: GroupStat[];
  byLineup: GroupStat[];
  byPair: GroupStat[];
  byBan: GroupStat[];
  byVersion: GroupStat[];
  byDate: GroupStat[];
}

export interface GroupStat {
  key: string;
  sample: number;
  firstRate: number | null;
  top3Rate: number | null;
  avgPlacement: number | null;
}

export interface DataHealth {
  snapshotDate: string | null;
  cardUpdatedAt: string | null;
  asOfDate: string | null;
  ageDays: number | null;
  freshness: string;
  partial: boolean;
  partialReason: string;
  sampleNote: string;
  conflicts: string[];
  sources: { name: string; detail: string }[];
}
