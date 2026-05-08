const TEMPLATE_ID = 'TPL_OBSERVATION_REMINDER_PLACEHOLDER';

function installWxMock() {
  const store = new Map();
  global.wx = {
    requestSubscribeMessage: jest.fn(),
    getStorageSync: jest.fn(key => (store.has(key) ? store.get(key) : '')),
    setStorageSync: jest.fn((key, value) => store.set(key, value)),
    removeStorageSync: jest.fn(key => store.delete(key)),
    getStorageInfoSync: jest.fn(() => ({ keys: Array.from(store.keys()) })),
  };
  return store;
}

describe('miniprogram subscribe-message utility', () => {
  let subscribeMessage;
  let nowSpy;

  beforeEach(() => {
    jest.resetModules();
    installWxMock();
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-20T00:00:00.000Z').getTime());
    subscribeMessage = require('../miniprogram/utils/subscribe-message');
  });

  afterEach(() => {
    nowSpy.mockRestore();
    delete global.wx;
  });

  test('requestObservationReminderAuth resolves authorized on accept', async () => {
    global.wx.requestSubscribeMessage.mockImplementation(({ tmplIds, success }) => {
      expect(tmplIds).toEqual([TEMPLATE_ID]);
      success({ [TEMPLATE_ID]: 'accept' });
    });

    await expect(subscribeMessage.requestObservationReminderAuth()).resolves.toEqual(expect.objectContaining({
      authorized: true,
      templateId: TEMPLATE_ID,
      status: 'accept',
    }));
  });

  test('requestObservationReminderAuth resolves unauthorized on reject/fail', async () => {
    global.wx.requestSubscribeMessage.mockImplementationOnce(({ success }) => {
      success({ [TEMPLATE_ID]: 'reject' });
    });
    await expect(subscribeMessage.requestObservationReminderAuth()).resolves.toEqual(expect.objectContaining({
      authorized: false,
      status: 'reject',
    }));

    global.wx.requestSubscribeMessage.mockImplementationOnce(({ fail }) => {
      fail({ errMsg: 'requestSubscribeMessage:fail cancel' });
    });
    await expect(subscribeMessage.requestObservationReminderAuth()).resolves.toEqual(expect.objectContaining({
      authorized: false,
      status: 'fail',
      errMsg: 'requestSubscribeMessage:fail cancel',
    }));
  });

  test('schedule, listPending, and markSubscribeMessageSent move payload to log', () => {
    const scheduled = subscribeMessage.scheduleSubscribeMessage({
      templateKey: 'observationReminder',
      fireAt: '2026-04-20T05:30:00.000Z',
      locationName: '黄山光明顶',
      data: {
        thing1: { value: '观测地点：黄山光明顶' },
        time2: { value: '2026-04-20 05:30' },
      },
    });

    expect(scheduled).toEqual(expect.objectContaining({
      id: expect.any(String),
      status: 'pending',
      templateId: TEMPLATE_ID,
      locationName: '黄山光明顶',
      page: 'pages/index/index',
    }));
    expect(subscribeMessage.listPendingSubscribeMessages()).toHaveLength(1);

    const logged = subscribeMessage.markSubscribeMessageSent(scheduled.id);
    expect(logged).toEqual(expect.objectContaining({
      id: scheduled.id,
      status: 'sent',
      note: expect.stringContaining('client-side log only'),
    }));
    expect(subscribeMessage.listPendingSubscribeMessages()).toEqual([]);
  });

  test('expired fireAt is not queued and returns expired', () => {
    const result = subscribeMessage.scheduleSubscribeMessage({
      templateKey: 'observationReminder',
      fireAt: '2026-04-19T23:59:00.000Z',
      locationName: '过期地点',
      data: {},
    });

    expect(result).toBe('expired');
    expect(subscribeMessage.listPendingSubscribeMessages()).toEqual([]);
    expect(global.wx.setStorageSync).not.toHaveBeenCalled();
  });
});
