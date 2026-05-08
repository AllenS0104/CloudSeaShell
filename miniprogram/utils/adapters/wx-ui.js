function toast(msg, type) {
  wx.showToast({ title: String(msg || ''), icon: type || 'none' });
}

function loading(msg) {
  wx.showLoading({ title: String(msg || '加载中...'), mask: true });
}

function hideLoading() {
  wx.hideLoading();
}

module.exports = { toast, loading, hideLoading };
