<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AssistNav from '../components/AssistNav.vue';
import { formulaId, formulaText, health, initAssist, loadError, loading, storageMode, storageNote, version } from '../assistant/useAssist';

const sources = ref<{ name: string; result: string }[]>([]);
onMounted(async () => {
  await initAssist();
  try {
    const res = await fetch('/data/assistant/source-status.json');
    if (res.ok) {
      const body = await res.json() as { sources?: { name: string; result: string }[] };
      sources.value = body.sources || [];
    }
  } catch { /* 没有探测文件时留空 */ }
});
</script>

<template>
  <div>
    <AssistNav />
    <p v-if="loading" class="muted">正在核对数据状态。</p>
    <p v-else-if="loadError" class="warn-line">{{ loadError }}</p>
    <template v-else>
      <header class="assist-head">
        <div>
          <p class="kicker">数据</p>
          <h1>能用的，和还不能当成新版本的</h1>
        </div>
        <p class="muted">程序 {{ version || '未读到' }} · 公式 {{ formulaId }}</p>
      </header>
      <section class="stat-strip">
        <section><div class="k">统计快照</div><div class="v">{{ health?.snapshotDate || '无' }}</div></section>
        <section><div class="k">新鲜度</div><div class="v">{{ health?.freshness }}</div></section>
        <section><div class="k">卡牌原文</div><div class="v">{{ health?.cardUpdatedAt || '无' }}</div></section>
        <section><div class="k">战绩存放</div><div class="v">{{ storageMode === 'file' ? '文件' : '浏览器' }}</div></section>
      </section>
      <p class="muted">{{ health?.sampleNote }}</p>
      <p class="warn-line">{{ health?.partialReason }}</p>
      <section class="panel">
        <div class="panel-title">冲突和过期</div>
        <p v-for="line in health?.conflicts || []" :key="line">{{ line }}</p>
        <p v-if="!health?.conflicts?.length" class="muted">没有写出冲突。</p>
      </section>
      <section class="panel">
        <div class="panel-title">本次用到的来源</div>
        <p v-for="source in health?.sources || []" :key="source.name">{{ source.name }}：{{ source.detail }}</p>
      </section>
      <section class="panel">
        <div class="panel-title">2026-10-13 外部探测</div>
        <p v-for="source in sources" :key="source.name"><b>{{ source.name }}。</b>{{ source.result }}</p>
      </section>
      <section class="panel">
        <div class="panel-title">王者营地</div>
        <p>没有接入。没有确认到官方公开、且覆盖万象对局的稳定接口。战绩用手动记录、导出和导入。</p>
      </section>
      <section class="panel">
        <div class="panel-title">自动读取对局</div>
        <p>没有做。也没有截图识别。对局过程只来自你在追踪页写下的内容。</p>
      </section>
      <section class="panel">
        <div class="panel-title">排序公式</div>
        <p>{{ formulaText }}</p>
      </section>
      <p class="muted">{{ storageNote }}</p>
      <p class="muted">更新统计仍用原来的「更新数据」。本机若被数据源拒绝，会保留上一份快照。悬浮窗成品本身不抓取。</p>
    </template>
  </div>
</template>
