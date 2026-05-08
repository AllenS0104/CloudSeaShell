# CloudSea RN Components

This directory contains the React Native component layer aligned with `shared/design/tokens.json` and `shared/design/components.css`. It prepares the app for gradual native UI migration without replacing the current WebView.

## Usage

```tsx
import {Card, EmptyState, PillButton, SectionHeader, StatTile} from './src/components';

<Card variant="compact">
  <SectionHeader eyebrow="PHOTO WAYPOINTS" title="附近机位" />
  <StatTile icon="☁️" label="云量" value="42%" strong />
  <PillButton icon="🖼️" label="生成海报" variant="ghost" onPress={sharePoster} />
</Card>
```

All components use `useTokens()` by default. `useTokens()` follows `Appearance` and falls back to the dark theme, matching the shared token metadata.

## Token derivation

`npm run build:rn-tokens` reads `shared/design/tokens.json` and writes `tokens.generated.ts`.

- `themes.dark.color` / `themes.light.color` become RN color strings with camelCase keys (`bg-card` -> `bgCard`).
- `spacing`, `radius`, and `font` use the web `px` value parsed into a number for RN dp/font-size usage.
- `tokens.ts` exports `lightTokens`, `darkTokens`, `themes`, `getTokensForScheme()`, and `useTokens()`.

## Prop parity

| Component | Web / Mini Program props | RN props | Notes |
| --- | --- | --- | --- |
| `Card` | `variant` (`default`, `compact`, `flush`), slot | `variant`, `children` | Mirrors `.cs-card`, `.cs-card--compact`, `.cs-card--flush`. |
| `SectionHeader` | `eyebrow`, `title` | `eyebrow`, `title`, `subtitle` | `subtitle` is optional RN-only extension for future native screens. |
| `EmptyState` | `icon`, `title`, `hint`, `buttonText`, `action` | `icon`, `title`, `hint`, `subtitle`, `buttonText`, `onAction`, `onPress` | `subtitle` aliases `hint`; `onPress` keeps RN naming while `onAction` matches Mini Program event semantics. |
| `StatTile` | `icon`, `label`, `value`, `variant`, `strong` | `icon`, `label`, `value`, `variant`, `strong` | `variant="stack"` follows `.cs-stat-tile--stack`. |
| `PillButton` | `icon`, `label`, `variant`, `tap` | `icon`, `label`, `variant`, `onPress`, `disabled` | Variants: `primary`, `ghost`, `success`. |

## Current App integration

`App.tsx` imports `Card` once as an integration-path check only. The WebView rendering path is unchanged.
