# -*- coding: utf-8 -*-
"""
把 SD 出的 4 方向站立像素图，处理成游戏 player.png 格式的 128x128 4x4 sheet。
用法: python tools/make_player_sheet.py <目录> <输出.png>
布局对齐 player.png: row0=down(front) row1=left row2=right row3=up(back)，每行 4 帧。
目前移动帧暂缺，每方向 4 帧用同一张站立图重复（滑步，先验证方向+像素质量）。
"""
import math, os, sys, glob
from PIL import Image

SIZE = 32

def load_and_cut(path):
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    px = img.load()
    samples = [px[x, y][:3] for (x, y) in [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ]]
    bg = sorted(samples)[len(samples) // 2]
    tol, inner = 90, 90 * 0.55
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            dr, dg, db = r - bg[0], g - bg[1], b - bg[2]
            dist = math.sqrt(dr * dr + dg * dg + db * db)
            if dist < inner:
                px[x, y] = (r, g, b, 0)
            elif dist < tol:
                px[x, y] = (r, g, b, int((tol - dist) / (tol - inner) * 255))
    bbox = img.getbbox()
    if not bbox:
        return None
    img = img.crop(bbox)
    cw, ch = img.size
    scale = SIZE / max(cw, ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    img = img.resize((nw, nh), Image.NEAREST)
    alpha = img.split()[3]
    q = img.convert('RGB').quantize(colors=24, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q.putalpha(alpha)
    return q

def to_frame(img):
    fw, fh = img.size
    frame = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    x = (SIZE - fw) // 2
    y = SIZE - fh
    frame.paste(img, (x, y), img)
    return frame

def find_file(d, key):
    pat = os.path.join(d, f'{key}_*.png')
    fs = sorted(glob.glob(pat))
    return fs[-1] if fs else None

def main(d, out):
    order = [('front', 0), ('left', 1), ('right', 2), ('back', 3)]
    sheet = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    for key, row in order:
        f = find_file(d, key)
        if not f:
            print(f'!! 缺 {key} 图，跳过 row {row}')
            continue
        cut = load_and_cut(f)
        if cut is None:
            print(f'!! {key} 抠图后为空')
            continue
        frame = to_frame(cut)
        # 统计帧内非透明像素
        a = frame.split()[3]
        opaque = sum(1 for v in a.getdata() if v > 0)
        print(f'{key:6s} -> {cut.size} (opaque {opaque}/1024 = {opaque/1024*100:.0f}%)  row={row}')
        for c in range(4):
            sheet.paste(frame, (c * SIZE, row * SIZE), frame)
    sheet.save(out)
    print(f'✅ 输出 {out} {sheet.size}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
