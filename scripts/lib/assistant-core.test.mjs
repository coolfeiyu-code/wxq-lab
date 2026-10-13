import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYER_COUNT, VALID_PLACEMENTS, SCORE_FORMULA_ID, SCORE_FORMULA_TEXT,
  parsePlacement, recommend, summarize, reviewMatch, applyTrackOp, undoTrack, redoTrack,
  createMatch, importMatch, isStatsEligible, compBlockedByBan, playbookStatus,
} from './assistant-core.mjs';

const hero = (name, faction, quality = 3) => ({ name, faction, quality });

function comp(partial) {
  return {
    id: partial.id,
    title: partial.title,
    heroes: partial.heroes,
    count: partial.count,
    firstRate: partial.firstRate,
    top3Rate: partial.top3Rate,
    avgPlacement: partial.avgPlacement,
    source: partial.source || 'fixture',
    commanders: partial.commanders,
    playbookId: partial.playbookId || null,
  };
}

test('名次只接受 1 到 6', () => {
  assert.equal(PLAYER_COUNT, 6);
  assert.deepEqual(VALID_PLACEMENTS, [1, 2, 3, 4, 5, 6]);
  for (const n of VALID_PLACEMENTS) {
    assert.equal(parsePlacement(n, 'required').state, 'ok');
  }
  for (const bad of [0, 7, 8, -1, 1.5, 9, Number.NaN, Infinity, '1', '6', true]) {
    const parsed = parsePlacement(bad, 'required');
    assert.equal(parsed.state, 'invalid', String(bad));
    assert.notEqual(parsed.value, 1);
  }
  assert.equal(parsePlacement(null, 'optional').state, 'missing');
  assert.equal(parsePlacement('', 'optional').state, 'missing');
  assert.equal(parsePlacement(undefined, 'required').state, 'invalid');
});

test('禁用阵营的阵容不能进入推荐', () => {
  const heluo = comp({
    id: 'a', title: '河洛套', heroes: [hero('花木兰', '河洛', 5), hero('李白', '河洛', 4)],
    count: 20000, firstRate: 0.3, top3Rate: 0.7, avgPlacement: 2.6,
  });
  const river = comp({
    id: 'b', title: '大河套', heroes: [hero('虞姬', '大河流域', 2), hero('公孙离', '无阵营', 2)],
    count: 18000, firstRate: 0.28, top3Rate: 0.75, avgPlacement: 2.4,
  });
  const tiny = comp({
    id: 'c', title: '样本极少', heroes: [hero('杨玉环', '无阵营', 5)],
    count: 19, firstRate: 0.9, top3Rate: 0.95, avgPlacement: 1.2,
  });
  const result = recommend({
    comps: [heluo, river, tiny],
    commander: '明先生',
    bannedFaction: '河洛',
    snapshotDate: '2026-10-12',
    asOfDate: '2026-10-13',
  });
  assert.equal(result.formulaId, SCORE_FORMULA_ID);
  assert.match(SCORE_FORMULA_TEXT, /0\.45×前三率/);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].id, 'a');
  assert.match(result.rejected[0].reason, /花木兰/);
  assert.equal(result.primary.id, 'b');
  assert.ok(result.ranked.every((row) => row.id !== 'a'));
  assert.ok(result.uncertain.some((row) => row.id === 'c'));
  assert.ok(!result.ranked.some((row) => row.id === 'c'));
  assert.equal(compBlockedByBan(heluo, '河洛') != null, true);
  assert.equal(compBlockedByBan(river, '河洛'), null);
});

test('没有棋手分布时不制造棋手分差', () => {
  const only = comp({
    id: 'b', title: '大河套', heroes: [hero('虞姬', '大河流域')],
    count: 18000, firstRate: 0.28, top3Rate: 0.75, avgPlacement: 2.4,
  });
  const a = recommend({ comps: [only], commander: '瑶妹', bannedFaction: '逐鹿', snapshotDate: '2026-10-12', asOfDate: '2026-10-13' });
  const b = recommend({ comps: [only], commander: '白歌', bannedFaction: '逐鹿', snapshotDate: '2026-10-12', asOfDate: '2026-10-13' });
  assert.equal(a.primary.score, b.primary.score);
  assert.match(a.primary.reasons.join(''), /没有棋手分布/);
});

test('有棋手分布且占比够才加分', () => {
  const withCmd = comp({
    id: 'b', title: '大河套', heroes: [hero('虞姬', '大河流域')],
    count: 18000, firstRate: 0.28, top3Rate: 0.75, avgPlacement: 2.4,
    commanders: [{ name: '瑶妹', appearanceRate: 0.3, count: 100 }],
  });
  const hit = recommend({ comps: [withCmd], commander: '瑶妹', bannedFaction: '', snapshotDate: '2026-10-12', asOfDate: '2026-10-13' });
  const miss = recommend({ comps: [withCmd], commander: '白歌', bannedFaction: '', snapshotDate: '2026-10-12', asOfDate: '2026-10-13' });
  assert.ok(hit.primary.score > miss.primary.score);
  assert.equal(hit.primary.parts.commanderFit, 0.04);
  assert.equal(miss.primary.parts.commanderFit, 0);
});

test('统计排除非法名次且不改写', () => {
  const records = [
    { status: 'finished', placement: 1, chosenCommander: '瑶妹', lineupTitle: '甲', bannedFaction: '河洛', createdAt: '2026-10-13T01:00:00.000Z', gameVersionNote: 'v测试' },
    { status: 'finished', placement: 2, chosenCommander: '瑶妹', lineupTitle: '甲', bannedFaction: '河洛', createdAt: '2026-10-13T02:00:00.000Z', gameVersionNote: 'v测试' },
    { status: 'finished', placement: 7, placementError: '名次 7 非法', chosenCommander: '白歌', lineupTitle: '乙', createdAt: '2026-10-12T01:00:00.000Z' },
    { status: 'finished', placement: null, chosenCommander: '白歌', lineupTitle: '乙', createdAt: '2026-10-12T02:00:00.000Z' },
    { status: 'active', placement: 1, chosenCommander: '瑶妹', lineupTitle: '甲' },
  ];
  const stats = summarize(records);
  assert.equal(stats.validSample, 2);
  assert.equal(stats.excludedInvalid, 1);
  assert.equal(stats.excludedMissingPlacement, 1);
  assert.equal(stats.firstRate, 0.5);
  assert.equal(stats.top3Rate, 1);
  assert.equal(stats.avgPlacement, 1.5);
  assert.equal(stats.byCommander[0].key, '瑶妹');
  assert.equal(isStatsEligible(records[2]), false);
  assert.equal(records[2].placement, 7);
  assert.ok(!JSON.stringify(stats).includes('第7'));
  assert.ok(!JSON.stringify(stats).includes('第8'));
});

test('复盘不把名次写成决策错误，也不编造操作', () => {
  const record = createMatch();
  record.status = 'finished';
  record.placement = 6;
  record.chosenCommander = '瑶妹';
  record.bannedFaction = '河洛';
  record.lineupTitle = '公孙离标准';
  const review = reviewMatch(record, null);
  const blob = JSON.stringify(review);
  assert.match(blob, /不能单独证明/);
  assert.doesNotMatch(blob, /决策错误/);
  assert.ok(review.unknowns.some((line) => line.includes('没有关键决策记录')));
  assert.equal(review.improvements.length <= 3, true);
  assert.match(review.notUsed, /未调用外部模型/);
  assert.ok(review.facts.some((line) => line.includes('第 6 名')));
});

test('导入非法名次会标错并保留原值', () => {
  const imported = importMatch({ id: 'm1', status: 'finished', placement: 8, chosenCommander: '镜' });
  assert.equal(imported.ok, true);
  assert.equal(imported.record.placement, 8);
  assert.match(imported.record.placementError, /8/);
  assert.equal(isStatsEligible(imported.record), false);
  const ok = importMatch({ id: 'm2', status: 'finished', placement: 3 });
  assert.equal(ok.record.placementError, null);
  assert.equal(parsePlacement(0).state, 'invalid');
});

test('追踪可以修改、撤销和重做，非法名次写不进去', () => {
  let current = createMatch({ id: 't1' });
  let step = applyTrackOp(current, { type: 'set', field: 'chosenCommander', value: '闹闹' });
  assert.equal(step.ok, true);
  current = step.record;
  step = applyTrackOp(current, { type: 'set', field: 'hp', value: 48 });
  current = step.record;
  step = applyTrackOp(current, { type: 'set', field: 'placement', value: 7 });
  assert.equal(step.ok, false);
  assert.match(step.error, /7/);
  assert.equal(step.record.placement, null);
  step = applyTrackOp(current, { type: 'push', field: 'decisions', item: { id: 'd1', text: '8 能量时停止刷新' } });
  current = step.record;
  assert.equal(current.decisions.length, 1);
  const back = undoTrack(current);
  assert.equal(back.ok, true);
  assert.equal(back.record.decisions.length, 0);
  assert.equal(back.record.hp, 48);
  const forward = redoTrack(back.record);
  assert.equal(forward.record.decisions[0].text, '8 能量时停止刷新');
  const paused = applyTrackOp(forward.record, { type: 'set', field: 'status', value: 'paused' });
  assert.equal(paused.record.status, 'paused');
});

test('推荐结果里带函数时仍能继续写入', () => {
  let current = createMatch({ id: 't_clone' });
  const step = applyTrackOp(current, {
    type: 'set',
    field: 'recommendation',
    value: { formulaId: 'wxq-score-v1', primary: { title: '甲' }, explain() { return 'no'; } },
  });
  assert.equal(step.ok, true);
  assert.equal(step.record.recommendation.primary.title, '甲');
  assert.equal(step.record.recommendation.explain, undefined);
  current = step.record;
  const next = applyTrackOp(current, { type: 'set', field: 'gameVersionNote', value: '统计快照 2026-10-12' });
  assert.equal(next.ok, true);
  assert.equal(next.record.gameVersionNote, '统计快照 2026-10-12');
  assert.equal(next.record.recommendation.primary.title, '甲');
});

test('手册统计日和快照不一致时标成待重核', () => {
  const stale = playbookStatus({ id: 'p', title: '甲', version: '1.0.0', statsDate: '2026-10-01' }, '2026-10-12');
  assert.equal(stale.state, 'stale');
  const ok = playbookStatus({ id: 'p', title: '甲', version: '1.0.0', statsDate: '2026-10-12' }, '2026-10-12');
  assert.equal(ok.state, 'matched');
});
