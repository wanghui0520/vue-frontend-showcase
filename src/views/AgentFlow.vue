<template>
  <div class="page">
    <p class="page-desc">
      输入一个任务，Agent 的执行链路（<b>思考 → 调用工具 → 失败重试 → 产出结果</b>）以时间线
      <b>实时可视化</b>——节点状态流转、入参摘要与耗时一览无余，对应生产环境排查 Agent 决策链路的场景。
    </p>

    <!-- 输入卡 -->
    <div class="card">
      <div class="input-row">
        <el-input
          v-model="task" size="large"
          placeholder="例如：分析合同履行风险并生成摘要"
          @keyup.enter="run"
        />
        <el-button type="primary" size="large" :loading="running" @click="run">
          {{ running ? '执行中…' : '执行' }}
        </el-button>
        <el-button v-if="running" size="large" type="danger" plain @click="abort">停止</el-button>
      </div>
      <div class="quick">
        <span class="quick-label">快捷任务：</span>
        <el-tag
          v-for="q in quickTasks" :key="q" class="quick-tag"
          :type="task === q ? 'primary' : 'info'" effect="plain"
          @click="task = q"
        >{{ q }}</el-tag>
      </div>
    </div>

    <div v-if="steps.length" class="layout">
      <!-- 左：时间线 -->
      <div class="card">
        <div class="panel-head">
          <h3 class="card-title">执行链路</h3>
          <span v-if="running" class="live-badge"><i class="live-dot"></i>Agent 运行中</span>
          <span v-else-if="finished" class="done-badge">✓ 已完成 {{ totalMs }}ms</span>
        </div>

        <!-- 进度条 -->
        <el-progress
          :percentage="progressPct"
          :show-text="false"
          :stroke-width="5"
          :color="running ? 'var(--brand)' : 'var(--ok)'"
          class="progress"
        />

        <!-- 汇总统计 -->
        <div class="stat-row">
          <div class="stat"><span class="stat-num">{{ steps.length }}</span><span class="stat-label">节点</span></div>
          <div class="stat"><span class="stat-num">{{ toolCount }}</span><span class="stat-label">工具调用</span></div>
          <div class="stat" :class="{ 'stat-warn': retryCount }"><span class="stat-num">{{ retryCount }}</span><span class="stat-label">重试</span></div>
          <div class="stat"><span class="stat-num">{{ totalMs || '—' }}</span><span class="stat-label">总耗时 ms</span></div>
        </div>

        <div class="timeline">
          <div
            v-for="(s, i) in steps" :key="s.id"
            class="node" :class="'is-' + s.status"
          >
            <div class="node-rail">
              <div class="node-dot">
                <span v-if="s.status === 'done'" class="dot-check">✓</span>
                <span v-else-if="s.status === 'fail'" class="dot-cross">✕</span>
                <span v-else-if="s.status === 'running'" class="dot-spin"></span>
              </div>
              <div v-if="i < steps.length - 1" class="node-line"></div>
            </div>
            <div class="node-body">
              <div class="node-head">
                <span class="node-type" :data-type="s.type"><span class="type-icon">{{ typeIcon(s.type) }}</span>{{ typeLabel(s.type) }}</span>
                <span class="node-label">{{ s.label }}</span>
                <span v-if="s.ms" class="node-ms">{{ s.ms }}ms</span>
              </div>
              <div v-if="s.detail" class="node-detail">{{ s.detail }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右：日志 + 产出 -->
      <div class="col">
        <div class="card">
          <div class="panel-head">
            <h3 class="card-title">执行日志</h3>
            <el-button size="small" link :disabled="!logs.length" @click="exportLog">导出日志</el-button>
          </div>
          <div class="logs" ref="logsRef">
            <div v-for="(l, i) in logs" :key="i" class="log-line"><span class="log-ts">{{ logTs(i) }}</span>{{ l }}</div>
            <div v-if="!logs.length" class="empty-sm">执行后此处输出实时日志</div>
          </div>
        </div>

        <div v-if="result" class="card">
          <div class="panel-head">
            <h3 class="card-title">最终产出</h3>
            <el-tag size="small" type="success" effect="plain">AgentOutput</el-tag>
          </div>
          <div class="result-box md" v-html="resultHtml"></div>
          <div class="result-actions">
            <el-button size="small" @click="copyResult">复制</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="card empty-card">
      <div class="empty-art">
        <div class="empty-node">🧠</div>
        <div class="empty-link"></div>
        <div class="empty-node">🔧</div>
        <div class="empty-link"></div>
        <div class="empty-node">🔁</div>
        <div class="empty-link"></div>
        <div class="empty-node">📄</div>
      </div>
      <p class="empty-title">输入任务并执行</p>
      <p class="empty-sub">Agent 的思考、工具调用与重试过程将实时展示在时间线上</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'
import { createStreamClient } from '../utils/requestStream'

const { streamRequest } = createStreamClient({ timeout: 120000 })

const task = ref('分析合同履行风险并生成摘要')
const quickTasks = [
  '分析合同履行风险并生成摘要',
  '比对两份流水中的异常交易',
  '梳理案件时间线并标注关键节点'
]

const steps = ref([])   // [{ id, type, label, detail, ms, status }]
const logs = ref([])
const result = ref('')
const running = ref(false)
const finished = ref(false)
const logsRef = ref(null)
const startedAt = ref(0)

let controller = null

const TYPE_LABEL = { think: '思考', tool: '工具调用', retry: '重试', output: '产出' }
const TYPE_ICON = { think: '🧠', tool: '🔧', retry: '🔁', output: '📄' }
function typeLabel(t) { return TYPE_LABEL[t] || t }
function typeIcon(t) { return TYPE_ICON[t] || '⚙️' }

const toolCount = computed(() => steps.value.filter((s) => s.type === 'tool').length)
const retryCount = computed(() => steps.value.filter((s) => s.type === 'retry' || s.status === 'fail').length)
const totalMs = computed(() => steps.value.reduce((s, x) => s + (x.ms || 0), 0))
const progressPct = computed(() => {
  if (!steps.value.length) return 0
  const done = steps.value.filter((s) => s.status !== 'running').length
  return Math.round((done / steps.value.length) * 100)
})

const resultHtml = computed(() => marked.parse(result.value || ''))

function logTs(i) {
  // 日志按出现顺序编号，模拟执行日志时间戳
  return String(i + 1).padStart(2, '0')
}

function run() {
  if (!task.value.trim()) { ElMessage.warning('请输入任务'); return }
  steps.value = []
  logs.value = []
  result.value = ''
  finished.value = false
  running.value = true
  startedAt.value = performance.now()

  controller = streamRequest(
    '/api/agent/stream',
    { message: task.value },
    ({ event, data }) => {
      if (event === 'node') {
        // upsert：同一节点先以 running 状态出现，随后更新为终态
        const found = steps.value.find((s) => s.id === data.id)
        if (found) Object.assign(found, data)
        else steps.value.push(data)
      } else if (event === 'log') {
        logs.value.push(data.message)
        nextTick(() => logsRef.value?.scrollTo?.({ top: logsRef.value.scrollHeight }))
      } else if (event === 'result') {
        result.value = data.text
      }
    },
    () => {
      running.value = false
      finished.value = true
      ElMessage.success(`Agent 执行完成（${((performance.now() - startedAt.value) / 1000).toFixed(1)}s）`)
    },
    (err) => {
      running.value = false
      if (err.type !== 'abort') ElMessage.error('执行失败：' + err.message)
    }
  )
}

function abort() {
  controller?.abort?.()
  running.value = false
  finished.value = steps.value.some((s) => s.status === 'done')
  ElMessage.info('已停止')
}

function exportLog() {
  const content = logs.value.map((l, i) => `[${logTs(i)}] ${l}`).join('\n')
  const blob = new Blob(['\ufeff' + content], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'agent-execution.log'
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success('已导出执行日志')
}

function copyResult() {
  navigator.clipboard?.writeText(result.value)
  ElMessage.success('已复制到剪贴板')
}
</script>

<style scoped>
.input-row { display: flex; gap: 10px; }
.quick { margin-top: 12px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.quick-label { font-size: 12px; color: var(--text-3); }
.quick-tag { cursor: pointer; user-select: none; }

.layout { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; margin-top: 14px; align-items: start; }
@media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
.col { display: flex; flex-direction: column; gap: 14px; }

.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

/* ---------- 状态徽标 ---------- */
.live-badge, .done-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; padding: 2px 9px; border-radius: 10px;
}
.live-badge { background: var(--brand-weak); color: var(--brand); }
.done-badge { background: rgba(16, 185, 129, 0.1); color: var(--ok); }
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--brand); animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0.25; } }

.progress { margin: 10px 0; }

/* ---------- 汇总统计 ---------- */
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.stat { background: var(--surface-2); border-radius: 8px; padding: 7px 10px; display: flex; flex-direction: column; gap: 1px; }
.stat-num { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
.stat-label { font-size: 11px; color: var(--text-3); }
.stat-warn .stat-num { color: var(--warn); }

/* ---------- 时间线 ---------- */
.timeline { padding-left: 4px; }
.node { display: flex; gap: 12px; position: relative; }

.node-rail { display: flex; flex-direction: column; align-items: center; width: 20px; flex-shrink: 0; }
.node-dot {
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--surface-2); border: 2px solid var(--border);
  flex-shrink: 0; margin-top: 2px;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; color: #fff;
  transition: border-color 0.2s, background 0.2s;
}
.is-done .node-dot { border-color: var(--ok); background: var(--ok); }
.is-fail .node-dot { border-color: var(--danger); background: var(--danger); }
.is-running .node-dot { border-color: var(--brand); background: var(--surface); }
.dot-spin {
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--brand-weak); border-top-color: var(--brand);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.node-line { width: 2px; flex: 1; background: var(--border); margin: 2px 0; }
.is-done .node-line { background: var(--ok); opacity: 0.4; }

.node-body { flex: 1; padding-bottom: 16px; min-width: 0; }
.node-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.node-type {
  font-size: 11px; padding: 1px 8px; border-radius: 10px;
  background: var(--surface-2); color: var(--text-2);
  display: inline-flex; align-items: center; gap: 4px;
}
.node-type[data-type='think'] { background: var(--brand-weak); color: var(--brand); }
.node-type[data-type='retry'] { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
.node-type[data-type='output'] { background: rgba(16, 185, 129, 0.1); color: var(--ok); }
.type-icon { font-size: 11px; }

.node-label { font-size: 13px; font-weight: 600; }
.node-ms { font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; margin-left: auto; }

.node-detail {
  margin-top: 4px;
  font-size: 12px; color: var(--text-2);
  background: var(--surface-2);
  border-radius: 6px;
  padding: 6px 10px;
  line-height: 1.6;
  word-break: break-all;
}
.is-running .node-detail { border-left: 2px solid var(--brand); }

/* ---------- 日志 ---------- */
.logs {
  background: var(--surface-2);
  border-radius: 8px;
  padding: 10px 12px;
  max-height: 220px; overflow-y: auto;
  font-family: Consolas, monospace;
  font-size: 12px;
}
.log-line { color: var(--text-2); line-height: 1.9; white-space: pre-wrap; display: flex; gap: 8px; }
.log-ts { color: var(--text-3); flex-shrink: 0; user-select: none; }
.empty-sm { color: var(--text-3); font-size: 12px; text-align: center; padding: 20px 0; }

/* ---------- 产出 ---------- */
.result-box {
  background: var(--brand-weak);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.8;
}
.result-box.md :deep(h1), .result-box.md :deep(h2), .result-box.md :deep(h3) { margin: 10px 0 6px; font-size: 14px; }
.result-box.md :deep(p) { margin: 6px 0; }
.result-box.md :deep(ul) { padding-left: 20px; margin: 6px 0; }
.result-box.md :deep(li) { margin: 3px 0; }
.result-box.md :deep(strong) { color: var(--brand); }
.result-actions { margin-top: 8px; display: flex; justify-content: flex-end; }

/* ---------- 空状态 ---------- */
.empty-card { margin-top: 14px; text-align: center; padding: 46px 0 40px; }
.empty-art { display: flex; align-items: center; justify-content: center; gap: 10px; }
.empty-node {
  width: 52px; height: 52px; border-radius: 14px;
  background: var(--surface-2); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
}
.empty-link { width: 26px; height: 2px; background: var(--border); border-radius: 1px; }
.empty-title { margin: 16px 0 0; font-size: 14px; font-weight: 600; color: var(--text-2); }
.empty-sub { margin: 4px 0 0; font-size: 12px; color: var(--text-3); }
</style>
