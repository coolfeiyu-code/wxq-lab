import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { importMatches, readMatches, saveMatch } from './assistant-store.mjs';
import { createMatch } from './lib/assistant-core.mjs';

test('文件库拒绝非法名次，导入时保留原值', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wxq-user-'));
  try {
    const good = createMatch({ id: 'match_ok_01' });
    good.status = 'finished';
    good.placement = 4;
    await saveMatch(dir, good);
    await assert.rejects(() => saveMatch(dir, { ...good, placement: 7, placementError: null }));
    const imported = await importMatches(dir, [{ id: 'match_bad_1', status: 'finished', placement: 8, chosenCommander: '镜' }]);
    assert.equal(imported[0].placement, 8);
    assert.match(imported[0].placementError, /8/);
    const all = await readMatches(dir);
    assert.equal(all.find((row) => row.id === 'match_bad_1').placement, 8);
    assert.equal(all.some((row) => row.placement === 7), false);
    await writeFile(path.join(dir, 'writer.lock'), JSON.stringify({ host: 'other-pc', pid: 1, at: new Date().toISOString() }));
    await assert.rejects(() => saveMatch(dir, good), (err) => err && err.code === 'LOCKED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
