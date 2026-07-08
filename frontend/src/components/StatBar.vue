<script setup lang="ts">
defineProps<{ total: number; open: number; cuisines: number; chains: number; chainStores: number }>()
</script>

<template>
  <div class="stats">
    <div class="stat"><b>{{ total }}</b><span>家餐厅</span></div>
    <div class="stat"><b>{{ open }}</b><span>家营业中</span></div>
    <div class="stat"><b>{{ cuisines }}</b><span>种菜系</span></div>
    <div class="stat"><b>{{ chains }}</b><span>个连锁品牌 · {{ chainStores }} 店</span></div>
  </div>
</template>

<style scoped>
.stats { display: flex; gap: 12px; flex-wrap: wrap; }
.stat { background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.18); border-radius: 14px; padding: 12px 18px; min-width: 104px; }
.stat b { font-size: 24px; font-weight: 800; display: block; line-height: 1.1; }
.stat span { font-size: 12px; opacity: .9; }
</style>
