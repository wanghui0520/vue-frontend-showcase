/**
 * 业务订单数据层（跨页面共享）
 * - 单例 reactive 数据源 + localStorage 持久化
 * - 供「可编辑表格」读写，供「AI 数据提取」写入（source = 'ai'）
 */
import { ref } from 'vue'

const STORAGE_KEY = 'showcase_orders_v1'

const CUSTOMERS = ['华宇贸易', '宏图科技', '三和实业', '临港物流', '恒达建材', '中恒安装']

function seedRows() {
  const now = Date.now()
  return Array.from({ length: 26 }, (_, i) => ({
    id: i + 1,
    orderNo: 'SO2026' + String(10000 + i),
    customer: CUSTOMERS[i % CUSTOMERS.length] + ' #' + (i + 1),
    status: ['0', '1', '1', '2'][i % 4],
    level: String((i % 3) + 1),
    amount: Math.round(((i * 7919) % 90000) + 1000),
    createdAt: new Date(now - i * 86400000 * 1.3).toISOString().slice(0, 10),
    source: 'manual'
  }))
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : null
    if (Array.isArray(data) && data.length) return data
  } catch { /* 脏数据兜底 */ }
  return seedRows()
}

export const orders = ref(load())

let seq = orders.value.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0)

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.value))
  } catch { /* 存储满时静默降级 */ }
}

/** 新增订单（AI 提取页也会调用，source 标记来源） */
export function addOrder(payload) {
  seq += 1
  const row = {
    id: seq,
    orderNo: payload.orderNo || `SO${Date.now()}`,
    customer: payload.customer || '未命名客户',
    status: payload.status || '0',
    level: payload.level || '1',
    amount: Number(payload.amount) || 0,
    createdAt: payload.createdAt || new Date().toISOString().slice(0, 10),
    source: payload.source || 'manual'
  }
  orders.value = [row, ...orders.value]
  persist()
  return row
}

/** 局部更新（行内编辑保存） */
export function updateOrder(id, patch) {
  const idx = orders.value.findIndex((r) => String(r.id) === String(id))
  if (idx === -1) return
  const next = [...orders.value]
  next[idx] = { ...next[idx], ...patch, id: next[idx].id }
  orders.value = next
  persist()
}

/** 批量删除 */
export function removeOrders(ids) {
  const set = new Set(ids.map(String))
  orders.value = orders.value.filter((r) => !set.has(String(r.id)))
  persist()
}

/** 重置为演示数据 */
export function resetOrders() {
  orders.value = seedRows()
  seq = orders.value.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0)
  persist()
}
