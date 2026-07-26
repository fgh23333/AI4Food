<script setup lang="ts">
import type { RestaurantEntry } from '@/types/restaurant'
import { REPO } from '@/lib/repo'
import { branchClosed, branchLabel, specialTag } from '@/composables/useChains'
import { statusLabel } from '@/lib/status'

defineProps<{ branches: RestaurantEntry[]; open: boolean }>()
</script>

<template>
  <div class="branch-list">
    <a v-for="b in branches" :key="b.id" :class="{ closed: branchClosed(b) }" class="row" :href="`${REPO}/blob/main/${b.path}`" target="_blank" rel="noopener" :title="b.address">
      <span class="label">{{ branchLabel(b) }}</span>
      <span v-if="branchClosed(b)" class="badge closed">{{ statusLabel(b.status) }}</span>
      <span v-else-if="specialTag(b)" class="badge">{{ specialTag(b) }}</span>
      <span v-if="b.rating" class="rate">★ {{ b.rating.toFixed(1) }}</span>
      <span class="go">›</span>
    </a>
  </div>
</template>

<style scoped>
.branch-list { display: flex; flex-direction: column; }
.row { display: grid; grid-template-columns: 1fr auto auto 14px; align-items: center; gap: 10px; text-decoration: none; color: var(--ink); padding: 9px 8px; border-radius: 9px; }
.row + .row { border-top: 1px dashed var(--line); }
.row:hover { background: var(--bg); }
.row.closed { opacity: .58; }
.label { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { font-size: 10.5px; font-weight: 700; color: var(--accent); background: var(--accent-soft); padding: 2px 8px; border-radius: 999px; }
.badge.closed { color: #8a7a6a; background: #ece4d8; }
.rate { font-size: 12.5px; font-weight: 700; color: var(--accent); }
.go { color: var(--ink-mute); }
/* 溢出兜底：让 .label 的 ellipsis 真正生效，防长分店名撑爆行（桌面渲染不变） */
.label { min-width: 0; }
/* 移动端：行内边距温和收紧（桌面 base 不动） */
@media (max-width: 768px) {
  .row { padding: 8px 6px; gap: 8px; }
}
</style>
