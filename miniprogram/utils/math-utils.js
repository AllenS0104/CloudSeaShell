function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(value, inLow, inHigh, outLow, outHigh) {
  const t = clamp((value - inLow) / (inHigh - inLow), 0, 1);
  return outLow + t * (outHigh - outLow);
}

module.exports = { clamp, lerp };
