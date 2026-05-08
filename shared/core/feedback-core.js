/* SHARED CORE — single source of truth, do not edit per-end copies */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.CloudSeaCore = root.CloudSeaCore || {};
    root.CloudSeaCore.createFeedback = api.createFeedback;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const STORAGE_KEY = 'cloudsea_feedback_records';
  const noopStorage = { get() { return null; }, set() {}, remove() {}, keys() { return []; } };

  function createFeedback(options) {
    const storage = (options && options.storage) || noopStorage;

    function saveRecords(records) {
      try {
        storage.set(STORAGE_KEY, records);
      } catch (e) { /* ignore */ }
    }

    function saveFeedback(record) {
      const records = getFeedbackRecords();
      const now = Date.now();
      const today = formatDate(new Date());

      const existing = records.find(r => r.date === today &&
        r.location && record.location &&
        Math.abs(r.location.lat - record.location.lat) < 0.001 &&
        Math.abs(r.location.lon - record.location.lon) < 0.001);

      if (existing) {
        existing.predictions = record.predictions || existing.predictions;
        existing.createdAt = now;
        saveRecords(records);
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
      if (records.length > 200) {
        records.length = 200;
      }

      saveRecords(records);
      return entry;
    }

    function getFeedbackRecords() {
      try {
        return storage.get(STORAGE_KEY) || [];
      } catch (e) {
        console.warn('读取反馈记录失败:', e);
        return [];
      }
    }

    function updateFeedback(id, actualData) {
      const records = getFeedbackRecords();
      const record = records.find(r => r.id === id);
      if (!record) return false;

      record.actual = Object.assign(record.actual || {}, actualData);
      saveRecords(records);
      return true;
    }

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

    function getFeedbackStats() {
      const records = getFeedbackRecords();
      const total = records.length;
      const filled = records.filter(r =>
        r.actual && (r.actual.cloudSea !== null || r.actual.glow !== null || r.actual.stars !== null)
      );
      const filledCount = filled.length;

      let matches = 0;
      let comparisons = 0;
      let cloudSeaMatch = 0, cloudSeaTotal = 0;
      let glowMatch = 0, glowTotal = 0;
      let starsMatch = 0, starsTotal = 0;

      filled.forEach(r => {
        const pred = r.predictions || {};
        const act = r.actual || {};

        if (act.cloudSea !== null) {
          cloudSeaTotal++;
          comparisons++;
          const predicted = (pred.cloudSea && pred.cloudSea.score >= 55);
          if (predicted === act.cloudSea) {
            cloudSeaMatch++;
            matches++;
          }
        }

        if (act.glow !== null) {
          glowTotal++;
          comparisons++;
          const predicted = (pred.glow && pred.glow.score >= 60);
          if (predicted === act.glow) {
            glowMatch++;
            matches++;
          }
        }

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

    return { saveFeedback, getFeedbackRecords, updateFeedback, exportFeedbackCSV, getFeedbackStats };
  }

  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function escapeCSV(str) {
    let safe = String(str == null ? '' : str);
    if (/^[=+\-@\t\r]/.test(safe)) {
      safe = "'" + safe;
    }
    if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
      return '"' + safe.replace(/"/g, '""') + '"';
    }
    return safe;
  }

  return { createFeedback, constants: { STORAGE_KEY } };
});
