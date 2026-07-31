/**
 * 机位登记表 —— 观测帖 POI/正文 → 坐标 + 高程
 *
 * 【坐标】一律使用**观景位**坐标，不吸附到 DEM 最高点。
 *   天气模式网格 2-11km，坐标差几公里对天气无实质影响；但把坐标吸到雪山主峰
 *   会导致在冰川上取天气（贡嘎主峰 DEM 6770m vs 子梅垭口 4500m），结论完全失真。
 *
 * 【高程】优先使用权威山顶/观景平台高程（source: 'published'）。
 *   Open-Meteo 的 90m DEM 对陡峰系统性低估 100-420m
 *   （黄山 1483 vs 1864、泰山 1193 vs 1545、妙峰山 872 vs 1291），
 *   而观测者实际站在真实山顶，故 published 才是物理正确值。
 *   demMax 保留 ±0.06 度网格内的 DEM 最高值，供审计与异常发现。
 *
 * 【viewpoint】标注该机位观景台本就远低于主峰（雪山类），高程差属正常而非错误。
 *
 * 生成方式：Open-Meteo elevation API 7x7 网格（±0.06 度，共 3008 个采样点）
 *          + 权威高程覆盖 + 5 个错误坐标人工修正。
 */

const SPOT_REGISTRY = [
  { name: "达瓦更扎", lat: 30.6, lon: 102.72, elevation: 3900, source: "published", demMax: 3209, match: ["达瓦更扎"] },
  { name: "玉龙雪山", lat: 27.1, lon: 100.19, elevation: 4506, source: "published", demMax: 5103, viewpoint: "冰川公园索道上站", match: ["玉龙雪山"] },
  { name: "南山牧场", lat: 26.36, lon: 110.2, elevation: 1760, source: "published", demMax: 597, match: ["南山牧场"] },
  { name: "大明山_桂", lat: 23.51, lon: 108.36, elevation: 1760, source: "published", demMax: 1336, match: ["大明山桂", "广西大明山"] },
  { name: "牛背山", lat: 29.72, lon: 102.35, elevation: 3660, source: "published", demMax: 3468, match: ["牛背山"] },
  { name: "峨眉山", lat: 29.52, lon: 103.33, elevation: 3077, source: "published", demMax: 2953, match: ["峨眉山", "峨眉金顶"] },
  { name: "张家界", lat: 29.32, lon: 110.43, elevation: 1262, source: "published", demMax: 1111, match: ["张家界", "天门山", "袁家界"] },
  { name: "妙峰山", lat: 39.97, lon: 116.06, elevation: 1291, source: "published", demMax: 872, match: ["妙峰山"] },
  { name: "轿子雪山", lat: 26.09, lon: 102.85, elevation: 4223, source: "published", demMax: 4184, match: ["轿子雪山", "轿子山"] },
  { name: "四明山", lat: 29.79, lon: 121.13, elevation: 1018, source: "published", demMax: 908, match: ["四明山"] },
  { name: "莫干山", lat: 30.6, lon: 119.89, elevation: 758, source: "published", demMax: 598, match: ["莫干山"] },
  { name: "天目山", lat: 30.34, lon: 119.43, elevation: 1506, source: "published", demMax: 1298, match: ["天目山"] },
  { name: "太子尖", lat: 30.1, lon: 118.88, elevation: 1558, source: "published", demMax: 460, match: ["太子尖"] },
  { name: "大明山", lat: 30.06, lon: 119.02, elevation: 1489, source: "published", demMax: 1337, match: ["大明山"] },
  { name: "清凉峰", lat: 30.1, lon: 118.87, elevation: 1787, source: "published", demMax: 1589, match: ["清凉峰"] },
  { name: "括苍山", lat: 28.61, lon: 120.93, elevation: 1382, source: "published", demMax: 1007, match: ["括苍山"] },
  { name: "雁荡山", lat: 28.37, lon: 121.07, elevation: 1150, source: "published", demMax: 1010, match: ["雁荡山"] },
  { name: "三清山", lat: 28.91, lon: 118.06, elevation: 1819, source: "published", demMax: 1599, match: ["三清山"] },
  { name: "龙虎山", lat: 28.11, lon: 116.98, elevation: 246, source: "dem", demMax: 246, match: ["龙虎山"] },
  { name: "井冈山", lat: 26.57, lon: 114.18, elevation: 1586, source: "published", demMax: 1553, match: ["井冈山"] },
  { name: "神农架", lat: 31.44, lon: 110.3, elevation: 3106, source: "published", demMax: 2520, match: ["神农架", "神农顶"] },
  { name: "五台山", lat: 39.07, lon: 113.56, elevation: 3061, source: "published", demMax: 2862, match: ["五台山"] },
  { name: "太白山", lat: 33.95, lon: 107.76, elevation: 3767, source: "published", demMax: 3690, match: ["太白山", "拔仙台"] },
  { name: "崆峒山", lat: 35.55, lon: 106.53, elevation: 2123, source: "published", demMax: 2154, match: ["崆峒山"] },
  { name: "麦积山", lat: 34.35, lon: 106, elevation: 1742, source: "published", demMax: 2055, match: ["麦积山"] },
  { name: "四姑娘山", lat: 31.1, lon: 102.9, elevation: 3600, source: "published", demMax: 5355, viewpoint: "猫鼻梁观景台", match: ["四姑娘山", "猫鼻梁"] },
  { name: "老君山", lat: 26.66, lon: 99.75, elevation: 3300, source: "published", demMax: 4081, viewpoint: "黎明景区", match: ["老君山"] },
  { name: "梵净山", lat: 27.91, lon: 108.7, elevation: 2493, source: "published", demMax: 2242, match: ["梵净山"] },
  { name: "大围山", lat: 28.42, lon: 114.1, elevation: 1607, source: "published", demMax: 1508, match: ["大围山"] },
  { name: "武夷山", lat: 27.72, lon: 117.68, elevation: 1723, source: "dem", demMax: 1723, match: ["武夷山", "天游峰"] },
  { name: "太姥山", lat: 27.11, lon: 120.2, elevation: 917, source: "published", demMax: 709, match: ["太姥山"] },
  { name: "戴云山", lat: 25.68, lon: 118.2, elevation: 1856, source: "published", demMax: 1568, match: ["戴云山"] },
  { name: "罗浮山", lat: 23.28, lon: 114.06, elevation: 1296, source: "published", demMax: 1206, match: ["罗浮山"] },
  { name: "南昆山", lat: 23.63, lon: 113.85, elevation: 1228, source: "published", demMax: 1060, match: ["南昆山"] },
  { name: "猫儿山", lat: 25.87, lon: 110.44, elevation: 2141, source: "published", demMax: 1961, match: ["猫儿山"] },
  { name: "五指山", lat: 18.88, lon: 109.68, elevation: 1867, source: "published", demMax: 1560, match: ["五指山"] },
  { name: "雾灵山", lat: 40.6, lon: 117.48, elevation: 2118, source: "published", demMax: 1986, match: ["雾灵山"] },
  { name: "东灵山", lat: 39.98, lon: 115.5, elevation: 2303, source: "published", demMax: 1998, match: ["东灵山"] },
  { name: "百花山", lat: 39.81, lon: 115.6, elevation: 1991, source: "published", demMax: 1945, match: ["百花山"] },
  { name: "海坨山", lat: 40.58, lon: 115.85, elevation: 2241, source: "published", demMax: 2022, match: ["海坨山"] },
  { name: "小五台山", lat: 39.98, lon: 115, elevation: 2882, source: "published", demMax: 2726, match: ["小五台"] },
  { name: "云台山", lat: 35.42, lon: 113.32, elevation: 1308, source: "published", demMax: 1325, match: ["云台山"] },
  { name: "老界岭", lat: 33.56, lon: 111.6, elevation: 2222, source: "published", demMax: 1535, match: ["老界岭"] },
  { name: "天柱山", lat: 30.75, lon: 116.45, elevation: 1489, source: "published", demMax: 1121, match: ["天柱山"] },
  { name: "九华山", lat: 30.48, lon: 117.8, elevation: 1342, source: "published", demMax: 1197, match: ["九华山"] },
  { name: "牯牛降", lat: 30.05, lon: 117.5, elevation: 1728, source: "published", demMax: 1604, match: ["牯牛降"] },
  { name: "齐云山", lat: 29.8, lon: 118.03, elevation: 585, source: "published", demMax: 641, match: ["齐云山"] },
  { name: "黄山", lat: 30.13, lon: 118.17, elevation: 1864, source: "published", demMax: 1483, match: ["黄山", "光明顶", "始信峰", "莲花峰", "西海大峡谷"] },
  { name: "武功山", lat: 27.46, lon: 114.17, elevation: 1918, source: "published", demMax: 1796, match: ["武功山", "金顶", "发云界"] },
  { name: "泰山", lat: 36.25, lon: 117.1, elevation: 1545, source: "published", demMax: 1193, match: ["泰山", "日观峰"] },
  { name: "华山", lat: 34.48, lon: 110.08, elevation: 2154, source: "published", demMax: 2215, match: ["华山", "西峰", "东峰"] },
  { name: "庐山", lat: 29.55, lon: 115.99, elevation: 1474, source: "published", demMax: 1377, match: ["庐山", "含鄱口", "五老峰"] },
  { name: "衡山", lat: 27.25, lon: 112.69, elevation: 1300, source: "published", demMax: 963, match: ["衡山", "南岳"] },
  { name: "武当山", lat: 32.4, lon: 111, elevation: 1612, source: "published", demMax: 1401, match: ["武当山", "金顶"] },
  { name: "嵩山", lat: 34.5, lon: 113.03, elevation: 1492, source: "published", demMax: 1403, match: ["嵩山"] },
  { name: "恒山", lat: 39.67, lon: 113.74, elevation: 2016, source: "published", demMax: 1982, match: ["恒山"] },
  { name: "贡嘎山", lat: 29.6, lon: 101.88, elevation: 4500, source: "published", demMax: 6770, viewpoint: "子梅垭口", match: ["贡嘎", "子梅垭口"] },
  { name: "苍山", lat: 25.68, lon: 100.12, elevation: 3920, source: "published", demMax: 3908, match: ["苍山", "洗马潭"] },
  { name: "梅里雪山", lat: 28.45, lon: 98.7, elevation: 3450, source: "published", demMax: 5894, viewpoint: "飞来寺观景台", match: ["梅里", "飞来寺"] },
  { name: "长白山", lat: 42.02, lon: 128.06, elevation: 2189, source: "published", demMax: 2509, match: ["长白山", "天池"] },
  { name: "崂山", lat: 36.16, lon: 120.62, elevation: 1132, source: "published", demMax: 897, match: ["崂山"] },
  { name: "蒙山", lat: 35.55, lon: 117.85, elevation: 1156, source: "published", demMax: 1001, match: ["蒙山"] },
  { name: "北京城区", lat: 39.909, lon: 116.461, elevation: 27, source: "dem", demMax: 27, match: ["国贸", "朝阳公园", "北京城区", "故宫角楼", "南海子"] },
  { name: "延庆", lat: 40.457, lon: 115.974, elevation: 484, source: "dem", demMax: 484, match: ["延庆", "1473"] },
  { name: "密云水库", lat: 40.487, lon: 116.856, elevation: 161, source: "dem", demMax: 161, match: ["密云"] },
  { name: "上海外滩", lat: 31.24, lon: 121.49, elevation: 0, source: "dem", demMax: 0, match: ["外滩", "上海"] },
  { name: "广州塔", lat: 23.11, lon: 113.32, elevation: 0, source: "dem", demMax: 0, match: ["广州塔", "广州"] },
  { name: "深圳湾", lat: 22.49, lon: 113.94, elevation: 6, source: "dem", demMax: 6, match: ["深圳湾", "深圳"] },
  { name: "杭州西湖", lat: 30.24, lon: 120.15, elevation: 10, source: "dem", demMax: 10, match: ["西湖", "杭州"] },
  { name: "成都锦城湖", lat: 30.57, lon: 104.05, elevation: 490, source: "dem", demMax: 490, match: ["成都"] },
  { name: "重庆南山", lat: 29.55, lon: 106.6, elevation: 459, source: "dem", demMax: 459, match: ["重庆", "南山一棵树"] },
  { name: "西安城墙", lat: 34.26, lon: 108.95, elevation: 409, source: "dem", demMax: 409, match: ["西安"] },
  { name: "南京紫金山", lat: 32.07, lon: 118.85, elevation: 302, source: "dem", demMax: 302, match: ["紫金山", "南京"] },
  { name: "青岛小麦岛", lat: 36.05, lon: 120.45, elevation: 0, source: "dem", demMax: 0, match: ["青岛"] },
  { name: "厦门环岛路", lat: 24.44, lon: 118.14, elevation: 29, source: "dem", demMax: 29, match: ["厦门"] },
  { name: "武汉江滩", lat: 30.58, lon: 114.3, elevation: 15, source: "dem", demMax: 15, match: ["武汉"] },
  { name: "长沙橘子洲", lat: 28.19, lon: 112.96, elevation: 27, source: "dem", demMax: 27, match: ["长沙"] },
  { name: "天津之眼", lat: 39.16, lon: 117.18, elevation: 0, source: "dem", demMax: 0, match: ["天津"] },
  { name: "昆明滇池", lat: 24.95, lon: 102.65, elevation: 1886, source: "dem", demMax: 1886, match: ["昆明", "滇池"] },
  { name: "拉萨", lat: 29.65, lon: 91.14, elevation: 3655, source: "dem", demMax: 3655, match: ["拉萨", "布达拉"] },
];

/**
 * POI 名或正文 -> 机位。POI 优先于正文；登记表按关键词具体度降序排列，
 * 避免宽泛词（如 "北京"）抢先匹配掉具体机位（如 "妙峰山"）。
 * 命中不了返回 null —— 调用方应据此拒绝该样本，而不是猜一个高程。
 */
function resolveSpot(poiName, text) {
  if (poiName) {
    for (const s of SPOT_REGISTRY) {
      if (s.match.some((m) => poiName.includes(m))) return s;
    }
  }
  if (text) {
    for (const s of SPOT_REGISTRY) {
      if (s.match.some((m) => text.includes(m))) return s;
    }
  }
  return null;
}

module.exports = { SPOT_REGISTRY, resolveSpot };
