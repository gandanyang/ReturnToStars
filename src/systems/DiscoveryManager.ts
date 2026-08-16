/**
 * DiscoveryManager — 自然观察/发现记录（P0 Phase C）
 *
 * 依据：《任务-P0采集深化任务拆分-v1.0.md》Phase C（DiscoveryRecord）。
 *
 * 目标（不是"收集图鉴"）：让玩家逐渐认识青禾镇，而不是完成收集列表。
 *   - 第一次看到资源 → 普通"发现"
 *   - 满足特殊条件 → "特别发现"（雨/时段等）
 *   - 为未来 NPC/事件提供接口（如夏雅问"你发现过夜晚的萤火虫吗？"→ 分支对话）
 *
 * 存档原则：**玩家记忆进存档，世界状态继续推导**。
 *   - 存：玩家真正产生过的发现记录（day / location / specialDiscoveries）
 *   - 不存：图鉴百分比、发现数量（可推导）
 *
 * 不做（留 P1/P2）：图鉴 UI / 收集奖励 / 百科页面。
 */

/** 一条发现记录（玩家记忆） */
export interface DiscoveryRecord {
  /** 资源 id（如 dandelion / wild_mushroom / firefly） */
  resourceId: string;
  /** 第一次发现的天数 */
  firstDiscoverDay: number;
  /** 第一次发现的地点（场景）——归星地点很重要 */
  firstDiscoverLocation?: string;
  /** 特殊发现 id 列表（如 rain_forest / night_firefly），不重复 */
  specialDiscoveries: string[];
}

/** 记录一条发现的上下文（由调用方提供：采集动作 / 观察触发） */
export interface DiscoveryContext {
  resourceId: string;
  day: number;
  /** 触发场景（farm/forest/town...） */
  location: string;
  /** 本次命中的特殊条件（可空） */
  special?: string;
}

/** 模块级记录（玩家记忆；持久化走 SaveSystem 的 optional `natureDiscovery` 字段） */
const records: Record<string, DiscoveryRecord> = {};

/**
 * 记录一条发现（玩家记忆）。首次 → 建记录；特殊 → 追加不重复；均已存在 → no-op。
 * 返回变更描述（供存档决策/测试）：'created' | 'special_added' | 'noop'。
 */
export function recordDiscovery(ctx: DiscoveryContext): 'created' | 'special_added' | 'noop' {
  const existing = records[ctx.resourceId];

  if (!existing) {
    records[ctx.resourceId] = {
      resourceId: ctx.resourceId,
      firstDiscoverDay: ctx.day,
      firstDiscoverLocation: ctx.location,
      specialDiscoveries: ctx.special ? [ctx.special] : [],
    };
    return 'created';
  }

  if (ctx.special && !existing.specialDiscoveries.includes(ctx.special)) {
    existing.specialDiscoveries.push(ctx.special);
    return 'special_added';
  }

  return 'noop';
}

/** 是否已发现某资源 */
export function hasDiscovery(resourceId: string): boolean {
  return !!records[resourceId];
}

/** 读取某资源记录 */
export function getDiscovery(resourceId: string): DiscoveryRecord | undefined {
  return records[resourceId];
}

/** 读取全部发现记录（只读快照，供图鉴展示层使用） */
export function getAllDiscoveries(): Record<string, DiscoveryRecord> {
  return JSON.parse(JSON.stringify(records));
}

/** 是否已满足某资源 + 特殊条件 */
export function hasSpecialDiscovery(resourceId: string, special: string): boolean {
  return records[resourceId]?.specialDiscoveries.includes(special) ?? false;
}

/** 序列化（对象只存玩家记忆，不存图鉴百分比/数量）——SaveSystem.save 调用 */
export function getNatureDiscoverySaveData(): Record<string, DiscoveryRecord> {
  return JSON.parse(JSON.stringify(records));
}

/** 恢复（旧档无 `natureDiscovery` 字段 → 空）——SaveSystem.apply 调用 */
export function restoreNatureDiscoverySaveData(data?: Record<string, DiscoveryRecord>): void {
  for (const k of Object.keys(records)) delete records[k];
  if (!data) return;
  for (const [k, rec] of Object.entries(data)) {
    if (rec && typeof rec.resourceId === 'string') {
      records[k] = {
        resourceId: rec.resourceId,
        firstDiscoverDay: rec.firstDiscoverDay ?? 0,
        firstDiscoverLocation: rec.firstDiscoverLocation,
        specialDiscoveries: Array.isArray(rec.specialDiscoveries) ? rec.specialDiscoveries : [],
      };
    }
  }
}
