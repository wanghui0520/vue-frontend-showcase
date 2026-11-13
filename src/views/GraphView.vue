<template>
  <div class="panel">
    <el-alert type="info" :closable="false" show-icon class="tip"
      title="演示：人物—企业—资金关系网络图谱（力导向布局 / 拖拽 / 缩放 / Tooltip / 快照导出）。可拖动节点，悬停查看详情。" />

    <div class="toolbar">
      <el-button size="small" @click="fit">适配画布</el-button>
      <el-button size="small" @click="snapshot">导出快照 PNG</el-button>
      <el-button size="small" @click="relayout">重新布局</el-button>
      <span class="legend">
        <i class="dot" style="background:#f0a020"></i>人物
        <i class="dot" style="background:#3b6fd4"></i>企业
        <i class="dot" style="background:#3aa96f"></i>资金账户
      </span>
    </div>

    <div ref="containerRef" class="canvas"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Graph } from '@antv/g6'
import { ElMessage } from 'element-plus'

const containerRef = ref(null)
let graph = null

const COLOR = { person: '#f0a020', company: '#3b6fd4', account: '#3aa96f' }

const data = {
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

onMounted(async () => {
  graph = new Graph({
    container: containerRef.value,
    autoFit: 'view',
    padding: 20,
    data,
    node: {
      style: {
        size: (d) => (d.data.kind === 'company' ? 34 : 26),
        fill: (d) => COLOR[d.data.kind] || '#8a94ad',
        stroke: '#ffffff',
        lineWidth: 2,
        labelText: (d) => d.data.label,
        labelFontSize: 11,
        labelFill: '#333',
        labelPlacement: 'bottom',
        labelBackground: true,
        labelBackgroundFill: 'rgba(255,255,255,0.75)',
        labelBackgroundRadius: 4,
        labelPadding: [1, 4]
      }
    },
    edge: {
      style: {
        stroke: '#b9c4d8',
        lineWidth: 1.4,
        labelText: (d) => d.data.label,
        labelFontSize: 10,
        labelFill: '#67718c',
        labelBackground: true,
        labelBackgroundFill: 'rgba(255,255,255,0.8)',
        labelBackgroundRadius: 3,
        labelPadding: [0, 3]
      }
    },
    layout: { type: 'force', linkDistance: 130, nodeStrength: 260, preventOverlap: true },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
    plugins: [
      {
        type: 'tooltip',
        getContent: (event) => {
          const d = event?.target?.data || event?.target?._model?.data
          if (!d) return ''
          const rows = [
            `<b>${d.label || ''}</b>`,
            d.note ? `说明：${d.note}` : ''
          ].filter(Boolean)
          return `<div class="g6-tip">${rows.join('<br/>')}</div>`
        }
      }
    ]
  })

  await graph.render()
})

onBeforeUnmount(() => {
  graph?.destroy?.()
})

const fit = () => graph?.fitView?.()
const relayout = () => graph?.layout?.() || graph?.render?.()

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
.panel { background: #fff; border: 1px solid #e3e8f4; border-radius: 10px; padding: 14px; }
.tip { margin-bottom: 12px; }
.toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.legend { margin-left: auto; font-size: 12px; color: #667; display: flex; align-items: center; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.canvas { height: 560px; border: 1px solid #eef1f7; border-radius: 8px; background: #fafbff; }
:global(.g6-tip) { font-size: 12px; line-height: 1.6; }
</style>
