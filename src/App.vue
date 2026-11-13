<template>
  <!-- 登录门 -->
  <Login v-if="!loggedIn" @success="loggedIn = true" />

  <!-- 主应用 -->
  <AppShell v-else v-model="active" :menus="menus" @logout="loggedIn = false">
    <KeepAlive>
      <Dashboard v-if="active === 'dashboard'" />
      <SseChat v-else-if="active === 'chat'" />
      <ExtractWorkbench v-else-if="active === 'extract'" />
      <AgentFlow v-else-if="active === 'agent'" />
      <EditableTable v-else-if="active === 'table'" />
      <GraphView v-else-if="active === 'graph'" />
    </KeepAlive>
  </AppShell>
</template>

<script setup>
import { ref } from 'vue'
import { isLoggedIn } from './auth'
import { Odometer, ChatDotRound, EditPen, Share, Grid, Connection } from '@element-plus/icons-vue'
import AppShell from './layout/AppShell.vue'
import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'
import SseChat from './views/SseChat.vue'
import ExtractWorkbench from './views/ExtractWorkbench.vue'
import AgentFlow from './views/AgentFlow.vue'
import EditableTable from './views/EditableTable.vue'
import GraphView from './views/GraphView.vue'

// 恢复上次选择的主题
if (localStorage.getItem('showcase_theme') === 'dark') {
  document.documentElement.classList.add('dark')
}

const loggedIn = ref(isLoggedIn())
const active = ref('dashboard')

const menus = [
  { key: 'dashboard', label: '数据面板', icon: Odometer, desc: 'AI 调用量与任务总览' },
  { key: 'chat', label: 'AI 流式对话', icon: ChatDotRound, desc: 'SSE 流式客户端 + 多协议解析 + CoT 可视化' },
  { key: 'extract', label: 'AI 数据提取', icon: EditPen, desc: '非结构化文本 → 结构化字段 → 人工兜底 → 导出' },
  { key: 'agent', label: 'Agent 执行可视化', icon: Share, desc: '思考 / 工具调用 / 重试链路实时呈现' },
  { key: 'table', label: '可编辑表格', icon: Grid, desc: 'useTable hooks + 字典双层缓存' },
  { key: 'graph', label: '关系图谱', icon: Connection, desc: 'AntV G6 力导向布局 + 快照导出' }
]
</script>
