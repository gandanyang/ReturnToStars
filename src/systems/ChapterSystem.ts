/**
 * 章节系统（第一章 P0-1，2026-08-12）
 *
 * 章节是"版本切换"的基础概念，统一由本章节模块管理：
 *   CHAPTER_0 归星（第0章 Demo：观星夜收尾终态）
 *   CHAPTER_1 复苏（第一章：林澈整理老屋、小镇开始因玩家而变）
 *   CHAPTER_2 春信（第二章预留）
 *
 * 用途：NPC 对白、场景变化、事件解锁均可按章节分支，例如：
 *   if (getChapter() >= CHAPTER_1) { showSpringFestival(); }
 *
 * 持久化：SaveData.chapter（可选字段；旧档无该字段 → 默认 CHAPTER_0，不触发章节差异）
 * 章节推进：观星夜完成（MapScene 收尾存档前）→ setChapter(CHAPTER_1)
 * 边界保护：restore 时非法值（非数字/负数）收敛为 CHAPTER_0（防坏档）
 */

export const CHAPTER_0 = 0;
export const CHAPTER_1 = 1;
export const CHAPTER_2 = 2;

/** 章节显示名（Banner/UI 用） */
export const CHAPTER_NAMES: Record<number, string> = {
  [CHAPTER_0]: '归星',
  [CHAPTER_1]: '复苏',
  [CHAPTER_2]: '春信',
};

/** 当前章节（模块级单例） */
let currentChapter: number = CHAPTER_0;

/** 读取当前章节 */
export function getChapter(): number {
  return currentChapter;
}

/** 设置当前章节（章节推进/调试用） */
export function setChapter(chapter: number): void {
  currentChapter = chapter;
}

/** 当前章节是否 >= 目标章节（"第一章开始后"的通用判断） */
export function isChapterAtLeast(chapter: number): boolean {
  return currentChapter >= chapter;
}

/** 序列化（SaveSystem.save 调用） */
export function getChapterSaveData(): number {
  return currentChapter;
}

/** 恢复（SaveSystem.apply 调用；旧档无字段 → CHAPTER_0） */
export function restoreChapterSaveData(chapter: number | undefined): void {
  currentChapter =
    typeof chapter === 'number' && Number.isFinite(chapter) && chapter >= 0
      ? Math.floor(chapter)
      : CHAPTER_0;
}
