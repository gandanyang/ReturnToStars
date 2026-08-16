/**
 * NatureSystem — 自然状态系统（P0 骨架）
 *
 * 依据：《自然资源与生活制作系统-v1.0.md》蓝图 v1.1 → P0 采集深化任务拆分 v1.1。
 * T1 骨架职责（按制作人施工前调整：先让世界有"状态"，再让资源响应状态）：
 *   - getCurrentState()  ：day → 自然状态（萌芽/繁盛/收获/静谧），固定规则，可推导不存档
 *   - getWeatherToday()  ：天气（确定性，从 day 推导，避免随机存档漂移）
 *   - getTimePhase()     ：时段（晨/日/暮/夜），用于条件采集（夜晚萤火虫等）
 * 先不接资源：采集物池过滤 / 特殊资源生成 留到后续 (P0-2/P0-3) 接入。
 * 边界：独立模块，不让 Gathering.ts 变成"自然世界总管"；钓鱼/捕虫未来可接同样接口。
 *
 * 持久化：自然状态/天气/时段均为"可推导状态"，不进入存档（读档幂等）。
 */

import { getTime } from '../data/TimeSystem';

/** 自然状态 id（不绑定四季概念，未来可扩展 暴雨周/花期/星辉夜/灯塔季） */
export type NatureStateId = 'germination' | 'thriving' | 'harvest' | 'serene';

/** 自然状态信息 */
export interface NatureStateInfo {
  id: NatureStateId;
  /** 阶段名（萌芽期/繁盛期/收获期/静谧期） */
  label: string;
  /** 集液物池（后续接入；T1 骨架阶段为空数组，不消费） */
  gatherKinds: string[];
}

/** 天气类型（P0 骨架：确定性） */
export type NatureWeather = 'clear' | 'rain';

/** 时段（条件采集用：晨/日/暮/夜） */
export type TimePhase = 'dawn' | 'day' | 'dusk' | 'night';

/** 自然状态固定规则：day 分段（可推导，不存档） */
const STATE_DAY_BOUNDS: Array<[number, NatureStateId, string]> = [
  [10, 'germination', '萌芽期'],
  [20, 'thriving', '繁盛期'],
  [30, 'harvest', '收获期'],
  [Infinity, 'serene', '静谧期'],
];

/**
 * 由 day 推导自然状态（固定规则）：
 *   Day 1-10 萌芽期 → 11-20 繁盛期 → 21-30 收获期 → 31+ 静谧期
 */
export function getCurrentState(): NatureStateInfo {
  const day = getTime().day;
  let id: NatureStateId = 'serene';
  let label = '静谧期';
  for (const [maxDay, sid, l] of STATE_DAY_BOUNDS) {
    if (day <= maxDay) { id = sid; label = l; break; }
  }
  return { id, label, gatherKinds: [] };
}

/**
 * 天气（确定性，从 day 推导）——周期性雨日，避免随机导致的存档漂移。
 * 规则：每 5 天一个周期，第 5 天为雨日（示意；数值后续调）。
 */
export function getWeatherToday(): NatureWeather {
  const day = getTime().day;
  // 确定性：day 对 5 取模，余数 0 → 雨日
  return day % 5 === 0 ? 'rain' : 'clear';
}

/**
 * 当日时段（条件采集用：夜晚萤火虫/夜花）。
 * 晨 06-10（含） / 日 10-18 / 暮 18-20 / 夜 20-22+ 与凌晨
 */
export function getTimePhase(): TimePhase {
  const h = getTime().hour;
  if (h >= 6 && h < 10) return 'dawn';
  if (h >= 10 && h < 18) return 'day';
  if (h >= 18 && h < 20) return 'dusk';
  return 'night'; // 20-22 及凌晨 0-6
}
