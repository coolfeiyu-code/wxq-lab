<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
const links = [
  { to: '/assist', cn: '开局' },
  { to: '/playbooks', cn: '手册' },
  { to: '/track', cn: '本局' },
  { to: '/stats', cn: '战绩' },
  { to: '/health', cn: '数据' },
];
function on(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`);
}
</script>

<template>
  <nav class="assist-nav" aria-label="实战">
    <RouterLink v-for="link in links" :key="link.to" :to="link.to" :class="{ on: on(link.to) }">{{ link.cn }}</RouterLink>
    <RouterLink to="/overlay" class="quiet">悬浮窗</RouterLink>
  </nav>
</template>
