#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tools/make_screenshot_text.py — 商店截图叠字工具（P0-03 产出）

区别于 make_tap_cover.py（封面三行标题）：
截图叠字是底部一条简洁白色短标题（居中，半透明深底条），不叠主副双标题。

用法:
  python tools/make_screenshot_text.py <底图> <输出> --text "岛上有一片爷爷看过的星空"
  # 默认从 marketing/screenshots/_copy.csv 第一列推断标题？——不，默认走 --text

样式（适配 1024x768 横屏）:
  - 标题条：高度约屏幕 10%，底部 padding，背景 rgba(8,12,22,165) 圆角
  - 字体：微软雅黑 Bold 30-40px，白色 + 极淡描边
"""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_SIMHEI = "C:/Windows/Fonts/simhei.ttf"
BG = (8, 12, 22, 165)
WHITE = (255, 255, 255, 255)
STROKE = (12, 16, 26, 220)

def text_w(draw, s, font):
    b = draw.textbbox((0, 0), s, font=font)
    return b[2] - b[0]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=str)
    ap.add_argument("out", type=str, nargs="?", default=None)
    ap.add_argument("--text", type=str, required=True)
    ap.add_argument("--text-size", type=int, default=36)
    ap.add_argument("--bar-height-ratio", type=float, default=0.12, help="底部标题条占图高度比例")
    args = ap.parse_args()

    img = Image.open(args.src).convert("RGBA")
    W, H = img.size
    draw = ImageDraw.Draw(img)

    f = ImageFont.truetype(FONT_SIMHEI, args.text_size)
    # 动态字号：太宽就降
    while args.text_size > 18 and text_w(draw, args.text, f) > W * 0.82:
        args.text_size -= 2
        f = ImageFont.truetype(FONT_SIMHEI, args.text_size)

    tw = text_w(draw, args.text, f)
    pad_x, pad_y = 30, 14
    bar_h = int(H * args.bar_height_ratio)
    bar_x0 = (W - tw) / 2 - pad_x
    bar_y0 = H - bar_h
    bar_x1 = bar_x0 + tw + pad_x * 2
    bar_y1 = bar_y0 + f.size + pad_y * 2
    draw.rounded_rectangle([bar_x0, bar_y0, bar_x1, bar_y1], radius=12, fill=BG)
    draw.text(((W - tw) / 2, bar_y0 + pad_y), args.text, font=f,
              fill=WHITE, stroke_width=2, stroke_fill=STROKE)

    out = args.out or str(Path(args.src).with_name(Path(args.src).stem + "-text.png"))
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out, quality=95)
    print(f"✅ 叠字完成: {out}  ({W}x{H})  text=[{args.text}]")

if __name__ == "__main__":
    main()