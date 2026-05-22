// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
function formatTimeLabel(timeString) {
  if (!timeString) {
    return '--:--';
  }

  const value = new Date(timeString);
  if (Number.isNaN(value.getTime())) {
    return '--:--';
  }

  return value.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function shiftMinutes(timeString, minutes) {
  const value = new Date(timeString);
  if (Number.isNaN(value.getTime())) {
    return null;
  }
  value.setMinutes(value.getMinutes() + minutes);
  return value.toISOString();
}

function windowAroundSunrise(sunriseTime) {
  if (!sunriseTime) {
    return '日出前后 1-2 小时';
  }

  const start = shiftMinutes(sunriseTime, -60);
  const end = shiftMinutes(sunriseTime, 90);
  return `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`;
}

function recommendedViewpoint(gapToElevation) {
  if (gapToElevation >= 250) {
    return '当前位置已具备优势，优先选择山顶或高位观景台。';
  }
  if (gapToElevation >= 80) {
    return '建议选择无遮挡山脊、平台或观景台，尽量避免谷地。';
  }
  if (gapToElevation >= -80) {
    return '当前点位接近云底，建议再上切到附近更高的山脊线。';
  }
  return '当前点位大概率偏低，建议直接规划更高海拔山顶或次高峰。';
}

function recommendedTargetElevation(cloudBase, currentElevation) {
  const ideal = Math.round(cloudBase + 150);
  return Math.max(ideal, Math.round(currentElevation));
}

function buildObservationGuidance({
  analysis,
  currentElevation,
  sunriseTime,
  sunsetTime,
  bestTimeLabel,
}) {
  const targetElevation = recommendedTargetElevation(analysis.cloudBase, currentElevation);
  const goLevel = analysis.score >= 75
    ? '值得冲'
    : analysis.score >= 55
      ? '可以蹲守'
      : analysis.score >= 35
        ? '可观望'
        : '不建议专程前往';
  const goClass = analysis.score >= 55 ? 'go' : analysis.score >= 35 ? 'watch' : 'stop';

  const actionItems = [];
  if (analysis.precipitationProbability >= 60 || analysis.precipitationAmount >= 0.8) {
    actionItems.push('降水风险偏高，务必准备防水和保暖装备。');
  }
  if (analysis.windSpeed > 10) {
    actionItems.push('风偏大，优先避开完全暴露的山脊顶端。');
  } else {
    actionItems.push('风速尚可，适合提前到位等待云层变化。');
  }
  if (analysis.gapToElevation < 80) {
    actionItems.push(`建议把目标海拔提高到至少 ${targetElevation} m 左右。`);
  } else {
    actionItems.push(`当前海拔条件尚可，建议围绕 ${Math.round(currentElevation)} m 以上寻找最佳机位。`);
  }

  if (bestTimeLabel) {
    actionItems.push(`优先守候时段：${bestTimeLabel} 前后 30-60 分钟。`);
  } else {
    actionItems.push(`建议守候窗口：${windowAroundSunrise(sunriseTime)}。`);
  }

  const daylightWindow = sunriseTime && sunsetTime
    ? `${formatTimeLabel(sunriseTime)} 日出 / ${formatTimeLabel(sunsetTime)} 日落`
    : '优先关注日出前后';

  return {
    goLevel,
    goClass,
    targetElevation,
    recommendedWindow: bestTimeLabel ? `${bestTimeLabel} 前后` : windowAroundSunrise(sunriseTime),
    daylightWindow,
    viewpointAdvice: recommendedViewpoint(analysis.gapToElevation),
    actionItems: actionItems.slice(0, 4),
  };
}

module.exports = {
  recommendedViewpoint,
  recommendedTargetElevation,
  buildObservationGuidance,
  windowAroundSunrise,
  formatTimeLabel,
  shiftMinutes,
};
