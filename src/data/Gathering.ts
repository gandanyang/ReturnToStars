/**
 * 生活采集系统（Phase 1，2026-08-14 设计稿 v0.1）
 *
 * 设计原则（设计稿 §二/§五/§七/§八）：
 *   - 采集是"顺手发现"，不是刷取
 *   - 单次交互极快（0.3~0.8 秒反馈）
 *   - 视觉上像"本来就长在那里"（小群落 2-4 株，不是单个大图标）
 *   - 不均匀刷点（小群落 + 留白）
 *   - 不强迫玩家打卡（一次性，triggerOnce 持久化）
 *
 * 存档原则（§十五）：不新增顶层存档字段，复用 triggerOnce 持久化每个采集点的"已采"状态。
 */

import type { ItemType } from './Inventory';

/** 采集物类型 */
export type GatherKind = 'dandelion' | 'wild_berry' | 'wild_mushroom' | 'small_flower' | 'twig';

/** 采集点视觉/交互配置（静态） */
export interface GatherPointDef {
  /** 唯一 id（场景内不重复） */
  id: string;
  /** 采集物种类 */
  kind: GatherKind;
  /** 像素坐标（场景内） */
  x: number;
  y: number;
  /** 群落大小（视觉株数 2-4，符合 §七"本来长在那里"原则） */
  clusterSize: 2 | 3 | 4;
}

/** 获取物品 id（GatherKind → ItemType） */
export function gatherKindToItem(kind: GatherKind): ItemType {
  return kind; // 当前 1:1 同名
}

/** 触发事件 key（triggerOnce 用） */
export function gatherEventKey(scene: string, id: string): string {
  return `ch1_gather_${scene}_${id}`;
}

/** 采集交互范围（px）——对齐钓鱼 interactRange 32 */
export const GATHER_INTERACT_RANGE = 32;

// ============ 采集点分布（手工指定，避免均匀刷点；§八 小群落 + 留白） ============
// 设计稿 §九 推荐分布：
//   青禾镇（蒲公英 / 小野花 / 芦苇籽）：让镇子本身有生命感
//   河岸  （蒲公英 / 野莓）：引导玩家沿河散步
//   果林  （野莓 / 树果 / 小树枝）：建立果林生活属性
//   森林  （野蘑菇 / 小树枝 / 小野花）：自然资源区
//   老屋附近（落叶 / 小树枝）：荒废但正在恢复
//
// 当前场景：farm（含老屋附近视觉）/ town（含河岸视觉）/ forest
// MVP 范围：5 种采集物 × 4 个地点（设计稿 §十七）
// 采集点数量控制：每场景 3-4 个，避免地图被采集物塞满（§八.3 留白原则）

/** 16 像素 tile */
const T = 16;

/** town 青禾镇 + 河岸采集点（3 个：蒲公英×2 + 小野花×1）
 *  2026-08-14 分布修正：原 dand_1(16,6)/flower_1(28,4) 落在北区石板（广场石板化后非草地），
 *  蒲公英长在石板上不合理 → 移至草地（左屋前 / 左下屋前），保留河岸蒲公英（荒地合理）。 */
export const TOWN_GATHER_POINTS: GatherPointDef[] = [
  // 左下屋前草地：蒲公英小群落（生活区，玩家自然走过会发现）
  { id: 'town_dand_1', kind: 'dandelion', x: 8 * T + 4, y: 20 * T + 6, clusterSize: 3 },
  // 河岸边：蒲公英小群落（与钓鱼点同区域，引导玩家走河边）
  { id: 'town_dand_2', kind: 'dandelion', x: 40 * T + 4, y: 14 * T + 8, clusterSize: 2 },
  // 左下屋旁草地：小野花群落（点缀镇子生活感，避开石板）
  { id: 'town_flower_1', kind: 'small_flower', x: 8 * T + 8, y: 15 * T + 4, clusterSize: 2 },
];

/** forest 森林采集点（4 个：野蘑菇×2 + 小树枝×1 + 小野花×1）
 *  2026-08-14 分布修正：原 flower_1(4,14) 落在墙瓦片(W10)上（坐标错误），
 *  移至草地开阔处 (9,12)，避开老树(8,8)/碎片(20,10)/farm 出口。 */
export const FOREST_GATHER_POINTS: GatherPointDef[] = [
  // 老树附近：野蘑菇群落（背阴处，符合蘑菇生长环境）
  { id: 'forest_mush_1', kind: 'wild_mushroom', x: 6 * T + 8, y: 10 * T + 4, clusterSize: 3 },
  // 林间空地：野蘑菇群落（远离老树，避免和老树交互冲突）
  { id: 'forest_mush_2', kind: 'wild_mushroom', x: 14 * T + 4, y: 13 * T + 8, clusterSize: 2 },
  // 树下：小树枝（地上枯枝，符合 §九 森林特征）
  { id: 'forest_twig_1', kind: 'twig', x: 10 * T + 4, y: 6 * T + 8, clusterSize: 2 },
  // 林间草地开阔处：小野花（林间零星花朵）
  { id: 'forest_flower_1', kind: 'small_flower', x: 9 * T + 8, y: 12 * T + 4, clusterSize: 3 },
];

/** farm 农场（含老屋附近 + 果林视觉）采集点（3 个：野莓×1 + 小树枝×1 + 蒲公英×1） */
export const FARM_GATHER_POINTS: GatherPointDef[] = [
  // 老屋附近：野莓群落（灌木丛边，老屋旁恢复感）
  { id: 'farm_berry_1', kind: 'wild_berry', x: 8 * T + 4, y: 4 * T + 8, clusterSize: 3 },
  // 老屋旁：小树枝（地上枯枝，"荒废但正在恢复"）
  { id: 'farm_twig_1', kind: 'twig', x: 22 * T + 4, y: 4 * T + 8, clusterSize: 2 },
  // 农场边角：蒲公英（远离主农田，避免与种田冲突）
  { id: 'farm_dand_1', kind: 'dandelion', x: 3 * T + 8, y: 14 * T + 4, clusterSize: 3 },
];

/** 获取场景的采集点列表 */
export function getGatherPointsForScene(sceneKey: string): GatherPointDef[] {
  switch (sceneKey) {
    case 'town': return TOWN_GATHER_POINTS;
    case 'forest': return FOREST_GATHER_POINTS;
    case 'farm': return FARM_GATHER_POINTS;
    default: return [];
  }
}

/** 采集物视觉配置（每种采集物的颜色/尺寸，用于程序合成群落精灵） */
export interface GatherVisualConfig {
  /** 主色调 */
  color: number;
  /** 高光色（受光面） */
  highlight: number;
  /** 阴影色（暗面） */
  shadow: number;
  /** 单株宽度（px） */
  width: number;
  /** 单株高度（px） */
  height: number;
}

/** 各采集物的视觉配置（程序合成用，零资产依赖） */
export const GATHER_VISUAL: Record<GatherKind, GatherVisualConfig> = {
  dandelion: { color: 0xffeb3b, highlight: 0xfff9c4, shadow: 0xfbc02d, width: 6, height: 8 },
  wild_berry: { color: 0xc62828, highlight: 0xef5350, shadow: 0x7f0000, width: 5, height: 6 },
  wild_mushroom: { color: 0xa1887f, highlight: 0xd7ccc8, shadow: 0x4e342e, width: 7, height: 8 },
  small_flower: { color: 0xec407a, highlight: 0xf48fb1, shadow: 0xad1457, width: 5, height: 7 },
  twig: { color: 0x6d4c41, highlight: 0x8d6e63, shadow: 0x3e2723, width: 8, height: 3 },
};
