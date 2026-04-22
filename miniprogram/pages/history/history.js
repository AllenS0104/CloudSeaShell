const feedback = require('../../utils/feedback');

Page({
  data: {
    records: [],
    stats: null,
    isEmpty: true,
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const records = feedback.getFeedbackRecords();
    const stats = feedback.getFeedbackStats();

    // 按日期倒序排列（getFeedbackRecords 已是 unshift 顺序，但保险起见再排一次）
    records.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // 为每条记录预处理展示数据
    const processed = records.map(r => {
      const pred = r.predictions || {};
      const act = r.actual || {};

      const cloudScore = (pred.cloudSea && pred.cloudSea.score) || 0;
      const glowScore = (pred.glow && pred.glow.score) || 0;
      const starsScore = (pred.stars && pred.stars.score) || 0;

      // 反馈状态标记
      const cloudStatus = this.getFeedbackStatus(act.cloudSea);
      const glowStatus = this.getFeedbackStatus(act.glow);
      const starsStatus = this.getFeedbackStatus(act.stars);

      // 准确性标记：预测高分但实际未出现=miss，预测准确=hit
      const cloudAccuracy = this.getAccuracy(cloudScore, 55, act.cloudSea);
      const glowAccuracy = this.getAccuracy(glowScore, 60, act.glow);
      const starsAccuracy = this.getAccuracy(starsScore, 60, act.stars);

      // 评分星星数组
      const ratingStars = [];
      const rating = act.rating || 0;
      for (let i = 1; i <= 5; i++) {
        ratingStars.push({ index: i, active: i <= rating });
      }

      return {
        id: r.id,
        date: r.date || '未知日期',
        locationName: (r.location && r.location.name) || '未知地点',
        cloudScore,
        glowScore,
        starsScore,
        cloudStatus,
        glowStatus,
        starsStatus,
        cloudAccuracy,
        glowAccuracy,
        starsAccuracy,
        rating,
        ratingStars,
        hasRating: rating > 0,
        note: act.note || '',
        hasFeedback: act.cloudSea !== null || act.glow !== null || act.stars !== null,
      };
    });

    this.setData({
      records: processed,
      stats,
      isEmpty: processed.length === 0,
    });
  },

  /**
   * 获取反馈状态显示
   * @param {boolean|null} value
   * @returns {Object} { text, icon, className }
   */
  getFeedbackStatus(value) {
    if (value === true) {
      return { text: '已出现', icon: '✅', className: 'status-yes' };
    } else if (value === false) {
      return { text: '未出现', icon: '❌', className: 'status-no' };
    }
    return { text: '未填写', icon: '⏳', className: 'status-pending' };
  },

  /**
   * 获取准确性标记
   * @param {number} score - 预测分数
   * @param {number} threshold - 判定阈值
   * @param {boolean|null} actual - 实际结果
   * @returns {string} 'hit' | 'miss' | 'none'
   */
  getAccuracy(score, threshold, actual) {
    if (actual === null || actual === undefined) return 'none';
    const predicted = score >= threshold;
    if (predicted === actual) return 'hit';
    return 'miss';
  },

  onExportCSV() {
    const csv = feedback.exportFeedbackCSV();
    if (!csv) {
      wx.showToast({ title: '暂无数据可导出', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: csv,
      success() {
        wx.showToast({ title: 'CSV 已复制到剪贴板', icon: 'success' });
      },
    });
  },

  onGoHome() {
    wx.navigateBack();
  },
});
