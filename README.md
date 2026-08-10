# CloudSeaShell 云海壳

预测山地**云海**与**日出晚霞**的多端应用。给出的不是"今天天气不错"，
而是"明早 5:40 在黄山光明顶，云海概率如何、值不值得爬"。

一套核心算法，跑在三端：微信小程序、Web、Android（React Native 壳内嵌 Web）。

## 它解决什么问题

云海的形成条件很挑剔：需要充足的水汽、稳定的逆温层把云盖压在观景点之下、
风不能大到吹散云层、能见度要好。常规天气预报不会告诉你这些的组合结果。

本项目从 [Open-Meteo](https://open-meteo.com/) 拉取逐小时气象数据，
按物理判据加权评分（湿度、逆温、高程差、低云量、露点差、风速、气压、时段等），
输出 0-100 分与前往建议。

判据的物理依据见 [`云海和晚霞的形成.md`](./云海和晚霞的形成.md)。

## 诚实的能力边界

模型在 682 条带 GPS 与拍摄时间的真实观测上做过审计：

| 指标 | 数值 |
|---|---|
| ROC AUC | 0.641（0.7 以上才算可用） |
| 相对「永远说有云海」的准确率增益 | +31.5 个百分点 |
| 召回率 @ 阈值 75 | 62.3% |

**它明显强于瞎猜，但还没到可靠。** 约四成的云海会被漏报。
完整的四面板审计方法与结论见 [`docs/数据采集与模型审计.md`](./docs/数据采集与模型审计.md)。

一个值得一提的发现：用全球样本（欧洲/南美/东南亚）单独审计时表现
反而优于国内样本，说明判据抓到的是物理规律而非特定地形的巧合。

## 项目结构

```
shared/core/      三端共享的核心算法（唯一真源）
  thresholds.js     判定阈值常量 —— 改这里会影响所有端
  calculations.js   云海评分主逻辑
  scoring.js        分数 → 置信度
  guidance.js       分数 → 前往建议
  photography.js    拍摄参数建议
miniprogram/      微信小程序（含 utils/ 同步产物）
web/              Web 版（bundle.js 由 build.js 生成）
android/          RN 壳，assets 内嵌 web 产物
scripts/          数据采集、同步、校验工具
__tests__/        343 个测试
```

**重要**：`shared/core/` 是唯一真源，`miniprogram/utils/`、`web/js/`、
`android/.../assets/` 下的同名文件都是**同步产物，不要直接改**。
改完核心必须跑同步，否则三端行为会不一致：

```sh
npm run sync:shared && npm run build:web && npm run sync:android
```

## 快速开始

```sh
npm install

npm test                    # 343 个测试
npm run lint

npm run build:web           # 构建 Web bundle
npm start                   # RN Metro
npm run android             # 跑 Android
```

小程序端用微信开发者工具打开 `miniprogram/` 目录。

## 数据与审计工具

```sh
npm run audit:prediction    # 模型判别力审计（双面板）
npm run audit:global        # 加上全球外部观测，四面板
npm run ingest:commons      # 从 Wikimedia Commons 采集带 GPS 的观测
npm run backtest:cloudsea   # 云海回测
npm run backtest:glow       # 晚霞回测
```

采集器只走平台**官方公开接口**，不绕过任何风控或认证。
实测无法匿名获取的平台（Instagram / 微博 / Reddit）登记在
`scripts/social-ingest.js` 的 `BLOCKED` 常量里并附原因，
接入它们的正确做法是自备官方开发者凭据。

## 数据来源

- [Open-Meteo](https://open-meteo.com/) — 预报、历史存档、集合预报、空气质量
- [Nominatim](https://nominatim.openstreetmap.org/) / [BigDataCloud](https://www.bigdatacloud.com/) — 逆地理编码
- [Wikimedia Commons](https://commons.wikimedia.org/) — 带 EXIF 拍摄时间与 GPS 的观测样本

机位表 `scripts/spot-registry.js` 收录 80 个观景点，高程优先采用官方公布值——
Open-Meteo 的 90m DEM 对陡峭山峰会系统性低估 100~420m，直接用会让高程差判据失真。

## Design Tokens

Web 与小程序的视觉变量以 `shared/design/tokens.json` 为 source of truth。
禁止硬编码颜色，统一用 `var(--color-primary)`、`var(--color-text-strong)` 等 token；
调整后运行 `npm run build:tokens` 生成 `tokens.css` / `tokens.wxss`。

## License

尚未选定。在此之前默认保留所有权利。
