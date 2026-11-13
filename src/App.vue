<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">Vue 前端工程能力展示</div>
      <nav class="tabs">
        <button v-for="t in tabs" :key="t.key" class="tab" :class="{ active: active === t.key }" @click="active = t.key">
          {{ t.label }}
        </button>
      </nav>
      <a class="repo" href="https://github.com/wanghui0520/vue-frontend-showcase" target="_blank">GitHub →</a>
    </header>

    <main class="content">
      <KeepAlive>
        <SseChat v-if="active === 'chat'" />
        <EditableTable v-else-if="active === 'table'" />
        <GraphView v-else-if="active === 'graph'" />
      </KeepAlive>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SseChat from './views/SseChat.vue'
import EditableTable from './views/EditableTable.vue'
import GraphView from './views/GraphView.vue'

const tabs = [
  { key: 'chat', label: '① SSE 流式对话' },
  { key: 'table', label: '② 可编辑表格 + 字典缓存' },
  { key: 'graph', label: '③ 关系图谱（AntV G6）' }
]
const active = ref('chat')
</script>

<style>
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Microsoft YaHei', sans-serif; background: #f4f6fa; color: #222; }
.app { max-width: 1080px; margin: 0 auto; padding: 16px; }
.topbar { display: flex; align-items: center; gap: 18px; padding: 10px 4px; }
.brand { font-size: 17px; font-weight: 700; color: #14315c; }
.tabs { display: flex; gap: 8px; flex: 1; }
.tab { border: 1px solid #d7dceb; background: #fff; padding: 7px 14px; border-radius: 18px; cursor: pointer; font-size: 13px; }
.tab.active { background: #14315c; color: #fff; border-color: #14315c; }
.repo { font-size: 13px; color: #14315c; }
.content { margin-top: 8px; }
</style>
