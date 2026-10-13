<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AssistNav from '../components/AssistNav.vue';
import RecCard from '../components/RecCard.vue';
import {
  active, adopt, banOptions, commanders, draftBan, draftCommander, draftInvited,
  formulaText, health, initAssist, loadError, loading, resultFor, saveError,
  storageMode, storageNote, toggleInvited, version,
} from '../assistant/useAssist';

const router = useRouter();
onMounted(() => { initAssist(); });

const result = computed(() => draftCommander.value ? resultFor(draftCommander.value) : null);
const sameScore = computed(() => {
  if (draftInvited.value.length < 2) return false;
  const scores = draftInvited.value.map((name) => resultFor(name).primary?.score ?? null);
  return scores.every((score) => score === scores[0]);
});

function useRow(row: { id: string; title: string; playbookId: string | null }) {
  if (!result.value) return;
  adopt(row, result.value);
  if (!saveError.value) router.push('/track');
}
</script>

<template>
  <div>
    <AssistNav />
    <header class="assist-head">
      <div>
        <p class="kicker">开局</p>
        <h1>按本局禁用选阵容</h1>
      </div>
      <p class="muted">版本 {{ version || '…' }} · 统计 {{ health?.snapshotDate || '无' }} · {{ health?.freshness || '' }} · 存储 {{ storageMode === 'file' ? '同步目录' : storageMode === 'browser' ? '浏览器' : '…' }}</p>
    </header>
    <p v-if="loading" class="muted">正在读取快照和手册。</p>
    <p v-else-if="loadError" class="warn-line">{{ loadError }}</p>
    <template v-else>
      <p v-if="saveError" class="warn-line">{{ saveError }}</p>
      <p class="muted">{{ storageNote }}</p>
      <section class="panel">
        <div class="panel-title">三名特邀棋手 <span class="hint">已选 {{ draftInvited.length }}/3</span></div>
        <div class="chip-row">
          <button
            v-for="cmd in commanders" :key="cmd.id" type="button"
            class="pick" :class="{ on: draftInvited.includes(cmd.name) }"
            @click="toggleInvited(cmd.name)"
          >{{ cmd.name }}</button>
        </div>
        <div class="field-row">
          <label>本局禁用
            <select v-model="draftBan" class="input">
              <option value="">选择阵营</option>
              <option v-for="name in banOptions" :key="name" :value="name">{{ name }}</option>
            </select>
          </label>
          <p class="muted">无阵营不在禁用列表里。本地规则只确认「开局随机禁用一个阵营」，没有写无阵营可以被禁。</p>
        </div>
      </section>

      <div v-if="draftInvited.length" class="chip-row">
        <button
          v-for="name in draftInvited" :key="name" type="button" class="pick"
          :class="{ on: draftCommander === name }" @click="draftCommander = name"
        >看 {{ name }}</button>
      </div>
      <p v-if="!draftBan" class="warn-line">还没有禁用阵营。下面不会给出本局推荐。</p>
      <p v-else-if="sameScore" class="muted">这几名棋手的排序分相同。当前统计没有棋手条件样本，技能差异没有被算进分数。</p>
      <p v-if="active && active.status !== 'finished'" class="muted">有一局未结束的记录。采用新阵容会写进这局，已结束的不会被改。</p>

      <template v-if="result && draftBan">
        <RecCard v-if="result.primary" :row="result.primary" action="用这套记录本局" @adopt="useRow(result.primary)" />
        <div class="split">
          <RecCard v-for="row in result.alternatives" :key="row.id" :row="row" action="改用这套" @adopt="useRow(row)" />
        </div>
        <section v-if="result.rejected.length" class="panel">
          <div class="panel-title">被本局禁用拦下</div>
          <p v-for="row in result.rejected" :key="row.id">{{ row.title }}：{{ row.reason }}</p>
        </section>
        <details class="panel">
          <summary>样本不足，不进主排序（{{ result.uncertain.length }}）</summary>
          <p v-for="row in result.uncertain" :key="row.id">{{ row.title }} · {{ row.count }} 场 · 登顶 {{ (row.firstRate * 100).toFixed(1) }}%</p>
        </details>
        <details class="panel">
          <summary>排序公式 {{ result.formulaId }}</summary>
          <p>{{ formulaText }}</p>
        </details>
      </template>
    </template>
  </div>
</template>
