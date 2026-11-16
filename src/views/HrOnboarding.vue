<template>
  <div class="page">
    <!-- 顶部：流程切换 + 操作入口 -->
    <div class="page-top">
      <div class="flow-tabs">
        <span
          v-for="t in flowTabs" :key="t.key"
          class="ftab" :class="{ on: flowType === t.key }"
          @click="flowType = t.key"
        >{{ t.icon }} {{ t.name }}</span>
      </div>
      <div class="top-actions">
        <template v-if="isOnboard">
          <el-button plain @click="openBatch">批量导入</el-button>
          <el-button type="primary" @click="openOfferForm">＋ Offer 录入</el-button>
        </template>
        <el-button v-else type="primary" @click="openOfferForm">＋ 转正申请</el-button>
      </div>
    </div>

    <p v-if="isOnboard" class="page-desc">
      复刻真实 HR 无纸化系统的<b>入职审批链路</b>（Offer → 合同与登记表 → 背景体检 → 入职办理，共 4 阶段 12 节点），
      每个节点有责任人、SLA 与材料清单；<b>AI 材料核对</b>在人工审批前先做一遍交叉校验，把差异项摆在审批人面前。
    </p>
    <p v-else class="page-desc">
      复刻真实 HR 系统的<b>转正链路</b>（转正申请 → 试用评估 → 审批 → 结果归档，共 4 阶段 7 节点）：
      员工发起申请并完成试用期自评，主管评估与 360° 协作反馈齐备后进入 HRBP / 管理层审批；
      <b>AI 材料核对</b>同样适用于转正材料的一致性校验。
    </p>

    <!-- 概览 -->
    <div class="stat-grid">
      <div class="card stat">
        <div class="stat-label">在办候选人</div>
        <div class="stat-value">{{ runningCount }}</div>
        <div class="stat-delta">覆盖 {{ stageCount }} 个流程阶段</div>
      </div>
      <div class="card stat">
        <div class="stat-label">{{ isOnboard ? '已完成入职' : '已转正' }}</div>
        <div class="stat-value ok-text">{{ doneCount }}</div>
        <div class="stat-delta">本月</div>
      </div>
      <div class="card stat">
        <div class="stat-label">已终止流程</div>
        <div class="stat-value danger-text">{{ rejectedCount }}</div>
        <div class="stat-delta">{{ isOnboard ? 'Offer 拒签 / 主动放弃' : '评估不通过 / 延期转正' }}</div>
      </div>
      <div class="card stat">
        <div class="stat-label">流程节点</div>
        <div class="stat-value">{{ TOTAL_NODES }}</div>
        <div class="stat-delta">{{ FLOW_STAGES.length }} 阶段 · 平均 1.8 天 / 节点</div>
      </div>
    </div>

    <!-- 流程漏斗 -->
    <div class="card funnel-card">
      <div class="panel-head">
        <h3 class="card-title">流程漏斗 · 各阶段到达人数</h3>
        <span class="muted">{{ flowName }} · 含已完成与已终止的候选人</span>
      </div>
      <div ref="funnelRef" class="funnel-chart"></div>
    </div>

    <div class="hr-layout">
      <!-- 左：候选人列表 -->
      <aside class="card list-card">
        <div class="list-head">
          <el-input v-model="kw" size="small" placeholder="搜索姓名 / 岗位 / 工号" clearable />
          <div class="filter-row">
            <span
              v-for="f in filters" :key="f.key"
              class="filter-chip" :class="{ on: statusFilter === f.key }"
              @click="statusFilter = f.key"
            >{{ f.label }}</span>
          </div>
        </div>

        <div class="cand-list">
          <div
            v-for="c in filtered" :key="c.id"
            class="cand" :class="{ active: current && c.id === current.id }"
            @click="select(c)"
          >
            <div class="avatar" :class="c.status">{{ c.name.slice(0, 1) }}</div>
            <div class="cand-main">
              <div class="cand-top">
                <span class="cand-name">{{ c.name }}</span>
                <span class="badge" :class="c.status">{{ statusText(c) }}</span>
              </div>
              <div class="cand-pos">{{ c.position }}</div>
              <div class="cand-node">
                <span class="node-pill">{{ nodeByKey(c.currentNode)?.name }}</span>
                <span class="muted">{{ progressOf(c) }}/{{ TOTAL_NODES }}</span>
              </div>
            </div>
          </div>
          <div v-if="!filtered.length" class="empty-sm">没有匹配的候选人</div>
        </div>

        <el-button link size="small" class="reset-btn" @click="restore">恢复演示数据</el-button>
      </aside>

      <!-- 右：详情 -->
      <section v-if="current" class="detail">
        <!-- 基本信息 -->
        <div class="card info-card">
          <div class="avatar big" :class="current.status">{{ current.name.slice(0, 1) }}</div>
          <div class="info-main">
            <div class="info-title">
              <span class="name">{{ current.name }}</span>
              <span class="badge" :class="current.status">{{ statusText(current) }}</span>
              <span class="level-tag">{{ current.offer.level }}</span>
            </div>
            <div class="info-meta">
              {{ current.gender }} · {{ current.age }} 岁 · {{ current.position }} · {{ current.dept }}
            </div>
            <div class="info-meta sub">
              劳动关系主体：{{ current.entity }}　｜　{{ isOnboard ? '入职日期' : '预计转正日期' }}：{{ current.entryDate }}　｜　{{ current.phone }}
            </div>
          </div>
          <div class="info-side">
            <div class="side-item"><span>工号</span><b>{{ current.id }}</b></div>
            <template v-if="isOnboard">
              <div class="side-item"><span>基本月薪</span><b>¥{{ current.offer.base.toLocaleString() }}</b></div>
              <div class="side-item"><span>薪资月数</span><b>{{ current.offer.months }} 薪</b></div>
              <div class="side-item"><span>试用期</span><b>{{ current.offer.probation }}</b></div>
            </template>
            <template v-else>
              <div class="side-item"><span>试用期</span><b>{{ current.offer.probation }}</b></div>
            </template>
          </div>
        </div>

        <!-- 流程 -->
        <div class="card">
          <div class="panel-head">
            <h3 class="card-title">{{ flowName }}</h3>
            <span class="muted">第 {{ progressOf(current) }} / {{ TOTAL_NODES }} 步</span>
          </div>
          <el-progress
            :percentage="Math.round((progressOf(current) / TOTAL_NODES) * 100)"
            :stroke-width="5" :show-text="false"
            :color="current.status === 'rejected' ? 'var(--danger)' : current.status === 'done' ? 'var(--ok)' : 'var(--brand)'"
            class="flow-progress"
          />
          <div class="stages" :class="{ compact: FLOW_STAGES.length === 4 }">
            <div
              v-for="(st, si) in FLOW_STAGES" :key="st.key"
              class="stage" :class="{ active: activeStage(current) === si, failed: current.status === 'rejected' && activeStage(current) === si }"
            >
              <div class="stage-head">
                <span class="stage-icon">{{ st.icon }}</span>
                <span class="stage-name">{{ st.name }}</span>
              </div>
              <div class="stage-nodes">
                <div
                  v-for="n in st.nodes" :key="n.key"
                  class="node-item" :class="nodeState(current, n.key)"
                >
                  <i class="ndot"></i>
                  <span class="nname">{{ n.name }}</span>
                  <span v-if="nodeState(current, n.key) === 'current'" class="ntag">待办</span>
                  <span v-else-if="nodeState(current, n.key) === 'fail'" class="ntag fail">终止</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="two-col">
          <!-- 当前节点待办 -->
          <div class="card">
            <div class="panel-head">
              <h3 class="card-title">当前节点 · {{ nodeByKey(current.currentNode)?.name }}</h3>
              <span class="muted">{{ nodeByKey(current.currentNode)?.sla }}</span>
            </div>
            <div class="todo-meta">
              <span>责任人：<b>{{ nodeByKey(current.currentNode)?.owner }}</b></span>
              <span class="sep">·</span>
              <span>材料 <b :class="{ warn: !allReady }">{{ readyCount }}/{{ materials.length }}</b> 已收齐</span>
            </div>

            <div v-if="materials.length" class="materials">
              <label v-for="m in materials" :key="m.name" class="material" :class="{ done: m.done }">
                <el-checkbox :model-value="m.done" @change="toggleMaterial(current, m.name)" />
                <span>{{ m.name }}</span>
              </label>
            </div>
            <div v-else class="muted" style="margin: 6px 0 10px;">该节点无材料要求</div>

            <!-- 电子签（Offer 签署 / 合同签署节点） -->
            <div v-if="isSignNode && current.status === 'running'" class="sign-block">
              <div class="sign-head">
                <span class="sign-title">✍️ 电子签署 · {{ materials[0]?.name || '签署回执' }}</span>
                <span class="muted">演示代签，真实系统对接 e 签宝 / 法大大</span>
              </div>
              <canvas
                ref="signCanvas" class="sign-canvas"
                @pointerdown.prevent="startDraw" @pointermove.prevent="moveDraw"
                @pointerup="endDraw" @pointerleave="endDraw"
              ></canvas>
              <div class="sign-actions">
                <el-button size="small" @click="clearSign">清除重签</el-button>
                <el-button size="small" type="primary" @click="confirmSign">确认签署</el-button>
              </div>
            </div>

            <div v-if="current.status === 'running'" class="todo-actions">
              <el-button type="primary" :disabled="!allReady" @click="onApprove">
                通过并流转{{ allReady ? '' : '（材料未齐）' }}
              </el-button>
              <el-button type="danger" plain @click="onReject">驳回 / 终止</el-button>
            </div>
            <el-alert
              v-else
              :type="current.status === 'done' ? 'success' : 'error'"
              :closable="false" class="finish-alert"
              :title="current.status === 'done'
                ? (isOnboard ? '该候选人已完成入职，流程归档' : '该员工已转正，流程归档')
                : '该流程已终止（驳回 / 拒签 / 放弃）'"
            />
          </div>

          <!-- AI 材料核对 -->
          <div class="card">
            <div class="panel-head">
              <h3 class="card-title">AI 材料核对</h3>
              <el-button
                size="small" type="primary" plain
                :loading="reviewing" :disabled="current.status !== 'running'"
                @click="runReview"
              >{{ reviewItems.length ? '重新核对' : '开始核对' }}</el-button>
            </div>
            <p class="review-desc">
              用 LLM 抽取材料字段，与 {{ isOnboard ? 'Offer / 合同' : '入职档案 / 绩效' }}数据<b>交叉比对</b>，输出差异项与处理建议——审批人先看结论再看原件。
            </p>

            <div v-if="!reviewItems.length && !reviewing" class="review-empty">
              <div class="scan-art"><span class="scan-line"></span>📄</div>
              <p>点击「开始核对」，AI 将逐项校验材料一致性</p>
            </div>

            <div v-if="reviewing || reviewLogs.length" class="review-logs">
              <div v-for="(l, i) in reviewLogs" :key="i" class="rl">· {{ l }}</div>
            </div>

            <div v-if="reviewItems.length" class="items">
              <div v-for="(it, i) in reviewItems" :key="i" class="item" :class="'lv-' + it.level">
                <div class="item-head">
                  <span class="lv-tag">{{ lvText(it.level) }}</span>
                  <span class="item-field">{{ it.field }}</span>
                </div>
                <div class="item-title">{{ it.title }}</div>
                <div class="item-detail">{{ it.detail }}</div>
                <div v-if="it.action && it.action !== '—'" class="item-action">建议：{{ it.action }}</div>
              </div>
            </div>

            <div v-if="reviewResult" class="verdict md" v-html="verdictHtml"></div>
            <div v-if="reviewResult" class="verdict-actions">
              <el-button size="small" @click="askAi">带核对结果问 AI</el-button>
            </div>
          </div>
        </div>

        <!-- 审批留痕 -->
        <div class="card">
          <div class="panel-head">
            <h3 class="card-title">审批留痕</h3>
            <span class="muted">{{ current.timeline.length }} 条记录</span>
          </div>
          <div class="logs-timeline">
            <div v-for="(t, i) in current.timeline" :key="i" class="log-row">
              <div class="log-rail">
                <i class="log-dot" :class="actionClass(t.action)"></i>
                <div v-if="i < current.timeline.length - 1" class="log-line"></div>
              </div>
              <div class="log-body">
                <div class="log-head">
                  <span class="log-node">{{ nodeByKey(t.node)?.name || t.node }}</span>
                  <span class="log-action" :class="actionClass(t.action)">{{ t.action }}</span>
                  <span class="log-user">{{ t.user }}</span>
                  <span class="log-time">{{ t.time }}</span>
                </div>
                <div v-if="t.comment" class="log-comment">{{ t.comment }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Offer 录入 / 转正申请 弹窗 -->
    <el-dialog v-model="formVisible" :title="dialogTitle" width="680px" destroy-on-close>
      <el-alert
        type="info" :closable="false" class="form-alert"
        :title="isOnboard
          ? '录入完成后，候选人进入「Offer 录入」节点，按流程流转：Offer 审批 → Offer 签署 → 合同与登记表 → 背景体检 → 入职办理'
          : '提交后进入「发起转正申请」节点：试用期自评 → 主管评估 → 360° 反馈 → HRBP 审核 → 管理层审批 → 结果归档'"
      />
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="92px" label-position="left">
        <div class="form-grid">
          <el-form-item label="姓名" prop="name">
            <el-input v-model="form.name" placeholder="候选人姓名" />
          </el-form-item>
          <el-form-item label="性别">
            <el-select v-model="form.gender" style="width: 100%">
              <el-option label="男" value="男" />
              <el-option label="女" value="女" />
            </el-select>
          </el-form-item>
          <el-form-item label="应聘岗位" prop="position">
            <el-input v-model="form.position" :placeholder="isOnboard ? '如：高级前端工程师' : '如：Java 后端工程师'" />
          </el-form-item>
          <el-form-item label="所属部门">
            <el-input v-model="form.dept" :placeholder="isOnboard ? '如：数字化中心 · 前端组' : '如：数字化中心 · 后端组'" />
          </el-form-item>
          <el-form-item label="手机号" prop="phone">
            <el-input v-model="form.phone" placeholder="11 位手机号" maxlength="11" />
          </el-form-item>
          <el-form-item :label="isOnboard ? '入职日期' : '预计转正日期'">
            <el-date-picker
              v-model="form.entryDate" type="date" value-format="YYYY-MM-DD"
              :placeholder="isOnboard ? '选择预计入职日期' : '选择预计转正日期'" style="width: 100%"
            />
          </el-form-item>
          <template v-if="isOnboard">
            <el-form-item label="劳动关系主体">
              <el-select v-model="form.entity" style="width: 100%">
                <el-option label="辽宁金华泽科技有限公司" value="辽宁金华泽科技有限公司" />
                <el-option label="沈阳德风新征程科技有限公司" value="沈阳德风新征程科技有限公司" />
              </el-select>
            </el-form-item>
            <el-form-item label="职级">
              <el-select v-model="form.level" style="width: 100%">
                <el-option v-for="lv in ['P4', 'P5', 'P6', 'P7', 'P8']" :key="lv" :label="lv" :value="lv" />
              </el-select>
            </el-form-item>
            <el-form-item label="基本月薪" prop="base">
              <el-input-number v-model="form.base" :min="1000" :max="100000" :step="1000" :controls="false" style="width: 100%" placeholder="¥" />
            </el-form-item>
            <el-form-item label="薪资月数">
              <el-input-number v-model="form.months" :min="12" :max="16" :controls="false" style="width: 100%" />
            </el-form-item>
            <el-form-item label="试用期">
              <el-select v-model="form.probation" style="width: 100%">
                <el-option v-for="p in ['1 个月', '2 个月', '3 个月', '6 个月']" :key="p" :label="p" :value="p" />
              </el-select>
            </el-form-item>
            <el-form-item label="年龄">
              <el-input-number v-model="form.age" :min="18" :max="60" :controls="false" style="width: 100%" />
            </el-form-item>
          </template>
          <template v-else>
            <el-form-item label="年龄">
              <el-input-number v-model="form.age" :min="18" :max="60" :controls="false" style="width: 100%" />
            </el-form-item>
          </template>
        </div>

        <!-- AI 薪资带宽预检 -->
        <div v-if="bandCheck" class="band-check" :class="'bc-' + bandCheck.lv">
          <span class="bc-dot"></span>
          <span>{{ bandCheck.text }}</span>
        </div>

        <el-form-item label="备注说明">
          <el-input v-model="form.remark" type="textarea" :rows="2" :placeholder="isOnboard ? '如：通过三轮技术面 + 交叉面，薪资在带宽内' : '如：核心模块按期交付，建议按期转正'" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="submitOffer">{{ isOnboard ? '提交并进入流程' : '提交转正申请' }}</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入弹窗 -->
    <el-dialog v-model="batchVisible" title="批量导入候选人" width="720px" destroy-on-close>
      <el-alert
        type="info" :closable="false" class="form-alert"
        title="每行一位候选人，逗号分隔，顺序：姓名, 性别, 年龄, 岗位, 部门, 手机号, 职级, 月薪, 入职日期（首行表头会自动跳过）"
      />
      <el-input
        v-model="batchText" type="textarea" :rows="7"
        placeholder="姓名, 性别, 年龄, 岗位, 部门, 手机号, 职级, 月薪, 入职日期&#10;赵一鸣, 男, 28, 前端工程师, 数字化中心 · 前端组, 13812345678, P5, 18000, 2026-12-01&#10;钱二, 女, 26, 测试工程师, 质量部, 13987654321, P4, 13000, 2026-12-08"
      />
      <div v-if="batchParsed.length" class="batch-preview">
        <div class="bp bp-head">
          <span>姓名</span><span>岗位</span><span>薪资</span><span>校验</span>
        </div>
        <div v-for="(r, i) in batchParsed" :key="i" class="bp" :class="{ bad: r.errs.length }">
          <span>{{ r.name || '（未填）' }}</span>
          <span>{{ r.position || '—' }}</span>
          <span>{{ r.level }} · ¥{{ r.base.toLocaleString() }}</span>
          <span v-if="r.errs.length" class="bp-err">问题：{{ r.errs.join('、') }}</span>
          <span v-else class="bp-ok">✓ 可导入</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!importableCount" @click="doImport">
          导入 {{ importableCount }} 位候选人
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { marked } from 'marked'
import * as echarts from 'echarts'
import { createStreamClient } from '../utils/requestStream'
import { goToChatWithPrompt } from '../store/bridge'
import {
  flowType, FLOW_DEFS, FLOW_STAGES, NODES, TOTAL_NODES, nodeByKey, nodeIdx,
  materialsOf, approve, reject, toggleMaterial, resetHr, addCandidate,
  signDoc, SIGN_NODES, SALARY_BANDS, candidates
} from '../store/hr'

const { streamRequest } = createStreamClient({ timeout: 120000 })

/* ---------- 流程切换 ---------- */
const flowTabs = Object.values(FLOW_DEFS).map((f) => ({ key: f.key, name: f.name, icon: f.icon }))
const isOnboard = computed(() => flowType.value === 'onboard')
const flowName = computed(() => FLOW_DEFS[flowType.value].name)

/* ---------- 列表 ---------- */
const kw = ref('')
const statusFilter = ref('all')
const filters = computed(() => [
  { key: 'all', label: '全部' },
  { key: 'running', label: '在办' },
  { key: 'done', label: isOnboard.value ? '已入职' : '已转正' },
  { key: 'rejected', label: '已终止' }
])

const currentId = ref(candidates.value[0]?.id)
const current = computed(() => candidates.value.find((c) => c.id === currentId.value) || candidates.value[0])

const filtered = computed(() => {
  const k = kw.value.trim()
  return candidates.value.filter((c) => {
    if (statusFilter.value !== 'all' && c.status !== statusFilter.value) return false
    if (!k) return true
    return c.name.includes(k) || c.position.includes(k) || c.id.includes(k)
  })
})

const runningCount = computed(() => candidates.value.filter((c) => c.status === 'running').length)
const doneCount = computed(() => candidates.value.filter((c) => c.status === 'done').length)
const rejectedCount = computed(() => candidates.value.filter((c) => c.status === 'rejected').length)
const stageCount = computed(() => FLOW_STAGES.value.length)

function select(c) { currentId.value = c.id }

function statusText(c) {
  if (c.status !== 'done') return c.status === 'rejected' ? '已终止' : '在办'
  return isOnboard.value ? '已入职' : '已转正'
}
function progressOf(c) {
  if (c.status === 'done') return TOTAL_NODES.value
  return Math.max(1, nodeIdx(c.currentNode) + 1)
}
function activeStage(c) {
  return nodeByKey(c.currentNode)?.stageIndex ?? 0
}
function nodeState(c, key) {
  const cur = nodeIdx(c.currentNode)
  const i = nodeIdx(key)
  if (c.status === 'done') return 'done'
  if (c.status === 'rejected') {
    if (i < cur) return 'done'
    if (i === cur) return 'fail'
    return 'pending'
  }
  if (i < cur) return 'done'
  if (i === cur) return 'current'
  return 'pending'
}

const materials = computed(() => (current.value ? materialsOf(current.value) : []))
const readyCount = computed(() => materials.value.filter((m) => m.done).length)
const allReady = computed(() => materials.value.every((m) => m.done))

/* ---------- 流程漏斗 ---------- */
const funnelRef = ref(null)
let funnelChart = null

const FUNNEL_COLORS = ['#2f5bff', '#5a6cf0', '#0ea5a4', '#10b981']

const funnelData = computed(() => {
  const stages = FLOW_STAGES.value
  return stages.map((st, si) => {
    const startIdx = NODES.value.findIndex((n) => n.stageIndex === si)
    const value = candidates.value.filter((c) => {
      if (c.status === 'done') return true
      return nodeIdx(c.currentNode) >= startIdx
    }).length
    return { name: st.name, value }
  })
})

function renderFunnel() {
  if (!funnelRef.value) return
  if (!funnelChart) funnelChart = echarts.init(funnelRef.value)
  funnelChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: (p) => `${p.name}：${p.value} 人` },
    series: [{
      type: 'funnel',
      left: '10%', right: '10%', top: 8, bottom: 4,
      minSize: '26%', sort: 'downward', gap: 3,
      label: {
        show: true, position: 'inside', color: '#fff', fontSize: 12,
        formatter: (p) => `${p.name}  ${p.value} 人`
      },
      itemStyle: { borderWidth: 0 },
      data: funnelData.value.map((d, i) => ({
        ...d,
        itemStyle: { color: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }
      }))
    }]
  })
}
function onFunnelResize() { funnelChart?.resize?.() }

onMounted(() => {
  renderFunnel()
  window.addEventListener('resize', onFunnelResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onFunnelResize)
  funnelChart?.dispose?.()
  funnelChart = null
})
watch(funnelData, () => nextTick(renderFunnel), { deep: true })

/* ---------- AI 材料核对 ---------- */
const reviewing = ref(false)
const reviewLogs = ref([])
const reviewItems = ref([])
const reviewResult = ref('')
let controller = null

const verdictHtml = computed(() => marked.parse(reviewResult.value || ''))
const lvText = (lv) => ({ high: '高风险', mid: '中风险', low: '提示', ok: '已核验' }[lv] || lv)

function resetReviewState() {
  controller?.abort?.()
  reviewing.value = false
  reviewLogs.value = []
  reviewItems.value = []
  reviewResult.value = ''
}

watch(currentId, () => {
  resetReviewState()
  hasInk.value = false
  clearSign()
})

watch(flowType, () => {
  resetReviewState()
  currentId.value = candidates.value[0]?.id
  kw.value = ''
  statusFilter.value = 'all'
  hasInk.value = false
  nextTick(initSign)
})

function runReview() {
  const c = current.value
  if (!c) return
  controller?.abort?.()
  reviewLogs.value = []
  reviewItems.value = []
  reviewResult.value = ''
  reviewing.value = true

  controller = streamRequest(
    '/api/hr/review/stream',
    { candidateId: c.id, currentNode: c.currentNode, offer: c.offer },
    ({ event, data }) => {
      if (event === 'log') reviewLogs.value.push(data.message)
      else if (event === 'item') reviewItems.value.push(data)
      else if (event === 'result') reviewResult.value = data.text
    },
    () => {
      reviewing.value = false
      const high = reviewItems.value.filter((i) => i.level === 'high').length
      ElMessage[high ? 'warning' : 'success'](high ? `核对完成，${high} 项高风险需处理` : '核对完成，未发现高风险项')
    },
    (err) => {
      reviewing.value = false
      if (err.type !== 'abort') ElMessage.error('核对失败：' + err.message)
    }
  )
}

function askAi() {
  const c = current.value
  const issues = reviewItems.value
    .filter((i) => i.level !== 'ok')
    .map((i) => `- [${lvText(i.level)}] ${i.field}：${i.title}（建议：${i.action}）`)
    .join('\n')
  goToChatWithPrompt(
    `【${isOnboard.value ? '入职' : '转正'}材料核对 · ${c.name}（${c.id}）】\n` +
    `岗位：${c.position}｜主体：${c.entity}｜${isOnboard.value ? '入职日期' : '预计转正日期'}：${c.entryDate}\n` +
    `当前流程节点：${nodeByKey(c.currentNode)?.name}\n` +
    `AI 核对发现的问题：\n${issues}\n\n` +
    '请判断这些差异是否可以带条件通过，并给出与当事人沟通的话术。'
  )
}

/* ---------- 流程操作 ---------- */
async function onApprove() {
  const c = current.value
  const node = nodeByKey(c.currentNode)
  try {
    const { value } = await ElMessageBox.prompt(
      `即将通过「${node.name}」并流转到下一节点，可填写审批意见：`,
      '通过审批',
      { inputPlaceholder: '例如：材料齐全，同意', confirmButtonText: '确认通过', cancelButtonText: '取消', inputValue: '材料齐全，同意' }
    )
    approve(c, value)
    ElMessage.success(c.status === 'done'
      ? (isOnboard.value ? '流程已完成，候选人入职' : '流程已完成，员工转正')
      : `已流转至「${nodeByKey(c.currentNode)?.name}」`)
  } catch (e) { /* 取消 */ }
}

async function onReject() {
  const c = current.value
  try {
    const { value } = await ElMessageBox.prompt('请填写驳回原因（将记入审批留痕）：', '驳回流程', {
      inputPlaceholder: isOnboard.value ? '例如：候选人材料存在重大不一致' : '例如：试用期目标未达成，建议延期观察',
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消'
    })
    reject(c, value)
    ElMessage.info('流程已终止')
  } catch (e) { /* 取消 */ }
}

function actionClass(action) {
  if (action === '通过' || action === '签署完成' || action === '转正完成' || action === '入职完成') return 'ok'
  if (action === '驳回' || action === '拒签') return 'fail'
  if (action === '进行中' || action === '待审核' || action === '待处理') return 'run'
  return 'normal'
}

async function restore() {
  try {
    await ElMessageBox.confirm('将重置全部候选人与审批记录为初始演示数据（含入职与转正两个流程），继续？', '恢复演示数据', { type: 'warning' })
    resetHr()
    currentId.value = candidates.value[0].id
    ElMessage.success('已恢复演示数据')
  } catch (e) { /* 取消 */ }
}

/* ---------- 电子签 ---------- */
const signCanvas = ref(null)
const hasInk = ref(false)
let sctx = null
let drawing = false
const isSignNode = computed(() => !!SIGN_NODES[current.value?.currentNode])

watch(isSignNode, (v) => { if (v) nextTick(initSign) }, { immediate: true })

function initSign() {
  const cv = signCanvas.value
  if (!cv) return
  const dpr = window.devicePixelRatio || 1
  cv.width = cv.clientWidth * dpr
  cv.height = cv.clientHeight * dpr
  sctx = cv.getContext('2d')
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  sctx.lineWidth = 2.2
  sctx.lineCap = 'round'
  sctx.lineJoin = 'round'
  sctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-1').trim() || '#1f2937'
}

function signPos(e) {
  const r = signCanvas.value.getBoundingClientRect()
  return [e.clientX - r.left, e.clientY - r.top]
}
function startDraw(e) {
  if (!sctx) initSign()
  drawing = true
  const [x, y] = signPos(e)
  sctx.beginPath()
  sctx.moveTo(x, y)
}
function moveDraw(e) {
  if (!drawing || !sctx) return
  const [x, y] = signPos(e)
  sctx.lineTo(x, y)
  sctx.stroke()
  hasInk.value = true
}
function endDraw() { drawing = false }
function clearSign() {
  hasInk.value = false
  const cv = signCanvas.value
  if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height)
}
function confirmSign() {
  const c = current.value
  const doc = SIGN_NODES[c.currentNode]
  if (!doc) return
  if (!hasInk.value) {
    ElMessage.warning('请先在签名区手写签名')
    return
  }
  signDoc(c, doc)
  clearSign()
  ElMessage.success('电子签署完成，回执已归档；点击「通过并流转」进入下一节点')
}

/* ---------- Offer 录入 / 转正申请 ---------- */
const formVisible = ref(false)
const formRef = ref(null)
const defaultForm = () => ({
  name: '', gender: '男', age: 26, position: '', dept: '',
  phone: '', email: '', entity: '辽宁金华泽科技有限公司',
  entryDate: '', level: 'P5', base: null, months: 13,
  probation: '3 个月', remark: ''
})
const form = reactive(defaultForm())

const dialogTitle = computed(() => isOnboard.value ? 'Offer 录入 · 发起入职流程' : '发起转正申请 · 进入转正流程')
const formRules = computed(() => {
  const r = {
    name: [{ required: true, message: '请填写姓名', trigger: 'blur' }],
    position: [{ required: true, message: '请填写应聘岗位', trigger: 'blur' }],
    phone: [
      { required: true, message: '请填写手机号', trigger: 'blur' },
      { pattern: /^1\d{10}$/, message: '手机号格式不正确', trigger: 'blur' }
    ]
  }
  if (isOnboard.value) r.base = [{ required: true, message: '请填写基本月薪', trigger: 'blur' }]
  return r
})

/* AI 薪资带宽预检（规则引擎：职级带宽区间比对） */
const bandCheck = computed(() => {
  if (!isOnboard.value || !form.base || !form.level) return null
  const [min, max] = SALARY_BANDS[form.level]
  const money = (n) => n.toLocaleString()
  if (form.base > max) {
    return { lv: 'high', text: `AI 预检：月薪 ¥${money(form.base)} 高于 ${form.level} 带宽上限 ¥${money(max)}，提交后需 HRD 特批并说明理由` }
  }
  if (form.base < min) {
    return { lv: 'low', text: `AI 预检：月薪低于 ${form.level} 带宽下限 ¥${money(min)}，请确认职级与薪资是否匹配` }
  }
  return { lv: 'ok', text: `AI 预检：月薪 ¥${money(form.base)} 位于 ${form.level} 带宽（¥${money(min)} – ¥${money(max)}），通过` }
})

function openOfferForm() {
  Object.assign(form, defaultForm())
  formVisible.value = true
}

async function submitOffer() {
  try {
    await formRef.value.validate()
  } catch (e) { return }
  const cand = addCandidate({ ...form })
  formVisible.value = false
  currentId.value = cand.id
  statusFilter.value = 'all'
  kw.value = ''
  ElMessage.success(isOnboard.value
    ? `已创建候选人 ${cand.name}（${cand.id}），流程从「Offer 录入」开始`
    : `已发起 ${cand.name}（${cand.id}）的转正申请`)
}

/* ---------- 批量导入 ---------- */
const batchVisible = ref(false)
const batchText = ref('')

const batchParsed = computed(() => {
  if (!batchText.value.trim()) return []
  return batchText.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.replace(/[,，\s]/g, '').startsWith('姓名'))
    .map((l) => {
      const cols = l.split(/[,，\t]/).map((s) => s.trim())
      const [name, gender, age, position, dept, phone, level, base, entryDate] = cols
      const errs = []
      if (!name) errs.push('姓名')
      if (!position) errs.push('岗位')
      if (phone && !/^1\d{10}$/.test(phone)) errs.push('手机号格式')
      return {
        name, position,
        gender: gender || '男',
        age: Number(age) || 26,
        dept: dept || '',
        phone: phone || '',
        level: ['P4', 'P5', 'P6', 'P7', 'P8'].includes(level) ? level : 'P5',
        base: Number(base) || 0,
        entryDate: entryDate || '',
        errs
      }
    })
})

const importableCount = computed(() => batchParsed.value.filter((r) => !r.errs.length).length)

function openBatch() {
  batchText.value = ''
  batchVisible.value = true
}

function doImport() {
  const valid = batchParsed.value.filter((r) => !r.errs.length)
  if (!valid.length) {
    ElMessage.warning('没有可导入的有效数据')
    return
  }
  valid.forEach((r) => addCandidate(r))
  batchVisible.value = false
  batchText.value = ''
  ElMessage.success(`已导入 ${valid.length} 位候选人，流程从「Offer 录入」开始`)
}
</script>

<style scoped>
.ok-text { color: var(--ok); }
.danger-text { color: var(--danger); }
.muted { color: var(--text-3); font-size: 12px; }

/* ---------- 顶部 ---------- */
.page-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.flow-tabs { display: flex; gap: 6px; }
.ftab {
  font-size: 13px; font-weight: 600; padding: 5px 14px; border-radius: 9px; cursor: pointer;
  color: var(--text-2); background: var(--surface-2); border: 1px solid var(--border);
  transition: all 0.15s;
}
.ftab:hover { color: var(--brand); }
.ftab.on { color: var(--brand); background: var(--brand-weak); border-color: var(--brand); }
.top-actions { display: flex; gap: 8px; }

.band-check {
  display: flex; align-items: flex-start; gap: 8px;
  font-size: 12px; line-height: 1.6; padding: 9px 12px; border-radius: 8px; margin-bottom: 12px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--text-2);
}
.bc-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; background: var(--ok); box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15); animation: pulse 1.6s ease-in-out infinite; }
.band-check.bc-ok { border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.06); }
.band-check.bc-low { border-color: var(--brand); background: var(--brand-weak); }
.band-check.bc-low .bc-dot { background: var(--brand); box-shadow: 0 0 0 3px var(--brand-weak); }
.band-check.bc-high { border-color: var(--danger); background: rgba(239, 68, 68, 0.06); }
.band-check.bc-high .bc-dot { background: var(--danger); box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15); }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

.form-alert { margin-bottom: 14px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; }
@media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } }

/* ---------- 批量导入预览 ---------- */
.batch-preview { margin-top: 12px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; max-height: 220px; overflow-y: auto; }
.bp { display: grid; grid-template-columns: 1fr 1.6fr 1fr 1fr; gap: 8px; padding: 7px 12px; font-size: 12px; color: var(--text-2); border-top: 1px solid var(--border); }
.bp:first-child, .bp-head { border-top: none; }
.bp-head { background: var(--surface-2); color: var(--text-3); font-weight: 600; }
.bp.bad { background: rgba(239, 68, 68, 0.05); }
.bp-err { color: var(--danger); }
.bp-ok { color: var(--ok); }

/* ---------- 漏斗 ---------- */
.funnel-card { margin-top: 14px; }
.funnel-chart { height: 190px; margin-top: 6px; }

/* ---------- 布局 ---------- */
.hr-layout { display: grid; grid-template-columns: 268px 1fr; gap: 14px; margin-top: 14px; align-items: start; }
@media (max-width: 1100px) { .hr-layout { grid-template-columns: 1fr; } }

.list-card { padding: 12px; position: sticky; top: 12px; }
.list-head { display: flex; flex-direction: column; gap: 8px; }
.filter-row { display: flex; gap: 6px; flex-wrap: wrap; }
.filter-chip {
  font-size: 12px; padding: 2px 9px; border-radius: 10px; cursor: pointer;
  color: var(--text-3); background: var(--surface-2); border: 1px solid transparent;
}
.filter-chip.on { color: var(--brand); background: var(--brand-weak); border-color: var(--brand); }

.cand-list { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; max-height: 520px; overflow-y: auto; }
.cand {
  display: flex; gap: 10px; padding: 9px 10px; border-radius: 8px; cursor: pointer;
  border: 1px solid transparent; transition: background 0.15s, border-color 0.15s;
}
.cand:hover { background: var(--surface-2); }
.cand.active { background: var(--brand-weak); border-color: var(--brand); }
.avatar {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; color: #fff;
  background: linear-gradient(135deg, #2f5bff, #7b3dff);
}
.avatar.big { width: 52px; height: 52px; border-radius: 14px; font-size: 20px; }
.avatar.done { background: linear-gradient(135deg, #10b981, #059669); }
.avatar.rejected { background: linear-gradient(135deg, #9ca3af, #6b7280); }

.cand-main { min-width: 0; flex: 1; }
.cand-top { display: flex; align-items: center; gap: 6px; }
.cand-name { font-size: 13px; font-weight: 600; }
.cand-pos { font-size: 12px; color: var(--text-2); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cand-node { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.node-pill {
  font-size: 11px; padding: 0 6px; border-radius: 4px;
  background: var(--surface-2); color: var(--text-2);
  max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cand.active .node-pill { background: var(--surface); color: var(--brand); }

.badge { font-size: 11px; padding: 0 7px; border-radius: 9px; line-height: 17px; }
.badge.running { background: var(--brand-weak); color: var(--brand); }
.badge.done { background: rgba(16, 185, 129, 0.12); color: var(--ok); }
.badge.rejected { background: rgba(107, 114, 128, 0.16); color: var(--text-2); }

.reset-btn { margin-top: 8px; width: 100%; }
.empty-sm { color: var(--text-3); font-size: 12px; text-align: center; padding: 24px 0; }

.detail { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

/* ---------- 基本信息卡 ---------- */
.info-card { display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
.info-main { flex: 1; min-width: 220px; }
.info-title { display: flex; align-items: center; gap: 8px; }
.name { font-size: 17px; font-weight: 700; }
.level-tag {
  font-size: 11px; padding: 0 6px; border-radius: 4px;
  background: var(--brand-weak); color: var(--brand); font-weight: 600;
}
.info-meta { font-size: 12px; color: var(--text-2); margin-top: 5px; }
.info-meta.sub { color: var(--text-3); margin-top: 2px; }
.info-side { display: grid; grid-template-columns: repeat(2, auto); gap: 6px 18px; }
.side-item { display: flex; flex-direction: column; }
.side-item span { font-size: 11px; color: var(--text-3); }
.side-item b { font-size: 13px; font-variant-numeric: tabular-nums; }

.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.flow-progress { margin: 8px 0 12px; }

/* ---------- 阶段 ---------- */
.stages { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
@media (max-width: 1280px) { .stages { grid-template-columns: repeat(2, 1fr); } }
.stage {
  border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px;
  background: var(--surface-2);
}
.stage.active { border-color: var(--brand); background: var(--brand-weak); }
.stage.failed { border-color: var(--danger); background: rgba(239, 68, 68, 0.06); }
.stage-head { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.stage-icon { font-size: 14px; }
.stage-name { font-size: 12px; font-weight: 600; color: var(--text-2); }
.stage.active .stage-name { color: var(--brand); }
.stage-nodes { display: flex; flex-direction: column; gap: 6px; }
.node-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-3); }
.ndot { width: 7px; height: 7px; border-radius: 50%; background: var(--border); flex-shrink: 0; }
.node-item.done { color: var(--text-2); }
.node-item.done .ndot { background: var(--ok); }
.node-item.current { color: var(--brand); font-weight: 600; }
.node-item.current .ndot { background: var(--brand); box-shadow: 0 0 0 3px var(--brand-weak); }
.node-item.fail { color: var(--danger); font-weight: 600; }
.node-item.fail .ndot { background: var(--danger); }
.nname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ntag { font-size: 10px; padding: 0 5px; border-radius: 3px; background: var(--brand); color: #fff; }
.ntag.fail { background: var(--danger); }

/* ---------- 双列 ---------- */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 1200px) { .two-col { grid-template-columns: 1fr; } }

.todo-meta { font-size: 12px; color: var(--text-3); margin: 6px 0 10px; }
.todo-meta b { color: var(--text-1); }
.todo-meta b.warn { color: var(--warn); }
.sep { margin: 0 6px; }

.materials { display: flex; flex-direction: column; gap: 2px; margin-bottom: 12px; }
.material { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-2); cursor: pointer; }
.material.done span { color: var(--text-3); text-decoration: line-through; }
.todo-actions { display: flex; gap: 8px; }
.finish-alert { margin-top: 4px; }

/* ---------- 电子签 ---------- */
.sign-block { margin-top: 4px; margin-bottom: 12px; border-top: 1px dashed var(--border); padding-top: 10px; }
.sign-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.sign-title { font-size: 12.5px; font-weight: 600; color: var(--text-1); }
.sign-canvas {
  display: block; width: 100%; height: 120px;
  border: 1px dashed var(--border); border-radius: 8px;
  background: var(--surface); cursor: crosshair; touch-action: none;
}
.sign-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }

/* ---------- AI 核对 ---------- */
.review-desc { font-size: 12px; color: var(--text-3); line-height: 1.7; margin: 6px 0 10px; }
.review-empty { text-align: center; padding: 18px 0; color: var(--text-3); font-size: 12px; }
.scan-art {
  width: 54px; height: 62px; margin: 0 auto 8px; border-radius: 8px;
  border: 2px dashed var(--border); display: flex; align-items: center; justify-content: center;
  font-size: 20px; position: relative; overflow: hidden;
}
.scan-line {
  position: absolute; left: 0; right: 0; height: 2px; top: 0;
  background: linear-gradient(90deg, transparent, var(--brand), transparent);
  animation: scan 1.8s linear infinite;
}
@keyframes scan { 0% { top: 0; } 100% { top: 100%; } }

.review-logs { background: var(--surface-2); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; max-height: 96px; overflow-y: auto; }
.rl { font-size: 11.5px; color: var(--text-3); line-height: 1.8; font-variant-numeric: tabular-nums; }

.items { display: flex; flex-direction: column; gap: 8px; }
.item { border-radius: 8px; padding: 9px 11px; border-left: 3px solid var(--border); background: var(--surface-2); }
.item.lv-high { border-left-color: var(--danger); background: rgba(239, 68, 68, 0.06); }
.item.lv-mid { border-left-color: var(--warn); background: rgba(245, 158, 11, 0.07); }
.item.lv-low { border-left-color: var(--brand); background: var(--brand-weak); }
.item.lv-ok { border-left-color: var(--ok); background: rgba(16, 185, 129, 0.07); }
.item-head { display: flex; align-items: center; gap: 6px; }
.lv-tag { font-size: 10.5px; padding: 0 6px; border-radius: 3px; background: var(--surface); color: var(--text-2); }
.item.lv-high .lv-tag { color: var(--danger); }
.item.lv-mid .lv-tag { color: var(--warn); }
.item.lv-ok .lv-tag { color: var(--ok); }
.item-field { font-size: 11px; color: var(--text-3); }
.item-title { font-size: 12.5px; font-weight: 600; margin-top: 4px; }
.item-detail { font-size: 12px; color: var(--text-2); margin-top: 2px; line-height: 1.6; }
.item-action { font-size: 11.5px; color: var(--text-2); margin-top: 4px; padding-top: 4px; border-top: 1px dashed var(--border); }

.verdict {
  margin-top: 10px; padding: 11px 13px; border-radius: 8px;
  background: var(--brand-weak); border: 1px solid var(--border);
  font-size: 12.5px; line-height: 1.75;
}
.verdict.md :deep(p) { margin: 4px 0; }
.verdict.md :deep(strong) { color: var(--brand); }
.verdict.md :deep(ul) { padding-left: 18px; margin: 4px 0; }
.verdict-actions { display: flex; justify-content: flex-end; margin-top: 8px; }

/* ---------- 审批留痕 ---------- */
.logs-timeline { margin-top: 10px; }
.log-row { display: flex; gap: 10px; }
.log-rail { display: flex; flex-direction: column; align-items: center; width: 12px; flex-shrink: 0; }
.log-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border); margin-top: 6px; }
.log-dot.ok { background: var(--ok); }
.log-dot.fail { background: var(--danger); }
.log-dot.run { background: var(--brand); box-shadow: 0 0 0 3px var(--brand-weak); }
.log-line { width: 2px; flex: 1; background: var(--border); margin: 3px 0; }
.log-body { flex: 1; padding-bottom: 12px; min-width: 0; }
.log-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; }
.log-node { font-weight: 600; }
.log-action { font-size: 11px; padding: 0 6px; border-radius: 3px; background: var(--surface-2); color: var(--text-2); }
.log-action.ok { color: var(--ok); background: rgba(16, 185, 129, 0.1); }
.log-action.fail { color: var(--danger); background: rgba(239, 68, 68, 0.1); }
.log-action.run { color: var(--brand); background: var(--brand-weak); }
.log-user { color: var(--text-2); }
.log-time { color: var(--text-3); font-size: 11px; margin-left: auto; font-variant-numeric: tabular-nums; }
.log-comment { font-size: 12px; color: var(--text-2); margin-top: 3px; padding-left: 2px; }
</style>
