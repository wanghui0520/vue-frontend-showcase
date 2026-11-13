import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 开发环境 mock：本地模拟 AI 流式接口（LangChain messages 协议）
 * 生产环境（Vercel）由 api/chat.js 承担同样的流式输出
 */
function mockSsePlugin() {
  return {
    name: 'mock-sse-chat',
    configureServer(server) {
      server.middlewares.use('/api/chat/stream', (req, res) => {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          res.setHeader('Content-Type', 'text/event-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Connection', 'keep-alive')
          res.flushHeaders?.()

          let question = ''
          try { question = JSON.parse(body).message || '' } catch (e) { /* ignore */ }

          // 脚本化回复：先输出若干“工具调用”思考块，再流式输出 Markdown 正文
          const thinking = [
            { name: 'task', kwargs: { content: '理解问题：' + question.slice(0, 30) } },
            { name: 'retriever', kwargs: { content: '检索知识库相关段落 (3 条命中)' } },
            { name: 's3_public_url', kwargs: { content: 'https://example.com/ref-doc-001.pdf' } }
          ]
          const answer = buildAnswer(question)

          let step = 0
          const send = (obj) => {
            res.write(`event: messages\ndata: ${JSON.stringify({ chunk: obj })}\n\n`)
          }
          const closed = () => res.writableEnded

          const tick = () => {
            if (closed()) return
            if (step < thinking.length) {
              send({ type: 'tool', ...thinking[step] })
              step++
              setTimeout(tick, 260)
              return
            }
            // 正文按 2~5 字/帧 流式输出（AIMessageChunk.kwargs.content 形态）
            if (!tick._i) tick._i = 0
            const size = 2 + Math.floor(Math.random() * 4)
            const text = answer.slice(tick._i, tick._i + size)
            tick._i += size
            if (text) {
              send({ type: 'AIMessageChunk', kwargs: { content: text } })
              setTimeout(tick, 24)
            } else {
              // 收尾：AgentOutput 完整答案（tool_calls 形态）
              send({
                type: 'tool',
                name: 'AgentOutput',
                tool_calls: [{ name: 'AgentOutput', args: { answer, status: 'success' } }]
              })
              res.write('event: end\ndata: {}\n\n')
              res.end()
            }
          }
          setTimeout(tick, 200)
        })
      })
    }
  }
}

function buildAnswer(q) {
  const topic = (q || '前端流式方案').trim().slice(0, 20) || '前端流式方案'
  return [
    `### 关于「${topic}」的分析`,
    '',
    '以下是该问题的结构化回答，用于演示 **Markdown 流式渲染**（标题 / 表格 / 代码块 / 列表均实时增量输出）：',
    '',
    '| 方案 | 传输方式 | 适用场景 |',
    '| --- | --- | --- |',
    '| SSE | Fetch + ReadableStream | 单向流式输出，本项目采用 |',
    '| WebSocket | 全双工长连接 | 双向实时交互 |',
    '| 轮询 | 定时请求 | 兼容旧环境 |',
    '',
    '客户端关键实现：',
    '',
    '```js',
    '// 按 \\n\\n 切分完整 SSE 帧，避免半帧粘包',
    'const frames = buffer.split(/\\n\\n/)',
    'buffer = frames.pop() // 最后一段可能不完整，留到下一轮',
    '```',
    '',
    '要点总结：',
    '',
    '1. 传输层用 AbortController 支持**随时中断**，并与超时信号合并；',
    '2. 协议层兼容多种 chunk 形态（字符串 / 数组 / tool_calls）；',
    '3. 渲染层增量更新最后一条消息，滚动吸底不闪屏。',
    ''
  ].join('\n')
}

export default defineConfig({
  plugins: [vue(), mockSsePlugin()],
  server: { port: 5180 }
})
