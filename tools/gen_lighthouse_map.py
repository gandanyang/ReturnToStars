"""生成 lighthouse.json — 灯塔礁石岛地图（30×20 户外小地图）

前提：先运行 tools/gen_lighthouse_tileset.py --force（tileset 16 格与 JSON 定义一致）

设计定位（岛屿边界扩展方案 v1.0 P2 → 制作人 2026-08-10 解冻"灯塔轻量版"）：
  - farm 西侧海湾"看得见的灯塔远景" → 可进入的探索区域（"制造未来"方法论）
  - 一张 tilemap + 西侧入口通道 + 塔前广场，无新系统/新任务/新存档字段
  - 老航线/爷爷故事叙事空间（交互点：航海日志 / 望远镜 / 灯塔铭牌）

布局（30×20）：
  - 四周海水（gid 4 碰撞）→ 岩石岸线（gid 3 碰撞）→ 沙地（gid 2）→ 岛心草地（gid 1）
  - 中央灯塔：灯室(gid 11) + 塔身(gid 10) + 塔基(gid 9)，实心碰撞，4 格宽
  - 塔前石板路广场（gid 7），塔南侧平台木地板（gid 6）
  - 交互点（Walls gid 13 旧物标记 + MapScene Graphics 提示）：航海日志/望远镜/铭牌

出口（exits.ts 对应配置）：
  - 西侧入口通道 rows 9-13 cols 0-3 开放 → farm（西侧海湾）
  - farm 西侧海湾触发区（x 36-64, y 10T-10T+48）→ lighthouse，spawn (48, 11T)
  - lighthouse 西侧通道回 farm：trigger x 0-16, y 9T-14T，spawn (5T, 14T)

运行：python tools/gen_lighthouse_map.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_DIR = os.path.join(ROOT, "public", "assets", "maps")

W = 30  # 列
H = 20  # 行

# ---- 瓦片 gid（与 gen_lighthouse_tileset.py 语义一致） ----
G_GRASS, G_SAND, G_ROCK, G_WATER = 1, 2, 3, 4
G_REEF, G_WOOD, G_PATH, G_FLOWER = 5, 6, 7, 8
G_BASE, G_TOWER, G_LAMP, G_FENCE = 9, 10, 11, 12
G_CRATE, G_GRAVEL, G_SEAWEED, G_BUSH = 13, 14, 15, 16


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


def build_lighthouse():
    ground = new_layer(G_GRASS)
    walls = new_layer(0)

    # ===== Ground 层 =====
    # 全岛沙地（海岸带）→ 内部草地
    fill_rect(ground, 2, 2, 27, 17, G_SAND)
    fill_rect(ground, 4, 4, 25, 15, G_GRASS)
    # 塔前石板路广场（塔基南侧，可站立）
    fill_rect(ground, 11, 10, 18, 12, G_PATH)
    # 塔南侧/出口平台木地板（保留原视觉，非出口——出口在西侧）
    fill_rect(ground, 12, 17, 17, 19, G_WOOD)
    # 西侧入口通道（rows 9-13 cols 0-3，与 Walls 断开处对齐）：通道内涂回草地
    fill_rect(ground, 0, 9, 3, 13, G_GRASS)

    # ===== Walls 层 =====
    # 1) 海水外圈（碰撞）——西侧 rows 9-13 断开为入口通道（exits.ts 西侧入口）
    fill_rect(walls, 0, 0, 1, 8, G_WATER)      # 左上水带
    fill_rect(walls, 0, 14, 1, 19, G_WATER)    # 左下水带（rows 9-13 断开）
    fill_rect(walls, 28, 0, 29, 19, G_WATER)
    fill_rect(walls, 2, 0, 27, 1, G_WATER)
    fill_rect(walls, 0, 18, 11, 19, G_WATER)
    fill_rect(walls, 18, 18, 29, 19, G_WATER)
    # 2) 岩石岸线（碰撞）：海与沙地之间的岩带（西侧 rows 9-13 断开，与入口通道对齐）
    fill_rect(walls, 2, 2, 3, 8, G_ROCK)      # 左上竖岩带
    fill_rect(walls, 2, 14, 3, 15, G_ROCK)    # 左下竖岩带（rows 9-13 断开）
    fill_rect(walls, 26, 2, 27, 15, G_ROCK)    # 右竖岩带
    fill_rect(walls, 4, 2, 25, 3, G_ROCK)      # 顶横岩带
    fill_rect(walls, 4, 16, 11, 16, G_ROCK)    # 底横岩带（左半）
    fill_rect(walls, 18, 16, 25, 16, G_ROCK)   # 底横岩带（右半）
    # 3) 海面礁石点缀（碰撞，远处礁石滩）
    for rc, rr in [(0, 3), (1, 8), (29, 5), (28, 12), (24, 0), (5, 0), (29, 16), (0, 15)]:
        set_cell(walls, rc, rr, G_REEF)
    # 4) 中央灯塔（实心碰撞：灯室 + 塔身 + 塔基）
    fill_rect(walls, 13, 2, 16, 3, G_LAMP)     # 灯室（顶部暖黄）
    fill_rect(walls, 13, 4, 16, 7, G_TOWER)    # 塔身
    fill_rect(walls, 13, 8, 16, 9, G_BASE)     # 塔基（宽 4 格，底座）
    # 5) 栅栏点缀（岛四角，碰撞）
    for fc, fr in [(5, 5), (24, 5), (5, 14), (24, 14)]:
        set_cell(walls, fc, fr, G_FENCE)
    # 6) 交互点旧物（碰撞标记；MapScene 在该格旁放提示 + E 交互）
    set_cell(walls, 10, 12, G_CRATE)   # 航海日志（塔左前石板路边缘）
    set_cell(walls, 18, 10, G_CRATE)   # 灯塔铭牌（塔基右侧）
    set_cell(walls, 24, 12, G_CRATE)   # 老望远镜（岛东南草地）
    # 7) 花丛 / 碎石 / 海藻 / 灌木（装饰，不碰撞）
    for fc, fr in [(7, 6), (22, 6), (8, 13)]:
        set_cell(walls, fc, fr, G_FLOWER)
    for gc, gr in [(6, 10), (21, 11)]:
        set_cell(walls, gc, gr, G_GRAVEL)
    for sc, sr in [(3, 5), (25, 13)]:
        set_cell(walls, sc, sr, G_SEAWEED)
    for bc, br in [(6, 12), (23, 10)]:
        set_cell(walls, bc, br, G_BUSH)

    return ground, walls


def write_map(name, ground, walls):
    path = os.path.join(MAP_DIR, f"{name}.json")

    # 与既有 map JSON 相同的模板结构（Tiled 1.9.2 正交）
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
                "image": "../tiles/placeholder_tileset.png",
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
    print(f"[OK] {name}.json 已生成（{W}×{H}，Ground/Walls，tileset 16 格）")


def main():
    ground, walls = build_lighthouse()
    write_map("lighthouse", ground, walls)
    print("done.")


if __name__ == "__main__":
    sys.exit(main())
