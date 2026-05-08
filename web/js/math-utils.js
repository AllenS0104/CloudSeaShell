// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(value, inLow, inHigh, outLow, outHigh) {
  const t = clamp((value - inLow) / (inHigh - inLow), 0, 1);
  return outLow + t * (outHigh - outLow);
}

module.exports = { clamp, lerp };
