<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AssistNav from '../components/AssistNav.vue';
import {
  active, activeBook, bookState, discard, doneCount, finishMatch, initAssist,
  loadError, loading, makeReview, matches, op, redo, resume, saveError, undo,
} from '../assistant/useAssist';

onMounted(() => { initAssist(); });

const decisionText = ref('');
const heroName = ref('');
const heroLevel = ref<number | ''>('');
const transitionTo = ref('');
const transitionReason = ref('');
const noteText = ref('');
const openList = computed(() => matches.value.filter((m) => m.status !== 'finished'));
const stage = computed(() => activeBook.value?.stages.find((item) => item.id === active.value?.phaseId) || null);
const phases = [
  { id: 'open', cn: '开局' },
  { id: 'early', cn: '前期' },
  { id: 'mid', cn: '中期' },
  { id: 'late', cn: '后期' },
  { id: 'pivot', cn: '转型' },
];

function setNumber(field: 'hp' | 'gold' | 'level', raw: string) {
  op({ type: 'set', field, value: raw === '' ? null : Number(raw) });
}
function addDecision() {
  const text = decisionText.value.trim();
  if (!text) return;
  op({ type: 'push', field: 'decisions', item: { id: crypto.randomUUID(), at: new Date().toISOString(), text } });
  decisionText.value = '';
}
function addHero() {
  const name = heroName.value.trim();
  if (!name) return;
  op({
    type: 'push', field: 'heroes',
    item: { id: crypto.randomUUID(), name, level: heroLevel.value === '' ? null : Number(heroLevel.value), items: [] },
  });
  heroName.value = '';
  heroLevel.value = '';
}
function addTransition() {
  if (!transitionTo.value.trim() && !transitionReason.value.trim()) return;
  op({
    type: 'push', field: 'transitions',
    item: {
      id: crypto.randomUUID(), at: new Date().toISOString(),
      from: active.value?.lineupTitle || '', to: transitionTo.value.trim(), reason: transitionReason.value.trim(),
    },
  });
  transitionTo.value = '';
  transitionReason.value = '';
}
function addNote() {
  const text = noteText.value.trim();
  if (!text) return;
  op({ type: 'push', field: 'notes', item: { id: crypto.randomUUID(), at: new Date().toISOString(), text } });
  noteText.value = '';
}
function setPlacement(raw: string) {
  op({ type: 'set', field: 'placement', value: raw === '' ? null : Number(raw) });
}
</script>

<template>
  <div>
    <AssistNav />
    <p v-if="loading" class="muted">正在读取对局。</p>
    <p v-else-if="loadError" class="warn-line">{{ loadError }}</p>
    <template v-else>
      <header class="assist-head">
        <div>
          <p class="kicker">本局</p>
          <h1>{{ active?.lineupTitle || '还没有阵容' }}</h1>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm" type="button" :disabled="!active" @click="undo">撤销</button>
          <button class="btn btn-sm" type="button" :disabled="!active" @click="redo">重做</button>
          <button class="btn btn-sm" type="button" :disabled="!active || active.status !== 'active'" @click="op({ type: 'set', field: 'status', value: 'paused' })">暂停</button>
          <button class="btn btn-sm" type="button" :disabled="!active || active.status !== 'paused'" @click="op({ type: 'set', field: 'status', value: 'active' })">继续</button>
        </div>
      </header>
      <p v-if="saveError" class="warn-line">{{ saveError }}</p>
      <p v-if="!active" class="muted">从开局页采用一套阵容，或在下面恢复未结束的记录。空着的格子保持未知，不会自动补。</p>
      <section v-if="openList.length" class="panel">
        <div class="panel-title">未结束</div>
        <button v-for="item in openList" :key="item.id" class="btn btn-sm" type="button" @click="resume(item.id)">
          {{ item.lineupTitle || '未命名' }} · {{ item.status === 'paused' ? '已暂停' : '进行中' }}
        </button>
      </section>
      <template v-if="active">
        <p class="muted">完整度 {{ doneCount.filled }}/{{ doneCount.total }} · {{ active.status === 'finished' ? '已结束' : active.status === 'paused' ? '已暂停' : '记录中' }} · 棋手 {{ active.chosenCommander || '未记' }} · 禁用 {{ active.bannedFaction || '未记' }}</p>
        <p v-if="active.placementError" class="warn-line">名次数据错误：{{ active.placementError }}。原值 {{ active.placementRaw }} 还在，没有改成别的名次。改成 1 到 6 之后才会进入统计。</p>
        <section class="panel">
          <div class="panel-title">状态</div>
          <div class="field-row">
            <label>阶段
              <select class="input" :value="active.phaseId || ''" @change="op({ type: 'set', field: 'phaseId', value: ($event.target as HTMLSelectElement).value })">
                <option v-for="phase in phases" :key="phase.id" :value="phase.id">{{ phase.cn }}</option>
              </select>
            </label>
            <label>血量
              <input class="input" :value="active.hp ?? ''" inputmode="decimal" placeholder="未知" @change="setNumber('hp', ($event.target as HTMLInputElement).value)">
            </label>
            <label>能量
              <input class="input" :value="active.gold ?? ''" inputmode="numeric" placeholder="未知" @change="setNumber('gold', ($event.target as HTMLInputElement).value)">
            </label>
            <label>棋手等级
              <input class="input" :value="active.level ?? ''" inputmode="numeric" placeholder="未知" @change="setNumber('level', ($event.target as HTMLInputElement).value)">
            </label>
            <label>名次
              <select class="input" :value="active.placementError ? '' : (active.placement ?? '')" @change="setPlacement(($event.target as HTMLSelectElement).value)">
                <option value="">未记录</option>
                <option v-for="n in 6" :key="n" :value="n">第 {{ n }} 名</option>
              </select>
            </label>
          </div>
        </section>
        <section v-if="stage" class="panel">
          <div class="panel-title">当前手册 · {{ activeBook?.title }} · {{ stage.title }}</div>
          <p :class="bookState.state === 'matched' ? 'muted' : 'warn-line'">{{ bookState.message }}</p>
          <p v-for="(item, index) in stage.items" :key="index"><span class="kind" :data-kind="item.kind">{{ item.kind === 'fact' ? '事实' : item.kind === 'inference' ? '经验推断' : '待验证' }}</span> {{ item.text }}</p>
        </section>
        <p v-else-if="active.lineupTitle" class="muted">这套阵容没有对应手册，或者阶段对不上。缺少手册时只保存你写下的内容。</p>
        <section class="panel">
          <div class="panel-title">在场英雄</div>
          <p v-if="!active.heroes.length" class="muted">还没有记。</p>
          <p v-for="hero in active.heroes" :key="hero.id">
            {{ hero.name }}<template v-if="hero.level != null"> · {{ hero.level }} 级</template>
            <button class="btn btn-sm" type="button" @click="op({ type: 'removeList', field: 'heroes', id: hero.id })">删除</button>
          </p>
          <div class="field-row">
            <input v-model="heroName" class="input" placeholder="英雄名" @keyup.enter="addHero">
            <input v-model="heroLevel" class="input" placeholder="等级，可空" @keyup.enter="addHero">
            <button class="btn btn-sm" type="button" @click="addHero">加上</button>
          </div>
        </section>
        <section class="panel">
          <div class="panel-title">关键选择</div>
          <p v-if="!active.decisions.length" class="muted">还没有记。复盘不会替你编。</p>
          <p v-for="item in active.decisions" :key="item.id">
            {{ item.text }}
            <button class="btn btn-sm" type="button" @click="op({ type: 'removeList', field: 'decisions', id: item.id })">删除</button>
          </p>
          <div class="field-row">
            <input v-model="decisionText" class="input" placeholder="例如：血量 42 时停止刷新" @keyup.enter="addDecision">
            <button class="btn btn-sm btn-accent" type="button" @click="addDecision">记下</button>
          </div>
        </section>
        <section class="panel">
          <div class="panel-title">转型</div>
          <p v-for="item in active.transitions" :key="item.id">{{ item.from || '未写起点' }} → {{ item.to || '未写去向' }} {{ item.reason }}</p>
          <div class="field-row">
            <input v-model="transitionTo" class="input" placeholder="换成什么">
            <input v-model="transitionReason" class="input" placeholder="当时依据">
            <button class="btn btn-sm" type="button" @click="addTransition">记下</button>
          </div>
        </section>
        <section class="panel">
          <div class="panel-title">其他</div>
          <p v-for="item in active.notes" :key="item.id">{{ item.text }}</p>
          <div class="field-row">
            <input v-model="noteText" class="input" placeholder="对手、站位或其他你记得的事" @keyup.enter="addNote">
            <button class="btn btn-sm" type="button" @click="addNote">记下</button>
          </div>
        </section>
        <div class="row-actions">
          <button class="btn btn-accent" type="button" @click="finishMatch">结束并生成本地复盘</button>
          <button class="btn" type="button" @click="makeReview">只更新复盘，不结束</button>
          <button class="btn btn-danger" type="button" @click="discard(active.id)">删除这局</button>
        </div>
        <section v-if="active.review" class="panel">
          <div class="panel-title">复盘 <span class="hint">{{ active.review.generatedAt }} · {{ active.review.engine }}</span></div>
          <p class="muted">{{ active.review.notUsed }}</p>
          <h2>已知</h2>
          <p v-for="line in active.review.facts" :key="line">{{ line }}</p>
          <h2>推断</h2>
          <p v-for="line in active.review.inferences" :key="line">{{ line }}</p>
          <h2>无法判断</h2>
          <p v-for="line in active.review.unknowns" :key="line">{{ line }}</p>
          <h2>下一局可以做的</h2>
          <p v-for="line in active.review.improvements" :key="line">{{ line }}</p>
          <p><b>原则：</b>{{ active.review.principle }}</p>
          <p v-if="active.review.comparedPlaybook" class="muted">对照手册版本 {{ active.review.comparedPlaybook.version }}，统计日 {{ active.review.comparedPlaybook.statsDate || '未写' }}。以后改手册不会改这段记录。</p>
        </section>
      </template>
    </template>
  </div>
</template>
