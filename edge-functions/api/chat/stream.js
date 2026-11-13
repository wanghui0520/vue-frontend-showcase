/**
 * EdgeOne Pages Edge Function：AI 流式接口（国内线路用）
 * 与 api/chat.js（Vercel 版）、vite.config.js 的 mockSsePlugin 输出完全相同的协议。
 * 路由：edge-functions/api/chat/stream.js -> POST /api/chat/stream
 * 运行时为 V8 Edge Runtime，使用 Web 标准 API（ReadableStream / TextEncoder）。
 */

function buildAnswer(q) {
  const topic = (q || '前端流式方案').trim().slice(0, 20) || '前端流式方案'
  return [
    `### 关于「${topic}」的分析`,
    '',
    '本回复由 **EdgeOne 边缘函数** 按 LangChain messages 协议流式输出，用于演示前端流式链路：',
    '',
    '1. 传输层：Fetch + ReadableStream，支持随时中断；',
    '2. 协议层：兼容多种 chunk 形态；',
    '3. 渲染层：Markdown 增量渲染，滚动吸底。'
  ].join('\n')
}

function sseResponse(question) {
  const thinking = [
    { name: 'task', kwargs: { content: '理解问题：' + (question || '').slice(0, 30) } },
    { name: 'retriever', kwargs: { content: '检索知识库相关段落 (3 条命中)' } }
  ]
  const answer = buildAnswer(question)

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      const send = (obj) => {
        controller.enqueue(enc.encode(`event: messages\ndata: ${JSON.stringify({ chunk: obj })}\n\n`))
      }

      let step = 0
      let i = 0

      const tick = () => {
        if (step < thinking.length) {
          send({ type: 'tool', ...thinking[step] })
          step++
          setTimeout(tick, 260)
          return
        }
        const size = 2 + Math.floor(Math.random() * 4)
        const text = answer.slice(i, i + size)
        i += size
        if (text) {
          send({ type: 'AIMessageChunk', kwargs: { content: text } })
          setTimeout(tick, 24)
        } else {
          send({ type: 'tool', name: 'AgentOutput', tool_calls: [{ name: 'AgentOutput', args: { answer, status: 'success' } }] })
          controller.enqueue(enc.encode('event: end\ndata: {}\n\n'))
          controller.close()
        }
      }

      setTimeout(tick, 200)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  })
}

export async function onRequestPost(context) {
  let question = ''
  try {
    const body = await context.request.json()
    question = body?.message || ''
  } catch (e) { /* 忽略非法 body */ }
  return sseResponse(question)
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context)
  return new Response(JSON.stringify({ error: 'method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  })
}

/* Makers 平台亦支持默认导出形式，两种写法都提供以保证兼容 */
export default onRequest
