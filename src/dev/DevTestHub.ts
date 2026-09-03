/**
 * DevTestHub — 开发者测试跳转入口（仅 DEV 构建）
 *
 * 安全边界（硬性）：
 * 1. 仅 DEV 环境启用（import.meta.env.DEV，Vite 生产构建自动 tree-shake）
 * 2. 正式构建不可出现入口（代码物理消除）
 * 3. 不改变正常玩家流程
 * 4. 不改变正式存档 schema
 * 5. 不污染生产存档（走现有 SaveSystem.save()）
 * 6. 后门跳转走现有 ChapterSystem / EventManager / SaveSystem
 * 7. 每个测试入口有对应 probe 验证
 */

import { CHAPTER_0, CHAPTER_1, setChapter } from '../systems/ChapterSystem';
import { markTriggered, restoreGameEventSaveData } from '../systems/EventManager';
import { markRestored, restoreRestoreEntries } from '../data/FarmRestore';
import { setStoryStep, markCh1TownIntroDone, type StoryStep } from '../systems/StorySystem';
import { setTimeFull, getTime } from '../data/TimeSystem';
import { setCoins, addCoins } from '../data/Economy';
import { setQuestState, type QuestState } from '../systems/QuestSystem';
import { setLevel, setXp } from '../data/FarmProgress';
import { setItemCount, addItem, type ItemType } from '../data/Inventory';
import { setStamina, MAX_STAMINA } from '../data/Stamina';
import { getAllCropEntries, setCrop } from '../data/FarmState';
import { save, getPlayerData, setPendingFlagOverride } from '../systems/SaveSystem';
import type { MapSceneFlags } from '../scenes/MapScene';

// ============ Seed 类型 ============

interface DevSeed {
  id: string;
  group: string;
  label: string;
  description: string;
  chapter: number;
  storyStep: StoryStep;
  day: number;
  hour: number;
  minute: number;
  events: string[];
  restores: string[];
  townIntroDone: boolean;
  scene: string;
  spawnX: number;
  spawnY: number;
  coins: number;
  questState: QuestState;
  level: number;
  xp: number;
  inventory: Partial<Record<ItemType, number>>;
  /** 2026-08-28：mapFlags 覆盖（DevTestHub → SaveSystem override 通道）。
   *  仅覆盖种子声明的 dryyard 字段，未声明的字段随存档默认值。 */
  mapFlags?: Partial<MapSceneFlags>;
}

// ============ Seed 定义 ============
// 每个 seed 声明：模拟玩家已经做了什么 → 对应 chapter/event flags/位置

const DEV_TEST_SEEDS: DevSeed[] = [
  // ── 第0章 ──
  // 状态契约：questState=completed → farmWarm 必然存在（deliverQuest 调 markRestored）
  // 教程道具：old_hoe/old_watering_can/old_axe 各 1
  // XP：教程种植/浇水/收获 + 任务交付 ≈ 150 → Lv.2
  {
    id: 'ch0_before_stargaze',
    group: '第0章',
    label: '观星夜前',
    description: '第0章教程完成，观星夜尚未触发',
    chapter: CHAPTER_0,
    storyStep: 'done',
    day: 3, hour: 20, minute: 0,
    events: [],
    restores: ['farmWarm'],
    townIntroDone: false,
    scene: 'farm', spawnX: 240, spawnY: 96,
    coins: 500,
    questState: 'completed',
    level: 2, xp: 150,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
  },
  {
    id: 'ch1_stargaze_done',
    group: '第0章',
    label: '观星夜完成',
    description: '观星夜结束，第一章开始，觉醒独白已播放',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 4, hour: 7, minute: 0,
    events: ['ch1_awakening'],
    restores: ['farmWarm'],
    townIntroDone: false,
    scene: 'farm', spawnX: 240, spawnY: 96,
    coins: 500,
    questState: 'completed',
    level: 2, xp: 150,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
  },
  // ── 第一章 ──
  {
    id: 'ch1_day2_rain',
    group: '第一章',
    label: 'Day2 教学雨',
    description: '第 2 天 09:00（雨窗前 1 小时），小梅教学引导待触发；睡/T 跳到 10:00 后第一场雨来临',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 2, hour: 9, minute: 0,
    events: ['ch1_awakening', 'ch1_elder_visit'],
    restores: ['farmWarm', 'oldHouse'],
    townIntroDone: true,
    scene: 'farm', spawnX: 240, spawnY: 96,
    coins: 500,
    questState: 'completed',
    level: 2, xp: 180,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
  },
  {
    id: 'ch1_first_response',
    group: '第一章',
    label: '第一声回应',
    description: '第一章开始，老屋尚未整理',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 4, hour: 7, minute: 0,
    events: ['ch1_awakening'],
    restores: ['farmWarm'],
    townIntroDone: false,
    scene: 'house', spawnX: 160, spawnY: 192,
    coins: 500,
    questState: 'completed',
    level: 2, xp: 150,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
  },
  // 状态契约：house tidy 4 点全完成，但 oldHouse（资源交付修复外屋）未包含——老屋整理是室内交互，oldHouse 是 farm 场景外屋修复，两者独立
  // 2026-08-14：镇长触发已放宽为「整理完成 + 进老屋即触发」，本种子跳 house 会立即触发镇长上门演出；
  //   时间设夜晚 21:00 贴合"夜晚来访"叙事（新逻辑不再要求隔天，当晚进老屋即触发）。
  {
    id: 'ch1_house_tidy',
    group: '第一章',
    label: '老屋整理完成',
    description: '4 个整理点全完成，进老屋立即触发镇长来访',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 5, hour: 21, minute: 0,
    events: ['ch1_awakening', 'ch1_bed_done', 'ch1_lamp_done', 'ch1_desk_done', 'ch1_radio_done', 'ch1_house_tidy_done'],
    restores: ['farmWarm'],
    townIntroDone: false,
    scene: 'house', spawnX: 160, spawnY: 192,
    coins: 500,
    questState: 'completed',
    level: 2, xp: 160,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
  },
  // 状态契约：elder_visit 完成后集市解锁。oldHouse 已修复（玩家 day 5-6 有资源做外屋修复）
  {
    id: 'ch1_elder_visit',
    group: '第一章',
    label: '镇长来访',
    description: '村长夜间来访完成，集市解锁',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 6, hour: 7, minute: 0,
    events: ['ch1_awakening', 'ch1_bed_done', 'ch1_lamp_done', 'ch1_desk_done', 'ch1_radio_done', 'ch1_house_tidy_done', 'ch1_elder_visit'],
    restores: ['farmWarm', 'oldHouse'],
    townIntroDone: true,
    scene: 'farm', spawnX: 240, spawnY: 96,
    coins: 500,
    questState: 'completed',
    level: 2, xp: 180,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
  },
  // 状态契约：集市已解锁，尚未清理。背包含 wood25+stone15 以支持清理流程测试
  {
    id: 'ch1_market_before',
    group: '第一章',
    label: '集市恢复前',
    description: '集市已解锁，尚未清理场地（背包含清理所需资源）',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 6, hour: 10, minute: 0,
    events: ['ch1_awakening', 'ch1_bed_done', 'ch1_lamp_done', 'ch1_desk_done', 'ch1_radio_done', 'ch1_house_tidy_done', 'ch1_elder_visit'],
    restores: ['farmWarm', 'oldHouse'],
    townIntroDone: true,
    scene: 'town', spawnX: 400, spawnY: 64,
    coins: 1000,
    questState: 'completed',
    level: 2, xp: 180,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5, wood: 25, stone: 15 },
  },
  // 状态契约：集市 3 摊全摆对 → marketSquare restored。清理消耗了 wood25+stone15+gold80
  {
    id: 'ch1_market_after',
    group: '第一章',
    label: '集市恢复后',
    description: '集市已开张（3 摊就位 + markRestored）',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 7, hour: 10, minute: 0,
    events: [
      'ch1_awakening', 'ch1_bed_done', 'ch1_lamp_done', 'ch1_desk_done', 'ch1_radio_done',
      'ch1_house_tidy_done', 'ch1_elder_visit',
      'ch1_market_cleared', 'ch1_market_stall_1', 'ch1_market_stall_2', 'ch1_market_stall_3',
    ],
    restores: ['farmWarm', 'oldHouse', 'marketSquare'],
    townIntroDone: true,
    scene: 'town', spawnX: 400, spawnY: 64,
    coins: 920,
    questState: 'completed',
    level: 3, xp: 300,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
  },
  // 状态契约：同 market_after 但时间设为夜晚以触发春日集
  {
    id: 'ch1_spring_fair',
    group: '第一章',
    label: '春日集',
    description: '集市已开张，夜晚触发春日集',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 7, hour: 20, minute: 0,
    events: [
      'ch1_awakening', 'ch1_bed_done', 'ch1_lamp_done', 'ch1_desk_done', 'ch1_radio_done',
      'ch1_house_tidy_done', 'ch1_elder_visit',
      'ch1_market_cleared', 'ch1_market_stall_1', 'ch1_market_stall_2', 'ch1_market_stall_3',
    ],
    restores: ['farmWarm', 'oldHouse', 'marketSquare'],
    townIntroDone: true,
    scene: 'town', spawnX: 400, spawnY: 64,
    coins: 920,
    questState: 'completed',
    level: 3, xp: 300,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
  },
  // 状态契约：house tidy 完成 + oldHouse 修复（旧日留影交付需 isRestored('oldHouse')，L9527 门禁）
  {
    id: 'ch1_xiya_1',
    group: '第一章',
    label: '夏雅·一',
    description: '老屋整理完成，旧日留影可触发（需 oldHouse 修复才能交付）',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 5, hour: 10, minute: 0,
    events: ['ch1_awakening', 'ch1_bed_done', 'ch1_lamp_done', 'ch1_desk_done', 'ch1_radio_done', 'ch1_house_tidy_done'],
    restores: ['farmWarm', 'oldHouse'],
    townIntroDone: false,
    scene: 'house', spawnX: 160, spawnY: 192,
    coins: 500,
    questState: 'completed',
    level: 2, xp: 160,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
  },
  // ── 完整流程 ──
  {
    id: 'ch1_vs_start',
    group: '完整流程',
    label: '第一章 Vertical Slice 起点',
    description: '第一章起点（觉醒后，老屋前）',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 4, hour: 7, minute: 0,
    events: ['ch1_awakening'],
    restores: ['farmWarm'],
    townIntroDone: false,
    scene: 'house', spawnX: 160, spawnY: 192,
    coins: 500,
    questState: 'completed',
    level: 2, xp: 150,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
  },
  // ── 秋日晒场（EventPlan 第二实例 · 2026-08-28）──
  // 前置链：ch1_spring_fair（春日集）+ crop_corn_first_harvest（玉米首收）→ dryyardUnlocked
  // 触发：进 town 傍晚（17:00-22:00）靠近晒场 → 当天演出 → dryyardPerm 永久变化
  {
    id: 'ch1_dryyard_prep',
    group: '秋日晒场',
    label: '秋日晒场·筹备中',
    description: '春日集+玉米首收已完成，进镇傍晚触发开场演出（老张提起晒场）',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 8, hour: 9, minute: 0,
    events: [
      'ch1_awakening', 'ch1_bed_done', 'ch1_lamp_done', 'ch1_desk_done', 'ch1_radio_done',
      'ch1_house_tidy_done', 'ch1_elder_visit',
      'ch1_market_cleared', 'ch1_market_stall_1', 'ch1_market_stall_2', 'ch1_market_stall_3',
      'ch1_spring_fair', 'crop_corn_first_harvest',
    ],
    restores: ['farmWarm', 'oldHouse', 'marketSquare'],
    townIntroDone: true,
    scene: 'town', spawnX: 656, spawnY: 262,
    coins: 920,
    questState: 'completed',
    level: 3, xp: 400,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
    mapFlags: { dryyardUnlocked: false },
  },
  {
    id: 'ch1_dryyard_ready',
    group: '秋日晒场',
    label: '秋日晒场·三类准备齐',
    description: '晒场恢复+人际三时代+收成齐备，傍晚进镇可直接触发当天演出（17点后靠近晒场）',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 10, hour: 18, minute: 0,
    events: [
      'ch1_awakening', 'ch1_bed_done', 'ch1_lamp_done', 'ch1_desk_done', 'ch1_radio_done',
      'ch1_house_tidy_done', 'ch1_elder_visit',
      'ch1_market_cleared', 'ch1_market_stall_1', 'ch1_market_stall_2', 'ch1_market_stall_3',
      'ch1_spring_fair', 'crop_corn_first_harvest',
      'dryyard_intro', 'dryyard_laozhang_craft', 'dryyard_xiya_photo', 'dryyard_afeng_help',
    ],
    restores: ['farmWarm', 'oldHouse', 'marketSquare'],
    townIntroDone: true,
    scene: 'town', spawnX: 656, spawnY: 262,
    coins: 920,
    questState: 'completed',
    level: 3, xp: 420,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5, corn: 3, qinghe_crucian: 1 },
    mapFlags: {
      dryyardUnlocked: true,
      dryyardEnvStage: 3,        // 晒架→竹席晒篮→玉米串辣椒串 全完成
      dryyardMaterialsDone: true, // 「今年的收成」已摆出
      dryyardHeld: false,        // 尚未办当天演出
      dryyardPerm: false,
    },
  },
  {
    id: 'ch1_dryyard_perm',
    group: '秋日晒场',
    label: '秋日晒场·青禾晒场',
    description: '当天演出已完成，永久变化「青禾晒场」落地（白天老张照看晒架）',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 11, hour: 11, minute: 0,
    events: [
      'ch1_awakening', 'ch1_bed_done', 'ch1_lamp_done', 'ch1_desk_done', 'ch1_radio_done',
      'ch1_house_tidy_done', 'ch1_elder_visit',
      'ch1_market_cleared', 'ch1_market_stall_1', 'ch1_market_stall_2', 'ch1_market_stall_3',
      'ch1_spring_fair', 'crop_corn_first_harvest',
      'dryyard_intro', 'dryyard_laozhang_craft', 'dryyard_xiya_photo', 'dryyard_afeng_help',
      'dryyard_held',
    ],
    restores: ['farmWarm', 'oldHouse', 'marketSquare'],
    townIntroDone: true,
    scene: 'town', spawnX: 656, spawnY: 262,
    coins: 920,
    questState: 'completed',
    level: 3, xp: 440,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
    mapFlags: {
      dryyardUnlocked: true,
      dryyardEnvStage: 3,
      dryyardMaterialsDone: true,
      dryyardHeld: true,
      dryyardPerm: true,         // 青禾晒场永久变化已落地
    },
  },

// ============ 第二章《故人远来》（2026-08-31 补，配合 probe-ch2-return.mjs 8/8 验收）============
// 前置链（探针踩坑沉淀）：灯塔已亮（lighthouseLit，节拍1 前置）+ 青禾码头已修（qinghe_pier_repaired，
// 否则码头交互点距老船长仅 14px 会抢先拦截）+ 秋日晒场全链（第一章章末）。
// 2026-09-03 修复（制作人实测"选种子后灯塔没开门"）：章前一次性生活事件（阿风/木匠到场、
// 亮灯首映、亮灯恢复点）改由 applyDevSeed 集中补齐（见 §7.6），种子数组不再逐个挂。
// 门控说明：ch2 门控读 EventManager 模块内存（hasTriggered），events 数组直接给 ch2_* 即生效；
// mapFlags 走 override 通道入档，scene.start 后 init 恢复实例字段（视觉状态）。
  {
    id: 'ch2_clock_ready',
    group: '第二章',
    label: '故人远来·修钟前',
    description: '灯塔闲聊已过（节拍1），进镇广场修老钟（节拍2，夏雅身世只揭一层）',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 12, hour: 10, minute: 0,
    events: [
      'ch1_awakening', 'ch1_bed_done', 'ch1_lamp_done', 'ch1_desk_done', 'ch1_radio_done',
      'ch1_house_tidy_done', 'ch1_elder_visit',
      'ch1_market_cleared', 'ch1_market_stall_1', 'ch1_market_stall_2', 'ch1_market_stall_3',
      'ch1_spring_fair', 'crop_corn_first_harvest',
      'dryyard_intro', 'dryyard_laozhang_craft', 'dryyard_xiya_photo', 'dryyard_afeng_help', 'dryyard_held',
      'lighthouseLit', 'ch2_lighthouse_talked',
    ],
    restores: ['farmWarm', 'oldHouse', 'marketSquare'],
    townIntroDone: true,
    scene: 'town', spawnX: 330, spawnY: 150,
    coins: 920,
    questState: 'completed',
    level: 4, xp: 520,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
    mapFlags: { ch2LighthouseTalked: true },
  },
  {
    id: 'ch2_pier_ready',
    group: '第二章',
    label: '故人远来·老船长靠岸',
    description: '老钟已修（节拍2），19 点进青禾码头看老船长（节拍3），玩到 20 点码头夜谈自动触发（节拍5 全章高潮）；旅人首遇已过',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 13, hour: 19, minute: 0,
    events: [
      'ch1_awakening', 'ch1_bed_done', 'ch1_lamp_done', 'ch1_desk_done', 'ch1_radio_done',
      'ch1_house_tidy_done', 'ch1_elder_visit',
      'ch1_market_cleared', 'ch1_market_stall_1', 'ch1_market_stall_2', 'ch1_market_stall_3',
      'ch1_spring_fair', 'crop_corn_first_harvest',
      'dryyard_intro', 'dryyard_laozhang_craft', 'dryyard_xiya_photo', 'dryyard_afeng_help', 'dryyard_held',
      'lighthouseLit', 'ch2_lighthouse_talked', 'ch2_clock_fixed', 'qinghe_pier_repaired',
    ],
    restores: ['farmWarm', 'oldHouse', 'marketSquare'],
    townIntroDone: true,
    scene: 'qinghe_river', spawnX: 74, spawnY: 330,
    coins: 920,
    questState: 'completed',
    level: 4, xp: 560,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
    mapFlags: {
      ch2LighthouseTalked: true,
      ch2ClockFixed: true,       // 老钟已修（摆锤在走 + 整点报时）
      ch2StrangerSeen: 1,        // 旅人首遇已过，傍晚进镇可遇第 2/3 次
    },
  },
  {
    id: 'ch2_perm',
    group: '第二章',
    label: '故人远来·夜谈之后',
    description: '夜谈+夏雅秘密已完成（节拍5/6），21 点夜降农场西侧看海平线黑点（节拍7，第三章唯一硬钩子）',
    chapter: CHAPTER_1,
    storyStep: 'observatory_complete',
    day: 14, hour: 21, minute: 0,
    events: [
      'ch1_awakening', 'ch1_bed_done', 'ch1_lamp_done', 'ch1_desk_done', 'ch1_radio_done',
      'ch1_house_tidy_done', 'ch1_elder_visit',
      'ch1_market_cleared', 'ch1_market_stall_1', 'ch1_market_stall_2', 'ch1_market_stall_3',
      'ch1_spring_fair', 'crop_corn_first_harvest',
      'dryyard_intro', 'dryyard_laozhang_craft', 'dryyard_xiya_photo', 'dryyard_afeng_help', 'dryyard_held',
      'lighthouseLit', 'ch2_lighthouse_talked', 'ch2_clock_fixed', 'qinghe_pier_repaired',
      'ch2_pier_repaired', 'ch2_night_talk', 'ch2_xiya_secret',
    ],
    restores: ['farmWarm', 'oldHouse', 'marketSquare'],
    townIntroDone: true,
    // ⚠️ 出生点 (100,200)：避开 farm 全部出口触发区——house 门(x80-128,y288-336)、
    //    西侧灯塔口(x36-64,y160-208，lighthouseLit 后按预埋链解锁)——否则出生即被传走
    scene: 'farm', spawnX: 100, spawnY: 200,
    coins: 920,
    questState: 'completed',
    level: 4, xp: 600,
    inventory: { old_hoe: 1, old_watering_can: 1, old_axe: 1, radish_seed: 5 },
    mapFlags: {
      ch2LighthouseTalked: true,
      ch2ClockFixed: true,
      ch2PierRepaired: true,
      ch2StrangerSeen: 3,        // 旅人三次已全部见过
      ch2NightTalkDone: true,
      ch2XiyaSecretDone: true,
      ch2BlackDotSeen: false,    // 黑点未看——降落在西侧即触发（第三章钩子）
    },
  },
];

// ============ 核心逻辑 ============

/**
 * 重置所有游戏状态到干净起点（不清 localStorage，走模块 API）
 */
function resetAllState(): void {
  restoreGameEventSaveData({ triggeredEvents: {} });
  restoreRestoreEntries({});
}

/**
 * Dev Save（2026-08-16，制作人拍板 Bug 2）：开发工具修改状态后的统一保存入口。
 * 原则：**只修改开发工具需要改的字段，不碰玩家位置/scene/x/y**。
 * - 游戏内有活跃玩家 → 用玩家当前真实位置保存（不污染位置）。
 * - 无活跃玩家（标题页等）→ 保留存档现有 player 字段（不覆盖为 0,0,''）。
 * 避免 `save({x:0,y:0,scene:''})` 这类写法被后续 Agent 复制，破坏正式存档状态。
 */
function devSave(): void {
  const scene = (window as unknown as { __game?: { scene: { getScenes: (a: boolean) => { scene: { key: string }; player?: { x: number; y: number; facing: string } }[] } } })?.__game?.scene?.getScenes(true)[0];
  const p = scene?.player;
  if (p && typeof p.x === 'number' && typeof p.y === 'number') {
    save({
      x: p.x,
      y: p.y,
      scene: scene.scene.key,
      facing: p.facing,
    } as never);
    return;
  }
  // 无活跃玩家：保留存档现有 player 字段，不覆盖为 0,0,''
  // BUG-FIX（P1-6）：无档时不落盘（状态修改无处附着，避免写入 (0,0,'farm') 假档污染下次进档）
  const existing = getPlayerData();
  if (existing) save(existing);
}

/**
 * 应用一个 dev seed：重置 → 设置状态 → 存档
 * 返回目标场景 + 出生点，由调用方执行 scene.start()
 */
export function applyDevSeed(seedId: string): { scene: string; spawnX: number; spawnY: number } | null {
  const seed = DEV_TEST_SEEDS.find(s => s.id === seedId);
  if (!seed) return null;

  // 1. 重置事件 + 恢复点
  resetAllState();

  // 2. 设置章节 + 剧情 + 时间 + 金币 + 任务状态
  setChapter(seed.chapter);
  setStoryStep(seed.storyStep);
  setTimeFull(seed.day, seed.hour, seed.minute);
  setCoins(seed.coins);
  setQuestState(seed.questState);

  // 3. 设置等级 + 经验 + 体力
  setLevel(seed.level);
  setXp(seed.xp);
  setStamina(MAX_STAMINA);

  // 4. 设置背包（按种子声明覆盖，未声明的保持清零后的默认值）
  for (const id of Object.keys(seed.inventory) as ItemType[]) {
    setItemCount(id, seed.inventory[id] ?? 0);
  }

  // 5. 标记事件（markTriggered 只设状态不执行 fn）
  for (const ev of seed.events) {
    markTriggered(ev);
  }

  // 6. 标记恢复点
  for (const r of seed.restores) {
    markRestored(r);
  }

  // 7. 标记镇介绍（2026-08-14：Dev Hub 跳档 = 模拟玩家已到该进度，
  //    首次进镇的 TOWN_INTRO_DIALOGUE 不再重播——种子档不需要开场介绍）
  markCh1TownIntroDone();

  // 7.6 章前一次性生活事件集中补齐（2026-09-03 修复制作人实测"选种子后灯塔没开门"）：
  //     跳档语义 = 模拟玩家已到该进度。第一章及以后的种子视为：
  //     ① 阿风/木匠已到场（adventurer_welcome_back / carpenter_returned）——否则进 farm 即连锁重播
  //       到场演出（storyDialogue 打开 → update 提前 return：玩家冻结、出口检测失效）；
  //       NPC 本人由 NPCSystem 日程照常出现，此处只跳过到达演出。
  //     ② 灯塔亮起首映已看（lighthouse_lit_seen）+ 亮灯恢复点（lighthouseLit）——
  //       春日集后常驻视觉（setupLighthouseDistant 走 hasTriggered + isRestored 双注册表），
  //       漏标则 farm 上重播「去灯塔的路，还堵着」，与灯塔已解锁状态矛盾。新加种子无需再逐个挂。
  if (seed.chapter >= CHAPTER_1) {
    markTriggered('adventurer_welcome_back');
    markTriggered('carpenter_returned');
    if (seed.events.includes('ch1_spring_fair')) {
      markTriggered('lighthouse_lit_seen');
      markRestored('lighthouseLit');
    }
  }

  // 7.5 mapFlags 覆盖（2026-08-28：秋日晒场种子档注入 dryyard 状态。
  //    save() 时通过 SaveSystem 的 override 通道消费——无活跃 MapScene 也能入档。）
  if (seed.mapFlags) {
    setPendingFlagOverride({ flags: { ...seed.mapFlags } });
  }

  // 8. 存档（走现有 SaveSystem）
  save({
    x: seed.spawnX,
    y: seed.spawnY,
    scene: seed.scene,
    facing: 'down',
  });

  return { scene: seed.scene, spawnX: seed.spawnX, spawnY: seed.spawnY };
}

// ============ DOM 菜单 ============

let menuEl: HTMLDivElement | null = null;

/** 打开 dev seed 菜单 */
export function openDevSeedMenu(onSelect: (seedId: string) => void): void {
  if (menuEl) return;

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.85)', zIndex: '9999',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'monospace',
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    background: '#1a1a2e', border: '2px solid #506080', borderRadius: '8px',
    padding: '24px 32px', maxWidth: '560px', maxHeight: '80vh', overflowY: 'auto',
    color: '#c0c0d0', fontSize: '14px',
  });

  // 标题
  const title = document.createElement('div');
  title.textContent = '开发者测试入口';
  Object.assign(title.style, {
    fontSize: '18px', color: '#80a0c0', marginBottom: '4px', fontWeight: 'bold',
  });
  panel.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.textContent = '选择一个测试种子档（模拟玩家已到达该进度）';
  Object.assign(subtitle.style, {
    fontSize: '12px', color: '#606070', marginBottom: '16px',
  });
  panel.appendChild(subtitle);

  // 按组分类
  const groups = [...new Set(DEV_TEST_SEEDS.map(s => s.group))];
  for (const group of groups) {
    const groupTitle = document.createElement('div');
    groupTitle.textContent = group;
    Object.assign(groupTitle.style, {
      fontSize: '13px', color: '#8080a0', marginTop: '12px', marginBottom: '6px',
      borderBottom: '1px solid #303040', paddingBottom: '4px',
    });
    panel.appendChild(groupTitle);

    for (const seed of DEV_TEST_SEEDS.filter(s => s.group === group)) {
      const btn = document.createElement('div');
      btn.textContent = seed.label;
      Object.assign(btn.style, {
        padding: '8px 12px', margin: '4px 0', cursor: 'pointer',
        background: '#202030', borderRadius: '4px', border: '1px solid #303040',
        transition: 'background 0.15s', fontSize: '13px',
      });
      btn.onmouseenter = () => { btn.style.background = '#304060'; };
      btn.onmouseleave = () => { btn.style.background = '#202030'; };

      // 描述
      const desc = document.createElement('div');
      desc.textContent = seed.description;
      Object.assign(desc.style, {
        fontSize: '11px', color: '#606070', marginTop: '2px',
      });
      btn.appendChild(desc);

      btn.onclick = () => {
        closeDevSeedMenu();
        onSelect(seed.id);
      };

      panel.appendChild(btn);
    }
  }

  // ---- 测试经济工具（P0-3 制作人拍板，2026-08-14：测试后门，不污染正式经济）----
  const econTitle = document.createElement('div');
  econTitle.textContent = '测试经济（Dev 专用）';
  Object.assign(econTitle.style, {
    fontSize: '13px', color: '#80a0c0', marginTop: '16px', marginBottom: '6px',
    borderBottom: '1px solid #304060', paddingBottom: '4px',
  });
  panel.appendChild(econTitle);

  const econActions: { label: string; desc: string; fn: () => void }[] = [
    { label: '＋99999 金币', desc: '快速获得测试金币（addCoins）', fn: () => { addCoins(99999); devSave(); } },
    { label: '加满建设材料', desc: '木头/石头/铜/铁各 +99', fn: () => {
      addItem('wood' as ItemType, 99); addItem('stone' as ItemType, 99);
      addItem('copper' as ItemType, 99); addItem('iron' as ItemType, 99);
      devSave();
    } },
    { label: '加种子', desc: '萝卜/番茄/玉米/草莓种子各 +9', fn: () => {
      addItem('radish_seed' as ItemType, 9); addItem('tomato_seed' as ItemType, 9);
      addItem('corn_seed' as ItemType, 9); addItem('strawberry_seed' as ItemType, 9);
      devSave();
    } },
    { label: '一键作物成熟', desc: '全部作物设为已成熟可收获', fn: () => {
      const today = getTime().day;
      for (const [key, crop] of getAllCropEntries()) {
        setCrop(parseInt(key.split(',')[0]), parseInt(key.split(',')[1]), { ...crop, plantDay: today - 10, watered: true });
      }
      devSave();
    } },
  ];
  for (const a of econActions) {
    const btn = document.createElement('div');
    btn.textContent = a.label;
    Object.assign(btn.style, {
      padding: '8px 12px', margin: '4px 0', cursor: 'pointer',
      background: '#20302a', borderRadius: '4px', border: '1px solid #305040',
      transition: 'background 0.15s', fontSize: '13px',
    });
    btn.onmouseenter = () => { btn.style.background = '#305545'; };
    btn.onmouseleave = () => { btn.style.background = '#20302a'; };
    const desc = document.createElement('div');
    desc.textContent = a.desc;
    Object.assign(desc.style, { fontSize: '11px', color: '#608070', marginTop: '2px' });
    btn.appendChild(desc);
    btn.onclick = () => { a.fn(); btn.style.background = '#3a7050'; setTimeout(() => { btn.style.background = '#20302a'; }, 400); };
    panel.appendChild(btn);
  }

  // 关闭按钮
  const closeBtn = document.createElement('div');
  closeBtn.textContent = '✕ 关闭';
  Object.assign(closeBtn.style, {
    marginTop: '16px', padding: '8px', cursor: 'pointer',
    color: '#806060', textAlign: 'center', fontSize: '12px',
  });
  closeBtn.onclick = closeDevSeedMenu;
  panel.appendChild(closeBtn);

  overlay.appendChild(panel);
  overlay.onclick = (e) => { if (e.target === overlay) closeDevSeedMenu(); };

  document.body.appendChild(overlay);
  menuEl = overlay;
}

/** 关闭 dev seed 菜单 */
export function closeDevSeedMenu(): void {
  if (menuEl) {
    menuEl.remove();
    menuEl = null;
  }
}

/** 获取 dev hub 是否已启用（Vite DEV 构建 + ?devHub=1 URL 参数） */
export function isDevHubEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('devHub');
}

/** 公告栏交互文本（dev 模式下显示） */
export const DEV_BULLETIN_TEXT = '【开发者测试入口】\n选择一个测试种子档，模拟玩家已到达的进度。';

/** 获取所有 seed（供探针验证） */
export function getAllSeeds(): DevSeed[] {
  return DEV_TEST_SEEDS;
}
