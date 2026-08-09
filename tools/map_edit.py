"""归星物语 - 地图直接编辑工具（制作人自学用）

用法（PowerShell）：
  python tools/map_edit.py view farm Walls
      查看 farm 地图 Walls 层的 ASCII 网格图（0=空，字母=瓦片种类）
  python tools/map_edit.py view farm Ground
      查看 Ground 层
  python tools/map_edit.py get farm Walls 12 5
      查看 Walls 层 (col=12, row=5) 格子的 gid
  python tools/map_edit.py set farm Walls 12 5 8
      把 Walls 层 (12,5) 格设为 gid 8（花），自动备份原文件

坐标约定：col 从左到右 0 起，row 从上到下 0 起。
编辑前自动备份到 public/assets/maps/*.bak（改坏了可恢复）。
"""
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_DIR = os.path.join(ROOT, "public", "assets", "maps")

# 通用 gid 语义（farm/forest/gate/house/elder_house/lighthouse 基础）
GID_MEANING = {
    0: "空",
    1: "草地", 2: "石头/落叶", 3: "石墙(挡)", 4: "水(挡)",
    5: "土壤", 6: "木地板", 7: "小路", 8: "花",
    9: "树顶(挡)", 10: "树干(挡)", 11: "松树顶(挡)", 12: "松树干(挡)",
    13: "树桩(挡)", 14: "木头", 15: "(本图无)", 16: "(本图无)",
}
# 各图扩展语义（v0.6 起 town/mine 扩到 16 格，lighthouse 另有一套）
EXT_MEANING = {
    "town": {9: "屋顶(挡)", 10: "墙面(挡)", 11: "门(挡)", 12: "窗(挡)",
             13: "井(挡)", 14: "栅栏(挡)", 15: "招牌", 16: "灌木"},
    "mine": {9: "岩壁(挡)", 10: "矿柱(挡)", 11: "轨道", 12: "矿石堆(挡)",
             13: "木箱(挡)", 14: "木板", 15: "碎石", 16: "矿车"},
    "lighthouse": {3: "岩石(挡)", 4: "海水(挡)", 5: "礁石(挡)", 6: "沙地",
                   9: "塔基(挡)", 10: "塔身(挡)", 11: "灯室(挡)", 12: "栅栏(挡)",
                   13: "旧物(挡)", 14: "碎石", 15: "湿沙海藻", 16: "灌木"},
}

# 每格 ASCII 显示符号（单字符，便于看网格）
GID_CHARS = {0: ".", 1: "g", 2: "s", 3: "#", 4: "~", 5: "S", 6: "w",
             7: "p", 8: "f", 9: "T", 10: "t", 11: "P", 12: "p",
             13: "u", 14: "L", 15: "+", 16: "b"}


def load_map(map_key):
    path = os.path.join(MAP_DIR, map_key + ".json")
    if not os.path.exists(path):
        print(f"找不到地图: {path}")
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        return json.load(f), path


def get_layer(data, layer_name):
    for l in data["layers"]:
        if l["name"] == layer_name and l.get("type") == "tilelayer":
            return l
    print(f"找不到图层 {layer_name}（可用: {[x['name'] for x in data['layers']]}）")
    sys.exit(1)


def meaning(map_key, gid):
    if map_key in EXT_MEANING and gid in EXT_MEANING[map_key]:
        return EXT_MEANING[map_key][gid]
    return GID_MEANING.get(gid, f"未知({gid})")


def cmd_view(map_key, layer_name):
    d, _ = load_map(map_key)
    layer = get_layer(d, layer_name)
    w, h = d["width"], d["height"]
    print(f"== {map_key} [{layer_name}] {w}x{h} ==")
    print("    " + "".join(f"{c % 10}" for c in range(w)) + "   ← col")
    for r in range(h):
        row = "".join(GID_CHARS.get(v, "?") for v in layer["data"][r * w:(r + 1) * w])
        print(f"{r:3d} {row}")
    # 图例：出现的 gid
    used = sorted({v for v in layer["data"] if v})
    legend = "  图例: " + "  ".join(f"{GID_CHARS[v]}={v}({meaning(map_key, v)})" for v in used)
    print(legend)


def cmd_get(map_key, layer_name, col, row):
    d, _ = load_map(map_key)
    layer = get_layer(d, layer_name)
    w = d["width"]
    idx = row * w + col
    v = layer["data"][idx]
    print(f"{map_key}[{layer_name}] ({col},{row}) = gid {v} → {meaning(map_key, v)}")


def cmd_set(map_key, layer_name, col, row, gid, yes=False):
    d, path = load_map(map_key)
    layer = get_layer(d, layer_name)
    w, h = d["width"], d["height"]
    if not (0 <= col < w and 0 <= row < h):
        print(f"格子越界: ({col},{row})，地图是 {w}x{h}")
        sys.exit(1)
    old = layer["data"][row * w + col]
    if gid < 0 or gid > 16:
        print(f"gid {gid} 超出 0-16，可能不是有效瓦片，已拒绝")
        sys.exit(1)
    print(f"将 {map_key}[{layer_name}] ({col},{row}) 从 gid {old}({meaning(map_key, old)}) "
          f"改为 gid {gid}({meaning(map_key, gid)})")
    if not yes:
        ok = input("确认修改？(y/n): ").strip().lower()
        if ok != "y":
            print("已取消")
            return
    # 备份
    bak = path + ".bak"
    if not os.path.exists(bak):
        shutil.copy2(path, bak)
        print(f"已备份原文件: {bak}")
    layer["data"][row * w + col] = gid
    with open(path, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False)
    print("已保存 ✅")


def usage():
    print(__doc__)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a]
    if len(args) >= 2 and args[0] in ("view", "get", "set"):
        cmd, map_key, layer_name = args[0], args[1], (args[2] if len(args) > 2 else "Walls")
        if cmd == "view":
            cmd_view(map_key, layer_name)
        elif cmd == "get":
            cmd_get(map_key, layer_name, int(args[3]), int(args[4]))
        elif cmd == "set":
            yes = "--yes" in args
            cmd_set(map_key, layer_name, int(args[3]), int(args[4]), int(args[5]), yes)
    else:
        usage()
