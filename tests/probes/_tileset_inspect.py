#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""_tileset_inspect.py — 施工辅助（非探针）：分析 town_tileset 瓦片主色 + phase2b 截图 ASCII 可视化
用法: python tests/probes/_tileset_inspect.py [tileset|shot <png>|shots]"""
import sys, os
from PIL import Image

TS = 'public/assets/tiles/town_tileset.png'

def analyze_tileset():
    im = Image.open(TS).convert('RGBA')
    W, H = im.size
    print(f'tileset {W}x{H}, tiles {W//16}x{H//16}')
    for ty in range(H // 16):
        for tx in range(W // 16):
            tile = im.crop((tx*16, ty*16, tx*16+16, ty*16+16))
            px = list(tile.getdata())
            opaque = [p for p in px if p[3] > 40]
            n = len(px)
            nonbg = len(opaque)
            # 主色：按 (r//32, g//32, b//32) 量化统计
            from collections import Counter
            c = Counter()
            for p in opaque:
                c[(p[0]//48*48, p[1]//48*48, p[2]//48*48)] += 1
            top = c.most_common(3)
            desc = ' '.join(f'#{r:02x}{g:02x}{b:02x}x{n}' for (r, g, b), n in top)
            gid = ty * (W//16) + tx + 1
            print(f'gid{gid:2d} 实心{nonbg:3d}/{n}  {desc}')

def classify(p):
    r, g, b, a = p
    if a < 40:
        return ' '
    if r > 190 and g > 160 and b < 140:
        return '*'   # 暖光/亮橙
    if b > 70 and b > r + 15 and b >= g:
        return '~'   # 蓝(水 gid4: 30-60-90 系)
    if g > 75 and g >= r - 12 and g > b:
        return 'G'   # 绿(草地 gid1/树 gid16)
    if r > g + 20 and r > 110:
        return 'b'   # 棕(荒地 gid2/木/土)
    if r > g and r > b and r > 70:
        return '#'   # 暗红棕(屋顶 gid9/木墙)
    if r > 90 and g > 90:
        return '.'   # 灰白(石板/路/墙)
    return '+'

def analyze_shot(path, w=88):
    im = Image.open(path).convert('RGBA')
    ow, oh = im.size
    h = max(1, round(oh * w / ow))
    im2 = im.resize((w, h), Image.NEAREST)
    px = list(im2.getdata())
    print(f'--- {os.path.basename(path)} ({ow}x{oh}) ---')
    for y in range(h):
        row = ''.join(classify(px[y*w+x]) for x in range(w))
        print(row)

if __name__ == '__main__':
    arg = sys.argv[1] if len(sys.argv) > 1 else 'tileset'
    if arg == 'tileset':
        analyze_tileset()
    elif arg == 'shots':
        d = 'tests/probes/test-screenshots/phase2b'
        for f in sorted(os.listdir(d)):
            if f.endswith('.png'):
                analyze_shot(os.path.join(d, f))
    else:
        analyze_shot(arg)
