const { placeCandidates } = require('../scripts/social-ingest');

// 分类地名回落只对晚霞开放，因为晚霞是几十公里尺度的现象，城市级坐标够用。
// 但 Nominatim 对任何字符串都会尽力返回点东西，所以候选提取这一关必须严，
// 否则会把「拍的是什么」当成「在哪拍的」。下面每条用例都对应一次实测事故。
describe('placeCandidates', () => {
  const cats = (...names) => names.map((n) => ({ title: `Category:${n}` }));

  test('真地名要留住', () => {
    expect(placeCandidates(cats('Guangzhou'))).toContain('Guangzhou');
    expect(placeCandidates(cats('Estes Park, Colorado'))).toContain('Estes Park, Colorado');
    expect(placeCandidates(cats('東京'))).toContain('東京');
  });

  test('介词式分类要能取出地名', () => {
    expect(placeCandidates(cats('Sunsets of Molokaʻi'))).toContain('Molokaʻi');
    expect(placeCandidates(cats('Clouds at sunset in San Francisco'))).toContain('San Francisco');
  });

  test('年份前缀分类也要能取出地名', () => {
    expect(placeCandidates(cats('2019 in Schuyler County, New York')))
      .toContain('Schuyler County, New York');
  });

  test('内容主题词不是地名（实测 "Sunsets" 会匹配到一栋叫 Sunsets 的房子）', () => {
    expect(placeCandidates(cats('Sunsets'))).toHaveLength(0);
    expect(placeCandidates(cats('Golden sunsets'))).toHaveLength(0);
    expect(placeCandidates(cats('Images of nebulae'))).toHaveLength(0);
  });

  test('EXIF 分类不是地名（实测 "F-number f/11" 骗过了类型闸门）', () => {
    expect(placeCandidates(cats('F-number f/11'))).toHaveLength(0);
    expect(placeCandidates(cats('ISO speed rating 200'))).toHaveLength(0);
  });

  test('"the United States" 这类会匹配到人行道，必须拒', () => {
    expect(placeCandidates(cats('Clouds in the United States'))).toHaveLength(0);
  });

  test('画作与外星图的分类不参与（它们本就不该进样本）', () => {
    expect(placeCandidates(cats('1878 oil on canvas paintings in the United States')))
      .toHaveLength(0);
    expect(placeCandidates(cats('Featured pictures of Mars', 'Featured pictures from NASA')))
      .toHaveLength(0);
  });

  test('许可证与维护类分类全部剔除', () => {
    expect(placeCandidates(cats(
      'CC-BY-SA-4.0',
      'Flickr images reviewed by FlickreviewR 2',
      'Photos imported with import-500px',
      'Wiki Loves Earth 2025 in Nepal',
    ))).toHaveLength(0);
  });

  test('空输入不炸', () => {
    expect(placeCandidates(undefined)).toEqual([]);
    expect(placeCandidates([])).toEqual([]);
  });
});
