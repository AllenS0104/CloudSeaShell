/* global wx */
const storage = require('./adapters/wx-storage');
const { templateIds } = require('../config/subscribe-templates');

const PENDING_KEY = 'cloudsea_subscribe_messages_pending';
const LOG_KEY = 'cloudsea_subscribe_messages_log';
const INBOX_KEY = 'cloudsea_subscribe_messages_inbox';

function readList(key) {
  const value = storage.get(key);
  return Array.isArray(value) ? value : [];
}

function writeList(key, list) {
  storage.set(key, Array.isArray(list) ? list : []);
}

function makeId(templateKey, fireAt) {
  return `${templateKey}_${new Date(fireAt).getTime()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getTemplateId(templateKey) {
  return templateIds[templateKey];
}

function requestObservationReminderAuth() {
  const templateId = getTemplateId('observationReminder');
  if (!templateId || typeof wx === 'undefined' || typeof wx.requestSubscribeMessage !== 'function') {
    return Promise.resolve({
      authorized: false,
      templateId,
      status: 'unavailable',
      errMsg: 'wx.requestSubscribeMessage unavailable',
    });
  }

  return new Promise(resolve => {
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success(res) {
        const status = res && res[templateId];
        resolve({
          authorized: status === 'accept',
          templateId,
          status: status || 'unknown',
          raw: res,
        });
      },
      fail(err) {
        resolve({
          authorized: false,
          templateId,
          status: 'fail',
          errMsg: err && err.errMsg,
          raw: err,
        });
      },
    });
  });
}

function scheduleSubscribeMessage({ templateKey, data, fireAt, locationName }) {
  const fireAtMs = new Date(fireAt).getTime();
  if (!Number.isFinite(fireAtMs) || fireAtMs <= Date.now()) {
    return 'expired';
  }

  const templateId = getTemplateId(templateKey);
  if (!templateId) {
    return { status: 'invalid-template', templateKey };
  }

  const item = {
    id: makeId(templateKey, fireAt),
    templateKey,
    templateId,
    data: data || {},
    fireAt: new Date(fireAtMs).toISOString(),
    locationName: locationName || '',
    page: 'pages/index/index',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const pending = readList(PENDING_KEY).filter(existing => existing.id !== item.id);
  pending.push(item);
  pending.sort((left, right) => new Date(left.fireAt).getTime() - new Date(right.fireAt).getTime());
  writeList(PENDING_KEY, pending);
  console.info('[subscribe-message] scheduled', item);
  return item;
}

function listPendingSubscribeMessages() {
  return readList(PENDING_KEY).filter(item => item && item.status === 'pending');
}

function appendLoggedMessage(item, status) {
  const logged = {
    ...item,
    status,
    loggedAt: new Date().toISOString(),
    note: 'client-side log only; server sendSubscribeMessage integration pending',
  };
  writeList(LOG_KEY, [logged].concat(readList(LOG_KEY)).slice(0, 100));
  writeList(INBOX_KEY, [logged].concat(readList(INBOX_KEY)).slice(0, 50));
  console.info('[subscribe-message] due payload logged', logged);
  return logged;
}

function markSubscribeMessageSent(id) {
  const pending = listPendingSubscribeMessages();
  const target = pending.find(item => item.id === id);
  writeList(PENDING_KEY, pending.filter(item => item.id !== id));
  if (!target) {
    return null;
  }
  return appendLoggedMessage(target, 'sent');
}

function flushDueSubscribeMessages(now = Date.now()) {
  const due = listPendingSubscribeMessages().filter(item => new Date(item.fireAt).getTime() <= now);
  due.forEach(item => markSubscribeMessageSent(item.id));
  return due;
}

module.exports = {
  requestObservationReminderAuth,
  scheduleSubscribeMessage,
  listPendingSubscribeMessages,
  markSubscribeMessageSent,
  flushDueSubscribeMessages,
};
