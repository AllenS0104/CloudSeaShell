# CloudSea RN ⇄ WebView Bridge Protocol

The bridge uses request messages posted from WebView to React Native with `channel: 'bridge.request'`, a stable `action` string, an object `payload`, and an optional `protocolVersion`. React Native replies through the existing `onBridgeResponse(requestId, data)` or `onBridgeError(requestId, error)` callbacks.

Current protocol version: `1.0.0`.

## Version negotiation

React Native injects `window.__CLOUDSEA_BRIDGE_INFO__` before page load. Web code should read:

- `protocolVersion`: native bridge protocol version.
- `supportedActions`: action strings supported by the native shell.

Semantic versioning rules:

- Major version changes are incompatible. Web code should fall back or ask the user to upgrade when the native major differs from the required major.
- Minor and patch versions are backward compatible within the same major. New optional fields and new actions may be added without breaking existing callers.
- Web callers should check `supportedActions.includes(action)` before sending a request when `supportedActions` is present.

## Adding an action

1. Add the string to `ACTIONS` in `bridge.actions.ts` without renaming existing action strings.
2. Add request and response TypeScript interfaces.
3. Document request `payload` and response `data` in `bridge.schema.json`.
4. Implement the action in `App.tsx` using the `ACTIONS` constant.
5. Update web helpers/callers to check `supportedActions` and provide a fallback or upgrade prompt.
