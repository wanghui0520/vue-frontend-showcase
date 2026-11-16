<template>
  <div class="chat-app">
    <!-- ═══════════ 左侧：会话 / 技能 / 知识库 ═══════════ -->
    <aside class="side">
      <button class="new-btn" @click="newSession">
        <el-icon :size="14"><Plus /></el-icon> 新建会话
      </button>

      <!-- 技能库 -->
      <div class="side-block">
        <div class="side-title">技能库</div>
        <div class="skill-list">
          <button v-for="s in SKILLS" :key="s.key" class="skill-item"
            :class="{ active: skill === s.key }" @click="selectSkill(s.key)">
            <span class="skill-icon">{{ s.icon }}</span>
            <span class="skill-name">{{ s.name }}</span>
            <el-icon v-if="skill === s.key" :size="12" class="check"><Check /></el-icon>
          </button>
        </div>
      </div>

      <!-- 知识库 / 连接器 -->
      <div class="side-block">
        <div class="side-title">知识库连接</div>
        <div class="kb-list">
          <button v-for="k in KNOWLEDGE" :key="k.key" class="kb-item"
            :class="{ active: knowledge === k.key }" @click="knowledge = k.key">
            <i class="kb-dot" :style="{ background: k.color }"></i>
            <span>{{ k.name }}</span>
          </button>
        </div>
      </div>

      <!-- 历史会话 -->
      <div class="side-block grow">
        <div class="side-title">历史会话<span class="count">{{ sessions.length }}</span></div>
        <div class="session-list">
          <div v-for="s in sessions" :key="s.id" class="session-item"
            :class="{ active: s.id === currentId }" @click="switchSession(s.id)">
            <el-icon :size="14" class="s-icon"><ChatDotRound /></el-icon>
            <div class="s-body">
              <div class="s-title">{{ s.title }}</div>
              <div class="s-time">{{ formatTime(s.updatedAt) }}</div>
            </div>
            <el-icon :size="13" class="s-del" title="删除会话" @click.stop="removeSession(s.id)"><Delete /></el-icon>
          </div>
        </div>
      </div>
    </aside>

    <!-- ═══════════ 右侧：标题栏 / 消息流 / 输入区 ═══════════ -->
    <section class="main">
      <!-- 标题栏 -->
      <header class="head">
        <div class="head-left">
          <div class="head-title">{{ currentSession?.title || '新的对话' }}</div>
          <div class="head-meta">
            <span class="tag"><el-icon :size="11"><Cpu /></el-icon>{{ currentModelName }}</span>
            <span class="tag">{{ currentSkillName }}</span>
            <span class="tag kb"><i class="kb-dot" :style="{ background: currentKbColor }"></i>{{ currentKbName }}</span>
            <span class="msg-count">{{ currentSession?.messages.length || 0 }} 条消息</span>
          </div>
        </div>
        <span v-if="replying" class="streaming-badge"><i></i>流式回复中</span>
      </header>

      <!-- 消息流 -->
      <div class="chat-box" ref="boxRef">
        <!-- 空状态 -->
        <div v-if="!currentSession?.messages.length" class="empty">
          <div class="empty-logo">AI</div>
          <div class="empty-title">开始一段新对话</div>
          <div class="empty-desc">支持流式输出、思考过程可视化、随时中断与失败重试</div>
          <div class="suggest">
            <button v-for="q in SUGGESTIONS" :key="q" class="suggest-item" @click="input = q">{{ q }}</button>
          </div>
        </div>

        <template v-for="(m, i) in currentSession?.messages || []" :key="i">
          <div class="row" :class="m.role">
            <div class="avatar" :class="m.role">{{ m.role === 'ai' ? 'AI' : usernameInitial }}</div>
            <div class="bubble">
              <!-- 思考过程面板 -->
              <div v-if="m.thinking.length" class="thinking" :class="{ open: m.thinkingOpen }">
                <div class="thinking-head" @click="m.thinkingOpen = !m.thinkingOpen">
                  <span class="t-arrow">{{ m.thinkingOpen ? '▾' : '▸' }}</span>
                  <span>思考过程（{{ m.thinking.length }} 步）</span>
                  <span v-if="m.loading && !m.answerStarted" class="dots">思考中<span>.</span><span>.</span><span>.</span></span>
                </div>
                <div v-show="m.thinkingOpen" class="thinking-body">
                  <div v-for="(t, ti) in m.thinking" :key="ti" class="thinking-item">
                    <span class="t-label">{{ t.label }}</span>
                    <span>{{ t.content }}</span>
                  </div>
                </div>
              </div>
              <!-- 正文 -->
              <div v-if="m.role === 'ai'" class="md" v-html="renderMarkdown(m.content)"></div>
              <div v-else class="plain">{{ m.content }}</div>
              <span v-if="m.loading && m.answerStarted" class="cursor">▍</span>
              <!-- 失败态 + 重新提问 -->
              <div v-if="m.failed" class="failed">
                <el-icon :size="12"><WarningFilled /></el-icon>
                回复失败（{{ m.errorText }}）
                <el-button size="small" type="primary" link @click="retry(i)">重新提问</el-button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 输入区 -->
      <footer class="input-area">
        <div class="input-bar">
          <el-input
            v-model="input"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 6 }"
            placeholder="输入问题，Enter 发送 / Shift+Enter 换行…"
            @keydown.enter.exact.prevent="send"
          />
        </div>
        <div class="input-tools">
          <div class="tools-left">
            <el-select v-model="model" size="small" class="model-select">
              <el-option v-for="m in MODELS" :key="m.key" :value="m.key" :label="m.name" />
            </el-select>
            <span class="skill-chip"><el-icon :size="12"><MagicStick /></el-icon>{{ currentSkillName }}</span>
            <span class="skill-chip kb"><i class="kb-dot" :style="{ background: currentKbColor }"></i>{{ currentKbName }}</span>
          </div>
          <div class="btns">
            <el-button v-if="replying" size="small" type="danger" plain round @click="stop">
              <el-icon :size="12" style="margin-right:4px"><VideoPlay /></el-icon>停止回复
            </el-button>
            <el-button v-else size="small" type="primary" round :disabled="!input.trim()" @click="send">发送</el-button>
          </div>
        </div>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { marked } from 'marked'
import { chatStream } from '../utils/aiApi'
import {
  Plus, Check, ChatDotRound, Delete, Cpu, MagicStick, VideoPlay, WarningFilled
} from '@element-plus/icons-vue'
import { getUsername } from '../auth'

/* ═══════════════ 配置 ═══════════════ */

const MODELS = [
  { key: 'standard', name: '智研-Standard（标准）' },
  { key: 'reasoner', name: '智研-Reasoner（深度推理）' },
  { key: 'longctx', name: '智研-LongContext（长上下文）' }
]

const SKILLS = [
  { key: 'general', name: '通用问答', icon: '💬' },
  { key: 'case', name: '案情研判', icon: '🔎' },
  { key: 'law', name: '法规检索', icon: '📖' },
  { key: 'fund', name: '资金分析', icon: '💰' },
  { key: 'doc', name: '文书生成', icon: '📝' }
]

const KNOWLEDGE = [
  { key: 'all', name: '全部知识库', color: '#2f5bff' },
  { key: 'law', name: '经侦法规库', color: '#10b981' },
  { key: 'case', name: '典型案例库', color: '#f59e0b' },
  { key: 'company', name: '企业工商库', color: '#7c3aed' }
]

const SUGGESTIONS = [
  '分析 A 贸易公司与 B 科技的资金往来风险',
  '梳理本案涉及的主要法律条款',
  '生成一份资金流向研判提纲'
]

const STORAGE_KEY = 'showcase_chat_sessions_v1'

/* ═══════════════ 状态 ═══════════════ */

const boxRef = ref(null)
const input = ref('')
const replying = ref(false)
const model = ref('standard')
const skill = ref('general')
const knowledge = ref('all')

const sessions = ref([])
const currentId = ref('')

const usernameInitial = (getUsername() || '用')[0]

const currentSession = computed(() => sessions.value.find((s) => s.id === currentId.value))
const currentModelName = computed(() => MODELS.find((m) => m.key === model.value)?.name.split('（')[0])
const currentSkillName = computed(() => SKILLS.find((s) => s.key === skill.value)?.name)
const currentKbName = computed(() => KNOWLEDGE.find((k) => k.key === knowledge.value)?.name)
const currentKbColor = computed(() => KNOWLEDGE.find((k) => k.key === knowledge.value)?.color)

let controller = null

marked.setOptions({ breaks: true })

const renderMarkdown = (text) => (text ? marked(text) : '')

const msg = (role, content, extra = {}) => ({
  role, content,
  thinking: [], thinkingOpen: false,
  loading: false, answerStarted: false, failed: false, errorText: '',
  ...extra
})

/* ═══════════════ 会话管理 ═══════════════ */

function seedSessions() {
  return [
    {
      id: 's1', title: 'A 公司资金往来风险分析', updatedAt: Date.now() - 3600e3,
      messages: [
        msg('user', '分析 A 贸易公司与 B 科技有限公司近半年的资金往来是否存在异常。'),
        msg('ai',
'### 资金往来风险分析\n\n**交易概况**：近半年 A → B 共 **12 笔**大额转账，累计约 **480 万**，集中在月末 3 天内完成。\n\n**风险点**：\n\n1. 与 C 实业存在互保关系，资金链路呈环形结构\n2. 多笔交易摘要为"咨询费"，缺乏对应合同\n3. 收款账户 ***6688 与 ***1024 为同名账户\n\n> 结论：建议结合银行流水穿透至二级账户进一步核查。',
          { thinkingOpen: true })
      ]
    },
    {
      id: 's2', title: '虚构贸易背景识别', updatedAt: Date.now() - 86400e3,
      messages: [
        msg('user', '帮我总结识别虚构贸易背景的常见特征。'),
        msg('ai', '虚构贸易背景的常见特征包括：\n\n1. **闭环交易**：上下游企业互为购销方，资金空转\n2. **票据与物流不匹配**：有发票无出入库记录\n3. **毛利率异常**：显著偏离行业水平\n4. **注册地集中**：多家企业同一地址、同一法人')
      ]
    }
  ]
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : null
    if (Array.isArray(data) && data.length) { sessions.value = data; return }
  } catch { /* 忽略脏数据 */ }
  sessions.value = seedSessions()
  currentId.value = sessions.value[0].id
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.value))
  } catch { /* 存储满时静默降级 */ }
}

function newSession() {
  if (replying.value) controller?.abort?.()
  const s = { id: `s_${Date.now()}`, title: '新的对话', updatedAt: Date.now(), messages: [] }
  sessions.value.unshift(s)
  currentId.value = s.id
  persist()
}

function switchSession(id) {
  if (id === currentId.value) return
  if (replying.value) controller?.abort?.()   // 切换会话先中断在途流，避免串场
  currentId.value = id
  scrollToBottom()
}

function removeSession(id) {
  const idx = sessions.value.findIndex((s) => s.id === id)
  if (idx === -1) return
  sessions.value.splice(idx, 1)
  if (currentId.value === id) {
    if (replying.value) controller?.abort?.()
    if (!sessions.value.length) {
      const s = { id: `s_${Date.now()}`, title: '新的对话', updatedAt: Date.now(), messages: [] }
      sessions.value = [s]
    }
    currentId.value = sessions.value[0].id
  }
  persist()
}

function selectSkill(key) {
  skill.value = key
  if (key !== 'general' && !currentSession.value?.messages.length) {
    input.value = SKILLS.find((s) => s.key === key)?.hint || input.value
  }
}

const formatTime = (ts) => {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/* ═══════════════ 流式对话 ═══════════════ */

const scrollToBottom = () => nextTick(() => {
  const el = boxRef.value
  if (el) el.scrollTop = el.scrollHeight
})

const newAiMessage = () => msg('ai', '', { loading: true })

function runStream(text, targetIndex) {
  replying.value = true
  const list = currentSession.value.messages
  const m = list[targetIndex]
  m.loading = true
  m.failed = false

  // 模型 / 技能 / 知识库随请求下发（真实场景由后端路由到不同模型与 RAG 配置）
  controller = chatStream(
    { message: text, model: model.value, skill: skill.value, knowledge: knowledge.value },
    (delta) => {
      if (delta.thinking) {
        m.thinking.push(delta.thinking)
        m.thinkingOpen = true
        scrollToBottom()
        return
      }
      if (delta.replace != null) {
        m.answerStarted = true
        m.content = delta.replace
        scrollToBottom()
        return
      }
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
      touchSession()
      controller = null
    },
    (error) => {
      m.loading = false
      replying.value = false
      m.failed = true
      m.errorText = error?.type === 'abort' ? '已中断' : (error?.message || '网络异常')
      touchSession()
      controller = null
    }
  )
}

const send = () => {
  const text = input.value.trim()
  if (!text || replying.value) return
  const s = currentSession.value
  if (!s) return

  input.value = ''
  // 三态机：新会话首次发送才固定标题（历史会话 / 重试复用原 thread）
  if (!s.messages.length && s.title === '新的对话') {
    s.title = text.length > 18 ? text.slice(0, 18) + '…' : text
  }
  s.messages.push(msg('user', text))
  s.messages.push(newAiMessage())
  s.updatedAt = Date.now()
  persist()
  scrollToBottom()
  runStream(text, s.messages.length - 1)
}

const retry = (aiIndex) => {
  if (replying.value) return
  const list = currentSession.value.messages
  const text = list[aiIndex - 1]?.content || ''
  if (!text) return
  list.splice(aiIndex, 1, newAiMessage())
  scrollToBottom()
  runStream(text, aiIndex)
}

const stop = () => controller?.abort?.()

const touchSession = () => {
  const s = currentSession.value
  if (s) { s.updatedAt = Date.now(); persist() }
}

onMounted(() => {
  loadSessions()
  scrollToBottom()
})
</script>

<style scoped>
/* ═══════════ 整体布局 ═══════════ */
.chat-app {
  display: flex;
  height: calc(100vh - 60px); /* 精确填满：顶栏 14+14 padding + 32 内容 */
  min-height: 560px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0;
  overflow: hidden;
}

/* ═══════════ 左侧边栏 ═══════════ */
.side {
  display: flex;
  flex-direction: column;
  width: 232px;
  flex-shrink: 0;
  padding: 12px;
  border-right: 1px solid var(--border);
  background: var(--surface-2);
}
.new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 0;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: var(--brand-gradient);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.new-btn:hover { opacity: 0.88; }

.side-block { margin-bottom: 12px; }
.side-block.grow { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.side-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.5px;
}
.count {
  padding: 0 6px;
  font-size: 10px;
  background: var(--brand-weak);
  color: var(--brand);
  border-radius: 8px;
}

/* 技能 */
.skill-list { display: flex; flex-direction: column; gap: 3px; }
.skill-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 9px;
  font-size: 12.5px;
  color: var(--text-1);
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s;
}
.skill-item:hover { background: var(--brand-weak); }
.skill-item.active {
  background: var(--brand-weak);
  border-color: var(--brand);
  color: var(--brand);
  font-weight: 600;
}
.skill-icon { font-size: 13px; }
.check { margin-left: auto; }

/* 知识库 */
.kb-list { display: flex; flex-direction: column; gap: 3px; }
.kb-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 9px;
  font-size: 12.5px;
  color: var(--text-2);
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s;
}
.kb-item:hover { background: var(--brand-weak); color: var(--text-1); }
.kb-item.active { color: var(--text-1); font-weight: 600; background: var(--brand-weak); }
.kb-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }

/* 历史会话 */
.session-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 9px;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s;
}
.session-item:hover { background: var(--brand-weak); }
.session-item.active { background: var(--brand-weak); }
.s-icon { color: var(--text-3); flex-shrink: 0; }
.session-item.active .s-icon { color: var(--brand); }
.s-body { flex: 1; min-width: 0; }
.s-title {
  font-size: 12.5px;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.session-item.active .s-title { color: var(--brand); font-weight: 600; }
.s-time { font-size: 10.5px; color: var(--text-3); margin-top: 2px; }
.s-del { opacity: 0; color: var(--text-3); transition: opacity 0.15s; }
.session-item:hover .s-del { opacity: 1; }
.s-del:hover { color: var(--danger); }

/* ═══════════ 右侧主区 ═══════════ */
.main { display: flex; flex-direction: column; flex: 1; min-width: 0; }

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.head-title { font-size: 15px; font-weight: 700; color: var(--text-1); }
.head-meta { display: flex; align-items: center; gap: 8px; margin-top: 5px; flex-wrap: wrap; }
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--text-2);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.tag.kb { gap: 5px; }
.msg-count { font-size: 11px; color: var(--text-3); }

.streaming-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  font-size: 11px;
  color: var(--brand);
  background: var(--brand-weak);
  border-radius: 10px;
}
.streaming-badge i {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--brand);
  animation: pulse 1s infinite;
}
@keyframes pulse { 50% { opacity: 0.3; } }

/* ═══════════ 消息流 ═══════════ */
.chat-box { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 18px; }

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 10px;
}
.empty-logo {
  display: flex; align-items: center; justify-content: center;
  width: 54px; height: 54px;
  font-weight: 800;
  font-size: 18px;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: 16px;
}
.empty-title { font-size: 16px; font-weight: 700; color: var(--text-1); }
.empty-desc { font-size: 12.5px; color: var(--text-3); }
.suggest { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; width: 100%; max-width: 420px; }
.suggest-item {
  padding: 10px 14px;
  font-size: 12.5px;
  color: var(--text-2);
  text-align: left;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.15s;
}
.suggest-item:hover { border-color: var(--brand); color: var(--brand); }

.row { display: flex; gap: 10px; margin: 14px 0; }
.row.user { flex-direction: row-reverse; }
.avatar {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  border-radius: 9px;
}
.avatar.ai { color: #fff; background: var(--brand-gradient); }
.avatar.user {
  color: var(--brand);
  background: var(--brand-weak);
  border: 1px solid var(--brand);
}

.bubble {
  max-width: 84%;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.65;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.row.user .bubble {
  color: #fff;
  background: var(--brand);
  border-color: var(--brand);
}
.plain { white-space: pre-wrap; }

.cursor { color: var(--brand); animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0; } }

.md :deep(h3) { margin: 6px 0; font-size: 15px; }
.md :deep(table) { border-collapse: collapse; margin: 6px 0; }
.md :deep(th), .md :deep(td) { border: 1px solid var(--border); padding: 4px 10px; font-size: 13px; }
.md :deep(code) { background: var(--brand-weak); padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }
.md :deep(pre) { background: var(--bg-sidebar); color: #dce6ff; padding: 10px 12px; border-radius: 8px; overflow-x: auto; }
.md :deep(pre code) { background: none; color: inherit; }
.md :deep(blockquote) { margin: 6px 0; padding: 4px 12px; border-left: 3px solid var(--brand); color: var(--text-2); background: var(--brand-weak); border-radius: 0 6px 6px 0; }

/* 思考面板 */
.thinking {
  margin-bottom: 8px;
  padding: 7px 10px;
  font-size: 12.5px;
  color: var(--text-2);
  background: var(--brand-weak);
  border-left: 3px solid var(--brand);
  border-radius: 6px;
}
.thinking-head { display: flex; align-items: center; gap: 5px; cursor: pointer; user-select: none; }
.t-arrow { font-size: 10px; }
.thinking-body { margin-top: 6px; display: flex; flex-direction: column; gap: 3px; }
.thinking-item { display: flex; gap: 6px; }
.t-label { color: var(--brand); font-weight: 600; flex-shrink: 0; }
.dots span { animation: dot-b 1.4s infinite; }
.dots span:nth-child(2) { animation-delay: 0.2s; }
.dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot-b { 0%, 60%, 100% { opacity: 0.2; } 30% { opacity: 1; } }

.failed {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--danger);
}

/* ═══════════ 输入区 ═══════════ */
.input-area { padding: 10px 14px 12px; border-top: 1px solid var(--border); }
.input-bar :deep(.el-textarea__inner) {
  background: var(--surface-2);
  border-radius: 9px;
}
.input-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
}
.tools-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.model-select { width: 210px; }
.skill-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 11.5px;
  color: var(--text-2);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.skill-chip.kb { gap: 6px; }
</style>
