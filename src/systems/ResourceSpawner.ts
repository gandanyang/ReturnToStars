/**
 * ResourceSpawner — 资源生成规则查询（查表式，不散落 if-else）
 *
 * 依据：《自然资源与生活制作系统-v1.0.md》蓝图 v1.1 → P0 采集深化任务拆分 v1.1 Phase B。
 *
 * 职责边界（防止 Gathering 变成"资源规则数据库"）：
 *   NatureSystem  → 答"今天是什么环境？"（自然状态/天气/时段）
 *   ResourceSpawner → 答"这种环境下，什么东西可能出现/多稀？"（查规则表）
 *   Gathering     → 只答"玩家采到了什么"（采集动作）
 *
 * 未来复用：钓鱼走 NatureSystem → FishSpawnRule → Fishing；捕虫走 NatureSystem → InsectSpawner → BugCatching。
 *
 * 设计：本模块是**纯查询**，不直接改采集点出现与否（P0 采用"始终出现 + 概率因子"策略，
 * 不破坏现有 probe-gathering/gather-flow）。factor 供后续数量/概率影响消费。
 */

import type { GatherKind } from '../data/Gathering';
import { getCurrentState, getTimePhase, type NatureStateId, type NatureWeather, type TimePhase } from './NatureSystem';
import { isCurrentlyRaining } from './WeatherSystem';

/** 环境上下文（查询入参） */
export interface SpawnContext {
  /** 场景（森林/小镇/农田等） */
  scene: string;
  /** 资源类型（采集物 kind） */
  kind: GatherKind;
  /** 当前自然状态 */
  state: NatureStateId;
  /** 当前天气 */
  weather: NatureWeather;
  /** 当前时段 */
  phase: TimePhase;
}

/** 查询结果 */
export interface SpawnResult {
  /** 当前环境下该资源是否处于"应出现"状态（不为 false 即可用/可能出现） */
  present: boolean;
  /** 概率/数量因子（1=普通；>1 提高；<1 降低）——P0 只表达，后续消费 */
  factor: number;
}

/** 规则表条目（数据驱动，非 if-else） */
interface SpawnRule {
  kind: GatherKind;
  /** 限定场景（缺省=任意） */
  scene?: string | string[];
  /** 不同自然状态下的因子覆盖 */
  stateFactor?: Partial<Record<NatureStateId, number>>;
  /** 不同天气下的因子覆盖 */
  weatherFactor?: Partial<Record<NatureWeather, number>>;
  /** 不同时段下的 present（缺省 true） */
  phasePresent?: Partial<Record<TimePhase, boolean>>;
  /** 不同天气下的 present（缺省 true）——"条件出现"资源（如雨天河螺） */
  weatherPresent?: Partial<Record<NatureWeather, boolean>>;
}

/**
 * 资源生成规则表（P0 验证 3 样本 + 本刀新增河螺条件出现）
 */
const RESOURCE_SPAWN_RULES: SpawnRule[] = [
  // ① 野蘑菇：森林，雨天因子提高（"下雨的时候，森林里总会冒出一些平时不容易发现的蘑菇"）
  // 2026-08-16：天气源统一到 WeatherSystem（isCurrentlyRaining），与雨幕/雨天湿润/rain_forest 同源，
  // 不再用 NatureSystem 的 day%5 占位雨日（两套天气规则会导致"看到下雨但规则不认"）。
  { kind: 'wild_mushroom', scene: ['forest'], weatherFactor: { rain: 1.6, clear: 1.0 } },
  // ② 蒲公英：自然状态影响（萌芽高 / 静谧低）
  { kind: 'dandelion', stateFactor: { germination: 1.5, thriving: 1.2, harvest: 1.0, serene: 0.6 } },
  // ③ 河螺：青禾河畔，仅雨天出现（2026-08-16 制作人拍板：雨天河边资源）
  // 与蘑菇不同：蘑菇是"雨天更多"（factor），河螺是"雨天才有"（weatherPresent 条件出现，
  // 运行时按 isCurrentlyRaining() 判定可达性）。
  { kind: 'river_snail', scene: ['qinghe_river'], weatherPresent: { rain: true, clear: false } },
  // —— 2026-08-16 移除萤火虫占位规则（原 small_flower phasePresent 昼夜 gate）：
  //    该规则是 P0 验证"rule 能区分时段"的占位承载，非真实玩法；一旦 MapScene 消费 present，
  //    它会让白天的小野花全部隐藏（误伤）。萤火虫属未来 InsectSpawner，届时用独立 kind 接入。
];

/** 归一化场景匹配 */
function sceneMatch(ruleScene: string | string[] | undefined, scene: string): boolean {
  if (!ruleScene) return true;
  const list = Array.isArray(ruleScene) ? ruleScene : [ruleScene];
  return list.includes(scene);
}

/**
 * 查询某资源在当前环境下的生成状态。
 * 查表匹配（可多规则命中——因子相乘，present 取 AND；无规则命中则默认 present + factor 1）。
 */
export function querySpawn(ctx: SpawnContext): SpawnResult {
  const rules = RESOURCE_SPAWN_RULES.filter((r) => r.kind === ctx.kind && sceneMatch(r.scene, ctx.scene));
  if (rules.length === 0) return { present: true, factor: 1 };

  let present = true;
  let factor = 1;
  for (const r of rules) {
    // present：任何规则把该时段/天气设为 false → 不出现（条件出现资源）
    if (r.phasePresent && r.phasePresent[ctx.phase] === false) present = false;
    if (r.weatherPresent && r.weatherPresent[ctx.weather] === false) present = false;
    // factor：状态/天气因子相乘
    factor *= (r.stateFactor?.[ctx.state] ?? 1) * (r.weatherFactor?.[ctx.weather] ?? 1);
  }
  return { present, factor };
}

/** 便捷：用当前时间环境查询某场景某资源 */
export function querySceneResource(scene: string, kind: GatherKind): SpawnResult {
  return querySpawn({
    scene,
    kind,
    state: getCurrentState().id,
    weather: isCurrentlyRaining() ? 'rain' : 'clear',
    phase: getTimePhase(),
  });
}
