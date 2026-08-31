/**
 * 存档系统（v0.5）
 *
 * 使用 localStorage 持久化游戏进度，刷新页面后恢复。
 * 保存内容按分组组织：player / world / farm / story。
 *
 * 触发时机：
 *   睡觉时自动保存（MapScene.trySleep）
 *   页面关闭/刷新前保存（beforeunload 事件）
 *
 * 版本升级策略：
 *   加载时若存档 version !== SAVE_VERSION，则调用 migrate() 迁移。
 *   当前 v0.5 的迁移策略：直接清空旧存档 —— 宁可重新开始，也不让旧格式污染新结构。
 *   后续版本升级时，在 migrate() 中编写逐字段搬移的真实迁移逻辑。
 */

import { getCoins, setCoins } from '../data/Economy';
import { getLevel, getXp, setLevel, setXp } from '../data/FarmProgress';
import {
  clearAllTiles,
  getAllCropEntries,
  getAllTileEntries,
  getAllTreeEntries,
  restoreCropEntries,
  restoreTileEntries,
  restoreTreeEntries,
  type CropData,
  type TileState,
  type TreeState,
} from '../data/FarmState';
import { getAllInventoryEntries, restoreAllInventory, type ItemType, getLockedItems, restoreLockedItems } from '../data/Inventory';
import { getRestoreEntries, restoreRestoreEntries } from '../data/FarmRestore';
import { getAlbumSaveData, restoreAlbumSaveData } from '../data/PhotoAlbum';
import { getTime, setTimeFull } from '../data/TimeSystem';
import { getStamina, setStamina as restoreStamina } from '../data/Stamina';
import { getMinedOreIds, restoreMinedOres } from '../data/MineState';
import { getAutomationSave, restoreAutomation, type RobotData } from './AutomationSystem';
import { getStoryStep, setStoryStep, isCh1TownIntroDone, markCh1TownIntroDone, STORY_STEPS, type StoryStep } from '../systems/StorySystem';
import { getQuestState, setQuestState, type QuestState } from '../systems/QuestSystem';
import { getDailyQuestSaveData, restoreDailyQuests, type DailyQuestSaveData } from '../systems/DailyQuestSystem';
import { getGameEventSaveData, restoreGameEventSaveData, type GameEventSaveData } from './EventManager';
import { getChapterSaveData, restoreChapterSaveData } from './ChapterSystem';
import { getNatureDiscoverySaveData, restoreNatureDiscoverySaveData, type DiscoveryRecord } from './DiscoveryManager';
import { MapScene, setPendingMapFlags } from '../scenes/MapScene';
import type { MapSceneFlags } from '../scenes/MapScene';

/** 当前存档格式版本（格式变更时递增；不匹配时走 migrate()） */
export const SAVE_VERSION = '0.5';

/** 存档 key */
const STORAGE_KEY = 'return_star_save';

/** 存档数据结构（v0.5 分组格式） */
export interface SaveData {
  version: string;
  /** 现实保存时间（ISO 格式，便于 UI 显示） */
  savedAt: string;
  /** Unix 时间戳（内部使用） */
  timestamp: number;
  /** 玩家：位置 + 背包 */
  player: {
    x: number;
    y: number;
    scene: string;
    facing: string;
    inventory: Record<ItemType, number>;
    /** FEATURE-039：锁定的物品 ID 列表（可选，旧档无此字段视为空） */
    lockedItems?: ItemType[];
  };
  /** 世界：时间 / 经济 / 进度 */
  world: {
    day: number;
    hour: number;
    minute: number;
    coins: number;
    level: number;
    xp: number;
    stamina: number;
    minedOres: string[];
    questState: QuestState;
    dailyQuest?: DailyQuestSaveData;
  };
  /** 农场：土地 / 作物 / 树木 / 环境恢复点 */
  farm: {
    tiles: [string, TileState][];
    crops: [string, CropData][];
    trees: [string, TreeState][];
    /** M1-3 环境恢复点状态（旧字段，仅用于旧档迁移；新档写入顶层 worldRestore） */
    restore?: Record<string, boolean>;
    /** 自动化设备（可选，旧档无此字段视为无机器人） */
    automation?: { level: number; robots: RobotData[] };
  };
  /** 归星岛复兴：建设点/恢复点状态（FEATURE-037 决策 5：独立顶层字段，不塞 farm.restore；
   *  可选，旧档无此字段时优先迁移 farm.restore，两者皆无视为全部未恢复） */
  worldRestore?: Record<string, boolean>;
  /** 剧情进度 */
  story: {
    storyStep: StoryStep;
    ch1TownIntroDone?: boolean;
  };
  /** MapScene 一次性 flag（可选，旧档无此字段时使用默认值） */
  mapFlags?: MapSceneFlags;
  /** 归星录·相簿：已解锁照片 ID（可选，旧档无此字段视为空，v0.1） */
  album?: string[];
  /** 自然观察发现记录（P0 Phase C；玩家记忆——只存真正产生过的发现，不存图鉴百分比/数量） */
  natureDiscovery?: Record<string, DiscoveryRecord>;
  /** 一次性事件状态（可选，旧档无此字段视为空；统一"只触发一次"机制，2026-08-06） */
  gameState?: GameEventSaveData;
  /** 章节（可选，旧档无该字段 → 默认 CHAPTER_0 归星；观星夜完成后升为 CHAPTER_1 复苏，2026-08-12） */
  chapter?: number;
}

/** 上一次加载时遇到的不匹配版本号（用于 UI 提示） */
let lastIncompatibleVersion: string | null = null;

/**
 * DevTestHub 专用：种子档在无活跃 MapScene 实例时注入 mapFlags 的覆盖通道。
 * - 正常游戏流程永不触发（SeededFlagOverride 类型只被 DevTestHub 使用）。
 * - DevTestHub.applyDevSeed 在 save() 前调用，确保 dryyard 等 flag 随存档入档。
 * - 一次注入即消费（save 后自动清空），不残留污染后续存档。
 * - 语义：种子声明的字段覆盖实例值；未声明的字段保留实例现有值（必填字段不丢）。
 */
export interface SeededFlagOverride {
  flags: Partial<MapSceneFlags>;
}
let _pendingFlagOverride: SeededFlagOverride | null = null;
/** @internal DevTestHub 专用 —— 正常游戏流程禁止调用 */
export function setPendingFlagOverride(po: SeededFlagOverride): void {
  _pendingFlagOverride = po;
}
/** save() 内部消费：返回 override flags（若有）并清空 */
function consumePendingFlagOverride(): Partial<MapSceneFlags> | null {
  const po = _pendingFlagOverride;
  _pendingFlagOverride = null;
  return po ? po.flags : null;
}

/** 格式化时间为可读字符串 */
function formatSavedAt(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

/**
 * 保存游戏（序列化所有模块状态 → localStorage）
 *
 * 2026-08-17 P0：
 *  - 全链路 try-catch：把 data 收集 + JSON.stringify + setItem 整体纳入保护，
 *    避免 getter / stringify 抛异常时 save 打断调用方流程（如睡觉存档）。
 *  - scene 空值保护：拒绝写入非法空场景，防止 DevHub 后门污染真实存档导致黑屏。
 *  - 返回 boolean：true=成功；false=被拒绝或保存失败（调用方可按需消费，暂不强改）。
 */
export function save(player: {
  x: number;
  y: number;
  scene: string;
  facing: string;
  dailyQuest?: DailyQuestSaveData;
}): boolean {
  // ③ scene 空值保护：拒绝非法场景写入（防 DevTestHub 的 save({scene:''}) 后门黑屏）
  if (!player.scene) {
    console.warn('[SaveSystem] 拒绝写入：scene 为空，已拦截（防存档污染）', {
      x: player.x,
      y: player.y,
      facing: player.facing,
    });
    return false;
  }

  try {
    const t = getTime();
    const now = new Date();
    const data: SaveData = {
      version: SAVE_VERSION,
      savedAt: formatSavedAt(now),
      timestamp: now.getTime(),
      player: {
        x: player.x,
        y: player.y,
        scene: player.scene,
        facing: player.facing,
        inventory: Object.fromEntries(getAllInventoryEntries()) as Record<ItemType, number>,
        lockedItems: getLockedItems(),
      },
      world: {
        day: t.day,
        hour: t.hour,
        minute: t.minute,
        coins: getCoins(),
        level: getLevel(),
        xp: getXp(),
        stamina: getStamina(),
        minedOres: getMinedOreIds(),
        questState: getQuestState(),
        dailyQuest: player.dailyQuest ?? getDailyQuestSaveData(),
      },
      farm: {
        tiles: getAllTileEntries(),
        crops: getAllCropEntries(),
        trees: getAllTreeEntries(),
        automation: getAutomationSave(),
      },
      worldRestore: getRestoreEntries(),
      story: {
        storyStep: getStoryStep(),
        ch1TownIntroDone: isCh1TownIntroDone(),
      },
      album: getAlbumSaveData(),
      natureDiscovery: getNatureDiscoverySaveData(),
      // DevTestHub 种子覆盖优先，与活跃实例 flag 合并（种子声明字段优先，缺省保留实例值）
      // 类型说明：运行时与 JSON 载入路径一致——MapScene.init 消费时每个字段都有 ?? 默认值兜底，
      // 缺必填字段可安全吸收；此处仅需满足存档结构类型。
      mapFlags: (() => {
        const override = consumePendingFlagOverride();
        const inst = MapScene.getCurrentFlags();
        if (!override) return inst ?? undefined;
        const merged = { ...(inst ?? {}), ...override } as MapSceneFlags;
        // DevTestHub 种子路径：同一会话内 scene.start 复用 MapScene 实例，存档新值不会自动覆盖实例属性。
        // 与 load() 读档行为对齐——把合并结果挂到 pending 通道，新场景 init 时 consume 恢复。
        setPendingMapFlags(merged);
        return merged;
      })(),
      gameState: getGameEventSaveData(),
      chapter: getChapterSaveData(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('[SaveSystem] 存档已保存', {
      version: SAVE_VERSION,
      savedAt: data.savedAt,
      day: t.day,
      time: `${t.hour}:${String(t.minute).padStart(2, '0')}`,
      coins: data.world.coins,
      level: data.world.level,
    });
    return true;
  } catch (e) {
    // 覆盖：getter 抛异常 / JSON.stringify 抛异常 / setItem 失败（localStorage 满）等全部场景
    console.error('[SaveSystem] 存档保存失败（getter/序列化/localStorage 异常）', e);
    return false;
  }
}

/** 读取存档元信息（不完整解析，仅版本号 + 保存时间） */
export function getSaveMeta(): { version: string; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData>;
    return {
      version: data.version ?? 'unknown',
      savedAt: data.savedAt ?? '未知',
    };
  } catch {
    return null;
  }
}

/** 获取上一次加载时遇到的不匹配版本号 */
export function getLastIncompatibleVersion(): string | null {
  return lastIncompatibleVersion;
}

/** 清除不匹配版本记录 */
export function clearIncompatibleVersion(): void {
  lastIncompatibleVersion = null;
}

/** 读取存档（返回 null 表示无存档、版本不匹配或数据损坏） */
export function load(): SaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData>;

    // 版本检查：不匹配 → 执行迁移（当前 v0.5 策略为清空旧存档）
    const saveVersion = data.version ?? 'unknown';
    if (saveVersion !== SAVE_VERSION) {
      lastIncompatibleVersion = saveVersion;
      console.warn(
        `[SaveSystem] 存档版本不匹配：当前 ${SAVE_VERSION}，存档 ${saveVersion}，执行迁移。`,
      );
      migrate(saveVersion);
      return null;
    }

    // 结构完整性校验
    if (!data.player || !data.world || !data.farm || !data.story) {
      console.warn('[SaveSystem] 存档数据不完整，忽略');
      return null;
    }

    // 边界保护（v0.5.2 P0）：非法枚举/非数值字段降级为安全默认，防止坏档导致崩溃
    sanitize(data as SaveData);
    return data as SaveData;
  } catch {
    console.warn('[SaveSystem] 存档读取失败，数据可能损坏');
    return null;
  }
}

/**
 * 加载时边界保护：不改存档结构、不升版本号，只把非法值收敛为安全默认。
 * JSON 解析保证数值有限或缺失（缺失字段用默认值兜底）。
 */
function sanitize(data: SaveData): void {
  // 剧情步骤：不在白名单内 → 降级为 done（教程已完成态，避免未知步骤破坏状态机）
  if (!STORY_STEPS.includes(data.story.storyStep)) {
    data.story.storyStep = 'done';
  }
  // 主线任务状态：非法值 → not_started
  const questStates: readonly string[] = ['not_started', 'accepted', 'collected', 'completed'];
  if (!questStates.includes(data.world.questState)) {
    data.world.questState = 'not_started';
  }
  // 数值字段：非有限数/缺失 → 默认值（setter 会再做 clamp）
  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  data.world.day = num(data.world.day, 1);
  data.world.hour = num(data.world.hour, 6);
  data.world.minute = num(data.world.minute, 0);
  data.world.coins = num(data.world.coins, 100);
  data.world.level = num(data.world.level, 1);
  data.world.xp = num(data.world.xp, 0);
  data.world.stamina = num(data.world.stamina, 100);
  // 每日任务：progress 非数值 → 0
  // BUG-FIX（P1-3）：quests 缺失/非数组时 for-of 抛 TypeError → 被 load() 的 catch 吞掉 → 整档静默丢弃；
  // 数组内混入 null 时对 null 赋属性同样崩溃。此处双重防御（Array.isArray + 跳过 null 项）。
  if (data.world.dailyQuest && Array.isArray(data.world.dailyQuest.quests)) {
    for (const q of data.world.dailyQuest.quests) {
      if (!q) continue;
      q.progress = num(q.progress, 0);
      q.completed = !!q.completed;
      q.claimed = !!q.claimed;
    }
  }
  // 自动化设备：robots 内非法数值降级为安全默认（不影响旧档）
  if (data.farm.automation && Array.isArray(data.farm.automation.robots)) {
    for (const r of data.farm.automation.robots) {
      if (r && typeof r.col === 'number' && Number.isFinite(r.col)) r.col = Math.max(0, Math.floor(r.col));
      if (r && typeof r.row === 'number' && Number.isFinite(r.row)) r.row = Math.max(0, Math.floor(r.row));
    }
  }
  // 一次性事件状态：缺失/非法 → 空对象（旧档兼容，不触发任何历史事件）
  if (!data.gameState || typeof data.gameState !== 'object') {
    data.gameState = { triggeredEvents: {} };
  } else if (!data.gameState.triggeredEvents || typeof data.gameState.triggeredEvents !== 'object') {
    data.gameState.triggeredEvents = {};
  }
  // 归星岛复兴：worldRestore 只保留 true 值（非法值收敛，防坏档）
  if (data.worldRestore && typeof data.worldRestore === 'object') {
    for (const [k, v] of Object.entries(data.worldRestore)) {
      if (v !== true) delete data.worldRestore[k];
    }
  } else {
    data.worldRestore = undefined;
  }
}

/**
 * 存档迁移：加载时 version 与 SAVE_VERSION 不一致时调用。
 * v0.5 起始策略：直接清空旧存档 —— 宁可重新开始，也不让旧格式数据污染新分组结构。
 * 后续版本升级时，在此处编写逐字段搬移的真实迁移逻辑。
 *
 * 2026-08-17 P0：清档前先把旧档备份到 `return_star_save_backup_<oldVersion>`，
 * 防止误升级 / 版本切换 / 数据异常导致玩家进度不可恢复。
 */
function migrate(oldVersion: string): void {
  const raw = localStorage.getItem(STORAGE_KEY);
  console.warn(`[SaveSystem] 迁移 ${oldVersion} → ${SAVE_VERSION}：备份旧档后清空`);
  if (raw !== null) {
    try {
      localStorage.setItem(`return_star_save_backup_${oldVersion}`, raw);
    } catch (e) {
      // 备份失败（如 localStorage 已满）也不阻断迁移：旧档结构已不适用当前版本
      console.warn('[SaveSystem] 迁移备份失败，旧档可能无法恢复', e);
    }
  }
  localStorage.removeItem(STORAGE_KEY);
}

/** 应用存档到各模块（读取后调用） */
export function apply(data: SaveData): void {
  // 世界：时间 / 金币 / 经验 / 体力 / 矿脉 / 任务
  setTimeFull(data.world.day, data.world.hour, data.world.minute);
  setCoins(data.world.coins);
  setLevel(data.world.level);
  setXp(data.world.xp);
  restoreStamina(data.world.stamina ?? 100);
  restoreMinedOres(data.world.minedOres ?? []);
  setQuestState(data.world.questState as QuestState);
  if (data.world.dailyQuest) restoreDailyQuests(data.world.dailyQuest);
  // 农场：土地 / 作物 / 树木
  clearAllTiles();
  // BUG-FIX（P1-4）：tiles/crops 子字段缺失（存档截断/手改档）时 for-of 抛 TypeError →
  // apply 在场景 create 中裸抛 → 黑屏且内存态污染一半。与下方 trees 的 ?? [] 兜底对齐。
  restoreTileEntries((data.farm.tiles as [string, TileState][]) ?? []);
  restoreCropEntries((data.farm.crops as [string, CropData][]) ?? []);
  restoreTreeEntries((data.farm.trees as [string, TreeState][]) ?? []);
  // FEATURE-037 决策 5：优先顶层 worldRestore；旧档仅 farm.restore（M1-3 garden）→ 一次性迁移合并
  //   （worldRestore 存在时以其为准；两者皆无 → 全部未恢复；迁移不回退 farm.restore）
  const wr: Record<string, boolean> = { ...(data.worldRestore ?? {}) };
  if (data.farm.restore) {
    for (const [k, v] of Object.entries(data.farm.restore)) {
      if (v === true && wr[k] === undefined) wr[k] = true;
    }
  }
  restoreRestoreEntries(wr);
  restoreAutomation(data.farm.automation);
  // 剧情
  setStoryStep(data.story.storyStep ?? 'done');
  if (data.story.ch1TownIntroDone) markCh1TownIntroDone();
  // MapScene 一次性 flag（暂存，等 MapScene.create 消费）
  if (data.mapFlags) setPendingMapFlags(data.mapFlags);
  // 背包
  // BUG-FIX（P1-4）：inventory 字段缺失时 restoreAllInventory 内部对 undefined 取下标崩溃 → 黑屏
  restoreAllInventory(data.player.inventory ?? {});
  // FEATURE-039：恢复锁定状态（旧档无此字段默认空数组）
  restoreLockedItems(data.player.lockedItems ?? []);
  // 归星录·相簿：恢复已解锁照片（旧档无 album 字段默认空）
  restoreAlbumSaveData(data.album ?? []);
  // 自然观察发现记录：恢复玩家记忆（旧档无 natureDiscovery 字段默认空）
  restoreNatureDiscoverySaveData(data.natureDiscovery);
  // 一次性事件状态：恢复已触发事件（旧档无 gameState 字段默认空）
  restoreGameEventSaveData(data.gameState);
  // 章节：恢复当前章节（旧档无 chapter 字段 → 默认 CHAPTER_0，restore 内部兜底）
  restoreChapterSaveData(data.chapter);
  // 玩家位置（由 MapScene 读取后设置 spawn）
}

/** 是否存在存档（P0：裸访问在 localStorage 被禁环境（隐私模式/iframe）直接抛 SecurityError
 * → TitleScene.create 未捕获 → 开局黑屏；与 save/load 主链路的 try-catch 纪律对齐） */
export function hasSave(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch (err) {
    console.warn('[SaveSystem] hasSave() 存储访问失败，按无存档处理', err);
    return false;
  }
}

/** 获取存档中的玩家数据（用于决定出生点） */
export function getPlayerData(): { x: number; y: number; scene: string; facing: string } | null {
  const data = load();
  return data?.player ?? null;
}

/** 删除存档 */
export function deleteSave(): void {
  // BUG-046 修复：标记自动存档被抑制，防止 deleteSave 后的 reload 触发残留 beforeunload 重新写入存档
  _autoSaveSuppressed = true;
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[SaveSystem] 存档已删除');
  } catch (err) {
    console.warn('[SaveSystem] deleteSave() 存储访问失败', err);
  }
}

/** 自动存档抑制标志（BUG-046：删档后阻止 beforeunload 重新写入） */
let _autoSaveSuppressed = false;

/** 查询自动存档是否被抑制（MapScene._beforeUnload 使用） */
export function isAutoSaveSuppressed(): boolean {
  return _autoSaveSuppressed;
}
