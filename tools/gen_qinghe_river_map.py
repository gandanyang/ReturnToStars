"""生成 qinghe_river.json — 青禾河畔地图（40×30 户外小地图）

制作人拍板（2026-08-15）：第一章以「青禾河畔」替代灯塔开放，作为可玩新地图直接施工。
设计稿：docs/design/青禾河畔与废弃果园-区域设计方案-v0.1.md

tileset：复用 town_tileset.png（16 gid 语义，与 town.json 一致）——MapScene preload
将 qinghe_river 的 tileset 映射到 town_tileset.png（不复制资产）。

布局（40×30，入口在北侧连接 town 南侧）：
  - rows 0-1  北侧入口缓冲（草地 + 路；出口区 cols 24-25 留空）
  - rows 2-8  北岸草地 + 小树林（树 gid16 点缀）+ 北岸小径（东西向）
  - rows 9-13 河流（水 gid4 横贯；西桥 cols 7-9 可走 / 东断桥 cols 31-33 视觉预埋果园）
  - rows 14-20 南岸草地 + 南岸小径（桥头→码头→凉亭→断桥）
  - rows 21-24 码头（西侧石板 + 木桩）/ 凉亭（中部石板 + 柱子）
  - rows 25-29 南侧草地 + 长椅 + 采集点

出口（exits.ts 对应配置）：
  - town 南侧 rows 33-34 cols 24-25 → qinghe_river，spawn (24T, 3T)
  - qinghe_river 北侧 rows 0-1 cols 24-25 → town，spawn (24T, 31T)

运行：python tools/gen_qinghe_river_map.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_DIR = os.path.join(ROOT, "public", "assets", "maps")

W = 40
H = 30

# ---- 瓦片 gid（town_tileset 语义，与 town.json 一致） ----
G_GRASS, G_WASTE, G_ROCK, G_WATER = 1, 2, 3, 4
G_WOOD, G_STONE, G_PATH, G_BUSH = 5, 6, 7, 8
G_ROOF, G_WALL, G_DOOR, G_WIN, G_WELL, G_FENCE, G_DECO, G_TREE = 9, 10, 11, 12, 13, 14, 15, 16


def new_layer(fill=0):
    return [[fill] * W for _ in range(H)]


def set_cell(layer, c, r, gid):
    if 0 <= c < W and 0 <= r < H:
        layer[r][c] = gid


def fill_rect(layer, c0, r0, c1, r1, gid):
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            set_cell(layer, c, r, gid)


def flatten(layer):
    out = []
    for row in layer:
        out.extend(row)
    return out


def build_qinghe_river():
    ground = new_layer(G_GRASS)
    walls = new_layer(0)

    # ===== Ground 层 =====
    # 北侧入口缓冲：路（rows 2-3 cols 22-27，从入口下探）
    fill_rect(ground, 22, 2, 27, 3, G_PATH)
    # 北岸小径（东西向：入口 → 西桥桥头；rows 5-6）
    fill_rect(ground, 5, 5, 27, 6, G_PATH)
    # 西桥桥头（北岸 cols 7-9 rows 7-8；衔接小径与桥面）
    fill_rect(ground, 7, 7, 9, 8, G_STONE)
    # 河流床：rows 9-13 全水；西桥/东断桥铺石板
    fill_rect(ground, 0, 9, 39, 13, G_WATER)
    fill_rect(ground, 7, 9, 9, 13, G_STONE)    # 西桥（可走）
    fill_rect(ground, 31, 9, 33, 13, G_STONE)  # 东断桥（视觉）
    # 西桥桥头（南岸 cols 7-9 rows 14-15；衔接桥面与南岸小径）
    fill_rect(ground, 7, 14, 9, 15, G_STONE)
    # 南岸小径（桥头 → 码头 → 凉亭 → 断桥；rows 16-17 东西向）
    fill_rect(ground, 5, 16, 33, 17, G_PATH)
    # 码头平台（西侧）与凉亭平台（中部）
    fill_rect(ground, 2, 20, 8, 23, G_STONE)    # 码头平台（西侧）
    fill_rect(ground, 17, 22, 20, 23, G_STONE)  # 凉亭平台（中部）
    # 南侧小路（凉亭 → 南侧草地缓冲）
    fill_rect(ground, 18, 25, 24, 25, G_PATH)
    # 南侧荒地点缀（岸边泥地）
    fill_rect(ground, 11, 21, 13, 21, G_WASTE)
    fill_rect(ground, 28, 24, 30, 24, G_WASTE)
    fill_rect(ground, 34, 27, 36, 27, G_WASTE)

    # ===== Walls 层 =====
    # 1) 河流（碰撞水）
    fill_rect(walls, 0, 9, 39, 13, G_WATER)
    # 西桥可走：桥面不碰撞（清 0）
    fill_rect(walls, 7, 9, 9, 13, 0)
    # 东断桥：中间断口（row 11 col 32）放装饰挡路 → 过不去（未来果园预埋）
    fill_rect(walls, 31, 9, 33, 13, 0)
    set_cell(walls, 32, 11, G_DECO)
    # 断桥南岸桥头：护栏（碰撞，玩家走到这里停步看到断桥）
    set_cell(walls, 31, 14, G_FENCE)
    set_cell(walls, 33, 14, G_FENCE)
    set_cell(walls, 32, 15, G_WELL)   # 桥头旧石（"桥断了"提示锚点）
    # 2) 北岸小树林（树 gid16 碰撞，成片点缀）
    for tc, tr in [(3, 2), (6, 2), (10, 3), (14, 2), (18, 3), (22, 2), (27, 3), (31, 2), (35, 3), (38, 2),
                   (2, 6), (8, 7), (12, 6), (17, 7), (21, 6), (25, 7), (30, 6), (34, 7), (37, 6)]:
        set_cell(walls, tc, tr, G_TREE)
    # 3) 南岸树木/灌木点缀（碰撞树 + 装饰灌木）
    for tc, tr in [(11, 16), (16, 15), (21, 16), (26, 15), (31, 16), (36, 15),
                   (5, 18), (13, 18), (24, 18), (29, 18), (34, 18)]:
        set_cell(walls, tc, tr, G_BUSH)
    for tc, tr in [(3, 26), (7, 28), (12, 27), (15, 25), (20, 28), (26, 25), (29, 28), (33, 25), (37, 27)]:
        set_cell(walls, tc, tr, G_TREE)
    # 4) 码头木桩（深木，碰撞）+ 码头岸线石
    set_cell(walls, 2, 20, G_WOOD)
    set_cell(walls, 8, 20, G_WOOD)
    set_cell(walls, 5, 23, G_WOOD)
    set_cell(walls, 4, 24, G_ROCK)
    set_cell(walls, 6, 24, G_ROCK)
    # 5) 凉亭柱子（碰撞）+ 亭顶装饰
    set_cell(walls, 17, 22, G_WOOD)
    set_cell(walls, 20, 22, G_WOOD)
    set_cell(walls, 17, 23, G_WOOD)
    set_cell(walls, 20, 23, G_WOOD)
    set_cell(walls, 18, 21, G_ROOF)
    set_cell(walls, 19, 21, G_ROOF)
    # 6) 北侧入口路牌（井/石类碰撞标记）
    set_cell(walls, 23, 2, G_WELL)
    # 7) 南侧长椅（装饰不碰撞）与码头提示（栅栏）
    set_cell(walls, 18, 26, G_FENCE)
    set_cell(walls, 20, 26, G_FENCE)
    set_cell(walls, 2, 22, G_FENCE)
    set_cell(walls, 8, 22, G_FENCE)
    # 8) 地图边缘视觉石（四角，碰撞）
    for cc, cr in [(0, 0), (39, 0), (0, 29), (39, 29), (1, 29), (38, 29), (0, 1), (39, 1)]:
        set_cell(walls, cc, cr, G_ROCK)
    # 9) 河边小野花点缀（装饰不碰撞）
    for fc, fr in [(10, 21), (14, 22), (22, 21), (27, 22), (33, 21)]:
        set_cell(walls, fc, fr, G_DECO)

    return ground, walls


def write_map(name, ground, walls):
    path = os.path.join(MAP_DIR, f"{name}.json")
    m = {
        "compressionlevel": -1,
        "height": H,
        "width": W,
        "tileheight": 16,
        "tilewidth": 16,
        "orientation": "orthogonal",
        "renderorder": "right-down",
        "tiledversion": "1.9.2",
        "type": "map",
        "version": "1.9",
        "layers": [
            {
                "id": 1,
                "name": "Ground",
                "type": "tilelayer",
                "width": W,
                "height": H,
                "x": 0,
                "y": 0,
                "opacity": 1,
                "visible": True,
                "data": flatten(ground),
            },
            {
                "id": 2,
                "name": "Walls",
                "type": "tilelayer",
                "width": W,
                "height": H,
                "x": 0,
                "y": 0,
                "opacity": 1,
                "visible": True,
                "data": flatten(walls),
            },
        ],
        "tilesets": [
            {
                "firstgid": 1,
                "image": "../tiles/town_tileset.png",
                "imageheight": 16,
                "imagewidth": 256,
                "margin": 0,
                "name": "placeholder",
                "spacing": 0,
                "tilecount": 16,
                "tileheight": 16,
                "tilewidth": 16,
                "columns": 16,
            }
        ],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False)
    print(f"[OK] {name}.json generated ({W}x{H})")


if __name__ == "__main__":
    g, w = build_qinghe_river()
    write_map("qinghe_river", g, w)
