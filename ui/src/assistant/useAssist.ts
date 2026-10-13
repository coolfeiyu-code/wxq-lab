import { computed, ref } from 'vue';
import { db, metaDirs } from '../lib/data';
import type { Commander, Hero, Lineup } from '../types';
import type { DataHealth, MatchRecord, Playbook, RecommendResult, Summary } from '../core-module';
import {
  SCORE_FORMULA_ID, SCORE_FORMULA_TEXT, applyTrackOp, bannableFactions, completeness,
  createMatch, dataHealth, importMatch, playbookStatus, recommend, reviewMatch, redoTrack,
  summarize, undoTrack,
} from '@core';
import type { TrackOp } from '../core-module';
import { backupFile, importRows, pullMatches, pushMatch, removeMatch, appVersion } from './api';

export const loading = ref(true);
export const loadError = ref('');
export const saveError = ref('');
export const storageMode = ref<'file' | 'browser' | ''>('');
export const storageNote = ref('');
export const version = ref('');
export const health = ref<DataHealth | null>(null);
export const commanders = ref<Commander[]>([]);
export const banOptions = ref<string[]>([]);
export const playbooks = ref<Playbook[]>([]);
export const matches = ref<MatchRecord[]>([]);
export const activeId = ref('');
export const draftInvited = ref<string[]>([]);
export const draftBan = ref('');
export const draftCommander = ref('');
export const snapshotDate = ref('');
export const formulaId = SCORE_FORMULA_ID;
export const formulaText = SCORE_FORMULA_TEXT;

const compPool = ref<unknown[]>([]);
let booted = false;

export const active = computed(() => matches.value.find((m) => m.id === activeId.value) || null);
export const activeBook = computed(() => playbooks.value.find((p) => p.id === active.value?.playbookId) || null);
export const bookState = computed(() => playbookStatus(activeBook.value, snapshotDate.value));
export const stats = computed<Summary>(() => summarize(matches.value));
export const doneCount = computed(() => (
  active.value
    ? completeness(active.value)
    : { filled: 0, total: 8, items: [] as [string, boolean][] }
));

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function versionNote(date: string, cardDate: string) {
  return `统计快照 ${date || '无'}；卡牌库 ${cardDate || '日期不明'}；游戏版本号未在本仓库核验`;
}

export function resultFor(commander: string): RecommendResult {
  return recommend({
    comps: compPool.value,
    commander,
    bannedFaction: draftBan.value,
    snapshotDate: snapshotDate.value,
    asOfDate: today(),
  });
}

export function bookFor(id: string | null | undefined) {
  return playbooks.value.find((p) => p.id === id) || null;
}

function replace(next: MatchRecord) {
  const idx = matches.value.findIndex((m) => m.id === next.id);
  if (idx >= 0) matches.value.splice(idx, 1, next);
  else matches.value.unshift(next);
  activeId.value = next.id;
}

let timer = 0;
function scheduleSave(record: MatchRecord) {
  window.clearTimeout(timer);
  timer = window.setTimeout(async () => {
    try {
      await pushMatch(record, storageMode.value === 'browser' ? 'browser' : 'file');
      saveError.value = '';
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : String(err);
    }
  }, 250);
}

function commit(next: MatchRecord) {
  replace(next);
  scheduleSave(next);
}

export function toggleInvited(name: string) {
  const has = draftInvited.value.includes(name);
  if (has) {
    draftInvited.value = draftInvited.value.filter((n) => n !== name);
    if (draftCommander.value === name) draftCommander.value = draftInvited.value[0] || '';
    return;
  }
  if (draftInvited.value.length >= 3) return;
  draftInvited.value = [...draftInvited.value, name];
  if (!draftCommander.value) draftCommander.value = name;
}

export async function initAssist() {
  if (booted) return;
  booted = true;
  loading.value = true;
  loadError.value = '';
  try {
    const [heroList, factionList, commanderList, dirs, catalogRes, pulled, ver] = await Promise.all([
      db.heroes(),
      db.factions(),
      db.commanders(),
      metaDirs().catch(() => [] as string[]),
      fetch('/data/playbooks/catalog.json').then((r) => r.json()) as Promise<{ playbooks: Playbook[] }>,
      pullMatches(),
      appVersion(),
    ]);
    version.value = ver;
    commanders.value = commanderList;
    banOptions.value = bannableFactions(factionList);
    playbooks.value = catalogRes.playbooks || [];
    storageMode.value = pulled.mode;
    storageNote.value = pulled.mode === 'file'
      ? (pulled.status?.note || '战绩写入同步目录里的用户数据。')
      : '没连上本地记录服务，本局先写在这个浏览器里。重新打开带 /api/assistant 的服务后，需要再导出并导入。';
    matches.value = pulled.matches;
    const open = matches.value.find((m) => m.status !== 'finished');
    activeId.value = open?.id || '';
    if (open) {
      draftInvited.value = [...(open.invitedCommanders || [])];
      draftBan.value = open.bannedFaction || '';
      draftCommander.value = open.chosenCommander || draftInvited.value[0] || '';
    }
    const date = dirs[0] || '';
    snapshotDate.value = date;
    const cardDates = [...new Set(heroList.map((h) => h.updatedAt).filter(Boolean))] as string[];
    const cardUpdatedAt = cardDates.sort().at(-1) || null;
    let partialReason = '推荐池来自已保存的 comp-stats 研究阵容。';
    let sampleNote = '';
    compPool.value = await buildPool(date, heroList, playbooks.value);
    if (date) {
      const compRes = await fetch(`/data/meta/${date}/comp-stats.json`);
      if (compRes.ok) {
        const body = await compRes.json() as { global?: { base?: { count?: number } }; queriedAt?: string };
        sampleNote = `comp-stats 查询时间 ${body.queriedAt || date}，文件内全局对局 ${body.global?.base?.count ?? '未写'}。`;
      }
      const lineRes = await fetch(`/data/meta/${date}/api/lineups.json`);
      if (lineRes.ok) {
        const body = await lineRes.json() as { data?: { total?: number; lineups?: unknown[] } };
        const total = body.data?.total ?? 0;
        const page = body.data?.lineups?.length ?? 0;
        if (total > page) partialReason += ` 热门阵容接口 total=${total}，快照只存了 ${page} 条。`;
      }
    } else {
      partialReason = '没有本地统计快照，无法排序。';
    }
    health.value = dataHealth({
      cardUpdatedAt,
      snapshotDate: date || null,
      asOfDate: today(),
      partial: true,
      partialReason,
      sampleNote,
      knownPatchNote: '本仓库卡牌原文停在提取日。项目外规则备忘记到约 v1.5.1 的平衡改动，没有合并进 data/heroes.json，所以技能句不能标成现行版本。',
      sources: [
        { name: '对局统计', detail: date ? `data/meta/${date}/comp-stats.json 与 api/lineups.json` : '无快照' },
        { name: '卡牌原文', detail: `data/heroes.json · ${cardDates.join('、') || '无日期'}` },
        { name: '外部探测', detail: 'data/assistant/source-status.json · 2026-10-13' },
      ],
    });
    if (!draftCommander.value && draftInvited.value[0]) draftCommander.value = draftInvited.value[0];
  } catch (err) {
    booted = false;
    loadError.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

async function buildPool(date: string, heroList: Hero[], books: Playbook[]) {
  if (!date) return [];
  const byName = new Map(heroList.map((h) => [h.name, h]));
  const byId = new Map(heroList.map((h) => [String(h.id), h]));
  const pool: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const compRes = await fetch(`/data/meta/${date}/comp-stats.json`);
  if (compRes.ok) {
    const body = await compRes.json() as { queriedAt?: string; comps?: Record<string, { heroes: string[]; base: { count: number; firstRate: number; top3Rate: number; avgPlacement: number } }> };
    for (const [title, row] of Object.entries(body.comps || {})) {
      const heroes = (row.heroes || []).map((name) => ({
        name,
        faction: byName.get(name)?.faction || '未知',
        quality: byName.get(name)?.quality,
      }));
      const key = heroes.map((h) => h.name).sort().join('|');
      seen.add(key);
      const book = books.find((p) => p.compTitle === title);
      pool.push({
        id: book?.id || title,
        title,
        heroes,
        count: row.base.count,
        firstRate: row.base.firstRate,
        top3Rate: row.base.top3Rate,
        avgPlacement: row.base.avgPlacement,
        source: `comp-stats 多英雄条件查询 · 快照 ${date}`,
        sourceDetail: body.queriedAt || '',
        playbookId: book?.id || null,
      });
    }
  }
  const lineRes = await fetch(`/data/meta/${date}/api/lineups.json`);
  if (lineRes.ok) {
    const body = await lineRes.json() as { data?: { lineups?: Lineup[] } };
    for (const line of body.data?.lineups || []) {
      const heroes = (line.recommendedUnits || []).map((unit) => {
        const hero = byId.get(String(unit.heroId));
        return hero
          ? { name: hero.name, faction: hero.faction, quality: hero.quality }
          : { name: `未识别${unit.heroId}`, faction: '未知' };
      }).filter((h) => h.name);
      const key = heroes.map((h) => h.name).sort().join('|');
      if (!heroes.length || seen.has(key)) continue;
      seen.add(key);
      const title = heroes.map((h) => h.name).join('、');
      pool.push({
        id: line.lineupKey || title,
        title,
        heroes,
        count: line.count,
        firstRate: line.firstRate,
        top3Rate: line.top3Rate,
        avgPlacement: line.avgPlacement,
        commanders: line.commanders,
        source: `热门阵容首页 · 快照 ${date} · 不是全量`,
        sourceDetail: line.lineupKey || '',
        playbookId: null,
      });
    }
  }
  return pool;
}

export function adopt(row: { id: string; title: string; playbookId: string | null }, recommendation: RecommendResult) {
  if (!draftBan.value) {
    saveError.value = '先选择本局禁用阵营。';
    return;
  }
  if (draftInvited.value.length !== 3) {
    saveError.value = '先选满 3 名特邀棋手。';
    return;
  }
  if (!draftCommander.value) {
    saveError.value = '先点一名你要看的棋手。';
    return;
  }
  const book = bookFor(row.playbookId);
  let current = active.value && active.value.status !== 'finished'
    ? active.value
    : createMatch({ gameVersionNote: versionNote(snapshotDate.value, health.value?.cardUpdatedAt || '') });
  const steps: TrackOp[] = [
    { type: 'set', field: 'invitedCommanders', value: [...draftInvited.value] },
    { type: 'set', field: 'bannedFaction', value: draftBan.value },
    { type: 'set', field: 'chosenCommander', value: draftCommander.value },
    { type: 'set', field: 'lineupId', value: row.id },
    { type: 'set', field: 'lineupTitle', value: row.title },
    { type: 'set', field: 'playbookId', value: row.playbookId },
    { type: 'set', field: 'playbookVersion', value: book?.version || null },
    { type: 'set', field: 'recommendation', value: recommendation },
    { type: 'set', field: 'gameVersionNote', value: versionNote(snapshotDate.value, health.value?.cardUpdatedAt || '') },
  ];
  for (const stepOp of steps) {
    const step = applyTrackOp(current, stepOp);
    if (!step.ok) {
      saveError.value = step.error || '写入失败';
      return;
    }
    current = step.record;
  }
  saveError.value = '';
  commit(current);
}

export function op(operation: TrackOp) {
  if (!active.value) return;
  const step = applyTrackOp(active.value, operation);
  if (!step.ok) {
    saveError.value = step.error || '不能写入';
    return;
  }
  saveError.value = '';
  commit(step.record);
}

export function undo() {
  if (!active.value) return;
  const step = undoTrack(active.value);
  if (!step.ok) {
    saveError.value = step.error || '';
    return;
  }
  saveError.value = '';
  commit(step.record);
}

export function redo() {
  if (!active.value) return;
  const step = redoTrack(active.value);
  if (!step.ok) {
    saveError.value = step.error || '';
    return;
  }
  saveError.value = '';
  commit(step.record);
}

export function makeReview() {
  if (!active.value) return;
  const review = reviewMatch(active.value, activeBook.value);
  const step = applyTrackOp(active.value, { type: 'attachReview', review });
  if (!step.ok) {
    saveError.value = step.error || '';
    return;
  }
  saveError.value = '';
  commit(step.record);
}

export function finishMatch() {
  if (!active.value) return;
  const ended = applyTrackOp(active.value, { type: 'set', field: 'status', value: 'finished' });
  if (!ended.ok) {
    saveError.value = ended.error || '';
    return;
  }
  const review = reviewMatch(ended.record, bookFor(ended.record.playbookId));
  const withReview = applyTrackOp(ended.record, { type: 'attachReview', review });
  saveError.value = '';
  commit(withReview.ok ? withReview.record : ended.record);
}

export function resume(id: string) {
  activeId.value = id;
  const found = matches.value.find((m) => m.id === id);
  if (!found) return;
  draftInvited.value = [...(found.invitedCommanders || [])];
  draftBan.value = found.bannedFaction || '';
  draftCommander.value = found.chosenCommander || '';
}

export async function discard(id: string) {
  await removeMatch(id, storageMode.value === 'browser' ? 'browser' : 'file');
  matches.value = matches.value.filter((m) => m.id !== id);
  if (activeId.value === id) activeId.value = matches.value.find((m) => m.status !== 'finished')?.id || '';
}

export async function importPayload(rows: unknown[]) {
  if (storageMode.value === 'browser') {
    for (const raw of rows) {
      const done = importMatch(raw);
      if (done.ok && done.record) {
        const idx = matches.value.findIndex((m) => m.id === done.record!.id);
        if (idx >= 0) matches.value.splice(idx, 1, done.record);
        else matches.value.unshift(done.record);
        await pushMatch(done.record, 'browser');
      }
    }
    return;
  }
  await importRows(rows, 'file');
  const pulled = await pullMatches();
  matches.value = pulled.matches;
}

export async function backup() {
  return backupFile(storageMode.value === 'browser' ? 'browser' : 'file');
}

export function newDraft() {
  draftInvited.value = [];
  draftBan.value = '';
  draftCommander.value = '';
  activeId.value = '';
}
