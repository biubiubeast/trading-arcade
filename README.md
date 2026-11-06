# 交易游乐场 · 期权积木 v0.1

一个以小游戏建立交易直觉的可扩展网站。第一款游戏 Payoff Puzzle 用 Call、Put、现货与现金构建收益结构，提供六个递进关卡和自由实验。

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
node --check dist/js/app.js
```

有 npm 时也可使用 `npm run dev`、`npm test`、`npm run check`。`dist/` 是直接维护的部署源码，无需构建。

## 已实现

- 游戏大厅、期权积木、知识手册、学习进度、开发路线图五个页面。
- 六关：单腿看涨、牛市价差、保护性 Put、跨式、蝶式、领口。
- 点击或拖入积木、买卖方向、数量调整、组合净额合并、工具与单位限制。
- 即时 SVG 曲线、可选目标轮廓、盈亏平衡点、完整区间最大损益。
- 到期损益与到期前估值分开；调整剩余天数、IV 和情景价格。
- 逐条判题、三价格情景复盘、提示、示范、星级与本地进度、JSON 导出。
- 手机布局、键盘按钮、焦点轮廓、弹窗焦点约束、减少动画偏好。
- 20 项自动检查覆盖模型、风险、关卡可解性和存储容错。

## 规则边界

合成标的 S₀=100，欧式现金结算，30 天同一到期日，合约乘数 1，IV=40%，r=q=0。每净持仓单位建仓费 $0.10。调整组合是重构持仓，不是模拟连续买卖流水。初始净支出不代表保证金要求。

评分始终按到期损益，覆盖 S≥0。图表显示 $60–140，最大风险仍包含图外区间。到期前估值通过 Black–Scholes 重估；建仓成本固定。无真实行情、提前行权、保证金、强平、流动性、价差或波动率曲面。

进度只保存在当前浏览器，不跨设备同步；清除站点数据会清除进度。未来游戏入口明确标记为计划，不是已开发功能。谷歌字体是可选增强，加载失败使用系统字体，核心玩法不依赖外部服务。

## 开发交付资料

- [产品与验收标准](docs/PRODUCT.md)
- [技术架构与新游戏接入](docs/ARCHITECTURE.md)
- [开发路线与产品建议](docs/ROADMAP.md)
- [测试记录与发布检查](docs/QA.md)

## 官方教学参考

- [OIC · Bull Call Spread](https://www.optionseducation.org/strategies/all-strategies/bull-call-spread-debit-call-spread)
- [OIC · Protective Put](https://www.optionseducation.org/strategies/all-strategies/protective-put-married-put)
- [OIC · Black–Scholes Formula](https://www.optionseducation.org/advancedconcepts/black-scholes-formula)

金融机制参考官方教育材料；关卡数值、学习顺序、评分与产品规划为本项目设计。
