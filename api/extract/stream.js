/**
 * Vercel Serverless：AI 字段抽取流式接口（演示用 mock）
 * event: field（字段 + 置信度）/ log（过程）/ end
 */
export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

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

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  let step = 0
  const total = 3 + fields.length * 2 + 2
  const tick = () => {
    if (res.writableEnded) return
    if (step < 3) {
      const logs = ['已建立模型会话（mock）', '加载抽取 Schema：8 个目标字段', '开始按段落定位字段…']
      send('log', { message: logs[step++] })
      setTimeout(tick, 360)
      return
    }
    const fi = (step - 3) >> 1
    if (fi < fields.length) {
      if (step % 2 === 1) send('log', { message: `定位「${fields[fi].name}」并抽取值` })
      else send('field', fields[fi])
      step++
      setTimeout(tick, step % 2 ? 480 : 180)
      return
    }
    if (step === total - 1) send('log', { message: '抽取完成，低置信字段已标记待确认' })
    send('end', {})
    res.end()
  }
  setTimeout(tick, 200)
}
