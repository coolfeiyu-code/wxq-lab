import type {
  DataHealth,
  MatchRecord,
  Playbook,
  RecommendResult,
  ReviewResult,
  Summary,
  TrackOp,
} from '../../ui/src/core-module';

export const PLAYER_COUNT: number;
export const SCORE_FORMULA_ID: string;
export const SCORE_FORMULA_TEXT: string;
export function bannableFactions(factions: { name: string }[]): string[];
export function recommend(input: {
  comps: unknown[];
  commander: string;
  bannedFaction: string;
  snapshotDate: string;
  asOfDate: string;
}): RecommendResult;
export function parsePlacement(value: unknown, mode?: 'optional' | 'required'): { state: string; value: unknown; reason: string };
export function summarize(records: MatchRecord[]): Summary;
export function reviewMatch(record: MatchRecord, playbook: Playbook | null): ReviewResult;
export function playbookStatus(playbook: Playbook | null, snapshotDate: string): { state: string; message: string };
export function createMatch(seed?: { id?: string; gameVersionNote?: string; createdAt?: string }): MatchRecord;
export function applyTrackOp(record: MatchRecord, op: TrackOp): { ok: boolean; error?: string; record: MatchRecord };
export function undoTrack(record: MatchRecord): { ok: boolean; error?: string; record: MatchRecord };
export function redoTrack(record: MatchRecord): { ok: boolean; error?: string; record: MatchRecord };
export function completeness(record: MatchRecord): { filled: number; total: number; items: [string, boolean][] };
export function importMatch(raw: unknown): { ok: boolean; error: string; errors?: string[]; record: MatchRecord | null };
export function dataHealth(input: Record<string, unknown>): DataHealth;
export function isStatsEligible(record: MatchRecord): boolean;
