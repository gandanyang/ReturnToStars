/**
 * 农田土地状态（Phase 3.1）
 *
 * 全局模块级单例：场景切换离开农场再回来，已锄/已种的地块状态保留。
 * 刷新页面后重置（0.1 版本不做 localStorage 持久化）。
 *
 * 状态流转（Phase 3 全流程）：
 *   empty → tilled → planted → watered → grown → (收获回 empty)
 *   Phase 3.1 仅实现 empty ↔ tilled。
 */

/** 土地格子状态 */
export type TileState = 'empty' | 'tilled' | 'watered' | 'planted' | 'grown';

/** 作物类型 */
export type CropType = 'radish' | 'tomato' | 'corn' | 'strawberry';

/** 作物基础属性 */
export interface CropDef {
  name: string;
  icon: string;
  /** 种子物品 ID */
  seedItem: string;
  /** 成熟所需天数（浇水后） */
  growthDays: number;
  /** 种子商店价格 */
  seedPrice: number;
  /** 作物出售价格 */
  sellPrice: number;
}

/** 作物属性表（P0-2 种植节奏专项，2026-08-14 制作人拍板；2026-08-15 制作人定稿调整：
 *  成熟周期延长（萝卜3/番茄4/玉米5/草莓6 天）+ 单株售价上调作为补偿（45/80/75/150G），
 *  避免种田变机械刷钱，同时让等待更有回报感。数值与 Economy 收购价保持同步。 */
export const CROP_DEFS: Record<CropType, CropDef> = {
  radish: { name: '萝卜', icon: '🥕', seedItem: 'radish_seed', growthDays: 3, seedPrice: 10, sellPrice: 45 },
  tomato: { name: '番茄', icon: '🍅', seedItem: 'tomato_seed', growthDays: 4, seedPrice: 20, sellPrice: 80 },
  corn: { name: '玉米', icon: '🌽', seedItem: 'corn_seed', growthDays: 5, seedPrice: 15, sellPrice: 75 },
  strawberry: { name: '草莓', icon: '🍓', seedItem: 'strawberry_seed', growthDays: 6, seedPrice: 50, sellPrice: 150 },
};

/** 所有作物类型列表（按索引顺序，与 spritesheet 行对应） */
export const CROP_TYPES: CropType[] = ['radish', 'tomato', 'corn', 'strawberry'];

/** 获取作物类型在 spritesheet 中的行索引（0=radish, 1=tomato, 2=corn） */
export function getCropTypeIndex(cropType: CropType): number {
  return CROP_TYPES.indexOf(cropType);
}

/**
 * 农田可耕区域（瓦片坐标，闭区间）
 * 与 tools/gen_map_assets.py 中 gen_farm 的 G_SOIL 填充一致：
 *   fill_farm_rect(ground, 12, 8, 28, 16, G_SOIL)
 */
export const FARM_AREA = {
  col0: 12,
  row0: 8,
  col1: 28,
  row1: 16,
};

/** 瓦片尺寸（像素） */
export const TILE_SIZE = 16;

/** 判断某瓦片坐标是否在农田可耕区域内 */
export function isInFarmArea(col: number, row: number): boolean {
  return (
    col >= FARM_AREA.col0 &&
    col <= FARM_AREA.col1 &&
    row >= FARM_AREA.row0 &&
    row <= FARM_AREA.row1
  );
}

/** 统计当前成熟作物格数（土地回应系统 v1.4：世界状态判定，不做成就计数） */
export function countGrownTiles(): number {
  let n = 0;
  for (let r = FARM_AREA.row0; r <= FARM_AREA.row1; r++) {
    for (let c = FARM_AREA.col0; c <= FARM_AREA.col1; c++) {
      if (getTileState(c, r) === 'grown') n++;
    }
  }
  return n;
}

/** 瓦片坐标 → 存储 key */
function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

/** 
 * 全局土地状态表：key = "col,row" 
 * 使用 globalThis 存储，防止 Vite HMR 模块分裂导致多实例问题
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
if (!g.__FARM_TILES__) {
  g.__FARM_TILES__ = new Map<string, TileState>();
  // eslint-disable-next-line no-console
  console.warn('[FarmState] Created new tiles Map (first load or after cache clear)');
}
const tiles: Map<string, TileState> = g.__FARM_TILES__;

/** 读取某格状态，未记录视为 empty */
export function getTileState(col: number, row: number): TileState {
  const state = tiles.get(tileKey(col, row)) ?? 'empty';
  // eslint-disable-next-line no-console
  console.log('[FarmState] getTileState', { col, row, state, tilesSize: tiles.size });
  return state;
}

/** 设置某格状态 */
export function setTileState(
  col: number,
  row: number,
  state: TileState
): void {
  const key = tileKey(col, row);
  tiles.set(key, state);
  // eslint-disable-next-line no-console
  console.log('[FarmState] setTileState', { col, row, state, tilesSize: tiles.size });
}

// ---------------- 种子库存（已迁移到 Inventory 系统） ----------------

/** @deprecated 请使用 Inventory.addItem/getItemCount */
export function getSeedCount(): number { return 0; }
export function useSeed(): boolean { return false; }
export function addSeeds(_n: number): void { /* no-op */ }
export function setSeedCount(_n: number): void { /* no-op */ }

// ---------------- 作物数据（Phase 3.2 起） ----------------

/**
 * 作物数据
 * plantDay：播种时的游戏天数
 * cropType：作物类型
 * watered：当天是否已浇水（成长条件）
 */
export interface CropData {
  cropType: CropType;
  plantDay: number;
  watered: boolean;
  /** 已浇水成长天数（四阶段视觉用：种子→幼苗→成长→成熟；可选，旧档无此字段按天数推导） */
  grownDays?: number;
}

/** 
 * 作物数据表：key = "col,row"，仅 planted/watered/grown 状态有值
 * 使用 globalThis 存储，防止 Vite HMR 模块分裂
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!g.__FARM_CROPS__) {
  g.__FARM_CROPS__ = new Map<string, CropData>();
}
const crops: Map<string, CropData> = g.__FARM_CROPS__;

/** 读取某格作物数据 */
export function getCrop(col: number, row: number): CropData | undefined {
  return crops.get(tileKey(col, row));
}

/** 设置某格作物数据（传 undefined 清除） */
export function setCrop(
  col: number,
  row: number,
  crop: CropData | undefined
): void {
  if (crop) {
    crops.set(tileKey(col, row), crop);
  } else {
    crops.delete(tileKey(col, row));
  }
}

// ---------------- 存档序列化 ----------------

/** 树木状态 */
export interface TreeState {
  col: number;
  row: number;
  health: number;
  isStump: boolean;
  /** 树桩已消失（木桩只保留几秒后淡出，视觉隐藏；树再生长时清除）——旧档无此字段视为 false */
  stumpGone?: boolean;
}

/** 树木最大生命值（砍 3 次倒下） */
export const TREE_MAX_HEALTH = 3;

/** 树桩刷新间隔（每 3 天树桩恢复为树） */
export const TREE_REFRESH_INTERVAL = 3;

/** 农场树木固定位置（28 棵，沿边缘自然分布，农田区域保持开阔） */
export const FARM_TREE_POSITIONS: { col: number; row: number }[] = [
  // ── 西北角（密集，形成自然边界） ──
  { col: 1, row: 2 }, { col: 2, row: 3 }, { col: 3, row: 2 },
  { col: 1, row: 5 }, { col: 3, row: 6 },
  // ── 北侧边缘（稀疏散落） ──
  // 2026-08-09：col15,row2 原位于森林出口通道（col14-16,rows0-2）正中挡路，挪至右侧空地 col18,row2
  // 2026-08-10：海角灯塔出口打通后，原东北角 4 棵树（37,2/38,3/37,5/39,5）落入海角海域
  //            （x 580-640 海面区），"树长在海里"——挪至北缘空地 4,2/6,2/9,4/10,6；
  //            32,3 保留为海角入口北侧自然屏障（不挡中央通道）
  { col: 8, row: 2 }, { col: 18, row: 2 }, { col: 25, row: 2 },
  { col: 32, row: 3 },
  // ── 东北角（海角灯塔区：仅保留 32,3 入口屏障，海域内无树） ──
  // ── 西侧边缘（沿墙） ──
  { col: 1, row: 8 }, { col: 2, row: 12 }, { col: 1, row: 16 },
  { col: 2, row: 20 },
  // ── 东侧边缘（通往小镇方向） ──
  // 2026-08-10：col38,row10 原卡在小镇出口区（col 37-39, rows 9-11）中央挡路，
  //   挪至南侧空地 24,21（避开农田/商店 31,13/海角区/水塘/出生点）
  { col: 39, row: 15 }, { col: 38, row: 19 },
  // ── 南侧（室内入口两侧） ──
  // 2026-08-15 房子通路修复：原 (3,20)/(8,21) 落在老屋地板内，把玩家堵在房外——移除
  { col: 13, row: 20 },
  { col: 30, row: 21 }, { col: 35, row: 20 }, { col: 39, row: 21 },
  // ── 2026-08-10 东侧挪树落点（原 38,10 卡小镇出口区，移至南侧空地，避开农田/商店/海角/水塘） ──
  { col: 24, row: 21 },
  // ── 北缘补位（2026-08-10 海角挪树落点，远离森林出口/花丛/Plot 区） ──
  { col: 4, row: 2 }, { col: 6, row: 2 }, { col: 9, row: 4 }, { col: 10, row: 6 },
];

/** 
 * 树木状态表：key = "col,row"
 * 使用 globalThis 存储，防止 Vite HMR 模块分裂
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!g.__FARM_TREES__) {
  g.__FARM_TREES__ = new Map<string, TreeState>();
}
const trees: Map<string, TreeState> = g.__FARM_TREES__;

/** 初始化所有树木为满血状态 */
export function initTrees(): void {
  trees.clear();
  for (const pos of FARM_TREE_POSITIONS) {
    trees.set(`${pos.col},${pos.row}`, {
      col: pos.col,
      row: pos.row,
      health: TREE_MAX_HEALTH,
      isStump: false,
    });
  }
}

/** 获取某棵树的状态 */
export function getTree(col: number, row: number): TreeState | undefined {
  return trees.get(`${col},${row}`);
}

/** 砍树：减少生命值，返回是否砍倒 */
export function chopTree(col: number, row: number): boolean {
  const tree = trees.get(`${col},${row}`);
  if (!tree || tree.isStump) return false;
  tree.health--;
  if (tree.health <= 0) {
    tree.isStump = true;
    return true; // 树倒了
  }
  return false; // 还没倒
}

/** 刷新所有树桩为满血树（每 TREE_REFRESH_INTERVAL 天调用一次） */
export function refreshStumps(): void {
  for (const tree of trees.values()) {
    if (tree.isStump) {
      tree.isStump = false;
      tree.health = TREE_MAX_HEALTH;
      tree.stumpGone = false;
    }
  }
}

/** 获取所有树木条目（存档序列化用） */
export function getAllTreeEntries(): [string, TreeState][] {
  return Array.from(trees.entries());
}

/** 树位置迁移表（旧档 key "col,row" → 新坐标）：挪位时保持砍伐状态不丢失 */
const TREE_KEY_MIGRATIONS: Record<string, [number, number]> = {
  // 2026-08-09：col15,row2 原在森林出口通道挡路，挪至 col18,row2
  '15,2': [18, 2],
  // 2026-08-10：col38,row10 原卡小镇出口区（col 37-39, rows 9-11）挡路，挪至南侧 24,21
  '38,10': [24, 21],
};

/** 恢复树木状态（存档恢复用；旧档 key 命中迁移表时迁到新坐标） */
export function restoreTreeEntries(entries: [string, TreeState][]): void {
  for (const [key, rawState] of entries) {
    const moved = TREE_KEY_MIGRATIONS[key];
    if (moved) {
      const [col, row] = moved;
      trees.set(`${col},${row}`, { ...rawState, col, row });
    } else {
      trees.set(key, rawState);
    }
  }
}

/** 获取所有土地状态条目（存档序列化用） */
export function getAllTileEntries(): [string, TileState][] {
  return Array.from(tiles.entries());
}

/** 获取所有作物条目（存档序列化用） */
export function getAllCropEntries(): [string, CropData][] {
  return Array.from(crops.entries());
}

/** 清空所有土地和作物状态（存档恢复前调用） */
export function clearAllTiles(): void {
  // eslint-disable-next-line no-console
  console.warn('[FarmState] clearAllTiles called! Stack:', new Error().stack);
  tiles.clear();
  crops.clear();
}

/** 恢复土地状态（存档恢复用） */
export function restoreTileEntries(entries: [string, TileState][]): void {
  for (const [key, state] of entries) {
    tiles.set(key, state);
  }
}

/** 恢复作物状态（存档恢复用） */
export function restoreCropEntries(entries: [string, CropData][]): void {
  for (const [key, crop] of entries) {
    crops.set(key, crop);
  }
}

// ---------------- 成长结算 ----------------

/**
 * 每日成长结算接口（由 TimeSystem.nextDay 调用）
 *
 * 成长规则：
 *   每种作物需 plantDay + growthDays <= newDay 且 watered=true 才成熟
 *
 * @param newDay 推进后的新天数
 */
export function advanceDay(newDay: number): void {
  for (const [key, crop] of crops) {
    const def = CROP_DEFS[crop.cropType];
    const [col, row] = key.split(',').map(Number);
    if (crop.watered && crop.plantDay + def.growthDays <= newDay) {
      if (getTileState(col, row) !== 'grown') {
        setTileState(col, row, 'grown');
      }
    } else if (crop.watered) {
      // 多日作物：已浇水但未成熟，重置为 planted 以便次日再浇水；
      // 记录浇水成长天数（四阶段视觉：种子→幼苗→成长→成熟）
      setTileState(col, row, 'planted');
      const prev = crop.grownDays ?? Math.max(0, newDay - crop.plantDay - 1);
      setCrop(col, row, { ...crop, watered: false, grownDays: prev + 1 });
    }
  }
}
