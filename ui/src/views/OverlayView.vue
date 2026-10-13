<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import RecCard from '../components/RecCard.vue';
import { pct } from '../lib/format';
import {
  active, activeBook, adopt, banOptions, bookState, commanders, draftBan, draftCommander,
  draftInvited, finishMatch, health, initAssist, loadError, loading, op, resultFor, saveError,
  storageMode, toggleInvited, undo, version,
} from '../assistant/useAssist';

const tab = ref<'rec' | 'book' | 'log'>('rec');
const decisionText = ref('');
onMounted(() => {
  initAssist();
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

const result = computed(() => (draftCommander.value && draftBan.value) ? resultFor(draftCommander.value) : null);
const stage = computed(() => activeBook.value?.stages.find((item) => item.id === active.value?.phaseId) || activeBook.value?.stages[0] || null);

function onKey(event: KeyboardEvent) {
  const tag = (event.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (event.key === '1') tab.value = 'rec';
  if (event.key === '2') tab.value = 'book';
  if (event.key === '3') tab.value = 'log';
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
  }
}
function usePrimary() {
  if (!result.value?.primary) return;
  adopt(result.value.primary, result.value);
  if (!saveError.value) tab.value = 'log';
}
function addDecision() {
  const text = decisionText.value.trim();
  if (!text) return;
  op({ type: 'push', field: 'decisions', item: { id: crypto.randomUUID(), at: new Date().toISOString(), text } });
  decisionText.value = '';
}
function post(cmd: string) {
  const host = (window as unknown as { chrome?: { webview?: { postMessage: (msg: unknown) => void } } }).chrome?.webview;
  host?.postMessage(cmd);
}
</script>

<template>
  <div class="overlay-page" tabindex="0">
    <header class="overlay-bar">
      <strong>实战</strong>
      <span>{{ version || '' }}</span>
      <span>{{ health?.snapshotDate || '无快照' }} · {{ health?.freshness || '' }}</span>
      <span>{{ storageMode === 'file' ? '文件' : '浏览器' }}</span>
      <button type="button" class="btn btn-sm" @click="post('hide')">隐藏</button>
    </header>
    <div class="overlay-tabs">
      <button type="button" :class="{ on: tab === 'rec' }" @click="tab = 'rec'">推荐 1</button>
      <button type="button" :class="{ on: tab === 'book' }" @click="tab = 'book'">手册 2</button>
      <button type="button" :class="{ on: tab === 'log' }" @click="tab = 'log'">记录 3</button>
    </div>
    <p v-if="loading" class="muted">读取中</p>
    <p v-else-if="loadError" class="warn-line">{{ loadError }}</p>
    <template v-else>
    <p v-if="saveError" class="warn-line">{{ saveError }}</p>
    <template v-if="tab === 'rec'">
      <div class="chip-row">
        <button v-for="cmd in commanders" :key="cmd.id" type="button" class="pick" :class="{ on: draftInvited.includes(cmd.name) }" @click="toggleInvited(cmd.name)">{{ cmd.name }}</button>
      </div>
      <div class="field-row">
        <select v-model="draftBan" class="input">
          <option value="">禁用阵营</option>
          <option v-for="name in banOptions" :key="name" :value="name">{{ name }}</option>
        </select>
        <select v-model="draftCommander" class="input">
          <option value="">看哪一位</option>
          <option v-for="name in draftInvited" :key="name" :value="name">{{ name }}</option>
        </select>
      </div>
      <p v-if="draftInvited.length !== 3 || !draftBan" class="muted">选满 3 名特邀，并指定禁用，才给出本局推荐。</p>
      <template v-else-if="result">
        <RecCard v-if="result.primary" :row="result.primary" :show-link="false" action="采用并记录" @adopt="usePrimary" />
        <p v-for="row in result.alternatives" :key="row.id" class="muted">备选 {{ row.title }} · 前三 {{ pct(row.top3Rate) }} · 样本 {{ row.count }}</p>
        <p v-if="result.rejected.length" class="muted">已拦住 {{ result.rejected.length }} 套禁用冲突。</p>
      </template>
    </template>
    <template v-else-if="tab === 'book'">
      <p v-if="!activeBook" class="muted">采用一套有手册的阵容后，这里显示当前阶段。没有手册就不会编一段操作。</p>
      <template v-else>
        <p class="panel-title">{{ activeBook.title }}</p>
        <p :class="bookState.state === 'matched' ? 'muted' : 'warn-line'">{{ bookState.message }}</p>
        <p v-if="stage" class="muted">{{ stage.title }}</p>
        <p v-for="(item, index) in stage?.items || []" :key="index">{{ item.text }}</p>
      </template>
    </template>
    <template v-else>
      <p class="muted">{{ active?.lineupTitle || '未采用阵容' }} · {{ active?.status || '无记录' }}</p>
      <div class="field-row" v-if="active">
        <select class="input" :value="active.phaseId || 'open'" @change="op({ type: 'set', field: 'phaseId', value: ($event.target as HTMLSelectElement).value })">
          <option value="open">开局</option>
          <option value="early">前期</option>
          <option value="mid">中期</option>
          <option value="late">后期</option>
          <option value="pivot">转型</option>
        </select>
        <input class="input" :value="active.hp ?? ''" placeholder="血量" @change="op({ type: 'set', field: 'hp', value: ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value) })">
        <input class="input" :value="active.gold ?? ''" placeholder="能量" @change="op({ type: 'set', field: 'gold', value: ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value) })">
        <select class="input" :value="active.placementError ? '' : (active.placement ?? '')" @change="op({ type: 'set', field: 'placement', value: ($event.target as HTMLSelectElement).value === '' ? null : Number(($event.target as HTMLSelectElement).value) })">
          <option value="">名次</option>
          <option v-for="n in 6" :key="n" :value="n">第 {{ n }} 名</option>
        </select>
      </div>
      <div class="field-row">
        <input v-model="decisionText" class="input" placeholder="记下一条选择" @keyup.enter="addDecision">
        <button class="btn btn-sm" type="button" @click="addDecision">记</button>
        <button class="btn btn-sm" type="button" @click="undo">撤销</button>
      </div>
      <p v-for="item in active?.decisions || []" :key="item.id">{{ item.text }}</p>
      <button v-if="active && active.status !== 'finished'" class="btn btn-sm btn-accent" type="button" @click="finishMatch">结束并复盘</button>
      <p v-if="active?.placementError" class="warn-line">{{ active.placementError }}。原值仍保留，请改成第 1 到第 6 名。</p>
      <section v-if="active?.review">
        <p v-for="line in active.review.improvements" :key="line">{{ line }}</p>
        <p class="muted">{{ active.review.principle }}</p>
      </section>
    </template>
    </template>
  </div>
</template>
