/**
 * Vercel Serverless：AI 流式接口（生产环境用）
 * 与本地 vite.config.js 的 mockSsePlugin 输出完全相同的 LangChain messages 协议。
 * 部署到 Vercel 后自动生效，本地开发走 vite 中间件，二选一即可。
 */

function buildAnswer(q) {
  const topic = (q || '前端流式方案').trim().slice(0, 20) || '前端流式方案'
  return [
    `### 关于「${topic}」的分析`,
    '',
    '本回复由 **Vercel Serverless 函数** 按 LangChain messages 协议流式输出，用于演示前端流式链路：',
    '',
    '1. 传输层：Fetch + ReadableStream，支持随时中断；',
    '2. 协议层：兼容多种 chunk 形态；',
    '3. 渲染层：Markdown 增量渲染，滚动吸底。'
  ].join('\n')
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  let question = ''
  try { question = req.body?.message || '' } catch (e) { /* ignore */ }

  const thinking = [
    { name: 'task', kwargs: { content: '理解问题：' + question.slice(0, 30) } },
    { name: 'retriever', kwargs: { content: '检索知识库相关段落 (3 条命中)' } }
  ]
  const answer = buildAnswer(question)

  const send = (obj) => {
    res.write(`event: messages\ndata: ${JSON.stringify({ chunk: obj })}\n\n`)
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
      res.write('event: end\ndata: {}\n\n')
      res.end()
    }
  }

  setTimeout(tick, 200)
}
