# 微信订阅消息配置

## 模板 ID 申请流程

1. 打开「小程序后台」。
2. 进入「订阅消息」。
3. 在「公共模板库」中选择适合观测提醒的模板，添加到「我的模板」。
4. 复制模板 ID，替换 `subscribe-templates.js` 中的占位值：
   - `observationReminder`
   - `dawnAlert`

## 字段映射示例

以观测提醒模板为例，建议模板字段保持简洁：

```js
{
  thing1: { value: '观测地点：黄山光明顶' },
  time2: { value: '2026-04-20 05:40' },
  thing3: { value: '云海概率较高，建议提前到位' }
}
```

字段名（如 `thing1`、`time2`）必须与小程序后台模板详情一致；如果实际模板字段不同，请在调用 `scheduleSubscribeMessage` 时调整 `data`。

## 后端发送接口契约（暂不实现）

微信订阅消息必须由服务端调用微信接口发送。本轮仅在客户端记录调度 payload 和调度日志，后续服务端可提供：

`POST /api/subscribe-message`

Body 示例：

```json
{
  "touser": "OPENID",
  "template_id": "REAL_TEMPLATE_ID",
  "data": {
    "thing1": { "value": "观测地点：黄山光明顶" },
    "time2": { "value": "2026-04-20 05:40" },
    "thing3": { "value": "云海概率较高，建议提前到位" }
  },
  "page": "pages/index/index"
}
```

服务端需要负责获取 `access_token`、校验用户 openid、调用微信 `subscribeMessage.send`，并返回发送结果。
