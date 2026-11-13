<template>
  <div class="page">
    <p class="page-desc">
      粘贴一段非结构化文本（合同 / 流水 / 工单…），AI 按配置的 Schema <b>流式抽取</b>结构化字段；
      对低置信度字段<b>人工兜底编辑</b>后导出——演示"AI 输出不可控 → 人工审核兜底"的完整业务闭环。
    </p>

    <div class="layout">
      <!-- 左：输入 -->
      <div class="card">
        <h3 class="card-title">① 原始文本</h3>
        <el-input
          v-model="rawText"
          type="textarea"
          :rows="10"
          placeholder="粘贴合同、流水、工单等文本…"
        />
        <div class="actions">
          <el-button type="primary" :loading="running" @click="run">
            {{ running ? 'AI 抽取中…' : '开始抽取' }}
          </el-button>
          <el-button :disabled="running" @click="reset">清空结果</el-button>
          <span v-if="elapsed" class="elapsed">耗时 {{ elapsed }}s · 抽取 {{ rows.length }} 字段</span>
        </div>

        <el-alert type="info" :closable="false" class="hint">
          <p>抽取字段由后端按 Schema 返回，前端逐帧渲染。<b>置信度 &lt; 0.85 的字段</b>会标记为「待确认」，引导人工复核——这是 AI 落地最常见的兜底交互。</p>
        </el-alert>
      </div>

      <!-- 右：结果表格 -->
      <div class="card">
        <div class="result-head">
          <h3 class="card-title">② 结构化结果（可编辑）</h3>
          <el-button size="small" :disabled="!rows.length" @click="exportCsv">导出 CSV</el-button>
        </div>

        <el-table v-if="rows.length" :data="rows" size="default" :header-cell-style="headerStyle" max-height="420">
          <el-table-column label="字段" width="110">
            <template #default="{ row }"><b>{{ row.name }}</b></template>
          </el-table-column>
          <el-table-column label="抽取值">
            <template #default="{ row }">
              <!-- 编辑态 -->
              <el-input
                v-if="editKey === row.name"
                v-model="editValue"
                size="small"
                @keyup.enter="save(row)"
                @blur="save(row)"
              />
              <!-- 展示态 -->
              <span v-else class="value" :class="{ pending: row.confidence < 0.85 }" @click="startEdit(row)">
                {{ row.value || '—' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="置信度" width="150">
            <template #default="{ row }">
              <div class="conf">
                <el-progress :percentage="Math.round(row.confidence * 100)" :color="confColor(row.confidence)" :stroke-width="6" :show-text="false" />
                <span class="conf-text">{{ confLabel(row.confidence) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90">
            <template #default="{ row }">
              <el-button link size="small" @click="startEdit(row)">{{ editKey === row.name ? '保存' : '修改' }}</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-else class="empty">左侧点击「开始抽取」，AI 结果将逐字段流式写入此处</div>

        <!-- 抽取过程流 -->
        <div v-if="trace.length" class="trace">
          <div v-for="(t, i) in trace" :key="i" class="trace-item">· {{ t }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createStreamClient } from '../utils/requestStream'

const { streamRequest } = createStreamClient({ timeout: 120000 })

const rawText = ref(
  '甲方：沈阳市恒达贸易有限公司（统一社会信用代码 91210103MA0P45X2）\n' +
  '乙方：辽宁中恒建筑安装工程有限公司\n' +
  '合同编号：HD-2026-0311-07，于 2026 年 3 月 11 日签订。\n' +
  '采购金额为人民币 1,286,500 元（含税），分三期支付：预付款 30%，到货款 50%，验收款 20%。\n' +
  '供货期限为合同生效后 45 个自然日内，交货地点为沈阳市铁西区经济技术开发区 12 号厂房。'
)

const rows = ref([])          // [{ name, value, confidence }]
const trace = ref([])
const running = ref(false)
const elapsed = ref('')
const editKey = ref(null)
const editValue = ref('')

let controller = null

const headerStyle = { background: 'var(--surface-2)', color: 'var(--text-2)' }

function confColor(c) { return c >= 0.9 ? '#10b981' : c >= 0.85 ? '#f59e0b' : '#ef4444' }
function confLabel(c) { return c >= 0.9 ? '高置信' : c >= 0.85 ? '一般' : '待确认' }

function run() {
  if (!rawText.value.trim()) { ElMessage.warning('请先粘贴文本'); return }
  reset()
  running.value = true
  const t0 = performance.now()

  controller = streamRequest(
    '/api/extract/stream',
    { text: rawText.value },
    ({ event, data }) => {
      if (event === 'field') {
        rows.value.push(data)                                  // 逐字段追加（流式感）
        trace.value.push(`已抽取字段「${data.name}」置信度 ${Math.round(data.confidence * 100)}%`)
      } else if (event === 'log') {
        trace.value.push(data.message)
      }
    },
    () => {
      running.value = false
      elapsed.value = ((performance.now() - t0) / 1000).toFixed(1)
      const pending = rows.value.filter((r) => r.confidence < 0.85).length
      ElMessage.success(pending ? `抽取完成，${pending} 个字段待人工确认` : '抽取完成')
    },
    (err) => {
      running.value = false
      ElMessage.error('抽取失败：' + err.message)
    }
  )
}

function reset() {
  controller?.abort?.()
  rows.value = []
  trace.value = []
  elapsed.value = ''
  editKey.value = null
}

function startEdit(row) {
  editKey.value = row.name
  editValue.value = row.value
}
function save(row) {
  if (editKey.value !== row.name) return
  row.value = editValue.value
  row.confidence = 1            // 人工确认后视为确定值
  editKey.value = null
}

function exportCsv() {
  const head = '字段,抽取值,置信度\n'
  const body = rows.value.map((r) => `${r.name},"${String(r.value).replace(/"/g, '""')}",${r.confidence}`).join('\n')
  const blob = new Blob(['\ufeff' + head + body], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'extract-result.csv'
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success('已导出 CSV')
}
</script>

<style scoped>
.layout { display: grid; grid-template-columns: 1fr 1.3fr; gap: 14px; align-items: start; }
@media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }

.actions { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.elapsed { font-size: 12px; color: var(--text-3); }

.hint { margin-top: 14px; }
.hint p { margin: 0; font-size: 12px; line-height: 1.7; }

.result-head { display: flex; align-items: center; justify-content: space-between; }

.value { cursor: pointer; padding: 2px 4px; border-radius: 4px; }
.value:hover { background: var(--brand-weak); }
.value.pending { color: var(--warn); border-bottom: 1px dashed var(--warn); }

.conf { display: flex; align-items: center; gap: 8px; }
.conf .el-progress { flex: 1; }
.conf-text { font-size: 11px; color: var(--text-3); width: 44px; }

.trace {
  margin-top: 12px; padding: 10px 12px;
  background: var(--surface-2);
  border-radius: 8px;
  max-height: 130px; overflow-y: auto;
}
.trace-item { font-size: 12px; color: var(--text-2); line-height: 1.9; font-variant-numeric: tabular-nums; }
</style>
