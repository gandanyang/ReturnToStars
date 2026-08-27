/**
 * utils/weather.ts — 天气系统纯函数
 *
 * 从 MapScene 抽离的无状态天气计算函数。
 * 输入 → 计算 → 输出，无任何副作用。
 */

/**
 * 农场暖度计算（全天）
 * - 18:00-21:00 → 0.22（黄昏最暖）
 * - 06:00-18:00 → 倒 V 曲线，正午(13:00)最暖 0.12
 * - 其他时段 → 0.07
 */
export function farmWarmAlphaForHour(hour: number): number {
  if (hour >= 18 && hour < 21) return 0.22;
  if (hour >= 6 && hour < 18) {
    const noon = Math.max(0, 1 - Math.abs(hour - 13) / 6);
    return 0.08 + 0.04 * noon;
  }
  return 0.07;
}

/**
 * 夕阳天光强度：黄昏(18-20)最浓 0.8，白天 0.35，夜晚 0.12
 */
export function farmWarmSkyAlphaForHour(hour: number): number {
  if (hour >= 18 && hour < 21) return 0.8;
  if (hour >= 6 && hour < 18) return 0.35;
  return 0.12;
}
