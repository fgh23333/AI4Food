<script setup lang="ts">
import { useFavoritesStore } from '@/stores/favorites'

const props = defineProps<{ id: string }>()
const favorites = useFavoritesStore()

// stopPropagation：防止在可点击卡片（如 AskAi 的 pick 卡片）中冒泡触发跳转
function onClick(e: MouseEvent): void {
  e.stopPropagation()
  favorites.toggle(props.id)
}
</script>

<template>
  <button
    class="fav"
    :class="{ active: favorites.has(id) }"
    :aria-label="favorites.has(id) ? '取消收藏' : '加入想吃清单'"
    :title="favorites.has(id) ? '取消收藏' : '加入想吃清单'"
    @click="onClick"
  >{{ favorites.has(id) ? '❤️' : '🤍' }}</button>
</template>

<style scoped>
.fav { background: none; border: 0; cursor: pointer; font-size: 18px; line-height: 1; padding: 2px 4px; color: var(--ink-mute); transition: transform .12s; flex-shrink: 0; }
.fav:hover { transform: scale(1.15); }
.fav.active { color: #e5484d; }
</style>
