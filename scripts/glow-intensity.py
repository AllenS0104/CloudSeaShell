#!/usr/bin/env python3
"""
用图像像素客观量化「大烧」强度。

问题背景：上一轮晚霞审计把"有人拍到晚霞"当正样本，AUC 只有 0.610，
而且诊断显示所有单变量信号都弱。根因是**标签口径太松**——晚霞几乎天天有，
只是程度不同，所以"有/无"这个二分类本身就没什么信息量。

用户要的其实是**大烧**：颜色艳丽的红/橘红。这是个强度概念，不是有无概念。

与其靠标题文字猜强度（"sunset glow" 这种词对强弱毫无区分力），
不如直接看照片本身的像素——大烧的定义就写在颜色里。

火烧指数 = 天空区域中「红橙色相 + 高饱和 + 足够亮」的像素占比。

图片来自 Wikimedia Commons（自由许可），仅本地分析用于打标签，不再分发。
"""

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from io import BytesIO

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
OBS = os.path.join(ROOT, 'data', 'observations-glow.json')
OUT = os.path.join(ROOT, 'data', 'glow-intensity.json')
CACHE = os.path.join(ROOT, '.glow-image-cache.json')

UA = 'CloudSeaShell/1.0 (research; contact via github AllenS0104/CloudSeaShell)'
API = 'https://commons.wikimedia.org/w/api.php'


def get_json(url, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception:  # noqa: BLE001
            if i == tries - 1:
                raise
            # Commons 对匿名客户端限流很紧，429 要退避而不是放弃，
            # 否则样本会被"网络运气"筛掉，引入与天气无关的偏差。
            time.sleep(2.0 * (i + 1))
    raise RuntimeError('unreachable')


def thumb_urls(titles, width=400):
    """
    批量取缩略图 URL。逐个查会几十次打 API 直接吃 429，
    而 Commons 单次请求就支持 50 个 title。
    """
    out = {}
    for i in range(0, len(titles), 50):
        chunk = titles[i:i + 50]
        q = urllib.parse.urlencode({
            'action': 'query', 'format': 'json', 'prop': 'imageinfo',
            'iiprop': 'url', 'iiurlwidth': str(width), 'titles': '|'.join(chunk),
        })
        j = get_json(f'{API}?{q}')
        # normalized 用来把请求里的标题写法映射回 API 返回的规范写法
        norm = {n['to']: n['from'] for n in j.get('query', {}).get('normalized', [])}
        for p in j.get('query', {}).get('pages', {}).values():
            ii = p.get('imageinfo')
            if not ii:
                continue
            t = p.get('title')
            out[norm.get(t, t)] = ii[0].get('thumburl') or ii[0].get('url')
        time.sleep(1.0)
    return out


def fetch_image(url, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return Image.open(BytesIO(r.read()))
        except Exception:  # noqa: BLE001
            if i == tries - 1:
                raise
            time.sleep(2.5 * (i + 1))
    raise RuntimeError('unreachable')


def fiery_metrics(img):
    """
    返回天空区域的火烧指标。

    只取图像上半部：晚霞在天上，下半部多是地景/建筑/水面，
    掺进来会被地面的暖色（灯光、砖墙、沙滩）污染。
    """
    img = img.convert('RGB')
    w, h = img.size
    img = img.crop((0, 0, w, max(1, h // 2)))
    img.thumbnail((200, 200))

    hsv = np.asarray(img.convert('HSV'), dtype=np.float32)
    H = hsv[..., 0] * 360.0 / 255.0
    S = hsv[..., 1] / 255.0
    V = hsv[..., 2] / 255.0

    # 红-橙-琥珀：大烧的颜色。粉紫（H>300）单列，那是另一种晚霞，
    # 用户明确要的是"红、橘红"。
    warm = ((H <= 45) | (H >= 345))
    vivid = warm & (S >= 0.35) & (V >= 0.25)
    # 更严格的一档：真正"烧起来"的浓艳红橙
    blazing = warm & (S >= 0.55) & (V >= 0.35)

    return {
        'fiery': float(vivid.mean()),
        'blazing': float(blazing.mean()),
        'skySat': float(S.mean()),
        'skyVal': float(V.mean()),
        'warmRatio': float(warm.mean()),
    }


def main():
    with open(OBS, encoding='utf-8') as f:
        raw = json.load(f)
    obs = raw if isinstance(raw, list) else raw.get('observations', [])
    obs = [o for o in obs if not o.get('rejected') and o.get('url')]

    cache = {}
    if os.path.exists(CACHE):
        with open(CACHE, encoding='utf-8') as f:
            cache = json.load(f)

    out = []
    titles = []
    by_title = {}
    for o in obs:
        m = re.search(r'/wiki/(.+)$', o['url'])
        if not m:
            continue
        t = urllib.parse.unquote(m.group(1))
        titles.append(t)
        by_title[t] = o

    todo = [t for t in titles if t not in cache]
    urls = thumb_urls(todo) if todo else {}
    print(f'需下载 {len(todo)} 张，已缓存 {len(titles) - len(todo)} 张')

    for i, t in enumerate(titles):
        if t in cache:
            met = cache[t]
        else:
            tu = urls.get(t)
            if not tu:
                cache[t] = None
                met = None
            else:
                try:
                    met = fiery_metrics(fetch_image(tu))
                    cache[t] = met
                    # 匿名客户端自我节流，别给 Commons 添麻烦
                    time.sleep(0.6)
                except Exception as e:  # noqa: BLE001
                    print(f'  跳过 {t[:50]}: {e}', file=sys.stderr)
                    cache[t] = None
                    met = None
            if (i + 1) % 10 == 0:
                with open(CACHE, 'w', encoding='utf-8') as f:
                    json.dump(cache, f)
                print(f'  处理 {i + 1}/{len(titles)}')

        if met:
            rec = dict(by_title[t])
            rec.update(met)
            out.append(rec)

    with open(CACHE, 'w', encoding='utf-8') as f:
        json.dump(cache, f)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    print(f'\n成功分析 {len(out)} / {len(obs)} 张\n')

    fiery = np.array([r['fiery'] for r in out])
    blazing = np.array([r['blazing'] for r in out])
    print('火烧指数分布（天空区域红橙+高饱和像素占比）')
    for p in [10, 25, 50, 75, 90]:
        print(f'  P{p:<3d}  fiery {np.percentile(fiery, p):.3f}   blazing {np.percentile(blazing, p):.3f}')

    print('\n火烧指数最高的 10 张（应当肉眼可见是大烧）')
    for r in sorted(out, key=lambda x: -x['fiery'])[:10]:
        print(f'  {r["fiery"]:.3f}  {r["location"][:44]:<46} {r["url"]}')

    print('\n火烧指数最低的 10 张（应当是寡淡/灰白的天）')
    for r in sorted(out, key=lambda x: x['fiery'])[:10]:
        print(f'  {r["fiery"]:.3f}  {r["location"][:44]:<46} {r["url"]}')


if __name__ == '__main__':
    main()
