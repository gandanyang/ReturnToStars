/**
 * 经济系统（Phase 0.2）
 *
 * 金币 + 商品价格。0.2 版本形成「种萝卜 → 收获 → 卖钱 → 买种子」正循环：
 *   买 1 颗种子 10G → 收 1 个萝卜卖 15G → 净赚 5G
 *
 * 全局模块级单例：金币跨场景保留，刷新页面后重置（同 FarmState 约定）。
 */

import { addItem, getItemCount, getItemDef, isItemLocked, ItemType } from './Inventory';

/** 初始金币 */
const INITIAL_COINS = 100;

/** 当前金币 */
let coins = INITIAL_COINS;

/** 读取当前金币 */
export function getCoins(): number {
  return coins;
}

/** 增加金币（卖萝卜等收入） */
export function addCoins(n: number): void {
  coins += n;
}

/**
 * 消费金币
 * @returns true 成功；false 余额不足（不扣款）
 */
export function spendCoins(n: number): boolean {
  if (coins < n) return false;
  coins -= n;
  return true;
}

/** 直接设置金币数（存档恢复用） */
export function setCoins(n: number): void {
  coins = Math.max(0, Math.floor(n));
}

// ---- 商品价格（集中配置，方便调整） ----
// P0-2 种植节奏专项（2026-08-14 制作人拍板；2026-08-15 定稿调整）：
// 成熟周期延长（萝卜3/番茄4/玉米5/草莓6 天）→ 单株收购价同步上调（45/80/75/150G）作为补偿。
// 数值与 CROP_DEFS.sellPrice 对齐（唯一数据源原则，改一处即可——两处同步改）。
/** 萝卜种子售价 */
export const SEED_PRICE = 10;
/** 萝卜收购价 */
export const RADISH_PRICE = 45;
/** 番茄种子售价 */
export const TOMATO_SEED_PRICE = 20;
/** 番茄收购价 */
export const TOMATO_PRICE = 80;
/** 玉米种子售价 */
export const CORN_SEED_PRICE = 15;
/** 玉米收购价 */
export const CORN_PRICE = 75;
/** 草莓种子售价 */
export const STRAWBERRY_SEED_PRICE = 50;
/** 草莓收购价 */
export const STRAWBERRY_PRICE = 150;
/** 石头收购价 */
export const STONE_PRICE = 5;
/** 铜矿收购价 */
export const COPPER_PRICE = 15;
/** 铁矿收购价 */
export const IRON_PRICE = 30;
/** 木材收购价 */
export const WOOD_PRICE = 8;
/** 木材买入价（商店整捆木材 8G/根，平价无套利；资源快速置换复用此价） */
export const WOOD_BUY_PRICE = 8;
/** 石头买入价（商店整齐石料 12G/2块 = 6G/块，> 收购价 5G 无套利；资源快速置换复用此价） */
export const STONE_BUY_PRICE = 6;

/** 鱼类收购价（钓鱼 Phase 3，2026-08-14 制作人拍板：30/20/45G，顺手卖有点收益但不改变经济系统） */
export const QINGHE_CRUCIAN_PRICE = 30;
export const RIVER_SHRIMP_PRICE = 20;
export const DUSK_FISH_PRICE = 45;
/** 月光鲈收购价（钓鱼扩展 2026-08-14：稀有高级鱼，90G，比普通鱼高一档但不影响经济系统） */
export const MOON_BASS_PRICE = 90;
/** 普通特殊鱼收购价（钓鱼生态化 v1.3，2026-08-15 制作人拍板：河鳗/鲤鱼/大青鱼，生态可重复） */
export const RIVER_EEL_PRICE = 60;
export const COMMON_CARP_PRICE = 35;
export const BIG_BLUE_FISH_PRICE = 90;

/** 自然采集物收购价（生活采集 Phase 1，2026-08-14 制作人设计稿 v0.1）。
 *  定价原则（设计稿 §十二）：采集物价值低，主要意义是"顺手发现"而非赚钱；
 *  5-10G 之间，不与作物/鱼价冲突，不改变经济系统。 */
export const DANDELION_PRICE = 5;
export const WILD_BERRY_PRICE = 8;
export const WILD_MUSHROOM_PRICE = 10;
export const SMALL_FLOWER_PRICE = 5;
export const TWIG_PRICE = 3;

/**
 * 可出售物品 → 收购价（一键出售用）。
 * 价格全部复用上方 Economy 常量，与 ShopPanel 现有出售同一价格源，不新增第四价格源。
 * 不可售（不在表中）：种子/工具（旧锄头/旧水壶/旧斧头）/庄园钥匙/星之碎片/钻石/自动农业机器人。
 */
export const SELLABLE_ITEMS: Partial<Record<ItemType, number>> = {
  radish: RADISH_PRICE,
  tomato: TOMATO_PRICE,
  corn: CORN_PRICE,
  strawberry: STRAWBERRY_PRICE,
  stone: STONE_PRICE,
  copper: COPPER_PRICE,
  iron: IRON_PRICE,
  wood: WOOD_PRICE,
  qinghe_crucian: QINGHE_CRUCIAN_PRICE,
  river_shrimp: RIVER_SHRIMP_PRICE,
  dusk_fish: DUSK_FISH_PRICE,
  moon_bass: MOON_BASS_PRICE,
  river_eel: RIVER_EEL_PRICE,
  common_carp: COMMON_CARP_PRICE,
  big_blue_fish: BIG_BLUE_FISH_PRICE,
  // 生活采集 Phase 1（2026-08-14 设计稿 v0.1）
  dandelion: DANDELION_PRICE,
  wild_berry: WILD_BERRY_PRICE,
  wild_mushroom: WILD_MUSHROOM_PRICE,
  small_flower: SMALL_FLOWER_PRICE,
  twig: TWIG_PRICE,
};

/** 一键出售结果 */
export interface SellAllResult {
  /** 卖出金币总额 */
  totalCoins: number;
  /** 已卖物品明细 */
  sold: { item: ItemType; name: string; count: number; earned: number }[];
  /** 跳过物品明细（FEATURE-039：reserve=保留资源 / locked=玩家锁定） */
  skipped: { item: ItemType; name: string; count: number; reason: 'reserve' | 'locked' }[];
}

/** 是否存在可出售物品（空背包/无可售时按钮禁用或提示） */
export function hasSellableItems(): boolean {
  for (const id of Object.keys(SELLABLE_ITEMS) as ItemType[]) {
    if (getItemCount(id) > 0) return true;
  }
  return false;
}

/**
 * 智能一键出售（FEATURE-039）：
 * - forbidden：不在 SELLABLE_ITEMS 中，天然跳过
 * - locked：玩家锁定的物品，跳过
 * - reserve：保留类资源（木材/石头/铁矿），跳过不自动卖
 * - normal：正常出售
 * 返回出售明细 + 跳过明细，供预览面板/ toast 使用。
 */
export function previewSellAll(): SellAllResult {
  const sold: SellAllResult['sold'] = [];
  const skipped: SellAllResult['skipped'] = [];
  let totalCoins = 0;
  for (const id of Object.keys(SELLABLE_ITEMS) as ItemType[]) {
    const count = getItemCount(id);
    if (count <= 0) continue;
    const def = getItemDef(id);
    if (isItemLocked(id)) {
      skipped.push({ item: id, name: def.name, count, reason: 'locked' });
      continue;
    }
    if (def.sellPriority === 'reserve') {
      skipped.push({ item: id, name: def.name, count, reason: 'reserve' });
      continue;
    }
    const price = SELLABLE_ITEMS[id]!;
    totalCoins += price * count;
    sold.push({ item: id, name: def.name, count, earned: price * count });
  }
  return { totalCoins, sold, skipped };
}

/** 执行智能一键出售（实际扣物品+加金币） */
export function sellAllSellable(): SellAllResult {
  const sold: SellAllResult['sold'] = [];
  const skipped: SellAllResult['skipped'] = [];
  let totalCoins = 0;
  for (const id of Object.keys(SELLABLE_ITEMS) as ItemType[]) {
    const count = getItemCount(id);
    if (count <= 0) continue;
    const def = getItemDef(id);
    // 玩家锁定的物品跳过
    if (isItemLocked(id)) {
      skipped.push({ item: id, name: def.name, count, reason: 'locked' });
      continue;
    }
    // reserve 类资源跳过（不自动卖，但保留在 SELLABLE_ITEMS 中供手动单个卖）
    if (def.sellPriority === 'reserve') {
      skipped.push({ item: id, name: def.name, count, reason: 'reserve' });
      continue;
    }
    // normal：正常出售
    const price = SELLABLE_ITEMS[id]!;
    addItem(id, -count);
    addCoins(price * count);
    totalCoins += price * count;
    sold.push({ item: id, name: def.name, count, earned: price * count });
  }
  return { totalCoins, sold, skipped };
}
