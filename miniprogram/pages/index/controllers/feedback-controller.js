/* global wx */
/**
 * Feedback controller for the index page.
 *
 * Owns prediction snapshot persistence, feedback modal state, feedback form
 * handlers, history navigation, and CSV export behavior.
 */
function createFeedbackController(deps) {
  const { getState, setState, services } = deps;
  const { feedback } = services;

  function autoSaveFeedback() {
    const { analysis, glowAnalysis, starInfo, lat, lon, locationName } = getState();
    if (!analysis) return;

    const record = {
      location: { lat, lon, name: locationName },
      predictions: {
        cloudSea: { score: analysis.score || 0, suggestion: analysis.suggestion || '' },
        glow: { score: (glowAnalysis && glowAnalysis.score) || 0, label: (glowAnalysis && glowAnalysis.label) || '' },
        stars: { score: (starInfo && starInfo.score) || 0, label: (starInfo && starInfo.label) || '' },
      },
    };

    const saved = feedback.saveFeedback(record);
    setState({ currentFeedback: saved });
  }

  function openFeedback() {
    const records = feedback.getFeedbackRecords();
    const stats = feedback.getFeedbackStats();
    const current = getState().currentFeedback || (records.length > 0 ? records[0] : null);

    const act = (current && current.actual) || {};
    setState({
      showFeedback: true,
      feedbackRecords: records,
      feedbackStats: stats,
      currentFeedback: current,
      fbCloudSea: act.cloudSea !== undefined ? act.cloudSea : null,
      fbGlow: act.glow !== undefined ? act.glow : null,
      fbStars: act.stars !== undefined ? act.stars : null,
      fbRating: act.rating !== undefined ? act.rating : null,
      fbNote: act.note || '',
    });
  }

  function closeFeedback() {
    setState({ showFeedback: false });
  }

  function toggleCloudSea() {
    const v = getState().fbCloudSea;
    setState({ fbCloudSea: v === null ? true : (v === true ? false : null) });
  }

  function toggleGlow() {
    const v = getState().fbGlow;
    setState({ fbGlow: v === null ? true : (v === true ? false : null) });
  }

  function toggleStars() {
    const v = getState().fbStars;
    setState({ fbStars: v === null ? true : (v === true ? false : null) });
  }

  function setRating(e) {
    const rating = Number(e.currentTarget.dataset.rating);
    setState({ fbRating: getState().fbRating === rating ? null : rating });
  }

  function noteInput(e) {
    setState({ fbNote: e.detail.value });
  }

  function submitFeedback() {
    const { currentFeedback, fbCloudSea, fbGlow, fbStars, fbRating, fbNote } = getState();
    if (!currentFeedback) {
      wx.showToast({ title: '暂无预测记录', icon: 'none' });
      return;
    }

    const actualData = {
      cloudSea: fbCloudSea,
      glow: fbGlow,
      stars: fbStars,
      rating: fbRating,
      note: fbNote,
    };

    const ok = feedback.updateFeedback(currentFeedback.id, actualData);
    if (ok) {
      const stats = feedback.getFeedbackStats();
      setState({
        feedbackStats: stats,
        feedbackRecords: feedback.getFeedbackRecords(),
      });
      wx.showToast({ title: '反馈已保存 ✓', icon: 'success' });
    } else {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  }

  function goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  }

  function exportFeedback() {
    const csv = feedback.exportFeedbackCSV();
    if (!csv) {
      wx.showToast({ title: '暂无数据可导出', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: csv,
      success() {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      },
    });
  }

  return {
    autoSaveFeedback,
    openFeedback,
    closeFeedback,
    toggleCloudSea,
    toggleGlow,
    toggleStars,
    setRating,
    noteInput,
    submitFeedback,
    goHistory,
    exportFeedback,
  };
}

module.exports = { createFeedbackController };
