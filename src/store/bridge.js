/**
 * 跨页面桥接：页面切换 + 带上下文跳转 AI 对话
 *
 * 对应真实项目里的「路由感知 Prompt 前缀」机制：
 * 业务页把上下文（任务号 / 订单号 / 选中行摘要）拼成前缀，
 * 跳转到 AI 时自动带入，用户不需要手动复制粘贴。
 */
import { ref } from 'vue'

export const activePage = ref('dashboard')

/** 待注入到 AI 输入框的 Prompt（消费后置空） */
export const pendingPrompt = ref('')

export function goTo(page) {
  activePage.value = page
}

export function goToChatWithPrompt(text) {
  pendingPrompt.value = text
  activePage.value = 'chat'
}
