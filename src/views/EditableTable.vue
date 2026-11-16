<template>
  <div class="page">
    <p class="page-desc">
      业务订单列表：<b>多条件搜索 + 行内编辑（草稿态校验）+ 批量删除 + CSV 导出 + 字典缓存</b>。
      数据为跨页面共享源——「AI 数据提取」页可把抽取结果一键导入这里（来源标记为 AI），
      选中的订单还能一键带到「AI 流式对话」页做风险研判。
    </p>

    <!-- ═══ 搜索条件 ═══ -->
    <div class="card search-card">
      <el-form :inline="true" class="search-form" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="订单编号 / 客户名称" clearable style="width: 200px" @keyup.enter="applyFilters" />
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select v-model="filters.status" placeholder="全部" clearable style="width: 130px">
            <el-option v-for="d in statusDict" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="会员等级">
          <el-select v-model="filters.level" placeholder="全部" clearable style="width: 130px">
            <el-option v-for="d in levelDict" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="金额区间">
          <el-input-number v-model="filters.min" :min="0" :controls="false" placeholder="最小" style="width: 96px" />
          <span class="wave">~</span>
          <el-input-number v-model="filters.max" :min="0" :controls="false" placeholder="最大" style="width: 96px" />
        </el-form-item>
        <el-form-item label="创建日期">
          <el-date-picker
            v-model="filters.range"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="~"
            start-placeholder="开始"
            end-placeholder="结束"
            style="width: 230px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="applyFilters">查询</el-button>
          <el-button :icon="RefreshLeft" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- ═══ 列表 ═══ -->
    <div class="card">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-button type="primary" :icon="Plus" @click="openCreate">新增订单</el-button>
          <el-button type="danger" plain :icon="Delete" :disabled="!selection.length" @click="batchDelete">
            批量删除{{ selection.length ? `（${selection.length}）` : '' }}
          </el-button>
          <el-button :icon="Download" :disabled="!filteredCount" @click="exportCsv">导出 CSV</el-button>
          <el-button :icon="RefreshRight" @click="reload">刷新</el-button>
          <el-button link type="info" @click="resetDemo">恢复演示数据</el-button>
        </div>
        <div class="toolbar-right">
          <span class="summary">
            共 <b>{{ pagination.total }}</b> 条 · 金额合计 <b>¥ {{ totalAmount.toLocaleString() }}</b>
          </span>
          <el-button type="success" plain :icon="MagicStick" :disabled="!selection.length" @click="askAi">
            带选中订单问 AI
          </el-button>
        </div>
      </div>

      <el-table :data="rows" v-loading="loading" border row-key="id" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="44" />
        <el-table-column prop="id" label="ID" width="62" />
        <el-table-column label="订单编号" min-width="140">
          <template #default="{ row }">
            <cell-edit v-if="editingKey === row.id" v-model="draft.orderNo" />
            <span v-else class="mono">{{ row.orderNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="客户名称" min-width="150">
          <template #default="{ row }">
            <cell-edit v-if="editingKey === row.id" v-model="draft.customer" />
            <span v-else>{{ row.customer }}</span>
          </template>
        </el-table-column>
        <el-table-column label="订单状态" width="130">
          <template #default="{ row }">
            <el-select v-if="editingKey === row.id" v-model="draft.status" size="small">
              <el-option v-for="d in statusDict" :key="d.value" :label="d.label" :value="d.value" />
            </el-select>
            <dict-tag v-else :dict="statusDict" :value="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="会员等级" width="130">
          <template #default="{ row }">
            <el-select v-if="editingKey === row.id" v-model="draft.level" size="small">
              <el-option v-for="d in levelDict" :key="d.value" :label="d.label" :value="d.value" />
            </el-select>
            <dict-tag v-else :dict="levelDict" :value="row.level" />
          </template>
        </el-table-column>
        <el-table-column label="金额" width="130" align="right">
          <template #default="{ row }">
            <cell-edit v-if="editingKey === row.id" v-model="draft.amount" type="number" />
            <span v-else class="amount">¥ {{ Number(row.amount).toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="104" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.source === 'ai'" type="warning" size="small" effect="light">AI 提取</el-tag>
            <el-tag v-else type="info" size="small" effect="plain">手工录入</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建日期" width="112" />
        <el-table-column label="操作" width="138" fixed="right">
          <template #default="{ row }">
            <template v-if="editingKey === row.id">
              <el-button size="small" type="primary" @click="confirmSave">保存</el-button>
              <el-button size="small" @click="cancel">取消</el-button>
            </template>
            <template v-else>
              <el-button size="small" @click="start(row)">编辑</el-button>
              <el-button size="small" type="danger" link @click="removeOne(row)">删除</el-button>
            </template>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty">没有符合条件的订单，试试调整搜索条件或<b>重置</b></div>
        </template>
      </el-table>

      <div class="pager">
        <el-pagination
          layout="total, sizes, prev, pager, next"
          :total="pagination.total"
          :page-size="pagination.pageSize"
          :current-page="pagination.page"
          :page-sizes="[8, 15, 30]"
          @current-change="(p) => load(p)"
          @size-change="onSizeChange"
        />
      </div>
    </div>

    <!-- ═══ 新增弹窗 ═══ -->
    <el-dialog v-model="createVisible" title="新增订单" width="440px">
      <el-form :model="createForm" label-width="88px">
        <el-form-item label="订单编号" required>
          <el-input v-model="createForm.orderNo" placeholder="如 SO20269999" />
        </el-form-item>
        <el-form-item label="客户名称" required>
          <el-input v-model="createForm.customer" />
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select v-model="createForm.status" style="width: 100%">
            <el-option v-for="d in statusDict" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="会员等级">
          <el-select v-model="createForm.level" style="width: 100%">
            <el-option v-for="d in levelDict" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="金额">
          <el-input-number v-model="createForm.amount" :min="0" :step="100" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, h, defineComponent } from 'vue'
import { ElTag, ElMessage, ElMessageBox } from 'element-plus'
import { Search, RefreshLeft, RefreshRight, Plus, Delete, Download, MagicStick } from '@element-plus/icons-vue'
import { useTable, useTableEdit } from '../hooks/useTable'
import { useDict } from '../utils/dict'
import { orders, addOrder, updateOrder, removeOrders, resetOrders } from '../store/orders'
import { goToChatWithPrompt } from '../store/bridge'

/* ═══════════ 字典（缓存命中见 console） ═══════════ */
const { list: statusDict } = useDict('order_status')
const { list: levelDict } = useDict('member_level')

/* ═══════════ 内联小组件 ═══════════ */
const CellEdit = defineComponent({
  props: { modelValue: [String, Number], type: { type: String, default: 'text' } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        class: 'cell-input',
        type: props.type,
        value: props.modelValue,
        onInput: (e) => emit('update:modelValue', props.type === 'number' ? Number(e.target.value) : e.target.value)
      })
  }
})

const DictTag = defineComponent({
  props: { dict: Array, value: String },
  setup(props) {
    return () => {
      const item = props.dict.find((d) => String(d.value) === String(props.value))
      return item
        ? h(ElTag, { type: item.tag || 'primary', size: 'small', effect: 'light' }, () => item.label)
        : h('span', props.value)
    }
  }
})

/* ═══════════ 搜索条件 ═══════════ */
const emptyFilters = () => ({ keyword: '', status: '', level: '', min: undefined, max: undefined, range: [] })
const filters = reactive(emptyFilters())
const applied = ref(emptyFilters())     // 已生效的条件（点「查询」才生效）

function applyFilters() {
  applied.value = { ...filters, range: filters.range ? [...filters.range] : [] }
  load(1)
}

function resetFilters() {
  Object.assign(filters, emptyFilters())
  applied.value = emptyFilters()
  load(1)
}

/** 生效条件过滤（对应真实项目的后端查询参数） */
function filterList() {
  const f = applied.value
  return orders.value.filter((r) => {
    if (f.keyword) {
      const k = f.keyword.trim().toLowerCase()
      if (!`${r.orderNo} ${r.customer}`.toLowerCase().includes(k)) return false
    }
    if (f.status && String(r.status) !== String(f.status)) return false
    if (f.level && String(r.level) !== String(f.level)) return false
    if (f.min != null && Number(r.amount) < f.min) return false
    if (f.max != null && Number(r.amount) > f.max) return false
    if (f.range?.length === 2) {
      const [s, e] = f.range
      if (r.createdAt < s || r.createdAt > e) return false
    }
    return true
  })
}

const filteredCount = computed(() => filterList().length)
const totalAmount = computed(() => filterList().reduce((sum, r) => sum + Number(r.amount || 0), 0))

/* ═══════════ 列表（模拟远程分页接口） ═══════════ */
const fetcher = ({ page, pageSize }) =>
  new Promise((resolve) => setTimeout(() => {
    const list = filterList()
    resolve({ list: list.slice((page - 1) * pageSize, page * pageSize), total: list.length })
  }, 220))

const { rows, loading, pagination, load } = useTable(fetcher, { pageSize: 8 })
load(1)

const { editingKey, draft, start, cancel, save, validate } = useTableEdit(rows)

const reload = () => load(pagination.page)

const onSizeChange = (size) => {
  pagination.pageSize = size
  load(1)
}

/* ═══════════ 行编辑 ═══════════ */
const confirmSave = () => {
  const error = validate({
    orderNo: { required: true, label: '订单编号', max: 20 },
    customer: { required: true, label: '客户名称' }
  })
  if (error) return ElMessage.warning(error)
  updateOrder(editingKey.value, { ...draft.value })   // 写回共享数据层（含持久化）
  cancel()
  reload()
  ElMessage.success('已保存')
}

/* ═══════════ 选择 / 删除 ═══════════ */
const selection = ref([])
const onSelectionChange = (val) => { selection.value = val }

async function removeOne(row) {
  try {
    await ElMessageBox.confirm(`确定删除订单「${row.orderNo}」？`, '删除确认', { type: 'warning' })
  } catch { return }
  removeOrders([row.id])
  reload()
  ElMessage.success('已删除')
}

async function batchDelete() {
  const ids = selection.value.map((r) => r.id)
  if (!ids.length) return
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 条订单？`, '批量删除', { type: 'warning' })
  } catch { return }
  removeOrders(ids)
  selection.value = []
  reload()
  ElMessage.success(`已删除 ${ids.length} 条`)
}

async function resetDemo() {
  try {
    await ElMessageBox.confirm('将清空当前改动，恢复为初始演示数据？', '恢复演示数据', { type: 'warning' })
  } catch { return }
  resetOrders()
  resetFilters()
  ElMessage.success('已恢复演示数据')
}

/* ═══════════ 新增 ═══════════ */
const createVisible = ref(false)
const createForm = reactive({ orderNo: '', customer: '', status: '0', level: '1', amount: 0 })

function openCreate() {
  Object.assign(createForm, { orderNo: 'SO' + Date.now().toString().slice(-8), customer: '', status: '0', level: '1', amount: 0 })
  createVisible.value = true
}

function submitCreate() {
  if (!createForm.orderNo.trim()) return ElMessage.warning('请填写订单编号')
  if (!createForm.customer.trim()) return ElMessage.warning('请填写客户名称')
  addOrder({ ...createForm, source: 'manual' })
  createVisible.value = false
  applyFilters()
  ElMessage.success('已新增')
}

/* ═══════════ 导出 CSV ═══════════ */
function exportCsv() {
  const list = filterList()
  if (!list.length) return ElMessage.warning('没有可导出的数据')
  const label = (dict, v) => dict.find((d) => String(d.value) === String(v))?.label || v
  const head = '订单编号,客户名称,订单状态,会员等级,金额,来源,创建日期\n'
  const body = list.map((r) => [
    r.orderNo,
    `"${String(r.customer).replace(/"/g, '""')}"`,
    label(statusDict.value, r.status),
    label(levelDict.value, r.level),
    r.amount,
    r.source === 'ai' ? 'AI 提取' : '手工录入',
    r.createdAt
  ].join(',')).join('\n')

  const blob = new Blob(['\ufeff' + head + body], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `orders-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success(`已导出 ${list.length} 条`)
}

/* ═══════════ 与 AI 对话联动 ═══════════ */
function askAi() {
  const list = selection.value
  if (!list.length) return
  const label = (dict, v) => dict.find((d) => String(d.value) === String(v))?.label || v
  const lines = list.map((r) => `- ${r.orderNo}｜${r.customer}｜${label(statusDict.value, r.status)}｜¥${Number(r.amount).toLocaleString()}｜${r.createdAt}`)
  const prompt = [
    `【业务上下文】来源：订单管理 · 选中 ${list.length} 条记录`,
    ...lines,
    '',
    '请基于上述订单数据，分析这批订单在资金与履约方面的异常风险点，并给出核查建议。'
  ].join('\n')
  goToChatWithPrompt(prompt)   // 对应真实项目的「路由 → Prompt 前缀」机制
}
</script>

<style scoped>
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 14px;
}
.search-card { padding-bottom: 2px; }
.search-form :deep(.el-form-item) { margin-bottom: 12px; margin-right: 16px; }
.wave { margin: 0 6px; color: var(--text-3); }

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.toolbar-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar-right { display: flex; align-items: center; gap: 12px; }
.summary { font-size: 12px; color: var(--text-3); }
.summary b { color: var(--text-1); }

.mono { font-variant-numeric: tabular-nums; }
.amount { font-variant-numeric: tabular-nums; font-weight: 600; }
.empty { padding: 28px 0; color: var(--text-3); font-size: 13px; }

.pager { margin-top: 12px; display: flex; justify-content: flex-end; }

:deep(.cell-input) {
  width: 100%;
  padding: 4px 8px;
  font-size: 13px;
  color: var(--text-1);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  outline: none;
}
:deep(.cell-input:focus) { border-color: var(--brand); box-shadow: 0 0 0 2px var(--brand-weak); }
</style>
