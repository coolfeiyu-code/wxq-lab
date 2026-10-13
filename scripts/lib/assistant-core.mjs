/**
 * 实战助手纯逻辑。不读盘、不访问网络。
 * 评分公式 id：wxq-score-v1。改权重必须改 id，并在 CHANGELOG 里写明。
 */

export const PLAYER_COUNT = 6;
export const VALID_PLACEMENTS = Object.freeze([1, 2, 3, 4, 5, 6]);
export const SCORE_FORMULA_ID = 'wxq-score-v1';

export const SCORE_FORMULA = Object.freeze({
  id: SCORE_FORMULA_ID,
  meanPlacement: 3.5,
  placementSpan: 2.5,
  firstCap: 0.4,
  weights: Object.freeze({ top3: 0.45, placement: 0.35, first: 0.2 }),
  minSampleRanked: 1000,
  sampleFactor: Object.freeze([
    Object.freeze({ min: 10000, factor: 1 }),
    Object.freeze({ min: 3000, factor: 0.92 }),
    Object.freeze({ min: 1000, factor: 0.8 }),
  ]),
  commanderFitBonus: 0.04,
  commanderFitMinRate: 0.15,
  freshness: Object.freeze([
    Object.freeze({ maxAgeDays: 2, factor: 1, label: '新鲜' }),
    Object.freeze({ maxAgeDays: 7, factor: 0.92, label: '渐旧' }),
    Object.freeze({ maxAgeDays: Infinity, factor: 0.8, label: '过期' }),
  ]),
});

export const SCORE_FORMULA_TEXT = [
  'wxq-score-v1，只在样本量 ≥ 1000 的阵容里排序。',
  '基础分 = 0.45×前三率 + 0.35×名次分 + 0.20×登顶分。',
  '名次分 = (3.50 − 平均名次) / 2.5，截断到 0–1。6 人局均值按 3.50。',
  '登顶分 = 登顶率 / 0.40，超过 0.40 的部分不再加分。',
  '样本系数：≥10000 为 1，≥3000 为 0.92，≥1000 为 0.80。不足 1000 不进主排序，只放在「样本不足」。',
  '仅当该阵容自己带有棋手分布、且该棋手出场占比 ≥ 15% 时，加 0.04。没有棋手分布就不加分，也不扣分。',
  '新鲜度：快照距今天 ≤2 天 ×1，3–7 天 ×0.92，更久或日期不明 ×0.80。',
  '最终分 = (基础分 × 样本系数 + 棋手附加) × 新鲜度。这不是胜率。',
].join('');

const BANNABLE = new Set(['河洛', '逐鹿', '日落海', '三分之地', '大河流域']);

export function bannableFactions(factions) {
  const names = (factions || []).map((f) => (typeof f === 'string' ? f : f.name)).filter(Boolean);
  const found = names.filter((n) => BANNABLE.has(n));
  return found.length ? found : [...BANNABLE];
}

export function ageDays(snapshotDate, asOfDate) {
  const a = Date.parse(`${snapshotDate}T00:00:00Z`);
  const b = Date.parse(`${asOfDate}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

function freshnessOf(snapshotDate, asOfDate) {
  const age = ageDays(snapshotDate, asOfDate);
  if (age == null || age < 0) {
    return { ageDays: age, factor: 0.8, label: '日期不明' };
  }
  const row = SCORE_FORMULA.freshness.find((r) => age <= r.maxAgeDays) || SCORE_FORMULA.freshness.at(-1);
  return { ageDays: age, factor: row.factor, label: row.label };
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function sampleFactor(count) {
  for (const row of SCORE_FORMULA.sampleFactor) {
    if (count >= row.min) return row.factor;
  }
  return null;
}

function num(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function compBlockedByBan(comp, bannedFaction) {
  if (!bannedFaction) return null;
  const hit = (comp.heroes || []).filter((h) => h && h.faction === bannedFaction);
  if (!hit.length) return null;
  return `禁用${bannedFaction}，不能使用 ${hit.map((h) => h.name).join('、')}`;
}

function commanderFit(comp, commander) {
  const rows = Array.isArray(comp.commanders) ? comp.commanders : null;
  if (!commander) {
    return { bonus: 0, note: '未选棋手，不加棋手关联分。' };
  }
  if (!rows || !rows.length) {
    return { bonus: 0, note: '这份阵容统计没有棋手分布，不加也不扣棋手关联分。' };
  }
  const row = rows.find((r) => r && r.name === commander);
  const rate = row ? num(row.appearanceRate) : null;
  if (row && rate != null && rate >= SCORE_FORMULA.commanderFitMinRate) {
    return { bonus: SCORE_FORMULA.commanderFitBonus, note: `${commander}在该阵容样本中的出场占比 ${(rate * 100).toFixed(1)}%，加 0.04。` };
  }
  if (row) {
    return { bonus: 0, note: `${commander}有出现，但占比低于 15%，不加分。` };
  }
  return { bonus: 0, note: `棋手分布里没有${commander}，不加分。` };
}

function confidenceOf(count, freshFactor, fitNote) {
  if (count >= 10000 && freshFactor === 1) return '高';
  if (count >= 3000 && freshFactor >= 0.92) return '中';
  return '低';
}

function scoreComp(comp, commander, fresh) {
  const count = num(comp.count) ?? 0;
  const top3 = clamp01(num(comp.top3Rate) ?? 0);
  const first = num(comp.firstRate) ?? 0;
  const avg = num(comp.avgPlacement);
  const placementScore = avg == null ? 0 : clamp01((SCORE_FORMULA.meanPlacement - avg) / SCORE_FORMULA.placementSpan);
  const firstScore = clamp01(first / SCORE_FORMULA.firstCap);
  const w = SCORE_FORMULA.weights;
  const base = w.top3 * top3 + w.placement * placementScore + w.first * firstScore;
  const factor = sampleFactor(count);
  const fit = commanderFit(comp, commander);
  const score = factor == null ? null : (base * factor + fit.bonus) * fresh.factor;
  return { count, top3, first, avg, placementScore, firstScore, base, factor, fit, score };
}

function reasonLines(comp, parts, fresh) {
  const lines = [];
  lines.push(`样本 ${parts.count} 场，前三率 ${(parts.top3 * 100).toFixed(1)}%，登顶率 ${(parts.first * 100).toFixed(1)}%，平均名次 ${parts.avg == null ? '缺失' : parts.avg.toFixed(2)}。`);
  lines.push(parts.fit.note);
  lines.push(`统计日 ${fresh.ageDays == null ? '不明' : `距参考日 ${fresh.ageDays} 天`}，新鲜度「${fresh.label}」。`);
  if (comp.source) lines.push(`来源：${comp.source}`);
  return lines;
}

function weaknessLines(comp, parts) {
  const lines = [];
  if (parts.count < 10000) lines.push(`样本 ${parts.count}，未到 1 万场，名次波动会比较大。`);
  if (parts.top3 < 0.6) lines.push('前三率低于 60%，下限不算稳。');
  if ((comp.heroes || []).some((h) => h.quality >= 5)) lines.push('阵容里有 5 阶英雄，成型依赖高阶来牌。这是卡牌品阶，不是回合脚本。');
  if (!comp.commanders) lines.push('没有棋手条件样本，不能把这份分说成「这个棋手专属强度」。');
  return lines;
}

export function recommend(input) {
  const comps = Array.isArray(input?.comps) ? input.comps : [];
  const commander = String(input?.commander || '').trim();
  const bannedFaction = input?.bannedFaction ? String(input.bannedFaction) : '';
  const snapshotDate = String(input?.snapshotDate || '');
  const asOfDate = String(input?.asOfDate || '');
  const fresh = freshnessOf(snapshotDate, asOfDate);
  const rejected = [];
  const uncertain = [];
  const ranked = [];

  for (const comp of comps) {
    const ban = compBlockedByBan(comp, bannedFaction);
    if (ban) {
      rejected.push({ id: comp.id, title: comp.title, reason: ban });
      continue;
    }
    const parts = scoreComp(comp, commander, fresh);
    const card = {
      id: comp.id,
      title: comp.title,
      heroes: comp.heroes || [],
      count: parts.count,
      firstRate: parts.first,
      top3Rate: parts.top3,
      avgPlacement: parts.avg,
      source: comp.source || '',
      sourceDetail: comp.sourceDetail || '',
      playbookId: comp.playbookId || null,
      score: parts.score,
      confidence: parts.factor == null ? '样本不足' : confidenceOf(parts.count, fresh.factor),
      reasons: reasonLines(comp, parts, fresh),
      weaknesses: weaknessLines(comp, parts),
      parts: {
        base: round4(parts.base),
        sampleFactor: parts.factor,
        commanderFit: parts.fit.bonus,
        freshness: fresh.factor,
        score: parts.score == null ? null : round4(parts.score),
      },
    };
    if (parts.factor == null) uncertain.push(card);
    else ranked.push(card);
  }

  ranked.sort((a, b) => b.score - a.score || b.count - a.count);
  uncertain.sort((a, b) => b.count - a.count);

  return {
    formulaId: SCORE_FORMULA_ID,
    formulaText: SCORE_FORMULA_TEXT,
    commander,
    bannedFaction,
    snapshotDate,
    asOfDate,
    freshness: fresh,
    ranked,
    uncertain,
    rejected,
    primary: ranked[0] || null,
    alternatives: ranked.slice(1, 3),
  };
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

export function parsePlacement(value, mode = 'optional') {
  if (value === null || value === undefined || value === '') {
    if (mode === 'required') return { state: 'invalid', value: null, reason: '名次缺失' };
    return { state: 'missing', value: null, reason: '' };
  }
  if (typeof value === 'string') {
    return { state: 'invalid', value, reason: '名次必须是数字，不能是字符串' };
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    return { state: 'invalid', value, reason: '名次必须是 1 到 6 的整数' };
  }
  if (!VALID_PLACEMENTS.includes(value)) {
    return { state: 'invalid', value, reason: `名次 ${value} 非法。对局固定 ${PLAYER_COUNT} 人，只能是 1、2、3、4、5、6` };
  }
  return { state: 'ok', value, reason: '' };
}

export function isStatsEligible(record) {
  if (!record || record.status !== 'finished') return false;
  if (record.placementError) return false;
  return parsePlacement(record.placement, 'required').state === 'ok';
}

function rate(part, whole) {
  if (!whole) return null;
  return part / whole;
}

function groupStats(records, keyFn) {
  const map = new Map();
  for (const rec of records) {
    const key = keyFn(rec);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(rec);
  }
  return [...map.entries()].map(([key, rows]) => ({ key, ...finishStats(rows), sample: rows.length })).sort((a, b) => b.sample - a.sample);
}

function finishStats(records) {
  const n = records.length;
  const first = records.filter((r) => r.placement === 1).length;
  const top3 = records.filter((r) => r.placement <= 3).length;
  const sum = records.reduce((s, r) => s + r.placement, 0);
  return {
    sample: n,
    firstCount: first,
    top3Count: top3,
    firstRate: rate(first, n),
    top3Rate: rate(top3, n),
    avgPlacement: n ? sum / n : null,
  };
}

export function summarize(records) {
  const list = Array.isArray(records) ? records : [];
  const finished = list.filter((r) => r && r.status === 'finished');
  const invalid = finished.filter((r) => r.placementError || parsePlacement(r.placement, 'optional').state === 'invalid');
  const missing = finished.filter((r) => !r.placementError && parsePlacement(r.placement, 'optional').state === 'missing');
  const valid = finished.filter(isStatsEligible);
  const overall = finishStats(valid);
  return {
    playerCount: PLAYER_COUNT,
    definition: '第一名率、前三率、平均名次只统计已结束且名次为 1–6 的对局。名次非法或缺失的记录单独计数，不改写、不进入比率。社区统计不混入。',
    total: list.length,
    finished: finished.length,
    validSample: valid.length,
    excludedInvalid: invalid.length,
    excludedMissingPlacement: missing.length,
    ...overall,
    byCommander: groupStats(valid, (r) => r.chosenCommander || ''),
    byLineup: groupStats(valid, (r) => r.lineupTitle || ''),
    byPair: groupStats(valid, (r) => (r.chosenCommander && r.lineupTitle ? `${r.chosenCommander} × ${r.lineupTitle}` : '')),
    byBan: groupStats(valid, (r) => (r.bannedFaction ? `禁用${r.bannedFaction}` : '')),
    byVersion: groupStats(valid, (r) => r.gameVersionNote || ''),
    byDate: groupStats(valid, (r) => String(r.createdAt || '').slice(0, 10)),
  };
}

function textOf(v) {
  return String(v || '').trim();
}

export function reviewMatch(record, playbook) {
  const facts = [];
  const inferences = [];
  const unknowns = [];
  const improvements = [];
  const rec = record || {};
  const placement = parsePlacement(rec.placement, 'optional');

  if (rec.chosenCommander) facts.push(`实际棋手：${rec.chosenCommander}。`);
  else unknowns.push('没有记录实际棋手。');

  if (rec.bannedFaction) facts.push(`本局禁用：${rec.bannedFaction}。`);
  else unknowns.push('没有记录禁用阵营。');

  if (Array.isArray(rec.invitedCommanders) && rec.invitedCommanders.length) {
    facts.push(`特邀棋手记录：${rec.invitedCommanders.join('、')}。`);
  } else {
    unknowns.push('没有记录三名特邀棋手。');
  }

  if (rec.lineupTitle) facts.push(`实际阵容记录为「${rec.lineupTitle}」。`);
  else unknowns.push('没有记录实际阵容，无法和手册对照。');

  if (placement.state === 'ok') {
    facts.push(`最终名次：第 ${placement.value} 名（6 人局）。`);
    inferences.push('最终名次不能单独证明某一次买牌、装备或转型是错的。下面只讨论已经写下的内容。');
  } else if (placement.state === 'invalid' || rec.placementError) {
    facts.push(`名次字段无法使用：${rec.placementError || placement.reason}。原始值仍保留，没有改成别的名次。`);
    unknowns.push('名次无效，不能讨论「这名次说明运营失败」。');
  } else {
    unknowns.push('没有最终名次。');
  }

  const decisions = Array.isArray(rec.decisions) ? rec.decisions.filter((d) => textOf(d.text)) : [];
  if (!decisions.length) {
    unknowns.push('没有关键决策记录，不能判断某一回合的选择。');
    improvements.push('下一局至少记下三条原话：锁定哪套阵容、一次资源取舍、一次转或明确不转。');
  } else {
    for (const d of decisions) facts.push(`已记录决策：${textOf(d.text)}`);
    inferences.push('这些决策只说明当时写下了什么，不说明它们导致了名次。');
  }

  if (rec.hp == null) unknowns.push('缺少血量，不能判断该不该转守。');
  else facts.push(`记录的血量：${rec.hp}。`);
  if (rec.gold == null) unknowns.push('缺少能量，不能判断该不该刷新或升阶。');
  else facts.push(`记录的能量：${rec.gold}。`);
  if (rec.level == null) unknowns.push('缺少棋手等级。');
  else facts.push(`记录的棋手等级：${rec.level}。`);

  const heroes = Array.isArray(rec.heroes) ? rec.heroes.filter((h) => textOf(h.name)) : [];
  if (!heroes.length) unknowns.push('没有记录在场英雄，不能判断成型到了哪一步。');
  else facts.push(`在场英雄记录：${heroes.map((h) => h.name).join('、')}。`);

  let compared = null;
  if (playbook && rec.lineupTitle && playbook.title && playbook.title !== rec.lineupTitle && playbook.compTitle !== rec.lineupTitle) {
    facts.push(`当前选中的手册是「${playbook.title}」，与记录阵容「${rec.lineupTitle}」不是同一套。`);
    unknowns.push('手册和实际阵容对不上，不能用这本手册判定操作偏离。');
  } else if (playbook) {
    const stage = (playbook.stages || []).find((s) => s.id === rec.phaseId) || null;
    compared = {
      id: playbook.id,
      version: playbook.version,
      statsDate: playbook.statsDate || null,
      stageId: stage?.id || rec.phaseId || null,
      stageTitle: stage?.title || null,
    };
    facts.push(`对照手册「${playbook.title}」版本 ${playbook.version}，统计日 ${playbook.statsDate || '未写'}。`);
    if (!stage) {
      unknowns.push('记录的阶段在这本手册里没有对应段，不能逐段对照。');
    } else {
      facts.push(`记录停在「${stage.title}」。`);
      const actionable = (stage.items || []).filter((item) => item.kind !== 'fact');
      if (actionable.length && decisions.length) {
        inferences.push(`手册此阶段有 ${actionable.length} 条经验或待验证建议。它们不是本局已经发生的操作。`);
      }
      if (!decisions.length && stage.items?.length) {
        improvements.push(`若下一局仍走「${playbook.title}」，在「${stage.title}」把手册里的停止条件写成你的实际选择。`);
      }
    }
  } else if (rec.lineupTitle) {
    unknowns.push('没有可用手册，无法做操作对照。');
  }

  const transitions = Array.isArray(rec.transitions) ? rec.transitions.filter((t) => textOf(t.to) || textOf(t.reason)) : [];
  if (transitions.length) {
    for (const t of transitions) {
      facts.push(`转型记录：${textOf(t.from) || '未写起点'} → ${textOf(t.to) || '未写去向'}${textOf(t.reason) ? `，原因：${textOf(t.reason)}` : ''}。`);
    }
  } else {
    unknowns.push('没有转型记录。不能判断中途有没有换路线。');
    if (improvements.length < 3) improvements.push('如果中途换了核心，写下「从什么换成什么」和当时的血量或能量。没换也写一句「未转型」。');
  }

  if (rec.hp != null && rec.hp <= 30 && !transitions.length && improvements.length < 3) {
    inferences.push('血量已经记到 30 或以下，但没有转型记录。这只说明记录缺口和血量同时存在，不能认定应该转型。');
    improvements.push('血量 ≤ 30 时补一句：继续原路线，还是改买已经在场的牌。');
  }

  if (placement.state === 'ok' && placement.value >= 5 && decisions.length && improvements.length < 3) {
    inferences.push('名次在第 5 或第 6，同时有决策记录。可以复盘这些记录，但不能倒推哪一条是败因。');
  }

  const principle = decisions.length
    ? '先把「当时看到的血量、能量和在场核心」写下来，再评价选择。没有这三个数，名次只说明结果。'
    : '没有决策原文时，复盘只能指出缺了什么，不能编一轮操作。';

  return {
    engine: 'local-review-v1',
    generatedAt: new Date().toISOString(),
    gameVersionNote: rec.gameVersionNote || '',
    comparedPlaybook: compared,
    facts,
    inferences,
    unknowns,
    improvements: improvements.slice(0, 3),
    principle,
    notUsed: '未调用外部模型。未记录的操作没有补写。',
  };
}

export function playbookStatus(playbook, snapshotDate) {
  if (!playbook) return { state: 'missing', message: '没有手册。' };
  if (!playbook.statsDate || !snapshotDate) {
    return { state: 'unverified', message: '手册或快照缺少统计日，不能标成适配当日版本。' };
  }
  if (playbook.statsDate !== snapshotDate) {
    return { state: 'stale', message: `手册依据 ${playbook.statsDate} 的统计，当前快照是 ${snapshotDate}。操作段需要重核后才能当作现行版本。` };
  }
  return { state: 'matched', message: `手册统计日与当前快照同为 ${snapshotDate}。卡牌原文若更旧，机制句仍可能过期。` };
}

const SET_FIELDS = new Set([
  'invitedCommanders', 'bannedFaction', 'chosenCommander', 'lineupId', 'lineupTitle',
  'playbookId', 'playbookVersion', 'phaseId', 'hp', 'gold', 'level', 'placement',
  'status', 'gameVersionNote', 'recommendation',
]);

function cleanNumber(value, label, integer) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label}必须是空值或非负数字`);
  }
  if (integer && !Number.isInteger(value)) throw new Error(`${label}必须是整数`);
  return value;
}

function plainClone(value) {
  try {
    return structuredClone(value);
  } catch {
    // Vue 响应式代理在浏览器里不能 structuredClone。JSON 只保留数据字段。
    return JSON.parse(JSON.stringify(value));
  }
}

function slim(record) {
  const copy = plainClone(record);
  delete copy.past;
  delete copy.future;
  return copy;
}

function mutate(record, op) {
  if (!op || typeof op !== 'object') throw new Error('无效操作');
  if (op.type === 'set') {
    if (!SET_FIELDS.has(op.field)) throw new Error('不能修改该字段');
    if (op.field === 'placement') {
      const parsed = parsePlacement(op.value, 'optional');
      if (parsed.state === 'invalid') throw new Error(parsed.reason);
      record.placement = parsed.value;
      record.placementRaw = parsed.value;
      record.placementError = null;
      return record;
    }
    if (op.field === 'hp') record.hp = cleanNumber(op.value, '血量', false);
    else if (op.field === 'gold') record.gold = cleanNumber(op.value, '能量', true);
    else if (op.field === 'level') {
      const level = cleanNumber(op.value, '等级', true);
      if (level != null && level > 999) throw new Error('等级超出 1–999');
      record.level = level;
    } else if (op.field === 'status') {
      if (!['active', 'paused', 'finished'].includes(op.value)) throw new Error('状态无效');
      record.status = op.value;
    } else if (op.field === 'invitedCommanders') {
      if (!Array.isArray(op.value) || op.value.length > 3) throw new Error('特邀棋手最多 3 名');
      record.invitedCommanders = op.value.map((x) => String(x));
    } else if (op.field === 'recommendation') {
      record.recommendation = op.value == null ? null : plainClone(op.value);
    } else {
      record[op.field] = op.value == null || op.value === '' ? null : op.value;
    }
    return record;
  }
  if (op.type === 'push') {
    const field = op.field;
    if (!['decisions', 'notes', 'heroes', 'transitions'].includes(field)) throw new Error('不能追加该列表');
    const item = op.item || {};
    if (!item.id) throw new Error('记录缺少 id');
    if (field === 'heroes' && !textOf(item.name)) throw new Error('英雄名不能为空');
    if ((field === 'decisions' || field === 'notes') && !textOf(item.text)) throw new Error('内容不能为空');
    record[field] = [...(record[field] || []), item];
    return record;
  }
  if (op.type === 'removeList') {
    if (!['decisions', 'notes', 'heroes', 'transitions'].includes(op.field)) throw new Error('不能删除该列表');
    record[op.field] = (record[op.field] || []).filter((item) => item.id !== op.id);
    return record;
  }
  if (op.type === 'patchList') {
    if (!['decisions', 'notes', 'heroes', 'transitions'].includes(op.field)) throw new Error('不能修改该列表');
    record[op.field] = (record[op.field] || []).map((item) => (item.id === op.id ? { ...item, ...op.patch, id: item.id } : item));
    return record;
  }
  if (op.type === 'attachReview') {
    if (!op.review || !Array.isArray(op.review.facts) || !Array.isArray(op.review.unknowns)) {
      throw new Error('复盘结果不完整');
    }
    record.reviews = [...(record.reviews || []), op.review];
    record.review = op.review;
    return record;
  }
  throw new Error('未知操作');
}

export function createMatch(seed = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: seed.id || crypto.randomUUID(),
    createdAt: seed.createdAt || now,
    updatedAt: now,
    status: 'active',
    gameVersionNote: seed.gameVersionNote || '',
    invitedCommanders: [],
    bannedFaction: null,
    chosenCommander: null,
    recommendation: null,
    lineupId: null,
    lineupTitle: null,
    playbookId: null,
    playbookVersion: null,
    phaseId: 'open',
    hp: null,
    gold: null,
    level: null,
    heroes: [],
    decisions: [],
    transitions: [],
    notes: [],
    placement: null,
    placementRaw: null,
    placementError: null,
    review: null,
    reviews: [],
    past: [],
    future: [],
  };
}

export function applyTrackOp(record, op) {
  try {
    const prev = slim(record);
    const next = mutate(plainClone(record), op);
    next.past = [...(record.past || []), prev].slice(-40);
    next.future = [];
    next.updatedAt = new Date().toISOString();
    return { ok: true, record: next };
  } catch (err) {
    return { ok: false, error: String(err.message || err), record };
  }
}

export function undoTrack(record) {
  const past = record.past || [];
  if (!past.length) return { ok: false, error: '没有可撤销的操作', record };
  const prev = past[past.length - 1];
  const restored = { ...plainClone(prev), past: past.slice(0, -1), future: [...(record.future || []), slim(record)].slice(-40) };
  restored.updatedAt = new Date().toISOString();
  return { ok: true, record: restored };
}

export function redoTrack(record) {
  const future = record.future || [];
  if (!future.length) return { ok: false, error: '没有可重做的操作', record };
  const nxt = future[future.length - 1];
  const restored = { ...plainClone(nxt), future: future.slice(0, -1), past: [...(record.past || []), slim(record)].slice(-40) };
  restored.updatedAt = new Date().toISOString();
  return { ok: true, record: restored };
}

export function completeness(record) {
  const placement = parsePlacement(record?.placement, 'required');
  const items = [
    ['棋手', Boolean(record?.chosenCommander)],
    ['禁用阵营', Boolean(record?.bannedFaction)],
    ['阵容', Boolean(record?.lineupTitle)],
    ['阶段', Boolean(record?.phaseId)],
    ['血量', record?.hp != null],
    ['能量', record?.gold != null],
    ['决策', Array.isArray(record?.decisions) && record.decisions.length > 0],
    ['有效名次', placement.state === 'ok' && !record?.placementError],
  ];
  const filled = items.filter(([, ok]) => ok).length;
  return { filled, total: items.length, items };
}

export function importMatch(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: '记录不是对象', record: null };
  }
  const base = createMatch({ id: typeof raw.id === 'string' ? raw.id : undefined, createdAt: raw.createdAt });
  const record = { ...base, ...plainClone(raw), schemaVersion: 1, past: [], future: [] };
  if (!record.id) record.id = base.id;
  const errors = [];
  const placement = parsePlacement(record.placement, 'optional');
  if (placement.state === 'invalid') {
    record.placementRaw = raw.placement;
    record.placementError = placement.reason;
    errors.push(placement.reason);
  } else {
    record.placement = placement.value;
    record.placementRaw = placement.value;
    record.placementError = null;
  }
  if (record.placementError) record.statsEligible = false;
  if (!['active', 'paused', 'finished'].includes(record.status)) {
    record.status = 'active';
    errors.push('状态无效，已保持为进行中，没有改名次');
  }
  record.heroes = Array.isArray(record.heroes) ? record.heroes : [];
  record.decisions = Array.isArray(record.decisions) ? record.decisions : [];
  record.transitions = Array.isArray(record.transitions) ? record.transitions : [];
  record.notes = Array.isArray(record.notes) ? record.notes : [];
  record.reviews = Array.isArray(record.reviews) ? record.reviews : [];
  return { ok: true, error: errors.join('；'), errors, record };
}

export function dataHealth(input) {
  const cardUpdatedAt = input?.cardUpdatedAt || null;
  const snapshotDate = input?.snapshotDate || null;
  const asOfDate = input?.asOfDate || null;
  const age = ageDays(snapshotDate, asOfDate);
  const conflicts = [];
  if (cardUpdatedAt && snapshotDate && cardUpdatedAt < snapshotDate) {
    conflicts.push(`卡牌原文库日期是 ${cardUpdatedAt}，对局统计快照是 ${snapshotDate}。排序用统计，技能原文不能直接当成现行机制。`);
  }
  if (input?.knownPatchNote) conflicts.push(input.knownPatchNote);
  let freshness = '日期不明';
  if (age != null && age <= 2) freshness = '新鲜';
  else if (age != null && age <= 7) freshness = '渐旧';
  else if (age != null) freshness = '过期';
  return {
    snapshotDate,
    cardUpdatedAt,
    asOfDate,
    ageDays: age,
    freshness,
    partial: Boolean(input?.partial),
    partialReason: input?.partialReason || '',
    sampleNote: input?.sampleNote || '',
    conflicts,
    sources: input?.sources || [],
  };
}
