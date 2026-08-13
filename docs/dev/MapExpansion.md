# 归星物语 — 地图扩容与底图施工规范 v1.0

> 性质：**AI 协作开发文档 / 地图施工契约**
> 受众：所有参与本项目的 AI Agent（WorkBuddy / opencode / TRAE / Codex）
> 来源：2026-08-13 town 地图扩容事故复盘（**灰色块事故**：扩图后地图右/下方出现灰色空白）
> 强制纪律：本文档与 `docs/dev/TestSystem.md` / `AGENTS.md` 同级生效。**任何地图尺寸变更 / 底图施工必须遵守本文档**。

---

## 一、事故复盘（为什么会有灰色块）

**症状**：town.json 从 30×20 扩到 50×35 后，地图右半/底部出现灰色空白，新增区域不渲染。

**根因链**：

```
P0-0 扩容脚本只改了：
  map.width / map.height        → 50 × 35  ✅
  layer.data 数组长度            → 1750     ✅
但漏改：
  layer.width / layer.height    → 仍是 30 × 20  ❌
```

Phaser 按 **layer.width(30) × layer.height(20)** 建立 Tilemap 渲染边界，
data 里有 1750 个值但层宽高只认 30×20 → 只渲染左上 480×320，
**右侧 20 列 + 底部 15 行完全在渲染范围外 = 灰色背景**。

**教训**：地图尺寸是**多字段一致性问题**，不是单字段。改一处不改其他 = 半成品。

---

## 二、地图扩容四字段铁律（必须一次性全改）

Tiled JSON 地图的尺寸由 **4 个地方**共同决定，**改尺寸必须 4 者同步**：

| # | 字段 | 位置 | 30×20 → 50×35 示例 |
|---|---|---|---|
| 1 | `map.width` / `map.height` | JSON 顶层 | 50 / 35 |
| 2 | **每个 layer 的 `width` / `height`** | `layers[]` 内（Ground/Walls 各一个） | **50 / 35** |
| 3 | 每个 layer 的 `data` 数组长度 | `layers[].data` | **1750**（= 50×35） |
| 4 | tilesets 引用与图片一致性 | `tilesets[]` | 见 §三 |

**⚠️ 第 2 项最容易漏**——脚本改 data 长度时不会自动改 layer.width/height。

### 校验脚本（扩容后必跑）

```python
import json
d = json.load(open('public/assets/maps/town.json'))
W, H = d['width'], d['height']
for l in d['layers']:
    assert l['width'] == W, f"layer {l['name']} width 不一致: {l['width']} != {W}"
    assert l['height'] == H, f"layer {l['name']} height 不一致: {l['height']} != {H}"
    assert len(l['data']) == W * H, f"layer {l['name']} data 长度不一致"
print('✅ 四字段一致')
```

### 扩容正确流程

```
1. 备份原地图 → archive/maps-pre-*/（复制，不删除）
2. 改 map.width/height（顶层）
3. 每个 layer.width/height 同步
4. 重建 data：新数组 = W*H，旧数据按"逐行平移/扩展"放入
   （默认新区域填 gid1 草地——不是 gid0！）
5. 校验 §二 脚本
6. 重启 dev server（tilemap 不 HMR，必须重启才生效）
7. 截图验证：新增区域无灰色空白
```

---

## 三、tileset 数据源唯一（2026-08-13 Phase 0 修复）

**症状**：town.json tilesets.image 引用 `placeholder_tileset.png`，但 MapScene 硬编码加载 `town_tileset.png` → 数据源不唯一，gid 错位/黑块风险。

**约定**：

| 地图 | tileset 图片（public/assets/tiles/） | MapScene 加载逻辑 |
|---|---|---|
| town | `town_tileset.png`（256×16, 16 tile） | `addTilesetImage('placeholder', 'tiles')` |

**要点**：
- `tilesets[].image` 必须指向该地图**实际使用的** tileset 图片（Tiled 打开一致）
- `tilesets[].name` 是 MapScene `addTilesetImage(name, key)` 的第一参，**改名须同步改 MapScene**
- `tilesets[].tilecount/imagewidth/columns` 必须与图片实际 tile 数一致
- **town_tileset.png 的 16 个 gid 语义**（施工查表）：

| gid | 素材 | 层 | 碰撞 |
|---|---|---|---|
| 1 | 草地 | Ground | 无 |
| 2 | 荒地/泥地 | Ground | 无 |
| 3 | 石墙 | Walls | 有 |
| 4 | 水 | Walls | 有 |
| 5 | 深木 | Ground/Walls | 有(walls) |
| 6 | 木地板/石板 | Ground | 无 |
| 7 | 路 | Ground | 无 |
| 8 | 树丛/作物 | Walls | 有 |
| 9 | 屋顶 | Walls | 有 |
| 10 | 墙面 | Walls | 有 |
| 11 | 门 | Walls | 有 |
| 12 | 窗 | Walls | 有 |
| 13 | 井/石 | Walls | 有 |
| 14 | 栅栏 | Walls | 有 |
| 15 | 装饰 | Walls | 有 |
| 16 | 树 | Walls | 有 |

---

## 四、底图施工规范（Blockout，2026-08-13 制作人拍板）

### 4.1 阶段划分（严格顺序，不可跳步）

```
Phase 0  基础设施：tileset 引用统一 + 四字段校验（不动地图内容）
Phase 1  Blockout：地表大色块（草地/水/荒地/路/石板/农田/边界）
         —— 禁建筑/NPC/树/花/路灯/摊位/装饰
Phase 2  叙事物件：废弃牌子/老屋残骸/路灯/公告栏（"过去发生过什么"的证据）
Phase 3  美术细节：树/花/装饰

验收标准（每个 Phase 独立）：
  Phase 1 完成 = 不看建筑装饰，仅看地表颜色也能看懂小镇空间结构
  Phase 2 完成 = 空间存在玩家能读懂的"过去"证据（不是装饰堆砌）
```

### 4.2 地表类型分区表（town 规划）

| 区域 | 地表类型 | Ground gid |
|---|---|---|
| 老街 A/B、集市广场 | 石板 | 6 |
| 中央广场（现有） | 石板/路 | 6/7 |
| 河岸 | 水 + 草地岸 | Walls 4 + 草地 1 |
| 老屋宅基地 | 石板/土地 | 6 |
| 农田/果林 | 荒地/草地 | 2 / 1 |
| 道路 | 路 | 7 |

### 4.3 Blockout 铁律

1. **Ground 层全图无 gid=0**：每个可视格必须有地表 Tile（默认草地 1，不是 0）
2. **只铺地表，不碰 Walls 装饰**：Phase 1 阶段 Walls 只允许放水（gid4 属于地表类型）
3. **大色块优先**：先明确"这块是石板/草地/荒地"，再填对应 Tile，不要零散点缀
4. **道路骨架先通**：竖路/横路/区域边界路，让玩家走起来知道方向

---

## 五、验收流程（扩容/底图后必跑）

### 5.1 四步验证（Phase 0 沿用）

```
加载   → tiles 纹理 = 正确 tileset（256 宽）
移动   → 玩家可移动
保存   → 存档写入正常
重进   → 地图与状态一致
```

### 5.2 GID 漂移检查（★最重要）

**保存前后 town.json 瓦片数据逐位一致**：

```python
# 保存前快照
before = json.load(open(MAP))['layers'][i]['data']
# ... 游戏内保存 ...
after = json.load(open(MAP))['layers'][i]['data']
assert before == after, "GID 漂移!"
```

> 参考探针：`tests/probes/probe-phase0-tileset-verify.mjs`（T5 项）

### 5.3 灰色空白检查

```python
# Ground 层不允许有 gid=0
assert all(v != 0 for v in g), f"Ground 存在空白 gid0: {count} 格"
```

### 5.4 截图目测

- 全图 4 角 + 中央截图（探针 `probe-ch1-town-visual-verify.mjs` 范式）
- **重点看新增区域**：右下角/底部不能有灰色背景

---

## 六、踩坑清单（即时沉淀）

| # | 坑 | 症状 | 修复 |
|---|---|---|---|
| 1 | layer.width/height 漏改 | 地图右下灰色空白 | 四字段同步（§二） |
| 2 | tilesets.image 引用错误图 | gid 错位/黑块 | 数据源唯一（§三） |
| 3 | tilemap 不 HMR | 改了 map 截图还是旧的 | **必须重启 dev server** |
| 4 | Ground 填 gid0 | 该格显示透明/灰色 | 默认草地 gid1 |
| 5 | 探针 headless:true | 动画/对白不推进 | headless:false（TestSystem 规则3） |
| 6 | 探针 networkidle2 | SPA HMR 挂死 | domcontentloaded（TestSystem 规则2） |

---

## 七、相关文档

- `docs/dev/TestSystem.md` — 测试体系（探针规则/等级）
- `docs/design/青禾镇舞台块定义-v1.0.md` — 8 个叙事空间单元（Blockout 依据）
- `docs/design/青禾镇玩家动线设计图-v1.0.md` — 南北叙事轴
- `tests/probes/probe-phase0-tileset-verify.mjs` — Phase 0 验收探针
- `archive/maps-pre-ch1/town-50x35-pre-layout.json` — town 干净基底备份

---

## 八、文档维护规则

1. **任何地图尺寸变更**必须遵守 §二 四字段铁律
2. **新增地图/新增 tileset** 必须遵守 §三 数据源唯一
3. **踩新坑**即时追加 §六（编号递增），不要只记在会话里
4. **与 Tiled 实际操作一致**：如用 Tiled 编辑，保存后同样跑 §五 校验
