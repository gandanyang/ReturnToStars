/**
 * 统一一次性事件状态（2026-08-06 制作人拍板：存档系统审查后的小修）
 *
 * 问题：多 Agent 并行开发后，各功能自行维护"是否已触发"（mapFlags 布尔、会话字段、
 *      背包检查、相簿幂等……），缺少统一收口，容易出现"重新进入后旧任务重复触发"。
 *
 * 方案：所有"只该发生一次"的剧情 / 记忆 / 相簿 / 支线 / NPC 事件，统一走
 *      `triggerOnce(id, fn)`；状态随存档持久化（SaveData.gameState.triggeredEvents），
 *      旧档无该字段默认空，不触发任何历史事件。
 *
 * 第一章增强（P0-2，2026-08-12）：条件事件 —— `triggerOnceIf(id, cond, fn)`，
 *      条件满足（章节 / 主线状态 / 世界恢复点）才触发一次；不满足则保持未触发，
 *      后续条件达成时可再次尝试。用于"整理老照片 → 展示墙出现 → 小镇变化"这类
 *      依赖世界状态的剧情解锁。
 *
 * 用法：
 *   import { triggerOnce, triggerOnceIf } from './EventManager';
 *   triggerOnce('xiya_garden_done', () => { runEvent(); save(); });
 *   triggerOnceIf('xiaya_photo_event', { chapter: CHAPTER_1, quest: 'completed' }, () => { showWall(); save(); });
 */

import { getChapter } from './ChapterSystem';
import { getQuestState } from './QuestSystem';
import { isRestored } from '../data/FarmRestore';

/**
 * 条件事件的条件（第一章 P0-2，2026-08-12）：所有字段满足才通过。
 *
 * ⚠️ EventCondition v1 冻结（制作人 2026-08-12 拍板）：
 *   只允许 chapter / quest / restore 三个字段，禁止继续扩展
 *   （npc / item / time / weather / relationship / money 一律不加）。
 *   理由：条件字段已接近"任务系统"，无限扩展会退化成半吊子 RPG 框架；
 *   归星物语第一章由这三个字段足以支撑，缺语义时用多个条件事件组合。
 *   如需新增字段：先写方案交制作人评审，不得自行扩展。
 */
export interface EventCondition {
  /** 最低章节要求（如 CHAPTER_1：第一章开始后才可触发） */
  chapter?: number;
  /** 主线任务状态要求（QuestState：'not_started' | 'accepted' | 'collected' | 'completed'） */
  quest?: string;
  /** 世界恢复点要求（FarmRestore key，如 'garden'：花园已恢复） */
  restore?: string;
}

/** 一次性事件状态的存档结构 */
export interface GameEventSaveData {
  triggeredEvents: Record<string, boolean>;
}

/** 模块级状态（内存 + 存档双源，apply 时整体恢复） */
let triggeredEvents: Record<string, boolean> = {};

/**
 * 触发一次：未触发过 → 执行 fn 并记录；已触发过 → 直接跳过（返回 false）。
 * 调用方负责在 fn 内做必要的存档（save），本模块不隐式存档。
 */
export function triggerOnce(id: string, fn: () => void): boolean {
  if (triggeredEvents[id]) return false;
  try {
    fn();
  } finally {
    // fn 抛异常同样视为已消费：防止读档/同会话重复触发（道具重复发放、演出重放）。
    // 异常本身继续向上抛，由调用方感知；正常路径时序不变（先执行后标记，EventSystem.md 契约）。
    triggeredEvents[id] = true;
  }
  return true;
}

/** 是否已触发过（只读） */
export function hasTriggered(id: string): boolean {
  return !!triggeredEvents[id];
}

/** 手动标记已触发（不执行事件；用于迁移/调试/恢复历史状态） */
export function markTriggered(id: string): void {
  triggeredEvents[id] = true;
}

/** 序列化（SaveSystem.save 调用） */
export function getGameEventSaveData(): GameEventSaveData {
  return { triggeredEvents: { ...triggeredEvents } };
}

/** 恢复（SaveSystem.apply 调用；旧档无字段 → 空状态） */
export function restoreGameEventSaveData(data?: GameEventSaveData): void {
  triggeredEvents =
    data && data.triggeredEvents && typeof data.triggeredEvents === 'object'
      ? { ...data.triggeredEvents }
      : {};
}

/** 条件判断：无条件（空/未提供）→ 恒 true；任一字段不满足 → false */
export function evalCondition(cond?: EventCondition): boolean {
  if (!cond) return true;
  if (cond.chapter !== undefined && getChapter() < cond.chapter) return false;
  if (cond.quest !== undefined && getQuestState() !== cond.quest) return false;
  if (cond.restore !== undefined && !isRestored(cond.restore)) return false;
  return true;
}

/**
 * 条件触发一次（第一章 P0-2）：
 *   条件满足且未触发过 → 执行 fn 并记录（返回 true）；
 *   条件不满足 → 不触发也不记录（返回 false，条件达成后可再次调用尝试）；
 *   已触发过 → 跳过（返回 false）。
 * 调用方负责在 fn 内做必要的存档（save），本模块不隐式存档。
 */
export function triggerOnceIf(
  id: string,
  cond: EventCondition | undefined,
  fn: () => void,
): boolean {
  if (!evalCondition(cond)) return false;
  return triggerOnce(id, fn);
}
