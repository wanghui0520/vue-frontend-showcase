/**
 * 字典缓存：内存 Map + 请求去重
 * 同一字典类型全局只发一次请求，其余命中缓存
 */
import { ref } from 'vue'

const cache = new Map() // dictType -> ref(array)
const pending = new Map() // dictType -> Promise

export function useDict(dictType) {
  if (cache.has(dictType)) return { list: cache.get(dictType), hit: true }

  const list = ref([])
  cache.set(dictType, list)

  if (!pending.has(dictType)) {
    // 模拟远程字典接口（真实项目为 getDicts(dictType)）
    const mock = {
      order_status: [
        { label: '待支付', value: '0', tag: 'warning' },
        { label: '已支付', value: '1', tag: 'success' },
        { label: '已取消', value: '2', tag: 'info' }
      ],
      member_level: [
        { label: '普通会员', value: '1', tag: '' },
        { label: '黄金会员', value: '2', tag: 'warning' },
        { label: '钻石会员', value: '3', tag: 'danger' }
      ]
    }
    pending.set(
      dictType,
      new Promise((resolve) => setTimeout(() => resolve(mock[dictType] || []), 300))
    )
  }

  pending.get(dictType).then((data) => {
    list.value = data
  })

  return { list, hit: false }
}
