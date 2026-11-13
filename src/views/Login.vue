<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <div class="logo">AI</div>
        <div>
          <h1>智研工作台</h1>
          <p>AI 应用前端工程能力展示</p>
        </div>
      </div>

      <el-form @submit.prevent="onSubmit">
        <el-form-item>
          <el-input v-model="username" placeholder="账号（任意）" size="large" @keyup.enter="onSubmit">
            <template #prefix><el-icon><User /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-input v-model="password" type="password" placeholder="密码（任意）" size="large" show-password @keyup.enter="onSubmit">
            <template #prefix><el-icon><Lock /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-button type="primary" size="large" class="submit" :loading="loading" @click="onSubmit">
          {{ loading ? '登录中…' : '登 录' }}
        </el-button>
      </el-form>

      <p class="tip">演示项目：任意账号密码即可登录，鉴权为前端 mock（真实项目由后端签发 JWT）</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { User, Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { login } from '../auth'

const emit = defineEmits(['success'])
const username = ref('demo')
const password = ref('')
const loading = ref(false)

function onSubmit() {
  if (!username.value.trim()) { ElMessage.warning('请输入账号'); return }
  loading.value = true
  // 模拟请求延迟，便于展示 loading 态
  setTimeout(() => {
    login(username.value.trim())
    ElMessage.success('登录成功')
    emit('success')
  }, 600)
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(800px 400px at 20% 0%, rgba(47, 91, 255, 0.14), transparent),
    radial-gradient(700px 380px at 90% 100%, rgba(123, 61, 255, 0.12), transparent),
    var(--bg);
  padding: 24px;
}

.login-card {
  width: 380px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  padding: 36px 32px 24px;
}

.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }

.logo {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: var(--brand-gradient);
  color: #fff;
  font-weight: 800;
  font-size: 18px;
  display: flex; align-items: center; justify-content: center;
}

.brand h1 { font-size: 18px; margin: 0; }
.brand p { font-size: 12px; color: var(--text-3); margin: 3px 0 0; }

.submit { width: 100%; margin-top: 4px; }

.tip { font-size: 12px; color: var(--text-3); text-align: center; margin: 16px 0 0; line-height: 1.6; }
</style>
