/**
 * 天气系统（BUG-048 v0.10-lite）
 *
 * 世界反馈层：让归星岛"会随着时间变化"。v0.10 只做雨天，
 * 雾天/星夜/正式季节循环延后（见 归星岛环境循环系统-v0.1.md）。
 *
 * 设计约束（制作人拍板）：
 * - 零存档字段：天气按 world.day 纯函数派生，不入档 → 旧档天然兼容
 * - 事件表脚本化：不做随机概率（测试成本高、反馈不可控）
 * - 跨场景一致：同一天任何地图 getWeather(day) 结果相同
 *
 * 事件表（v0.10-lite）：
 *   Day 1 晴 → Day 2 小雨 → Day 3-5 晴 → Day 6 小雨 → Day 7-9 晴 → Day 10 小雨 → …
 *   2026-08-16 制作人拍板：天气从"一次性演示事件"改为"轻量周期天气"——
 *   重要天气会再次出现（Day 2 是教学雨，Day 6/10 是生活规律雨），
 *   但不需要玩家精确记日历；规则独立成可读天气表，后续剧情日/EventPlan 冲突可直接扩展。
 */

import { getTime } from '../data/TimeSystem';

/** 天气类型 */
export type Weather = 'clear' | 'rain';

/**
 * 天气表（可读数据源，不写死 day % N）：
 *   Day 2  = 教学雨（小梅第一次引导，triggerOnce 只教一次）
 *   Day 6  = 生活规律雨（玩家已学会"下雨 → 去后山看看"）
 *   Day 10 = 生活规律雨
 * 未列出的日子 = clear。后续增加剧情雨 / 特殊天气直接在此追加。
 */
const WEATHER_SCHEDULE: ReadonlyArray<{ day: number; weather: Weather }> = [
  { day: 2, weather: 'rain' },
  { day: 6, weather: 'rain' },
  { day: 10, weather: 'rain' },
];

/** 按游戏日派生当天天气（纯函数，不依赖任何状态） */
export function getWeather(day: number): Weather {
  for (const entry of WEATHER_SCHEDULE) {
    if (entry.day === day) return entry.weather;
  }
  return 'clear';
}

/** 是否为雨天（带时间范围：雨日 10:00-16:00） */
export function isRainy(day: number, hour: number): boolean {
  return getWeather(day) === 'rain' && hour >= 10 && hour < 16;
}

/** 获取当前天气（基于当前时间） */
export function getCurrentWeather(): Weather {
  const { day, hour } = getTime();
  return isRainy(day, hour) ? 'rain' : 'clear';
}

/** 当前是否下雨 */
export function isCurrentlyRaining(): boolean {
  return getCurrentWeather() === 'rain';
}
