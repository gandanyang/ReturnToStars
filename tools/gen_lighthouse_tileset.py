"""生成 lighthouse_tileset.png — 灯塔礁石岛 16 瓦片（占位平涂风格，调色板对齐 star_island_palette.json）

瓦片语义（gid 1-8 与 farm 基础系一致，9-16 灯塔专属）：
    gid 1  = 草地      绿色底 + 深绿斑点（palette grass #609848）
    gid 2  = 沙地      浅沙底 + 深沙斑点（海岸带）
    gid 3  = 岩石      灰色底 + 深灰斑点（碰撞，礁石岸线）
    gid 4  = 海水      蓝色底 + 浅蓝斑点（碰撞）
    gid 5  = 礁石      深灰蓝底 + 更暗斑点（碰撞，与 farm 灯塔远景剪影 0x3a4a5a 呼应）
    gid 6  = 木地板    浅棕底 + 斑点（出口平台）
    gid 7  = 石板路    浅米黄底 + 浅斑点（塔基铺装）
    gid 8  = 花丛      绿色底 + 粉红花朵斑点
    gid 9  = 塔基砖    深棕底 + 深斑点（碰撞，灯塔塔基）
    gid 10 = 塔身砖    深灰蓝底 + 更暗斑点（碰撞，灯塔塔身，0x3a4a5a）
    gid 11 = 灯室      暖黄底 + 亮黄斑点（碰撞，顶部灯室）
    gid 12 = 栅栏      棕褐底 + 深棕斑点（碰撞）
    gid 13 = 旧物      木箱棕底 + 深棕斑点（碰撞，可交互旧物）
    gid 14 = 碎石      灰褐底 + 深灰斑点（装饰，不碰撞）
    gid 15 = 湿沙/海藻 深绿灰底 + 深斑点（装饰，不碰撞）
    gid 16 = 灌木      深绿底 + 深绿斑点（装饰，不碰撞）

说明（R1 风险消除，同 gate 模板）：
    本脚本提供确定性重建能力，避免"占位资源丢失后不可重建"。
    python tools/gen_lighthouse_tileset.py          → 输出到 tmp/lighthouse_tileset.png（不覆盖现有）
    python tools/gen_lighthouse_tileset.py --force  → 覆盖 public/assets/tiles/lighthouse_tileset.png

输出尺寸：256×16（16 格 × 16 像素/格）
"""
import argparse
import os
import random
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILE_DIR = os.path.join(ROOT, "public", "assets", "tiles")
TMP_DIR = os.path.join(ROOT, "tmp")
TILE = 16
N = 16  # 瓦片数

# 平涂风格调色板（锚点对齐 tools/star_island_palette.json，v1.3）
TILES = [
    # (base, speck, pattern) — pattern=None 表示纯随机斑点平涂
    ((96, 152, 72),   (76, 124, 58),   None),          # gid 1 草地   #609848
    ((196, 168, 120), (176, 148, 96),  None),          # gid 2 沙地
    ((84, 84, 92),    (60, 60, 68),    None),          # gid 3 岩石   #54545c
    ((52, 92, 140),   (68, 108, 156),  None),          # gid 4 海水   #345c8c
    ((58, 74, 90),    (42, 54, 66),    None),          # gid 5 礁石   ≈0x3a4a5a（灯塔远景剪影色）
    ((190, 144, 84),  (150, 108, 58),  None),          # gid 6 木地板 #be9054
    ((210, 176, 124), (188, 156, 104), None),          # gid 7 石板路 #d2b07c
    ((110, 148, 80),  (255, 102, 153), "flower"),      # gid 8 花丛   #6e9450
    ((74, 58, 46),    (52, 40, 30),    None),          # gid 9 塔基砖
    ((58, 74, 90),    (42, 54, 66),    None),          # gid 10 塔身砖 0x3a4a5a
    ((255, 221, 160), (255, 236, 190), None),          # gid 11 灯室  0xffdda0
    ((132, 90, 54),   (104, 68, 40),   None),          # gid 12 栅栏  #845a36
    ((138, 106, 66),  (108, 82, 50),   None),          # gid 13 旧物  #8a6a42
    ((122, 114, 104), (96, 90, 82),    None),          # gid 14 碎石  #7a7268
    ((106, 138, 90),  (80, 106, 68),   None),          # gid 15 湿沙/海藻
    ((58, 108, 52),   (42, 82, 38),    None),          # gid 16 灌木  #3a6c34
]


def draw_tile(img: Image.Image, idx: int, base, speck, pattern):
    rng = random.Random(idx * 137)
    x0 = idx * TILE
    # 打底色
    for y in range(TILE):
        for x in range(TILE):
            img.putpixel((x0 + x, y), base)
    # 随机斑点
    for _ in range(10):
        img.putpixel((x0 + rng.randint(0, TILE - 1), rng.randint(0, TILE - 1)), speck)
    # 模式叠加
    if pattern == "flower":
        for fx, fy in [(4, 4), (11, 5), (6, 11), (12, 12)]:
            for dx, dy in [(0, 0), (1, 0), (0, 1)]:
                px, py = x0 + fx + dx, fy + dy
                if 0 <= px < img.width and 0 <= py < TILE:
                    img.putpixel((px, py), speck)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="覆盖 public/assets/tiles/ 下原始文件")
    args = ap.parse_args()

    if args.force:
        out_dir = TILE_DIR
    else:
        out_dir = TMP_DIR
        os.makedirs(out_dir, exist_ok=True)

    out_path = os.path.join(out_dir, "lighthouse_tileset.png")
    img = Image.new("RGB", (N * TILE, TILE), (0, 0, 0))
    for i, (b, s, p) in enumerate(TILES):
        draw_tile(img, i, b, s, p)
    img.save(out_path)

    print(f"[OK] lighthouse_tileset.png -> {out_path}")
    print(f"     尺寸: {img.size} ({img.width // TILE} 格 × {TILE}px/格)")
    print(f"     语义: 1=草地 2=沙地 3=岩石(coll) 4=海水(coll) 5=礁石(coll) 6=木地板 7=石板路 8=花丛")
    print(f"           9=塔基(coll) 10=塔身(coll) 11=灯室(coll) 12=栅栏(coll) 13=旧物(coll) 14=碎石 15=湿沙 16=灌木")


if __name__ == "__main__":
    main()
