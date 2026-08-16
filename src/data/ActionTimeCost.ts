/**
 * 动作时间成本配置（P0 Action Time，2026-08-15）
 *
 * 原则：时间成本 ≠ 时间惩罚。行动消耗游戏内时间 → 产生"机会成本"（现在做这值不值得），
 * 不引入体力/晕倒/掉物/罚钱/移动耗时。
 *
 * 数值：**先做成可调参数，不拍死**。当前倍率=现实 1 分 = 游戏 2 小时，需实机体验后决定
 * 到底是 3 / 5 / 10 / 15 分钟。此处给初始占位值。
 *
 * 种植（farm）：单格操作频繁（锄/种/浇/收 要一格一格），时间成本用小值（可调），
 * 以免种一片田把一天切得太碎；体力消耗同样轻量。
 */

/** 各动作消耗的游戏分钟数（可调） */
export const ACTION_TIME_COST = {
  /** 一次采集 */
  gathering: 10,
  /** 一次 NPC 对话 */
  dialogue: 10,
  /** 种植单格操作（锄地/播种/浇水/收获各格）：时间（分钟/格，单格频繁→小值） */
  farm_till: 3,
  farm_plant: 3,
  farm_water: 2,
  farm_harvest: 2,
} as const;

/** 种植单格体力消耗（分钟/格，可调；延续"成功才扣"原则） */
export const ACTION_STAMINA_COST = {
  farm_till: 2,
  farm_plant: 1,
  farm_water: 1,
  farm_harvest: 1,
} as const;

/** 读取某动作的时间成本 */
export function getActionTimeCost(action: keyof typeof ACTION_TIME_COST): number {
  return ACTION_TIME_COST[action];
}

/** 读取某动作的体力成本 */
export function getActionStaminaCost(action: keyof typeof ACTION_STAMINA_COST): number {
  return ACTION_STAMINA_COST[action];
}
