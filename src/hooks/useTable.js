/**
 * useTable：列表加载 / 分页 / 筛选状态机（展示版）
 */
import { ref, reactive } from 'vue'

export function useTable(fetcher, { pageSize = 10 } = {}) {
  const rows = ref([])
  const loading = ref(false)
  const pagination = reactive({ page: 1, pageSize, total: 0 })

  async function load(page = 1) {
    loading.value = true
    try {
      const { list, total } = await fetcher({ page, pageSize: pagination.pageSize })
      rows.value = list
      pagination.page = page
      pagination.total = total
    } finally {
      loading.value = false
    }
  }

  return { rows, loading, pagination, load }
}

/**
 * useTableEdit：行内编辑状态机
 * editingKey（哪一行在编辑）+ draft（草稿对象，避免未保存就改源数据）
 */
import { computed } from 'vue'

export function useTableEdit(rows) {
  const editingKey = ref(null)
  const draft = ref({})

  const isEditing = computed(() => editingKey.value !== null)

  function start(row, keyField = 'id') {
    editingKey.value = row[keyField]
    draft.value = { ...row }
  }

  function cancel() {
    editingKey.value = null
  }

  function save(keyField = 'id') {
    const index = rows.value.findIndex((r) => String(r[keyField]) === String(editingKey.value))
    if (index > -1) rows.value[index] = { ...draft.value }
    cancel()
  }

  /** 校验：必填 + 长度 */
  function validate(rules) {
    if (editingKey.value === null) return ''
    for (const [field, rule] of Object.entries(rules)) {
      const v = String(draft.value[field] ?? '').trim()
      if (rule.required && !v) return rule.message || `${rule.label}不能为空`
      if (rule.max && v.length > rule.max) return rule.message || `${rule.label}超长`
    }
    return ''
  }

  return { editingKey, draft, isEditing, start, cancel, save, validate }
}
