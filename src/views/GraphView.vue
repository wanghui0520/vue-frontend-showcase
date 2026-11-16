<template>
  <div class="panel">
    <el-alert type="info" :closable="false" show-icon class="tip"
      title="演示：人物—企业—资金关系图谱。支持双击节点下钻二级关系、再次双击收起（+N 徽标）、右键节点/画布呼出菜单（展开 / 收起 / 删除 / 新建图谱），下钻与收起保持已有节点位置不抖动。" />

    <div class="toolbar">
      <el-button size="small" @click="fit">适配画布</el-button>
      <el-button size="small" @click="snapshot">导出快照 PNG</el-button>
      <el-button size="small" @click="resetGraph">恢复初始图谱</el-button>
      <span class="legend">
        <i class="dot" style="background:#f0a020"></i>人物
        <i class="dot" style="background:#3b6fd4"></i>企业
        <i class="dot" style="background:#3aa96f"></i>资金账户
      </span>
    </div>

    <div ref="wrapperRef" class="canvas-wrap">
      <div ref="containerRef" class="canvas"></div>

      <!-- 自定义右键菜单 -->
      <div v-if="menu.visible" class="ctx-menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }">
        <div v-for="item in menu.items" :key="item.value" class="ctx-item"
          :class="{ danger: item.danger, disabled: item.disabled }" @click.stop="onMenuClick(item)">
          {{ item.text }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { Graph, CanvasEvent, EdgeEvent, NodeEvent } from '@antv/g6'
import { ElMessage } from 'element-plus'

const containerRef = ref(null)
const wrapperRef = ref(null)
let graph = null

const COLOR = { person: '#f0a020', company: '#3b6fd4', account: '#3aa96f' }

/* ---------------- 数据集 ---------------- */

// 数据集一：资金网络（初始）
const DATASET_FUNDS = {
  name: '资金网络',
  nodes: [
    { id: 'p1', data: { label: '张某某', kind: 'person', note: '法人代表 · 持股 60%' } },
    { id: 'p2', data: { label: '李某某', kind: 'person', note: '财务负责人' } },
    { id: 'p3', data: { label: '王某某', kind: 'person', note: '关联股东' } },
    { id: 'c1', data: { label: 'A 贸易有限公司', kind: 'company', note: '注册资本 500 万 · 2019 年成立' } },
    { id: 'c2', data: { label: 'B 科技有限公司', kind: 'company', note: '注册资本 200 万 · 2021 年成立' } },
    { id: 'c3', data: { label: 'C 实业有限公司', kind: 'company', note: '注册资本 1000 万 · 与 A 共用注册地址' } },
    { id: 'a1', data: { label: '账户 ***6688', kind: 'account', note: '月流水约 300 万' } },
    { id: 'a2', data: { label: '账户 ***1024', kind: 'account', note: '月流水约 80 万' } }
  ],
  edges: [
    { id: 'e1', source: 'p1', target: 'c1', data: { label: '法人', note: '2019-03 至今' } },
    { id: 'e2', source: 'p2', target: 'c1', data: { label: '财务', note: '2020-01 至今' } },
    { id: 'e3', source: 'p3', target: 'c2', data: { label: '股东', note: '持股 35%' } },
    { id: 'e4', source: 'p1', target: 'c3', data: { label: '实际控制', note: '疑似，代持关系' } },
    { id: 'e5', source: 'c1', target: 'c2', data: { label: '大额往来', note: '近半年 12 笔' } },
    { id: 'e6', source: 'c2', target: 'c3', data: { label: '担保', note: '互保' } },
    { id: 'e7', source: 'c1', target: 'a1', data: { label: '收/付款', note: '对公主账户' } },
    { id: 'e8', source: 'c3', target: 'a1', data: { label: '收/付款', note: '共用收款账户' } },
    { id: 'e9', source: 'c2', target: 'a2', data: { label: '收/付款', note: '备用账户' } }
  ]
}

// 数据集二：股权穿透（"新建图谱"时使用）
const DATASET_EQUITY = {
  name: '股权穿透',
  nodes: [
    { id: 'p1', data: { label: '赵某某', kind: 'person', note: '实际控制人' } },
    { id: 'p2', data: { label: '钱某某', kind: 'person', note: '代持人' } },
    { id: 'c1', data: { label: '甲控股集团', kind: 'company', note: '注册资本 8000 万' } },
    { id: 'c2', data: { label: '乙投资有限公司', kind: 'company', note: '注册资本 2000 万' } },
    { id: 'c3', data: { label: '丙置地有限公司', kind: 'company', note: '注册资本 1.2 亿' } },
    { id: 'c4', data: { label: '丁咨询合伙企业', kind: 'company', note: '持股平台' } },
    { id: 'a1', data: { label: '账户 ***9955', kind: 'account', note: '验资账户' } }
  ],
  edges: [
    { id: 'e1', source: 'p1', target: 'c4', data: { label: 'GP 执行事务', note: '代持' } },
    { id: 'e2', source: 'p2', target: 'c4', data: { label: 'LP 出资', note: '名义出资人' } },
    { id: 'e3', source: 'c4', target: 'c2', data: { label: '持股 45%', note: '间接持股' } },
    { id: 'e4', source: 'c1', target: 'c2', data: { label: '控股 55%', note: '直接控股' } },
    { id: 'e5', source: 'c2', target: 'c3', data: { label: '全资子公司', note: '100%' } },
    { id: 'e6', source: 'c1', target: 'a1', data: { label: '验资', note: '2021-06' } }
  ]
}

// 二级关系池：模拟"后端按节点返回的关联数据"（下钻时按需取）
const DRILL_POOL = {
  p1: {
    nodes: [
      { id: 'p1-x1', data: { label: '孙某（亲属）', kind: 'person', note: '配偶 · A 公司挂名监事' } },
      { id: 'c1-x1', data: { label: 'D 商贸有限公司', kind: 'company', note: '张某某配偶持股 90%' } }
    ],
    edges: [
      { id: 'p1-x1-e1', source: 'p1', target: 'p1-x1', data: { label: '配偶' } },
      { id: 'p1-x1-e2', source: 'p1-x1', target: 'c1-x1', data: { label: '持股 90%' } },
      { id: 'p1-x1-e3', source: 'c1', target: 'c1-x1', data: { label: '大额往来', note: '近 3 个月 5 笔' } }
    ]
  },
  c1: {
    nodes: [
      { id: 'c1-x2', data: { label: 'E 供应链公司', kind: 'company', note: '同一实控人 · 疑似过桥' } },
      { id: 'a1-x1', data: { label: '账户 ***7731', kind: 'account', note: '与主账户同名' } }
    ],
    edges: [
      { id: 'c1-x2-e1', source: 'c1', target: 'c1-x2', data: { label: '资金过桥', note: '当日进当日出' } },
      { id: 'c1-x2-e2', source: 'c1', target: 'a1-x1', data: { label: '收/付款', note: '新增账户' } }
    ]
  },
  c2: {
    nodes: [
      { id: 'c2-x1', data: { label: 'F 数据服务公司', kind: 'company', note: 'B 公司全资子公司' } }
    ],
    edges: [
      { id: 'c2-x1-e1', source: 'c2', target: 'c2-x1', data: { label: '全资子公司' } }
    ]
  },
  p3: {
    nodes: [
      { id: 'p3-x1', data: { label: '吴某某', kind: 'person', note: '王某某堂弟 · C 公司出纳' } }
    ],
    edges: [
      { id: 'p3-x1-e1', source: 'p3', target: 'p3-x1', data: { label: '亲属' } },
      { id: 'p3-x1-e2', source: 'p3-x1', target: 'c3', data: { label: '出纳', note: '2018-05 至今' } }
    ]
  }
}

/* ---------------- 状态 ---------------- */

const nodes = ref([])
const edges = ref([])
const positions = ref({})       // id -> {x, y}，拖拽与增量布局共用
const drillChildren = ref({})   // parentId -> 下钻新增的子节点 id 数组
const collapsed = ref(new Set()) // 已下钻但被收起的节点
const drillAdded = ref(new Set()) // 下钻新增的节点 id（用于"删除"菜单）

const menu = reactive({ visible: false, x: 0, y: 0, items: [], ctxType: '', ctxId: '' })

/* ---------------- 布局 ---------------- */

// 分层布局（借鉴 BFS 分层思路）：按入度分层，层内垂直均分
function computeLayeredPositions(nodeList, edgeList) {
  const ids = new Set(nodeList.map((n) => n.id))
  const outMap = new Map(nodeList.map((n) => [n.id, []]))
  const indegree = new Map(nodeList.map((n) => [n.id, 0]))

  edgeList.forEach((e) => {
    if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) return
    outMap.get(e.source).push(e.target)
    indegree.set(e.target, indegree.get(e.target) + 1)
  })

  let roots = nodeList.filter((n) => indegree.get(n.id) === 0).map((n) => n.id)
  if (!roots.length && nodeList.length) roots = [nodeList[0].id]

  const levelMap = new Map()
  const queue = []
  roots.forEach((id) => { levelMap.set(id, 0); queue.push(id) })
  while (queue.length) {
    const id = queue.shift()
    const next = (levelMap.get(id) || 0) + 1
    ;(outMap.get(id) || []).forEach((t) => {
      if (levelMap.has(t)) return
      levelMap.set(t, next)
      queue.push(t)
    })
  }
  nodeList.forEach((n) => { if (!levelMap.has(n.id)) levelMap.set(n.id, 0) })

  const groups = new Map()
  nodeList.forEach((n) => {
    const lv = levelMap.get(n.id)
    if (!groups.has(lv)) groups.set(lv, [])
    groups.get(lv).push(n)
  })

  const levels = [...groups.keys()].sort((a, b) => a - b)
  const colGap = 280
  const rowGap = 110
  const maxRows = Math.max(1, ...levels.map((lv) => groups.get(lv).length))
  const totalHeight = (maxRows - 1) * rowGap
  const result = {}

  levels.forEach((lv) => {
    const list = groups.get(lv)
    const offset = (totalHeight - (list.length - 1) * rowGap) / 2
    list.forEach((n, i) => {
      result[n.id] = { x: 180 + lv * colGap, y: 170 + offset + i * rowGap }
    })
  })
  return result
}

// 新下钻的子节点围绕父节点扇形展开
function placeAround(parentId, childIds) {
  const base = positions.value[parentId] || { x: 240, y: 240 }
  const n = Math.max(1, childIds.length)
  const r = 150
  childIds.forEach((id, i) => {
    const angle = (Math.PI * 2 * i) / n + 0.7
    positions.value = { ...positions.value, [id]: {
      x: base.x + Math.cos(angle) * r,
      y: base.y + Math.sin(angle) * r * 0.8
    } }
  })
}

/* ---------------- 可见性（收起 = 隐藏子孙） ---------------- */

function hiddenIds() {
  const hidden = new Set()
  const hideDescendants = (pid) => {
    ;(drillChildren.value[pid] || []).forEach((cid) => {
      if (hidden.has(cid)) return
      hidden.add(cid)
      hideDescendants(cid)
    })
  }
  collapsed.value.forEach(hideDescendants)
  return hidden
}

/* ---------------- 渲染 ---------------- */

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function buildRenderData() {
  const hidden = hiddenIds()
  const visibleNodes = nodes.value.filter((n) => !hidden.has(n.id))
  const visibleEdges = edges.value.filter((e) => !hidden.has(e.source) && !hidden.has(e.target))

  return {
    nodes: visibleNodes.map((n) => {
      const pos = positions.value[n.id] || { x: 200, y: 200 }
      const hiddenCount = collapsed.value.has(n.id) ? (drillChildren.value[n.id] || []).length : 0
      return {
        id: n.id,
        data: n.data,
        style: {
          x: pos.x,
          y: pos.y,
          size: n.data.kind === 'company' ? 36 : 28,
          fill: COLOR[n.data.kind] || '#8a94ad',
          stroke: cssVar('--surface'),
          lineWidth: 2,
          labelText: n.data.label,
          labelFontSize: 11,
          labelFill: cssVar('--text-1'),
          labelPlacement: 'bottom',
          labelBackground: true,
          labelBackgroundFill: cssVar('--surface') || '#fff',
          labelBackgroundOpacity: 0.85,
          labelBackgroundRadius: 4,
          labelPadding: [1, 4],
          badges: hiddenCount
            ? [{
                text: `+${hiddenCount}`,
                placement: 'right-top',
                backgroundFill: '#f59e0b',
                fill: '#fff',
                fontSize: 10,
                padding: [1, 5],
                backgroundRadius: 8
              }]
            : [],
          cursor: 'pointer'
        }
      }
    }),
    edges: visibleEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      data: e.data,
      style: {
        stroke: cssVar('--text-3') || '#b9c4d8',
        lineWidth: 1.4,
        endArrow: true,
        endArrowSize: 6,
        labelText: e.data.label,
        labelFontSize: 10,
        labelFill: cssVar('--text-2'),
        labelBackground: true,
        labelBackgroundFill: cssVar('--surface') || '#fff',
        labelBackgroundOpacity: 0.85,
        labelBackgroundRadius: 3,
        labelPadding: [0, 3]
      }
    }))
  }
}

async function syncGraph({ fit = false } = {}) {
  if (!graph) return
  graph.setData(buildRenderData())
  await graph.render()
  if (fit) await graph.fitView()
}

/* ---------------- 下钻 / 收起 ---------------- */

async function drillNode(id) {
  if (collapsed.value.has(id)) {
    // 已下钻但收起 → 展开
    const next = new Set(collapsed.value)
    next.delete(id)
    collapsed.value = next
    await syncGraph()
    return
  }
  if (expandedLoaded(id)) {
    ElMessage.info('该节点关联已全部展示')
    return
  }
  const pool = DRILL_POOL[id]
  if (!pool) {
    ElMessage.info('该节点暂无更多关联数据')
    return
  }

  const loading = ElMessage({ message: '正在查询二级关联…', type: 'info', duration: 0 })
  // 模拟异步请求（真实场景为接口返回二级关系）
  await new Promise((r) => setTimeout(r, 600))
  loading.close()

  // 增量去重（借鉴公司源码 addNodes/addLinks：已存在的不重复添加）
  const newNodes = pool.nodes.filter((n) => !nodes.value.some((x) => x.id === n.id))
  const newEdges = pool.edges.filter((e) => !edges.value.some((x) => x.id === e.id))
  nodes.value = [...nodes.value, ...newNodes.map((n) => ({ ...n, drill: true }))]
  edges.value = [...edges.value, ...newEdges]
  newNodes.forEach((n) => drillAdded.value.add(n.id))

  placeAround(id, newNodes.map((n) => n.id))
  drillChildren.value = { ...drillChildren.value, [id]: newNodes.map((n) => n.id) }

  await syncGraph({ fit: true })
  ElMessage.success(`已展开 ${newNodes.length} 个关联节点`)
}

function expandedLoaded(id) {
  return Boolean(drillChildren.value[id]?.length)
}

async function collapseNode(id) {
  if (!expandedLoaded(id)) return
  const next = new Set(collapsed.value)
  next.add(id)
  collapsed.value = next
  await syncGraph()
}

async function removeNode(id) {
  if (!drillAdded.value.has(id)) return
  // 同时清理引用它的边与其父节点的 drillChildren 记录
  nodes.value = nodes.value.filter((n) => n.id !== id)
  edges.value = edges.value.filter((e) => e.source !== id && e.target !== id)
  drillAdded.value.delete(id)
  Object.keys(drillChildren.value).forEach((pid) => {
    drillChildren.value[pid] = drillChildren.value[pid].filter((cid) => cid !== id)
  })
  await syncGraph()
  ElMessage.success('节点已删除')
}

/* ---------------- 新建图谱 / 重置 ---------------- */

async function loadDataset(ds) {
  nodes.value = ds.nodes.map((n) => ({ ...n }))
  edges.value = ds.edges.map((e) => ({ ...e }))
  positions.value = computeLayeredPositions(nodes.value, edges.value)
  drillChildren.value = {}
  collapsed.value = new Set()
  drillAdded.value = new Set()
  await syncGraph({ fit: true })
}

const resetGraph = () => loadDataset(DATASET_FUNDS)
const newGraph = () => loadDataset(DATASET_EQUITY)

/* ---------------- 右键菜单 ---------------- */

function openMenu(clientX, clientY, ctxType, ctxId) {
  const items = []
  if (ctxType === 'node') {
    const loaded = expandedLoaded(ctxId)
    const hasPool = Boolean(DRILL_POOL[ctxId])
    items.push({ value: 'drill', text: collapsed.value.has(ctxId) ? '展开关联' : '下钻二级关系', disabled: loaded && !hasPool })
    if (loaded) items.push({ value: 'collapse', text: '收起关联' })
    items.push({ value: 'detail', text: '查看详情' })
    items.push({ value: 'remove', text: '删除节点', danger: true, disabled: !drillAdded.value.has(ctxId) })
  } else {
    items.push({ value: 'new', text: '新建图谱（切换数据集）' })
    items.push({ value: 'reset', text: '恢复初始图谱' })
    items.push({ value: 'fit', text: '适配画布' })
    items.push({ value: 'snapshot', text: '导出快照' })
  }
  menu.ctxType = ctxType
  menu.ctxId = ctxId
  menu.items = items
  menu.x = clientX
  menu.y = clientY
  menu.visible = true
}

function closeMenu() { menu.visible = false }

function onMenuClick(item) {
  if (item.disabled) return
  closeMenu()
  const { ctxType, ctxId } = menu
  switch (item.value) {
    case 'drill': return drillNode(ctxId)
    case 'collapse': return collapseNode(ctxId)
    case 'detail': {
      const n = nodes.value.find((x) => x.id === ctxId)
      if (n) ElMessage({ message: `${n.data.label}：${n.data.note || '暂无备注'}`, type: 'info' })
      return
    }
    case 'remove': return removeNode(ctxId)
    case 'new': return newGraph()
    case 'reset': return resetGraph()
    case 'fit': return fit()
    case 'snapshot': return snapshot()
  }
}

/* ---------------- 事件绑定 ---------------- */

function bindEvents() {
  graph.on(NodeEvent.DBLCLICK, (event) => {
    const id = event.target?.id
    if (id) drillNode(id)
  })

  graph.on(NodeEvent.CONTEXT_MENU, (event) => {
    const id = event.target?.id
    if (!id) return
    openMenu(event.client.x + 4, event.client.y + 4, 'node', id)
  })

  graph.on(EdgeEvent.CONTEXT_MENU, (event) => {
    if (event.client) openMenu(event.client.x + 4, event.client.y + 4, 'canvas', '')
  })

  graph.on(CanvasEvent.CONTEXT_MENU, (event) => {
    if (event.client) openMenu(event.client.x + 4, event.client.y + 4, 'canvas', '')
  })

  graph.on(CanvasEvent.CLICK, closeMenu)

  // 拖拽结束保存坐标（借鉴公司源码：位置持久化，增量渲染不抖动）
  graph.on(NodeEvent.DRAG_END, (event) => {
    const id = event.target?.id
    if (!id || !graph) return
    const d = graph.getNodeData(id)
    const x = d?.style?.x
    const y = d?.style?.y
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    positions.value = { ...positions.value, [id]: { x, y } }
  })
}

/* ---------------- 生命周期 ---------------- */

let themeObserver = null

onMounted(async () => {
  nodes.value = DATASET_FUNDS.nodes.map((n) => ({ ...n }))
  edges.value = DATASET_FUNDS.edges.map((e) => ({ ...e }))
  positions.value = computeLayeredPositions(nodes.value, edges.value)

  graph = new Graph({
    container: containerRef.value,
    autoFit: 'view',
    padding: 40,
    animation: false,
    zoomRange: [0.2, 3],
    data: { nodes: [], edges: [] },
    node: {
      state: {
        selected: { lineWidth: 3, halo: true, haloLineWidth: 5, haloStrokeOpacity: 0.25 }
      }
    },
    edge: { type: 'quadratic', style: { curveOffset: 0 } },
    // 布局由本地坐标接管（分层初始 + 拖拽持久化 + 增量扇形放置），保证下钻/收起时老节点不跳位
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element']
  })

  bindEvents()
  await syncGraph({ fit: true })

  // 暗黑模式切换时重绘
  themeObserver = new MutationObserver(() => syncGraph())
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => {
  themeObserver?.disconnect()
  graph?.destroy?.()
  graph = null
})

const fit = () => graph?.fitView?.()

const snapshot = () => {
  try {
    const url = graph.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `graph-snapshot-${Date.now()}.png`
    a.click()
    ElMessage.success('已导出快照')
  } catch (e) {
    ElMessage.error('导出失败：' + e.message)
  }
}
</script>

<style scoped>
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
.tip { margin-bottom: 12px; }
.toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.legend { margin-left: auto; font-size: 12px; color: var(--text-2); display: flex; align-items: center; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

.canvas-wrap { position: relative; }
.canvas { height: 560px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); }

/* 右键菜单 */
.ctx-menu {
  position: fixed;
  z-index: 2000;
  min-width: 150px;
  padding: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow);
}
.ctx-item {
  padding: 7px 12px;
  font-size: 12.5px;
  color: var(--text-1);
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
}
.ctx-item:hover { background: var(--brand-weak); }
.ctx-item.danger { color: var(--danger); }
.ctx-item.disabled { color: var(--text-3); cursor: not-allowed; }
.ctx-item.disabled:hover { background: transparent; }

:global(.g6-tip) { font-size: 12px; line-height: 1.6; }
</style>
