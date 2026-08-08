#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tools/make_tap_cover.py — TapTap 封面叠字工具（P0-02 / P1-01 复用）

用法:
  python tools/make_tap_cover.py <底图> <输出> [--title 归星物语] [--sub-en "Return to the Star Island"] [--sub-cn "当生活只剩下效率，你是否还记得自己为什么出发？"]

默认读取 marketing/text/tap上架文案定稿.md 的文案（若存在）。
叠字版式（适配 1536x864 16:9 封面）:
  - 主标题（金色 + 深描边）顶部居中
  - 英文副题（淡蓝白）主标题下方
  - 中文副标题（白字 + 半透明黑底条）底部居中
"""

import argparse
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"   # 微软雅黑粗体（主标题）
FONT_REG = "C:/Windows/Fonts/msyh.ttc"      # 微软雅黑（副题）
FONT_SIMHEI = "C:/Windows/Fonts/simhei.ttf" # 黑体（备用）

GOLD = (245, 224, 188, 255)      # 暖金（主标题）
EN_BLUE = (207, 228, 255, 255)   # 淡蓝白（英文副题）
WHITE = (255, 255, 255, 255)
STROKE_DARK = (24, 20, 30, 255)  # 深描边
BOTTOM_BG = (8, 12, 22, 165)     # 副标题半透明深底

def default_copy():
    """从 marketing/text/tap上架文案定稿.md 提取主标题/英文/副标题（文件缺失时返回内置默认）"""
    f = ROOT / "marketing" / "text" / "tap上架文案定稿.md"
    fallback = ("归星物语", "Return to the Star Island",
                "当生活只剩下效率，你是否还记得自己为什么出发？")
    if not f.exists():
        return fallback
    text = f.read_text(encoding="utf-8")
    def grab(pat):
        m = re.search(pat, text, re.S)
        return m.group(1).strip() if m else ""
    title = grab(r"主标题：《([^》]+)》") or "归星物语"
    en = grab(r"英文副题：([^\n]+)") or "Return to the Star Island"
    cn = grab(r"副标题：([^\n]+)") or fallback[2]
    return title, en, cn

def text_w(draw, s, font):
    b = draw.textbbox((0, 0), s, font=font)
    return b[2] - b[0]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=str)
    ap.add_argument("out", type=str, nargs="?", default=None)
    ap.add_argument("--title", type=str, default=None)
    ap.add_argument("--sub-en", type=str, default=None)
    ap.add_argument("--sub-cn", type=str, default=None)
    ap.add_argument("--no-sub-cn", action="store_true", help="不叠底部中文副标题")
    args = ap.parse_args()

    title, en, cn = default_copy()
    title = args.title or title
    en = args.sub_en or en
    cn = args.sub_cn or cn

    img = Image.open(args.src).convert("RGBA")
    W, H = img.size
    draw = ImageDraw.Draw(img)

    # 主标题（宽度约 55% 画布，动态字号）
    font_size = 108
    while font_size > 40:
        f = ImageFont.truetype(FONT_BOLD, font_size)
        if text_w(draw, title, f) <= W * 0.55:
            break
        font_size -= 6
    f_main = ImageFont.truetype(FONT_BOLD, font_size)
    f_en = ImageFont.truetype(FONT_REG, max(30, int(font_size * 0.34)))
    f_cn = ImageFont.truetype(FONT_SIMHEI, max(26, int(font_size * 0.30)))

    # —— 顶部：主标题 + 英文副题 ——
    t_w = text_w(draw, title, f_main)
    t_x = (W - t_w) / 2
    t_y = H * 0.085
    draw.text((t_x, t_y), title, font=f_main, fill=GOLD,
              stroke_width=6, stroke_fill=STROKE_DARK)
    en_w = text_w(draw, en, f_en)
    draw.text(((W - en_w) / 2, t_y + font_size + 14), en, font=f_en,
              fill=EN_BLUE, stroke_width=3, stroke_fill=STROKE_DARK)

    # —— 底部：中文副标题（半透明底条；--no-sub-cn 时不叠） ——
    if not args.no_sub_cn and cn:
        cn_w = text_w(draw, cn, f_cn)
        pad_x, pad_y = 26, 12
        bar_x0 = (W - cn_w) / 2 - pad_x
        bar_y0 = H - H * 0.11 - pad_y
        bar_x1 = bar_x0 + cn_w + pad_x * 2
        bar_y1 = bar_y0 + f_cn.size + pad_y * 2
        draw.rounded_rectangle([bar_x0, bar_y0, bar_x1, bar_y1], radius=10, fill=BOTTOM_BG)
        draw.text(((W - cn_w) / 2, bar_y0 + pad_y), cn, font=f_cn, fill=WHITE)

    out = args.out or str(Path(args.src).with_suffix(".text.png"))
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out, quality=95)
    print(f"✅ 叠字完成: {out}  ({W}x{H})")
    print(f"   主标题[{title}] 英文[{en}] 副标题[{cn if not args.no_sub_cn else '(已去除)'}]")

if __name__ == "__main__":
    main()
