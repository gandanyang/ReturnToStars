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
    # 背景色探测：取四角 + 边框中心点的中位色（抗单个杂点）
    samples = [px[x, y][:3] for (x, y) in [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ]]
    # 中位色作为背景色（深灰/纯黑/红黑都能识别）
    sorted_samples = sorted(samples)
    bg = sorted_samples[len(sorted_samples) // 2]
    bg_lum = sum(bg) / 3
    print(f'  背景色: rgb{bg} (lum={bg_lum:.0f})')
    # 抠图：颜色距离背景 < 阈值 → 透明（羽化边缘）
    # 阈值按背景亮度自适应：暗背景用较大阈值（容忍深灰），亮背景同理
    bg_light = bg_lum > 128
    tol = 70 if bg_light else 90  # 暗背景更难分离（插画阴影多），用更大容差
    inner_tol = tol * 0.55        # 内层更严格，保护物体内部
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            dr, dg, db = r - bg[0], g - bg[1], b - bg[2]
            dist = math.sqrt(dr * dr + dg * dg + db * db)
            if dist < inner_tol:
                px[x, y] = (r, g, b, 0)
            elif dist < tol:
                px[x, y] = (r, g, b, int((tol - dist) / (tol - inner_tol) * 255))
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
