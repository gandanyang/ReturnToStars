# -*- coding: utf-8 -*-
"""
Phase 3 资产链路验证：GPT 路灯 → 透明 sprite → 量化 → 进 town 视觉预览

Step 1: 量化 sprite（316 色 → 24 色，像素资产级色板）
Step 2: 放大 4x 棋盘背景展示图（给制作人看 sprite 细节）
Step 3: 贴进 town 截图做全景预览（验证"能放进青禾镇"）
"""
from PIL import Image

SPRITE = 'art_source/sprites_work/lamp_pointed_sprite.png'   # 已抠图 17x48
QUANT = 'art_source/sprites_work/lamp_pointed_quant.png'     # 量化后
SHOW4 = 'art_source/sprites_work/lamp_pointed_show4.png'     # 4x 展示
TOWN_SHOT = 'tests/probes/test-screenshots/town-life-day.png'
PREVIEW = 'art_source/sprites_work/lamp_preview_in_town.png'

# ---- Step 1: 量化 ----
img = Image.open(SPRITE).convert('RGBA')
# 分离 alpha：把透明像素排除在量化外（先转 RGB 再贴回 alpha）
alpha = img.split()[3]
rgb = img.convert('RGB')
q = rgb.quantize(colors=24, method=Image.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).convert('RGB')
q.putalpha(alpha)
q.save(QUANT)

from collections import Counter
px = q.load()
cnt = Counter()
for y in range(q.height):
    for x in range(q.width):
        if px[x, y][3] > 0:
            cnt[px[x, y][:3]] += 1
print(f'Step1 量化: {len(cnt)} 色（原 316 色）→ 已保存 {QUANT}')

# ---- Step 2: 4x 放大展示（棋盘背景） ----
show = q.resize((q.width * 4, q.height * 4), Image.NEAREST).convert('RGBA')
spx = show.load()
CHESS = [(200, 200, 200), (240, 240, 240)]
for y in range(show.height):
    for x in range(show.width):
        if spx[x, y][3] == 0:
            spx[x, y] = (*CHESS[(x // 8 + y // 8) % 2], 255)
show.save(SHOW4)
print(f'Step2 4x 展示: {show.size} → {SHOW4}')

# ---- Step 3: 进 town 预览 ----
try:
    town = Image.open(TOWN_SHOT).convert('RGBA')
except FileNotFoundError:
    print(f'⚠️ 无 town 截图 {TOWN_SHOT}，跳过 Step3（先跑 probe-town-life 生成）')
    town = None

if town:
    # 路灯 48px 高（3 tiles），贴到截图右下视野（模拟 S1 镇门旁）
    lamp = q.resize((q.width * 3, q.height * 3), Image.NEAREST)  # 51x144（更大更醒目，预览用）
    lx, ly = town.width - lamp.width - 60, town.height - lamp.height - 40
    town.alpha_composite(lamp, (lx, ly))
    # 标注
    from PIL import ImageDraw
    dr = ImageDraw.Draw(town)
    dr.text((lx, ly - 18), 'lamp sprite preview (3x)', fill=(255, 220, 100))
    town.save(PREVIEW)
    print(f'Step3 town 预览: 贴于 ({lx},{ly}) → {PREVIEW}')
