# -*- coding: utf-8 -*-
"""
通用 sprite 生产脚本（Phase 3 资产管线，路灯验证后固化为模板）
用法: python sprite_process.py <src> <out> <target_h>

链路: GPT 黑底图 → 黑→透明(阈值18/36羽化) → 裁剪包围盒 → 等比缩放(NEAREST) → 量化24色(NONE无抖动)
"""
import math, sys
from PIL import Image
from collections import Counter

def process(src, out, target_h):
    img = Image.open(src).convert('RGBA')
    w, h = img.size
    px = img.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            d = math.sqrt(r * r + g * g + b * b)
            if d < 18:
                px[x, y] = (r, g, b, 0)
            elif d < 36:
                px[x, y] = (r, g, b, int((d - 18) / 18 * 255))
    bbox = img.getbbox()
    img = img.crop(bbox)
    cw, ch = img.size
    scale = target_h / ch
    nw, nh = max(1, round(cw * scale)), target_h
    img = img.resize((nw, nh), Image.NEAREST)
    alpha = img.split()[3]
    q = img.convert('RGB').quantize(colors=24, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q.putalpha(alpha)
    q.save(out)
    px2 = q.load()
    cnt = Counter()
    for yy in range(nh):
        for xx in range(nw):
            if px2[xx, yy][3] > 0:
                cnt[px2[xx, yy][:3]] += 1
    total = nw * nh
    trans = sum(1 for yy in range(nh) for xx in range(nw) if px2[xx, yy][3] == 0)
    print(f'✅ {out}: 裁剪{cw}x{ch} -> {nw}x{nh}, 色数{len(cnt)}, 透明{trans/total*100:.0f}%')
    print(f'   top5色: {cnt.most_common(5)}')

if __name__ == '__main__':
    process(sys.argv[1], sys.argv[2], int(sys.argv[3]))
