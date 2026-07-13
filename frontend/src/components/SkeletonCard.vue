<script setup lang="ts"></script>

<template>
  <article class="skeleton-card">
    <div class="s-head">
      <div class="s-block s-name" />
      <div class="s-block s-stars" />
    </div>
    <div class="s-meta">
      <div class="s-block s-pill" />
      <div class="s-block s-pill" />
      <div class="s-block s-pill" />
    </div>
    <div class="s-block s-line" />
    <div class="s-recs">
      <div class="s-block s-chip" />
      <div class="s-block s-chip" />
    </div>
    <div class="s-foot">
      <div class="s-block s-note" />
      <div class="s-block s-link" />
    </div>
  </article>
</template>

<style scoped>
.skeleton-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-top: 3px solid var(--line-strong);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 220px;
}
.s-head { display: flex; justify-content: space-between; gap: 10px; }
.s-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.s-recs { display: flex; flex-wrap: wrap; gap: 6px; }
.s-foot { margin-top: auto; padding-top: 11px; border-top: 1px dashed var(--line); display: flex; justify-content: space-between; align-items: center; gap: 8px; }

.s-block {
  background: linear-gradient(90deg, var(--line) 25%, var(--line-strong) 50%, var(--line) 75%);
  background-size: 200% 100%;
  border-radius: 8px;
  animation: pulse 1.6s ease-in-out infinite;
}
.s-name { width: 55%; height: 20px; border-radius: 6px; }
.s-stars { width: 80px; height: 16px; border-radius: 6px; }
.s-pill { width: 52px; height: 20px; border-radius: 999px; }
.s-line { width: 70%; height: 14px; border-radius: 6px; }
.s-chip { width: 64px; height: 22px; border-radius: 8px; }
.s-note { width: 45%; height: 14px; border-radius: 6px; }
.s-link { width: 72px; height: 16px; border-radius: 6px; }

@keyframes pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
