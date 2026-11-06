# 技术架构 · v0.2.0

原生 ES Modules + HTML/CSS/SVG，零第三方运行依赖、无构建步骤。dist 是直接部署的源码目录。开发环境 Node 22+，本次验证 Node 24。

| 模块 | 职责 |
|---|---|
| engine.js | 定价、固定建仓成本、完整区间风险、合法性和判题；显式接受 market 参数 |
| levels.js | 六个基础关与自由实验配置 |
| learning.js | 三个迁移关、六个预测题、快照、分支与恢复纯函数 |
| storage.js | payoff:v2 命名空间、v1 无损读取迁移、结构边界校验 |
| ui.js | 图标、金额与工具名称展示 |
| app.js | 页面外壳、当前市场绑定、DOM 事件、图表、问答/回放/对照 |
| scripts/releases.mjs | 冻结版本文档与校验 SHA-256 清单 |
| scripts/check.mjs | JS 语法和版本档案检查 |

## 定价与判题

`Leg={type,strike,qty}`，qty 为整数净数量，乘数 1。`Market={spot,days,vol,fee,multiplier}`。基础 MARKET 保留不变，迁移题独立覆盖参数。所有 quote/debit/pnl/analyze/checkLevel 必须使用该题 market；改变估值 IV 不能改变固定建仓成本。

费用为最终净持仓的绝对单位数×fee。到期价值减净建仓成本得净损益。风险继续解析检查 S=0、执行价折点和无限远尾部，图表采样仅用于展示。未建立逐笔交易现金账本。

## 学习状态

`trade-arcade:payoff:v2`：completed、drafts、hintUse、predictions、sessions、comparisons、lastLevel、lastTransfer、lastMode。读取旧 `trade-arcade:v1` 但不删除；后续保存使用新键。预测存首次 choice，正确与否从当前题库重算。题库语义若变更，应使用新的稳定题目 ID。

每个关卡一个 timeline：cursor + 至多 50 个深复制持仓快照。撤销/重做只移动游标，撤销后编辑截断旧未来。恢复时校验每步工具、数量和执行价，并检查游标快照与当前草稿一致；异常时从当前合法草稿重建。提示状态不属于可撤销持仓，避免撤销绕过星级规则。

每题可保存一个对照，只能在本题规则下读取。回放是只读的持仓观察，不假装是交易成交或现金流水。开始新尝试清空当前回放，不提供所有历史尝试的长期分析。

## 下一个架构节点

本版不承诺完整插件系统。games.js 注册元数据，但新游戏仍需真实 renderer、独立引擎和进度模块。第二款游戏前抽取 app.js 的 shell、modal、chart、play view 及 mount/unmount 生命周期，采用每游戏独立命名空间。当前零依赖实现可继续验证产品；不为尚未确定的多人模式提前引入数据库。

## 发布与 GitHub

Sites 身份只在 `.openai/hosting.json` 管理，不创建重复 Site。GitHub 是独立私有源码与版本档案仓库，Sites 是部署镜像。两者可能有不同提交 SHA，但交付文件需相同；正式发布前校验源码内容，不用一次空提交假装新构建。

部署流程复用 Sites 官方 source helper：同步 → 检查 → 提交推送 → 归档 → 保存并发布同一版本。短期凭据只在会话内经 stdin 传递，不写入源码或文档。仓库不包含上层目录的 .env、交易数据或其他项目文件。
