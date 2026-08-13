# -*- coding: utf-8 -*-
"""
路灯 v2 抠图（黑底版）：纯黑背景 → 透明 + 裁剪包围盒 + 等比缩放
用途：验证 GPT 深色底 sprite → 游戏可用透明 sprite 的链路

算法（背景是纯黑 (0,0,0)）：
- d = 像素到纯黑 (0,0,0) 的欧氏距离
- d < 18  → alpha=0（近黑背景）
- 18<=d<36 → alpha=(d-18)/18*255（边缘羽化）
- d >= 36 → alpha=255（路灯本体保留：暖黄灯亮度>100、木杆深棕亮度~21）
"""
from PIL import Image
import math

SRC = 'art_source/sprites_work/lamp_pointed_v2.png'
OUT = 'art_source/sprites_work/lamp_pointed_sprite.png'
TARGET_H = 48

img = Image.open(SRC).convert('RGBA')
w, h = img.size
px = img.load()

for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        d = math.sqrt(r * r + g * g + b * b)  # 到纯黑距离
        if d < 18:
            px[x, y] = (r, g, b, 0)
        elif d < 36:
            px[x, y] = (r, g, b, int((d - 18) / 18 * 255))
        # d >= 36 保留

bbox = img.getbbox()
print(f'原图: {w}x{h}, 抠图后非空包围盒: {bbox}')
img = img.crop(bbox)

cw, ch = img.size
scale = TARGET_H / ch
nw, nh = max(1, round(cw * scale)), TARGET_H
img = img.resize((nw, nh), Image.NEAREST)
print(f'裁剪+缩放: {cw}x{ch} -> {nw}x{nh} (宽高比 {nw/nh:.2f})')

img.save(OUT)

px2 = img.load()
total = nw * nh
trans = sum(1 for yy in range(nh) for xx in range(nw) if px2[xx, yy][3] == 0)
keep = total - trans
print(f'✅ 已保存: {OUT}')
print(f'像素统计: 透明={trans} ({trans/total*100:.1f}%), 保留={keep} ({keep/total*100:.1f}%)')

# 色板量化（验证像素风：颜色数越少越像 pixel art）
from collections import Counter
cnt = Counter()
for yy in range(nh):
    for xx in range(nw):
        if px2[xx, yy][3] > 0:
            cnt[px2[xx, yy][:3]] += 1
print(f'保留区独立颜色数: {len(cnt)}（像素风参考：≤32 为佳）')
print('top6 颜色:', cnt.most_common(6))
