/**
 * 老屋整理状态（第一章 P1-1，2026-08-12 制作人拍板：派生接口，零新增存档字段）
 *
 * 老屋整理 4 个交互点（床/灯/书桌/收音机）各自是一次性事件：
 *   ch1_bed_done / ch1_lamp_done / ch1_desk_done / ch1_radio_done
 * （统一走 EventManager.triggerOnceIf，状态随 SaveData.gameState.triggeredEvents 持久化）
 *
 * 本模块从这些一次性事件**派生**整理进度（0~4），不新增任何存档字段：
 *   0 = 未整理
 *   1 = 完成一个
 *   2 = 完成两个
 *   3 = 完成三个
 *   4 = 完成全部
 *
 * 用途（未来消费方，均只读）：
 *   - NPC 评论房子（整理度不同 → 台词不同）
 *   - 灯光/夜晚表现（>0 才有"有人住"的光）
 *   - 夏雅事件前置（全完成 ch1_house_tidy_done 语义的替代判断）
 *   - 章节演出增强
 */

import { hasTriggered } from '../systems/EventManager';

/** 老屋整理的 4 个交互点 key（与 MapScene.setupHouseTidy 的 ch1_${key}_done 一致） */
export const TIDY_KEYS = ['bed', 'lamp', 'desk', 'radio'] as const;

/** 交互点 key 类型 */
export type TidyKey = (typeof TIDY_KEYS)[number];

/** 完成对应交互点的一次性事件 id */
export function tidyEventId(key: TidyKey): string {
  return `ch1_${key}_done`;
}

/**
 * 当前老屋整理等级（派生，0~4）：
 *   统计已触发的 ch1_*_done 事件数量。零新增存档字段，只读 hasTriggered。
 */
export function getHouseTidyLevel(): number {
  let level = 0;
  for (const key of TIDY_KEYS) {
    if (hasTriggered(tidyEventId(key))) level++;
  }
  return level;
}

/** 是否已全部整理完成（level === 4） */
export function isHouseTidyComplete(): boolean {
  return getHouseTidyLevel() === TIDY_KEYS.length;
}
