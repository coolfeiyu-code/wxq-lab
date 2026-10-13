<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AssistNav from '../components/AssistNav.vue';
import { pct } from '../lib/format';
import type { GroupStat, MatchRecord } from '../core-module';
import { backup, discard, importPayload, initAssist, loadError, loading, matches, resume, saveError, stats, storageMode } from '../assistant/useAssist';

const router = useRouter();
onMounted(() => { initAssist(); });
const importNote = ref('');
const backupNote = ref('');
const illegal = computed(() => matches.value.filter((m) => m.placementError));
const groups: { title: string; key: 'byCommander' | 'byLineup' | 'byPair' | 'byBan' | 'byVersion' | 'byDate' }[] = [
  { title: '棋手', key: 'byCommander' },
  { title: '阵容', key: 'byLineup' },
  { title: '棋手 × 阵容', key: 'byPair' },
  { title: '禁用', key: 'byBan' },
  { title: '版本记录', key: 'byVersion' },
  { title: '日期', key: 'byDate' },
];

function rows(key: typeof groups[number]['key']): GroupStat[] {
  return stats.value[key];
}
function rate(n: number | null) {
  return n == null ? '—' : pct(n);
}
function avg(n: number | null) {
  return n == null ? '—' : n.toFixed(2);
}
function label(m: MatchRecord) {
  return `${(m.createdAt || '').slice(0, 16).replace('T', ' ')} · ${m.chosenCommander || '棋手未记'} · ${m.lineupTitle || '阵容未记'}`;
}
function open(id: string) {
  resume(id);
  router.push('/track');
}
async function onImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    const rowsIn = Array.isArray(parsed) ? parsed : (parsed as { matches?: unknown[] }).matches;
    if (!Array.isArray(rowsIn)) throw new Error('文件里没有对局数组');
    await importPayload(rowsIn);
    importNote.value = `已处理 ${rowsIn.length} 条。非法名次会保留原值并标成数据错误。`;
  } catch (err) {
    importNote.value = err instanceof Error ? err.message : String(err);
  }
}
async function onBackup() {
  try {
    const file = await backup();
    if (storageMode.value === 'browser' && file.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = file;
      a.download = 'wxq-matches.json';
      a.click();
      backupNote.value = '已下载浏览器里的记录。';
    } else {
      backupNote.value = file ? `已写入 ${file}` : '已备份';
    }
  } catch (err) {
    backupNote.value = err instanceof Error ? err.message : String(err);
  }
}
</script>

<template>
  <div>
    <AssistNav />
    <p v-if="loading" class="muted">正在读取战绩。</p>
    <p v-else-if="loadError" class="warn-line">{{ loadError }}</p>
    <template v-else>
      <header class="assist-head">
        <div>
          <p class="kicker">个人战绩</p>
          <h1>只算你自己的 1 到 6 名</h1>
        </div>
      </header>
      <p class="muted">{{ stats.definition }}</p>
      <p v-if="saveError" class="warn-line">{{ saveError }}</p>
      <section class="stat-strip">
        <section><div class="k">有效对局</div><div class="v">{{ stats.validSample }}</div></section>
        <section><div class="k">第一名率</div><div class="v">{{ rate(stats.firstRate) }}</div></section>
        <section><div class="k">前三率</div><div class="v">{{ rate(stats.top3Rate) }}</div></section>
        <section><div class="k">平均名次</div><div class="v">{{ avg(stats.avgPlacement) }}</div></section>
      </section>
      <p class="muted">全部记录 {{ stats.total }} · 已结束 {{ stats.finished }} · 名次非法 {{ stats.excludedInvalid }} · 已结束但没写名次 {{ stats.excludedMissingPlacement }}</p>
      <section v-if="illegal.length" class="panel">
        <div class="panel-title">需要改正的名次</div>
        <p v-for="item in illegal" :key="item.id">{{ label(item) }} · 原值 {{ item.placementRaw ?? item.placement }} · {{ item.placementError }}</p>
      </section>
      <section v-for="group in groups" :key="group.key" class="panel">
        <div class="panel-title">{{ group.title }}</div>
        <p v-if="!rows(group.key).length" class="muted">有效样本里没有这一项。</p>
        <p v-for="row in rows(group.key)" :key="row.key">{{ row.key }} · {{ row.sample }} 局 · 第一名 {{ rate(row.firstRate) }} · 前三 {{ rate(row.top3Rate) }} · 平均 {{ avg(row.avgPlacement) }}</p>
      </section>
      <section class="panel">
        <div class="panel-title">对局</div>
        <p v-if="!matches.length" class="muted">还没有记录。</p>
        <div v-for="item in matches" :key="item.id" class="match-row">
          <button class="btn btn-sm" type="button" @click="open(item.id)">打开</button>
          <span>{{ label(item) }}</span>
          <span>{{ item.placementError ? '名次错误' : item.placement ? `第 ${item.placement} 名` : '名次未记' }}</span>
          <button class="btn btn-sm btn-danger" type="button" @click="discard(item.id)">删除</button>
        </div>
      </section>
      <section class="panel">
        <div class="panel-title">备份与导入</div>
        <div class="row-actions">
          <button class="btn btn-sm" type="button" @click="onBackup">备份</button>
          <label class="btn btn-sm">导入 JSON<input class="file-input" type="file" accept="application/json" @change="onImport"></label>
        </div>
        <p class="muted">{{ backupNote }}</p>
        <p class="muted">{{ importNote }}</p>
        <p class="muted">社区数据在开局页，不进这里。不要两台电脑同时改同一份战绩。当前：{{ storageMode === 'file' ? '同步目录里的文件' : '这个浏览器' }}。</p>
      </section>
    </template>
  </div>
</template>
