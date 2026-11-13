<template>
  <div class="chat-wrap">
    <div class="chat-box" ref="boxRef">
      <template v-for="(m, i) in messages" :key="i">
        <div class="row" :class="m.role">
          <div class="bubble">
            <!-- 思考过程面板 -->
            <div v-if="m.thinking.length" class="thinking" :class="{ open: m.thinkingOpen }">
              <div class="thinking-head" @click="m.thinkingOpen = !m.thinkingOpen">
                <span>{{ m.thinkingOpen ? '▾' : '▸' }} 思考过程（{{ m.thinking.length }} 步）</span>
                <span v-if="m.loading && !m.answerStarted" class="dots">思考中…</span>
              </div>
              <div v-show="m.thinkingOpen" class="thinking-body">
                <div v-for="(t, ti) in m.thinking" :key="ti" class="thinking-item">
                  <b>{{ t.label }}</b>：{{ t.content }}
                </div>
              </div>
            </div>
            <!-- 正式回答：Markdown 流式渲染 -->
            <div v-if="m.role === 'ai'" class="md" v-html="renderMarkdown(m.content)"></div>
            <div v-else class="plain">{{ m.content }}</div>
            <!-- 失败态 + 重新提问 -->
            <div v-if="m.failed" class="failed">
              回复失败（{{ m.errorText }}）
              <el-button size="small" type="primary" link @click="retry(i)">重新提问</el-button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="input-bar">
      <el-input
        v-model="input"
        type="textarea"
        :rows="2"
        placeholder="输入问题，体验流式输出 / 中断 / 重新提问…"
        @keydown.enter.exact.prevent="send"
      />
      <div class="btns">
        <el-button v-if="replying" type="danger" plain @click="stop">停止回复</el-button>
        <el-button v-else type="primary" :disabled="!input.trim()" @click="send">发送</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { marked } from 'marked'
import { chatStream } from '../utils/aiApi'

const boxRef = ref(null)
const input = ref('')
const replying = ref(false)
const messages = ref([{
  role: 'ai',
  content: '你好！这是 **SSE 流式对话演示**。\n\n发送一个问题，可以体验：流式输出、思考过程面板、随时中断、失败重试。\n\n> 本页所有 AI 响应由本地 mock 服务按 LangChain messages 协议生成，用于展示前端流式链路。',
  thinking: [], thinkingOpen: false, loading: false, answerStarted: false, failed: false
}])

let controller = null
let retryIndex = -1

marked.setOptions({ breaks: true })

const renderMarkdown = (text) => {
  // 流式期间可能存在未闭合的语法，marked 容错渲染即可
  return text ? marked(text) : ''
}

const newAiMessage = () => ({
  role: 'ai', content: '', thinking: [], thinkingOpen: false,
  loading: true, answerStarted: false, failed: false, errorText: ''
})

const userMessage = (text) => ({ role: 'user', content: text, thinking: [], thinkingOpen: false, loading: false, answerStarted: false, failed: false })

const scrollToBottom = () => nextTick(() => {
  const el = boxRef.value
  if (el) el.scrollTop = el.scrollHeight
})

function runStream(text, targetIndex) {
  replying.value = true
  const m = messages.value[targetIndex]
  m.loading = true
  m.failed = false
  controller = chatStream(
    { message: text },
    (delta) => {
      // 1) 思考过程：追加并自动展开
      if (delta.thinking) {
        m.thinking.push(delta.thinking)
        m.thinkingOpen = true
        scrollToBottom()
        return
      }
      // 2) 完整替换（AgentOutput.answer 形态）
      if (delta.replace != null) {
        m.answerStarted = true
        m.content = delta.replace
        scrollToBottom()
        return
      }
      // 3) 增量文本
      if (delta.text) {
        m.answerStarted = true
        m.loading = false
        m.content += delta.text
        scrollToBottom()
      }
    },
    (result) => {
      m.loading = false
      replying.value = false
      if (!result.hasAnswer && !m.content) {
        m.failed = true
        m.errorText = '空回复'
      }
      controller = null
    },
    (error) => {
      m.loading = false
      replying.value = false
      if (error?.type === 'abort') {
        m.failed = true
        m.errorText = '已中断'
      } else {
        m.failed = true
        m.errorText = error?.message || '网络异常'
      }
      controller = null
    }
  )
}

const send = () => {
  const text = input.value.trim()
  if (!text || replying.value) return
  input.value = ''
  messages.value.push(userMessage(text))
  messages.value.push(newAiMessage())
  scrollToBottom()
  runStream(text, messages.value.length - 1)
}

/** 重新提问：删除失败气泡，同会话重发 */
const retry = (aiIndex) => {
  if (replying.value) return
  const userIndex = aiIndex - 1
  const text = messages.value[userIndex]?.content || ''
  if (!text) return
  retryIndex = aiIndex
  messages.value.splice(aiIndex, 1, newAiMessage())
  scrollToBottom()
  runStream(text, aiIndex)
}

const stop = () => {
  controller?.abort?.()
}
</script>

<style scoped>
.chat-wrap { background: #fff; border: 1px solid #e3e8f4; border-radius: 10px; padding: 14px; height: 640px; display: flex; flex-direction: column; }
.chat-box { flex: 1; overflow-y: auto; padding-right: 6px; }
.row { display: flex; margin: 10px 0; }
.row.user { justify-content: flex-end; }
.bubble { max-width: 86%; background: #f5f7fb; border-radius: 10px; padding: 10px 14px; font-size: 14px; line-height: 1.6; }
.row.user .bubble { background: #14315c; color: #fff; }
.plain { white-space: pre-wrap; }
.md :deep(h3) { margin: 6px 0; font-size: 15px; }
.md :deep(table) { border-collapse: collapse; margin: 6px 0; }
.md :deep(th), .md :deep(td) { border: 1px solid #d8dfec; padding: 4px 10px; font-size: 13px; }
.md :deep(code) { background: #eef1f7; padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }
.md :deep(pre) { background: #10162a; color: #dce6ff; padding: 10px 12px; border-radius: 8px; overflow-x: auto; }
.md :deep(pre code) { background: none; color: inherit; }
.thinking { border-left: 3px solid #b9c6e3; background: #f8f9fd; border-radius: 6px; padding: 6px 10px; margin-bottom: 8px; font-size: 12.5px; color: #5a6a8a; }
.thinking-head { cursor: pointer; user-select: none; display: flex; justify-content: space-between; }
.thinking-body { margin-top: 6px; }
.thinking-item { margin: 3px 0; }
.dots { animation: blink 1.2s infinite; }
@keyframes blink { 50% { opacity: 0.35; } }
.failed { margin-top: 6px; color: #d03050; font-size: 12.5px; }
.input-bar { border-top: 1px solid #eef1f7; padding-top: 10px; display: flex; gap: 10px; align-items: flex-end; }
.input-bar .el-textarea { flex: 1; }
</style>
