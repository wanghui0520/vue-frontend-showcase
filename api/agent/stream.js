/**
 * Vercel Serverless：Agent 执行链路流式接口（演示用 mock）
 * event: node（节点 upsert）/ log / result / end
 */
export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const summary =
    '风险摘要（置信度 0.92）：\n' +
    '1. 付款条款：三期支付比例合计 100%，无违规，但验收款 20% 未约定验收时限，建议补充；\n' +
    '2. 交付期限：45 个自然日明确，但未约定逾期违约金上限，存在敞口；\n' +
    '3. 建议在补充协议中增加「验收后 10 个工作日内付款」与「逾期日千分之一违约金」条款。'

  const events = [
    [300, ['node', { id: 'n1', type: 'think', label: '任务拆解', detail: '拆解为 3 个子任务：风险项检索 → 条款比对 → 汇总输出', status: 'running' }]],
    [700, ['log', { message: '[think] 规划工具调用序列：search_clauses → check_deadline → summarize' }]],
    [400, ['node', { id: 'n1', status: 'done', ms: 1100 }]],
    [300, ['node', { id: 'n2', type: 'tool', label: 'search_clauses（检索履约条款）', detail: 'query: "付款 验收 期限 违约"', status: 'running' }]],
    [900, ['log', { message: '[tool] search_clauses 命中 6 条相关条款' }]],
    [350, ['node', { id: 'n2', status: 'done', ms: 1250 }]],
    [300, ['node', { id: 'n3', type: 'tool', label: 'check_deadline（校验交付期限）', detail: '输入：供货期限 45 天', status: 'running' }]],
    [1000, ['log', { message: '[tool] check_deadline 超时（外部服务 5s 限制），触发自动重试' }]],
    [350, ['node', { id: 'n3', status: 'fail', ms: 4300 }]],
    [500, ['node', { id: 'n4', type: 'retry', label: 'check_deadline（第 2 次尝试）', detail: '指数退避 800ms 后重试', status: 'running' }]],
    [900, ['log', { message: '[tool] check_deadline 第 2 次执行成功，返回期限校验结果' }]],
    [350, ['node', { id: 'n4', status: 'done', ms: 1250 }]],
    [300, ['node', { id: 'n5', type: 'think', label: '结果汇总与置信度评估', detail: '合并 6 条条款证据，计算整体置信度 0.92', status: 'running' }]],
    [800, ['node', { id: 'n5', status: 'done', ms: 800 }]],
    [300, ['node', { id: 'n6', type: 'output', label: '生成风险摘要', status: 'running' }]],
    [700, ['node', { id: 'n6', status: 'done', ms: 700 }]],
    [0, ['result', { text: summary }]],
    [0, null] // end
  ]

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  let i = 0
  const tick = () => {
    if (res.writableEnded) return
    if (i >= events.length) return
    const [delay, payload] = events[i++]
    setTimeout(() => {
      if (res.writableEnded) return
      if (payload) send(payload[0], payload[1])
      else { send('end', {}); res.end(); return }
      tick()
    }, delay)
  }
  tick()
}
