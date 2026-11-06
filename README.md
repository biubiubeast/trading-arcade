# 交易游乐场 · 平台 v0.4.0

三款可玩的交易学习游戏，共用网站外壳、独立规则与本地记录。无第三方运行依赖，不连接真实行情或交易。

- **期权积木 v0.4**：六基础关、三迁移关、预测/回放/分享；新增可视化课程编辑、参考解校验、12 个内容版本收藏与改版预览。
- **波动率捕手 v0.2**：六场景、八回合动态对冲、自融资账本；新增锁定阈值/间隔/成本、首次预测与解释、自动策略回放、32 新路径配对比较、成本敏感性和导出。
- **结构化产品工坊 v0.1**：部分保护参与型、无障碍到期收益增强、已有现货 Collar 三委托；客户澄清、条款/预算、复制资产、双面账本与设计档案。

## 使用

[私有网站](https://trade-arcade-payoff-lab.pearlywillow.chatgpt.site) · [GitHub 仓库](https://github.com/biubiubeast/trading-arcade) · [v0.4.0 发布记录](https://github.com/biubiubeast/trading-arcade/releases/tag/v0.4.0)

路由：`#play`、`#courses`、`#gamma`、`#structured`。网站分享链接不改变访问权限。

本地需要 Node22+，无需安装依赖：

```sh
node serve.js
# http://127.0.0.1:4173
node --test tests/*.test.js
node scripts/check.mjs
```

有 npm 时也可用 `npm run dev`、`npm test`、`npm run check`。dist 是部署源码，无需构建。项目独立于上层黄金期权项目，不使用其服务器、密钥或数据库。

## Ubuntu 自托管

支持 `/tradegames/` 子路径。`main` 是更新来源，`ubuntu/deploy.sh` 执行自动检查、资源完整性验证与原子切换。没有第三方运行依赖。主机、目录、账号和认证设置通过 Git 之外的运行配置管理，公开仓库仅保留通用约定。具体命令由部署人员在私有操作说明中提供。

此补丁不改变平台 v0.4.0 的游戏、模型或存储版本。见 [自托管约定](docs/UBUNTU.md)。

## 模型边界

Payoff 是重新设计净持仓，乘数 1、现金每块 $10，费用按最终单位；Gamma 是真实交易现金流水，两腿乘数各 100，完整重估结算；工坊现金按实际美元、参与率可为小数，标准模板自动生成复制资产。三者经济语义不可混用。

全部使用合成欧式模型、零利率；不模拟融资利息、保证金、强平、信用违约、障碍或真实报价。工坊是部分保护，零利率全保护加正参与需额外预算；已有现货不重复收费。图表范围不代表完整风险区间。Greeks 是近似解释，不重复加入真实盈亏。

进度在当前浏览器；旧键保留，Gamma 读取旧 v1 后新写 v2。课程合法编辑草稿、收藏、各游戏独立保存；实验可导出但不跨刷新保存。清除站点数据会丢失，尚无云同步或全集恢复。客户端内容可查看，不作为可信竞赛服务器。解释只做长度检查，尚无学习者研究或自动语义评估。

## 交付资料

- [产品与验收标准](docs/PRODUCT.md) / [QA](docs/QA.md)：84 项自动测试和浏览器验收范围。
- [架构](docs/ARCHITECTURE.md) / [课程格式](docs/CONTENT_FORMAT.md)。
- [Gamma 模型](docs/GAMMA_MODEL.md) / [Structured 模型与官方机制参考](docs/STRUCTURED_MODEL.md)。
- [后续路线](docs/ROADMAP.md) / [关键决策](docs/DECISIONS.md)。
- [版本管理](docs/GOVERNANCE.md) / [发布档案](docs/releases/README.md) / [变更](CHANGELOG.md)。

每次正式发布冻结 PRODUCT、ROADMAP、QA、SUMMARY 及 VERSION.json；新版本用新目录，禁止覆盖。日常只读校验：`node scripts/releases.mjs verify`。最终 GitHub/Sites 源码树、CI 和部署映射另留收据，避免提交哈希自引用。

下一步先做 v0.4.1 学习者观察与反馈修正，再推进 Payoff v0.5 课程/资金机制、Gamma v0.3 严格多批次评估、工坊 v0.2 自建复制和信用/报价情景。
