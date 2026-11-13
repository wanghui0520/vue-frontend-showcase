/**
 * AI 对话接口（展示版，对接 mock 流式服务）
 * 多协议兼容解析层：
 * - AIMessageChunk：content 为字符串或 [{ text }] 数组，文本可能在 kwargs.content
 * - 工具调用：tool_calls 中的 AgentOutput.args.answer
 * - 文本形态：content 字符串内 answer='...' 的解析
 */
import { createStreamClient } from './requestStream'

const { streamRequest } = createStreamClient({ baseURL: '' })

/* ---------------- chunk 文本抽取 ---------------- */

/** 兼容 content: string | [{ text }] | [{ content }] */
function textFromContent(content) {
  if (typeof content === 'string' && content) return content
  if (!Array.isArray(content)) return null
  const parts = content
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        if (typeof item.text === 'string') return item.text
        if (typeof item.content === 'string') return item.content
      }
      return ''
    })
    .join('')
  return parts || null
}

/** 从 chunk 对象的任意位置取文本（顶层 content → kwargs.content） */
export function getChunkText(chunk) {
  if (!chunk || typeof chunk !== 'object') return null
  const direct = textFromContent(chunk.content)
  if (direct) return direct
  if (chunk.kwargs && typeof chunk.kwargs === 'object') {
    const nested = textFromContent(chunk.kwargs.content)
    if (nested) return nested
  }
  return null
}

/* ---------------- AgentOutput.answer 提取 ---------------- */

/** 从 content 字符串解析 answer='...'（截取到下一个已知字段） */
function answerFromText(content) {
  if (typeof content !== 'string' || !content) return null
  const marker = "answer='"
  const start = content.indexOf(marker)
  if (start === -1) return null
  const from = start + marker.length
  let end = -1
  for (const term of ["' data=", "' status=", "' files="]) {
    const i = content.indexOf(term, from)
    if (i !== -1 && (end === -1 || i < end)) end = i
  }
  if (end === -1) end = content.lastIndexOf("'")
  if (end <= from) return null
  return content.slice(from, end).replace(/\\n/g, '\n')
}

/** 从 tool_calls 提取 AgentOutput.args.answer（忽略仍有 chunks 的半成品） */
function answerFromToolCalls(chunk) {
  if (!chunk?.tool_calls?.length) return null
  const pending = Array.isArray(chunk.tool_call_chunks) ? chunk.tool_call_chunks.length > 0 : !!chunk.tool_call_chunks
  if (pending) return null
  for (const call of chunk.tool_calls) {
    if (call?.name !== 'AgentOutput') continue
    let args = call.args
    if (typeof args === 'string') {
      try { args = JSON.parse(args) } catch { continue }
    }
    if (args && typeof args === 'object' && 'answer' in args) return args.answer
  }
  return null
}

/** 噪声工具调用过滤（不作为「思考过程」展示） */
function isNoiseTool(chunk) {
  if (chunk?.type !== 'tool') return true
  if (chunk.name === 'AgentOutput' || chunk.name === 'write_todos') return true
  if (/was cancelled/i.test(getChunkText(chunk) || '')) return true
  return false
}

/* ---------------- 对外接口 ---------------- */

/**
 * 流式对话
 * @param {{message: string}} data
 * @param {(delta: {text?: string, thinking?: {label:string, content:string}, replace?: string}) => void} onDelta
 * @param {(result: {hasAnswer: boolean}) => void} onComplete
 * @param {(err: Error) => void} onError
 */
export function chatStream(data, onDelta, onComplete, onError) {
  const controller = new AbortController()
  let seenAnswer = false
  let finished = false

  const finish = (payload) => {
    if (finished) return
    finished = true
    onComplete?.({ hasAnswer: seenAnswer, ...payload })
  }

  streamRequest(
    '/api/chat/stream',
    data,
    ({ event, data: chunk }) => {
      if (event === 'error') {
        onError?.(new Error(typeof chunk === 'string' ? chunk : 'AI 服务错误'))
        return
      }
      if (event === 'end') {
        finish({ event: 'end' })
        return
      }

      // 1) 思考过程：有效的工具调用事件
      if (!isNoiseTool(chunk)) {
        let text = String(getChunkText(chunk) || '').replace(/\\n/g, '\n')
        if (chunk.name === 's3_public_url' && /^https?:\/\/\S+$/.test(text.trim())) {
          text = `[${text.trim()}](${text.trim()})`
        }
        onDelta?.({ thinking: { label: chunk.name, content: text } })
      }

      // 2) 流式正文（AIMessageChunk）
      if (!chunk?.type || chunk.type === 'AIMessageChunk' || chunk.type === 'ai') {
        const text = getChunkText(chunk)
        if (text) {
          seenAnswer = true
          onDelta?.({ text })
        }
      }

      // 3) 最终完整答案（tool_calls 形态 / answer='...' 文本形态）
      const answer = answerFromToolCalls(chunk) ?? (chunk?.type === 'tool' && chunk?.name === 'AgentOutput' ? answerFromText(chunk.content) : null)
      if (answer != null && !seenAnswer) {
        seenAnswer = true
        onDelta?.({ replace: answer })
      }
    },
    () => finish({ event: 'done' }),
    (error) => {
      onError?.(error)
      finished = true
    },
    { signal: controller.signal }
  )

  return { abort: () => controller.abort() }
}
