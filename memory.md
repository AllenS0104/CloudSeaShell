# CloudSeaShell 项目记忆文件

> 最后更新：2026-04-22
> 项目评级：A-（8.75/10）
> 状态：KOL 内测就绪

---

## 📌 项目概况

| 项目 | 详情 |
|------|------|
| 项目名 | CloudSeaShell 云海观测决策台 |
| 定位 | 面向风光摄影师的智能天气研判+摄影参数推荐工具 |
| 平台 | Android APK + 微信小程序 |
| 包名 | com.cloudseashell.app |
| 版本 | v1.1.0 (versionCode 2) |
| 本地路径 | `C:\Users\v-songjun\AndroidStudioProjects\CloudSeaShell` |
| GitHub | https://github.com/AllenS0104/CloudSeaShell (PRIVATE) |
| 原型归档 | https://github.com/AllenS0104/MyWebApp-prototype (PRIVATE) |
| Web 原始版 | https://github.com/AllenS0104/weather-cloud-forecast-app (PUBLIC) |

---

## 📊 项目数据

| 指标 | 数值 |
|------|------|
| Git 提交 | 30 次 |
| 代码变更 | 72 文件，+7,149 行 |
| 任务完成 | 51/51（100%） |
| 测试 | 113 个，6 套件，100% 通过 |
| Lint | 0 errors |
| CI/CD | GitHub Actions（push 触发测试） |
| APK 大小 | 45.32 MB |

---

## 🏗️ 技术架构

### Android 端
- React Native 0.80.2 + React 19.1
- WebView 加载内嵌 H5（`assets/weather-cloud-forecast-app/`）
- 原生桥接：定位、分享图片、地图导航、观测提醒通知
- Kotlin 原生模块：`CloudSeaCapabilitiesModule`、`ObservationReminderReceiver`
- 签名：release keystore 独立，密码在 `signing.properties`（已 gitignore）

### 微信小程序（9 个模块）
```
services.js       — API 层（Open-Meteo 天气/海拔/地理编码，重试+缓存）
calculations.js   — 云海评分（Espy 云底公式、平滑评分、逆温层检测）
sunset.js          — 晚霞/火烧云评分（中高层云量模型）
stargazing.js      — 银河/星空评分（月相计算、银河可见性）
fusion.js          — 多模式融合（ICON/GFS/JMA/ECMWF 加权平均）
photography.js     — 摄影参数（曝光表、ND 计算、延时参数、时间轴）
camera-presets.js  — 设备库（10 相机 + 8 手机，镜头参数）
feedback.js        — 用户反馈（预测 vs 实际对比，CSV 导出）
analyzer.js        — 分析编排（天气/晚霞/星空/安全/摄影协调器）
```

### 页面
- `pages/index/index` — 主页（天气仪表盘 + 四大预测 + 底部操作栏）
- `pages/history/history` — 历史记录页（预测回顾 + 准确率统计）

---

## 🌟 核心功能

### 四大预测
| 预测 | 关键因子 | 独家特性 |
|------|----------|----------|
| ☁️ 云海 | 湿度、海拔差、露点差、能见度、风速、低云量 | 逆温层检测 + 多模式融合 |
| 🌅 晚霞 | 中层云量(30-70%)、高层云量、低云遮挡、日落窗口 | 中高层云量物理模型 |
| 🌌 银河 | 月相、月面亮度、银河核心季节性、云量、海拔 | 纯数学月相计算 |
| 📸 摄影 | 光照阶段、EV 值、海拔修正、风速 | 18 款设备专属参数 |

### 摄影参数系统
- **10 款相机**：Canon 5D4/R5/R6II, Sony A7RV/A7C2/A6700, Nikon Z8/Z6III, Fuji X-T5
- **8 款手机**：iPhone 16 Pro, Huawei P70 Pro, 小米 15 Pro, 一加 13, OPPO Find X8 Pro, vivo X200 Pro, Samsung S25 Ultra, Pixel 9 Pro
- 曝光计算表、ND 减光计算器、延时摄影参数、景深/超焦距、拍摄时间轴

### 安全功能
- ⛈️ 雷暴预警（CAPE 值）
- 🥶 体感温度/风寒提示
- ⛰️ 高海拔 UV 提醒
- 🆘 SOS 紧急求救（110/119/位置复制）

---

## 📈 项目历程

| 阶段 | 里程碑 | Commit 范围 |
|------|--------|-------------|
| 考古 | 翻出老项目，对比 MyWebApp vs CloudSeaShell | — |
| 归档 | MyWebApp 推送 GitHub 作为历史原型 | MyWebApp-prototype |
| v1.1.0 | 品牌统一 + 签名 + 图标 + splash | dd09981..a9ecd88 |
| 精度升级 | 云底公式 + 平滑评分 + 逆温检测 + 测试 | 7eea126 |
| 小程序 | 完整功能 + 国内网络优化 | be505bd..ec9fb48 |
| 多模式融合 | ICON/GFS/JMA/ECMWF 四模式 | b206a94 |
| 晚霞预测 | 中高层云量模型 + 安全提醒 | 282c6d8 |
| 摄影参数 | 设备库 + 曝光表 + ND + 延时 + 时间轴 | 4d1294a..a1675d4 |
| 银河预测 | 月相 + 银河可见性 + 星空摄影 | 20d30f7 |
| PMO 固化 | 测试补全(113个) + 重构 + 构建验证 | a807516..8e1d10d |
| 内测准备 | CI/CD + 安全 + 英雄卡 + 骨架屏 | 33fde0d..0d795e5 |
| 反馈闭环 | 用户反馈 + 历史视图 + 内测指南 | 0c238f0..3ef7f5a |

---

## 🔑 关键技术决策

1. **Open-Meteo 统一数据源**：免费、无 Key、多模式支持、国内可用
2. **小程序优先策略**：开发效率高、分发门槛低
3. **纯数学天文计算**：月相/银河不依赖外部 API
4. **算法双端复用**：calculations.js 从 Android 直接移植到小程序
5. **弹出式摄影面板**：避免主页信息过载
6. **决策英雄卡**：0.5 秒给用户一句话结论

---

## ⚙️ 开发环境

| 工具 | 版本/路径 |
|------|-----------|
| Node.js | v22.17.1 |
| React Native | 0.80.2 |
| Android Studio JBR | `C:\Program Files\Android\Android Studio\jbr` |
| Android SDK | `C:\Users\v-songjun\AppData\Local\Android\Sdk` |
| 微信开发者工具 | 最新版 |
| GitHub CLI | gh 2.87.3 |
| GitHub 账号 | AllenS0104 (active) |

---

## 📋 下一步（v1.2.0 规划）

| 优先级 | 事项 |
|--------|------|
| P0 | 微信域名白名单配置 + 隐私政策 |
| P0 | 邀请 5-10 个风光摄影 KOL 内测 |
| P1 | Tab 分区（云海/光影/装备）减少信息过载 |
| P1 | 三种预测不同主题色（蓝/橙/紫） |
| P1 | Android 端同步晚霞/银河/摄影模块 |
| P2 | 贝叶斯模式平均替代简单加权 |
| P2 | 预设热门观测点（黄山/牛背山/泰山等） |
| P3 | 探空数据接入（真正的逆温垂直廓线） |
| P3 | 卫星云图集成 |

---

## 🏛️ PMO 评分记录

| 维度 | 得分 |
|------|------|
| 项目管理与执行力 | 9.0 |
| 算法与核心竞争力 | 9.5 |
| 工程质量与稳定性 | 8.5 |
| 跨平台与网络适配 | 8.5 |
| UI/UX 设计 | 8.0 |
| 团队协作与沟通 | 9.0 |
| **综合评级** | **A-（8.75/10）** |
