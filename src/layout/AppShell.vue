<template>
  <div class="shell">
    <!-- 侧边导航 -->
    <aside class="sidebar">
      <div class="brand">
        <div class="logo">AI</div>
        <span class="brand-name">智研工作台</span>
      </div>

      <nav class="nav">
        <button
          v-for="item in menus"
          :key="item.key"
          class="nav-item"
          :class="{ active: modelValue === item.key }"
          @click="$emit('update:modelValue', item.key)"
        >
          <el-icon :size="16"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <a href="https://github.com/wanghui0520/vue-frontend-showcase" target="_blank" class="repo-link">
          <el-icon :size="14"><Link /></el-icon>
          <span>GitHub 源码</span>
        </a>
      </div>
    </aside>

    <!-- 主区域 -->
    <div class="main">
      <header class="topbar">
        <div class="topbar-title">
          <span class="crumb">{{ currentLabel }}</span>
          <span v-if="currentDesc" class="crumb-desc">{{ currentDesc }}</span>
        </div>
        <div class="topbar-actions">
          <el-tooltip content="亮 / 暗主题切换" placement="bottom">
            <button class="icon-btn" @click="toggleTheme">
              <el-icon :size="16"><component :is="dark ? 'Sunny' : 'Moon'" /></el-icon>
            </button>
          </el-tooltip>
          <el-dropdown @command="onCommand">
            <span class="user-chip">
              <el-avatar :size="26" class="avatar">{{ initial }}</el-avatar>
              <span class="username">{{ username }}</span>
              <el-icon :size="12"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  ChatDotRound, Grid, Odometer, Share, EditPen, User as UserIcon,
  ArrowDown, SwitchButton, Link, Sunny, Moon
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getUsername, logout } from '../auth'

const props = defineProps({
  modelValue: { type: String, required: true },
  menus: { type: Array, required: true }
})
const emit = defineEmits(['update:modelValue', 'logout'])

const dark = ref(document.documentElement.classList.contains('dark'))
const username = computed(() => getUsername())
const initial = computed(() => username.value.slice(0, 1).toUpperCase())
const current = computed(() => props.menus.find((m) => m.key === props.modelValue))
const currentLabel = computed(() => current.value?.label || '')
const currentDesc = computed(() => current.value?.desc || '')

function toggleTheme() {
  dark.value = !dark.value
  document.documentElement.classList.toggle('dark', dark.value)
  localStorage.setItem('showcase_theme', dark.value ? 'dark' : 'light')
}

function onCommand(cmd) {
  if (cmd === 'logout') {
    logout()
    ElMessage.success('已退出登录')
    emit('logout')
  }
}
</script>

<style scoped>
.shell { display: flex; min-height: 100vh; }

/* ---------- 侧边栏 ---------- */
.sidebar {
  width: 216px;
  flex-shrink: 0;
  background: var(--bg-sidebar);
  display: flex;
  flex-direction: column;
  padding: 18px 12px;
  position: sticky;
  top: 0;
  height: 100vh;
}

.brand { display: flex; align-items: center; gap: 10px; padding: 0 8px 18px; }
.logo {
  width: 34px; height: 34px; border-radius: 9px;
  background: var(--brand-gradient);
  color: #fff; font-weight: 800; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
}
.brand-name { color: #fff; font-weight: 700; font-size: 15px; letter-spacing: 1px; }

.nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }

.nav-item {
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 0; border-radius: 8px;
  background: transparent;
  color: var(--sidebar-text);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.nav-item:hover { background: rgba(255, 255, 255, 0.07); color: var(--sidebar-text-active); }
.nav-item.active {
  background: var(--brand-gradient);
  color: #fff;
  font-weight: 600;
}

.sidebar-footer { border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 12px; }
.repo-link {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  color: var(--sidebar-text);
  font-size: 12px;
  text-decoration: none;
  border-radius: 8px;
}
.repo-link:hover { color: #fff; background: rgba(255, 255, 255, 0.07); }

/* ---------- 顶栏 ---------- */
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 10;
}
.topbar-title { display: flex; align-items: baseline; gap: 10px; }
.crumb { font-size: 15px; font-weight: 700; }
.crumb-desc { font-size: 12px; color: var(--text-3); }

.topbar-actions { display: flex; align-items: center; gap: 10px; }

.icon-btn {
  width: 32px; height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.icon-btn:hover { color: var(--brand); border-color: var(--brand); }

.user-chip {
  display: flex; align-items: center; gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
}
.user-chip:hover { background: var(--surface-2); }
.avatar { background: var(--brand-gradient); color: #fff; font-size: 12px; }
.username { font-size: 13px; color: var(--text-1); }

.content { flex: 1; }
</style>
