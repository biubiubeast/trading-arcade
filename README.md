# 交易游乐场 · 平台 v0.3.0

一个以小游戏建立交易直觉的可扩展网站。现有两款游戏：期权积木 v0.3 用 Call、Put、现货与现金构建支付结构；波动率捕手 v0.1 在八回合动态行情中练习对冲、读取账户与解释收益来源。

## 立即使用

网站部署配置位于 `.openai/hosting.json`，静态入口为 `dist/index.html`。本项目独立于上层黄金期权项目，不依赖其服务器、密钥或数据库。

本地需要 Node.js 22 或以上，没有第三方运行依赖：

```sh
cd trading-arcade
node serve.js
# 打开 http://127.0.0.1:4173
```

检查：

```sh
node --test tests/*.test.js
node scripts/check.mjs
```

有 npm 时也可使用 `npm run dev`、`npm test`、`npm run check`。`dist/` 是直接维护的部署源码，无需构建。

## 本版新增

- 期权积木：课程工坊、三题示例、JSON 模板与参考解校验、有限枚举无解证明。
- 分享任务与组合、预览后载入、重新判题及辅助计分；旧版学习记录导入与保守合并。
- 到期支付与净损益分别显示，同题组合曲线叠加。
- 波动率捕手：六场景、三种动作、八回合决策、真实现金账本与最终退出。
- 相同路径下三种对冲基准、Greeks 归因与残差、种子恢复和最近训练记录。
- 公共外壳与游戏生命周期拆分，旧版存储及冻结档案保留，60 项自动检查。

## 页面与学习内容

- 游戏大厅、期权积木、波动率捕手、课程工坊、知识手册、学习进度、开发路线图。
- 六关：单腿看涨、牛市价差、保护性 Put、跨式、蝶式、领口。
- 点击或拖入积木、买卖方向、数量调整、组合净额合并、工具与单位限制。
- 即时 SVG 曲线、可选目标轮廓、盈亏平衡点、完整区间最大损益。
- 到期支付、净损益与到期前估值分开；调整剩余天数、IV 和情景价格。
- 逐条判题、三价格情景复盘、提示、示范、星级与本地进度、JSON 导出。
- 手机布局、键盘按钮、焦点轮廓、弹窗焦点约束、减少动画偏好。
- 路由入口：`#play`、`#gamma`、`#courses`；新游戏通过独立挂载/退出接入。

## 规则边界

期权积木：基础合成标的 S₀=100，欧式现金结算，30 天同一到期日，合约乘数 1，IV=40%，r=q=0。基础每净持仓单位建仓费 $0.10；迁移题和课程使用各自参数。调整组合是在重构持仓，初始净支出不代表保证金要求。

原有关卡按到期净损益评分，课程还可定义支付与尾部斜率条件。完整风险覆盖 S≥0，图表随初始价显示 0.6–1.4 倍的区间。到期前通过 Black–Scholes 重估，建仓成本固定。

波动率捕手：初始资金 $10,000，K100 Call/Put 各一张、每腿乘数 100。五条固定练习路径与新种子挑战；先成交再推进，每回合一次决策。标的费率和半价差各 5bps，期权开仓/提前退出费率 5bps，到期退出费为零。完整现金账本与期权重估计盈亏；Greeks 分解只用于解释。风险指标基于离散观察点，不按盈利评价能力。详见 [模型与核算](docs/GAMMA_MODEL.md)。

均为合成教学市场，无真实行情、提前行权、融资利息、保证金、强平或波动率曲面。进度保存在当前浏览器，清除站点数据会丢失；支持导出，尚无云同步。分享任务不会改变网站私密权限。谷歌字体可选，核心玩法不依赖外部服务。学习效果尚未经过用户研究。

## 开发交付资料

- [产品与验收标准](docs/PRODUCT.md)
- [技术架构与新游戏接入](docs/ARCHITECTURE.md)
- [课程与分享格式](docs/CONTENT_FORMAT.md)
- [波动率捕手金融模型](docs/GAMMA_MODEL.md)
- [开发路线与产品建议](docs/ROADMAP.md)
- [测试记录与发布检查](docs/QA.md)
- [版本管理方式](docs/GOVERNANCE.md)
- [发布档案索引](docs/releases/README.md)
- [版本变更](CHANGELOG.md)

GitHub 独立私有仓库：[biubiubeast/trading-arcade](https://github.com/biubiubeast/trading-arcade)。
网站：[交易游乐场](https://trade-arcade-payoff-lab.pearlywillow.chatgpt.site)，默认私密。

## 版本冻结

每次正式发布保存 PRODUCT / ROADMAP / QA / SUMMARY 和 VERSION.json。v0.3.0 已留档；新版本先更新当前文档与对应 SUMMARY，再运行 `node scripts/releases.mjs archive <新版本>`。已冻结版本不能覆盖。日常只读校验：`node scripts/releases.mjs verify`。详见 GOVERNANCE。

## 官方教学参考

- [OIC · Bull Call Spread](https://www.optionseducation.org/strategies/all-strategies/bull-call-spread-debit-call-spread)
- [OIC · Protective Put](https://www.optionseducation.org/strategies/all-strategies/protective-put-married-put)
- [OIC · Black–Scholes Formula](https://www.optionseducation.org/advancedconcepts/black-scholes-formula)
- [OIC · Volatility & the Greeks](https://prd-web.optionseducation.org/advancedconcepts/volatility-the-greeks)

金融机制参考官方教育材料；关卡数值、学习顺序、评分与产品规划为本项目设计。
