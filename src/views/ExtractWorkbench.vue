<template>
  <div class="page">
    <p class="page-desc">
      粘贴一段非结构化文本，AI 按配置的 Schema <b>流式抽取</b>结构化字段；低置信度字段标记
      <b>「待确认」</b>引导人工兜底编辑——演示「AI 输出不可控 → 人工审核兜底」的完整业务闭环。
    </p>

    <div class="layout">
      <!-- 左：输入 -->
      <div class="card">
        <div class="input-head">
          <h3 class="card-title">① 原始文本</h3>
          <div class="tpl-row">
            <el-tag
              v-for="t in templates" :key="t.name" class="tpl-tag"
              :type="tplName === t.name ? 'primary' : 'info'" effect="plain"
              @click="applyTemplate(t)"
            >{{ t.name }}</el-tag>
          </div>
        </div>
        <el-input
          v-model="rawText"
          type="textarea"
          :rows="9"
          placeholder="粘贴合同、流水、工单等文本，或点击上方模板快速填充示例…"
        />
        <div class="actions">
          <el-button type="primary" :loading="running" @click="run">
            {{ running ? 'AI 抽取中…' : '开始抽取' }}
          </el-button>
          <el-button :disabled="running" @click="reset">清空</el-button>
        </div>
        <div class="hint">
          <span class="hint-dot"></span>
          抽取字段由后端按 Schema 逐帧返回，前端逐条渲染；<b>置信度 &lt; 85%</b> 标记「待确认」，人工复核后视为确定值。
        </div>
      </div>

      <!-- 右：结果 -->
      <div class="card">
        <div class="result-head">
          <h3 class="card-title">② 结构化结果（可编辑）</h3>
          <div class="head-actions">
            <el-button size="small" type="warning" plain :disabled="!pendingCount" @click="filterPending = !filterPending">
              {{ filterPending ? '显示全部' : `待确认 ${pendingCount}` }}
            </el-button>
            <el-button size="small" type="success" plain :disabled="!rows.length" @click="importToOrders">导入订单表格</el-button>
            <el-button size="small" :disabled="!rows.length" @click="exportCsv">导出 CSV</el-button>
          </div>
        </div>

        <!-- 统计条 -->
        <div v-if="rows.length" class="stat-row">
          <div class="stat">
            <span class="stat-num">{{ rows.length }}</span>
            <span class="stat-label">抽取字段</span>
          </div>
          <div class="stat" :class="{ 'stat-warn': pendingCount }">
            <span class="stat-num">{{ pendingCount }}</span>
            <span class="stat-label">待确认</span>
          </div>
          <div class="stat">
            <span class="stat-num">{{ avgConf }}</span>
            <span class="stat-label">平均置信度</span>
          </div>
          <div class="stat">
            <span class="stat-num">{{ elapsed || '—' }}s</span>
            <span class="stat-label">耗时</span>
          </div>
        </div>

        <el-table
          v-if="displayRows.length"
          :data="displayRows" size="default"
          :header-cell-style="headerStyle" max-height="380"
          :row-class-name="rowClass"
        >
          <el-table-column label="字段" width="120">
            <template #default="{ row }">
              <span class="field-name"><span class="field-icon">{{ fieldIcon(row.name) }}</span>{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="抽取值">
            <template #default="{ row }">
              <el-input
                v-if="editKey === row.name"
                ref="editRef"
                v-model="editValue" size="small"
                @keyup.enter="save(row)" @blur="save(row)"
              />
              <span v-else class="value" :class="{ pending: row.confidence < 0.85 }" @click="startEdit(row)">
                {{ row.value || '—' }}
                <el-icon v-if="row.confidence < 0.85" class="pending-icon"><EditPen /></el-icon>
              </span>
            </template>
          </el-table-column>
          <el-table-column label="置信度" width="170">
            <template #default="{ row }">
              <div class="conf">
                <el-progress
                  :percentage="Math.round(row.confidence * 100)"
                  :color="confColor(row.confidence)"
                  :stroke-width="6" :show-text="false"
                />
                <span class="conf-text">{{ confLabel(row.confidence) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button link size="small" type="primary" @click="startEdit(row)">
                {{ editKey === row.name ? '保存' : '修改' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 空状态 -->
        <div v-else class="empty">
          <div class="empty-art">
            <div class="empty-doc"></div>
            <div class="empty-arrow">→</div>
            <div class="empty-struct"><i/><i/><i/></div>
          </div>
          <p>左侧点击「开始抽取」</p>
          <p class="empty-sub">AI 结果将逐字段流式写入此处</p>
        </div>

        <!-- 抽取过程流 -->
        <div v-if="trace.length" class="trace">
          <div class="trace-head">
            <span>抽取过程</span>
            <span v-if="running" class="trace-live"><i class="live-dot"></i>流式中</span>
          </div>
          <div class="trace-body">
            <div v-for="(t, i) in trace" :key="i" class="trace-item">
              <span class="trace-icon">{{ t.startsWith('已抽取') ? '✓' : '›' }}</span>{{ t }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { EditPen } from '@element-plus/icons-vue'
import { createStreamClient } from '../utils/requestStream'
import { addOrder } from '../store/orders'
import { goTo } from '../store/bridge'

const { streamRequest } = createStreamClient({ timeout: 120000 })

const templates = [
  {
    name: '采购合同',
    text:
      '甲方：沈阳市恒达贸易有限公司（统一社会信用代码 91210103MA0P45X2）\n' +
      '乙方：辽宁中恒建筑安装工程有限公司\n' +
      '合同编号：HD-2026-0311-07，于 2026 年 3 月 11 日签订。\n' +
      '采购金额为人民币 1,286,500 元（含税），分三期支付：预付款 30%，到货款 50%，验收款 20%。\n' +
      '供货期限为合同生效后 45 个自然日内，交货地点为沈阳市铁西区经济技术开发区 12 号厂房。'
  },
  {
    name: '设备工单',
    text:
      '工单号：GD-88213，报修时间 2026 年 4 月 2 日 14:20。\n' +
      '报修单位：沈阳华晨专用车有限公司，联系人：刘志强，电话 138****4021。\n' +
      '故障描述：三号车间数控机床主轴异响，疑似轴承磨损，已停机。\n' +
      '预估维修费用 8,600 元，要求 48 小时内响应上门。'
  },
  {
    name: '流水明细',
    text:
      '2026 年 2 月 17 日，付款方王某某（卡号 6222****3301）向沈阳金昱商贸有限公司转账 460,000 元，\n' +
      '用途备注"货款"；同日 15:07 又向同一收款方转账 460,000 元，备注"往来款"，两笔间隔仅 3 分钟，\n' +
      '收款账户开户行为盛京银行中山支行。'
  }
]

const rawText = ref(templates[0].text)
const tplName = ref(templates[0].name)

const rows = ref([])
const trace = ref([])
const running = ref(false)
const elapsed = ref('')
const editKey = ref(null)
const editValue = ref('')
const filterPending = ref(false)
const editRef = ref(null)

let controller = null

const headerStyle = { background: 'var(--surface-2)', color: 'var(--text-2)' }

const displayRows = computed(() =>
  filterPending.value ? rows.value.filter((r) => r.confidence < 0.85) : rows.value
)
const pendingCount = computed(() => rows.value.filter((r) => r.confidence < 0.85).length)
const avgConf = computed(() => {
  if (!rows.value.length) return '—'
  return Math.round((rows.value.reduce((s, r) => s + r.confidence, 0) / rows.value.length) * 100) + '%'
})

function confColor(c) { return c >= 0.9 ? '#10b981' : c >= 0.85 ? '#f59e0b' : '#ef4444' }
function confLabel(c) { return c >= 0.9 ? '高置信' : c >= 0.85 ? '一般' : '待确认' }

const FIELD_ICONS = {
  甲方: '🏢', 乙方: '🏗️', 合同编号: '#️⃣', 合同金额: '💰', 签订日期: '📅',
  工单号: '#️⃣', 报修单位: '🏢', 联系人: '👤', 联系电话: '📱', 故障描述: '🔧',
  预估费用: '💰', 付款方: '👤', 收款方: '🏦', 转账金额: '💰', 交易日期: '📅', 用途备注: '📝'
}
function fieldIcon(name) { return FIELD_ICONS[name] || '📋' }

function rowClass({ row }) {
  return row.confidence < 0.85 ? 'row-pending' : ''
}

function applyTemplate(t) {
  tplName.value = t.name
  rawText.value = t.text
  reset()
}

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
        rows.value.push(data)
        trace.value.push(`已抽取字段「${data.name}」置信度 ${Math.round(data.confidence * 100)}%`)
      } else if (event === 'log') {
        trace.value.push(data.message)
      }
    },
    () => {
      running.value = false
      elapsed.value = ((performance.now() - t0) / 1000).toFixed(1)
      const pending = pendingCount.value
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
  filterPending.value = false
}

function startEdit(row) {
  editKey.value = row.name
  editValue.value = row.value
  nextTick(() => editRef.value?.focus?.())
}
function save(row) {
  if (editKey.value !== row.name) return
  row.value = editValue.value
  row.confidence = 1            // 人工确认后视为确定值
  editKey.value = null
}

/** 把抽取结果映射成业务订单，写入共享数据层（可编辑表格页可见，来源标记 AI） */
function importToOrders() {
  const get = (name) => rows.value.find((r) => r.name === name)?.value || ''
  const amount = Number(String(get('合同金额') || get('预估费用') || get('转账金额')).replace(/[^\d.]/g, '')) || 0
  addOrder({
    orderNo: get('合同编号') || get('工单号') || `AI-${Date.now()}`,
    customer: get('甲方') || get('报修单位') || get('付款方') || '（未识别主体）',
    status: '0',
    level: '1',
    amount,
    createdAt: get('签订日期') || get('交易日期') || undefined,
    source: 'ai'
  })
  ElMessage.success('已导入订单表格（来源标记为 AI 提取）')
  setTimeout(() => goTo('table'), 600)
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

/* ---------- 输入卡片 ---------- */
.input-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.tpl-row { display: flex; gap: 6px; }
.tpl-tag { cursor: pointer; user-select: none; }

.actions { display: flex; align-items: center; gap: 10px; margin-top: 12px; }

.hint {
  margin-top: 14px; font-size: 12px; line-height: 1.7; color: var(--text-2);
  display: flex; gap: 8px; align-items: flex-start;
}
.hint-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--brand); margin-top: 7px; flex-shrink: 0; }

/* ---------- 结果卡片 ---------- */
.result-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.head-actions { display: flex; align-items: center; gap: 8px; }

.stat-row {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  margin: 10px 0 12px;
}
.stat {
  background: var(--surface-2); border-radius: 8px;
  padding: 8px 10px; display: flex; flex-direction: column; gap: 2px;
}
.stat-num { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-1, inherit); }
.stat-label { font-size: 11px; color: var(--text-3); }
.stat-warn .stat-num { color: var(--warn); }

.field-name { font-weight: 600; display: inline-flex; align-items: center; gap: 5px; }
.field-icon { font-size: 13px; }

.value { cursor: pointer; padding: 2px 4px; border-radius: 4px; transition: background 0.15s; }
.value:hover { background: var(--brand-weak); }
.value.pending { color: var(--warn); border-bottom: 1px dashed var(--warn); }
.pending-icon { font-size: 12px; margin-left: 3px; }

:deep(.row-pending) { background: rgba(245, 158, 11, 0.05); }

.conf { display: flex; align-items: center; gap: 8px; }
.conf .el-progress { flex: 1; }
.conf-text { font-size: 11px; color: var(--text-3); width: 44px; flex-shrink: 0; }

/* ---------- 空状态 ---------- */
.empty { padding: 36px 0 20px; text-align: center; color: var(--text-3); }
.empty p { margin: 10px 0 0; font-size: 13px; }
.empty-sub { font-size: 12px !important; opacity: 0.7; }
.empty-art { display: flex; align-items: center; justify-content: center; gap: 14px; opacity: 0.75; }
.empty-doc {
  width: 46px; height: 58px; border-radius: 6px;
  border: 2px solid var(--border); background: var(--surface-2);
  position: relative;
}
.empty-doc::before, .empty-doc::after {
  content: ''; position: absolute; left: 8px; right: 8px; height: 3px;
  border-radius: 2px; background: var(--border);
}
.empty-doc::before { top: 12px; }
.empty-doc::after { top: 24px; right: 18px; }
.empty-arrow { font-size: 20px; color: var(--brand); }
.empty-struct { width: 54px; height: 58px; border-radius: 6px; border: 2px solid var(--brand-weak); background: var(--brand-weak); padding: 9px 10px; display: flex; flex-direction: column; gap: 7px; }
.empty-struct i { display: block; height: 4px; border-radius: 2px; background: var(--brand); opacity: 0.55; }
.empty-struct i:nth-child(2) { width: 70%; }
.empty-struct i:nth-child(3) { width: 45%; }

/* ---------- 过程流 ---------- */
.trace {
  margin-top: 12px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
}
.trace-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px; background: var(--surface-2);
  font-size: 12px; font-weight: 600; color: var(--text-2);
}
.trace-live { display: inline-flex; align-items: center; gap: 5px; font-weight: 400; color: var(--brand); font-size: 11px; }
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--brand); animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0.25; } }
.trace-body { padding: 6px 12px; max-height: 120px; overflow-y: auto; }
.trace-item { font-size: 12px; color: var(--text-2); line-height: 1.9; font-variant-numeric: tabular-nums; display: flex; gap: 6px; }
.trace-icon { color: var(--ok); flex-shrink: 0; }
</style>
