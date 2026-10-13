<script setup lang="ts">
import { pct } from '../lib/format';
import type { RankedRow } from '../core-module';

withDefaults(defineProps<{ row: RankedRow; action?: string; showLink?: boolean }>(), { showLink: true });
defineEmits<{ adopt: [] }>();
</script>

<template>
  <article class="panel">
    <div class="panel-title">
      {{ row.title }}
      <span class="hint">{{ row.confidence }} · 样本 {{ row.count }}</span>
    </div>
    <p class="muted">{{ row.heroes.map((h) => `${h.name}·${h.faction}`).join('  ') }}</p>
    <div class="stat-grid">
      <div class="stat-cell"><div class="k">前三率</div><div class="v">{{ pct(row.top3Rate) }}</div></div>
      <div class="stat-cell"><div class="k">登顶率</div><div class="v">{{ pct(row.firstRate) }}</div></div>
      <div class="stat-cell"><div class="k">平均名次</div><div class="v">{{ row.avgPlacement == null ? '—' : row.avgPlacement.toFixed(2) }}</div></div>
    </div>
    <p class="score-line">排序分 {{ row.parts.score ?? '—' }} · 样本系数 {{ row.parts.sampleFactor ?? '未进主排序' }} · 棋手附加 {{ row.parts.commanderFit }}</p>
    <ul class="plain">
      <li v-for="line in row.reasons" :key="line">{{ line }}</li>
      <li v-for="line in row.weaknesses" :key="line">{{ line }}</li>
    </ul>
    <p class="muted">{{ row.source }}</p>
    <div class="row-actions">
      <RouterLink v-if="row.playbookId && showLink" class="btn btn-sm" :to="`/playbooks/${row.playbookId}`">操作手册</RouterLink>
      <button v-if="action" class="btn btn-sm btn-accent" type="button" @click="$emit('adopt')">{{ action }}</button>
    </div>
  </article>
</template>
