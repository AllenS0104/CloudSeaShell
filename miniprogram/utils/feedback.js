/**
 * feedback.js — 用户反馈收集模块
 * 存储"预测 vs 实际"反馈数据到本地 Storage
 */

const STORAGE_KEY = 'cloudsea_feedback_records';

/**
 * 保存一条反馈记录（预测快照）
 * @param {Object} record - 反馈记录对象
 * @returns {Object} 保存的记录（含自动生成的 id/createdAt）
 */
function saveFeedback(record) {
  const records = getFeedbackRecords();
  const now = Date.now();
  const today = formatDate(new Date());

  // 如果今天同一地点已有记录，更新预测部分而非重复创建
  const existing = records.find(r => r.date === today &&
    r.location && record.location &&
    r.location.lat === record.location.lat &&
    r.location.lon === record.location.lon);

  if (existing) {
    existing.predictions = record.predictions || existing.predictions;
    existing.createdAt = now;
    wx.setStorageSync(STORAGE_KEY, records);
    return existing;
  }

  const entry = {
    id: 'fb_' + now,
    date: today,
    location: record.location || { lat: 0, lon: 0, name: '未知' },
    predictions: record.predictions || {
      cloudSea: { score: 0, suggestion: '' },
      glow: { score: 0, label: '' },
      stars: { score: 0, label: '' },
    },
    actual: {
      cloudSea: null,
      glow: null,
      stars: null,
      rating: null,
      note: '',
    },
    createdAt: now,
  };

  records.unshift(entry);

  // 最多保留 200 条
  if (records.length > 200) {
    records.length = 200;
  }

  wx.setStorageSync(STORAGE_KEY, records);
  return entry;
}

/**
 * 读取所有反馈记录
 * @returns {Array} 反馈记录数组
 */
function getFeedbackRecords() {
  try {
    return wx.getStorageSync(STORAGE_KEY) || [];
  } catch (e) {
    console.warn('读取反馈记录失败:', e);
    return [];
  }
}

/**
 * 更新某条记录的实际结果
 * @param {string} id - 记录 ID
 * @param {Object} actualData - 实际结果数据 { cloudSea, glow, stars, rating, note }
 * @returns {boolean} 是否更新成功
 */
function updateFeedback(id, actualData) {
  const records = getFeedbackRecords();
  const record = records.find(r => r.id === id);
  if (!record) return false;

  record.actual = Object.assign(record.actual || {}, actualData);
  wx.setStorageSync(STORAGE_KEY, records);
  return true;
}

/**
 * 导出为 CSV 文本
 * @returns {string} CSV 格式文本
 */
function exportFeedbackCSV() {
  const records = getFeedbackRecords();
  if (records.length === 0) return '';

  const header = '日期,地点,纬度,经度,云海预测分,晚霞预测分,银河预测分,实际云海,实际晚霞,实际银河,评分,备注';
  const rows = records.map(r => {
    const loc = r.location || {};
    const pred = r.predictions || {};
    const act = r.actual || {};
    return [
      r.date || '',
      escapeCSV(loc.name || ''),
      loc.lat || '',
      loc.lon || '',
      (pred.cloudSea && pred.cloudSea.score) || 0,
      (pred.glow && pred.glow.score) || 0,
      (pred.stars && pred.stars.score) || 0,
      act.cloudSea === null ? '' : (act.cloudSea ? '是' : '否'),
      act.glow === null ? '' : (act.glow ? '是' : '否'),
      act.stars === null ? '' : (act.stars ? '是' : '否'),
      act.rating || '',
      escapeCSV(act.note || ''),
    ].join(',');
  });

  return header + '\n' + rows.join('\n');
}

/**
 * 统计反馈数据
 * @returns {Object} { total, filled, accuracy, cloudSeaAccuracy, glowAccuracy, starsAccuracy }
 */
function getFeedbackStats() {
  const records = getFeedbackRecords();
  const total = records.length;

  // 已填写实际结果的记录
  const filled = records.filter(r =>
    r.actual && (r.actual.cloudSea !== null || r.actual.glow !== null || r.actual.stars !== null)
  );
  const filledCount = filled.length;

  let matches = 0;
  let comparisons = 0;

  // 云海准确率
  let cloudSeaMatch = 0, cloudSeaTotal = 0;
  let glowMatch = 0, glowTotal = 0;
  let starsMatch = 0, starsTotal = 0;

  filled.forEach(r => {
    const pred = r.predictions || {};
    const act = r.actual || {};

    // 云海：预测分 >= 55 视为"预测会出现"
    if (act.cloudSea !== null) {
      cloudSeaTotal++;
      comparisons++;
      const predicted = (pred.cloudSea && pred.cloudSea.score >= 55);
      if (predicted === act.cloudSea) {
        cloudSeaMatch++;
        matches++;
      }
    }

    // 晚霞：预测分 >= 60 视为"预测会出现"
    if (act.glow !== null) {
      glowTotal++;
      comparisons++;
      const predicted = (pred.glow && pred.glow.score >= 60);
      if (predicted === act.glow) {
        glowMatch++;
        matches++;
      }
    }

    // 银河：预测分 >= 60 视为"预测会出现"
    if (act.stars !== null) {
      starsTotal++;
      comparisons++;
      const predicted = (pred.stars && pred.stars.score >= 60);
      if (predicted === act.stars) {
        starsMatch++;
        matches++;
      }
    }
  });

  return {
    total,
    filled: filledCount,
    accuracy: comparisons > 0 ? Math.round((matches / comparisons) * 100) : null,
    cloudSeaAccuracy: cloudSeaTotal > 0 ? Math.round((cloudSeaMatch / cloudSeaTotal) * 100) : null,
    glowAccuracy: glowTotal > 0 ? Math.round((glowMatch / glowTotal) * 100) : null,
    starsAccuracy: starsTotal > 0 ? Math.round((starsMatch / starsTotal) * 100) : null,
  };
}

// ===== Helpers =====

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escapeCSV(str) {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

module.exports = {
  saveFeedback,
  getFeedbackRecords,
  updateFeedback,
  exportFeedbackCSV,
  getFeedbackStats,
};
