/**
 * 个人战绩文件库。单写者锁，原子替换。
 * 不支持两台电脑同时写入。锁超过 2 分钟视为过期。
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { importMatch, parsePlacement } from './lib/assistant-core.mjs';

const LOCK_MS = 120_000;
const MAX_BACKUPS = 15;

export function resolveUserDataDir(root) {
  if (process.env.WXQ_USER_DATA) return path.resolve(process.env.WXQ_USER_DATA);
  return path.resolve(root, '..', '万象棋AI实战助手', 'user-data');
}

async function ensure(dir) {
  await mkdir(dir, { recursive: true });
  await mkdir(path.join(dir, 'backups'), { recursive: true });
}

function lockPath(dir) { return path.join(dir, 'writer.lock'); }
function dataPath(dir) { return path.join(dir, 'matches.json'); }

async function readLock(dir) {
  try { return JSON.parse(await readFile(lockPath(dir), 'utf8')); } catch { return null; }
}

export async function statusOf(dir) {
  await ensure(dir);
  const lock = await readLock(dir);
  const fresh = lock && Date.now() - Date.parse(lock.at) < LOCK_MS;
  return {
    dir,
    host: os.hostname(),
    pid: process.pid,
    lock: fresh ? lock : null,
    writable: !fresh || (lock.host === os.hostname() && lock.pid === process.pid),
    singleWriter: true,
    note: '同一时间只应有一台电脑写入。另一台若正打开着，本机会拒绝保存。',
  };
}

async function acquire(dir) {
  await ensure(dir);
  const current = await readLock(dir);
  const mine = { host: os.hostname(), pid: process.pid, at: new Date().toISOString() };
  if (current) {
    const age = Date.now() - Date.parse(current.at);
    const same = current.host === mine.host && current.pid === mine.pid;
    if (!same && age < LOCK_MS) {
      const err = new Error(`战绩正由 ${current.host} 写入。请先关闭那一台的实战助手，或等锁过期。`);
      err.code = 'LOCKED';
      throw err;
    }
  }
  await writeFile(lockPath(dir), JSON.stringify(mine), 'utf8');
  return mine;
}

async function touchLock(dir) {
  const mine = { host: os.hostname(), pid: process.pid, at: new Date().toISOString() };
  await writeFile(lockPath(dir), JSON.stringify(mine), 'utf8');
}

export async function release(dir) {
  const current = await readLock(dir);
  if (current && current.host === os.hostname() && current.pid === process.pid) {
    await rm(lockPath(dir), { force: true });
  }
}

export async function readMatches(dir) {
  await ensure(dir);
  if (!existsSync(dataPath(dir))) return [];
  try {
    const parsed = JSON.parse(await readFile(dataPath(dir), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    const broken = path.join(dir, 'backups', `matches-unreadable-${Date.now()}.json`);
    try { await rename(dataPath(dir), broken); } catch { /* 留在原地 */ }
    err.message = `matches.json 无法读取，已尝试移到备份。${err.message}`;
    throw err;
  }
}

async function backup(dir) {
  const src = dataPath(dir);
  if (!existsSync(src)) return null;
  const name = `matches-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const dest = path.join(dir, 'backups', name);
  await writeFile(dest, await readFile(src));
  const files = (await readdir(path.join(dir, 'backups'))).filter((f) => f.startsWith('matches-') && f.endsWith('.json')).sort();
  while (files.length > MAX_BACKUPS) {
    const old = files.shift();
    await rm(path.join(dir, 'backups', old), { force: true });
  }
  return dest;
}

async function writeAll(dir, matches) {
  await acquire(dir);
  await backup(dir);
  const tmp = path.join(dir, `.matches.${process.pid}.tmp`);
  await writeFile(tmp, JSON.stringify(matches, null, 2), 'utf8');
  await rename(tmp, dataPath(dir));
  await touchLock(dir);
}

function assertSavable(record) {
  const parsed = parsePlacement(record.placement, 'optional');
  if (parsed.state === 'invalid' && !record.placementError) {
    const err = new Error(parsed.reason);
    err.code = 'PLACEMENT';
    throw err;
  }
  if (record.placementError && parsed.state === 'ok') {
    record.placementError = null;
  }
}

export async function saveMatch(dir, record) {
  if (!record || typeof record.id !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(record.id)) {
    const err = new Error('对局 id 无效');
    err.code = 'ID';
    throw err;
  }
  assertSavable(record);
  const matches = await readMatches(dir);
  const idx = matches.findIndex((m) => m.id === record.id);
  if (idx >= 0) matches[idx] = record;
  else matches.unshift(record);
  await writeAll(dir, matches);
  return record;
}

export async function deleteMatch(dir, id) {
  const matches = await readMatches(dir);
  await writeAll(dir, matches.filter((m) => m.id !== id));
}

export async function importMatches(dir, incoming) {
  if (!Array.isArray(incoming)) {
    const err = new Error('导入内容必须是数组');
    err.code = 'IMPORT';
    throw err;
  }
  const matches = await readMatches(dir);
  const results = [];
  for (const raw of incoming) {
    const done = importMatch({ ...raw, id: typeof raw?.id === 'string' ? raw.id : randomUUID() });
    if (!done.ok) {
      results.push({ ok: false, error: done.error });
      continue;
    }
    const idx = matches.findIndex((m) => m.id === done.record.id);
    if (idx >= 0) matches[idx] = done.record;
    else matches.unshift(done.record);
    results.push({ ok: true, id: done.record.id, errors: done.errors, placement: done.record.placement, placementError: done.record.placementError });
  }
  await writeAll(dir, matches);
  return results;
}

export async function exportMatches(dir) {
  return readMatches(dir);
}

export async function makeBackup(dir) {
  await ensure(dir);
  if (!existsSync(dataPath(dir))) {
    await writeFile(dataPath(dir), '[]', 'utf8');
  }
  return backup(dir);
}
