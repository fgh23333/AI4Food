<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { askRecommendStream, generateDraft, ApiError } from '@/lib/api'
import { dedupeChainPicks } from '@/lib/recommend'
import DraftEditor from '@/components/DraftEditor.vue'
import type { RecommendResponse, DraftResponse } from '@/types/ai'

type Tab = 'recommend' | 'draft'
const tab = ref<Tab>('recommend')

// 智能推荐状态
const question = ref('')
const recommendResult = ref<RecommendResponse | null>(null)
const dedupedPicks = computed(() => recommendResult.value ? dedupeChainPicks(recommendResult.value.picks) : [])
const recommendLoading = ref(false)
const recommendError = ref<string | null>(null)
const streamingAnswer = ref('')
let recommendAbort: AbortController | null = null

// 草稿生成状态
const description = ref('')
const draftResult = ref<DraftResponse | null>(null)
const draftLoading = ref(false)
const draftError = ref<string | null>(null)
let draftAbort: AbortController | null = null

const router = useRouter()

const EXAMPLES = [
  '上海有什么日料推荐',
  '静安寺附近适合情侣约会的西餐',
  '人均100以内的火锅',
  '一个人吃饭的性价比之选',
]

async function onRecommend(example?: string): Promise<void> {
  const q = (example ?? question.value).trim()
  if (!q) return
  if (example) question.value = example
  recommendLoading.value = true
  recommendError.value = null
  recommendResult.value = null
  streamingAnswer.value = ''
  recommendAbort?.abort()
  recommendAbort = new AbortController()
  try {
    recommendResult.value = await askRecommendStream(
      q,
      (chunk) => {
        streamingAnswer.value += chunk
      },
      recommendAbort.signal,
    )
  } catch (e) {
    recommendError.value = formatError(e)
  } finally {
    recommendLoading.value = false
  }
}

async function onDraft(): Promise<void> {
  const d = description.value.trim()
  if (!d) return
  draftLoading.value = true
  draftError.value = null
  draftResult.value = null
  draftAbort?.abort()
  draftAbort = new AbortController()
  try {
    draftResult.value = await generateDraft(d, draftAbort.signal)
  } catch (e) {
    draftError.value = formatError(e)
  } finally {
    draftLoading.value = false
  }
}

function formatError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 503) return 'AI 服务暂未就绪（后端未配置 LLM），请稍后再试。'
    if (e.status === 400) return '输入内容无效，请检查后重试。'
    if (e.status === 502) return 'AI 响应解析失败，请换种问法重试。'
    if (e.status === 429) return '请求过于频繁，请稍后再试。'
    return `请求失败（${e.status}）：${e.message}`
  }
  if (e instanceof Error && e.name === 'AbortError') return '请求已取消。'
  return e instanceof Error ? e.message : String(e)
}

function goDetail(id: string): void {
  router.push({ name: 'detail', params: { id } })
}
</script>

<template>
  <header class="hero">
    <div class="wrap">
      <div class="brand"><span class="logo">🤖</span><div><h1>问问 AI</h1><p class="sub">自然语言找餐厅 · AI 辅助贡献草稿</p></div></div>
      <nav class="tabs">
        <button :class="{ active: tab === 'recommend' }" @click="tab = 'recommend'">🍽️ 智能推荐</button>
        <button :class="{ active: tab === 'draft' }" @click="tab = 'draft'">✍️ AI 草稿</button>
      </nav>
    </div>
  </header>

  <main class="wrap">
    <!-- 智能推荐 -->
    <section v-if="tab === 'recommend'" class="panel">
      <p class="hint">用一句话描述你的需求，AI 会从本图鉴收录的餐厅里挑选最合适的几家。</p>
      <div class="input-row">
        <input v-model="question" type="text" placeholder="例如：静安寺附近适合情侣约会的西餐" maxlength="500" @keyup.enter="onRecommend()" :disabled="recommendLoading" />
        <button class="primary" @click="onRecommend()" :disabled="recommendLoading || !question.trim()">{{ recommendLoading ? '思考中…' : '提问' }}</button>
      </div>
      <div class="examples">
        <span class="ex-label">试试：</span>
        <button v-for="ex in EXAMPLES" :key="ex" class="chip" @click="onRecommend(ex)" :disabled="recommendLoading">{{ ex }}</button>
      </div>

      <div v-if="recommendLoading && streamingAnswer" class="result">
        <p class="answer">{{ streamingAnswer }}<span class="cursor">▍</span></p>
        <p class="streaming-hint">正在为你挑选餐厅…</p>
      </div>
      <div v-else-if="recommendLoading" class="state">🤔 AI 正在挑选…</div>
      <div v-else-if="recommendError" class="state error">⚠️ {{ recommendError }}</div>
      <div v-else-if="recommendResult" class="result">
        <p class="answer">{{ recommendResult.answer }}</p>
        <div v-if="dedupedPicks.length" class="picks">
          <article v-for="pick in dedupedPicks" :key="pick.id" class="pick" @click="goDetail(pick.id)">
            <div class="pick-head">
              <span class="pick-name">{{ pick.name ?? pick.id }}</span>
              <span class="pick-score">{{ (pick.score * 100).toFixed(0) }}% 匹配</span>
            </div>
            <p class="pick-reason">{{ pick.reason }}</p>
            <span class="pick-link">查看详情 →</span>
          </article>
        </div>
        <p v-else class="empty">没有匹配的餐厅，换个问法试试？</p>
        <p class="meta">共考察 {{ recommendResult.candidates_considered }} 家候选 · 模型 {{ recommendResult.model }}</p>
      </div>
    </section>

    <!-- AI 草稿 -->
    <section v-else class="panel draft-panel">
      <p class="hint">描述一家你想收录的餐厅，AI 会生成 frontmatter 草稿供你核对——<strong>不会自动写入数据集</strong>，需人工校验后按贡献规范提交。</p>
      <div class="input-row">
        <textarea v-model="description" rows="3" placeholder="例如：愚园路新开了一家本帮菜，人均120，有包间，主打草头圈子" maxlength="500" :disabled="draftLoading" />
      </div>
      <div class="input-row">
        <button class="primary" @click="onDraft()" :disabled="draftLoading || !description.trim()">{{ draftLoading ? '生成中…' : '生成草稿' }}</button>
      </div>

      <div v-if="draftLoading" class="state">✍️ AI 正在生成草稿…</div>
      <div v-else-if="draftError" class="state error">⚠️ {{ draftError }}</div>
      <div v-else-if="draftResult" class="result">
        <div v-if="draftResult.warnings.length" class="server-warnings">
          <p v-for="w in draftResult.warnings" :key="w">⚠️ {{ w }}</p>
        </div>
        <DraftEditor :draft="draftResult.draft" />
        <p class="meta">模型 {{ draftResult.model }} · 请核对字段后再提交，id/坐标等需人工补全。</p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.hero { background: linear-gradient(135deg, #c8553d, #8a3020); color: #fff; padding: 46px 0 28px; }
.brand { display: flex; align-items: center; gap: 14px; }
.logo { width: 46px; height: 46px; border-radius: 13px; background: rgba(255,255,255,.16); display: grid; place-items: center; font-size: 24px; }
h1 { margin: 0; font-size: 30px; font-weight: 800; }
.sub { margin: 2px 0 0; font-size: 13.5px; opacity: .9; }
.tabs { margin-top: 22px; display: flex; gap: 8px; }
.tabs button { background: rgba(255,255,255,.14); color: #fff; border: 0; padding: 9px 16px; border-radius: 10px; font-size: 14px; cursor: pointer; }
.tabs button.active { background: #fff; color: var(--brand-dark); font-weight: 600; }
.panel { background: var(--card); border-radius: var(--radius); box-shadow: var(--shadow); padding: 28px; margin: 28px auto 64px; max-width: 820px; }
.hint { color: var(--ink-soft); margin: 0 0 18px; font-size: 14.5px; }
.input-row { display: flex; gap: 10px; margin-bottom: 14px; }
.input-row input, .input-row textarea { flex: 1; padding: 12px 14px; border: 1px solid var(--line-strong); border-radius: 12px; font-size: 15px; background: var(--bg); color: var(--ink); font-family: inherit; }
.input-row input:focus, .input-row textarea:focus { outline: 2px solid var(--brand); border-color: var(--brand); }
button.primary { background: var(--brand); color: #fff; border: 0; padding: 12px 22px; border-radius: 12px; font-size: 15px; cursor: pointer; white-space: nowrap; }
button.primary:disabled { background: var(--ink-mute); cursor: not-allowed; }
.examples { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
.ex-label { color: var(--ink-mute); font-size: 13px; }
.chip { background: var(--brand-soft); color: var(--brand-dark); border: 0; padding: 6px 12px; border-radius: 16px; font-size: 13px; cursor: pointer; }
.chip:disabled { opacity: .5; cursor: not-allowed; }
.state { text-align: center; padding: 48px 20px; color: var(--ink-mute); }
.state.error { color: var(--brand-dark); }
.result { margin-top: 18px; }
.answer { font-size: 17px; font-weight: 600; color: var(--ink); margin: 0 0 18px; line-height: 1.7; }
.cursor { color: var(--brand); animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.streaming-hint { color: var(--ink-mute); font-size: 13px; margin: 8px 0 0; }
.picks { display: grid; gap: 14px; }
.pick { background: var(--bg); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; cursor: pointer; transition: box-shadow .15s, border-color .15s; }
.pick:hover { box-shadow: var(--shadow); border-color: var(--brand); }
.pick-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.pick-name { font-weight: 700; font-size: 16px; color: var(--ink); }
.pick-score { font-size: 12.5px; color: var(--accent); white-space: nowrap; }
.pick-reason { margin: 8px 0 0; color: var(--ink-soft); font-size: 14px; line-height: 1.6; }
.pick-link { font-size: 13px; color: var(--brand); }
.empty { color: var(--ink-mute); text-align: center; padding: 24px; }
.draft-panel { max-width: 1100px; }
.server-warnings { background: var(--accent-soft); border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
.server-warnings p { margin: 2px 0; font-size: 13px; color: var(--ink); }
.meta { margin-top: 14px; font-size: 12.5px; color: var(--ink-mute); }
@media (max-width: 560px) { .input-row { flex-direction: column; } .panel { padding: 20px; } }
/* 平板：标题/面板留白平滑收缩（clamp 上界=桌面值，1024 处连续；桌面 base 不动） */
@media (max-width: 1024px) {
  h1 { font-size: clamp(24px, 2.9vw, 30px); }
  .hero { padding: clamp(32px, 4.5vw, 46px) 0 clamp(20px, 2.7vw, 28px); }
  .panel { padding: clamp(20px, 2.7vw, 28px); }
}
/* 移动端：输入行列向、面板留白收紧、推荐卡头允许换行 */
@media (max-width: 768px) {
  .input-row { flex-direction: column; }
  .panel { padding: 20px; }
  .pick-head { flex-wrap: wrap; }
  .pick-name { font-size: 15px; }
}
</style>
