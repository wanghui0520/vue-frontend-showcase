<template>
  <div class="page">
    <div class="stat-grid">
      <div v-for="s in stats" :key="s.label" class="card stat">
        <div class="stat-label">{{ s.label }}</div>
        <div class="stat-value">{{ s.value }}</div>
        <div class="stat-delta" :class="s.up ? 'up' : 'down'">
          {{ s.up ? '↑' : '↓' }} {{ s.delta }} 较上周
        </div>
      </div>
    </div>

    <div class="chart-row">
      <div class="card chart-card">
        <h3 class="card-title">AI 调用量趋势（近 14 天）</h3>
        <div ref="trendRef" class="chart"></div>
      </div>
      <div class="card chart-card">
        <h3 class="card-title">功能使用占比</h3>
        <div ref="pieRef" class="chart"></div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">最近任务</h3>
      <el-table :data="tasks" size="default" :header-cell-style="headerStyle">
        <el-table-column prop="name" label="任务名称" min-width="180" />
        <el-table-column prop="type" label="类型" width="140">
          <template #default="{ row }">
            <el-tag :type="row.tagType" size="small" effect="light">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <span class="status" :class="row.statusClass">
              <i class="dot"></i>{{ row.status }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="time" label="耗时" width="100" />
        <el-table-column prop="date" label="时间" width="160" />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as echarts from 'echarts'

const headerStyle = { background: 'var(--surface-2)', color: 'var(--text-2)' }

const stats = [
  { label: 'AI 调用次数', value: '12,847', delta: '18.2%', up: true },
  { label: '流式会话数', value: '1,532', delta: '9.4%', up: true },
  { label: '字段抽取准确率', value: '96.3%', delta: '1.1%', up: true },
  { label: '平均响应耗时', value: '1.8s', delta: '0.3s', up: false }
]

const tasks = [
  { name: '资金流水批量结构化', type: '数据提取', tagType: 'primary', status: '已完成', statusClass: 'ok', time: '4.2s', date: '2026-11-13 15:20' },
  { name: '线索关联图谱分析', type: 'Agent 任务', tagType: 'warning', status: '执行中', statusClass: 'run', time: '—', date: '2026-11-13 15:18' },
  { name: '研判报告智能生成', type: 'Agent 任务', tagType: 'warning', status: '已完成', statusClass: 'ok', time: '12.6s', date: '2026-11-13 14:52' },
  { name: '知识库问答（资金合规）', type: 'RAG 问答', tagType: 'success', status: '已完成', statusClass: 'ok', time: '2.1s', date: '2026-11-13 14:31' },
  { name: '合同要素抽取', type: '数据提取', tagType: 'primary', status: '失败重试', statusClass: 'fail', time: '6.8s', date: '2026-11-13 14:02' }
]

/* ---------- ECharts（暗色切换时重绘） ---------- */
const trendRef = ref(null)
const pieRef = ref(null)
let charts = []
let observer = null

function render() {
  const isDark = document.documentElement.classList.contains('dark')
  const axis = isDark ? '#6b7288' : '#9096a8'
  const split = isDark ? '#262c3a' : '#e5e9f2'

  charts.forEach((c) => c.dispose())
  charts = []

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000)
    return `${d.getMonth() + 1}/${d.getDate()}`
  })
  const chat = [320, 412, 386, 505, 468, 590, 634, 588, 672, 710, 695, 748, 812, 864]
  const extract = [80, 95, 110, 128, 150, 162, 190, 210, 232, 260, 275, 310, 338, 372]

  const trend = echarts.init(trendRef.value)
  trend.setOption({
    backgroundColor: 'transparent',
    grid: { left: 40, right: 16, top: 30, bottom: 28 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, textStyle: { color: axis, fontSize: 11 }, itemWidth: 14 },
    xAxis: { type: 'category', data: days, axisLine: { lineStyle: { color: split } }, axisLabel: { color: axis, fontSize: 10 } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: split } }, axisLabel: { color: axis, fontSize: 10 } },
    series: [
      { name: '流式对话', type: 'line', smooth: true, data: chat, symbol: 'none',
        lineStyle: { width: 2.5, color: '#2f5bff' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(47,91,255,0.28)' }, { offset: 1, color: 'rgba(47,91,255,0)' }
        ]) } },
      { name: '字段抽取', type: 'line', smooth: true, data: extract, symbol: 'none',
        lineStyle: { width: 2.5, color: '#10b981' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(16,185,129,0.24)' }, { offset: 1, color: 'rgba(16,185,129,0)' }
        ]) } }
    ]
  })
  charts.push(trend)

  const pie = echarts.init(pieRef.value)
  pie.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: axis, fontSize: 11 }, itemWidth: 14 },
    series: [{
      type: 'pie', radius: ['52%', '74%'], center: ['50%', '44%'],
      itemStyle: { borderRadius: 6, borderColor: 'transparent', borderWidth: 2 },
      label: { show: false },
      data: [
        { value: 8640, name: '流式对话', itemStyle: { color: '#2f5bff' } },
        { value: 2456, name: '字段抽取', itemStyle: { color: '#10b981' } },
        { value: 1180, name: 'Agent 任务', itemStyle: { color: '#f59e0b' } },
        { value: 571, name: 'RAG 问答', itemStyle: { color: '#7b3dff' } }
      ]
    }]
  })
  charts.push(pie)
}

onMounted(() => {
  render()
  // 主题切换（html.dark 变化）时重绘，保证图表配色与主题一致
  observer = new MutationObserver(render)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  window.addEventListener('resize', render)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', render)
  charts.forEach((c) => c.dispose())
})
</script>

<style scoped>
.chart-row { display: grid; grid-template-columns: 1.6fr 1fr; gap: 14px; margin: 14px 0; }
@media (max-width: 900px) { .chart-row { grid-template-columns: 1fr; } }

.chart { height: 280px; }

.status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
.dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.status.ok { color: var(--ok); } .status.ok .dot { background: var(--ok); }
.status.run { color: var(--brand); } .status.run .dot { background: var(--brand); animation: blink 1.2s infinite; }
.status.fail { color: var(--danger); } .status.fail .dot { background: var(--danger); }

@keyframes blink { 50% { opacity: 0.3; } }
</style>
