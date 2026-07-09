<script setup lang="ts">
import { computed } from 'vue'
import type { RestaurantDraft } from '@/types/ai'
import {
  CUISINES,
  STATUSES,
  PRICE_LEVELS,
  STATUS_LABEL,
  draftWarnings,
  tagsToString,
  parseTags,
  draftToMarkdown,
  draftFileName,
} from '@/lib/draft'

// 可编辑草稿：双向绑定到父组件的 draft 对象。
const draft = defineModel<RestaurantDraft>('draft', { required: true })

// tags 用逗号分隔字符串做输入中介
const tagsText = computed({
  get: () => tagsToString(draft.value.tags),
  set: (v: string) => {
    draft.value.tags = parseTags(v)
  },
})

const warnings = computed(() => draftWarnings(draft.value))
const markdown = computed(() => draftToMarkdown(draft.value))
const fileName = computed(() => draftFileName(draft.value))

async function copyYaml(): Promise<void> {
  try {
    await navigator.clipboard.writeText(markdown.value)
  } catch {
    // 剪贴板不可用时静默忽略
  }
}

function downloadMd(): void {
  const blob = new Blob([markdown.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.value
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="draft-editor">
    <div class="form">
      <label class="field">
        <span class="lbl">店名 <em>*</em></span>
        <input v-model="draft.name" type="text" placeholder="餐厅名称" />
      </label>
      <div class="row2">
        <label class="field">
          <span class="lbl">菜系</span>
          <select v-model="draft.cuisine">
            <option v-for="c in CUISINES" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <label class="field">
          <span class="lbl">价位</span>
          <select v-model.number="draft.price_level">
            <option v-for="p in PRICE_LEVELS" :key="p" :value="p">{{ '￥'.repeat(p) }}（{{ p }}）</option>
          </select>
        </label>
        <label class="field">
          <span class="lbl">状态</span>
          <select v-model="draft.status">
            <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_LABEL[s] ?? s }}</option>
          </select>
        </label>
      </div>
      <div class="row2">
        <label class="field">
          <span class="lbl">城市</span>
          <input v-model="draft.city" type="text" placeholder="上海" />
        </label>
        <label class="field">
          <span class="lbl">国家</span>
          <input v-model="draft.country" type="text" placeholder="cn" />
        </label>
      </div>
      <label class="field">
        <span class="lbl">地址</span>
        <input v-model="draft.address" type="text" placeholder="详细地址" />
      </label>
      <label class="field">
        <span class="lbl">电话</span>
        <input v-model="draft.phone" type="text" placeholder="021-xxxxxxx" />
      </label>
      <label class="field">
        <span class="lbl">标签</span>
        <input v-model="tagsText" type="text" placeholder="火锅, 连锁, 静安寺" />
      </label>
      <label class="field">
        <span class="lbl">备注</span>
        <textarea v-model="draft.notes" rows="2" placeholder="分店、营业情况等"></textarea>
      </label>
      <label class="field">
        <span class="lbl">探店正文</span>
        <textarea v-model="draft.description" rows="3" placeholder="探店描述"></textarea>
      </label>
    </div>

    <aside class="preview">
      <div v-if="warnings.length" class="warnings">
        <p v-for="w in warnings" :key="w">⚠️ {{ w }}</p>
      </div>
      <div class="preview-head">
        <span class="preview-title">{{ fileName }}</span>
        <div class="actions">
          <button class="ghost" @click="copyYaml">复制</button>
          <button class="ghost" @click="downloadMd">下载 .md</button>
        </div>
      </div>
      <pre class="yaml">{{ markdown }}</pre>
      <p class="hint">id 需人工填写，格式 <code>{country}-{city拼音}-{slug}</code>。核对后按 <a href="https://github.com/fgh23333/AI4Food/blob/main/docs/CONTRIBUTING.md" target="_blank" rel="noopener">贡献规范</a> 提交。</p>
    </aside>
  </div>
</template>

<style scoped>
.draft-editor { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.form { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.lbl { font-size: 12.5px; color: var(--ink-soft); font-weight: 600; }
.lbl em { color: var(--brand); font-style: normal; }
.row2 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.field input, .field select, .field textarea {
  padding: 9px 12px; border: 1px solid var(--line-strong); border-radius: 10px;
  font-size: 14px; background: var(--bg); color: var(--ink); font-family: inherit;
}
.field input:focus, .field select:focus, .field textarea:focus { outline: 2px solid var(--brand); border-color: var(--brand); }
.preview { position: sticky; top: 16px; align-self: start; }
.preview-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.preview-title { font-size: 13px; color: var(--ink-soft); font-family: ui-monospace, monospace; }
.actions { display: flex; gap: 8px; }
button.ghost { background: transparent; color: var(--brand); border: 1px solid var(--brand); padding: 5px 12px; border-radius: 8px; font-size: 13px; cursor: pointer; }
button.ghost:hover { background: var(--brand-soft); }
.warnings { background: var(--accent-soft); border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; }
.warnings p { margin: 2px 0; font-size: 12.5px; color: var(--ink); }
.yaml { background: var(--bg); border: 1px solid var(--line); border-radius: 12px; padding: 14px; font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 12.5px; overflow-x: auto; color: var(--ink); white-space: pre-wrap; max-height: 360px; overflow-y: auto; }
.hint { margin-top: 10px; font-size: 12px; color: var(--ink-mute); }
.hint code { background: var(--bg); padding: 1px 5px; border-radius: 4px; font-size: 11px; }
.hint a { color: var(--brand); }
@media (max-width: 720px) { .draft-editor { grid-template-columns: 1fr; } .row2 { grid-template-columns: 1fr; } }
</style>
