import { createRouter, createWebHashHistory } from 'vue-router';
import MetaView from './views/MetaView.vue';
import CodexView from './views/CodexView.vue';
import WorkshopView from './views/WorkshopView.vue';
import LogView from './views/LogView.vue';
import HeroDetailView from './views/HeroDetailView.vue';
import EquipmentFitView from './views/EquipmentFitView.vue';
import TierView from './views/TierView.vue';
import FactionsView from './views/FactionsView.vue';
import ExplorerView from './views/ExplorerView.vue';
import CoachView from './views/CoachView.vue';
import AssistView from './views/AssistView.vue';
import PlaybookView from './views/PlaybookView.vue';
import TrackView from './views/TrackView.vue';
import StatsView from './views/StatsView.vue';
import HealthView from './views/HealthView.vue';
import OverlayView from './views/OverlayView.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/meta' },
    { path: '/assist', component: AssistView },
    { path: '/playbooks', component: PlaybookView },
    { path: '/playbooks/:id', component: PlaybookView },
    { path: '/track', component: TrackView },
    { path: '/stats', component: StatsView },
    { path: '/health', component: HealthView },
    { path: '/overlay', component: OverlayView, meta: { bare: true } },
    { path: '/coach', component: CoachView },
    { path: '/meta', component: MetaView },
    { path: '/explorer', component: ExplorerView },
    { path: '/codex', component: CodexView },
    { path: '/factions', component: FactionsView },
    { path: '/equipment', component: EquipmentFitView },
    { path: '/workshop', component: WorkshopView },
    { path: '/tier', component: TierView },
    { path: '/log', component: LogView },
    { path: '/hero/:id', component: HeroDetailView },
  ],
});
