# -*- coding: utf-8 -*-
"""
主角林澈 spritesheet 生成：4 张 AI 站立图 → 抠图/缩放/量化 → 行走帧合成 → player.png
输出保持 player.png 布局：row0 down / row1 left / row2 right / row3 up，每帧 32x32（4x4=128x128）
"""
import math, os, sys
from PIL import Image
from collections import Counter

SRC = 'assets/linche_raw'
OUT = 'public/assets/sprites/player.png'
FRAME = 32
TARGET_H = 28  # 角色高（帧内留白）

def cutout(img):
    """抠图：自适应背景色，羽化边缘。返回透明图。"""
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    samples = [px[x, y][:3] for (x, y) in [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ]]
    sorted_samples = sorted(samples)
    bg = sorted_samples[len(sorted_samples) // 2]
    bg_lum = sum(bg) / 3
    bg_light = bg_lum > 128
    tol = 70 if bg_light else 90
    inner_tol = tol * 0.55
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
    return img

def to_sprite(img, target_h, min_w=11):
    """裁剪 + 等比缩放(NEAREST) + 量化。保证最小宽度（避免背面/侧身缩太窄）。返回 RGBA 小图。"""
    img = img.crop(img.getbbox())
    cw, ch = img.size
    scale = target_h / ch
    nw, nh = max(1, round(cw * scale)), target_h
    # 最小宽度约束：窄角色加宽（高度相应降低），避免"背面/侧身缩水"
    if nw < min_w:
        nw = min_w
        nh = max(1, round(nw * ch / cw))
    # 高度 clamp 到帧内（留 2px）
    if nh > FRAME - 2:
        nh = FRAME - 2
        nw = max(min_w, round(nh * cw / ch))
    img = img.resize((nw, nh), Image.NEAREST)
    alpha = img.split()[3]
    q = img.convert('RGB').quantize(colors=20, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q.putalpha(alpha)
    return q

def walk_frames(sprite):
    """从站立帧生成 4 帧行走：整体左右微摆 + 上下浮（不分离脚部，避免腿部错位）。返回 4 张 32x32。"""
    w, h = sprite.size
    frames = []
    # 每帧整体偏移：(dx, dy)  dx=左右迈步, dy=上下浮
    offs = [(0, 0), (-1, 1), (1, 0), (1, 1)]
    for f in range(4):
        canvas = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
        dx, dy = offs[f]
        x0 = (FRAME - w) // 2 + dx
        y0 = (FRAME - h) // 2 + dy  # 垂直居中（避免贴底/偏下导致下半身被盖）
        canvas.paste(sprite, (x0, y0), sprite)
        frames.append(canvas)
    return frames

def main():
    dirs = {'down': 'front', 'left': 'left', 'right': 'right', 'up': 'back'}
    sheet = Image.new('RGBA', (FRAME * 4, FRAME * 4), (0, 0, 0, 0))
    for row, (anim_dir, file_dir) in enumerate(dirs.items()):
        src = os.path.join(SRC, f'linche_{file_dir}.png')
        if not os.path.exists(src):
            print(f'缺 {src}')
            continue
        img = cutout(Image.open(src))
        sprite = to_sprite(img, TARGET_H)
        frames = walk_frames(sprite)
        for col, fr in enumerate(frames):
            sheet.paste(fr, (col * FRAME, row * FRAME))
        print(f'{anim_dir} ({file_dir}): sprite {sprite.size} -> 4 帧')
    sheet.save(OUT)
    print(f'已保存 {OUT} ({sheet.size})')

if __name__ == '__main__':
    main()
