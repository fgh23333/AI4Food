<script setup lang="ts">
defineProps<{ total: number; open: number; cuisines: number; chains: number; chainStores: number; health?: number | null }>()

// AI 探针健康度元信息：>60% 良好(绿) / 30-60% 波动(黄) / <30% 异常(红) / null 待测(灰)
function healthMeta(h?: number | null): { text: string; label: string; cls: string } {
  if (h === null || h === undefined) return { text: '—', label: '待测', cls: 'gray' }
  const pct = `${Math.round(h * 100)}%`
  if (h > 0.6) return { text: pct, label: '良好', cls: 'green' }
  if (h >= 0.3) return { text: pct, label: '波动', cls: 'yellow' }
  return { text: pct, label: '异常', cls: 'red' }
}
</script>

<template>
  <div class="stats">
    <div class="stat"><b>{{ total }}</b><span>家餐厅</span></div>
    <div class="stat"><b>{{ open }}</b><span>家营业中</span></div>
    <div class="stat"><b>{{ cuisines }}</b><span>种菜系</span></div>
    <div class="stat"><b>{{ chains }}</b><span>个连锁品牌 · {{ chainStores }} 店</span></div>
    <div class="stat ai" :class="healthMeta(health).cls" :title="'AI 探针最近一次推荐非空率（每小时更新）'">
      <b>{{ healthMeta(health).text }}</b><span>AI {{ healthMeta(health).label }}</span>
    </div>
  </div>
</template>

<style scoped>
.stats { display: flex; gap: 12px; flex-wrap: wrap; }
.stat { background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.18); border-radius: 14px; padding: 12px 18px; min-width: 104px; }
.stat b { font-size: 24px; font-weight: 800; display: block; line-height: 1.1; }
.stat span { font-size: 12px; opacity: .9; }
.stat.ai.green { border-color: rgba(76,175,80,.7); background: rgba(76,175,80,.22); }
.stat.ai.yellow { border-color: rgba(255,193,7,.7); background: rgba(255,193,7,.22); }
.stat.ai.red { border-color: rgba(244,67,54,.7); background: rgba(244,67,54,.22); }
.stat.ai.gray { opacity: .55; }
/* 移动端：统计转 2×2 栅格（桌面 base 的 flex-wrap 不动） */
@media (max-width: 768px) {
  .stats { display: grid; grid-template-columns: repeat(2, 1fr); }
  .stat { min-width: 0; }
}
</style>
