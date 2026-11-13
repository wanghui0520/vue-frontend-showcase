<template>
  <div class="panel">
    <el-alert type="info" :closable="false" show-icon class="tip"
      title="演示：行内编辑（草稿态 + 校验）、字典缓存（同一字典全局只请求一次）、分页加载。点击「编辑」体验。" />

    <el-table :data="rows" v-loading="loading" border size="default" row-key="id">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="订单编号">
        <template #default="{ row }">
          <cell-edit v-if="editingKey === row.id" v-model="draft.orderNo" />
          <span v-else>{{ row.orderNo }}</span>
        </template>
      </el-table-column>
      <el-table-column label="客户名称">
        <template #default="{ row }">
          <cell-edit v-if="editingKey === row.id" v-model="draft.customer" />
          <span v-else>{{ row.customer }}</span>
        </template>
      </el-table-column>
      <el-table-column label="订单状态（字典列）" width="170">
        <template #default="{ row }">
          <template v-if="editingKey === row.id">
            <el-select v-model="draft.status" size="small">
              <el-option v-for="d in statusDict" :key="d.value" :label="d.label" :value="d.value" />
            </el-select>
          </template>
          <dict-tag v-else :dict="statusDict" :value="row.status" />
        </template>
      </el-table-column>
      <el-table-column label="会员等级（字典列）" width="170">
        <template #default="{ row }">
          <template v-if="editingKey === row.id">
            <el-select v-model="draft.level" size="small">
              <el-option v-for="d in levelDict" :key="d.value" :label="d.label" :value="d.value" />
            </el-select>
          </template>
          <dict-tag v-else :dict="levelDict" :value="row.level" />
        </template>
      </el-table-column>
      <el-table-column label="金额" width="130">
        <template #default="{ row }">
          <cell-edit v-if="editingKey === row.id" v-model="draft.amount" type="number" />
          <span v-else>¥ {{ row.amount.toLocaleString() }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <template v-if="editingKey === row.id">
            <el-button size="small" type="primary" @click="confirmSave">保存</el-button>
            <el-button size="small" @click="cancel">取消</el-button>
          </template>
          <el-button v-else size="small" @click="start(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination layout="prev, pager, next, total" :total="pagination.total"
        :page-size="pagination.pageSize" :current-page="pagination.page"
        @current-change="(p) => load(p)" />
    </div>
  </div>
</template>

<script setup>
import { h, defineComponent } from 'vue'
import { ElTag, ElMessage } from 'element-plus'
import { useTable, useTableEdit } from '../hooks/useTable'
import { useDict } from '../utils/dict'

/* ---------- 字典（缓存命中情况见 console） ---------- */
const { list: statusDict } = useDict('order_status')
const { list: levelDict } = useDict('member_level')

/* ---------- 内联小组件 ---------- */
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
      return item ? h(ElTag, { type: item.tag || 'primary', size: 'small' }, () => item.label) : h('span', props.value)
    }
  }
})

/* ---------- 表格数据（模拟远程分页接口） ---------- */
const allData = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  orderNo: 'SO2026' + String(10000 + i),
  customer: ['华宇贸易', '宏图科技', '三和实业', '临港物流'][i % 4] + ' #' + (i + 1),
  status: ['0', '1', '1', '2'][i % 4],
  level: String((i % 3) + 1),
  amount: Math.round(Math.random() * 90000) + 1000
}))

const fetcher = ({ page, pageSize }) =>
  new Promise((resolve) => setTimeout(() => resolve({
    list: allData.slice((page - 1) * pageSize, page * pageSize),
    total: allData.length
  }), 250))

const { rows, loading, pagination, load } = useTable(fetcher, { pageSize: 8 })
load()

const { editingKey, draft, start, cancel, save, validate } = useTableEdit(rows)

const confirmSave = () => {
  const error = validate({
    orderNo: { required: true, label: '订单编号', max: 20 },
    customer: { required: true, label: '客户名称' }
  })
  if (error) return ElMessage.warning(error)
  save()
  ElMessage.success('已保存')
}
</script>

<style scoped>
.panel { background: #fff; border: 1px solid #e3e8f4; border-radius: 10px; padding: 14px; }
.tip { margin-bottom: 12px; }
.pager { margin-top: 12px; display: flex; justify-content: flex-end; }
:deep(.cell-input) { width: 100%; border: 1px solid #cdd5e6; border-radius: 4px; padding: 4px 8px; font-size: 13px; outline: none; }
:deep(.cell-input:focus) { border-color: #14315c; }
</style>
