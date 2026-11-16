/**
 * HR 入职流程数据层
 *
 * 参考真实「HR Paperless」系统的无纸化入职链路：
 *   Offer 阶段 → 合同与登记表 → 背景与体检 → 入职办理
 * 共 4 阶段 12 节点，每节点有责任人、SLA 与材料清单；
 * 节点流转 + 审批记录（时间轴）构成完整的审批留痕。
 *
 * 演示用本地数据（localStorage 持久化），真实系统由 Activiti 流程引擎驱动。
 */
import { ref } from 'vue'

/* ================= 流程定义 ================= */
export const FLOW_STAGES = [
  {
    key: 'offer', name: 'Offer 阶段', icon: '📄',
    nodes: [
      { key: 'offerEntry', name: 'Offer 录入', owner: '招聘专员', sla: '1 天' },
      { key: 'offerApprove', name: 'Offer 审批', owner: '用人部门 + HR 负责人', sla: '2 天' },
      { key: 'offerSign', name: 'Offer 签署', owner: '候选人', sla: '3 天' }
    ]
  },
  {
    key: 'contract', name: '合同与登记表', icon: '✍️',
    nodes: [
      { key: 'contractSend', name: '发送合同', owner: 'HR 共享服务', sla: '1 天' },
      { key: 'contractSign', name: '合同签署', owner: '候选人（电子签）', sla: '3 天' },
      { key: 'formFill', name: '应聘者登记表填写', owner: '候选人', sla: '2 天' },
      { key: 'formReview', name: '登记表审核', owner: 'HRBP', sla: '1 天' }
    ]
  },
  {
    key: 'verify', name: '背景与体检', icon: '🔍',
    nodes: [
      { key: 'background', name: '背景调查', owner: '背调供应商', sla: '5 天' },
      { key: 'medical', name: '体检报告', owner: '体检中心', sla: '7 天' },
      { key: 'healthCheck', name: '健康确认', owner: '企业医务室', sla: '1 天' }
    ]
  },
  {
    key: 'onboard', name: '入职办理', icon: '🎉',
    nodes: [
      { key: 'infoEntry', name: '录入入职信息', owner: 'HR 运营', sla: '1 天' },
      { key: 'infoReview', name: '详细信息审核', owner: 'HRBP + 财务', sla: '1 天' },
      { key: 'done', name: '入职完成', owner: '系统', sla: '—' }
    ]
  }
]

export const NODES = FLOW_STAGES.flatMap((s, si) =>
  s.nodes.map((n) => ({ ...n, stageIndex: si, stageName: s.name, stageKey: s.key }))
)
export const TOTAL_NODES = NODES.length
export const nodeByKey = (key) => NODES.find((n) => n.key === key)
export const nodeIdx = (key) => NODES.findIndex((n) => n.key === key)

/** 各节点要求的材料清单（收齐才能流转） */
const MATERIALS = {
  offerApprove: ['面试评价表', '薪资审批单'],
  offerSign: ['Offer 电子签回执'],
  contractSend: ['劳动合同（模板）', '保密协议'],
  contractSign: ['合同签署回执'],
  formFill: ['应聘者登记表'],
  formReview: ['应聘者登记表（签字版）', '身份证正反面', '学历 / 学位证书'],
  background: ['背景调查授权书', '前雇主离职证明'],
  medical: ['入职体检报告（3 个月内）'],
  healthCheck: ['体检结论复核单'],
  infoEntry: ['银行卡信息', '社保 / 公积金转移单'],
  infoReview: ['入职信息确认单', '薪资核定表']
}

/* ================= 种子数据 ================= */
function seed() {
  return [
    {
      id: 'C-2026-0417', name: '李思远', gender: '男', age: 29,
      position: '高级前端工程师', dept: '数字化中心 · 前端组', entity: '辽宁金华泽科技有限公司',
      entryDate: '2026-11-24', phone: '138****6210', email: 'lisiyuan@example.com',
      status: 'running', currentNode: 'background',
      offer: { level: 'P6', base: 24000, months: 14, probation: '3 个月' },
      checked: ['背景调查授权书'],
      timeline: [
        { node: 'offerEntry', action: '提交', user: '招聘专员 张蕾', time: '2026-11-03 10:12', comment: '通过三轮技术面 + 交叉面' },
        { node: 'offerApprove', action: '通过', user: 'HR 负责人 王敏', time: '2026-11-04 14:30', comment: '薪资在带宽内，同意录用' },
        { node: 'offerSign', action: '签署完成', user: '候选人 李思远', time: '2026-11-05 09:05', comment: '电子签完成，回执已归档' },
        { node: 'contractSend', action: '已发送', user: 'HR 共享服务', time: '2026-11-05 11:00', comment: '合同 + 保密协议已推送' },
        { node: 'contractSign', action: '签署完成', user: '候选人 李思远', time: '2026-11-06 20:41' },
        { node: 'formFill', action: '提交', user: '候选人 李思远', time: '2026-11-07 21:10', comment: '登记表填写完成' },
        { node: 'formReview', action: '通过', user: 'HRBP 王敏', time: '2026-11-08 10:26', comment: '材料齐全，学历已核验' },
        { node: 'background', action: '进行中', user: '背调供应商', time: '2026-11-09 09:00', comment: '预计 5 个工作日出报告' }
      ]
    },
    {
      id: 'C-2026-0431', name: '陈默', gender: '女', age: 31,
      position: 'HRBP', dept: '人力资源部 · 业务伙伴组', entity: '辽宁金华泽科技有限公司',
      entryDate: '2026-12-01', phone: '139****3378', email: 'chenmo@example.com',
      status: 'running', currentNode: 'formReview',
      offer: { level: 'P6', base: 21000, months: 13, probation: '3 个月' },
      checked: ['应聘者登记表（签字版）', '身份证正反面'],
      timeline: [
        { node: 'offerEntry', action: '提交', user: '招聘专员 张蕾', time: '2026-11-06 16:20' },
        { node: 'offerApprove', action: '通过', user: 'HRD 刘畅', time: '2026-11-07 09:41', comment: '同意' },
        { node: 'offerSign', action: '签署完成', user: '候选人 陈默', time: '2026-11-07 18:02' },
        { node: 'contractSend', action: '已发送', user: 'HR 共享服务', time: '2026-11-08 10:15' },
        { node: 'contractSign', action: '签署完成', user: '候选人 陈默', time: '2026-11-09 11:33' },
        { node: 'formFill', action: '提交', user: '候选人 陈默', time: '2026-11-12 20:15' },
        { node: 'formReview', action: '待审核', user: 'HRBP 王敏', time: '2026-11-13 09:00', comment: '等待材料补齐（学历证书）' }
      ]
    },
    {
      id: 'C-2026-0388', name: '张雅文', gender: '女', age: 26,
      position: '数据分析师', dept: '数据中台 · 分析组', entity: '沈阳德风新征程科技有限公司',
      entryDate: '2026-11-18', phone: '137****8802', email: 'zhangyw@example.com',
      status: 'running', currentNode: 'infoReview',
      offer: { level: 'P5', base: 17000, months: 13, probation: '3 个月' },
      checked: ['银行卡信息', '社保 / 公积金转移单', '入职信息确认单'],
      timeline: [
        { node: 'offerEntry', action: '提交', user: '招聘专员 张蕾', time: '2026-10-21 09:30' },
        { node: 'offerApprove', action: '通过', user: 'HR 负责人 王敏', time: '2026-10-21 17:12' },
        { node: 'offerSign', action: '签署完成', user: '候选人 张雅文', time: '2026-10-22 10:05' },
        { node: 'contractSend', action: '已发送', user: 'HR 共享服务', time: '2026-10-22 14:00' },
        { node: 'contractSign', action: '签署完成', user: '候选人 张雅文', time: '2026-10-23 19:20' },
        { node: 'formFill', action: '提交', user: '候选人 张雅文', time: '2026-10-24 11:40' },
        { node: 'formReview', action: '通过', user: 'HRBP 王敏', time: '2026-10-27 15:02' },
        { node: 'background', action: '通过', user: '背调供应商', time: '2026-11-03 10:30', comment: '无异常记录' },
        { node: 'medical', action: '通过', user: '体检中心', time: '2026-11-10 16:20' },
        { node: 'healthCheck', action: '通过', user: '企业医务室', time: '2026-11-11 09:15' },
        { node: 'infoEntry', action: '提交', user: 'HR 运营 赵雪', time: '2026-11-14 10:00' },
        { node: 'infoReview', action: '待审核', user: 'HRBP + 财务', time: '2026-11-15 09:30', comment: '薪资核定待财务确认' }
      ]
    },
    {
      id: 'C-2026-0356', name: '刘子豪', gender: '男', age: 34,
      position: '制造工艺工程师', dept: '生产制造部 · 工艺组', entity: '沈阳德风新征程科技有限公司',
      entryDate: '—', phone: '135****4419', email: 'liuzh@example.com',
      status: 'rejected', currentNode: 'offerSign',
      offer: { level: 'P6', base: 19500, months: 13, probation: '3 个月' },
      checked: [],
      timeline: [
        { node: 'offerEntry', action: '提交', user: '招聘专员 张蕾', time: '2026-10-12 14:00' },
        { node: 'offerApprove', action: '通过', user: 'HR 负责人 王敏', time: '2026-10-13 10:20' },
        { node: 'offerSign', action: '拒签', user: '候选人 刘子豪', time: '2026-10-16 18:30', comment: '候选人接受其他公司 offer（薪资高出 15%）' }
      ]
    }
  ]
}

/* ================= 状态 ================= */
const KEY = 'showcase_hr_candidates_v1'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return seed()
}

export const candidates = ref(load())

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(candidates.value)) } catch (e) { /* ignore */ }
}

const now = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 当前节点材料清单 + 已收取状态 */
export function materialsOf(c) {
  const node = nodeByKey(c.currentNode)
  if (!node) return []
  const list = MATERIALS[node.key] || []
  return list.map((name) => ({ name, done: (c.checked || []).includes(name) }))
}

/** 节点流转：通过 → 进入下一节点；末节点 → 入职完成 */
export function approve(c, comment) {
  const i = nodeIdx(c.currentNode)
  const node = NODES[i]
  c.timeline.push({ node: c.currentNode, action: '通过', user: '我（HRBP）', time: now(), comment: comment || '' })
  if (i >= TOTAL_NODES - 1) {
    c.status = 'done'
    persist()
    return
  }
  c.currentNode = NODES[i + 1].key
  c.checked = []
  if (c.currentNode === 'done') {
    c.status = 'done'
    c.timeline.push({ node: 'done', action: '入职完成', user: '系统', time: now(), comment: '流程归档，档案已生成' })
  } else {
    c.status = 'running'
    c.timeline.push({ node: c.currentNode, action: '待处理', user: NODES[i + 1].owner, time: now() })
  }
  persist()
}

/** 驳回：终止本次入职流程 */
export function reject(c, reason) {
  c.status = 'rejected'
  c.timeline.push({ node: c.currentNode, action: '驳回', user: '我（HRBP）', time: now(), comment: reason || '' })
  persist()
}

/** 勾选 / 取消勾选材料 */
export function toggleMaterial(c, name) {
  const set = new Set(c.checked || [])
  if (set.has(name)) set.delete(name)
  else set.add(name)
  c.checked = [...set]
  persist()
}

export function resetHr() {
  candidates.value = seed()
  persist()
}
