/**
 * EdgeOne Pages Edge Function：AI 字段抽取流式接口（演示用 mock）
 * 路由：edge-functions/api/extract/stream.js -> POST /api/extract/stream
 * event: field（字段 + 置信度）/ log（过程）/ end
 */

const FIELDS = [
  { name: '合同编号', value: 'HD-2026-0311-07', confidence: 0.99 },
  { name: '甲方', value: '沈阳市恒达贸易有限公司', confidence: 0.96 },
  { name: '乙方', value: '辽宁中恒建筑安装工程有限公司', confidence: 0.93 },
  { name: '签订日期', value: '2026-03-11', confidence: 0.98 },
  { name: '合同金额', value: '人民币 1,286,500 元（含税）', confidence: 0.88 },
  { name: '付款方式', value: '三期支付：预付款 30% / 到货款 50% / 验收款 20%', confidence: 0.72 },
  { name: '供货期限', value: '合同生效后 45 个自然日内', confidence: 0.94 },
  { name: '交货地点', value: '沈阳市铁西区经济技术开发区 12 号厂房', confidence: 0.91 }
]

function sseResponse() {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      const send = (event, data) => {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      const events = [
        [300, ['log', { message: '已建立模型会话（mock）' }]],
        [420, ['log', { message: '加载抽取 Schema：8 个目标字段' }]],
        [500, ['log', { message: '开始按段落定位字段…' }]],
        ...FIELDS.flatMap((f) => [
          [520, ['log', { message: `定位「${f.name}」并抽取值` }]],
          [160, ['field', f]]
        ]),
        [0, ['log', { message: '抽取完成，低置信字段已标记待确认' }]],
        [0, null] // end
      ]

      let i = 0
      const tick = () => {
        if (i >= events.length) return
        const [delay, payload] = events[i++]
        setTimeout(() => {
          if (payload) { send(payload[0], payload[1]); tick() }
          else { send('end', {}); controller.close() }
        }, delay)
      }
      tick()
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' }
  })
}

export async function onRequestPost(context) {
  try { await context.request.json() } catch (e) { /* 忽略非法 body */ }
  return sseResponse()
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context)
  return new Response(JSON.stringify({ error: 'method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  })
}

export default onRequest
