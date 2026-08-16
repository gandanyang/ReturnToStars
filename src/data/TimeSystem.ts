/**
 * 游戏时间系统（Phase 4.1）
 *
 * 时间流逝规则：
 *   现实 1 分钟 = 游戏 2 小时 = 120 游戏分钟
 *   → 现实 1 秒 = 游戏 2 分钟
 *   → 现实 1 毫秒 = 游戏 0.002 分钟
 *
 * 每日时段：06:00 开始，22:00 结束（共 16 游戏小时 = 8 现实分钟）
 * 到达 22:00 后不自动跨天，等待玩家睡觉（或 debug API）调用 nextDay()。
 *
 * 与 FarmState 的关系（按约定不推翻）：
 *   TimeSystem.nextDay() → 内部调用 FarmState.advanceDay()
 *   Phase 4 之后的扩展（NPC 刷新/任务刷新/商店刷新）也挂在 nextDay 之后。
 */

import { advanceDay } from './FarmState';

/** 游戏时间数据结构 */
export interface GameTime {
  /** 当前天数（从 1 开始） */
  day: number;
  /** 当前小时（0-23） */
  hour: number;
  /** 当前分钟（0-59） */
  minute: number;
}

/** 一天开始时间（小时） */
const DAY_START_HOUR = 6;
/** 一天结束时间（小时，到达后暂停，不自动跨天） */
const DAY_END_HOUR = 22;

/** 当前时间（模块级单例） */
const time: GameTime = {
  day: 1,
  hour: DAY_START_HOUR,
  minute: 0,
};

/**
 * 现实毫秒 → 游戏分钟 的换算
 * 现实 1 分钟 (60_000 ms) = 游戏 120 分钟
 * → 游戏分钟增量 = 现实毫秒 * (120 / 60_000) = 现实毫秒 * 0.002
 */
const MS_TO_GAME_MIN = 120 / 60_000; // = 0.002

/** 累计未进位的游戏分钟（浮点累计精度用） */
let pendingMinutes = 0;

/** 读取当前时间（只读） */
export function getTime(): Readonly<GameTime> {
  return time;
}

/**
 * 设置当前时间（Debug/测试用）
 * hour: 0-23，minute: 0-59，越界自动 clamp
 * 不改变日期
 */
export function setTime(hour: number, minute: number): void {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const m = Math.max(0, Math.min(59, Math.floor(minute)));
  time.hour = h;
  time.minute = m;
  pendingMinutes = 0;
}

/** 完整设置时间（存档恢复用） */
export function setTimeFull(day: number, hour: number, minute: number): void {
  time.day = Math.max(1, Math.floor(day));
  time.hour = Math.max(0, Math.min(23, Math.floor(hour)));
  time.minute = Math.max(0, Math.min(59, Math.floor(minute)));
  pendingMinutes = 0;
}

/**
 * 推进游戏时间（每帧由 MapScene.update 调用）
 * @param dtMs 距上一帧经过的毫秒数
 */
export function tick(dtMs: number): void {
  if (dtMs <= 0) return;
  pendingMinutes += dtMs * MS_TO_GAME_MIN;
  const whole = Math.floor(pendingMinutes);
  if (whole >= 1) {
    pendingMinutes -= whole;
    advanceGameMinutes(whole);
  }
}

/**
 * 推进游戏时间（内部共用）：按"游戏分钟"进位（60 分=1 小时，到 DAY_END_HOUR 强制停）。
 * 供 tick（现实流逝累积）与 consumeMinutes（动作时间成本）共用的唯一进位源。
 */
function advanceGameMinutes(n: number): void {
  if (n <= 0) return;
  const total = time.minute + n;
  time.minute = total % 60;
  const addHours = Math.floor(total / 60);
  time.hour += addHours;
  // 到达 DAY_END_HOUR 整点：强制停在 22:00:00（剩余丢弃），直到 sleep / nextDay
  if (time.hour >= DAY_END_HOUR) {
    time.hour = DAY_END_HOUR;
    time.minute = 0;
    pendingMinutes = 0;
  }
}

/**
 * 动作时间成本（P0 Action Time）：玩家做一个动作消耗 n 游戏分钟。
 * 只负责"推进时间"——不参与判定"扣了多少"，由各动作自行决定成本；不改变天数。
 * 对齐原则：时间系统只推进时间（机会成本），不做惩罚/不反向知道动作细节。
 * @param n 消耗的游戏分钟数（>0）
 */
export function consumeMinutes(n: number): void {
  if (!(n > 0)) return;
  pendingMinutes = 0; // 动作推进是确定性的，丢弃残留现实累积，避免双源叠加
  advanceGameMinutes(n);
}

/**
 * 结束当天 → 推进到次日 06:00
 * 内部调用 FarmState.advanceDay(time.day) 做作物成长结算。
 * TimeSystem 是唯一时间来源：天数只在这里 +=1，FarmState 不自存天数。
 * Phase 4 之后扩展的 NPC/商店/任务刷新等也在此处追加调用。
 * @returns 新的天数
 */
export function nextDay(): number {
  time.day += 1;
  advanceDay(time.day);
  time.hour = DAY_START_HOUR;
  time.minute = 0;
  pendingMinutes = 0;
  return time.day;
}

/**
 * 检查当前是否已到就寝时间（>= 22:00）
 * 用于 UI 提示玩家可以睡觉
 */
export function isPastBedTime(): boolean {
  return time.hour >= DAY_END_HOUR;
}

/**
 * 返回格式化时间字符串，如 "08:30"
 */
export function formatTime(): string {
  const hh = String(time.hour).padStart(2, '0');
  const mm = String(time.minute).padStart(2, '0');
  return `${hh}:${mm}`;
}
