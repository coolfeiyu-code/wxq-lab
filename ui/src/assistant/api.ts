import type { MatchRecord } from '../core-module';

const KEY = 'wxq.assistant.matches.v1';

export interface StoreStatus {
  dir?: string;
  writable?: boolean;
  lock?: { host?: string; at?: string } | null;
  note?: string;
  version?: string;
  singleWriter?: boolean;
}

function readLocal(): MatchRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]') as MatchRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(matches: MatchRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(matches));
}

export async function pullMatches(): Promise<{ mode: 'file' | 'browser'; matches: MatchRecord[]; status: StoreStatus | null }> {
  try {
    const statusRes = await fetch('/api/assistant/status');
    if (!statusRes.ok) throw new Error('status');
    const status = await statusRes.json() as StoreStatus;
    const res = await fetch('/api/assistant/matches');
    if (!res.ok) throw new Error('matches');
    const matches = await res.json() as MatchRecord[];
    return { mode: 'file', matches: Array.isArray(matches) ? matches : [], status };
  } catch {
    return { mode: 'browser', matches: readLocal(), status: null };
  }
}

export async function pushMatch(record: MatchRecord, mode: 'file' | 'browser') {
  if (mode === 'browser') {
    const all = readLocal();
    const idx = all.findIndex((m) => m.id === record.id);
    if (idx >= 0) all[idx] = record;
    else all.unshift(record);
    writeLocal(all);
    return;
  }
  const res = await fetch('/api/assistant/matches', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(body.error || `保存失败 ${res.status}`);
}

export async function removeMatch(id: string, mode: 'file' | 'browser') {
  if (mode === 'browser') {
    writeLocal(readLocal().filter((m) => m.id !== id));
    return;
  }
  const res = await fetch(`/api/assistant/matches/${id}`, { method: 'DELETE' });
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(body.error || `删除失败 ${res.status}`);
}

export async function importRows(rows: unknown[], mode: 'file' | 'browser') {
  if (mode === 'browser') return { via: 'browser' as const, rows };
  const res = await fetch('/api/assistant/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rows),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `导入失败 ${res.status}`);
  return body;
}

export async function backupFile(mode: 'file' | 'browser') {
  if (mode === 'browser') {
    const blob = new Blob([JSON.stringify(readLocal(), null, 2)], { type: 'application/json' });
    return URL.createObjectURL(blob);
  }
  const res = await fetch('/api/assistant/backup', { method: 'POST' });
  const body = await res.json().catch(() => ({})) as { error?: string; file?: string };
  if (!res.ok) throw new Error(body.error || '备份失败');
  return body.file || '';
}

export async function appVersion(): Promise<string> {
  try {
    const res = await fetch('/version.json');
    if (!res.ok) return '';
    const body = await res.json() as { version?: string };
    return body.version || '';
  } catch {
    return '';
  }
}
