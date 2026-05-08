# CloudSea Design Tokens

`shared/design/tokens.json` 是三端共享的视觉源数据，当前已生成 Web 与微信小程序变量文件，RN 端后续接入时应从同一 JSON 读取。

## 文件

- `tokens.json`: source of truth，包含 `color` / `spacing` / `radius` / `font` / `shadow`，覆盖 `dark` 与 `light`。
- `tokens.css`: 自动生成的 Web CSS 变量，默认 dark，并提供 `[data-theme="dark"]` / `[data-theme="light"]`。
- `tokens.wxss`: 自动生成的小程序变量，默认 `page` 为 dark，并提供 `.theme-dark` / `.theme-light`。
- `components.css`: Web 纯 HTML+CSS 类组件约定，统一使用 `cs-` 前缀。
- `web/css/tokens.css`、`web/css/components.css` 与 `miniprogram/styles/tokens.wxss` 是运行 `npm run build:tokens` 后生成/同步的运行时镜像，避免端侧构建访问项目根目录外文件。

## 维护规范

1. 颜色禁止硬编码。新增 UI 优先使用 `var(--color-primary)`、`var(--color-text-strong)`、`var(--color-text-weak)`、`var(--color-border-default)` 等语义 token。
2. 间距、圆角、字号使用 `var(--spacing-*)`、`var(--radius-*)`、`var(--font-*)`。
3. 新增 token 只改 `tokens.json`，再运行：
   ```bash
   npm run build:tokens
   ```
4. 命名先语义、后用途。示例：优先新增 `color.text-weak`，避免新增 `color.gray-500`。
5. 组件样式优先沉淀到 `shared/design/components.css` 或 `miniprogram/components/*`，页面内只保留布局与业务态。

## 新增 token 流程

1. 在 `tokens.json` 的对应分类新增字段，并同时补齐 `dark` / `light`。
2. 执行 `npm run build:tokens` 生成 `tokens.css` 与 `tokens.wxss`。
3. 在 Web 或小程序页面中通过 CSS/WXSS 变量引用，不直接写颜色值。
4. 如新增组件，补充 Web `.cs-*` 类与小程序自定义组件的属性说明。
