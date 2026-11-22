# Goal Monitor MVP — 交叉测试记录

## 版本

- 当前基线：本机工作区首版（测试版本：`npm run build` 成功后更新）。
- 主实现者：Codex（Claude agent 两次在启动前超时；未提供代码）。
- 独立审查：Antigravity 已完成工作流审查与本机 MVP 浏览器交叉测试；发现的移动端缺陷由 Codex 修复并复测。
- Cloud：当前 Orca 本机 agent 列表无 Cloud worker。

## Task-level verification

| 功能/Task 对照 | 实现证据 | Codex 可执行检查 | Codex 结果 | 独立测试者/结果 |
|---|---|---|---|---|
| T00 项目骨架 | `package.json`, `vite.config.ts`, `README.md` | `npm run build`；浏览器打开本地页面 | 通过 | Antigravity 独立构建通过 |
| T10/T20 目标与项目编辑 | `src/App.tsx` GoalEditor、Goal map、project | UI 测试/本地浏览器修改后状态检查 | 通过 | Antigravity 验证编辑、保存和目标地图通过 |
| T11 任务证据状态 | `src/model.ts`, `TaskCard` | `npm test`：计划与确认状态计数、待确认不判失败 | 通过 | Antigravity 验证待确认、未观察、确认/撤销状态通过 |
| T12 Today/项目/目标/复盘视图 | `src/App.tsx`, `src/styles.css` | 浏览器导航、操作、窄屏、抽屉收起 | 通过；修复移动端抽屉后再次手动验收 | Antigravity 独立复测全部通过：390×844 视口下验证抽屉展开、内部 X 关闭、外部遮罩关闭、次级项目导航、偏好设置弹窗均正常，0 控制台错误 |
| T13/T52 本地提醒配置 | `src/reminders.ts`, `src/reminders.test.ts`, `src/App.tsx` | 本机提醒偏好、应用内专注块/复盘提醒、显式通知授权 | 通过：3 项提醒断言、组件偏好测试 | Antigravity Phase 2 独立验收通过：授权只由按钮触发；应用内降级和偏好持久化有效 |
| T14 AI provider/确认边界 | 仅本地静态建议卡；无真实 provider | 检查 UI 明示未连接、建议接受/关闭路径 | 通过 | Antigravity 验证未连接声明与建议卡状态通过 |
| T20–T24 日/周/双周/月末复盘 | `ReviewModal`、`ReviewsPage` | `npm test`：日终、每周决策与历史 | 通过 | Antigravity 验证日终/每周复盘及历史通过；四类入口与数据状态通过 |
| T50 ICS 生成 | `src/calendarExport.ts`, `src/calendarExport.test.ts` | RFC 5545 iCalendar (.ics) 纯函数生成 | 通过：31 项 RFC 5545 断言 | Antigravity 实现并自测；Codex 与后续 Phase 2 独立复核通过 |
| T51 排期与导出界面 | `src/App.tsx`, `src/model.ts`, `src/App.test.tsx` | 新增/编辑排期、刷新持久化、仅导出已安排任务、手动导入说明 | 通过：组件测试 + 浏览器下载 `northstar-focus-blocks.ics` | Antigravity 独立验收通过；未安排状态禁用导出；无远端日历写入 |
| T52/T53 提醒设置与调度 | `src/reminders.ts`, `src/reminders.test.ts`, `src/App.tsx` | 偏好保存、触发窗口、重复抑制、权限拒绝与本地时间 | 通过：3 项提醒单测 + 组件偏好测试 | Antigravity 独立验收通过；权限显式点击申请，当前页面运行时提醒；DST 与去重场景通过 |
| T30–T33 OAuth/外部证据/真实 AI | 尚未实现 | 后续真实账户授权与外部服务合同测试 | 未开始 | 不属于当前 MVP / Phase 2 |
| T40–T44 发布级全流程 | 依赖 OAuth、AI、外部证据等完整集成 | 完整端到端与发布审计 | 未完成 | 当前阶段只完成本机 MVP 与 T50–T54；没有 Cloud worker |
| MVP / Phase 2 本地流程 | 当前工作区代码 | `npm test`、`npm run build`、MVP 浏览器主路径 | 通过：48 tests、build；MVP 时曾运行 audit 无漏洞 | Antigravity 分别完成 MVP 与 Phase 2 独立验收 |

## Phase 2 独立验收（2026-11-20）

- **版本范围**：T50–T53，实现文件包含 ICS 生成模块、任务排期、本机提醒设置和当前页面提醒调度。
- **自动检查**：Antigravity 独立运行 `npm test`（48/48）与 `npm run build`（通过）；Codex 同样运行并通过。
- **浏览器流程**：在 Orca 浏览器设置行动日期/时间及 45 分钟时长，保存并刷新后数据仍在；设置页显示已安排 1 项，点击后浏览器下载 `northstar-focus-blocks.ics`。
- **边界检查**：未安排任务时导出按钮禁用；导出说明为用户手动导入的单向文件；通知权限不在初次渲染请求，只在显式按钮点击后请求；拒绝系统权限仍可使用应用内提醒。
- **提醒检查**：Antigravity 验证活跃页面触发、重复抑制、本地时间/DST 场景；3 项 `reminders.test.ts` 断言覆盖专注块、日终/周复盘、停用和窗口边界。
- **响应式检查**：Antigravity 在 320px 窄屏检查设置弹窗无水平溢出；Codex 在 390×844 视口确认排期设置、导出与提醒控件可见且布局正常。
- **缺陷**：未发现阻塞缺陷；没有修改源代码的 QA 任务。
- **限制**：ICS 不进行账户同步；提醒要求页面运行，后台/浏览器关闭时不保证触达。Cloud worker 未配置，未作第三方复核。

## Phase 3a 当前执行：每日目标反馈

| Task | 实现证据 | Codex 检查 | 独立交叉测试 |
|---|---|---|---|
| T55 反馈规则 | `src/feedback.ts`, `src/feedback.test.ts` | 覆盖排期、待核实、未排期、进行中、全完成及空任务 | Antigravity 独立检查 7 种任务状态，通过 |
| T56 首页反馈卡 | `src/App.tsx`, `src/App.test.tsx`, `src/styles.css` | 点击建议行动后进入项目页并标记进行中；56 项全套测试与构建通过；390px 页面横向无溢出 | Antigravity Chrome/CDP 实测通过，无水平溢出 |
| T57 独立验收 | Antigravity 只读验收 | `npm test` 56/56，`npm run build` 通过 | **通过**；demo 状态恢复，未修改文件 |

反馈只使用已保存的排期与任务状态；未更新不会被自动解释为失败，系统不声称行动投入已产生薪资或面试等外部结果。

## Phase 3b 当前执行：复盘自动汇总

| Task | 实现证据 | Codex 检查 | 独立交叉测试 |
|---|---|---|---|
| T58 区间状态统计 | `src/feedback.ts`, `src/feedback.test.ts` | 日/周/双周/月窗口，周一至周日、自然月、本地日期、待核实及无排期状态均有测试 | Antigravity 独立检查日期边界和当前状态统计，通过 |
| T59 复盘弹窗汇总 | `src/App.tsx`, `src/App.test.tsx`, `src/styles.css` | 日终回顾实测显示状态摘要；390×844 弹窗 354px 内容宽度，无横向溢出；摘要不是自动决定 | Antigravity 浏览器验证日/周/月摘要展示及输入保存通过 |
| T60 独立验收 | Antigravity 只读验收 | `npm test` 60/60，`npm run build` 通过 | **通过**；390×844、无水平溢出、demoState 恢复、未改文件 |

日期窗口表示任务被安排的时间范围；汇总的是任务当前状态，不声称该状态或成果是在窗口中的某一天发生。

## Phase 3c：职业/财务结果指标

| Task | 实现证据 | Codex 检查 | 独立交叉测试 |
|---|---|---|---|
| T61 指标数据模型 | `src/model.ts`, `src/metrics.ts` | 多指标、升/降方向、进度边界与旧 localStorage 数据迁移有覆盖 | Antigravity 只读检查通过 |
| T62 指标表单与仪表盘卡片 | `src/App.tsx`, `src/styles.css` | 实测添加、保存、更新当前值；结果信号与每日行动分开；无预填金额 | Antigravity 浏览器走查通过 |
| T63 自动化与响应式检查 | `src/metrics.test.ts`, `src/model.test.ts`, `src/App.test.tsx` | `npm test` 67/67；`npm run build` 通过；390px 浏览器窗口 document width 等于 viewport，无横向溢出 | Antigravity 独立运行测试/构建并验证 390×844，无溢出 |
| T64 独立验收 | 本地演示数据已恢复；没有留下测试指标 | 所有上述项目通过自测 | **通过，0 缺陷**；完整报告：`~/.gemini/antigravity-cli/brain/33196740-ddb0-4898-8d45-ba59274daf5c/phase-3c-acceptance-report.md` |

测试指标仅用于浏览器走查，验收后已通过“恢复演示数据”删除；当前仪表盘仍为空，不含任何模拟财务金额。系统不连接银行账户或其他外部财务来源。

## Phase 3d：结果指标历史趋势

| Task | 实现证据 | Codex 检查 | 独立交叉测试 |
|---|---|---|---|
| T65 历史快照与迁移 | `src/model.ts`, `src/App.tsx` | 新建指标记下当前起点；每次更新追加本机时间/数值/备注；旧指标无历史时迁移为空 | Antigravity 静态检查与浏览器更新复测通过 |
| T66 Dashboard 趋势图 | `src/App.tsx`, `src/metrics.ts`, `src/styles.css` | SVG 标注历史数值点与基线/目标参考线；无历史显示提示；有 aria-label | Antigravity 检查参考线、记录点和可访问标签，通过 |
| T67 自动化覆盖 | `src/metrics.test.ts`, `src/model.test.ts`, `src/App.test.tsx` | `npm test` 69/69；`npm run build` 通过；390px 实测 document width 等于 viewport | Antigravity 独立运行全套测试/构建，通过 |
| T68 独立验收 | 本地演示数据已恢复；无测试记录遗留 | 自测无阻塞 | **通过，零缺陷**；报告：`~/.gemini/antigravity-cli/brain/9dc1a516-8167-424d-a6b3-5a556ec8246b/phase-3d-acceptance-report.md` |

## Phase 3e：复盘结果信号

| Task | 实现证据 | Codex 检查 | 独立交叉测试 |
|---|---|---|---|
| T69 共享日期窗口 | `src/feedback.ts` | 日/周/双周/月都复用 review date range 计算，避免任务与指标窗口偏差 | Antigravity 独立检查区间一致性通过 |
| T70 指标期间汇总 | `src/metrics.ts`, `src/App.tsx` | 区间内快照和变化；无更新提示最近值；明确不代表因果 | Antigravity 验证 0/1/多点及基准逻辑通过 |
| T71 测试与窄屏 | `src/metrics.test.ts`, `src/feedback.test.ts`, `src/App.test.tsx` | `npm test` 73/73；`npm run build` 通过；周复盘 390×844 浏览器检查，弹窗宽 354px，无溢出 | Antigravity 独立运行 73/73 与构建，通过；无溢出 |
| T72 独立交叉验收 | 依赖 T69–T71 | 已实现且自测全通过 | **通过，零缺陷**；报告：`~/.gemini/antigravity-cli/brain/f5cb6066-4f93-487a-9c43-54bec36d4b6b/phase-3e-acceptance-report.md`；演示数据恢复 |

## Phase 4a：多目标工作区

| Task | 实现证据 | Codex 检查 | 独立交叉测试 |
|---|---|---|---|
| T73 工作区模型和迁移 | `src/model.ts` | 旧单目标、选择目标和状态回写测试通过 | Antigravity 独立静态检查与迁移场景通过 |
| T74 新建和切换 UI | `src/App.tsx`, `src/styles.css` | 新建名称/五年方向；目标切换后各自投影数据 | Antigravity iPhone 12 390×844 实测通过 |
| T75 持久化与响应式测试 | `src/model.test.ts`, `src/App.test.tsx` | `npm test` 77/77；`npm run build` 通过；390×844 新建、刷新、切换走查；数据已恢复演示状态 | Antigravity 独立运行 77 项、构建、刷新恢复和无溢出通过 |
| T76 独立交叉验收 | 依赖 T73–T75 | 全部验收标准通过 | **通过，零缺陷**；报告：`~/.gemini/antigravity-cli/brain/94edd1bb-f565-4443-b48a-b8e2563cc993/phase_4a_t73_t76_acceptance_report.md` |

## Phase 4b：跨目标日历与提醒

| Task | 实现证据 | Codex 检查 | 独立交叉测试 |
|---|---|---|---|
| T77 周议程与 ICS 组装 | `src/goalCalendar.ts`, `src/goalCalendar.test.ts` | 覆盖多目标日期排序、周边界、日历保留跳过项用于恢复、ICS 排除跳过项/未排期项及唯一 UID | **通过**；独立验收见下方 Phase 4b 记录 |
| T78 全目标日历页 | `src/App.tsx`, `src/styles.css` | 周翻页、目标标签、点击跳转到拥有任务的目标；390px 浏览器走查 | **通过**；Antigravity 浏览器验收通过 |
| T79 所有目标 ICS | `src/App.tsx`, `src/calendarExport.ts` | 全目标已排期未跳过任务聚合，标题添加目标名，人工单向导出说明 | **通过**；独立检查 RFC 5545、UID 和导出范围 |
| T80 跨目标提醒/独立验收 | `src/reminders.ts`, `src/reminders.test.ts` | 提醒 key 包含工作区避免跨目标撞键；提醒正文带目标名并定位目标 | **通过，零缺陷**；Antigravity 全流程验收通过 |

## 已新增自动化覆盖

- `src/model.test.ts`：安排投入不等于确认产出；仅显式确认计入产出；待确认状态不视为失败；本地年月日键按本地日历字段生成。
- `src/reminders.test.ts`：本地时区提醒窗口计算；专注块提前提醒；日终与周复盘触发判定。
- `src/calendarExport.test.ts`：RFC 5545 标准属性格式；行折叠（75 字节）；特殊字符转义；时区与夏令时边界；时段换算与 UID 生成。
- `src/App.test.tsx`：目标与计划/产出说明展示；显式确认任务；新增带完成标准的行动；保存并展示日终复盘；专注块安排与 .ics 导出；本机提醒偏好持久化；移动端抽屉打开、关闭按钮、遮罩、Escape 及次级链接导航测试。

## 交叉测试状态

Antigravity 于首轮独立测试通过 11 项测试、生产构建、安全审计和浏览器主路径，报告 0 控制台错误，同时发现抽屉关闭交互缺陷。Codex 随后添加了抽屉关闭按钮、外部遮罩、Escape 监听及次级导航自动收起，并在组件测试中新增了抽屉交互用例。

在二轮复测中，Antigravity 在 390×844 移动视口下完成了独立自动化与交互式复测（Task: `task_94c543b83b3b`），确认以下修复项完全合格：
1. 抽屉通过右上角 X 按钮可靠关闭；
2. 抽屉通过点击外部半透明遮罩层（scrim）可靠关闭；
3. 点击次级项目链接（`mini-project`）自动关闭抽屉并进入当前项目页；
4. 点击账户/偏好链接（`profile`）自动关闭抽屉并唤起设置模态框；
5. Today 区域主标题已正确命名为「今日与本周行动」；
6. `npm test`（12/12 通过）、`npm run build`（0 错误通过）、`npm audit`（0 漏洞）及 0 控制台错误。

至此，Codex 与 Antigravity 对本机 Goal Monitor MVP 的跨 Agent 独立交叉测试已**完全闭环并判定通过**。后续阶段将根据开发计划接入真实日历 OAuth、GitHub/项目板证据同步及外部 AI 服务。

## Phase 4b：跨目标日历与提醒（独立验收通过）

| Task | 实现证据 | Codex 检查 | 独立交叉测试 |
|---|---|---|---|
| T77 周议程与 ICS 组装 | `src/goalCalendar.ts`, `src/goalCalendar.test.ts` | 83 项测试与生产构建通过；本地周边界、排序及 UID 覆盖 | Antigravity 独立验收：16 项 scratch 测试通过；周边界和 RFC 5545 内容正确。之后 Phase 4c 缺陷修复使跳过行动留在应用议程便于恢复，ICS 仍过滤 |
| T78 全目标日历页 | `src/App.tsx`, `src/styles.css` | 多目标标签、周切换、所属目标点击跳转；390×844 无水平溢出 | Antigravity 浏览器走查通过，跨目标 click-through 正确 |
| T79 所有目标 ICS | `src/App.tsx`, `src/calendarExport.ts` | 所有目标合并导出，仅排期且未跳过任务 | Antigravity 验证目标标签、唯一 UID、跳过/未排期排除及单向导出提示通过 |
| T80 跨目标提醒/独立验收 | `src/reminders.ts`, `src/reminders.test.ts` | 目标名、所属工作区跳转、跨工作区去重键测试 | **通过，零缺陷**；报告：`~/.gemini/antigravity-cli/brain/4e5a6570-44ea-46df-a130-e7152146e32a/phase_4b_t77_t80_acceptance_report.md`；演示数据恢复 |

- 自动检查：`npm test -- --run` 83/83；`npm run build` 通过。
- 浏览器检查：390×844 宽度无溢出；所有目标周议程显示、跳转到拥有任务的目标成功；临时测试数据通过 UI 恢复。
- Phase 4b 完成；Phase 4c T81–T84 开始实现日历行动执行和证据反馈。

## Phase 4c：日历行动执行与证据（修复后独立验收通过）

| Task | 实现证据 | Codex 检查 | 独立交叉测试 |
|---|---|---|---|
| T81 日历行动状态转换 | `src/App.tsx`, `src/model.ts` | `npm test -- --run` 85/85；开始状态写回所属目标，显式确认后才计为完成 | Antigravity 初验及修复后复验通过；跨目标无串改 |
| T82 完成证据记录 | `ActionTask.evidenceNote`, `src/App.tsx` | 确认时写入用户证据说明，保留完成标准/证据类型；localStorage 持久化 | Antigravity 验证取消确认安全、导航/刷新后证据持久化 |
| T83 日历执行控件 | `src/App.tsx`, `src/styles.css` | 浏览器验证开始→进行中→确认完成；跳过/恢复操作与状态明确 | Antigravity 390×844 复测无溢出、零控制台错误 |
| T84 Phase 4c 独立验收 | Codex 自测通过，演示数据已恢复 | `npm test -- --run` 85/85；`npm run build` 通过；跨目标数据只更改所属目标 | **通过，零遗留缺陷**；修复复测报告见下方 |

### DEFECT-PHASE4C-01：跳过的行动无法从日历恢复

- **发现者**：Antigravity 独立验收（报告：`~/.gemini/antigravity-cli/brain/5ed3d9d4-fbc6-4951-bd59-050e055ca1ac/phase_4c_t81_t84_acceptance_report.md`）。
- **复现**：日历中对已排期行动点「跳过」；行动从议程消失，因此无法点「恢复」。
- **严重度**：中；用户可从项目页找回，但日历闭环不完整。
- **修复**：`buildGoalAgenda` 现在保留本周所有已排期行动（含已跳过），UI 显示「已跳过」并提供恢复；ICS 导出仍排除跳过项。`goalCalendar.test.ts` 及 `App.test.tsx` 新增覆盖。
- **修复后本地复测**：85 项测试通过，`npm run build` 通过；已新增 agenda helper 与组件恢复用例。
- **修复后独立复测**：Antigravity 确认跳过项在议程显示「已跳过」并可恢复为计划中；ICS 排除跳过项；跨目标隔离、390×844、零控制台错误均通过。报告：`~/.gemini/antigravity-cli/brain/ebeec684-ed1d-45f8-a0c6-9e7df38d34a6/phase_4c_defect_phase4c_01_retest_report.md`；临时数据通过 UI 清理。

- 浏览器实测环境为 839px 桌面视口；临时两个工作区数据通过「连接与隐私 → 恢复演示数据」清理，当前演示数据为 1 个目标、3 个未排期任务。
- 初次独立验收确认状态隔离、显式确认、完成证据、取消确认安全、导航持久化及 390×844 布局通过；发现的 DEFECT-PHASE4C-01 已关闭。

## Phase 4d：周复盘到下周行动（独立验收通过）

| Task | 实现证据 | Codex 检查 | 独立交叉测试 |
|---|---|---|---|
| T85 周复盘行动草案 | `src/App.tsx` ReviewModal | 仅周复盘显示可选项；标题取自用户下一步，要求完成标准，可选排期 | Antigravity 30 个浏览器场景通过 |
| T86 复盘与行动保存 | `src/App.tsx` saveReview | 同一状态更新保存复盘与计划行动；不选行动时不新增；写入当前目标工作区 | 切换目标与刷新持久化通过 |
| T87 测试与响应式 | `src/App.test.tsx`, `src/styles.css` | `npm test -- --run` 86/86；`npm run build` 通过；新行动仍为 planned | 390×844 无溢出、零控制台错误 |
| T88 Phase 4d 独立验收 | 周复盘→行动创建→日历路径 | Codex 自动化测试/构建及浏览器检查通过 | **通过，零缺陷**；30 个浏览器场景、演示数据恢复，报告：`/tmp/qa_phase4d_results.json` |

## Phase 4e：多目标今日行动总览（独立验收通过）

| Task | 实现证据 | Codex 检查 | 独立交叉测试 |
|---|---|---|---|
| T89 跨目标今日选择器 | `src/goalCalendar.ts`, `src/goalCalendar.test.ts` | 本地年月日筛选；过滤跳过/无效日期，按时序排序 | Antigravity 本地日期范围、过滤和排序独立检查通过 |
| T90 首页其他目标行动总览 | `src/App.tsx`, `src/styles.css` | 显示目标标签、完成标准、任务状态和空状态 | 390×844 浏览器验收通过，无横向溢出 |
| T91 所属目标状态交互 | `src/App.tsx`, `src/App.test.tsx` | `npm test -- --run` 88/88；确认记录用户证据并只更新所属工作区 | 跨目标隔离、刷新、目标跳转与证据写回通过 |
| T92 Phase 4e 独立验收 | 当前本地应用 | `npm run build` 通过；演示数据已恢复 | **通过，零缺陷**；报告：`~/.gemini/antigravity-cli/brain/40e539ad-3591-4ce6-b356-38c584e714db/scratch/acceptance-report.md` |

## Phase 4f：跨目标周投入预算（独立验收通过）

| Task | 实现证据 | Codex 检查 | 独立交叉测试 |
|---|---|---|---|
| T93 周预算模型和聚合 | `src/model.ts`, `src/weeklyCapacity.ts` | 92 项测试；本周边界、跨目标求和、跳过/无效日期过滤、旧数据默认 0 | Antigravity 独立模型检查通过 |
| T94 首页预算卡 | `src/App.tsx`, `src/styles.css` | 用户可编辑分钟预算；余量/超预算提示；不会更改行动或完成状态 | Antigravity 手机浏览器测试通过 |
| T95 自动化测试与窄屏 | `src/weeklyCapacity.test.ts`, `src/model.test.ts`, `src/App.test.tsx` | `npm test -- --run` 92/92；`npm run build` 通过 | 390×844 无溢出，预算持久化通过 |
| T96 Phase 4f 独立验收 | 当前本地应用 | Codex 自动检查通过 | **通过，零缺陷**；演示数据恢复：1 个目标、3 项任务、0 排期、预算未设置 |

## Phase 4g：本机 MVP 端到端集成验收（通过）

| Task | 集成场景 | 独立交叉测试 |
|---|---|---|
| T97 目标→周复盘→行动 | 多目标创建、周复盘草案、行动完成标准、可选排期 | Antigravity 全链路通过；新行动归属和日历排期正确 |
| T98 行动→证据→复盘 | 今日总览/周日历、状态变化、跳过恢复、证据记录和复盘状态 | Antigravity 数据一致性通过；确认产出与行动状态一致 |
| T99 指标/预算/数据生命周期 | 结果指标更新、周预算、JSON 备份、演示数据恢复 | 指标未改写行动状态；预算仅反馈；JSON 和演示恢复流程通过 |
| T100 集成验收 | `npm test -- --run` 92/92；`npm run build` 通过 | **通过，零缺陷**；390×844 无溢出、零控制台错误；演示数据恢复 |

验收只涵盖当前本机 localStorage MVP；真实日历 OAuth/同步、自动 AI provider、GitHub/项目板证据同步、手表/手机硬件采集、账户登录与跨设备云同步未连接。
