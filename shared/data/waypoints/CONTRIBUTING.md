# Waypoint contribution guide

感谢为 CloudSeaShell 补充云海、星空、日出/日落机位。请按以下流程提交：

1. 在 `shared/data/waypoints/index.json` 追加一个 waypoint 对象，保持 JSON 数组格式。
2. 参考 `schema.json` 填写全部必填字段，并确保 `id` 唯一。
3. 运行 `npm run validate:waypoints`，再运行相关测试。
4. PR 描述中说明坐标与观测信息来源。

## 字段说明

- `id`: 小写 kebab-case 唯一标识，例如 `niubei-shan`。
- `name`: 公开通用地名或景区/观景点名称。
- `lat` / `lng`: WGS84 十进制度坐标，建议保留 4 位小数左右；不要提交需要保密或过度精确的私人位置。
- `elevation`: 海拔（米）。可引用地图、景区或公开地理资料。
- `bestFor`: 适合拍摄类型，只能使用 `cloudsea`、`stargazing`、`sunset`、`sunrise`。
- `bestSeasons`: 推荐季节，如 `春`、`夏`、`秋`、`冬`。
- `suggestedDirection`: 建议朝向角度，0 为北、90 为东、180 为南、270 为西。
- `notes`: 简短说明拍摄亮点、天气窗口或安全提醒。
- `bortleClass`: 1-9 的 Bortle 暗空等级估计值。

## 来源与安全要求

- 坐标、海拔、暗空等级和观测建议必须来自公开资料、个人实地经验或可引用的公开地图/天文资料。
- 请在 Issue/PR 中写明来源链接或简短来源说明。
- 不接受军事设施、边境敏感点、受保护且不对公众开放区域、私人禁入区域，或可能引导危险/违法进入的机位。
- 如地点对生态、宗教、社区生活有潜在影响，请优先提交公开景区、成熟步道或官方观景台。
