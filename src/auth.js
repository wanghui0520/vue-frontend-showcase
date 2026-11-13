/**
 * 极简鉴权（展示用）：localStorage 持久化登录态
 * 真实项目中 token 由后端签发、走请求拦截器统一携带与刷新
 */

const KEY = 'showcase_token'
const USER_KEY = 'showcase_user'

export function isLoggedIn() {
  return !!localStorage.getItem(KEY)
}

export function login(username) {
  // mock：直接签发一个演示 token（真实项目由后端返回 JWT）
  localStorage.setItem(KEY, 'demo-' + Math.random().toString(36).slice(2))
  localStorage.setItem(USER_KEY, username)
}

export function logout() {
  localStorage.removeItem(KEY)
  localStorage.removeItem(USER_KEY)
}

export function getUsername() {
  return localStorage.getItem(USER_KEY) || 'demo'
}
