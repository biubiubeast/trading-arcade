# 技术架构 · 平台 v0.4.0

原生 ES Modules、HTML/CSS/SVG，零第三方运行依赖，无构建步骤。dist 为直接部署源码。Node 22+ 用于预览、测试、语法检查和归档，本轮验证 Node24。

## 外壳与路由

core/shell.js 提供导航；core/navigation.js 控制 mount/unmount。app.js 只负责装配和原有 Payoff 工作区。Gamma、Structured 为独立控制器，使用 AbortController 注册/释放 document 事件，避免跨路由重复成交。课程编辑是独立内容控制器。三个游戏均注册为真实 live，大厅 start 按 game ID 路由。

| 模块                 | 职责                                                 |
| -------------------- | ---------------------------------------------------- |
| engine.js            | BS、静态净持仓、解析风险与条件判题                   |
| content.js           | 封闭 schema、带路径错误、参考解/枚举、分享与进度重验 |
| course-ui.js         | 导入/预览/确认、收藏和编辑入口、分享与记录合并       |
| course-library.js    | 内容版本指纹、去重、修订、12 版本上限及恢复          |
| course-editor.js     | 表单呈现与候选对象读取；空数值拒绝，不直接写成绩     |
| gamma/engine.js      | 确定路径、Greeks、现金流水、重估、结算和策略         |
| gamma/rules.js       | 四参数白名单、预测概念、配对批次、统计/敏感性        |
| gamma/view.js        | 规则锁定、学习步骤、恢复、只读回放、实验与导出       |
| structured/engine.js | 标准条款、复制成本、客户/发行方或柜台账本、提交条件  |
| structured/view.js   | 客户委托、条款试算、图/账本、档案恢复与导出          |
| scripts/releases.mjs | 冻结文档、源码 SHA-256 清单与防覆盖校验              |

## 三种经济语义

Payoff 编辑最终净持仓，费用按最终绝对单位数，撤销不代表真实交易冲销。Gamma 每次成交改变现金、仓位、费用和价差，最后全平；完整重估核算，Greeks 仅作解释。Structured 使用按产品模板生成的资产与负债，不复用整数积木限制；参与率允许小数。现金单位为实际美元，不能误当作 $10 积木数量。

结构化票据价格 100，资金分为资产、费用与留存；已有现货 Collar 用禀赋和执行柜台视角，不重复收取 100。金融细节见 GAMMA_MODEL、STRUCTURED_MODEL。

## 本地存储与兼容

| 键                            | 格式与行为                                                 |
| ----------------------------- | ---------------------------------------------------------- |
| trade-arcade:payoff:v2        | 继续原存储，active customCourse 保留，导出 envelope 仍为 3 |
| trade-arcade:courses:v1       | 最多 12 个合法课程版本；原 active 仅首次初始化时迁移       |
| trade-arcade:course-editor:v1 | 一份通过校验的编辑草稿，未通过候选不持久化                 |
| trade-arcade:gamma:v2         | 当前会话/最近 12 局、锁定四规则、预测与解释，下次规则另存  |
| trade-arcade:gamma:v1         | 只作旧版读取源，不删除；默认成本、阈值与间隔恢复           |
| trade-arcade:structured:v1    | 当前任务、有效设计草稿与重新验算的完成记录                 |

Gamma 重新生成种子路径并重放决策，不信任存储现金/分数；已成交未推进的动作只执行一次。实验结果在内存，显式 JSON 导出后可留存，尚无外部实验导入。旧局价格/成本未改变；规则版本 2 加入可配置比较与学习步骤。

课程收藏指纹为本地内容导航用途，不是签名；改题会改变 runtime task ID。只改课程名称不会改题目成绩。外部文字转义，未知字段/脚本/任意公式被拒绝。导入预览不写状态，确认后保守合并；课程收藏和其他游戏存储不由学习记录导入覆盖。

## 发布

保留原 Sites 项目和 owner-private 访问。GitHub 为 biubiubeast/trading-arcade 私有仓库。两端提交元数据可能不同，比较 Git tree 确保同一文件内容。冻结 docs/releases/v0.4.0 的四文档，最终提交/CI/部署记于外部收据与 Release。

没有服务端可信成绩、云同步或个人资料收集。新增联网能力、任意公式、不同期限/乘数、信用/融资/保证金都需要单独定义语义和兼容规则。
