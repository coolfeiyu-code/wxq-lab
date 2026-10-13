<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import AssistNav from '../components/AssistNav.vue';
import { pct } from '../lib/format';
import { bookFor, health, initAssist, loadError, loading, playbooks, snapshotDate } from '../assistant/useAssist';
import { playbookStatus } from '@core';

const route = useRoute();
onMounted(() => { initAssist(); });
const current = computed(() => {
  const id = String(route.params.id || '');
  return id ? bookFor(id) : null;
});
const state = computed(() => current.value ? playbookStatus(current.value, snapshotDate.value) : null);
const kindLabel: Record<string, string> = { fact: '事实', inference: '经验推断', unverified: '待验证' };
</script>

<template>
  <div>
    <AssistNav />
    <p v-if="loading" class="muted">正在读取手册。</p>
    <p v-else-if="loadError" class="warn-line">{{ loadError }}</p>
    <template v-else-if="!current">
      <header class="assist-head">
        <div>
          <p class="kicker">手册</p>
          <h1>有条件的操作，不写死回合</h1>
        </div>
      </header>
      <p class="muted">每本手册绑在 {{ playbooks[0]?.statsDate || '未知' }} 的统计上。当前快照是 {{ health?.snapshotDate || '无' }}。日期不一致时，操作段需要重核。</p>
      <RouterLink v-for="book in playbooks" :key="book.id" class="panel book-link" :to="`/playbooks/${book.id}`">
        <div class="panel-title">{{ book.title }} <span class="hint">手册 {{ book.version }} · {{ book.status === 'partial' ? '部分核验' : book.status }}</span></div>
        <p>{{ book.heroes.join('、') }}</p>
        <p class="muted">样本 {{ book.stats.count }} · 前三 {{ pct(book.stats.top3Rate) }} · 登顶 {{ pct(book.stats.firstRate) }} · 禁用 {{ book.bannedIf.join('、') }} 时不可用</p>
      </RouterLink>
    </template>
    <template v-else>
      <header class="assist-head">
        <div>
          <p class="kicker">手册 {{ current.version }}</p>
          <h1>{{ current.title }}</h1>
        </div>
        <RouterLink to="/playbooks">全部手册</RouterLink>
      </header>
      <p :class="state?.state === 'matched' ? 'muted' : 'warn-line'">{{ state?.message }}</p>
      <section class="panel">
        <div class="panel-title">统计 <span class="hint">{{ current.statsDate }}</span></div>
        <p>样本 {{ current.stats.count }} · 前三 {{ pct(current.stats.top3Rate) }} · 登顶 {{ pct(current.stats.firstRate) }} · 平均名次 {{ current.stats.avgPlacement.toFixed(2) }}</p>
        <p>英雄：{{ current.heroes.join('、') }}</p>
        <p>禁用 {{ current.bannedIf.join('或') }} 时不要用这本手册。</p>
        <p v-for="risk in current.risks" :key="risk" class="muted">{{ risk }}</p>
        <p v-for="source in current.sources" :key="source.path" class="muted">{{ source.kind }} · {{ source.path }} · {{ source.queriedAt || source.updatedAt || '' }}</p>
      </section>
      <section v-for="stage in current.stages" :key="stage.id" class="panel">
        <div class="panel-title">{{ stage.title }}</div>
        <p v-for="(item, index) in stage.items" :key="`${stage.id}-${index}`" class="stage-line">
          <span class="kind" :data-kind="item.kind">{{ kindLabel[item.kind] || item.kind }}</span>
          {{ item.text }}
        </p>
      </section>
    </template>
  </div>
</template>
