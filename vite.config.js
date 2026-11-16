import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 开发环境 mock：本地模拟 AI 流式接口（SSE）
 * - /api/chat/stream     流式对话（LangChain messages 协议）
 * - /api/extract/stream  字段抽取（event: field / log）
 * - /api/agent/stream    Agent 执行链路（event: node / log / result）
 * 生产环境由 api/*.js（Vercel）与 edge-functions/*.js（EdgeOne）承担同样输出
 */

/** SSE 通用响应头 + 关闭检测 */
function sse(res) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  return {
    send: (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
    closed: () => res.writableEnded
  }
}

/** 定时任务链：按 fn 数组依次延迟执行 */
function schedule(steps, closed) {
  let i = 0
  const next = () => {
    if (closed() || i >= steps.length) return
    const [delay, fn] = steps[i++]
    setTimeout(() => { if (!closed()) { fn(); next() } }, delay)
  }
  next()
}

/* ================= 对话 mock ================= */
function chatMock(req, res) {
  const { send, closed } = sse(res)
  let question = ''
  try { question = JSON.parse(req._body).message || '' } catch (e) { /* ignore */ }

  const thinking = [
    { name: 'task', kwargs: { content: '理解问题：' + question.slice(0, 30) } },
    { name: 'retriever', kwargs: { content: '检索知识库相关段落 (3 条命中)' } },
    { name: 's3_public_url', kwargs: { content: 'https://example.com/ref-doc-001.pdf' } }
  ]
  const answer = buildAnswer(question)
  const events = []
  thinking.forEach((t) => events.push([260, () => send('messages', { chunk: { type: 'tool', ...t } })]))
  let i = 0
  while (i < answer.length) {
    const size = 2 + Math.floor(Math.random() * 4)
    const text = answer.slice(i, i + size)
    i += size
    events.push([26, () => send('messages', { chunk: { type: 'AIMessageChunk', kwargs: { content: text } } })])
  }
  events.push([0, () => send('messages', { chunk: { type: 'tool', name: 'AgentOutput', tool_calls: [{ name: 'AgentOutput', args: { answer, status: 'success' } }] } })])
  events.push([0, () => { send('end', {}); res.end() }])
  schedule(events, closed)
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

/* ================= 字段抽取 mock ================= */
function extractMock(req, res) {
  const { send, closed } = sse(res)
  const fields = [
    { name: '合同编号', value: 'HD-2026-0311-07', confidence: 0.99 },
    { name: '甲方', value: '沈阳市恒达贸易有限公司', confidence: 0.96 },
    { name: '乙方', value: '辽宁中恒建筑安装工程有限公司', confidence: 0.93 },
    { name: '签订日期', value: '2026-03-11', confidence: 0.98 },
    { name: '合同金额', value: '人民币 1,286,500 元（含税）', confidence: 0.88 },
    { name: '付款方式', value: '三期支付：预付款 30% / 到货款 50% / 验收款 20%', confidence: 0.72 },
    { name: '供货期限', value: '合同生效后 45 个自然日内', confidence: 0.94 },
    { name: '交货地点', value: '沈阳市铁西区经济技术开发区 12 号厂房', confidence: 0.91 }
  ]
  const events = [
    [300, () => send('log', { message: '已建立模型会话（mock）' })],
    [420, () => send('log', { message: '加载抽取 Schema：8 个目标字段' })],
    [500, () => send('log', { message: '开始按段落定位字段…' })],
    ...fields.flatMap((f, idx) => [
      [520, () => send('log', { message: `定位「${f.name}」并抽取值` })],
      [160, () => send('field', f)]
    ]),
    [0, () => send('log', { message: '抽取完成，低置信字段已标记待确认' })],
    [0, () => { send('end', {}); res.end() }]
  ]
  schedule(events, closed)
}

/* ================= Agent 执行链路 mock ================= */
function agentMock(req, res) {
  const { send, closed } = sse(res)
  const summary =
    '风险摘要（置信度 0.92）：\n' +
    '1. 付款条款：三期支付比例合计 100%，无违规，但验收款 20% 未约定验收时限，建议补充；\n' +
    '2. 交付期限：45 个自然日明确，但未约定逾期违约金上限，存在敞口；\n' +
    '3. 建议在补充协议中增加「验收后 10 个工作日内付款」与「逾期日千分之一违约金」条款。'

  const events = [
    [300, () => send('node', { id: 'n1', type: 'think', label: '任务拆解', detail: '拆解为 3 个子任务：风险项检索 → 条款比对 → 汇总输出', status: 'running' })],
    [700, () => send('log', { message: '[think] 规划工具调用序列：search_clauses → check_deadline → summarize' })],
    [400, () => send('node', { id: 'n1', status: 'done', ms: 1100 })],

    [300, () => send('node', { id: 'n2', type: 'tool', label: 'search_clauses（检索履约条款）', detail: 'query: "付款 验收 期限 违约"', status: 'running' })],
    [900, () => send('log', { message: '[tool] search_clauses 命中 6 条相关条款' })],
    [350, () => send('node', { id: 'n2', status: 'done', ms: 1250 })],

    [300, () => send('node', { id: 'n3', type: 'tool', label: 'check_deadline（校验交付期限）', detail: '输入：供货期限 45 天', status: 'running' })],
    [1000, () => send('log', { message: '[tool] check_deadline 超时（外部服务 5s 限制），触发自动重试' })],
    [350, () => send('node', { id: 'n3', status: 'fail', ms: 4300 })],

    [500, () => send('node', { id: 'n4', type: 'retry', label: 'check_deadline（第 2 次尝试）', detail: '指数退避 800ms 后重试', status: 'running' })],
    [900, () => send('log', { message: '[tool] check_deadline 第 2 次执行成功，返回期限校验结果' })],
    [350, () => send('node', { id: 'n4', status: 'done', ms: 1250 })],

    [300, () => send('node', { id: 'n5', type: 'think', label: '结果汇总与置信度评估', detail: '合并 6 条条款证据，计算整体置信度 0.92', status: 'running' })],
    [800, () => send('node', { id: 'n5', status: 'done', ms: 800 })],

    [300, () => send('node', { id: 'n6', type: 'output', label: '生成风险摘要', status: 'running' })],
    [700, () => { send('node', { id: 'n6', status: 'done', ms: 700 }); send('result', { text: summary }) }],
    [0, () => { send('end', {}); res.end() }]
  ]
  schedule(events, closed)
}

/* ================= HR 入职材料核对 mock ================= */
const HR_ITEMS = [
  {
    level: 'high', field: '社保缴纳主体',
    title: '近 6 个月社保由「沈阳云启科技」缴纳',
    detail: '背景调查授权书填写的拟入职主体为「辽宁金华泽科技有限公司」，两者不一致。',
    action: '补充离职证明与社保转移记录，或确认劳务派遣关系'
  },
  {
    level: 'mid', field: '合同起始日',
    title: '合同起始日 2026-11-20 早于入职日期 2026-11-24',
    detail: '两处日期相差 4 天，可能影响社保起缴月份与试用期计算。',
    action: '确认以哪个日期为准，并同步修正合同签署页'
  },
  {
    level: 'low', field: '体检结论',
    title: '矫正视力 4.8，低于岗位参考值 5.0',
    detail: '岗位为前端开发，非特殊工种，通常不影响录用。',
    action: '无需处理，记录归档'
  },
  {
    level: 'ok', field: '学历证书',
    title: '学信网核验通过，证书编号一致',
    detail: '本科 / 沈阳工业大学 / 计算机科学与技术，与登记表填写一致。',
    action: '—'
  }
]

const HR_VERDICT =
  '**核对结论：建议通过（附 2 项待补材料）**\n\n' +
  '- 高风险 1 项：社保缴纳主体与拟入职主体不一致 → 需补充离职证明\n' +
  '- 中风险 1 项：合同起始日早于入职日期 → 需业务确认口径\n' +
  '- 已核验 1 项：学历证书（学信网）\n' +
  '- 提示 1 项：体检视力项，不影响岗位要求\n\n' +
  '处理建议：先由 HRBP 向候选人索要离职证明，同时通知合同签署方修正起始日；' +
  '两项补齐后即可流转至「体检报告」节点。'

function hrReviewMock(req, res) {
  const { send, closed } = sse(res)
  const events = [
    [280, () => send('log', { message: '读取 Offer 数据：岗位 / 主体 / 入职日期 / 薪资' })],
    [400, () => send('log', { message: '解析材料：背景调查授权书、应聘者登记表、体检报告' })],
    [450, () => send('log', { message: '比对 14 个关键字段，命中 4 条差异或核验项' })],
    ...HR_ITEMS.flatMap((it) => [
      [420, () => send('log', { message: `校验「${it.field}」` })],
      [180, () => send('item', it)]
    ]),
    [0, () => send('log', { message: '生成核对结论与处理建议' })],
    [420, () => send('result', { text: HR_VERDICT })],
    [0, () => { send('end', {}); res.end() }]
  ]
  schedule(events, closed)
}

/* ================= 插件 ================= */
function mockSsePlugin() {
  return {
    name: 'mock-sse',
    configureServer(server) {
      server.middlewares.use('/api/chat/stream', (req, res) => {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => { req._body = body; chatMock(req, res) })
      })
      server.middlewares.use('/api/extract/stream', (req, res) => {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => { req._body = body; extractMock(req, res) })
      })
      server.middlewares.use('/api/agent/stream', (req, res) => {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => { req._body = body; agentMock(req, res) })
      })
      server.middlewares.use('/api/hr/review/stream', (req, res) => {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => { req._body = body; hrReviewMock(req, res) })
      })
    }
  }
}

export default defineConfig({
  plugins: [vue(), mockSsePlugin()],
  server: { port: 5180 }
})
