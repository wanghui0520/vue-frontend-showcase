<template>
  <div class="page">
    <p class="page-desc">
      输入一个任务，Agent 的执行链路（<b>思考 → 调用工具 → 失败重试 → 产出结果</b>）以时间线<b>实时可视化</b>——
      每个节点的状态流转、入参摘要与耗时一览无余，对应生产环境排查 Agent 决策链路的场景。
    </p>

    <div class="card">
      <div class="input-row">
        <el-input
          v-model="task"
          size="large"
          placeholder="例如：分析合同履行风险并生成摘要"
          @keyup.enter="run"
        />
        <el-button type="primary" size="large" :loading="running" @click="run">
          {{ running ? '执行中…' : '执行' }}
        </el-button>
        <el-button v-if="running" size="large" @click="abort">停止</el-button>
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
      <!-- 时间线 -->
      <div class="card">
        <h3 class="card-title">执行链路</h3>
        <div class="timeline">
          <div
            v-for="(s, i) in steps"
            :key="s.id"
            class="node"
            :class="'is-' + s.status"
          >
            <div class="node-rail">
              <div class="node-dot"></div>
              <div v-if="i < steps.length - 1" class="node-line"></div>
            </div>
            <div class="node-body">
              <div class="node-head">
                <span class="node-type" :data-type="s.type">{{ typeLabel(s.type) }}</span>
                <span class="node-label">{{ s.label }}</span>
                <span v-if="s.ms" class="node-ms">{{ s.ms }}ms</span>
                <span v-if="s.status === 'running'" class="node-status running">运行中</span>
                <span v-else-if="s.status === 'done'" class="node-status ok">✓</span>
                <span v-else-if="s.status === 'fail'" class="node-status fail">✗ 重试</span>
              </div>
              <div v-if="s.detail" class="node-detail">{{ s.detail }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 日志 + 产出 -->
      <div class="card">
        <h3 class="card-title">执行日志</h3>
        <div class="logs">
          <div v-for="(l, i) in logs" :key="i" class="log-line">{{ l }}</div>
          <div v-if="!logs.length" class="empty">执行后此处输出实时日志</div>
        </div>

        <template v-if="result">
          <h3 class="card-title" style="margin-top: 16px;">最终产出</h3>
          <div class="result-box">{{ result }}</div>
        </template>
      </div>
    </div>

    <div v-else class="empty">输入任务并执行，Agent 的思考与工具调用将实时展示</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
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

let controller = null

const TYPE_LABEL = { think: '思考', tool: '工具调用', retry: '重试', output: '产出' }
function typeLabel(t) { return TYPE_LABEL[t] || t }

function run() {
  if (!task.value.trim()) { ElMessage.warning('请输入任务'); return }
  steps.value = []
  logs.value = []
  result.value = ''
  running.value = true

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
      } else if (event === 'result') {
        result.value = data.text
      }
    },
    () => {
      running.value = false
      ElMessage.success('Agent 执行完成')
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
  ElMessage.info('已停止')
}
</script>

<style scoped>
.input-row { display: flex; gap: 10px; }
.quick { margin-top: 12px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.quick-label { font-size: 12px; color: var(--text-3); }
.quick-tag { cursor: pointer; }

.layout { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; margin-top: 14px; align-items: start; }
@media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }

/* ---------- 时间线 ---------- */
.timeline { padding-left: 4px; }

.node { display: flex; gap: 12px; position: relative; }

.node-rail { display: flex; flex-direction: column; align-items: center; width: 18px; flex-shrink: 0; }
.node-dot {
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--border);
  flex-shrink: 0;
  margin-top: 4px;
}
.node-line { width: 2px; flex: 1; background: var(--border); margin: 2px 0; }

.is-running .node-dot { background: var(--brand); animation: pulse 1.2s infinite; }
.is-done .node-dot { background: var(--ok); }
.is-fail .node-dot { background: var(--danger); }
.is-done .node-line { background: var(--ok); opacity: 0.4; }

@keyframes pulse { 50% { box-shadow: 0 0 0 6px var(--brand-weak); } }

.node-body { flex: 1; padding-bottom: 16px; min-width: 0; }
.node-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.node-type {
  font-size: 11px; padding: 1px 7px; border-radius: 10px;
  background: var(--surface-2); color: var(--text-2);
}
.node-type[data-type='think'] { background: var(--brand-weak); color: var(--brand); }
.node-type[data-type='retry'] { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
.node-type[data-type='output'] { background: rgba(16, 185, 129, 0.1); color: var(--ok); }

.node-label { font-size: 13px; font-weight: 600; }
.node-ms { font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; }

.node-status { font-size: 11px; margin-left: auto; }
.node-status.ok { color: var(--ok); }
.node-status.fail { color: var(--danger); }
.node-status.running { color: var(--brand); }

.node-detail {
  margin-top: 4px;
  font-size: 12px; color: var(--text-2);
  background: var(--surface-2);
  border-radius: 6px;
  padding: 6px 10px;
  line-height: 1.6;
  word-break: break-all;
}

/* ---------- 日志 ---------- */
.logs {
  background: var(--surface-2);
  border-radius: 8px;
  padding: 10px 12px;
  max-height: 240px; overflow-y: auto;
  font-family: Consolas, monospace;
  font-size: 12px;
}
.log-line { color: var(--text-2); line-height: 1.9; white-space: pre-wrap; }

.result-box {
  background: var(--brand-weak);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.8;
  white-space: pre-wrap;
}
</style>
