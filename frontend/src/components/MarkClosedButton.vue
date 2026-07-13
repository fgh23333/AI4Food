<script setup lang="ts">
import { ref } from 'vue'
import type { RestaurantEntry } from '@/types/restaurant'
import { buildClosedMarkdown, buildGithubEditUrl } from '@/lib/closeDraft'

const props = defineProps<{ entry: RestaurantEntry }>()
const reason = ref('')

function onClick(): void {
  const markdown = buildClosedMarkdown(props.entry, reason.value.trim() || undefined)
  const url = buildGithubEditUrl(props.entry, markdown)
  window.open(url, '_blank', 'noopener')
}
</script>

<template>
  <div class="mark-closed">
    <input
      v-model="reason"
      type="text"
      class="reason"
      aria-label="关店原因（可选）"
      placeholder="关店原因（可选）"
    />
    <button type="button" class="btn" @click="onClick">标记已关闭</button>
  </div>
</template>

<style scoped>
.mark-closed {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.reason {
  flex: 1 1 200px;
  min-width: 0;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--card);
  color: var(--ink-soft);
  font-size: 13px;
}
.reason:focus {
  outline: none;
  border-color: var(--brand);
}
.btn {
  padding: 8px 18px;
  border-radius: 10px;
  border: 1px solid var(--line-strong);
  background: var(--card);
  color: var(--ink-soft);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.btn:hover {
  background: var(--bg);
  border-color: var(--ink-mute);
}
</style>
