<script setup lang="ts">
import SearchBar from './SearchBar.vue'

defineProps<{ cuisineOptions: string[]; resultCount: string; locating?: boolean }>()
defineEmits<{ locate: [] }>()
const query = defineModel<string>('query', { default: '' })
const cuisine = defineModel<string>('cuisine', { default: '' })
const price = defineModel<number>('price', { default: 0 })
const onlyOpen = defineModel<boolean>('onlyOpen', { default: true })
const mergeChains = defineModel<boolean>('mergeChains', { default: true })
const distanceSort = defineModel<boolean>('distanceSort', { default: false })
</script>

<template>
  <div class="bar">
    <SearchBar v-model="query" />
    <select v-model="cuisine"><option value="">全部菜系</option><option v-for="c in cuisineOptions" :key="c" :value="c">{{ c }}</option></select>
    <select v-model.number="price">
      <option :value="0">全部价位</option>
      <option :value="1">¥ 人均低</option><option :value="2">¥¥</option><option :value="3">¥¥¥</option><option :value="4">¥¥¥¥</option><option :value="5">¥¥¥¥¥ 人均高</option>
    </select>
    <label class="toggle"><input type="checkbox" v-model="mergeChains" /><span>合并连锁店</span></label>
    <label class="toggle"><input type="checkbox" v-model="onlyOpen" /><span>仅营业中</span></label>
    <button
      class="geo"
      :class="{ active: distanceSort }"
      :disabled="locating"
      :title="distanceSort ? '已按距离排序，点击取消' : '按距离排序（需定位）'"
      @click="$emit('locate')"
    >{{ locating ? '📍 定位中…' : distanceSort ? '📍 按距离' : '📍 附近' }}</button>
    <span class="count">{{ resultCount }}</span>
  </div>
</template>

<style scoped>
.bar { background: var(--card); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow-lg); padding: 12px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
select { appearance: none; background: var(--bg); color: var(--ink); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; font-size: 13.5px; cursor: pointer; }
.toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-soft); cursor: pointer; padding: 9px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); }
.toggle input { width: 16px; height: 16px; accent-color: var(--brand); margin: 0; }
.geo { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; padding: 9px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--ink-soft); font-size: 13px; font-family: inherit; }
.geo:hover:not(:disabled) { border-color: var(--brand); color: var(--brand); }
.geo.active { background: var(--brand-soft); border-color: var(--brand); color: var(--brand-dark); font-weight: 600; }
.geo:disabled { opacity: .6; cursor: progress; }
.count { font-size: 12.5px; color: var(--ink-mute); margin-left: auto; }
/* 移动端：工具条转纵向堆叠、子项全宽（桌面 base 的 flex-wrap 不动） */
@media (max-width: 768px) {
  .bar { flex-direction: column; align-items: stretch; gap: 8px; }
  .bar > * { width: 100%; }
  .count { margin-left: 0; }
}
</style>
