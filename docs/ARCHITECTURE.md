# 技术架构与扩展契约

## 决策

首版采用原生 ES Modules、语义 HTML、CSS 与 SVG。计算与页面均在浏览器运行，零第三方运行依赖，无需构建。现阶段复杂度来自规则正确性与学习反馈，尚不需要账号、网络行情或实时服务器，因此不引入这些运行成本。

这是模块化首版，尚不是完整插件运行框架。游戏元数据已独立注册；新增第二款可玩游戏时，需增加其渲染器、状态和路由，再接入统一外壳，不会仅凭新增一个元数据条目自动出现完整游戏。

## 文件结构

```text
trading-arcade/
  .openai/hosting.json   网站 ID 与静态发布目录
  dist/
    index.html          浏览器入口与元数据
    styles.css          设计语言、组件与响应式断点
    favicon.svg         原生矢量标识
    js/
      app.js            页面外壳、交互、SVG、复盘与路由
      engine.js         无 UI 依赖的定价、组合、风险与判题
      levels.js         数据驱动关卡与参考解
      games.js          游戏目录元数据、开放状态与规划
      storage.js        版本化本地存储、输入校验与容错
  tests/engine.test.js  金融规则与存储测试
  docs/                 产品、架构、路线与验证记录
  serve.js              开发服务器，不参与云端运行
```

## 数据流

卡片/数量事件 → 检查工具权限与单位上限 → 合并净持仓 → 保存当前草稿 → 调用纯计算函数 → 更新曲线、指标和任务状态。

检验事件 → 组合合法性 → 全区间风险 + 指定价格情景 → 全部条件判定 → 保存最佳星级 → 展示复盘。图表、教学解释与判题共用同一个引擎，避免两套口径。

估值滑块只改变重估输入，初始建仓报价保持固定；到期判题仍使用 days=0。UI 不生成任意用户脚本，不把用户输入送往 AI 或真实交易端。

## 金融计算契约

`Leg = { type: 'call' | 'put' | 'stock' | 'cash', strike: number, qty: integer }`

qty 正数表示买入，负数表示卖出。非期权 strike 为 0。同类同执行价仅保留一条净持仓。现金每单位面值 10，其余乘数均为 1。

```text
fee = Σ |qᵢ| × 0.10
debit = Σ qᵢ × entryValueᵢ + fee
expiryPnL(S) = Σ qᵢ × intrinsicValueᵢ(S) − debit
markPnL(S,t,σ) = Σ qᵢ × modelValueᵢ(S,t,σ) − debit
```

到期收益是分段线性函数。枚举 S=0 和所有执行价可得到所有有限折点极值；右端斜率为 Σq（现货和 Call）。斜率为正则收益无限，负则损失无限。Put 在 S=0 达到有限价值；不会误判成无限收益。有限区间求线性零点，另检查最右区间。全零平坦区间单独记录。

BS 正态分布使用标准多项式近似。参数与边界由测试覆盖；它是教学精度模型，不是交易系统价格服务。Delta 通过中心差分计算，仅用于自由实验分析，未承诺精确 Greeks 风险系统。

## 游戏扩展

新游戏接入步骤：

1. 在 `games.js` 增加稳定的 id、名称、状态、说明与图标；只有存在完整可玩的实现才标记 live。
2. 建立 `games/<id>/` 模块：`state.js`、`engine.js`、`view.js`、`levels.js`。为引擎提供独立测试。
3. 抽取 `app.js` 中的页面外壳和 modal/chart 基础组件，建立 renderer 映射；当前 app.js 体积增加到第二款游戏时应重构，避免继续把游戏逻辑堆入单文件。
4. 采用独立存储键 `trade-arcade:<game-id>:v1`，迁移原有 payoff 数据。新游戏版本变化须显式迁移，不覆盖旧进度。
5. 接入公共进度结构：gameId、levelId、rulesVersion、stars、completedAt；保留游戏专用复盘记录。
6. 通过手机/键盘操作、空状态、失败状态、恢复状态和判题可复现检查后，开放大厅入口。

建议未来模块接口（设计契约，尚未实现接口加载器）：

```ts
interface GameModule<State, Action, Result> {
  id: string;
  rulesVersion: number;
  initialState(seed?: number): State;
  reduce(state: State, action: Action): State;
  evaluate(state: State): Result;
  serialize(state: State): unknown;
  restore(raw: unknown): State;
  mount(root: HTMLElement, state: State): () => void;
}
```

动态游戏另外引入种子随机数、不可变动作日志、现金账本和统一时钟。不要复用静态“组合重构”作为逐笔交易记账，二者经济语义不同。

## 存储与安全

`trade-arcade:v1` 保存 completed、drafts、hintUse、lastLevel。读取时校验版本、星级、提示次数和关卡范围；草稿进一步校验工具、执行价、整数数量、重复项与上限。不执行存储中的 HTML；未来云端导入需要更严格的整个记录 schema 和大小限制。

无 API 密钥、账号信息或交易数据。外链新窗口设置 noopener/noreferrer。唯一可选外部请求是字体。进度不跨浏览器同步，也没有反作弊能力。

## 发布与维护

静态产物位于 dist，无需打包构建。发布前跑自动检查并做浏览器冒烟验证；使用 Sites 源码工作流将确切源码提交推送、生成部署归档，再保存并部署同一版本。`.openai/hosting.json` 的 project_id 必须复用。

新增金融机制先写经济规则，再实现引擎和有意义的反例测试，最后接 UI。改变费用、定价参数或评分需增加 rulesVersion 并重新确认关卡可解性。
