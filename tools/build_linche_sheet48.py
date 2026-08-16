# -*- coding: utf-8 -*-
"""
林澈 sprite sheet 生成（指导文档管线：正面/背面/侧面 + flipX）
输出：128x192（4 行 × 4 帧，每帧 32x48）
  row0=down(front) row1=up(back) row2=left(side) row3=right(side 镜像 flipX)
行走帧：站 / 走1(左腿前) / 站 / 走2(右腿前) —— 腿部交替 + 身体 bob
"""
import math
from PIL import Image

SRC = 'characters/linche'
OUT = 'public/assets/sprites/player.png'
FW, FH = 32, 48
TARGET_H = 44  # 角色高（帧高 48 留 4px 底）

def cutout(img):
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    samples = [px[x, y][:3] for (x, y) in [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ]]
    bg = sorted(samples)[len(samples) // 2]
    bg_lum = sum(bg) / 3
    tol = 70 if bg_lum > 128 else 90
    inner = tol * 0.55
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            d = math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2)
            if d < inner:
                px[x, y] = (r, g, b, 0)
            elif d < tol:
                px[x, y] = (r, g, b, int((tol - d) / (tol - inner) * 255))
    return img

def to_sprite(img):
    """裁剪 + 等比缩放（高 TARGET_H，宽按比例，保证不超 32）"""
    img = img.crop(img.getbbox())
    cw, ch = img.size
    scale = TARGET_H / ch
    nw = max(1, round(cw * scale))
    if nw > FW - 2:
        nw = FW - 2
    nh = max(1, round(nw * ch / cw))
    if nh > TARGET_H:
        nh = TARGET_H
        nw = max(1, round(nh * cw / ch))
    img = img.resize((nw, nh), Image.NEAREST)
    alpha = img.split()[3]
    q = img.convert('RGB').quantize(colors=24, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q.putalpha(alpha)
    return q

def split_legs(sprite, leg_h=14):
    """分离身体（上部）与左/右腿（底部 leg_h，按中缝分左右）"""
    w, h = sprite.size
    body = sprite.crop((0, 0, w, h - leg_h))
    legs = sprite.crop((0, h - leg_h, w, h))
    mid = w // 2
    leg_l = legs.crop((0, 0, mid, leg_h))
    leg_r = legs.crop((mid, 0, w - mid, leg_h))
    return body, leg_l, leg_r, mid, leg_h

def walk_frames(sprite):
    """4 帧行走：站/走1/站/走2 —— 腿交替 + 身体 bob"""
    w, h = sprite.size
    body, leg_l, leg_r, mid, leg_h = split_legs(sprite)
    poses = [
        (0, 0, 0),    # 站
        (-2, 1, 1),   # 走1：左腿前(左移) 右腿后 + 下沉
        (0, 0, 0),    # 站
        (1, -2, 1),   # 走2：右腿前 左腿后 + 下沉
    ]
    frames = []
    for lx, rx, dy in poses:
        canvas = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
        x0 = (FW - w) // 2
        by = FH - h + dy
        canvas.paste(body, (x0, by), body)
        canvas.paste(leg_l, (x0 + lx, by + (h - leg_h)), leg_l)
        canvas.paste(leg_r, (x0 + mid + rx, by + (h - leg_h)), leg_r)
        frames.append(canvas)
    return frames

def main():
    sheet = Image.new('RGBA', (FW * 4, FH * 4), (0, 0, 0, 0))
    order = [('front', 0), ('back', 1), ('side', 2)]  # down/up/left
    for name, row in order:
        img = cutout(Image.open(f'{SRC}/{name}.png'))
        sprite = to_sprite(img)
        frames = walk_frames(sprite)
        for col, fr in enumerate(frames):
            sheet.paste(fr, (col * FW, row * FH))
        print(f'{name}: sprite {sprite.size}')
    # row3 = right = side 镜像（flipX）
    side_frames = []
    for col in range(4):
        fr = sheet.crop((col * FW, 2 * FH, col * FW + FW, 2 * FH + FH))
        side_frames.append(fr.transpose(Image.FLIP_LEFT_RIGHT))
    for col, fr in enumerate(side_frames):
        sheet.paste(fr, (col * FW, 3 * FH))
    sheet.save(OUT)
    print(f'已保存 {OUT} ({sheet.size})')

if __name__ == '__main__':
    main()
