#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tools/make_store_shots.py — TapTap 商店截图规范化管线（P0-03 合规版）

规则（TapTap 2026 规范）：
- 横图宽高比 8:3 ~ 8:5；本管线统一 8:5（1.6:1）
- 分辨率 ≥1280×720；统一输出 1280×800
- 单张 <4MB；JPG 输出
- 实机截图排最前；概念图 ≤2 张

用法:
  python tools/make_store_shots.py --in-list jobs.json
  # jobs.json: [{ "src":..., "out":..., "text":... }]
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT_SIMHEI = "C:/Windows/Fonts/simhei.ttf"
BG = (8, 12, 22, 165)
WHITE = (255, 255, 255, 255)
STROKE = (12, 16, 26, 220)
RATIO = (8, 5)
MIN_W = 1280
OUT_H = 800  # 1280x800 = 8:5

def text_w(draw, s, font):
    b = draw.textbbox((0, 0), s, font=font)
    return b[2] - b[0]

def crop_to_ratio(img, rx, ry):
    w, h = img.size
    target = rx / ry
    cur = w / h
    if abs(cur - target) < 0.01:
        return img
    if cur > target:  # 太宽 → 裁左右
        nw = int(h * target)
        x0 = (w - nw) // 2
        return img.crop((x0, 0, x0 + nw, h))
    nh = int(w / target)  # 太高 → 裁上下
    y0 = (h - nh) // 2
    return img.crop((0, y0, w, y0 + nh))

def add_title(img, text, size=32):
    W, H = img.size
    draw = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT_SIMHEI, size)
    while size > 16 and text_w(draw, text, f) > W * 0.82:
        size -= 2
        f = ImageFont.truetype(FONT_SIMHEI, size)
    tw = text_w(draw, text, f)
    pad_x, pad_y = 26, 12
    bar_h = int(H * 0.13)
    bar_x0 = (W - tw) / 2 - pad_x
    bar_y0 = H - bar_h
    bar_x1 = bar_x0 + tw + pad_x * 2
    bar_y1 = bar_y0 + f.size + pad_y * 2
    draw.rounded_rectangle([bar_x0, bar_y0, bar_x1, bar_y1], radius=12, fill=BG)
    draw.text(((W - tw) / 2, bar_y0 + pad_y), text, font=f,
              fill=WHITE, stroke_width=2, stroke_fill=STROKE)
    return img

def process(src, out, text):
    img = Image.open(src).convert("RGB")
    img = crop_to_ratio(img, *RATIO)
    # 放大到 ≥1280 宽（保持 8:5 → 1280×800）
    w, h = img.size
    if w < MIN_W:
        scale = MIN_W / w
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    # 确保恰好 1280×800（float 四舍五入误差修正）
    img = img.resize((1280, 800), Image.LANCZOS)
    img = add_title(img, text)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "JPEG", quality=92)
    import os
    print(f"✅ {out}  {img.size}  {round(os.path.getsize(out)/1024/1024,2)}MB  [{text}]")

def main():
    jobs_file = sys.argv[1] if len(sys.argv) > 1 else "tmp/store-jobs.json"
    jobs = json.loads(Path(jobs_file).read_text(encoding="utf-8"))
    for j in jobs:
        process(j["src"], j["out"], j["text"])

if __name__ == "__main__":
    main()
