/**
 * 矿洞状态（挖矿 Phase）
 *
 * 定义矿脉位置、类型、产出，以及当日开采状态。
 * 矿脉每日刷新（睡觉后恢复），当日已开采的矿脉不再产出。
 */

import { ItemType } from './Inventory';

/** 矿石类型 */
export type OreType = 'stone' | 'copper' | 'iron';

/** 矿脉定义 */
export interface OreDeposit {
  /** 唯一 ID（用于追踪开采状态） */
  id: string;
  /** 矿石类型 */
  oreType: OreType;
  /** 瓦片坐标 col */
  col: number;
  /** 瓦片坐标 row */
  row: number;
  /** 消耗体力 */
  staminaCost: number;
  /** 产出物品及数量 */
  drops: { item: ItemType; count: number }[];
  /** 颜色（Phaser 渲染用） */
  color: number;
}

/** 矿脉布局（矿洞地图 30x20） */
export const ORE_DEPOSITS: OreDeposit[] = [
  // 石头矿脉（3处，灰色）
  // 注：s1 原位于 (6,5)，在左上石簇(4-6,4-6)碰撞区内，玩家无法靠近采集 → 移到石簇右侧 (7,5)
  { id: 's1', oreType: 'stone', col: 7, row: 5, staminaCost: 5, color: 0x9e9e9e, drops: [{ item: 'stone', count: 3 }] },
  { id: 's2', oreType: 'stone', col: 22, row: 6, staminaCost: 5, color: 0x9e9e9e, drops: [{ item: 'stone', count: 3 }] },
  { id: 's3', oreType: 'stone', col: 8, row: 14, staminaCost: 5, color: 0x9e9e9e, drops: [{ item: 'stone', count: 3 }] },
  // 铜矿矿脉（2处，橙色）
  { id: 'c1', oreType: 'copper', col: 20, row: 13, staminaCost: 10, color: 0xcc7755, drops: [{ item: 'copper', count: 1 }, { item: 'stone', count: 1 }] },
  { id: 'c2', oreType: 'copper', col: 5, row: 12, staminaCost: 10, color: 0xcc7755, drops: [{ item: 'copper', count: 1 }, { item: 'stone', count: 1 }] },
  // 铁矿矿脉（1处，银白色，稀有）
  // 注：i1 原位于 (24,14)，在右下石簇(23-25,13-15)碰撞区内，玩家无法靠近采集 → 移到石簇右侧 (26,13)
  { id: 'i1', oreType: 'iron', col: 26, row: 13, staminaCost: 15, color: 0xc0c0c0, drops: [{ item: 'iron', count: 1 }] },
];

/** 当日已开采的矿脉 ID 集合 */
const minedOres = new Set<string>();

/** 矿脉三击次数（v1.1 采集体验升级：每处矿脉 3 击开采成功，增强过程感）
 * 注意：该进度为【会话级】——仅本次游玩保留，刷新/重启丢失；
 * 与 minedOres（入档）不同，不随存档序列化（避免改动 SaveData 结构）。
 * 树健康入档（FarmState），矿脉进度不入档：刷新后重新从第 1 击开始，可接受。 */
export const ORE_MAX_HITS = 3;

/** 矿脉命中进度表：deposit.id → 已命中次数（0..ORE_MAX_HITS-1） */
const oreHits = new Map<string, number>();

/** 读取矿脉当前已命中次数 */
export function getOreHits(id: string): number {
  return oreHits.get(id) ?? 0;
}

/**
 * 命中矿脉一次：命中累计，满 ORE_MAX_HITS 击时击破（标记已开采并清进度）。
 * @returns true = 本次击破成功（应发放掉落）
 */
export function hitOre(id: string): boolean {
  const h = (oreHits.get(id) ?? 0) + 1;
  if (h >= ORE_MAX_HITS) {
    oreHits.delete(id);
    markMined(id);
    return true;
  }
  oreHits.set(id, h);
  return false;
}

/**
 * 第 hit 击（1-based）的体力消耗：总消耗不变、分摊三击。
 * 例：铜矿 10 → 4/4/2；石头 5 → 2/2/1；铁矿 15 → 5/5/5。
 */
export function getOreHitCost(deposit: OreDeposit, hit: number): number {
  const base = Math.ceil(deposit.staminaCost / ORE_MAX_HITS);
  if (hit < ORE_MAX_HITS) return base;
  return deposit.staminaCost - base * (ORE_MAX_HITS - 1);
}

/** 检查矿脉是否已开采 */
export function isOreMined(id: string): boolean {
  return minedOres.has(id);
}

/** 标记矿脉已开采 */
export function markMined(id: string): void {
  minedOres.add(id);
}

/** 重置所有矿脉（睡觉/跨天调用；含三击进度一并清空） */
export function resetOres(): void {
  minedOres.clear();
  oreHits.clear();
}

/** 获取已开采矿脉 ID 列表（存档用） */
export function getMinedOreIds(): string[] {
  return Array.from(minedOres);
}

/** 恢复已开采矿脉（存档恢复用） */
export function restoreMinedOres(ids: string[]): void {
  minedOres.clear();
  for (const id of ids) minedOres.add(id);
}
