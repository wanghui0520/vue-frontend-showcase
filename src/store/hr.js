/**
 * HR 流程数据层（支持多流程：入职 / 转正）
 *
 * 参考真实「HR Paperless」系统的无纸化链路：
 *   入职流程：Offer 阶段 → 合同与登记表 → 背景与体检 → 入职办理（4 阶段 12 节点）
 *   转正流程：转正申请 → 试用评估 → 审批 → 结果归档（4 阶段 7 节点）
 * 每节点有责任人、SLA 与材料清单；节点流转 + 审批记录（时间轴）构成完整的审批留痕。
 *
 * 演示用本地数据（localStorage 持久化），真实系统由 Activiti 流程引擎驱动。
 */
import { ref, computed } from 'vue'

/* ================= 流程定义 ================= */
export const FLOW_DEFS = {
  onboard: {
    key: 'onboard', name: '入职流程', icon: '🎉',
    desc: 'Offer → 合同与登记表 → 背景体检 → 入职办理，共 4 阶段 12 节点',
    stages: [
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
        key: 'onboardDone', name: '入职办理', icon: '🎉',
        nodes: [
          { key: 'infoEntry', name: '录入入职信息', owner: 'HR 运营', sla: '1 天' },
          { key: 'infoReview', name: '详细信息审核', owner: 'HRBP + 财务', sla: '1 天' },
          { key: 'done', name: '入职完成', owner: '系统', sla: '—' }
        ]
      }
    ]
  },
  regular: {
    key: 'regular', name: '转正流程', icon: '📈',
    desc: '转正申请 → 试用评估 → 审批 → 结果归档，共 4 阶段 7 节点',
    stages: [
      {
        key: 'apply', name: '转正申请', icon: '📝',
        nodes: [
          { key: 'regApply', name: '发起转正申请', owner: '员工本人', sla: '1 天' },
          { key: 'regSelf', name: '试用期自评', owner: '员工本人', sla: '2 天' }
        ]
      },
      {
        key: 'eval', name: '试用评估', icon: '🧭',
        nodes: [
          { key: 'regManager', name: '主管评估', owner: '直属主管', sla: '3 天' },
          { key: 'regFeedback', name: '协作反馈（360°）', owner: '协作同事', sla: '2 天' }
        ]
      },
      {
        key: 'review', name: '审批', icon: '🧮',
        nodes: [
          { key: 'regHrbp', name: 'HRBP 审核', owner: 'HRBP', sla: '1 天' },
          { key: 'regFinal', name: '管理层审批', owner: '部门总监 + HRD', sla: '2 天' }
        ]
      },
      {
        key: 'archive', name: '结果归档', icon: '✅',
        nodes: [
          { key: 'regDone', name: '转正结果通知', owner: 'HR 运营', sla: '1 天' }
        ]
      }
    ]
  }
}

export const flowType = ref('onboard')
export const FLOW_STAGES = computed(() => FLOW_DEFS[flowType.value].stages)
export const NODES = computed(() =>
  FLOW_STAGES.value.flatMap((s, si) =>
    s.nodes.map((n) => ({ ...n, stageIndex: si, stageName: s.name, stageKey: s.key }))
  )
)
export const TOTAL_NODES = computed(() => NODES.value.length)
export const nodeByKey = (key) => NODES.value.find((n) => n.key === key)
export const nodeIdx = (key) => NODES.value.findIndex((n) => n.key === key)

/** 职级薪资带宽（AI 预检规则） */
export const SALARY_BANDS = {
  P4: [8000, 13000],
  P5: [13000, 20000],
  P6: [20000, 28000],
  P7: [28000, 40000],
  P8: [40000, 60000]
}

/** 各节点要求的材料清单（收齐才能流转） */
const MATERIALS = {
  onboard: {
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
  },
  regular: {
    regApply: ['转正申请表'],
    regSelf: ['试用期工作总结', '试用期目标达成表'],
    regManager: ['主管评估表'],
    regFeedback: ['360° 协作反馈表'],
    regHrbp: ['考勤与绩效汇总'],
    regFinal: ['转正审批表']
  }
}

/** 需要电子签的节点 → 签署的回执材料 */
export const SIGN_NODES = {
  offerSign: 'Offer 电子签回执',
  contractSign: '合同签署回执'
}

/* ================= 种子数据 ================= */
function seedOnboard() {
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

function seedRegular() {
  return [
    {
      id: 'E-2026-0102', name: '王雪晴', gender: '女', age: 27,
      position: 'Java 后端工程师', dept: '数字化中心 · 后端组', entity: '辽宁金华泽科技有限公司',
      entryDate: '2026-12-01', phone: '138****2387', email: 'wangxq@example.com',
      status: 'running', currentNode: 'regManager',
      offer: { level: 'P5', base: 18500, months: 13, probation: '3 个月' },
      checked: [],
      timeline: [
        { node: 'regApply', action: '提交', user: '员工本人 王雪晴', time: '2026-11-10 09:20', comment: '试用期 2026-09-01 至 2026-11-30' },
        { node: 'regSelf', action: '提交', user: '员工本人 王雪晴', time: '2026-11-11 18:40', comment: '自评：核心模块按期交付，性能优化超预期' },
        { node: 'regManager', action: '进行中', user: '直属主管', time: '2026-11-12 10:00', comment: '评估中，已收到 2 份协作反馈' }
      ]
    },
    {
      id: 'E-2026-0115', name: '周子昂', gender: '男', age: 30,
      position: '产品经理', dept: '产品部 · 产品一组', entity: '辽宁金华泽科技有限公司',
      entryDate: '2026-12-15', phone: '137****9145', email: 'zhouza@example.com',
      status: 'running', currentNode: 'regSelf',
      offer: { level: 'P6', base: 22000, months: 13, probation: '3 个月' },
      checked: ['试用期工作总结'],
      timeline: [
        { node: 'regApply', action: '提交', user: '员工本人 周子昂', time: '2026-11-13 15:05' },
        { node: 'regSelf', action: '待处理', user: '员工本人 周子昂', time: '2026-11-13 15:06', comment: '工作总结已提交，目标达成表待补' }
      ]
    },
    {
      id: 'E-2026-0087', name: '高婷婷', gender: '女', age: 26,
      position: 'UI 设计师', dept: '设计中心 · 体验组', entity: '沈阳德风新征程科技有限公司',
      entryDate: '2026-11-20', phone: '136****5502', email: 'gaott@example.com',
      status: 'done', currentNode: 'regDone',
      offer: { level: 'P5', base: 15000, months: 13, probation: '2 个月' },
      checked: [],
      timeline: [
        { node: 'regApply', action: '提交', user: '员工本人 高婷婷', time: '2026-11-01 10:00' },
        { node: 'regSelf', action: '提交', user: '员工本人 高婷婷', time: '2026-11-02 19:12' },
        { node: 'regManager', action: '通过', user: '直属主管', time: '2026-11-04 14:20', comment: '设计质量与协作意识优秀' },
        { node: 'regFeedback', action: '通过', user: '协作同事', time: '2026-11-06 11:30', comment: '360° 反馈 4.6 / 5' },
        { node: 'regHrbp', action: '通过', user: 'HRBP 王敏', time: '2026-11-07 09:45', comment: '考勤与绩效均达标' },
        { node: 'regFinal', action: '通过', user: '部门总监 + HRD', time: '2026-11-08 16:00', comment: '同意按期转正' },
        { node: 'regDone', action: '转正完成', user: 'HR 运营', time: '2026-11-09 10:00', comment: '结果已通知，薪酬档案已更新' }
      ]
    }
  ]
}

/* ================= 状态 ================= */
const KEY_ONBOARD = 'showcase_hr_candidates_v1'
const KEY_REGULAR = 'showcase_hr_regular_v1'

function loadList(key, seedFn) {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return seedFn()
}

const onboardList = ref(loadList(KEY_ONBOARD, seedOnboard))
const regularList = ref(loadList(KEY_REGULAR, seedRegular))

export const candidates = computed(() =>
  flowType.value === 'onboard' ? onboardList.value : regularList.value
)

function persist() {
  try {
    localStorage.setItem(KEY_ONBOARD, JSON.stringify(onboardList.value))
    localStorage.setItem(KEY_REGULAR, JSON.stringify(regularList.value))
  } catch (e) { /* ignore */ }
}

const now = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const doneLabel = () => (flowType.value === 'onboard' ? '入职完成' : '转正完成')

/** 当前节点材料清单 + 已收取状态 */
export function materialsOf(c) {
  const node = nodeByKey(c.currentNode)
  if (!node) return []
  const list = (MATERIALS[flowType.value] || {})[node.key] || []
  return list.map((name) => ({ name, done: (c.checked || []).includes(name) }))
}

/** 新增候选人：入职流程从 Offer 录入开始，转正流程从发起转正申请开始 */
export function addCandidate(form) {
  const isOnboard = flowType.value === 'onboard'
  const list = candidates.value
  const prefix = isOnboard ? 'C-2026' : 'E-2026'
  const maxSeq = list.reduce((m, c) => {
    const n = parseInt(String(c.id).split('-').pop(), 10)
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, isOnboard ? 400 : 100)
  const id = `${prefix}-${String(maxSeq + 1).padStart(4, '0')}`

  const cand = {
    id,
    name: form.name,
    gender: form.gender || '男',
    age: form.age || 26,
    position: form.position,
    dept: form.dept || (isOnboard ? '待分配' : '待分配'),
    entity: form.entity || '辽宁金华泽科技有限公司',
    entryDate: form.entryDate || '—',
    phone: form.phone,
    email: form.email || '',
    status: 'running',
    currentNode: isOnboard ? 'offerEntry' : 'regApply',
    offer: {
      level: form.level || 'P5',
      base: Number(form.base) || 0,
      months: Number(form.months) || 13,
      probation: form.probation || '3 个月'
    },
    checked: [],
    timeline: [
      isOnboard
        ? { node: 'offerEntry', action: '提交', user: '招聘专员 张蕾', time: now(), comment: form.remark || 'Offer 信息录入，待用人部门审批' }
        : { node: 'regApply', action: '提交', user: `员工本人 ${form.name}`, time: now(), comment: form.remark || '发起转正申请' }
    ]
  }
  list.unshift(cand)
  persist()
  return cand
}

/** 节点流转：通过 → 进入下一节点；末节点 → 流程完成 */
export function approve(c, comment) {
  const nodes = NODES.value
  const i = nodeIdx(c.currentNode)
  c.timeline.push({ node: c.currentNode, action: '通过', user: '我（HRBP）', time: now(), comment: comment || '' })
  if (i >= nodes.length - 1) {
    c.status = 'done'
    persist()
    return
  }
  c.currentNode = nodes[i + 1].key
  c.checked = []
  if (c.currentNode === 'done' || c.currentNode === 'regDone') {
    c.status = 'done'
    c.timeline.push({ node: c.currentNode, action: doneLabel(), user: '系统', time: now(), comment: '流程归档' })
  } else {
    c.status = 'running'
    c.timeline.push({ node: c.currentNode, action: '待处理', user: nodes[i + 1].owner, time: now() })
  }
  persist()
}

/** 驳回：终止本次流程 */
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

/** 电子签：勾选回执材料 + 留痕（offerSign / contractSign 节点） */
export function signDoc(c, docName) {
  const set = new Set(c.checked || [])
  set.add(docName)
  c.checked = [...set]
  c.timeline.push({ node: c.currentNode, action: '签署完成', user: `候选人 ${c.name}（演示代签）`, time: now(), comment: '电子签名已归档' })
  persist()
}

export function resetHr() {
  onboardList.value = seedOnboard()
  regularList.value = seedRegular()
  persist()
}
