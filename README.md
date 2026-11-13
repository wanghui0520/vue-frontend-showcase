# 智研工作台 · AI 应用前端工程能力展示

一个"AI 应用前端"完整演示：登录 → 应用骨架（侧边导航 / 暗黑模式）→ 数据面板 → AI 业务页面。所有 AI 响应由 mock 服务按真实协议（LangChain messages / 自定义事件）流式生成——重点展示前端链路（传输 / 解析 / 渲染 / 状态管理），不依赖任何后端或算力资源。

## 页面一览

| 页面 | 展示能力 |
| --- | --- |
| 登录 | mock 鉴权、loading 态、会话持久化 |
| 数据面板 | ECharts 图表（主题联动重绘）、统计卡片、状态表格 |
| AI 流式对话 | 自研 SSE 客户端、多协议兼容解析、CoT 可视化、中断 / 重试 |
| AI 数据提取 | 文本 → 结构化字段流式抽取、置信度标记、人工兜底编辑、CSV 导出 |
| Agent 执行可视化 | 节点状态机（running / done / fail→retry）、实时日志、最终产出 |
| 可编辑表格 | useTable / useTableEdit hooks、字典双层缓存 |
| 关系图谱 | AntV G6 力导向布局、拖拽缩放、快照导出 |

## 在线预览

- **海外线路**：<https://vue-frontend-showcase.vercel.app>
- **源码**：<https://github.com/wanghui0520/vue-frontend-showcase>

> 注：EdgeOne（腾讯）部署版需登录后访问预览链接（平台合规策略），故对外以 Vercel 与源码为准；本地运行见下文，`npm run dev` 即可体验全部交互。

### 核心实现细节

### ① SSE 流式对话（`src/views/SseChat.vue`）

- **自研 SSE 客户端**（`src/utils/requestStream.js`）：Fetch + ReadableStream，按 `\n\n` 切分完整帧、处理半帧粘包；`AbortSignal.any` 合并「用户中断」与「超时」信号；错误按 HTTP / 网络 / 超时 / 中断分型
- **多协议兼容解析层**（`src/utils/aiApi.js`）：同一套逻辑兼容 `AIMessageChunk`（字符串 / `[{text}]` 数组 / `kwargs.content`）、`tool_calls` 中的 `AgentOutput.answer`、以及 content 文本内 `answer='...'` 形态；过滤噪声工具调用
- **交互**：思考过程面板（可展开）、Markdown 流式渲染（marked）、滚动吸底、随时中断、空回复失败态与重新提问

### ② 可编辑表格 + 字典缓存（`src/views/EditableTable.vue`）

- `useTable` / `useTableEdit` 组合式函数：分页加载、行内编辑状态机（草稿态，未保存不污染源数据）、必填校验
- 字典双层缓存（`src/utils/dict.js`）：同一字典全局只请求一次，命中缓存零请求

### ③ 关系图谱（`src/views/GraphView.vue`）

- AntV G6 力导向布局：人物 / 企业 / 资金账户三类节点、拖拽、缩放、Tooltip 详情、画布快照导出

## 本地运行

```bash
npm install
npm run dev     # http://localhost:5180
```

## 部署（Vercel，免费）

```bash
npm i -g vercel
vercel          # 按提示登录并部署
```

部署后 `/api/chat/stream` 由 `api/chat.js`（Vercel Serverless，流式响应）承接，与本地 vite 中间件行为一致。

## 说明

本项目为个人技术演示，代码独立编写，与任何公司项目无关。
