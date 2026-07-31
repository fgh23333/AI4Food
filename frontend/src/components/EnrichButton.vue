<script setup lang="ts">
import type { RestaurantEntry } from '@/types/restaurant'
import { buildEnrichUrl } from '@/lib/enrichDraft'

const props = defineProps<{ entry: RestaurantEntry }>()

// 跳转 GitHub 编辑原文件页（不预填，避免覆盖原文；贡献者在原文基础上补字段）
function open(): void {
  window.open(buildEnrichUrl(props.entry), '_blank')
}
</script>

<template>
  <button class="enrich" @click="open">📝 帮忙补全数据 →</button>
</template>

<style scoped>
.enrich { background: var(--brand-soft); color: var(--brand-dark); border: 1px solid var(--brand); padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background .15s, color .15s; }
.enrich:hover { background: var(--brand); color: #fff; }
</style>
