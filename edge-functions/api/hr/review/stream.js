/**
 * EdgeOne Pages Edge Function：HR 入职材料 AI 核对（演示用 mock）
 * 路由：edge-functions/api/hr/review/stream.js -> POST /api/hr/review/stream
 * event: log / item / result / end
 */

const ITEMS = [
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

const VERDICT =
  '**核对结论：建议通过（附 2 项待补材料）**\n\n' +
  '- 高风险 1 项：社保缴纳主体与拟入职主体不一致 → 需补充离职证明\n' +
  '- 中风险 1 项：合同起始日早于入职日期 → 需业务确认口径\n' +
  '- 已核验 1 项：学历证书（学信网）\n' +
  '- 提示 1 项：体检视力项，不影响岗位要求\n\n' +
  '处理建议：先由 HRBP 向候选人索要离职证明，同时通知合同签署方修正起始日；' +
  '两项补齐后即可流转至「体检报告」节点。'

function sseResponse() {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      const send = (event, data) => {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      const events = [
        [280, ['log', { message: '读取 Offer 数据：岗位 / 主体 / 入职日期 / 薪资' }]],
        [400, ['log', { message: '解析材料：背景调查授权书、应聘者登记表、体检报告' }]],
        [450, ['log', { message: '比对 14 个关键字段，命中 4 条差异或核验项' }]],
        ...ITEMS.flatMap((it) => [
          [420, ['log', { message: `校验「${it.field}」` }]],
          [180, ['item', it]]
        ]),
        [0, ['log', { message: '生成核对结论与处理建议' }]],
        [420, ['result', { text: VERDICT }]],
        [0, null]
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
