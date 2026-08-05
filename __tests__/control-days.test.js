const { buildControlDays } = require('../miniprogram/utils/tests/control-days');

const NOW = '2026-08-05T00:00:00.000Z';

const positives = [
  { date: '2026-04-23', location: '武功山', lat: 27.51, lon: 114.15, elevation: 1918, observed: true },
  { date: '2025-04-10', location: '武功山', lat: 27.51, lon: 114.15, elevation: 1918, observed: true },
  { date: '2024-11-02', location: '黄山', lat: 30.13, lon: 118.17, elevation: 1864, observed: true },
];
const negatives = [
  { date: '2024-10-19', location: '武功山', lat: 27.51, lon: 114.15, elevation: 1918, observed: false },
];
const dataset = [...positives, ...negatives];

describe('控制日负样本采样器', () => {
  test('每个正样本生成指定数量的控制日，且全部标记为弱负样本', () => {
    const controls = buildControlDays(dataset, { perPositive: 2, now: NOW });
    expect(controls).toHaveLength(positives.length * 2);
    for (const c of controls) {
      expect(c.observed).toBe(false);
      expect(c.pseudo).toBe(true);
      expect(c.source).toBe('control-day');
    }
  });

  test('控制日与正样本同机位同月，保持季节分布一致', () => {
    const controls = buildControlDays(dataset, { perPositive: 3, now: NOW });
    const monthsBySpot = new Map();
    for (const p of positives) {
      if (!monthsBySpot.has(p.location)) monthsBySpot.set(p.location, new Set());
      monthsBySpot.get(p.location).add(p.date.slice(5, 7));
    }
    for (const c of controls) {
      expect(monthsBySpot.get(c.location).has(c.date.slice(5, 7))).toBe(true);
      const origin = positives.find((p) => p.location === c.location);
      expect(c.lat).toBe(origin.lat);
      expect(c.elevation).toBe(origin.elevation);
    }
  });

  test('避让所有已标注日期，正负样本都不重叠', () => {
    const controls = buildControlDays(dataset, { perPositive: 3, guardDays: 3, now: NOW });
    for (const c of controls) {
      for (const o of dataset) {
        if (o.location !== c.location) continue;
        const gap = Math.abs(new Date(o.date) - new Date(c.date)) / 86400000;
        expect(gap).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test('控制日之间也互相避让，不会挤在同一周', () => {
    const controls = buildControlDays(dataset, { perPositive: 3, guardDays: 3, now: NOW });
    for (const spot of new Set(controls.map((c) => c.location))) {
      const dates = controls.filter((c) => c.location === spot).map((c) => c.date).sort();
      for (let i = 1; i < dates.length; i++) {
        const gap = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
        expect(gap).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test('不会生成 archive API 还没有数据的近期日期', () => {
    const controls = buildControlDays(dataset, { perPositive: 3, archiveLagDays: 10, now: NOW });
    const cutoff = new Date(new Date(NOW).getTime() - 10 * 86400000);
    for (const c of controls) {
      expect(new Date(c.date).getTime()).toBeLessThanOrEqual(cutoff.getTime());
    }
  });

  test('同一 seed 完全可复现，不同 seed 产出不同', () => {
    const a = buildControlDays(dataset, { perPositive: 2, seed: 42, now: NOW });
    const b = buildControlDays(dataset, { perPositive: 2, seed: 42, now: NOW });
    const c = buildControlDays(dataset, { perPositive: 2, seed: 7, now: NOW });
    expect(a).toEqual(b);
    expect(a.map((x) => x.date)).not.toEqual(c.map((x) => x.date));
  });

  test('负样本不作为生成种子，只有正样本才派生控制日', () => {
    const onlyNegative = buildControlDays(negatives, { perPositive: 2, now: NOW });
    expect(onlyNegative).toHaveLength(0);
  });

  test('生成的日期都是合法日历日，不会出现 4 月 31 日这种越界日', () => {
    const controls = buildControlDays(dataset, { perPositive: 3, now: NOW });
    for (const c of controls) {
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(c.date).toISOString().slice(0, 10)).toBe(c.date);
    }
  });
});
