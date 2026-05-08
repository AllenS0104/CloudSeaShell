# Shared Core

`shared/core/` contains zero-dependency, environment-neutral CommonJS modules that are the single source of truth for repeated pure algorithms and static recommendation data.

## Modules

Merged into shared core:

- `math-utils.js` — numeric helpers.
- `scoring.js` — cloud-sea scoring functions.
- `guidance.js` — observation-window and viewpoint guidance.
- `calculations.js` — cloud-sea analysis and formatting helpers.
- `photography.js` — photo recommendation helpers.
- `stargazing.js` — moon, Milky Way, and astro-photo helpers.
- `sunset.js` — sunrise/sunset glow scoring.
- `camera-presets.js` — camera and phone preset data/recommendations.
- `analyzer.js` — pure composition over the shared scoring/photo modules.
- `ports/http.js`, `ports/storage.js`, `ports/ui.js` — environment contracts and noop defaults.
- `services-core.js` — weather/geocoding/elevation service logic via injected HTTP/storage/location ports.
- `favorites-core.js` — favorite-location storage logic via injected storage port.
- `search-history-core.js` — search history storage logic via injected storage port.
- `feedback-core.js` — feedback record/statistics/CSV logic via injected storage port.
- `waypoints-data.js` — 示例摄影机位数据、附近查询、方向和光污染标签；数据仅为示例，欢迎社区补充与校正。

Skipped / not merged:

- `fusion.js` — implementations remain intentionally diverged. The web version continues to use `CS._webRequest`, now supplied by the services thin adapter; the miniprogram version still owns its endpoint-specific integration. Do not rewrite `fusion.js` until its full transport and module-shape differences are ported deliberately.

## Synchronization strategy

The shared modules are CommonJS so Mini Program code can consume them directly in principle. In this repo, `miniprogram/project.config.json` lives under `miniprogram/` and does not declare a `miniprogramRoot` that includes repository-level `shared/`. To avoid depending on cross-root `require('../../shared/...)` behavior in WeChat tooling, the current strategy is generated per-end copies.

Run:

```sh
npm run sync:shared
```

This copies the configured shared modules (including `ports/*.js`) into both `miniprogram/utils/` and `web/js/`, replacing only files with the same shared module names and leaving end-specific adapters/wrappers untouched. The new service/storage/waypoint modules are loaded by thin per-end adapters or UMD globals: miniprogram wrappers `require('./*-core.js')` or synced utility modules, while web wrappers load the UMD globals emitted by the same shared files. React Native does not import these modules yet, but can later require from `shared/core/` or use the same sync channel.

## Adding a module

1. Confirm the miniprogram and web implementations are functionally identical except for module syntax, and contain no environment APIs.
2. Move the CommonJS implementation to `shared/core/<name>.js` with the required shared-core header.
3. Add `<name>` to `SHARED_MODULES` in `scripts/sync-shared.js`.
4. Run `npm run sync:shared`.
5. Run syntax checks and smoke tests for the new shared module.

## Forbidden APIs

Shared core modules must stay pure and environment-neutral. Do not use:

- `wx.*`
- `document`
- `window`
- `fetch`
- platform storage, geolocation, UI, or network APIs directly

Environment effects must flow through a declared port/adapter. Pure calculations, formatting helpers, static data, and port-driven orchestration are allowed.
