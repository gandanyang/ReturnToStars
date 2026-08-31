import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { MAP_EXITS, MAP_NAMES } from '../data/exits';
import { isMobileLayout, isTouchDevice } from '../config';
import {
  FARM_AREA,
  TILE_SIZE,
  CropType,
  CROP_TYPES,
  CROP_DEFS,
  getCrop,
  getTileState,
  isInFarmArea,
  setCrop,
  setTileState,
  FARM_TREE_POSITIONS,
  TREE_MAX_HEALTH,
  TREE_REFRESH_INTERVAL,
  initTrees,
  getTree,
  chopTree,
  refreshStumps,
  getAllCropEntries,
  countGrownTiles,
} from '../data/FarmState';
import type { TreeState, TileState } from '../data/FarmState';
import {
  getPlotAt,
  getPlotTiles,
  getPlotSummary,
  getPlotRect,
  getPlotCenter,
  type FarmPlotId,
} from '../data/FarmPlot';
import { getProjectShortfall, getQuickBuyCost, isRestored, markRestored, getRevivalLevel } from '../data/FarmRestore';
import { isHouseTidyComplete } from '../data/HouseTidy';
import { addItem, getItemCount, getItemDef, itemIconHtml, setItemCount, type ItemType } from '../data/Inventory';
import { MAIL_LETTERS, getMailLetter, type MailLetter } from '../data/MailLetters';
import { getGatherPointsForScene, gatherKindToItem, gatherEventKey, GATHER_INTERACT_RANGE, GATHER_VISUAL, type GatherPointDef, type GatherVisualConfig } from '../data/Gathering';
import { querySceneResource } from '../systems/ResourceSpawner';
import { recordDiscovery, hasSpecialDiscovery } from '../systems/DiscoveryManager';
import { formatTime, getTime, nextDay as timeNextDay, setTime, setTimeFull, tick as timeTick, consumeMinutes } from '../data/TimeSystem';
import { getActionTimeCost, getActionStaminaCost } from '../data/ActionTimeCost';
import { getCoins, spendCoins, addCoins, WOOD_BUY_PRICE } from '../data/Economy';
import { addXp, getLevel, getXp, getXpToNext, setOnLevelUp } from '../data/FarmProgress';
import { getStamina, consumeStamina, resetStamina, MAX_STAMINA } from '../data/Stamina';
import { ORE_DEPOSITS, OreDeposit, isOreMined, resetOres, hitOre, getOreHits, getOreHitCost, ORE_MAX_HITS } from '../data/MineState';
import { NPC } from '../entities/NPC';
import { getNPCsForScene, refreshSchedule, updateNPCs, getDailyNpcLine, getMysteryAfterObservatory, getAdventurerDialogue } from '../systems/NPCSystem';
import { collectShard, getElderDialogue, getQuestObjective, getQuestState, isElderBusyDay } from '../systems/QuestSystem';
import { triggerRandomEvent, resetDailyEvents } from '../systems/DailyEventSystem';
import { getWeather, isCurrentlyRaining } from '../systems/WeatherSystem';
import {
  getDailyQuests,
  refreshDailyQuests,
  onHarvest as onDQHarvest,
  onWater as onDQWater,
  onPlant as onDQPlant,
  onCollect as onDQCollect,
  onTalkNpc as onDQTAlkNpc,
  onBuyShop as onDQBuyShop,
  onSellShop as onDQSellShop,
  onMine as onDQMine,
  onWoodcut as onDQWoodcut,
  claimReward,
  getDailyQuestSaveData,
  injectGuideQuests, injectRevivalQuests, injectBoardGuideQuest, onOpenBoard as onDQOpenBoard,
} from '../systems/DailyQuestSystem';
import { InputManager } from '../systems/InputManager';
import * as AmbienceSystem from '../systems/AmbienceSystem';
import { triggerTag } from '../systems/GuiXingRecordSystem';
import { triggerOnce, triggerOnceIf, hasTriggered, markTriggered } from '../systems/EventManager';
import { CHAPTER_1, setChapter, isChapterAtLeast } from '../systems/ChapterSystem';
import { unlockPhoto, isPhotoUnlocked, PHOTO_DATABASE } from '../data/PhotoAlbum';
import { MusicBoxPanel } from '../ui/MusicBoxPanel';
import { showChapterBanner } from '../ui/ChapterBanner';
import { TouchControls, setActionButtonLabel, setWaitHandler } from '../systems/TouchControls';
import { showMemoryMoment } from '../ui/MemoryMoment';
import { showStoryComplete, hideStoryCard } from '../ui/StoryNotification';
import { playMemoryFlashback } from '../ui/MemoryFlashback';
import { getShardFlashback, SHARD_PROGRESS_LINES, XIYA_LAMP_FLASHBACK, XIYA_GARDEN_FLASHBACK, ELDER_STAR_FLASHBACK, XIYA_PHOTO_FLASHBACK, PLUM_BLOOM_FLASHBACK, SHOP_CROP_ENTRY_DIALOGUE, SHOP_CROP_NEED_DIALOGUE, SHOP_CROP_DONE_DIALOGUE, SHOP_CROP_FLASHBACK, GARDENER_FIELD_FLASHBACK } from '../data/MemoryFlashbacks';
import { ShopPanel } from '../ui/ShopPanel';
import { BackpackPanel } from '../ui/BackpackPanel';
import { GiftPanel } from '../ui/GiftPanel';
import { QuestPanel } from '../ui/QuestPanel';
import { openWaitPanel, closeWaitPanel, isWaitPanelOpen } from '../ui/WaitPanel';
import { StoryDialogue } from '../ui/StoryDialogue';
import { EndingPanel } from '../ui/EndingPanel';
import { PhotoAlbumPanel } from '../ui/PhotoAlbumPanel';
import { openDiscoveryPanel, isDiscoveryPanelOpen, discoveryPanelHandleEscape } from '../ui/DiscoveryPanel';
import { openHudMenu, isHudMenuOpen, setHudMenuItems, hudMenuHandleEscape, menuIsMobile } from '../ui/HudMenuPanel';
import { ResidentBoardPanel } from '../ui/ResidentBoardPanel';
import { openMailbox, showFirstMailLetter, closeMailbox, isMailboxOpen as isMailboxPanelOpen } from '../ui/MailboxPanel';
import { getRequestById, isRequestDone } from '../systems/ResidentRequestSystem';
import {
  getStoryStep, setStoryStep, advanceStory, isTutorialDone,
  isCh1TownIntroDone, markCh1TownIntroDone,
  isObservatoryComplete, markObservatoryComplete,
  getEndingChoice, setEndingChoice, type EndingChoice, type DialogueLine,
  COLORS,
  XIYA_DIALOGUE, GATE_OPENED_DIALOGUE, SOW_SEEDS_DIALOGUE,
  WATER_CROPS_DIALOGUE, EVENING_DIALOGUE, TOWN_INTRO_DIALOGUE,
  FOREST_SHARD_DIALOGUE, FOREST_LOOKOUT_DIALOGUE, DEMO_ENDING_DIALOGUE, DEMO_ENDING_BRANCHES, DEMO_ENDING_FINALE,
  WOODCUT_TIP_DIALOGUE, MINE_TIP_DIALOGUE, XIYA_DAWN_DIALOGUE, XIYA_EVENING_DIALOGUE, XIYA_EVENING_OBS_DIALOGUE, XIYA_RIVERSIDE_DIALOGUE, XIYA_RIVERSIDE_RAIN_DIALOGUE, getGrandpaNote,
  FIRST_MORNING_RESPONSE_DIALOGUE,
  CH1_AWAKENING_DIALOGUE,
  GARDEN_RESTORED_XIYA_DIALOGUE, XIYA_SMALL_THINGS_DIALOGUE, XIYA_BUTTERFLY_SHARE_DIALOGUE,
  XIAOMEI_OBSERVE_INTRO_DIALOGUE, XIAOMEI_OBSERVE_CHOICES_DIALOGUE, XIAOMEI_OBSERVE_DETAIL_DIALOGUE, XIAOMEI_OBSERVE_DONE_DIALOGUE,
  XIAOMEI_OBSERVE_WILLOW_INTRO_DIALOGUE, XIAOMEI_OBSERVE_WILLOW_DETAIL_DIALOGUE, XIAOMEI_OBSERVE_WILLOW_DONE_DIALOGUE,
  XIAOMEI_OBSERVE_MOTH_INTRO_DIALOGUE, XIAOMEI_OBSERVE_MOTH_DETAIL_DIALOGUE, XIAOMEI_OBSERVE_MOTH_DONE_DIALOGUE,
  MARKET_STALL_HINT_DIALOGUES, MARKET_STALL_WRONG_DIALOGUES, MARKET_STALL_PLACED_DIALOGUES, MARKET_OPEN_DIALOGUE,
  OLD_HOUSE_RESTORED_DIALOGUE, FOREST_ROAD_RESTORED_DIALOGUE,
  CARPENTER_RETURN_DIALOGUE,
  ADVENTURER_WELCOME_BACK_DIALOGUE,
  XIYA_GARDEN_TRELLIS_DIALOGUE, XIYA_GARDEN_TRELLIS_DONE_DIALOGUE,
  RAIN_MUSHROOM_HINT_DIALOGUE, RAIN_FOREST_ENTRANCE_HINT_DIALOGUE,
  ELDER_TEA_QUEST_DIALOGUE, ELDER_STAR_SITE_DIALOGUE,
  XIYA_PHOTO_ENTRY_DIALOGUE, XIYA_PHOTO_DONE_DIALOGUE,
  XIYA_OLD_SHADOW_ENTRY_DIALOGUE, XIYA_OLD_SHADOW_DELIVER_DIALOGUE,
  MINER_LAMP_ENTRY_DIALOGUE, MINER_LAMP_NEED_DIALOGUE, MINER_LAMP_DONE_DIALOGUE,
  GARDENER_PLUM_ENTRY_DIALOGUE, GARDENER_PLUM_DONE_DIALOGUE,
  GARDENER_FIELD_ENTRY_DIALOGUE, GARDENER_FIELD_DONE_DIALOGUE,
  FIRST_HARVEST_DIALOGUE,
  OLD_ROBOT_DIALOGUE,
  XIYA_LETTER_OPEN_DIALOGUE, XIYA_LETTER_FLOWER_DIALOGUE, XIYA_LETTER_RECORD_DIALOGUE, XIYA_LETTER_FINAL_DIALOGUE,
  XIYA_BLOOM_S1_OPEN_DIALOGUE, XIYA_BLOOM_S2_STORAGE_DIALOGUE, XIYA_BLOOM_S3_FLOWERSTAND_DIALOGUE,
  XIYA_BLOOM_S4_MISUNDERSTAND_DIALOGUE, XIYA_BLOOM_S5_TURNING_DIALOGUE, XIYA_BLOOM_S6_VILLAGERS_DIALOGUE,
  XIYA_BLOOM_S7_FESTIVAL_DIALOGUE, XIYA_BLOOM_S8_FIREWORKS_DIALOGUE, XIYA_BLOOM_EPILOGUE_DIALOGUE,
} from '../systems/StorySystem';
import { hasSave, load, apply, save, getLastIncompatibleVersion, clearIncompatibleVersion, SAVE_VERSION, isAutoSaveSuppressed } from '../systems/SaveSystem';
import { play, isSoundEnabled, setSoundEnabled } from '../systems/AudioSystem';
import { MusicSystem } from '../audio/MusicSystem';
import { VoiceBank } from '../audio/VoiceBank';
import {
  getRobots,
  getRobotAt,
  getRobotCount,
  addRobot,
  runDailyAutomation,
  DEFAULT_ROBOT_RANGE,
  type RobotData,
} from '../systems/AutomationSystem';
import { CameraDirector } from '../modules/CameraDirector';
import { UIBus } from '../modules/UIBus';
import { WeatherDirector } from '../modules/WeatherDirector';
import { WorldDecorator } from '../modules/WorldDecorator';
import { FishingController, type FishingConfig, type FishKindConfig, type FishingSpotData, type FishingHooks } from '../modules/FishingController';
import { FarmController, type FarmHooks } from '../modules/FarmController';
import { InteractionRouter, type GateSnapshot, type InteractionCandidate, type ResolvedTarget } from '../modules/InteractionRouter';
import { StorySequenceRunner } from '../modules/StorySequenceRunner';
import { CutsceneGuard } from '../modules/CutsceneGuard';

/**
 * 移动端交互半径补偿（体验债务修复）：canTry/try* 距离门控里的交互半径，
 * 触屏设备统一放大到 ≥34px（原 20~28px 在虚拟摇杆下需毫米级停靠，真机反馈点不到）。
 * 桌面（含探针回归）行为不变。用法：`dx * dx + dy * dy <= R2(28)`。
 */
const R2 = (r: number): number => {
  const boosted = isTouchDevice() ? Math.max(r, 34) : r;
  return boosted * boosted;
};

/** MapScene 一次性/会话级 flag（需随存档持久化，防止读档后重复触发） */
export interface MapSceneFlags {
  shardDialoguePlayed: boolean;
  firstHarvestShown: boolean;
  /** v1.0 生活仪式感：第一次锄地/播种/浇水（一次性入档，读档不重复） */
  firstHoe?: boolean;
  firstPlant?: boolean;
  firstWater?: boolean;
  /** v1.1 采集体验升级：第一次砍树/挖矿的短提示（一次性入档，读档不重复） */
  firstChopHint?: boolean;
  firstMineHint?: boolean;
  /** SHOP-01 商店复兴：商店老板复兴台词已播档位（-1=未播；0/1/2 对应复兴度，档位推进才播，读档不重复） */
  shopRevivalTier?: number;
  /** 镇子商店状态：undefined=未触发关闭剧情 / 'closed'=看过关闭剧情待开店 / 'opened'=已营业
   *  旧档兼容：加载时若 shopRevivalTier≥0（已用过商店）→ 直接派生为 'opened'，不出现关闭剧情 */
  shopState?: 'closed' | 'opened';
  woodcutTipShown: boolean;
  mineTipShown: boolean;
  tutorialProgress: number;
  boundaryTipShown: boolean;
  /** P3-01 灯塔"黑"阶段：西侧海湾灯塔远景提示已看过（一次性入档，读档不重复） */
  lighthouseSeaHintShown?: boolean;
  gardenHintShown: boolean;
  shortcutHintDone: boolean;
  /** 支线试点：夏雅「院子有人照顾」（花园恢复后，旧藤架事件） */
  sideXiyaGardenAsked?: boolean;
  sideXiyaGardenDone?: boolean;
  /** 支线试点：镇长「看星星的地方」（观星夜完成后，空地事件） */
  sideElderTeaAsked?: boolean;
  sideElderStarDone?: boolean;
  /** E1/E9 每日偶遇：当天是否已触发（持久化，刷新不重复；存档审查 2026-08-06） */
  dawnXiyaDay?: number;
  eveningXiyaDay?: number;
  riversideXiyaDay?: number;
  /** P1-2 村长来访：老屋整理完成时的天数（"下一晚"判断用；读档保持） */
  ch1ElderVisitDay?: number;
  /** P1-2 村长来访态度：'help' 愿意帮忙 / 'unsure' 还没想好（集市恢复前置；读档保持） */
  ch1ElderChoice?: 'help' | 'unsure';
  /** 钓鱼 Phase 4：夏雅交换果干当天（次日河边长椅小场景判断用；读档保持） */
  fishXiyaExchangeDay?: number;
  /** 钓鱼放生彩蛋 v1.2：首次放生当天的天数（-1=从未放生；放生 2 天后河面鱼影 + 老姜台词） */
  fishReleaseDay?: number;
  /** T3 夏雅「整理旧照片」：老屋修复后，老屋门口事件（一次性入档） */
  sideXiyaPhotoAsked?: boolean;
  sideXiyaPhotoDone?: boolean;
  /** P1-3 夏雅《旧日留影》：老屋整理完成后翻柜子 → farm 老屋门口交付（一次性入档） */
  sideXiyaOldShadowAsked?: boolean;
  sideXiyaOldShadowDone?: boolean;
  /** T3 老张「矿灯」：矿洞独立点灯点（铜矿×2，一次性入档） */
  sideMinerLampAsked?: boolean;
  sideMinerLampDone?: boolean;
  /** T3 小梅「小梅花」：小镇花圃种花（环境变化，一次性入档） */
  sideGardenerPlumAsked?: boolean;
  sideGardenerPlumDone?: boolean;
  /** 花田支线：帮小梅开垦花田（farm 左上角花田，交付木材×3 → 盛开，一次性入档） */
  sideGardenerFieldAsked?: boolean;
  sideGardenerFieldDone?: boolean;
  /** T3.5 商店老板「镇子热闹了」：首次卖出作物后，白天对话触发（一次性入档） */
  sideShopCropAsked?: boolean;
  sideShopCropDone?: boolean;
  /** D-011 夏雅《春深有信·一》：剧情专线 Demo Cut（花田边剧情夏雅，4 段逐步交互，一次性入档） */
  xiyaLetterAsked?: boolean;
  xiyaLetterDone?: boolean;
  /** D-011 剧情阶段（0=未开始 / 1=开场完成 / 2=整理花苗完成 / 3=旧花种记录完成；读档恢复现场用） */
  xiyaLetterStage?: number;
  /** D-011 夏雅《春深有信·二 花期未至》：剧情专线（旧广场 9 段，stage 驱动，一次性入档） */
  xiyaBloomAsked?: boolean;
  xiyaBloomDone?: boolean;
  xiyaBloomStage?: number;
  /** 小镇计划·星光艺术展（Feature-XXX，2026-08-15 制作人拍板）：筹备/活动/永久状态 */
  artShowUnlocked?: boolean;      // 「小镇计划」已解锁（首次打开面板看过契机）
  artShowEnvStage?: number;       // 环境准备进度 0-3（展台→灯光→花艺）
  artShowMaterialsDone?: boolean; // 素材准备完成（鱼·晚餐食材）
  artShowHeld?: boolean;          // 活动当天已办（演出触发）
  artShowPerm?: boolean;          // 永久变化已落地（广场东侧艺术角）
  /** 小镇计划·秋日晒场（EventPlan 第二实例，2026-08-15 制作人拍板，设计定稿 v1.1）：筹备/当天/永久
   *  复用 mapFlags + triggerOnce 范式（对齐 artShow 字段），不新增顶层字段/不升 SAVE_VERSION。 */
  dryyardUnlocked?: boolean;      // EventPlan 已解锁（开场演出「老张提起晒场」已看过）
  dryyardEnvStage?: number;       // 环境准备进度 0-3（晒架→竹席晒篮→玉米串辣椒串）
  dryyardMaterialsDone?: boolean; // 资源准备完成（「今年的收成」已摆出）
  dryyardHeld?: boolean;          // 当天演出已触发（傍晚晒场→夜晚长桌→灯塔）
  dryyardPerm?: boolean;          // 永久变化已落地（青禾晒场）
  /** 第二章《故人远来》（2026-08-28 制作人拍板 v1.0 节拍表）：人线七节拍状态
   *  复用 mapFlags + triggerOnce 范式（对齐 dryyard/artShow），不升 SAVE_VERSION。
   *  谜团预算：仅 1 主悬念（夏雅为何认识那盏灯）+ 1 远景钩子（海平线黑点）。 */
  ch2LighthouseTalked?: boolean;  // 节拍1 村民开始注意灯塔（一次性闲聊，无新演出）
  ch2ClockFixed?: boolean;        // 节拍2 老钟修好（行为状态，老钟报时）
  ch2PierRepaired?: boolean;      // 节拍3 码头来了老船长（旧船靠岸完成，码头添生活）
  ch2StrangerSeen?: number;       // 节拍4 旅人已见次数 0-3（跨天累计；看见即可，不追不等）
  ch2NightTalkDone?: boolean;     // 节拍5 码头夜谈完成（全章情绪高潮）
  ch2XiyaSecretDone?: boolean;    // 节拍6 夏雅秘密（主悬念留白）
  ch2BlackDotSeen?: boolean;      // 节拍7 海平线黑点已看（第三章唯一硬钩子）
  /** 邮箱系统（2026-08-15 制作人拍板）：grandpa_gift_opened 后解锁；信件随存档持久 */
  mailUnlocked?: boolean;         // 是否解锁（收到爷爷的信后）
  mailLastDay?: number;           // 上次来信的游戏天数（-1=未来过）
  mailNextDay?: number;           // 下次来信计划天数（2-3 天随机）
  mailQueue?: string[];           // 未读信 id 队列（最多 6）
  mailRead?: string[];            // 已读信 id 列表（归档回看）
}

/** 存档中保存的 MapScene flag（模块级暂存，apply 时写入，MapScene.create 时消费） */
let _pendingMapFlags: MapSceneFlags | null = null;

/** SaveSystem 调用：获取当前 MapScene 实例的 flag（用于序列化） */
export function getMapSceneFlags(): MapSceneFlags | null {
  return _pendingMapFlags;
}

/** SaveSystem 调用：存档中恢复的 flag（暂存，等 MapScene.create 消费） */
export function setPendingMapFlags(flags: MapSceneFlags): void {
  _pendingMapFlags = flags;
}

/** MapScene.create 调用：取出并清除暂存 flag */
export function consumePendingMapFlags(): MapSceneFlags | null {
  const flags = _pendingMapFlags;
  _pendingMapFlags = null;
  return flags;
}

interface SceneInitData {
  spawn?: { x: number; y: number };
}

/** 农田格子的视觉对象：土地底色 + 作物标记 */
interface TileVisual {
  plot: Phaser.GameObjects.Image;
  crop: Phaser.GameObjects.Image;
}

/** 集市摊位类型（第一章 P2-1 Phase 2 布置玩法）：tool 工具摊（老张·靠路边）/ food 小吃摊（小梅·中间聚人气）/ flower 花摊（夏雅·老树旁） */
type MarketStallType = 'tool' | 'food' | 'flower';

/**
 * 通用地图场景
 * 一个类承载 4 个区域（农场/小镇/森林/矿洞），通过 scene key 决定加载哪张地图。
 * 玩家走到出口区域 → 切换到目标场景并放置在对应出生点。
 */
export class MapScene extends Phaser.Scene {
  // 模块级 beforeunload 回调引用（避免重复注册）
  private static _beforeUnload: (() => void) | null = null;
  // 页面可见性变化时环境音停/恢复（隐藏停省电，回前台按当前地图恢复）
  private static _visibilityHandler: (() => void) | null = null;
  // 当前活跃实例引用（供 SaveSystem 获取 flag）
  private static _current: MapScene | null = null;
  
  // === P6b 调试用：静态 tiles Map，避免 Vite HMR 模块分裂问题 ===
  // 注意：这是临时调试方案，正式版本应修复 FarmState 模块分裂问题
  private static _debugTiles: Map<string, TileState> | null = null;
  
  /** 获取调试用 tiles Map（懒初始化） */
  public static get debugTiles(): Map<string, TileState> {
    if (!MapScene._debugTiles) {
      MapScene._debugTiles = new Map<string, TileState>();
    }
    return MapScene._debugTiles;
  }

  // === P1 CameraDirector 注入 ===
  private cameraDirector!: CameraDirector;
  // === P2 UIBus 注入（面板实例所有权从 MapScene 迁移到 UIBus）===
  private uiBus!: UIBus;
  // === P3 WeatherDirector 注入 ===
  private weatherDirector!: WeatherDirector;
  // === P4 WorldDecorator 注入 ===
  private worldDecorator!: WorldDecorator;
  // === P5a FishingController 注入（纯视觉方法）===
  private fishingController!: FishingController;
  // === P6a FarmController 注入（纯视觉方法）===
  private farmController!: FarmController;
  private readonly interactionRouter = new InteractionRouter();
  // === P7c-b StorySequenceRunner 注入（对话序列编排）===
  private storySequenceRunner = new StorySequenceRunner();
  // === P8 CutsceneGuard 注入（场景演出状态守卫）===
  private readonly cutsceneGuard = new CutsceneGuard();

  /**
   * P7c-b 统一对话播放入口
   * 所有原 storyDialogue.play(lines, onComplete, onChoice) 调用应迁移到此方法
   * 内部通过 StorySequenceRunner 编排，支持自动创建 StoryDialogue
   */
  public playStory(
    lines: DialogueLine[],
    onComplete?: () => void,
    onChoice?: (index: number) => void,
    seqId?: string,
  ): boolean {
    // 确保 storyDialogue 已创建
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    // 设置到 runner
    this.storySequenceRunner.setDialogue(this.storyDialogue);
    // 通过 runner 统一播放
    return this.storySequenceRunner.playRaw(lines, onComplete, onChoice, seqId);
  }

  /** 实机试玩埋点：钓鱼会话统计（window.debug.fishingStats 读取；会话级计数不入档） */
  public getFishingStats(): ReturnType<FishingController['getStats']> {
    return this.fishingController.getStats();
  }

  private readonly mapKey: string;
  private player!: Player;
  private wallsLayer!: Phaser.Tilemaps.TilemapLayer;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private spawn: { x: number; y: number } | undefined;
  // 切换中标记，防止同一帧重复触发
  private transitioning = false;
  // create 阶段是否抛错（抛错时显示错误遮罩并停止更新，避免黑屏）
  private createFailed = false;

  /**
   * 第三章幕一：灯塔出口解锁判定（制作人 2026-08-31 指令"继续制作第三章内容 包括新地图"，
   * 按方向稿 §七 建议方案执行：门槛=第二章全节拍完成；后续可由制作人调整门槛节点）。
   * 灯塔未来内容预埋方案 §四 的"第三层开放"落地。
   */
  private isLighthouseUnlocked(): boolean {
    return hasTriggered('ch2_black_dot');
  }

  /** 出口是否对玩家开放（locked 出口默认关闭；灯塔出口按幕一门禁放行） */
  private isExitOpen(ex: { locked?: boolean; target: string }): boolean {
    if (!ex.locked) return true;
    return ex.target === 'lighthouse' && this.isLighthouseUnlocked();
  }
  // 农田格子视觉对象（仅 farm 场景使用），key = "col,row"
  private tileRects = new Map<string, TileVisual>();
  // 输入管理器（统一键盘/触屏输入，Player 和交互共用）
  private inputManager!: InputManager;
  // 触屏控件（摇杆+交互按钮，DOM 单例，PC 和手机都显示）
  private touchControls!: TouchControls;
  // 商店面板（Phase 0.2，DOM 覆盖层，非独立场景）
  // P2: 所有权迁移到 UIBus，此为 getter 代理（零调用点修改）
  // 注：shopPanel 在 createScene 中必定初始化，getter 返回非空
  private get shopPanel(): ShopPanel { return this.uiBus.shopPanel!; }
  // 背包面板（Phase 0.25，DOM 覆盖层，B 键开启）
  private get backpackPanel(): BackpackPanel { return this.uiBus.backpackPanel!; }
  private get questPanel(): QuestPanel { return this.uiBus.questPanel!; }
  // DOM HUD 元素（替代 Phaser 文本，避免 scrollFactor + zoom 渲染问题）
  private hudDom!: HTMLDivElement;
  private hudTimeDom!: HTMLDivElement;
  private hudAreaDom!: HTMLDivElement;
  private hudQuestDom!: HTMLDivElement;
  // XP 经验条 DOM 元素
  private xpBarFill!: HTMLDivElement;
  private xpBarLabel!: HTMLDivElement;
  // 农田选中高亮（淡黄色边框，显示当前面向的格子）
  private targetHighlight!: Phaser.GameObjects.Rectangle;
  // 种植区域交互优化 v0.1：Plot 区域高亮（Graphics：半透明填充 + 描边 + 四角装饰）
  // 教程完成后替代单格高亮，显示玩家面向的整块农田
  private plotHighlight!: Phaser.GameObjects.Graphics;
  // Plot 点击反馈（plotId → 至 plotFlashUntil 短暂高亮，对应原单格 tapFlash）
  private plotFlashId: FarmPlotId | null = null;
  private plotFlashUntil = 0;
  // E-11 农场批量操作反馈（2026-08-10 制作人拍板：方案 A+成长感）：
  // 批量操作数据瞬间完成，视觉分批渐进揭示（"让大规模劳动被看见"）；
  // 可跳过（再次交互即完成）/ 会话内同类第 2 次起加速 / 不阻塞玩家移动。数据无异步，切场景零风险。
  private batchReveal: {
    plotId: FarmPlotId;
    type: 'till' | 'plant' | 'water' | 'harvest';
    tiles: { col: number; row: number }[];
    idx: number;
    step: number;
    total: number;
    parts: string;
    timer: Phaser.Time.TimerEvent | null;
  } | null = null;
  // 会话加速计数：同类批量操作第 2 次起演出时长减半（scene 生命周期，不入档）
  private batchSessionCount: Partial<Record<'till' | 'plant' | 'water' | 'harvest', number>> = {};
  // 上一帧时间戳（ms），用于计算 dt 调用 TimeSystem.tick
  private lastFrameTime = 0;
  // 当前场景中的 NPC 列表（create 时从 NPCSystem 查询并创建 sprite）
  private npcList: NPC[] = [];
  // 对话框（靠近 NPC 按 E 显示，3 秒后消失）
  private dialogueText: Phaser.GameObjects.Text | null = null;
  // 对话框消失计时器
  private dialogueTimer: Phaser.Time.TimerEvent | null = null;
  // 森林采集点：星之碎片（accepted 状态时显示，采集后销毁）
  private shardSprite: Phaser.GameObjects.Ellipse | null = null;
  // VIS-01 星之碎片视觉升级：外光晕/旋转星芒/浮游微光粒子
  private shardGlow: Phaser.GameObjects.Ellipse | null = null;
  private shardStar: Phaser.GameObjects.Graphics | null = null;
  private shardParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private shardTweens: Phaser.Tweens.Tween[] = [];
  // 镇长家/小镇视觉升级：室内暖炉辉光/浮尘/门口柔光、小镇炊烟/窗灯/落叶
  private elderHouseGlow: Phaser.GameObjects.Ellipse | null = null;
  private elderHouseDoorGlow: Phaser.GameObjects.Ellipse | null = null;
  private elderHouseDust: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private townSmoke: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private townLeaves: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private townWindows: Phaser.GameObjects.Ellipse[] = [];
  /** 青禾镇生活化升级：装饰/小动物/晨雾/萤火虫计数（验收探针读取，纯统计无逻辑） */
  public townLife = { decor: 0, wildlife: 0, fog: 0, fireflies: 0 };
  // 2026-08-07 前景遮挡层计数（并入 decor）；猫事件反馈：靠近过的猫集合（幂等，防止反复触发）
  private townCatReacted = new Set<string>();
  /** 镇上的猫（靠近触发尾巴摆动事件，update 轮询） */
  private townCats: Array<Phaser.GameObjects.Container & { _catKey: string }> = [];
  // 森林碎片对话已播放（首次交互先播对话，结束后自动采集）
  private shardDialoguePlayed = false;
  // 睡觉判定格集合：house 场景为真实床铺（Ground gid 9）；farm 场景为木屋地板（Walls gid 6）
  // 说明：教程提示"回到床前按 E 睡觉"显示在 farm，玩家在木屋内按 E 也应能睡（无需先进屋）
  private bedTiles = new Set<string>();
  // 防重复睡觉：移动端触屏双击发防护（touchstart→mousedown 跨帧触发两次 trySleep）
  private sleeping = false;
  // 矿洞矿脉精灵列表（mine 场景，id → sprite）
  private oreSprites: { deposit: OreDeposit; sprite: Phaser.GameObjects.Image }[] = [];
  // v1.1 采集体验升级：矿脉裂纹图形（deposit.id → graphics，击打第 2 击出现）
  private oreCracks = new Map<string, Phaser.GameObjects.Graphics>();
  // 农场树木精灵列表（farm 场景，key = "col,row"）
  private treeSprites = new Map<string, Phaser.GameObjects.Image>();
  // 树视觉升级：成片装饰树丛（纯视觉 Graphics，无碰撞；供探针验证）
  private groveTrees: Phaser.GameObjects.Graphics[] = [];
  // 居民需求系统升级：需求交付世界变化（纯视觉 Graphics，幂等渲染 + 探针验证用）
  private reqFlowerTrellisGfx: Phaser.GameObjects.Graphics | null = null;
  private reqDoorFrameGfx: Phaser.GameObjects.Graphics | null = null;
  private reqLanternGfx: Phaser.GameObjects.Graphics | null = null;
  private reqStoveGfx: Phaser.GameObjects.Graphics | null = null;
  private reqFishBasketGfx: Phaser.GameObjects.Graphics | null = null;
  // v1.1 采集体验升级：树干裂纹图形（key = "col,row"，击打第 2 击出现）
  private treeCracks = new Map<string, Phaser.GameObjects.Graphics>();
  // 首次引导标志
  private woodcutTipShown = false;
  private mineTipShown = false;
  // 未开放区域边界提示（P1）：靠近世界边界（非出口）轻提示一次；离开边界带后重置
  private boundaryTipShown = false;
  // P3-01 灯塔"黑"阶段：西侧海湾灯塔远景提示已看过（一次性，随 mapFlags 入档，读档不重复）
  private lighthouseSeaHintShown = false;
  // 当前选中的种子类型（R 键切换，用于播种）
  private selectedCropType: CropType = 'radish';
  // 种子类型切换冷却（防连发）
  private seedSwitchCooldown = 0;
  // 种子选择器 DOM
  private seedSelectorEl: HTMLDivElement | null = null;
  // 农场触屏：种子切换按钮（点击弹作物选择器预选播种作物；桌面用 R 键）
  private seedSwitchBtn: HTMLDivElement | null = null;
  // 作物选择器（预选播种作物，不播种）
  private cropPickerEl: HTMLDivElement | null = null;
  /** 作物选择器的 ESC 处理器引用（closeCropPicker 统一移除，防泄漏） */
  private cropPickerEscHandler: ((e: KeyboardEvent) => void) | null = null;
  /** SHUTDOWN 清理钩子是否已安装（每实例一次，防 events.on 跨 create 累积） */
  private shutdownHooksInstalled = false;
  // 移动端点击种田：点击操作后的短暂反馈高亮（key = "col,row"，至 tapFlashUntil 过期）
  private tapFlashKey = '';
  private tapFlashUntil = 0;
  // 剧情对话 UI
  private storyDialogue: StoryDialogue | null = null;
  // FEATURE-038 居民需求板（小镇广场右侧信息板交互物 + DOM 面板）
  private residentBoardMark: Phaser.GameObjects.Container | null = null;
  // P2: 所有权迁移到 UIBus（惰性创建，调用处已用 if(!panel) 守卫）
  private get residentBoardPanel(): ResidentBoardPanel { return this.uiBus.residentBoardPanel!; }
  // P1 家的音乐盒（老屋音乐盒交互物 + DOM 曲目面板，OST 收藏系统）
  private musicBoxMark: Phaser.GameObjects.Container | null = null;
  // P2: 所有权迁移到 UIBus（惰性创建）
  private get musicBoxPanel(): MusicBoxPanel { return this.uiBus.musicBoxPanel!; }
  /** 音乐盒首次打开的仪式感（会话级，不入档）：第一次先浮字台词再弹面板 */
  private musicBoxIntroduced = false;
  // P0 爷爷的归星包裹（2026-08-11）：老屋（house）旧木箱交互物 + 包裹面板；一次性 triggerOnce('grandpa_gift_opened')
  private grandpaGiftMark: Phaser.GameObjects.Container | null = null;
  // P2: 所有权迁移到 UIBus（惰性创建）
  private get grandpaGiftPanel(): GiftPanel { return this.uiBus.grandpaGiftPanel!; }
  /** 爷爷包裹交互基准坐标（house 木箱 L1-4 装饰位置中心） */
  private grandpaGiftPos: { x: number; y: number } = { x: 0, y: 0 };
  // 第一章 P1-1 老屋整理（2026-08-12 垂直切片）：4 个整理交互点（旧床/灯/书桌/收音机）
  // 零数值、零新资产、零新增存档字段：状态 = EventManager.triggerOnce('ch1_*_done')，随存档持久化。
  // 每次进入 house 由 setupHouseTidy() 重建：已完成点画"整理后"视觉（done），未完成点挂交互标记（mark）。
  private houseTidy: Array<{
    key: 'bed' | 'lamp' | 'desk' | 'radio';
    pos: { x: number; y: number };
    mark: Phaser.GameObjects.Container | null;
    done: Phaser.GameObjects.Graphics | null;
    glow: Phaser.GameObjects.Ellipse | null;
  }> = [];
  /** 老屋整理靠近提示（DOM，会话级；对齐 oldTreeInteractHint 范式） */
  private houseTidyInteractHint: HTMLDivElement | null = null;
  // 第一章 P2 钓鱼 Phase 1（2026-08-14，制作人 Decision Override 启动）：
  // 纯手感原型——一个钓点（S6 老河堤）+ 一种鱼（青禾鲫）+ 状态机会话级（刷新即丢，零新存档字段）。
  // 状态机：idle → casting → waiting → fakeBite/realBite → success/fail → idle
  // 复用：MapScene.tryInteract 范式 + DOM hint（参照 oldTree）+ Graphics 视觉 + AudioSystem.play
  // 红线：不新建 FishingManager/FishingSaveSystem/FishingInventory/FishingUIManager
  /** 钓鱼状态机当前状态（代理 FishingController） */
  private get fishingState(): 'idle' | 'casting' | 'waiting' | 'fakeBite' | 'realBite' | 'success' | 'fail' {
    return this.fishingController.getState();
  }
  /** 钓点位置（当前场景当前激活钓点；S6 老河堤长椅 (6,15) 西侧水边） */
  private fishingSpotPos: { x: number; y: number } = { x: 0, y: 0 };
  /** 浮漂位置（水中，钓点西侧水面） */
  private floatPos: { x: number; y: number } = { x: 0, y: 0 };
  /** 多钓点表（2026-08-14 钓鱼扩展：town 普通 / farm 稀有）。
   *  key=场景，pos=玩家站钓点、floatPos=浮漂落点、tier='common'普通水域 / 'rare'稀有钓点（可钓高级鱼）。 */
  private static readonly FISHING_SPOTS: Record<string, { pos: { x: number; y: number }; floatPos: { x: number; y: number }; tier: 'common' | 'rare' }> = {
    town: { pos: { x: 5.5 * TILE_SIZE, y: 12 * TILE_SIZE + TILE_SIZE / 2 }, floatPos: { x: 3 * TILE_SIZE + TILE_SIZE / 2, y: 13 * TILE_SIZE + TILE_SIZE / 2 }, tier: 'common' },
    farm: { pos: { x: 31 * TILE_SIZE + TILE_SIZE / 2, y: 18 * TILE_SIZE + TILE_SIZE / 2 }, floatPos: { x: 32 * TILE_SIZE + TILE_SIZE / 2, y: 20 * TILE_SIZE + TILE_SIZE / 2 }, tier: 'rare' },
    // 青禾河畔：码头旁普通钓点（河流 rows 9-13；码头在 (5,20) 附近，站码头边甩竿）
    qinghe_river: { pos: { x: 5 * TILE_SIZE + TILE_SIZE / 2, y: 19 * TILE_SIZE + TILE_SIZE / 2 }, floatPos: { x: 6 * TILE_SIZE + TILE_SIZE / 2, y: 12 * TILE_SIZE + TILE_SIZE / 2 }, tier: 'common' },
  };
  /**
   * 表现层实验（2026-08-14 制作人方向：Phaser 视觉上限验证，先于 Godot 判断）。
   * 四项：① 夜晚压暗 overlay + 火光 Add 光 ② 火星/萤火虫粒子 ③ 前景遮挡 ④ 镜头呼吸微动。
   * 范围：town 夜晚 + 阿风烤鱼交换已触发；验收通过后推广为统一视觉语言。
   */
  private static readonly NIGHT_VISUAL_EXPERIMENT = true;
  /** 钓点水面常驻标识（浮漂/涟漪/光斑；钓鱼开始时隐藏避免与钓鱼浮漂重叠） */
  private fishingSpotWaterMark: Phaser.GameObjects.Container | null = null;
  // P5b: fishingInteractHint / fishingReelHint 已迁移至 FishingController
  // ═══════════ 钓鱼老人 老姜（氛围锚点，2026-08-14 制作人拍板）═══════════
  // 定位：青禾镇最后一个还坚持每天去河边坐一下午的人。不是任务机器。
  // 视觉：程序绘制草帽大叔（零素材，见 setupRiverbankLife ⑬）；场景锚定交互（非 NPCSystem 注册）。
  // 作息：13:00-17:00 在 S6 河堤坐着钓鱼，其余时段收竿回家（视觉显隐 + 交互门禁）。
  // 功能：教学（简单直白）/ 鱼种评价（一次性每种）/ 《钓鱼修行》小事件（三鱼入门 → 旧鱼竿）/ 复兴台词 / 老婆轻吐槽。
  private laoJiangGfx: Phaser.GameObjects.Graphics | null = null;
  private laoJiangLabel: Phaser.GameObjects.Text | null = null;
  // P5b: fishingInteractHint / fishingReelHint / laoJiangHint 已迁移至 FishingController
  private readonly laoJiangPos = { x: 84, y: 232 };
  private static readonly LAO_JIANG_RANGE = 30;
  /** 老姜当前显隐状态（避免 update 每帧重复 setVisible） */
  private laoJiangPresent = false;
  // ═══════════ 阶段3 光照：town 黄昏暖光（2026-08-14，执行方案 §3 光照表现）═══════════
  // 依据《青禾镇美术质感升级执行方案-v0.1》阶段3 + 《钓鱼点宣传级美术方向》17:00 暖黄夕阳。
  // 范围：仅 town，17:00-19:00 生效；全屏暖橙 ADD overlay（depth 4.5，盖地面/装饰≤4，不盖 NPC/玩家，同 farm 范式）
  // + 顶部天空渐变（ADD）+ 河面暖光斑呼吸（"水面上有光"）。
  private townDuskOverlay: Phaser.GameObjects.Rectangle | null = null;
  private townDuskSkyGlow: Phaser.GameObjects.Graphics | null = null;
  private townDuskGlints: Phaser.GameObjects.Graphics | null = null;
  /** 夜晚月光冷色（normal blend 压暗 + 偏冷；depth 4.5，不盖 NPC/玩家） */
  private townNightCool: Phaser.GameObjects.Rectangle | null = null;
  /** 白天太阳方向感：左上→右下暖色渐变（极弱，ADD），模拟单一光源方向 */
  private townDaySun: Phaser.GameObjects.Graphics | null = null;
  private townDuskLastHour = -1;
  // ═══════════ 小镇计划·星光艺术展（Feature-XXX，2026-08-15 制作人拍板）═══════════
  // 定位：小镇第一次主动准备迎接外界目光的生活事件；验证循环「生活事件 → 玩家参与 → 世界变化 → 永久留下痕迹」。
  // 零新系统：状态走 MapSceneFlags（随存档） + triggerOnce；面板/演出/物件全部程序化。
  private artShowUnlocked = false;
  private artShowEnvStage = 0;        // 0-3：展台→灯光→花艺
  private artShowMaterialsDone = false; // 鱼（晚餐食材）已备
  private artShowHeld = false;
  private artShowPerm = false;
  // P8: 委托给 CutsceneGuard
  private set inArtShowCutscene(v: boolean) { v ? this.cutsceneGuard.begin('art_show') : this.cutsceneGuard.end('art_show'); }
  private get inArtShowCutscene() { return this.cutsceneGuard.isActive('art_show'); }
  private artShowSprites: Phaser.GameObjects.GameObject[] = [];
  private artShowBox: Phaser.GameObjects.Container | null = null; // 素材箱（交付点）
  private artShowXiya: Phaser.GameObjects.Sprite | null = null;   // 筹备期广场夏雅（策划）
  /** 星光艺术展余波：庆典后白天在艺术角照看展台的夏雅（会话级，随场景重建） */
  private artShowAfterXiya: Phaser.GameObjects.Sprite | null = null;
  private artShowAfterXiyaLabel: Phaser.GameObjects.Text | null = null;
  private artShowHint: HTMLDivElement | null = null;              // 素材箱/夏雅靠近提示
  // 星光艺术展余波：旅人回访（艺术展办完后，白天/傍晚坐艺术角长椅看自己的展品）
  private artShowTravelerGfx: Phaser.GameObjects.Graphics | null = null;
  private artShowTravelerLabel: Phaser.GameObjects.Text | null = null;
  private artShowTravelerHint: HTMLDivElement | null = null;
  private readonly artShowTravelerPos = { x: 516, y: 322 };       // 长椅 (512,322) 上落座
  // ══════ 秋日晒场（EventPlan 第二实例，2026-08-15 制作人拍板 · 设计定稿 v1.1 · 台词定稿 v0.3）══════
  private dryyardUnlocked = false;
  private dryyardEnvStage = 0;        // 0-3：晒架→竹席晒篮→玉米串辣椒串
  private dryyardMaterialsDone = false; // 「今年的收成」已摆出
  private dryyardHeld = false;
  private dryyardPerm = false;
  // P8: 委托给 CutsceneGuard
  private set inDryyardCutscene(v: boolean) { v ? this.cutsceneGuard.begin('dryyard') : this.cutsceneGuard.end('dryyard'); }
  private get inDryyardCutscene() { return this.cutsceneGuard.isActive('dryyard'); }
  private dryyardSprites: Phaser.GameObjects.GameObject[] = [];   // 演出期临时精灵
  private dryyardBox: Phaser.GameObjects.Container | null = null; // 征集筐（交付点）
  private dryyardXiya: Phaser.GameObjects.Sprite | null = null;   // 筹备期晒场夏雅（旧照片）
  private dryyardXiyaLabel: Phaser.GameObjects.Text | null = null;
  /** 永久期晒场老张（白天停留照看晒架；收成时令台词） */
  private dryyardLaozhang: Phaser.GameObjects.Sprite | null = null;
  private dryyardLaozhangLabel: Phaser.GameObjects.Text | null = null;
  private dryyardHint: HTMLDivElement | null = null;              // 征集筐/夏雅/老张靠近提示
  /** 会话级：晒场环境物件已构建到第几阶段（幂等，避免重复 add） */
  private dryyardEnvBuilt = 0;
  private townPlanPanel: HTMLDivElement | null = null;            // 「小镇计划」只读面板
  // ══════ 第二章《故人远来》（2026-08-28 制作人拍板 v1.0 节拍表 · 7 节拍人线）══════
  private ch2LighthouseTalked = false;   // 节拍1 村民注意灯塔（一次性闲聊）
  private ch2ClockFixed = false;         // 节拍2 老钟修好（行为状态）
  private ch2PierRepaired = false;       // 节拍3 老船长靠岸完成
  private ch2StrangerSeen = 0;           // 节拍4 旅人已见次数 0-3
  private ch2NightTalkDone = false;      // 节拍5 夜谈完成
  private ch2XiyaSecretDone = false;     // 节拍6 夏雅秘密
  private ch2BlackDotSeen = false;       // 节拍7 黑点已看
  private ch2CaptainGfx: Phaser.GameObjects.Graphics | null = null;   // 老船长剪影（qinghe_river）
  private ch2BoatGfx: Phaser.GameObjects.Graphics | null = null;      // 码头旧船 + 船灯
  private ch2LighthouseGfx: Phaser.GameObjects.Graphics | null = null; // qinghe 远处灯塔（scrollFactor 0）
  private ch2StrangerGfx: Phaser.GameObjects.Graphics | null = null;  // 旅人剪影（会话级）
  private ch2StrangerLabel: Phaser.GameObjects.Text | null = null;
  private ch2StrangerDay = -1;            // 会话级：当天旅人是否已刷（跨天刷新，不追不等）
  private ch2StrangerAlive = false;       // 本次刷出的旅人是否还在场
  private ch2StrangerSpawnAt = 0;         // 刷出时刻（>10s 未靠近即消失）
  private ch2ChimeKeys = new Set<string>(); // 整点报时去重（会话级，跨小时不重复）
  private ch2NightTalkActive = false;     // 夜谈演出中（防重入）
  private ch2NightTalkOwed = false;       // 夜谈"欠播"（标记已打未完成；被打断后补播，不入档）
  private ch2PierLifeGfx: Phaser.GameObjects.GameObject[] = []; // 节拍3 码头生活剪影（修复后常驻）
  private ch3KeeperGfx: Phaser.GameObjects.Graphics | null = null; // 幕一 执灯人剪影
  private ch3ArrivalQueued = false; // 幕一 初见演出已入队（防重入；未标记前可重试）
  private ch3BellGfx: Phaser.GameObjects.Graphics | null = null;  // 幕二 铜铃
  private ch3TelescopeActive = false;                              // 幕二 望远镜观察模式防重入
  private ch3KeeperTalkCount = 0;                                  // 幕二 执灯人日常轮换（会话级）
  private ch3ShipGfx: Phaser.GameObjects.GameObject[] = [];   // 幕三 外来船常驻视觉
  private ch3StrangerNpcGfx: Phaser.GameObjects.GameObject[] = []; // 幕三 旅人常驻剪影
  private ch3ShipQueued = false;       // 幕三 靠岸演出已入队（防重入）
  private ch3ShipOwed = false;         // 幕三 靠岸演出欠播（被打断后补播）
  private ch3StrangerTalkCount = 0;    // 幕三 旅人日常轮换（会话级）
  private ch3PhotoPinnedGfx: Phaser.GameObjects.Graphics | null = null; // 幕三后半 照片钉柱（D-012 痕迹）
  private ch3ArchiveVisual: Phaser.GameObjects.Graphics | null = null; // 幕三后半 B 机位（未拍才显示）
  private ch3MeetQueued = false;  // 幕三后半 碰面演出已入队
  private ch3MeetOwed = false;    // 幕三后半 碰面演出欠播
  private ch3ShardGfx_lh: Phaser.GameObjects.Graphics | null = null; // 幕四 碎片（灯塔内）
  private ch3ShardGfx_qh: Phaser.GameObjects.Graphics | null = null; // 幕四 碎片（栈板尽头）
  private ch3ShardGfx_fm: Phaser.GameObjects.Graphics | null = null; // 幕四 碎片（海湾缺口）
  private ch3FinaleQueued = false;      // 幕四 结算演出已入队
  private ch3FinaleOpenQueued = false;  // 幕五 归位窗口开启演出已入队
  private ch3BoardPhotoGfx: Phaser.GameObjects.Graphics | null = null; // 幕三后半 需求板旁小照片
  private ch3TownReactQueued = false; // 幕三后半 镇民注脚已入队（防重入）
  private ch3TownReactOwed = false;   // 幕三后半 镇民注脚欠播（被打断后补播）
  private ch2NightTalkFX: Phaser.GameObjects.GameObject[] = []; // 夜谈灯光（演出期）
  private ch2Hint: HTMLDivElement | null = null;  // 老钟/老船长靠近提示
  /** 第二章位置表（静态常量；qinghe 码头即玩家修的青禾码头 pos(88,328) 西侧） */
  static CH2 = {
    clock: { x: 330, y: 150 },   // town 广场西南空地（避开集市摊位锚点）
    market: { x: 408, y: 80 },   // town 集市广场（节拍1 人流处）
    boat: { x: 62, y: 332 },     // qinghe_river 码头西侧水面（旧船）
    captain: { x: 74, y: 330 },  // 码头边老船长（蹲修）
    stranger: [                  // 旅人三次出现点（town/farm 轮换，看见即可）
      { scene: 'town', x: 344, y: 184 },
      { scene: 'farm', x: 180, y: 320 },
      { scene: 'town', x: 486, y: 144 },
    ],
    lighthouse: { x: 168, y: 112 }, // qinghe 远处灯塔（scrollFactor 0，入海口方向）
  };
  // 第三章 幕一/幕二 灯塔内坐标（lighthouse.json 30x20；TILE_SIZE=16）
  private static _CH3: {
    keeper: { x: number; y: number };
    bell: { x: number; y: number };
    ship: { x: number; y: number };
    strangerNpc: { x: number; y: number };
    arcTown: { x: number; y: number };
    arcFarm: { x: number; y: number };
    arcLh: { x: number; y: number };
  } | null = null;
  static get CH3() {
    if (!MapScene._CH3) {
      MapScene._CH3 = {
    keeper: { x: 13.4 * 16, y: 10.2 * 16 }, // 执灯人（塔基旁，setupCh3Keeper 绘制）
    bell: { x: 17.0 * 16, y: 9.6 * 16 },    // 铜铃（灯室下方檐下，tryCh3BellInteract）
    ship: { x: 150, y: 352 },               // 幕三 外来船（qinghe_river 码头东南水面）
    strangerNpc: { x: 120, y: 332 },        // 幕三 旅人（码头常驻，靠岸后）
    arcTown: { x: 34 * 16, y: 15.5 * 16 },  // 幕三后半 B 机位：集市东南空地
    arcFarm: { x: 11 * 16, y: 19.5 * 16 },  // 幕三后半 B 机位：farm 老屋门前
    arcLh: { x: 12 * 16, y: 9.5 * 16 },     // 幕三后半 B 机位：灯塔塔基西侧
      };
    }
    return MapScene._CH3;
  }
  /** 幕三后半 三机位定义（场景→事件→注脚；B 拍完收摊，机位撤除） */
  private static readonly CH3_ARCHIVE = [
    { mapKey: 'town', ev: 'ch3_archive_town', note: '（三脚架对着重开的集市。标签：集市，第 3 卷。）' },
    { mapKey: 'farm', ev: 'ch3_archive_farm', note: '（三脚架对着修好的老屋。标签：老屋，第 3 卷。）' },
    { mapKey: 'lighthouse', ev: 'ch3_archive_lh', note: '（三脚架对着灯塔。标签：灯，第 1 卷。）' },
  ];

  // 第一章 P2 生活采集 Phase 1（2026-08-14 设计稿 v0.1）：
  // 6 种采集物（蒲公英/野莓/野蘑菇/小野花/小树枝/河螺）× farm/town/forest/qinghe_river 四场景手工分布。
  // 河螺为条件资源（仅雨天出现，2026-08-16 天气扩面）；视觉：程序合成小群落（2-4 株），不均匀刷点（§七/§八）；零资产。
  // 存档：复用 triggerOnce 持久化每个采集点"已采"状态，不新增顶层字段（§十五）。
  /** 当前场景的采集点实例（视觉容器 + 已采状态，会话级；状态由 triggerOnce 持久化） */
  private gatherNodes: {
    def: GatherPointDef;
    container: Phaser.GameObjects.Container;
    collected: boolean;
  }[] = [];
  /** 采集靠近提示（DOM，会话级；对齐 fishingInteractHint 范式） */
  private gatherInteractHint: HTMLDivElement | null = null;
  /** 当前靠近中的采集点索引（tryInteract 时定位用；-1=无） */
  private nearestGatherIdx: number = -1;
  /** 夜晚疲劳提示（P0 §3.2）：21:00 后首次交互弹一句"天色晚了"，不强制；记录提示时的分钟用于去重 */
  private nightFatigueHintShownMinute: number = -1;
  /** P0.5 世界规律引导：第一场雨提示（farm，会话级防重复，事件级 triggerOnce 持久化） */
  private rainHintDone = false;
  /** P0.5 世界规律引导：雨天进森林环境暗示（farm 同范式） */
  private rainForestHintDone = false;
  /** 青禾河畔：码头修复交互点（木材×20 → 码头出现；triggerOnce 持久化，读档恢复） */
  private qinghePierRestore: { pos: { x: number; y: number }; mark: Phaser.GameObjects.Container | null; restored: boolean } | null = null;
  /** 青禾河畔：凉亭停留空间（视觉 + 交互锚点） */
  private qinghePavilion: { pos: { x: number; y: number }; mark: Phaser.GameObjects.Text | null } | null = null;
  /** 青禾河畔：码头靠近提示（DOM，会话级） */
  private qinghePierHint: HTMLDivElement | null = null;
  /** 青禾河畔：凉亭靠近提示（DOM，会话级） */
  private qinghePavilionHint: HTMLDivElement | null = null;
  /** 青禾河畔 Stage 2：长椅/NPC 聚集（集市恢复后出现；会话级视觉 + triggerOnce 台词） */
  private qingheStage2Gfx: Phaser.GameObjects.GameObject[] = [];
  private qingheChatterHint: HTMLDivElement | null = null;
  /** 青禾河畔·果园预埋：断桥旁老周（npc_carpenter，白天出现；一次性台词） */
  private qingheOldMan: Phaser.GameObjects.Sprite | null = null;
  private qingheOldManLabel: Phaser.GameObjects.Text | null = null;
  private qingheOldManHint: HTMLDivElement | null = null;
  /** 需求板引导（首次靠近提示，会话级，不入档） */
  private residentBoardHintShown = false;
  // 教程：大门墙壁（物理矩形，钥匙使用后销毁）
  private gateWall: Phaser.GameObjects.Rectangle | null = null;
  // gate 美术升级：叠加在大门物理墙上的像素风双扇木门视觉（随 gateWall 一起销毁）
  private gateDoorVisual: Phaser.GameObjects.Container | null = null;
  // gate 美术升级：夜间门柱暖光（复用 town 窗灯模式）
  private gateLampGlows: Phaser.GameObjects.Ellipse[] = [];
  /** gate 美术升级：生活杂物/小动物/门灯计数（验收探针读取，纯统计无逻辑） */
  public gateLife = { decor: 0, wildlife: 0, lamp: 0 };
  /** P2 农场复兴视觉化：荒废/复兴装饰组 + 小动物计数（验收探针读取，纯统计无逻辑） */
  public farmLife = { ruin: 0, revive: 0, wildlife: 0 };
  // 灯塔视觉升级（2026-08-09）：关键 Graphics 挂字段供验收探针断言（纯挂载无逻辑）
  public lhRoomGlow: Phaser.GameObjects.Graphics | null = null;   // 灯室光晕（白天弱/夜晚强）
  public lhBeam: Phaser.GameObjects.Graphics | null = null;       // 夜晚光束（白天为 null）
  public lhStars: Phaser.GameObjects.Graphics | null = null;      // 夜晚星点（白天为 null）
  // 教程：夏雅精灵
  private xiyaSprite: Phaser.GameObjects.Sprite | null = null;
  // v0.5.3 剧情密度 E1：清晨偶遇的夏雅（教程完成后，清晨 06-08 时在农场出现）
  private dawnXiya: Phaser.GameObjects.Sprite | null = null;
  private dawnXiyaLabel: Phaser.GameObjects.Text | null = null;
  private dawnXiyaDay = 0;
  // P1-2 村长来访（第一章）：老屋门口出现的村长（自动触发，一次性，triggerOnceIf 判重）
  private elderVisitSprite: Phaser.GameObjects.Sprite | null = null;
  private elderVisitLabel: Phaser.GameObjects.Text | null = null;
  private ch1ElderVisitDay = 0;
  /** 钓鱼 Phase 4：夏雅交换果干当天（次日河边长椅小场景判断用） */
  private fishXiyaExchangeDay = 0;
  /** 钓鱼放生彩蛋 v1.2：首次放生天数（-1=未放生；随 mapFlags 入档，读档保持） */
  private fishReleaseDay = -1;
  /** 放生 2 天后的河面鱼影（town 装饰，随场景重建） */
  private releasedFishGfx: Phaser.GameObjects.Container | null = null;
  // 采集流向扩展：世界变化 Graphics 运行时引用（非存档；幂等渲染 + 探针验证用）
  private gatherBerryBasketGfx: Phaser.GameObjects.Graphics | null = null;
  private xiyaWindowFlowerGfx: Phaser.GameObjects.Graphics | null = null;
  private gatherMushroomDryingGfx: Phaser.GameObjects.Graphics | null = null;
  private gatherDandelionPatchGfx: Phaser.GameObjects.Graphics | null = null;   // 阿风收蒲公英 → town 河岸蒲公英丛
  private gatherWoodenStarlingGfx: Phaser.GameObjects.Graphics | null = null;   // 老周收树枝 → farm 老屋旁小木鸟
  // 种植升级 v2 切片A：萝卜赠予 → 河边腌萝卜罐（幂等渲染 + 探针验证用）
  private cropLifeLeftoverGfx: Phaser.GameObjects.Graphics | null = null;
  /** 种植升级 v2 切片B：番茄架视觉（crop_tomato_xiya_seen 后 farm 农田北缘；随场景重建，读档由事件状态自动恢复） */
  private tomatoTrellisGfx: Phaser.GameObjects.Graphics | null = null;
  /** 土地回应系统 v1.4：农田"活过来"后的蝴蝶/蜜蜂（farm 装饰容器，随场景重建） */
  private fieldLifeGfx: Phaser.GameObjects.Container | null = null;
  private elderVisitDone = false;
  /** P1-2 村长来访态度：'help' 愿意帮忙 / 'unsure' 还没想好（随 flags 入档，集市恢复消费） */
  private ch1ElderChoice: 'help' | 'unsure' | undefined = undefined;
  // day2 清晨「岛屿的第一声回应」：老屋门口看农田的夏雅（自动触发，一次性，triggerOnce 判重）
  private morningXiya: Phaser.GameObjects.Sprite | null = null;
  private morningXiyaLabel: Phaser.GameObjects.Text | null = null;
  private firstMorningDone = false;
  // FEATURE-041 木匠回归演出：老屋旁出现的木匠（自动触发，一次性，triggerOnce('carpenter_returned') 判重）
  private carpenterReturnSprite: Phaser.GameObjects.Sprite | null = null;
  private carpenterReturnDone = false;
  // 反馈 #28 阿风欢迎演出：木屋旁出现的阿风（自动触发，一次性，triggerOnce('adventurer_welcome_back') 判重）
  private adventurerWelcomeSprite: Phaser.GameObjects.Sprite | null = null;
  private adventurerWelcomeLabel: Phaser.GameObjects.Text | null = null;
  private adventurerWelcomeDone = false;
  
  // 镇长家提示物品
  private elderHouseHint: { sprite: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text } | null = null;
  // v0.5.3 剧情密度 E9：傍晚关心的夏雅（教程完成后，傍晚 18-20 时在农场出现）
  private eveningXiya: Phaser.GameObjects.Sprite | null = null;
  private eveningXiyaLabel: Phaser.GameObjects.Text | null = null;
  // E9 当天是否已触发过（跨天重置）
  private eveningXiyaDay = 0;
  // NPC 剧情覆盖日程扩展（2026-08-16）：河畔夏雅（16-18 时青禾河畔看水，18 点后回农场）
  private riversideXiya: Phaser.GameObjects.Sprite | null = null;
  private riversideXiyaLabel: Phaser.GameObjects.Text | null = null;
  private riversideXiyaDay = 0;
  // 灯意象彩蛋（L2/L3，制作人拍板 2026-08-05）：首次傍晚对话后是否已播过观察台词+童年点灯闪回（内存标记，不入档）
  private lampFlashbackDone = false;
  // v0.5.3 剧情密度 E5：爷爷的笔记（庄园角落可读物件）
  private grandpaNote: Phaser.GameObjects.Text | null = null;
  // 爷爷笔记交互基准坐标（椭圆实际位置，label 有 -8px 偏移）
  private grandpaNotePos: { x: number; y: number } = { x: 0, y: 0 };
  // 灯塔轻量版（2026-08-10 制作人解冻）：探索交互点（航海日志/铭牌/望远镜）
  private lighthouseSpots: Array<{ x: number; y: number; label: string; key: string; text: string }> = [];
  private lighthouseMarks: Phaser.GameObjects.Text[] = [];
  // M1-3 爷爷旧花园恢复点（farm 农田右上方 cols 28-32 rows 4-7）：三阶段清理交互状态
  private gardenRestore: {
    /** 0=未清理 1=已清倒木 2=已清破花架 3=已恢复 */
    stage: number;
    /** 恢复前装饰分 3 组（倒木/破花架/荒草），每组 Graphics，按阶段销毁 */
    debris: Phaser.GameObjects.Graphics[];
    /** 恢复后蝴蝶 */
    butterflies: Phaser.GameObjects.Container[];
    /** 交互提示标记（未恢复时显示） */
    mark: Phaser.GameObjects.Text | null;
    /** 交互基准点（区域中心像素坐标） */
    pos: { x: number; y: number };
  } | null = null;
  // 第一章 P2 捕虫玩法 V0.1（2026-08-13）：所有可捕捉蝴蝶统一管理。
  // 蝴蝶对象本身 setData('captured') 标记防重复；跨天 trySleep 钩子销毁重建（次日刷新）。
  // 不持久化 captured 状态——刷新页面蝴蝶重现无经济影响（标本不可售），符合"生活感"。
  private catchableButterflies: Phaser.GameObjects.Container[] = [];
  // FEATURE-037 老屋修复（farm 左下角木屋 = 主角家/爷爷留下的老屋）：
  // 一次资源交付完成，恢复前破旧装饰 / 恢复后完整装饰（Graphics 替换，不换 Tilemap）
  private oldHouseRestore: {
    /** 是否已恢复 */
    restored: boolean;
    /** 恢复前破旧装饰（屋顶破洞/外墙裂缝/门前杂草） */
    debris: Phaser.GameObjects.Graphics[];
    /** 交互提示标记（未恢复时显示） */
    mark: Phaser.GameObjects.Text | null;
    /** 交互基准点（木屋右侧空地像素坐标） */
    pos: { x: number; y: number };
  } | null = null;
  /** 邮箱系统（2026-08-15 制作人拍板）：老屋门口信箱本体 + 信件队列（随 mapFlags 入档） */
  private mailboxGfx: Phaser.GameObjects.Container | null = null;
  private mailboxPos: { x: number; y: number } = { x: 0, y: 0 };
  private mailUnlocked = false;
  private mailLastDay = -1;
  private mailNextDay = -1;
  private mailQueue: string[] = [];
  private mailRead: string[] = [];
  // 第一章 P2-1 集市广场恢复（town 中央偏北，制作人 2026-08-12 Sprint 3 + 2026-08-13 Phase 2）：
  // 村长来访（ch1_elder_visit）后解锁；资源交付=清理场地 → 需求匹配布置 3 摊 → 开张。
  // 状态机：荒地 → 清理（ch1_market_cleared）→ 布置（ch1_market_stall_1/2/3）→ 开张（markRestored）。
  // 需求匹配（制作人 2026-08-13 拍板）：老张工具摊靠路边 / 小梅中间小吃摊聚人气看热闹 / 夏雅花摊放老树旁。
  private marketSquareRestore: {
    restored: boolean;
    /** 是否已清理场地（资源交付完成，ch1_market_cleared）——清理后进入布置态 */
    cleared: boolean;
    // 2026-08-14 放宽为 GameObject[]：摊位改用 sprite（Image）替代 Graphics 绘制
    debris: Phaser.GameObjects.GameObject[];
    mark: Phaser.GameObjects.Text | null;
    pos: { x: number; y: number };
    // Phase 2 布置玩法：3 个布置点（摊位类型 + 像素坐标 + 当前标记，标记随布置销毁；placed 防重复摆放）
    arrangeSpots: { type: MarketStallType; x: number; y: number; mark: Phaser.GameObjects.Graphics | null; placed: boolean }[];
  } | null = null;
  // 第一章 P3 春日集（克制版，2026-08-12）：集市恢复后的夜晚进 town，镇上重新聚起人——
  // 灯火呼吸 + 人群剪影 + 人群低语 + 一句独白 + 第2章钩子（远处灯塔一点动静）。
  // 一次性（ch1_spring_fair），规模 ≤ 观星夜 40%（无镜头切换/无星空/无分支）。
  // P8: 委托给 CutsceneGuard
  private set inSpringFairCutscene(v: boolean) { v ? this.cutsceneGuard.begin('spring_fair') : this.cutsceneGuard.end('spring_fair'); }
  private get inSpringFairCutscene() { return this.cutsceneGuard.isActive('spring_fair'); }
  private springFairFX: Phaser.GameObjects.Graphics[] = [];
  /** 春日集"欠播"标记：triggerOnce 已标记但独白未播出（会话级，不入档；防一次性剧情永久丢失） */
  private springFairStoryOwed = false;
  /** 春日集低频重查冷却（ms）：进 town 后仅查一次的话，"白天进镇、天黑未走"会永远错过 */
  private springFairRescanCooldownMs = 0;
  // Phase 3 修复态 GameObjects（2026-08-13，青禾镇Phase3美术升级-拍板基线-v1.0.md §六）：
  // 路线 C：不扩 tileset，修复态用独立 sprite（增删切换，不碰 tile）。仅 town 场景。
  // 记录所有 Phase 3 挂载的 GameObject（探针验证数量/位置/显隐）
  private phase3Objects: Phaser.GameObjects.GameObject[] = [];
  // 集市摊主（2026-08-14 制作人拍板：摊位旁要有老板，增加活人感/真实感）：
  // 集市开张后生成 3 个摊主精灵（复用 npc_miner/npc_gardener/npc_girl 贴图，独立于 7 主 NPC 日程）。
  // 不进 phase3Objects（探针数量断言约束），独立数组管理，场景 shutdown 自动销毁。
  private marketStallKeepers: Phaser.GameObjects.Container[] = [];
  // 摊主闲聊台词（2026-08-14，D-017 文风护栏：具体情境 + 生活废话额度，不漂亮堆砌）
  private static readonly STALL_KEEPER_LINES: Record<string, string> = {
    老张: '锄头都摆好了，趁赶集人多，看看有没有人要。',
    小梅: '我这摊子靠中间，香味能飘出去老远。你来尝尝？',
    夏雅: '花都是今早现剪的。你要是不急着走，挑一盆放窗台上。',
  };
  // Phase 3 §四 S6 老河堤水声：位置触发状态缓存（防止每帧重复调用 setRiverProximity）
  private riverSoundNear = false;
  // FEATURE-037 后山道路修复（forest 底部 farm 入口上方的空地通道）
  private forestRoadRestore: {
    /** 是否已恢复 */
    restored: boolean;
    /** 恢复前乱石/杂草装饰 */
    debris: Phaser.GameObjects.Graphics[];
    /** 交互提示标记（未恢复时显示） */
    mark: Phaser.GameObjects.Text | null;
    /** 交互基准点（道路区域中心像素坐标） */
    pos: { x: number; y: number };
  } | null = null;
  // P0-5 农场回暖（2026-08-08 制作人拍板）：星之碎片交付后农场环境回暖反馈。
  // P6a: 农场温暖氛围状态已迁移至 FarmController
  // M1-3 夏雅见证：花园恢复完成后，夏雅在花园旁出现，靠近触发 GARDEN_RESTORED_XIYA_DIALOGUE
  private gardenXiya: Phaser.GameObjects.Sprite | null = null;
  private gardenXiyaLabel: Phaser.GameObjects.Text | null = null;
  // FEATURE-036 旧农业机器人：花园恢复后出现，修复获得（内存 flag 一次性，不进存档）
  private oldRobot: Phaser.GameObjects.Container | null = null;
  private oldRobotLabel: Phaser.GameObjects.Text | null = null;
  private oldRobotPos: { x: number; y: number } = { x: 0, y: 0 };
  private oldRobotFixed = false;
  // v0.5.3 剧情密度 E2：第一次收获反馈（一次性，内存 flag，不进存档）
  private firstHarvestShown = false;
  // 2026-08-11：day2 清晨演出（tryFirstMorningSequence）进行中标志。演出窗口内玩家抢先首次收获时，
  // 全屏旁白/对白（showMemoryMoment + FIRST_HARVEST_DIALOGUE）被抑制并延后到演出结束后补播——
  // 否则两个剧情竞争 StoryDialogue 单实例互相覆盖（「剧情乱了」bug）。
  // P8: 语义标注——这是「窗口锁」（window lock），非场景 cutscene。委托给 CutsceneGuard.beginWindow/endWindow。
  private set firstMorningActive(v: boolean) { v ? this.cutsceneGuard.beginWindow() : this.cutsceneGuard.endWindow(); }
  private get firstMorningActive() { return this.cutsceneGuard.isWindowLocked(); }
  // 演出窗口内完成的首次收获：演出结束后补播 FIRST_HARVEST_DIALOGUE（内存标志，不进存档）
  private pendingFirstHarvest = false;
  // v1.0 生活仪式感：第一次锄地/播种/浇水（一次性，mapFlags 入档，读档不重复）
  private firstHoe = false;
  private firstPlant = false;
  private firstWater = false;
  // v1.1 采集体验升级：第一次砍树/挖矿的短提示（一次性，mapFlags 入档，读档不重复）
  private firstChopHint = false;
  private firstMineHint = false;
  // SHOP-01 商店复兴：老板复兴台词已播档位（-1=未播；档位推进才播一次，随 mapFlags 入档）
  private shopRevivalTier = -1;
  /** 镇子商店状态机（'none'=未触发关闭剧情 / 'closed'=待开店 / 'opened'=营业中；随 mapFlags 入档） */
  private shopState: 'none' | 'closed' | 'opened' = 'none';
  // M1-3 花园清理引导：玩家靠近花园区域时首次提示（一次性，内存 flag）
  private gardenHintShown = false;
  // 教程提示 DOM
  private tutorialHint: HTMLDivElement | null = null;
  // P1-1 桌面端快捷键提示（J 任务 / B 背包）：首次进入提示，使用一次后本局不再显示
  private shortcutHint: HTMLDivElement | null = null;
  private shortcutHintDone = false;
  // 支线试点 flags（随 mapFlags 存档，读档不重复触发）
  private sideXiyaGardenAsked = false;
  private sideXiyaGardenDone = false;
  private sideElderTeaAsked = false;
  private sideElderStarDone = false;
  // T3 NPC 生活事件 flags（随 mapFlags 存档，读档不重复触发）
  private sideXiyaPhotoAsked = false;
  private sideXiyaPhotoDone = false;
  // P1-3 夏雅《旧日留影》（第一章性格铺垫，剧情大纲 v0.3 §八）：老屋整理完成后翻柜子→找夏雅
  private sideXiyaOldShadowAsked = false;
  private sideXiyaOldShadowDone = false;
  private xiyaOldShadowMark: Phaser.GameObjects.Text | null = null;
  private sideMinerLampAsked = false;
  private sideMinerLampDone = false;
  private sideGardenerPlumAsked = false;
  private sideGardenerPlumDone = false;
  // 花田支线：帮小梅开垦花田（farm 左上角花田，交付木材×3 → 盛开，一次性入档）
  private sideGardenerFieldAsked = false;
  private sideGardenerFieldDone = false;
  // T3.5 商店老板「镇子热闹了」flags（随 mapFlags 存档，读档不重复触发）
  private sideShopCropAsked = false;
  private sideShopCropDone = false;
  // D-011 夏雅《春深有信·一》剧情专线 flags（随 mapFlags 存档，读档不重复触发）
  private xiyaLetterAsked = false;
  private xiyaLetterDone = false;
  private xiyaLetterStage = 0;
  // D-011 夏雅《春深有信·二 花期未至》剧情专线 flags（随 mapFlags 存档，读档不重复触发）
  private xiyaBloomAsked = false;
  private xiyaBloomDone = false;
  private xiyaBloomStage = 0;
  /** T3.5 前置：本会话是否卖出过作物（会话级，不入档；读档后需重新卖出才可触发） */
  private shopSoldOnce = false;
  // T3 互动点视觉（场景级，destroy 时清理）
  private xiyaPhotoMark: Phaser.GameObjects.Text | null = null;
  private minerLampGroup: Phaser.GameObjects.Container | null = null;
  private plumMark: Phaser.GameObjects.Text | null = null;
  // 花田支线：花田视觉（荒废态容器 / 提示标记；盛开态直接 build 无需存引用，场景 shutdown 自动销毁）
  private gardenerFieldRuin: Phaser.GameObjects.Container | null = null;
  private gardenerFieldMark: Phaser.GameObjects.Text | null = null;
  // 第一章 v0.11 图鉴墙（制作人 2026-08-14 拍板）：花田旁的昆虫标本墙，按 ch1_natural_record_1/2/3 幂等挂卡
  private insectWall: Phaser.GameObjects.Container | null = null;
  // D-011 夏雅《春深有信·一》剧情专线场景级对象（花田边剧情夏雅 + 花苗/记录交互点；destroy 时清理）
  private letterXiya: Phaser.GameObjects.Sprite | null = null;
  private letterXiyaLabel: Phaser.GameObjects.Text | null = null;
  private letterFlowerMark: Phaser.GameObjects.Text | null = null;
  private letterRecordMark: Phaser.GameObjects.Text | null = null;
  /** 春深有信·一 完成后花田旁的新花苗视觉（制作人 2026-08-13 拍板纳入：玩家行为→世界变化） */
  private letterFlowerSprite: Phaser.GameObjects.Image | null = null;
  // D-011 夏雅《春深有信·二 花期未至》剧情专线场景级对象（旧广场剧情夏雅 + 交互点标记；destroy 时清理）
  private bloomXiya: Phaser.GameObjects.Sprite | null = null;
  private bloomXiyaLabel: Phaser.GameObjects.Text | null = null;
  private bloomMark: Phaser.GameObjects.Text | null = null;
  /** 花期未至完成后：春祭记忆小景（旧广场角落补一朵旧灯 + 纸花挂饰；世界反馈，制作人未单独拍板，克制视觉） */
  private bloomPermSprite: Phaser.GameObjects.Container | null = null;
  // 教程进度计数（锄地/播种/浇水各需3次）
  private tutorialProgress = 0;
  private readonly TUTORIAL_TARGET = 3;
  // Demo 结尾：结算界面
  // P2: 所有权迁移到 UIBus（惰性创建）
  private get endingPanel(): EndingPanel { return this.uiBus.endingPanel!; }
  /** 归星录·相簿面板（FEATURE-040 后新增，v0.1） */
  // P2: 所有权迁移到 UIBus（惰性创建，但 openPhotoAlbum 内有守卫）
  private get photoAlbumPanel(): PhotoAlbumPanel { return this.uiBus.photoAlbumPanel!; }
  /** 归星录·相簿解锁反馈（v0.10 记忆卡→相簿闭环）：待展示 toast + 当前 toast */
  private pendingPhotoUnlock: string | null = null;
  private photoUnlockToast: HTMLDivElement | null = null;
  // Demo 结尾：观星点视觉（farm 右下空地，像素坐标）
  private readonly STARGAZE_POS = { x: 504, y: 232 };
  private stargazeSprites: Phaser.GameObjects.Ellipse[] = [];
  private stargazeMark: Phaser.GameObjects.Text | null = null;
  // 观星夜星空系统（MVP）
  private starField: Phaser.GameObjects.Graphics | null = null;
  private starTwinkle: Phaser.GameObjects.Ellipse[] = [];
  private starFieldVisible = false;
  // v2 星空强化：8 颗带十字光芒的大星（旋转慢闪，随闪烁星显隐）
  private starCross: Phaser.GameObjects.Container[] = [];
  // v2 月光：观星点旁一轮淡月（光晕 + 月轮，让旧墙/石头收到月光）
  private stargazeMoon: Phaser.GameObjects.Container | null = null;
  // v2 星光粒子：观星点上空淡蓝白星光慢漂（复用森林萤火虫粒子模式，tint 0xddeeff, ADD）
  private stargazeDust: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  // v2 对话阶段镜头的极慢横移 tween（分支独白 zoom 前需停止，避免属性冲突）
  private stargazeDriftTween: Phaser.Tweens.Tween | null = null;
  // v0.10.4 远景小镇灯光（观星夜远景装饰，与星空同显同隐）
  private stargazeTownLights: Phaser.GameObjects.Graphics | null = null;
  // v0.10.4 观星夜演出互斥：镜头演出期间抑制其他自动演出（FIRST_MORNING/阿风），防止抢占观星对白
  // P8: 委托给 CutsceneGuard，统一管理 cutscene 旗标
  private set inStargazeCutscene(v: boolean) { v ? this.cutsceneGuard.begin('stargaze') : this.cutsceneGuard.end('stargaze'); }
  private get inStargazeCutscene() { return this.cutsceneGuard.isActive('stargaze'); }
  /** 小地图（宽高小于相机视野）居中标记：不跟随、每帧保持居中 */
  private centerSmallMap = false;
  private lastQuestObj: string = '';
  private lastHour: number = -1;
  // 镇子商店门面（老板搬回镇上：Graphics 建筑，关闭/营业两态，纯视觉不参与交互）
  private townShop: {
    mark: Phaser.GameObjects.Text;
    stall: Phaser.GameObjects.Graphics;
    pos: { x: number; y: number };
  } | null = null;
  // 自动售货机（2026-08-11 制作人拍板：衰落中维持最低限度运转——全天基础补给，独立交互锚点）
  private shopMachine: {
    g: Phaser.GameObjects.Graphics;
    lamp: Phaser.GameObjects.Text;
    pos: { x: number; y: number };
  } | null = null;
  // 自动农业机器人视觉（v0.6 庄园自动化 MVP：id → 机器人容器）
  private robotVisuals: Map<string, Phaser.GameObjects.Container> = new Map();
  // 后山老树（守望古树，核心意象）
  private oldTree: Phaser.GameObjects.Container | null = null;
  private oldTreePos: { x: number; y: number } = { x: 0, y: 0 };
  private oldTreeInteractHint: HTMLDivElement | null = null;
  // 天气系统 v0.10-lite：雨天覆盖层+雨粒子
  // === P3 天气字段已迁移到 WeatherDirector（src/modules/WeatherDirector.ts）===
  // 试玩-11 森林氛围（后山）：夜间萤火虫 + 白天落叶 + 野花装饰（零资源纯代码，不触碰碰撞/存档）
  private forestFireflies: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private forestLeaves: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private forestDecor: Phaser.GameObjects.Graphics[] = [];
  // 后山观景台（v0.10.2 第二层"先让环境说话"：废弃观景台 + 靠近一次性对白 FOREST_LOOKOUT_DIALOGUE）
  private lookout: Phaser.GameObjects.Container | null = null;
  private lookoutPos: { x: number; y: number } = { x: 0, y: 0 };
  private lookoutTriggered = false; // 内存判重（持久化由 EventManager.triggerOnce('forest_lookout_first_visit') 承担）

  constructor(key: string) {
    super(key);
    this.mapKey = key;
  }

  /** 获取当前活跃 MapScene 实例的 flag（供 SaveSystem 序列化） */
  static getCurrentFlags(): MapSceneFlags | null {
    const inst = MapScene._current;
    if (!inst) return null;
    return {
      shardDialoguePlayed: inst.shardDialoguePlayed,
      firstHarvestShown: inst.firstHarvestShown,
      firstHoe: inst.firstHoe,
      firstPlant: inst.firstPlant,
      firstWater: inst.firstWater,
      firstChopHint: inst.firstChopHint,
      firstMineHint: inst.firstMineHint,
      shopRevivalTier: inst.shopRevivalTier,
      shopState: inst.shopState === 'none' ? undefined : inst.shopState,
      woodcutTipShown: inst.woodcutTipShown,
      mineTipShown: inst.mineTipShown,
      tutorialProgress: inst.tutorialProgress,
      boundaryTipShown: inst.boundaryTipShown,
      lighthouseSeaHintShown: inst.lighthouseSeaHintShown,
      gardenHintShown: inst.gardenHintShown,
      shortcutHintDone: inst.shortcutHintDone,
      sideXiyaGardenAsked: inst.sideXiyaGardenAsked,
      sideXiyaGardenDone: inst.sideXiyaGardenDone,
      sideElderTeaAsked: inst.sideElderTeaAsked,
      sideElderStarDone: inst.sideElderStarDone,
      sideXiyaPhotoAsked: inst.sideXiyaPhotoAsked,
      sideXiyaPhotoDone: inst.sideXiyaPhotoDone,
      sideXiyaOldShadowAsked: inst.sideXiyaOldShadowAsked,
      sideXiyaOldShadowDone: inst.sideXiyaOldShadowDone,
      sideMinerLampAsked: inst.sideMinerLampAsked,
      sideMinerLampDone: inst.sideMinerLampDone,
      sideGardenerPlumAsked: inst.sideGardenerPlumAsked,
      sideGardenerPlumDone: inst.sideGardenerPlumDone,
      sideGardenerFieldAsked: inst.sideGardenerFieldAsked,
      sideGardenerFieldDone: inst.sideGardenerFieldDone,
      sideShopCropAsked: inst.sideShopCropAsked,
      sideShopCropDone: inst.sideShopCropDone,
      xiyaLetterAsked: inst.xiyaLetterAsked,
      xiyaLetterDone: inst.xiyaLetterDone,
      xiyaLetterStage: inst.xiyaLetterStage,
      xiyaBloomAsked: inst.xiyaBloomAsked,
      xiyaBloomDone: inst.xiyaBloomDone,
      xiyaBloomStage: inst.xiyaBloomStage,
      dawnXiyaDay: inst.dawnXiyaDay,
      eveningXiyaDay: inst.eveningXiyaDay,
      riversideXiyaDay: inst.riversideXiyaDay,
      ch1ElderVisitDay: inst.ch1ElderVisitDay,
      ch1ElderChoice: inst.ch1ElderChoice,
      fishXiyaExchangeDay: inst.fishXiyaExchangeDay,
      fishReleaseDay: inst.fishReleaseDay,
      artShowUnlocked: inst.artShowUnlocked,
      artShowEnvStage: inst.artShowEnvStage,
      artShowMaterialsDone: inst.artShowMaterialsDone,
      artShowHeld: inst.artShowHeld,
      artShowPerm: inst.artShowPerm,
      dryyardUnlocked: inst.dryyardUnlocked,
      dryyardEnvStage: inst.dryyardEnvStage,
      dryyardMaterialsDone: inst.dryyardMaterialsDone,
      dryyardHeld: inst.dryyardHeld,
      dryyardPerm: inst.dryyardPerm,
      ch2LighthouseTalked: inst.ch2LighthouseTalked,
      ch2ClockFixed: inst.ch2ClockFixed,
      ch2PierRepaired: inst.ch2PierRepaired,
      ch2StrangerSeen: inst.ch2StrangerSeen,
      ch2NightTalkDone: inst.ch2NightTalkDone,
      ch2XiyaSecretDone: inst.ch2XiyaSecretDone,
      ch2BlackDotSeen: inst.ch2BlackDotSeen,
      mailUnlocked: inst.mailUnlocked,
      mailLastDay: inst.mailLastDay,
      mailNextDay: inst.mailNextDay,
      mailQueue: inst.mailQueue,
      mailRead: inst.mailRead,
    };
  }

  init(data: SceneInitData): void {
    MapScene._current = this;
    this.spawn = data?.spawn;
    this.transitioning = false;
    this.createFailed = false;
    // 边界提示 flag 按场景重置（scene.start 会重新执行 init）
    this.boundaryTipShown = false;
    // 恢复存档中的 flag（consume 一次，仅首次有效）
    const saved = consumePendingMapFlags();
    if (saved) {
      this.shardDialoguePlayed = saved.shardDialoguePlayed;
      this.firstHarvestShown = saved.firstHarvestShown;
      this.firstHoe = saved.firstHoe ?? false;
      this.firstPlant = saved.firstPlant ?? false;
      this.firstWater = saved.firstWater ?? false;
      this.firstChopHint = saved.firstChopHint ?? false;
      this.firstMineHint = saved.firstMineHint ?? false;
      this.shopRevivalTier = saved.shopRevivalTier ?? -1;
      // 镇子商店状态：旧档已用过商店（复兴台词已播）→ 直接营业，不出现关闭剧情
      this.shopState = saved.shopState ?? (saved.shopRevivalTier !== undefined && saved.shopRevivalTier >= 0 ? 'opened' : 'none');
      this.woodcutTipShown = saved.woodcutTipShown;
      this.mineTipShown = saved.mineTipShown;
      this.tutorialProgress = saved.tutorialProgress;
      this.boundaryTipShown = saved.boundaryTipShown;
      this.lighthouseSeaHintShown = saved.lighthouseSeaHintShown ?? false;
      this.gardenHintShown = saved.gardenHintShown;
      this.shortcutHintDone = saved.shortcutHintDone;
      this.sideXiyaGardenAsked = saved.sideXiyaGardenAsked ?? false;
      this.sideXiyaGardenDone = saved.sideXiyaGardenDone ?? false;
      this.sideElderTeaAsked = saved.sideElderTeaAsked ?? false;
      this.sideElderStarDone = saved.sideElderStarDone ?? false;
      this.sideXiyaPhotoAsked = saved.sideXiyaPhotoAsked ?? false;
      this.sideXiyaPhotoDone = saved.sideXiyaPhotoDone ?? false;
      this.sideXiyaOldShadowAsked = saved.sideXiyaOldShadowAsked ?? false;
      this.sideXiyaOldShadowDone = saved.sideXiyaOldShadowDone ?? false;
      this.sideMinerLampAsked = saved.sideMinerLampAsked ?? false;
      this.sideMinerLampDone = saved.sideMinerLampDone ?? false;
      this.sideGardenerPlumAsked = saved.sideGardenerPlumAsked ?? false;
      this.sideGardenerPlumDone = saved.sideGardenerPlumDone ?? false;
      this.sideGardenerFieldAsked = saved.sideGardenerFieldAsked ?? false;
      this.sideGardenerFieldDone = saved.sideGardenerFieldDone ?? false;
      this.sideShopCropAsked = saved.sideShopCropAsked ?? false;
      this.sideShopCropDone = saved.sideShopCropDone ?? false;
      this.xiyaLetterAsked = saved.xiyaLetterAsked ?? false;
      this.xiyaLetterDone = saved.xiyaLetterDone ?? false;
      this.xiyaLetterStage = saved.xiyaLetterStage ?? 0;
      this.xiyaBloomAsked = saved.xiyaBloomAsked ?? false;
      this.xiyaBloomDone = saved.xiyaBloomDone ?? false;
      this.xiyaBloomStage = saved.xiyaBloomStage ?? 0;
      this.dawnXiyaDay = saved.dawnXiyaDay ?? 0;
      this.eveningXiyaDay = saved.eveningXiyaDay ?? 0;
      this.riversideXiyaDay = saved.riversideXiyaDay ?? 0;
      this.ch1ElderVisitDay = saved.ch1ElderVisitDay ?? 0;
      this.ch1ElderChoice = saved.ch1ElderChoice;
      this.fishXiyaExchangeDay = saved.fishXiyaExchangeDay ?? 0;
      this.fishReleaseDay = saved.fishReleaseDay ?? -1;
      this.artShowUnlocked = saved.artShowUnlocked ?? false;
      this.artShowEnvStage = saved.artShowEnvStage ?? 0;
      this.artShowMaterialsDone = saved.artShowMaterialsDone ?? false;
      this.artShowHeld = saved.artShowHeld ?? false;
      this.artShowPerm = saved.artShowPerm ?? false;
      this.dryyardUnlocked = saved.dryyardUnlocked ?? false;
      this.dryyardEnvStage = saved.dryyardEnvStage ?? 0;
      this.dryyardMaterialsDone = saved.dryyardMaterialsDone ?? false;
      this.dryyardHeld = saved.dryyardHeld ?? false;
      this.dryyardPerm = saved.dryyardPerm ?? false;
      this.ch2LighthouseTalked = saved.ch2LighthouseTalked ?? false;
      this.ch2ClockFixed = saved.ch2ClockFixed ?? false;
      this.ch2PierRepaired = saved.ch2PierRepaired ?? false;
      this.ch2StrangerSeen = saved.ch2StrangerSeen ?? 0;
      this.ch2NightTalkDone = saved.ch2NightTalkDone ?? false;
      this.ch2XiyaSecretDone = saved.ch2XiyaSecretDone ?? false;
      this.ch2BlackDotSeen = saved.ch2BlackDotSeen ?? false;
      this.mailUnlocked = saved.mailUnlocked ?? false;
      this.mailLastDay = saved.mailLastDay ?? -1;
      this.mailNextDay = saved.mailNextDay ?? -1;
      this.mailQueue = saved.mailQueue ?? [];
      this.mailRead = saved.mailRead ?? [];
    }
  }

  /** 场景停止/切换时清理挂载在 document.body 上的 DOM 残留（提示条/种子选择器等） */
  private cleanupSceneDom(): void {
    this.hideAllInteractHints();
    this.removeTutorialHint();
    this.removeShortcutHint();
    this.closeSeedSelector();
    this.closeCropPicker();
    // 背包/任务面板跨场景清理（防止残留打开态）
    this.backpackPanel?.close();
    this.questPanel?.close();
    // BUG-FIX（P2）：商店/音乐盒/爷爷包裹面板此前不在清理链——跨场景残留打开态，
    // 商店面板开着时 panel_open 门控会冻结新场景交互（shop 等 DOM 面板走 UIBus 单例跨场景存活）
    this.shopPanel?.close();
    this.musicBoxPanel?.close();
    this.grandpaGiftPanel?.close();
    closeMailbox();
    closeWaitPanel();
    // 重要事件记忆卡（story notification）跨场景清理（防止中途切场景残留）
    hideStoryCard();
    // FEATURE-038 需求板跨场景清理（防止残留打开态）
    this.residentBoardPanel?.close();
    // BUG-041：场景切换时若对话未结束（中途离开），reset 不触发 onComplete → vanished 未设置
    // 在 reset 前检查：若神秘少女在当前场景且精灵可见，手动触发 setVanished
    if (this.storyDialogue?.isOpen()) {
      const mysteryNpc = this.npcList.find((n) => n.id === 'mystery');
      if (mysteryNpc?.sprite?.visible) {
        mysteryNpc.setVanished();
      }
    }
    // 对话残留跨场景传递会导致新场景按交互被对话拦截（reset 不触发 onComplete，安全）
    this.storyDialogue?.reset();
    // BUG-FIX（P0-2）：reset 只清 UI 与闭包，runner 内部 playing 标记不会释放；
    // 若对话播放中途切场景（闭包被丢弃后 onComplete 永不再来），playing 卡死
    // 会跨 shutdown/create 存活（场景实例复用），新场景所有 playStory 静默失效。
    // interrupt() 兜底：未在播放时直接返回（无副作用），在播时释放 playing 并幂等重置对话。
    this.storySequenceRunner?.interrupt();
    // E1/E9 夏雅精灵清理（场景切换时销毁，防止残留）
    this.clearDawnXiya();
    this.clearEveningXiya();
    // NPC 剧情覆盖日程：河畔夏雅清理（场景切换时销毁，防止残留）
    this.clearRiversideXiya();
    // day2 清晨演出夏雅清理（场景切换时销毁，防止残留；BUG-071）
    this.clearMorningXiya();
    // P1-2 村长来访演出精灵清理（场景切换时销毁，防止残留）
    this.clearElderVisit();
    // D-011 《春深有信·一》剧情专线精灵/交互点清理（场景切换时销毁，防止残留）
    this.clearLetterXiya();
    // D-011 《春深有信·二 花期未至》剧情专线精灵清理（场景切换时销毁，防止残留）
    this.clearBloomXiya();
    // 相簿解锁 toast 清理（DOM，防跨场景残留）
    this.hidePhotoUnlockToast();
    // M1-3 夏雅见证精灵清理（场景切换时销毁，防止残留）
    this.clearGardenXiya();
    // FEATURE-036 旧机器人精灵清理（场景切换时销毁，防止残留）
    this.clearOldRobot();
    // 自动农业机器人视觉清理
    this.clearRobots();
    // 后山老树交互提示清理
    this.hideOldTreeHint();
    // 老屋整理提示清理（DOM，场景切换时销毁防残留）
    this.hideHouseTidyHint();
    // 钓鱼 Phase 1 资源清理（视觉 + DOM hint + 状态机复位）
    this.cleanupFishing();
    // 生活采集 Phase 1 资源清理（视觉 + DOM hint；已采状态已由 triggerOnce 持久化）
    this.cleanupGathering();
    // 星光艺术展余波：旅人回访清理（视觉 + label + DOM hint，场景切换防残留）
    this.cleanupArtShowTraveler();
    // 星光艺术展余波：庆典后夏雅清理（视觉 + label + DOM hint，场景切换防残留）
    this.clearArtShowAfterXiya();
    // 秋日晒场：会话级视觉与 DOM 提示清理（征集筐/夏雅/老张/演出精灵，场景切换防残留）
    this.cleanupDryyard();
    // 青禾河畔：码头/凉亭 DOM 提示清理（场景切换防残留）
    this.cleanupQingheRiver();
    // 青禾河畔 Stage 2 / 果园预埋：NPC/提示清理（场景切换防残留）
    this.cleanupQingheStage2();
    // 镇长家提示物品清理
    this.clearElderHouseHint();
    // 灯塔探索交互点清理（场景切换时销毁，防止残留）
    this.clearLighthouseMarks();
  }

  preload(): void {
    // 加载当前场景对应的 Tiled 地图 JSON
    this.load.tilemapTiledJSON(this.mapKey, `assets/maps/${this.mapKey}.json`);
    // tileset 图片：每个地图使用自己的主题瓦片
    // 移除旧瓦片纹理（切换场景时避免纹理冲突）
    if (this.textures.exists('tiles')) {
      this.textures.remove('tiles');
    }
    // elder_house 与 house 共用 house_tileset.png（地图 JSON 即引用该图；无 elder_house_tileset.png）
    // qinghe_river 复用 town_tileset.png（16 gid 语义一致，不复制资产）
    const tilesetName = this.mapKey === 'elder_house' ? 'house' : this.mapKey === 'qinghe_river' ? 'town' : this.mapKey;
    this.load.image('tiles', `assets/tiles/${tilesetName}_tileset.png?v=8`);
    // 玩家 spritesheet（4方向×4帧 run 动画，每帧 32x32，显示时缩放 0.5 与 16x16 瓦片协调）
    if (!this.textures.exists('player')) {
      this.load.spritesheet('player', 'assets/sprites/player.png', { frameWidth: 32, frameHeight: 32 });
    }
    // NPC 贴图（3 张 32x32 单帧，显示时缩放 0.5 与 16x16 瓦片协调）
    if (!this.textures.exists('npc_elder')) this.load.image('npc_elder', 'assets/sprites/npc_elder.png');
    if (!this.textures.exists('npc_merchant')) this.load.image('npc_merchant', 'assets/sprites/npc_merchant.png');
    if (!this.textures.exists('npc_girl')) this.load.image('npc_girl', 'assets/sprites/npc_girl.png');
    if (!this.textures.exists('npc_xiya')) this.load.image('npc_xiya', 'assets/sprites/npc_xiya.png');
    if (!this.textures.exists('npc_miner')) this.load.image('npc_miner', 'assets/sprites/npc_miner.png');
    if (!this.textures.exists('npc_gardener')) this.load.image('npc_gardener', 'assets/sprites/npc_gardener.png');
    if (!this.textures.exists('npc_adventurer')) this.load.image('npc_adventurer', 'assets/sprites/npc_adventurer.png');
    if (!this.textures.exists('npc_carpenter')) this.load.image('npc_carpenter', 'assets/sprites/npc_carpenter.png');
    // 矿脉贴图（矿洞场景：石/铜/铁）
    if (this.mapKey === 'mine') {
      if (!this.textures.exists('ore_stone')) this.load.image('ore_stone', 'assets/sprites/ore_stone.png');
      if (!this.textures.exists('ore_copper')) this.load.image('ore_copper', 'assets/sprites/ore_copper.png');
      if (!this.textures.exists('ore_iron')) this.load.image('ore_iron', 'assets/sprites/ore_iron.png');
    }
    // 道具贴图（农场砍树相关：旧斧头/木材）
    if (this.mapKey === 'farm') {
      if (!this.textures.exists('old_axe')) this.load.image('old_axe', 'assets/sprites/old_axe.png');
      if (!this.textures.exists('wood')) this.load.image('wood', 'assets/sprites/wood.png');
    }
    if (this.mapKey === 'farm' && !this.textures.exists('crops')) {
      this.load.spritesheet('crops', 'assets/sprites/crops.png', { frameWidth: 32, frameHeight: 32 });
    }
    if (this.mapKey === 'farm' && !this.textures.exists('farm_plot')) {
      this.load.spritesheet('farm_plot', 'assets/sprites/farm_plot.png', { frameWidth: 16, frameHeight: 16 });
    }
// 砍树贴图：树1（阔叶）/树2（松树）/大树（2 格）/树桩（农场 + 生命化改造·河岸树列）
if (this.mapKey === 'farm' || this.mapKey === 'town') {
if (!this.textures.exists('tree1')) this.load.image('tree1', 'assets/sprites/tree1.png');
if (!this.textures.exists('tree2')) this.load.image('tree2', 'assets/sprites/tree2.png');
if (!this.textures.exists('tree_big')) this.load.image('tree_big', 'assets/sprites/tree_big.png');
      if (!this.textures.exists('stump')) this.load.image('stump', 'assets/sprites/stump.png');
    }
    // Phase 3 修复态资产（2026-08-13，青禾镇Phase3美术升级-拍板基线-v1.0.md §三）：
    // 路灯/招牌/长椅/窗灯/花坛 —— GPT 黑底图 → 抠图 → 量化入库（tools/sprite_process.py）
    if (this.mapKey === 'town') {
      if (!this.textures.exists('spr_lamp')) this.load.image('spr_lamp', 'assets/sprites/lamp_pointed.png');
      if (!this.textures.exists('spr_sign')) this.load.image('spr_sign', 'assets/sprites/sign_hung.png');
      if (!this.textures.exists('spr_bench')) this.load.image('spr_bench', 'assets/sprites/bench.png');
      if (!this.textures.exists('spr_window')) this.load.image('spr_window', 'assets/sprites/window_lamp.png');
      // 集市摊位 sprite（2026-08-14 Gemini 出图 → sprite_process.py 入库；白底/黑底均兼容）
      // tool=白底红棕 / food=黑底红 / flower=黑底粉
      if (!this.textures.exists('spr_stall_tool')) this.load.image('spr_stall_tool', 'assets/sprites/market_stall_tool.png');
      if (!this.textures.exists('spr_stall_food')) this.load.image('spr_stall_food', 'assets/sprites/market_stall_food.png');
      if (!this.textures.exists('spr_stall_flower')) this.load.image('spr_stall_flower', 'assets/sprites/market_stall_flower.png');
    }
    // 镇子生活杂物/环境 sprite：town + gate 共用（gate 庄园大门也是玩家第一印象，资产精修同步覆盖）
    if (this.mapKey === 'town' || this.mapKey === 'gate') {
      if (!this.textures.exists('decor_woodpile')) this.load.image('decor_woodpile', 'assets/sprites/decor_woodpile.png');
      if (!this.textures.exists('decor_pot')) this.load.image('decor_pot', 'assets/sprites/decor_pot.png');
      if (!this.textures.exists('decor_bucket')) this.load.image('decor_bucket', 'assets/sprites/decor_bucket.png');
      if (!this.textures.exists('decor_crate')) this.load.image('decor_crate', 'assets/sprites/decor_crate.png');
      if (!this.textures.exists('decor_clothesline')) this.load.image('decor_clothesline', 'assets/sprites/decor_clothesline.png');
      if (!this.textures.exists('decor_cart')) this.load.image('decor_cart', 'assets/sprites/decor_cart.png');
      if (!this.textures.exists('decor_stool')) this.load.image('decor_stool', 'assets/sprites/decor_stool.png');
      if (!this.textures.exists('decor_broom')) this.load.image('decor_broom', 'assets/sprites/decor_broom.png');
      if (!this.textures.exists('decor_rock')) this.load.image('decor_rock', 'assets/sprites/decor_rock.png');
      if (!this.textures.exists('decor_grass')) this.load.image('decor_grass', 'assets/sprites/decor_grass.png');
      if (!this.textures.exists('decor_fg_grass')) this.load.image('decor_fg_grass', 'assets/sprites/decor_fg_grass.png');
    }
    // spr_flowerbed：town 集市花坛（Phase3）+ farm 春深有信·一 完成后花田花苗（P1 世界反馈，2026-08-13 制作人拍板）
    if (this.mapKey === 'town' || this.mapKey === 'farm') {
      if (!this.textures.exists('spr_flowerbed')) this.load.image('spr_flowerbed', 'assets/sprites/flowerbed.png');
    }
  }

  create(): void {
    // === CutsceneGuard 复位（P0 防锁死）：实例跨 shutdown/create 复用，上一轮被打断的
    // 演出（restart/切图）旗标若带入本轮 = 交互永久 dialogue_only 锁死。演出链对象
    // （delayedCall/tween/对白回调）在 shutdown 已全部销毁，此处复位不影响任何在途演出。
    this.cutsceneGuard.reset();
    // ch2 夜谈防重入旗标同步复位（ owed 欠播标记保留，供重进 qinghe_river 补播）
    this.ch2NightTalkActive = false;
    // === P1/P2/P3: 在任何 getter 访问之前初始化三大模块 ===
    // 原因：SHUTDOWN 钩子注册中 stopRain() 等可能间接访问 panel getter；
    //      station 等场景的 createScene 中 setup* 方法也可能访问 getter。
    this.cameraDirector = new CameraDirector(this.cameras.main, this.tweens);
    this.uiBus = new UIBus();
    this.uiBus.setOpenHandlers({
      openBackpack: () => {
        this.inputManager.clearAction();
        this.hideShortcutHint();
      },
      openQuest: () => {
        this.inputManager.clearAction();
        this.hideShortcutHint();
      },
      openWait: () => {
        this.inputManager.clearAction();
        this.tryOpenWait();
      },
    });
    // P3: WeatherDirector — 管理天气视觉效果（雨覆盖层+粒子+环境音）
    this.weatherDirector = new WeatherDirector(this, AmbienceSystem.RAIN_MAPS);
    this.weatherDirector.setOnRainStart(() => this.syncWeatherGatherPoints());
    // P4: WorldDecorator — 管理纯视觉装饰（草簇/花/树/石/灯柱等）
    this.worldDecorator = new WorldDecorator(this);
    // P5a/P5b/P5c: FishingController — 管理钓鱼视觉/DOM/状态机
    // 构建配置对象（从 MapScene static readonly 提取）
    const fishingConfig: FishingConfig = {
      biteDelayMin: MapScene.FISHING_CONFIG.biteDelayMin,
      biteDelayMax: MapScene.FISHING_CONFIG.biteDelayMax,
      fakeBiteProbability: MapScene.FISHING_CONFIG.fakeBiteProbability,
      realBiteWindow: MapScene.FISHING_CONFIG.realBiteWindow,
      successFeedbackDuration: MapScene.FISHING_CONFIG.successFeedbackDuration,
      castDuration: MapScene.FISHING_CONFIG.castDuration,
      fakeBiteDuration: MapScene.FISHING_CONFIG.fakeBiteDuration,
      fakeBiteRecoverDuration: MapScene.FISHING_CONFIG.fakeBiteRecoverDuration,
      failFeedbackDuration: MapScene.FISHING_CONFIG.failFeedbackDuration,
      interactRange: MapScene.FISHING_CONFIG.interactRange,
      fryChance: MapScene.FISHING_CONFIG.fryChance,
    };
    const fishKinds: Record<string, FishKindConfig> = {};
    for (const [k, v] of Object.entries(MapScene.FISH_KINDS)) {
      fishKinds[k] = {
        name: v.name,
        fakeBiteProbability: v.fakeBiteProbability,
        biteDelayMin: v.biteDelayMin,
        biteDelayMax: v.biteDelayMax,
      };
    }
    const fishingSpots: Record<string, FishingSpotData> = {};
    for (const [k, v] of Object.entries(MapScene.FISHING_SPOTS)) {
      fishingSpots[k] = {
        pos: { ...v.pos },
        floatPos: { ...v.floatPos },
        tier: v.tier,
      };
    }
    const fishingHooks: FishingHooks = {
      getTimeHour: () => getTime().hour,
      getTimeDay: () => getTime().day,
      getMapKey: () => this.mapKey,
      clearAction: () => this.inputManager.clearAction(),
      playSfx: (name) => play(name),
      addItem: (id, count) => addItem(id, count),
      setItemCount: (id, count) => setItemCount(id, count),
      getItemCount: (id) => getItemCount(id),
      showDialogueText: (text) => this.showDialogueText(text),
      playDialogue: (lines, onComplete, onChoice) => {
        this.playStory(lines as DialogueLine[], onComplete, onChoice, 'fishing_hook');
      },
      updateHUD: () => this.updateHUD(),
      save: (x, y, scene, facing) => {
        save({ x, y, scene, facing } as any);
      },
      getPlayerPos: () => ({ x: this.player.x, y: this.player.y, facing: this.player.facing }),
      getFishReleaseDay: () => this.fishReleaseDay,
      setFishReleaseDay: (day) => { this.fishReleaseDay = day; },
      isFishShadowsActive: () => this.fishShadowsActive(),
      presentFryReleaseChoice: () => this.presentFryReleaseChoice(),
      releaseCurrentFish: () => this.fishingController.releaseCurrentFish(),
      keepCurrentFry: () => this.fishingController.keepCurrentFry(),
      onFishingEnded: () => {
        // 老姜修行完成后，钓点引导浮漂不再恢复；钓鱼本身仍可继续。
        if (!hasTriggered('laojiang_practice_done')) {
          this.fishingSpotWaterMark?.setVisible(true);
        }
      },
    };
    this.fishingController = new FishingController(
      this, fishingConfig, fishKinds, fishingSpots, fishingHooks, isMobileLayout(),
    );
    // P6a/P6b: FarmController — 管理农场视觉/装饰 + 交互路由
    const farmHooks: FarmHooks = {
      // ── P6a: 视觉钩子 ──
      getTimeDay: () => getTime().day,
      getTimeHour: () => getTime().hour,
      getTileRect: (col, row) => this.tileRects.get(`${col},${row}`),
      setTileRect: (col, row, visual) => { this.tileRects.set(`${col},${row}`, visual); },
      getTileState: (col, row) => getTileState(col, row),
      getCrop: (col, row) => getCrop(col, row),
      hasTriggered: (key) => hasTriggered(key),
      triggerOnce: (key, fn) => triggerOnce(key, fn),
      // ── P6b: 交互路由钩子（决策全部在 MapScene）──
      canProcessFarmInput: () => {
        if (this.transitioning) return false;
        if (this.inStargazeCutscene) return false;
        if (this.storyDialogue?.isOpen()) return false;
        if (this.shopPanel.isOpen()) return false;
        if (this.backpackPanel.isOpen()) return false;
        if (this.endingPanel?.isOpen()) return false;
        if (this.photoAlbumPanel?.isOpen()) return false;
        if (isDiscoveryPanelOpen()) return false;
        if (isHudMenuOpen()) return false;
        if (this.seedSelectorEl) return false;
        if (this.cropPickerEl) return false;
        return true;
      },
      onPlotInteract: (plotId) => {
        // 决策 + 数据操作（全部在 MapScene）
        this.interactPlot(plotId);
        // 触屏点击反馈
        this.plotFlashId = plotId;
        this.plotFlashUntil = this.time.now + 500;
        if (isTouchDevice()) { try { navigator.vibrate(15); } catch {} }
      },
      onTileInteract: (col, row) => {
        const state = getTileState(col, row);
        // 决策层：可操作性判断
        if (!this.isTileActionable(col, row)) {
          this.flashTileError(col, row);
          const msg = state === 'watered' ? '还需要一点时间' : '没有种子';
          this.showFloatText(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2, msg, '#ff8a80');
          return;
        }
        // 数据操作
        this.tryFarmInteractAt(col, row);
        // 触屏点击反馈
        this.tapFlashKey = `${col},${row}`;
        this.tapFlashUntil = this.time.now + 500;
        if (isTouchDevice()) { try { navigator.vibrate(15); } catch {} }
      },
      // ── P6c: 生命周期操作钩子（数据操作 + 事务顺序控制）──
      getItemCount: (itemId) => getItemCount(itemId as ItemType),
      consumeStamina: (opType) => {
        if (!isTutorialDone()) return true;
        const cost = getActionStaminaCost(opType as 'farm_till' | 'farm_plant' | 'farm_water' | 'farm_harvest');
        if (!consumeStamina(cost)) {
          this.showDialogueText('体力不足，干不动了……先睡一觉吧！');
          return false;
        }
        return true;
      },
      setTileState: (col, row, state) => setTileState(col, row, state),
      setCrop: (col, row, crop) => setCrop(col, row, crop),
      addItem: (itemId, count) => addItem(itemId as ItemType, count),
      addXp: (amount, source) => addXp(amount, source as import('../data/FarmProgress').XpSource),
      consumeMinutes: (opType) => {
        const cost = getActionTimeCost(opType as 'gathering' | 'dialogue' | 'farm_till' | 'farm_plant' | 'farm_water' | 'farm_harvest');
        consumeMinutes(cost);
      },
      checkTutorialProgress: (type) => this.checkTutorialProgress(type as 'till' | 'sow' | 'water'),
      setDebugTile: (col, row, state) => { MapScene.debugTiles.set(`${col},${row}`, state); },
      onFarmOpComplete: (opType, col, row, opts) => {
        const cropType = (opts?.cropType as CropType | undefined) ?? undefined;
        const tx = col * TILE_SIZE + TILE_SIZE / 2;
        const ty = row * TILE_SIZE + TILE_SIZE / 2;
        switch (opType) {
          case 'till':
            this.checkTutorialProgress('till');
            if (!this.firstHoe) {
              this.firstHoe = true;
              triggerTag('first_hoe');
              this.tileGlowHighlight(tx, ty);
              showMemoryMoment('原来土地是这样的感觉。');
            }
            break;
          case 'plant':
            addXp(3, 'plant');
            if (!this.firstPlant) {
              this.firstPlant = true;
              triggerTag('first_plant');
              this.tileGlowHighlight(tx, ty, 0xa8e6a0);
              showMemoryMoment('城市里的人已经很久没有亲手种下一颗种子了。');
              this.showDialogueText('种下了……等它长大，收成能换钱修镇上的旧东西。');
              if (!isPhotoUnlocked('first_crop')) {
                unlockPhoto('first_crop');
                this.notifyPhotoUnlocked('first_crop');
                save({
                  x: this.player.x, y: this.player.y,
                  scene: this.mapKey, facing: this.player.facing,
                  dailyQuest: getDailyQuestSaveData(),
                } as any);
              }
            }
            onDQPlant();
            this.checkTutorialProgress('sow');
            break;
          case 'water':
            addXp(1, 'water');
            onDQWater();
            this.checkTutorialProgress('water');
            if (!this.firstWater) {
              this.firstWater = true;
              triggerTag('first_water');
              showMemoryMoment('水浇下去，能不能活，明天才知道。');
            }
            break;
          case 'harvest_pre_time':
            addXp(10, 'harvest');
            onDQHarvest(cropType ?? 'radish');
            if (cropType === 'corn' && !hasTriggered('crop_corn_first_harvest')) {
              triggerOnce('crop_corn_first_harvest', () => { /* 仅标记 */ });
              save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
            }
            break;
          case 'harvest':
            if (!this.firstHarvestShown) {
              this.firstHarvestShown = true;
              triggerTag('first_harvest');
              play('harvest_first');
              const cropIcon = CROP_DEFS[cropType ?? 'radish']?.icon ?? '🥕';
              const cropShot = this.add.text(tx, ty, cropIcon, { fontSize: '22px' }).setOrigin(0.5).setDepth(8);
              this.tweens.add({
                targets: cropShot,
                scale: 1.9, y: ty - 16, alpha: 0,
                duration: 900, ease: 'Sine.out',
                onComplete: () => cropShot.destroy(),
              });
              const baseScale = this.player.scaleX;
              this.tweens.add({
                targets: this.player,
                scaleX: baseScale * 1.08, scaleY: baseScale * 0.92,
                duration: 130, yoyo: true, ease: 'Sine.out',
                onComplete: () => this.player.setScale(baseScale, baseScale),
              });
              if (this.firstMorningActive) {
                this.pendingFirstHarvest = true;
              } else {
                showMemoryMoment('小时候爷爷告诉我，土地不会辜负认真照料它的人。');
                this.time.delayedCall(320, () => this.playFirstHarvestDialogue());
              }
            }
            break;
        }
      },
    };
    this.farmController = new FarmController(this, farmHooks);
    // 农场清理（shutdown 时销毁温暖状态等）
    // BUG-FIX（P2 泄漏）：Phaser shutdown 不移除 scene 事件监听，场景实例复用时每次
    // create() 的 events.on 都会追加一批闭包（farm↔town 反复切换持续累积）。
    // 全部处理器均为惰性解引用 this.X（调用时读当前字段），每实例只装一次是安全的。
    if (!this.shutdownHooksInstalled) {
      this.shutdownHooksInstalled = true;
      this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.farmController?.cleanup(), this);
      // 场景停止/切换时清理 DOM 残留（提示条/种子选择器等），防止跨场景泄漏
      this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.cleanupSceneDom, this);
      // 场景切换时停止环境音（防止上一场景环境音残留到下一场景——P0 防黑屏/残留）
      this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => AmbienceSystem.stop(), this);
      // 场景切换时 BGM 策略（2026-08-10 音乐跨图连续）：仅停止"地图默认曲"；
      // 若在播音乐盒"我的歌"或剧情曲则保留（新场景 playSceneBgm 同曲幂等命中→跨场景连续不打断）
      this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
        if (MusicSystem.isSceneDefaultPlaying()) MusicSystem.stop();
      }, this);
      // E-09 消磨时间：场景切换关闭等待面板（防残留）
      this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => closeWaitPanel(), this);
      // 天气系统：场景切换时停止雨天效果
      // P3: 天气清理（迁移到 WeatherDirector）
      this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.weatherDirector?.cleanup(), this);
    }
    // 兜底：create 阶段任何未预期的异常（贴图缺失/地图数据异常等）都不允许演变成黑屏，
    // 统一捕获并显示错误遮罩 + 刷新按钮
    try {
      this.createScene();
    } catch (err) {
      this.createFailed = true;
      console.error(`[MapScene:${this.mapKey}] create() 抛出异常，已阻止黑屏`, err);
      this.showFatalError(err);
    }
  }

  private createScene(): void {
    // 创建 tilemap 并关联 tileset
    const map = this.make.tilemap({ key: this.mapKey });
    // 屋内/木屋场景：收集睡觉判定格（house=床铺 gid 9；farm=木屋地板 gid 6）
    if (this.mapKey === 'house' || this.mapKey === 'farm') {
      this.collectBedTiles(map);
    }
    // house 场景：床铺格叠加程序化绘制的床（gid9 是屋顶瓦片，玩家无法一眼认出是床）
    if (this.mapKey === 'house') {
      this.setupHouseBed();
      // v0.10.2 老屋生活家具（L1 生活家具 + L2 生活痕迹，纯装饰零系统，见 setupHouseFurniture）
      this.setupHouseFurniture();
    }
    let tileset = map.addTilesetImage('placeholder', 'tiles');
    if (!tileset) {
      // 兜底：tileset 纹理加载失败时用程序生成的占位瓦片，避免整个场景黑屏
      console.error(`[MapScene:${this.mapKey}] tileset "placeholder" 关联失败，使用占位瓦片`);
      this.createFallbackTilesTexture();
      tileset = map.addTilesetImage('placeholder', 'fallback_tiles');
      if (!tileset) {
        console.error(`[MapScene:${this.mapKey}] 兜底 tileset 也失败，无法渲染地图`);
        this.showDialogueText('地图资源加载失败，请刷新页面重试');
        return;
      }
    }

    // 渲染图层
    this.groundLayer = map.createLayer('Ground', tileset, 0, 0)!;
    this.wallsLayer = map.createLayer('Walls', tileset, 0, 0)!;
    this.groundLayer.setDepth(0);
    this.wallsLayer.setDepth(1);

    // 碰撞：仅石墙(3)、水(4)、树木(9-12)、树桩(13) 参与碰撞
    // 土壤(5)、木地板(6)、小路(7)、花(8) 不碰撞（木地板/花仅装饰）
    // v0.6 地图重排：town 扩展瓦片 9(屋顶)/10(墙面)/11(门)/12(窗)/13(井)/14(栅栏) 全碰撞，
    //               mine 扩展瓦片 9(岩壁)/10(矿柱)/12(矿石堆)/13(木箱) 碰撞，11(轨道)/14(木板)/15(碎石)/16(矿车) 不碰撞
    this.wallsLayer.setCollisionBetween(3, 4);
    if (this.mapKey === 'mine') {
      this.wallsLayer.setCollision([9, 10, 12, 13]);
    } else if (this.mapKey === 'town') {
      this.wallsLayer.setCollisionBetween(9, 14);
    } else if (this.mapKey === 'lighthouse') {
      // 灯塔礁石岛（2026-08-10 轻量版）：岩石(3)/海水(4)/礁石(5)/塔基(9)/塔身(10)/灯室(11)/栅栏(12)/旧物(13) 全碰撞
      // 碎石(14)/湿沙海藻(15)/灌木(16) 仅装饰不碰撞
      this.wallsLayer.setCollision([3, 4, 5, 9, 10, 11, 12, 13]);
    } else {
      this.wallsLayer.setCollisionBetween(9, 13);
    }

    // 存档恢复：仅在农场场景首次进入时检查
    // 若存档存在则加载数据，若玩家上次在其他场景则切换过去
    if (this.mapKey === 'farm' && hasSave() && !this.spawn) {
      const saveData = load();
      if (saveData) {
        apply(saveData);
        // BUG-FIX（P1-5）：坏档可能携带非法场景 key（历史版本写入/手改档），直接 scene.start 会因
        // 目标场景不存在而黑屏（存档却"看起来完好"）。用场景管理器动态校验（自动反映注册场景，
        // 新增地图无需同步白名单）；非法值降级为留在 farm 并按存档位置出生。
        if (
          saveData.player.scene !== 'farm' &&
          this.scene.manager.getScene(saveData.player.scene)
        ) {
          this.scene.start(saveData.player.scene, {
            spawn: { x: saveData.player.x, y: saveData.player.y },
          });
          return;
        }
        // 农场场景：直接设置出生点
        this.spawn = { x: saveData.player.x, y: saveData.player.y };
      } else {
        // 版本不兼容：显示提示，清除旧存档
        const oldVer = getLastIncompatibleVersion();
        if (oldVer) {
          this.showDialogueText(
            `存档版本不兼容（v${oldVer}→v${SAVE_VERSION}），已自动重置。`,
          );
          clearIncompatibleVersion();
        }
      }
    }

    // 输入管理器（统一键盘/触屏输入）
    this.inputManager = new InputManager(this.input.keyboard!);

    // 物理世界边界（必须在玩家创建之前设置，否则 setCollideWorldBounds 使用默认 800x600）
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // 玩家出生点：传入的 spawn 或地图中央
    const sx = this.spawn?.x ?? map.widthInPixels / 2;
    const sy = this.spawn?.y ?? map.heightInPixels / 2;
    this.player = new Player(this, sx, sy, this.inputManager);
    this.player.setDepth(10);

    // 玩家与墙体碰撞
    this.physics.add.collider(this.player, this.wallsLayer);

    // 摄像机：跟随 + 限制在地图内 + 放大2倍
    this.cameras.main.setZoom(2);
    // 注：CameraDirector + UIBus 已在 create() 顶部初始化（L1201-1219）
    // 室内小地图（house/elder_house）宽度或高度小于相机可视区（zoom2 下可视宽 = 逻辑宽/2 ≈ 400~666px）：
    // 若仍 setBounds 会把相机滚动钳制回 0，地图贴在左上角露出背景（安卓反馈：室内地图未居中）。
    // 这里对小于相机视野的地图关闭 bounds+跟随，居中显示。
    const camViewW = this.cameras.main.width / this.cameras.main.zoom;
    const camViewH = this.cameras.main.height / this.cameras.main.zoom;
    // 相机跟随策略（屏幕适配后逻辑宽随视口扩展，如 1280×720 → 1067，视野 533）：
    // - 地图大于视野（farm 640×400）：setBounds + startFollow 正常跟随（玩家始终居中，边界钳制）
    // - 地图小于视野（gate/town/forest/mine 480×320、house/elder_house 320×240）：
    //     * 户外小地图：startFollow 跟随玩家（镜头跟着主角），**不 setBounds**——setBounds 在
    //       视野大于地图时 clamp 异常会把相机推出地图边界（玩家出屏/画面偏移）。
    //     * 室内（house/elder_house）：固定居中（小房间整间可见，跟随无意义）。
    //   offset 必须为 0：Phaser scroll = follow.x - width/2，渲染 /zoom 后玩家自然居中，
    //   非零 offset 会破坏居中（玩家偏到画布边缘）。
    const isIndoorSmall = (this.mapKey === 'house' || this.mapKey === 'elder_house') &&
      (map.widthInPixels < camViewW || map.heightInPixels < camViewH);
    if (isIndoorSmall) {
      this.cameras.main.stopFollow();
      this.centerCameraOn(map.widthInPixels / 2, map.heightInPixels / 2);
      this.centerSmallMap = true;
    } else {
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1, 0, 0);
      this.centerSmallMap = false;
      // 仅地图大于视野时启用边界钳制（视野 > 地图时 setBounds 会 clamp 异常）
      if (map.widthInPixels >= camViewW && map.heightInPixels >= camViewH) {
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
      }
    }

    // DOM HUD 覆盖层（扛 zoom + scrollFactor 兼容问题，和 ShopPanel 一样走 DOM）
    // 先移除旧 HUD（场景切换时避免 DOM 泄漏）
    const oldHud = document.getElementById('hud-overlay');
    if (oldHud) oldHud.remove();

    const container = document.getElementById('game-container')!;
    this.hudDom = document.createElement('div');
    this.hudDom.id = 'hud-overlay';
    this.hudDom.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:0;pointer-events:none;z-index:5;font-family:Arial,sans-serif';
    container.appendChild(this.hudDom);

    // 左上角：时间 + 经验条
    this.hudTimeDom = document.createElement('div');
    this.hudTimeDom.style.cssText =
      'position:absolute;top:4px;left:8px;color:#fff;font-size:13px;text-shadow:1px 1px 0 #000';
    this.hudDom.appendChild(this.hudTimeDom);

    // XP 经验条容器（时间下方）
    const xpBar = document.createElement('div');
    xpBar.style.cssText =
      'position:absolute;top:22px;left:8px;width:180px;height:8px;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);border-radius:2px;overflow:hidden';
    this.hudDom.appendChild(xpBar);

    this.xpBarFill = document.createElement('div');
    this.xpBarFill.style.cssText =
      'width:0%;height:100%;background:linear-gradient(90deg,#4caf50,#8bc34a);transition:width 0.3s';
    xpBar.appendChild(this.xpBarFill);

    this.xpBarLabel = document.createElement('div');
    this.xpBarLabel.style.cssText =
      'position:absolute;top:20px;left:192px;color:#ffe082;font-size:10px;text-shadow:1px 1px 0 #000;white-space:nowrap';
    this.hudDom.appendChild(this.xpBarLabel);

    // 中上：区域名 + 操作提示
    this.hudAreaDom = document.createElement('div');
    this.hudAreaDom.style.cssText =
      'position:absolute;top:24px;left:50%;transform:translateX(-50%);color:#fff;font-size:13px;text-shadow:1px 1px 0 #000;white-space:nowrap';
    this.hudDom.appendChild(this.hudAreaDom);

    // 农场触屏：种子切换按钮（点击弹作物选择器预选播种作物；桌面保留 R 键）
    if (this.mapKey === 'farm') {
      this.seedSwitchBtn = document.createElement('div');
      this.seedSwitchBtn.id = 'seed-switch-btn';
      this.seedSwitchBtn.style.cssText =
        'position:absolute;top:46px;left:8px;pointer-events:auto;cursor:pointer;' +
        'background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.35);border-radius:6px;' +
        'color:#fff;font-size:12px;padding:3px 8px;text-shadow:1px 1px 0 #000;' +
        'user-select:none;-webkit-user-select:none';
      this.seedSwitchBtn.textContent = '';
      this.seedSwitchBtn.addEventListener('click', () => this.showCropPicker());
      this.hudDom.appendChild(this.seedSwitchBtn);
    }

    // 归星录·相簿入口（所有场景可见；桌面/移动端均可点）
    const albumBtn = document.createElement('div');
    albumBtn.id = 'album-btn';
    albumBtn.style.cssText =
      'position:absolute;top:78px;left:8px;pointer-events:auto;cursor:pointer;' +
      'background:rgba(20,24,46,0.75);border:1px solid rgba(122,138,208,0.5);border-radius:6px;' +
      'color:#b8c8ff;font-size:12px;padding:3px 8px;text-shadow:1px 1px 0 #000;' +
      'user-select:none;-webkit-user-select:none';
    albumBtn.textContent = '📖 归星录';
    albumBtn.addEventListener('click', () => this.openPhotoAlbum());
    albumBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.hudDom.appendChild(albumBtn);

    // 自然记录图鉴入口（P1 信息展示层，2026-08-16）：所有场景可见
    const discoveryBtn = document.createElement('div');
    discoveryBtn.id = 'discovery-btn';
    discoveryBtn.style.cssText =
      'position:absolute;top:104px;left:8px;pointer-events:auto;cursor:pointer;' +
      'background:rgba(22,30,26,0.75);border:1px solid rgba(122,170,138,0.5);border-radius:6px;' +
      'color:#a8d8b8;font-size:12px;padding:3px 8px;text-shadow:1px 1px 0 #000;' +
      'user-select:none;-webkit-user-select:none';
    discoveryBtn.textContent = '📗 自然记录';
    discoveryBtn.addEventListener('click', () => this.openDiscoveryPanel());
    discoveryBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.hudDom.appendChild(discoveryBtn);

    // HUD 功能菜单入口（2026-08-16 移动端优先）：收纳归星录/自然记录/小镇计划/声音等
    const hudMenuBtn = document.createElement('div');
    hudMenuBtn.id = 'hud-menu-btn';
    const menuBtnSize = menuIsMobile() ? 44 : 28;
    hudMenuBtn.style.cssText =
      `position:absolute;top:calc(16px + env(safe-area-inset-top, 0px));right:calc(64px + env(safe-area-inset-right, 0px));` +
      `width:${menuBtnSize}px;height:${menuBtnSize}px;pointer-events:auto;cursor:pointer;` +
      'background:rgba(20,24,46,0.75);border:1px solid rgba(122,138,208,0.5);border-radius:8px;' +
      'color:#b8c8ff;display:flex;align-items:center;justify-content:center;' +
      'user-select:none;-webkit-user-select:none';
    hudMenuBtn.textContent = '☰';
    hudMenuBtn.addEventListener('click', () => this.toggleHudMenu());
    hudMenuBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.hudDom.appendChild(hudMenuBtn);

    // 注册菜单条目（打开时重绘；小镇计划等按解锁状态出现）
    const menuItems: Array<{ id: string; label: string; icon: string; onClick: () => void }> = [
      { id: 'album', label: '归星录', icon: '📖', onClick: () => this.openPhotoAlbum() },
      { id: 'discovery', label: '自然记录', icon: '📗', onClick: () => this.openDiscoveryPanel() },
    ];
    if (this.artShowUnlocked || (isChapterAtLeast(CHAPTER_1) && hasTriggered('ch1_spring_fair'))) {
      menuItems.push({ id: 'town_plan', label: '小镇计划', icon: '🗓', onClick: () => this.openTownPlan() });
    }
    menuItems.push({
      id: 'sound',
      label: isSoundEnabled() ? '声音：开' : '声音：关',
      icon: isSoundEnabled() ? '🔊' : '🔇',
      onClick: () => this.toggleSound(),
    });
    setHudMenuItems(menuItems);

    // 小镇计划入口（Feature-XXX，2026-08-15）：春日大集后出现；只读观察"小镇正在发生什么"
    if (this.artShowUnlocked || (isChapterAtLeast(CHAPTER_1) && hasTriggered('ch1_spring_fair'))) {
      const planBtn = document.createElement('div');
      planBtn.id = 'town-plan-btn';
      planBtn.style.cssText =
        'position:absolute;top:130px;left:8px;pointer-events:auto;cursor:pointer;' +
        'background:rgba(20,24,46,0.75);border:1px solid rgba(216,184,120,0.5);border-radius:6px;' +
        'color:#e8d8a8;font-size:12px;padding:3px 8px;text-shadow:1px 1px 0 #000;' +
        'user-select:none;-webkit-user-select:none';
      planBtn.textContent = '🗓 小镇计划';
      planBtn.addEventListener('click', () => this.openTownPlan());
      planBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      this.hudDom.appendChild(planBtn);
    }

    // 声音总开关（2026-08-13 制作人：游戏音乐暂时屏蔽 + 重新打开开关）
    // 全端可见可点（hudDom 桌面/移动端统一挂载）；safe-area 适配刘海屏；避开 StoryDialogue 右上 Skip/回顾
    const soundBtn = document.createElement('div');
    soundBtn.id = 'sound-toggle-btn';
    soundBtn.style.cssText =
      'position:absolute;top:calc(16px + env(safe-area-inset-top, 0px));right:8px;pointer-events:auto;cursor:pointer;' +
      'background:rgba(20,24,46,0.75);border:1px solid rgba(122,138,208,0.5);border-radius:6px;' +
      'color:#b8c8ff;font-size:12px;padding:3px 8px;text-shadow:1px 1px 0 #000;' +
      'user-select:none;-webkit-user-select:none';
    soundBtn.textContent = isSoundEnabled() ? '🔊 声音开' : '🔇 声音关';
    soundBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    soundBtn.addEventListener('click', () => {
      this.toggleSound();
      soundBtn.textContent = isSoundEnabled() ? '🔊 声音开' : '🔇 声音关';
    });
    this.hudDom.appendChild(soundBtn);

    // 任务追踪卡（UI 升级 v1.0：归星记录册——旧纸黄装订条 + 深夜灰纸页）
    // PC 端完整卡片；移动端紧凑单行（屏幕窄，右侧已有触屏任务按钮）
    this.hudQuestDom = document.createElement('div');
    this.hudQuestDom.id = 'quest-track-card';
    this.hudQuestDom.style.cssText =
      'position:absolute;left:8px;top:104px;pointer-events:none;' +
      'background:radial-gradient(1px 1px at 20% 30%,rgba(216,196,154,0.4) 50%,transparent 51%),' +
      'repeating-linear-gradient(0deg,rgba(255,255,255,0.015) 0 2px,transparent 2px 4px),' +
      'rgba(36,41,54,0.86);' +
      'border:1px solid rgba(216,196,154,0.4);' +
      'border-left:3px solid #d8c49a;border-radius:8px;padding:6px 10px;' +
      "font-family:'Noto Sans SC','Source Han Sans SC','PingFang SC','Microsoft YaHei',sans-serif;" +
      'max-width:260px;box-shadow:inset 0 1px 4px rgba(0,0,0,0.3),0 2px 8px rgba(0,0,0,0.4);';
    this.hudDom.appendChild(this.hudQuestDom);

    this.updateHUD();
    this.updateQuestHUD(); // E-05：创建时即显示当前目标（教程期=教程步骤，主线期=主线目标）
    this.lastQuestObj = this.hudQuestDom.textContent?.replace('任务：', '') ?? '';

    // 记录初始帧时间戳
    this.lastFrameTime = this.time.now;

    // 农场场景：渲染农田格子覆盖层
    if (this.mapKey === 'farm') {
      this.setupFarmTiles();
      // 砍树：创建树木精灵 + 兼容旧存档赠送斧头
      this.setupTrees();
      // 树视觉升级：成片装饰树丛（多树种，集中成林，纯视觉）
      this.setupFarmTreeGroves();
      if (isTutorialDone() && getItemCount('old_axe') === 0) {
        addItem('old_axe', 1);
      }

      // Demo 结尾：观星点视觉（主线完成 + 夜晚时显示）
      this.createStargazePoint();
      // 观星夜星空系统（MVP）
      this.createStarField();

      // 农田选中高亮（亮黄色边框 + 填充，跟随玩家面向的格子；可操作时才显示）
      // 移动端适配：加大高亮尺寸(+4px)让玩家更容易看清目标格
      this.targetHighlight = this.add.rectangle(0, 0, TILE_SIZE + 4, TILE_SIZE + 4, 0xfff176, 0.35);
      this.targetHighlight.setStrokeStyle(2, 0xffffff, 0.9);
      this.targetHighlight.setDepth(8);
      this.targetHighlight.setVisible(false);
      // 种植区域交互优化 v0.1：Plot 区域高亮（教程完成后使用，位于同一深度层）
      this.plotHighlight = this.add.graphics();
      this.plotHighlight.setDepth(8);
      this.plotHighlight.setVisible(false);
      // 第一章 P2 钓鱼扩展（2026-08-14）：farm 池塘稀有钓点（靠水边按 E 钓鱼，见 setupFishingSpot）
      this.setupFishingSpot();
    }

    // 出口指示箭头（所有地图场景，帮助玩家找到出口）
    this.setupExitIndicators();

    // 第一章 P2 生活采集 Phase 1（2026-08-14 设计稿 v0.1）：
    // farm/town/forest 三场景手工采集点，程序合成小群落视觉（零资产）。
    // setupGatherPoints 内部通过 getGatherPointsForScene 判断，无采集点的场景自动跳过。
    this.setupGatherPoints();

    // 创建当前场景的 NPC（根据 TimeSystem 时间判定 location）
    this.setupNPCs();

    // 镇长不在镇上时，显示提示物品（指引玩家去镇长家）
    // 2026-08-13 P0 残留清理：chapter>=1（第一章）后镇长长期在镇上，且第0章"去找镇长"导航已过时
    if (this.mapKey === 'town' && !isChapterAtLeast(CHAPTER_1)) {
      this.setupElderHouseHint();
    }

    // M1-2 农场动态氛围（方案 B：水塘涟漪 / 花草摆动 / 暖色光斑，零资源纯代码）
    if (this.mapKey === 'farm') {
      this.setupFarmAmbience();
      // 西侧海湾已撤除（2026-08-11 制作人反馈"灯塔影子效果不好"）：石墙堵回，灯塔不可见；
      // 2026-08-14 灯塔"世界回应"线（制作人拍板）：春日集后远处灯塔亮起（不拆墙、不开放入口）
      this.setupLighthouseDistant();
      // 第三章幕一（制作人 2026-08-31 拍板开工）：灯塔出口开放 → 重建海湾缺口视觉
      if (this.isLighthouseUnlocked()) this.setupFarmWestGap();
      if (this.isLighthouseUnlocked()) this.setupCh3ArchiveTripod();
      this.setupCh3Shards(); // 幕四碎片（farm=海湾缺口，段3 后可见）
    }

// 镇长家室内氛围（暖炉辉光/浮尘/门口柔光，零资源纯代码）
if (this.mapKey === 'elder_house') {
this.setupElderHouseAmbience();
// 钓鱼 Phase 4：老张收黄昏鱼后，夜晚老张家灯亮（暖光）
this.setupElderNightLamp();
// 采集流向扩展：老张收野蘑菇后，老家门口晾蘑菇串（世界变化，见 setupGatherMushroomDrying）
this.setupGatherMushroomDrying();
}

    // 灯塔轻量版（2026-08-10 制作人解冻）：探索交互点（航海日志/铭牌/望远镜）
    if (this.mapKey === 'lighthouse') {
      this.setupLighthouseExploration();
      // 视觉打磨（2026-08-10 制作人"功能可用→展示级"）：塔身层次/灯室强化/海岸环境/故事感/光影
      this.setupLighthouseVisuals();
      // 第三章幕一：开放后执灯人在塔内 + 首次进入演出
      if (this.isLighthouseUnlocked()) {
        if (!hasTriggered('ch3_gap_first')) {
          // 缺口首走时刻（地图开放与剧情开放的合龙点）：石墙的口子→亮着的灯塔
          triggerOnce('ch3_gap_first', () => {});
          showMemoryMoment('（石墙开了一口。路走到头，是那座亮着的灯塔。）');
        }
        this.setupCh3Keeper();
      this.setupCh3ArchiveTripod();
      this.setupCh3Shards(); // 幕四碎片（灯塔内，碰面后可见）
        // 陈叔点灯日常（制作人拍板人设："不负责讲故事，负责每天把灯点起来"）：夜幕首次目击
        if (!hasTriggered('ch3_keeper_dusk') && (getTime().hour >= 18 || getTime().hour < 6)) {
          triggerOnce('ch3_keeper_dusk', () => {});
          showMemoryMoment('（陈叔提着油壶上了灯室。每天一趟，风雨无阻。）');
        }
        this.tryCh3LighthouseArrival();
      }
    }

    // 青禾镇氛围（炊烟/窗灯/落叶，零资源纯代码）
    if (this.mapKey === 'town') {
      this.setupTownAmbience();
      // Phase 2 衰败态叙事物件补完（歪斜镇牌/空招牌/瓦砾，纯代码 Graphics，舞台块定义 S1/S2/S4）
      this.setupTownPhase2Details();
      if (this.isLighthouseUnlocked()) this.setupCh3ArchiveTripod();
      this.setupCh3Shards(); // 幕四碎片（town 无碎片，幂等）
      // 第三章幕三后半：照片传到镇上（注脚常驻）
      if (hasTriggered('ch3_town_react')) this.setupCh3BoardPhoto();
      // Phase 3 修复态 GameObjects（路灯/招牌/长椅/窗灯/花坛，拍板基线 §六）
      this.setupPhase3Restoration();
      // T3 小梅「小梅花」：小镇花圃种花互动点（一次性，读档恢复已开花视觉）
      this.setupGardenerPlum();
      // FEATURE-038 居民需求板（小镇广场右侧信息板交互物）
      this.setupResidentBoard();
      // 镇子商店门面（老板搬回镇上：关闭/营业两态视觉，入口=对话 shopkeeper）
      this.setupTownShop();
      // 第一章 P2-1 集市广场恢复（村长来访后解锁；荒废→摊位两态，见 setupMarketSquare）
      this.setupMarketSquare();
      // 第一章 P3 春日集：集市恢复后的夜晚进 town，镇上重新聚起人（克制版，见 trySpringFairSequence）
      this.time.delayedCall(1000, () => this.trySpringFairSequence());
// 第一章 P2 钓鱼 Phase 1（2026-08-14 制作人 Decision Override 启动）：
// S6 老河堤钓点交互物（靠近按 E 进入钓鱼状态机），见 setupFishingSpot
this.setupFishingSpot();
// 钓鱼放生彩蛋 v1.2：放生 2 天后河面鱼影（世界记得你的行为，见 setupReleasedFishShadows）
this.setupReleasedFishShadows();
// 钓鱼 Phase 4：阿风收黄昏鱼后，晚上河边生火烤鱼（"这次不会糊"，见 setupAdventurerCampfire）
this.setupAdventurerCampfire();
// 采集流向扩展：阿风收蒲公英后，河岸草丛冒出小蒲公英丛（世界变化，见 setupGatherDandelionPatch）
this.setupGatherDandelionPatch();
// 表现层实验：夜晚河边火堆四项视觉强化（见 setupNightCampfireVisuals）
this.setupNightCampfireVisuals();
// 生命化改造·河岸段：生活痕迹 + 岸线层次 + 前景芦苇（见 setupRiverbankLife）
this.setupRiverbankLife();
// 生命化改造·场景密度：空旷草地区补装饰簇（见 setupTownDensityClusters）
this.setupTownDensityClusters();
// 阶段4 中央广场生活化：石井 / 石凳 / 踩踏痕迹 / 夜晚灯柱（见 setupCentralPlaza）
this.setupCentralPlaza();
// town 下方西侧生活角美化：柴堆 / 晾衣绳 / 石凳 / 水桶 / 花丛 / 踩踏小路（见 setupTownBottomLife）
this.setupTownBottomLife();
// town 南郊自然美化：树木 / 花丛 / 草簇 / 石头 / 踩踏小路（见 setupTownSouthLife）
this.setupTownSouthLife();
// 小镇计划·星光艺术展：筹备/活动/永久状态挂载（见 setupArtShow）
this.setupArtShow();
// 小镇计划·秋日晒场（EventPlan 第二实例）：筹备/当天/永久状态挂载（见 setupDryyard）
this.setupDryyard();
// 秋日晒场：玉米首收 + 春日集后，傍晚进 town 软触发开场演出（镇民讨论→老张提起晒场，见 tryDryyardIntro）
this.time.delayedCall(1600, () => this.tryDryyardIntro());
// 第二章《故人远来》节拍2：广场老钟（修好前后两态；ch2ClockFixed 后整点报时）
this.setupCh2Clock();
// 种植升级 v2：萝卜赠予后的河边腌萝卜罐（世界留下痕迹）
this.setupCropLifeLeftovers();
// 居民需求系统升级：镇长灯笼 / 阿风小灶 / 老姜鱼篓（交付后世界变化）
this.setupReqLantern();
this.setupReqStove();
this.setupReqFishBasket();
    // 阶段3 光照：town 黄昏暖光（17:00-19:00，全屏暖橙 + 河面光斑）
    this.setupTownDuskOverlay();
}

    // 青禾河畔（2026-08-15 制作人拍板：第一章替代灯塔开放的可玩新地图）
    if (this.mapKey === 'qinghe_river') {
      // 河畔氛围（水波光斑/芦苇/萤火虫，零资产纯代码）
      this.setupQingheRiverAmbience();
      // 第三章幕三：来船已靠岸 → 常驻视觉重建（船 + 旅人）
      if (hasTriggered('ch3_ship_arrived')) { this.setupCh3Ship(); this.setupCh3StrangerNpc(); }
      // 幕三后半恢复：三机位已拍完但碰面未播（上次切图打断）→ 重新入队
      if (this.ch3ArchiveDoneCount() === 3 && !hasTriggered('ch3_captain_meet') && !this.ch3MeetQueued) {
        this.ch3QueueCaptainMeet();
      }
      if (hasTriggered('ch3_b_photo')) this.setupCh3PhotoPinned();
      this.setupCh3Shards(); // 幕四碎片（qinghe=栈板尽头，段2 后可见）
      // 钓鱼点（河岸码头旁）
      this.setupFishingSpot();
      // 码头修复交互点（木材×20 → 码头出现；Stage 1 垂直切片）
      this.setupQinghePierRestore();
      // 凉亭停留空间（视觉 + 交互一句）
      this.setupQinghePavilion();
      // 断桥视觉（未来果园预埋；locked 出口见 exits.ts）
      this.setupQingheBrokenBridge();
      // Stage 2：集市恢复后长椅/路灯/有人聊天（生活感）
      this.setupQingheStage2();
      // 果园预埋：断桥旁老周（白天，第二章钩子）
      this.setupQingheOldMan();
      // NPC 剧情覆盖日程：河畔夏雅（16-18 时看水）
      this.setupRiversideXiya();
      // 第二章《故人远来》：远处灯塔远景（scrollFactor 0，入海口方向，与 farm 灯塔同一座）
      this.setupCh2LighthouseDistant();
      // 第二章《故人远来》节拍3：老船长旧船靠岸（ch2ClockFixed 后出现；修好前=破船+修船剪影）
      this.setupCh2Captain();
    }

    // gate 庄园大门美术升级（生活杂物/小动物/夜间门灯，零资源纯代码；教程逻辑零触碰）
    if (this.mapKey === 'gate') {
      this.setupGateDecorations();
    }

    // P1 家的音乐盒：老屋（house）音乐盒交互物 → 曲目收藏面板
    if (this.mapKey === 'house') {
      this.setupMusicBox();
    }

    // P0 爷爷的归星包裹：老屋（house）旧木箱交互物（第一次进屋出现，一次性领取，见 setupGrandpaGift）
    if (this.mapKey === 'house' && !hasTriggered('grandpa_gift_opened')) {
      this.setupGrandpaGift();
    }

    // 第一章 P1-1 老屋整理：4 个整理交互点（章节门禁 chapter ≥ 1，见 setupHouseTidy）
    if (this.mapKey === 'house') {
      this.setupHouseTidy();
// 第一章 P1-2 村长来访：老屋整理完成后的下一晚，进老屋触发（见 tryElderVisitSequence）
this.tryElderVisitSequence();
// 第一章 P1-3 夏雅《旧日留影》：老屋整理完成后，柜子位置出现翻柜子标记（见 trySideXiyaOldShadow）
this.setupXiyaOldShadow();
// 钓鱼 Phase 4：老张收黄昏鱼后，老屋门轴修好（小视觉）
this.setupFishDoorHinge();
}

    // M1-3 爷爷旧花园恢复点（玩家清理荒废角落 → 环境变化 + 存档持久化）
    if (this.mapKey === 'farm') {
      this.setupGardenRestore();
    }

    // FEATURE-037 老屋修复（farm 左下角木屋，资源交付 → 外观替换 + 存档持久化）
    if (this.mapKey === 'farm') {
      this.setupOldHouseRestore();
      // T3 夏雅「整理旧照片」：老屋门口互动点（一次性，读档恢复已完成态）
      this.setupXiyaPhoto();
      // 邮箱系统（收到爷爷的信后解锁）：老屋门口东侧信箱 + 来信队列
      this.setupMailbox();
    }

// P2 农场复兴视觉化（菜园层次/工具区/树荫/碎石小路，荒废→复兴两态，与 FEATURE-037 联动）
if (this.mapKey === 'farm') {
this.setupFarmDecorations();
// 花田支线：farm 左上角花田（荒废/盛开两态，读档恢复）
this.setupGardenerField();
// 钓鱼 Phase 4：小梅收河虾后，花田旁摆小饭桌
this.setupFishTable();
// 采集流向扩展：小梅收野莓后，花田旁摆野莓篮（世界变化，见 setupGatherBerryBasket）
this.setupGatherBerryBasket();
// 采集流向扩展：夏雅收小野花后，老屋窗台插花（世界变化，见 setupXiyaWindowFlower）
this.setupXiyaWindowFlower();
// 采集流向扩展：老周收小树枝后，老屋门口挂小木鸟（世界变化，见 setupGatherWoodenStarlingToy）
this.setupGatherWoodenStarlingToy();
// 种植升级 v2 切片B：番茄×夏雅「她记得」后，农田北缘番茄架（植物改变空间）
this.setupTomatoTrellis();
// 居民需求系统升级：小梅木材交付后花田旁花架；老周木材交付后老屋门框修好
this.setupReqFlowerTrellis();
this.setupReqDoorFrame();
// 土地回应系统 v1.4：农田"活过来"后的蝴蝶/蜜蜂（世界回应，读档恢复）
this.setupFieldLife();
}

    // day2 清晨「岛屿的第一声回应」：睡醒后切场景/重进 farm 时尝试触发（trySleep 挂钩点在睡觉时）
    if (this.mapKey === 'farm') {
      // 第0章「回到归星岛」（制作人 2026-08-10 拍板：章节仪式感）：首次踏入归星岛弹 Banner
      // D-025 时序红线（2026-08-11）：当前 Demo 全为第0章《归星》，观星夜之后才进第1章 → 显示 CHAPTER 0
      // 一次性：triggerOnce('chapter1_arrival') 持久化判重（key 保留避免旧档重复触发）；文案制作人定稿，不扩写。
      this.time.delayedCall(450, () => {
        // 章节门禁：仅第0章（观星夜前）首次踏入归星岛弹 Banner；第一章不再显示 CHAPTER 0 标识（Dev Hub 跳档同理）
        if (isChapterAtLeast(CHAPTER_1)) return;
        triggerOnce('chapter1_arrival', () => {
          showChapterBanner({
            chapter: 'CHAPTER 0',
            title: '回到归星岛',
            subtitle: '这座岛，好像比记忆里安静了很多。',
          });
        });
      });
      this.time.delayedCall(900, () => this.tryFirstMorningSequence());
      // FEATURE-041 木匠回归演出：老屋修复后当晚/次日进入 farm 时尝试触发（与清晨剧情各自判重隔离）
      this.time.delayedCall(950, () => this.tryCarpenterReturn());
      // 反馈 #28 阿风欢迎「你回来了！」：去过镇上后回 farm 尝试触发（依赖 ch1TownIntroDone，错开清晨演出）
      this.time.delayedCall(1000, () => this.tryAdventurerWelcome());
    }

    // 自动农业机器人（v0.6 庄园自动化 MVP：从存档恢复机器人视觉）
    if (this.mapKey === 'farm') {
      this.setupRobots();
    }

    // FEATURE-036 旧农业机器人（花园恢复后出现，靠近修复获得；一次性内存 flag）
    if (this.mapKey === 'farm') {
      this.setupOldRobot();
    }

    // 第一章：首次进入小镇触发剧情（教程完成后、且从未触发过）
    if (this.mapKey === 'town' && isTutorialDone() && !isCh1TownIntroDone()) {
      if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
      markCh1TownIntroDone();
      this.time.delayedCall(600, () => {
        this.storyDialogue!.play(TOWN_INTRO_DIALOGUE, () => {
          this.updateHUD();
        });
      });
    }

    // 森林场景：创建星之碎片采集点（仅 accepted 状态显示）
    if (this.mapKey === 'forest') {
      this.setupShard();
      this.setupOldTree();
      // FEATURE-037 后山道路修复（forest 底部空地通道，资源交付 → 铺路 + 存档持久化）
      this.setupForestRoadRestore();
      // 试玩-11 森林内容填充：氛围装饰（萤火虫/落叶/野花，零资源）
      this.setupForestAmbience();
      // P0.5 世界规律引导：雨天第一次进森林 → 环境暗示（"地上好像多了些东西"）
      this.tryRainForestEntranceHint();
      // v0.10.2 第二层：废弃观景台（环境铺垫，靠近一次性触发 FOREST_LOOKOUT_DIALOGUE）
      this.setupForestLookout();
    }

    // 矿洞场景：创建矿脉精灵
    if (this.mapKey === 'mine') {
      this.setupOres();
      // T3 老张「矿灯」：矿洞独立点灯点（一次性，读档恢复已点亮视觉）
      this.setupMinerLamp();
    }

    // 教程设置（大门地图 + 农场）
    if ((this.mapKey === 'gate' || this.mapKey === 'farm') && !isTutorialDone()) {
      this.setupTutorial();
    }

    // v0.5.3 剧情密度 E1：教程完成后，清晨（06-08 时）在农场出现夏雅（纯陪伴事件，非任务）
    if (this.mapKey === 'farm' && isTutorialDone()) {
      this.setupDawnXiya();
      this.setupEveningXiya();
    }

    // D-011 夏雅《春深有信·一》：剧情专线（花田边剧情夏雅，下午/傍晚时段，未完成时生成）
    if (this.mapKey === 'farm' && isTutorialDone()) {
      this.setupLetterXiya();
    }

    // D-011 夏雅《春深有信·二 花期未至》：剧情专线（旧广场剧情夏雅，S1→S8+尾声，stage 驱动）
    // 前置门禁（CURRENT_TASK §衔接设计 v1.1 拍板）：·一 完成 + 集市恢复（marketSquare）
    if (this.mapKey === 'town' && isTutorialDone()) {
      this.setupBloomXiya();
    }

    // v0.5.3 剧情密度 E5：爷爷的笔记（庄园角落可读物件，多条轮换、不解释）
    if (this.mapKey === 'farm') {
      this.setupGrandpaNote();
    }

    // P0-5 农场回暖 v2：星之碎片交付后（farmWarm 已标记），农场展示暖色环境反馈。
    // 传玩家位置为第一幕光晕扩散中心——交付后首次回 farm（farm_warm_intro 首播）时
    // 从玩家所在处扩散"暖光迎上来"，叙事上 = 交付完成回到农场的情绪落点。
    if (this.mapKey === 'farm' && isRestored('farmWarm')) {
      this.setupFarmWarm(this.player.x, this.player.y);
    }

    // 触屏控件（摇杆+交互按钮，DOM 单例；移动端额外显示背包按钮）
    this.touchControls = new TouchControls(this, this.inputManager, () => this.tryOpenBackpack(), () => this.tryOpenQuest());
    // 农场场景操作按钮语义为「使用工具」，其余场景保持「交互」（仅影响按钮文字，逻辑不变）
    setActionButtonLabel(this.mapKey === 'farm' ? '使用工具' : '交互');
    // 移动端点击种田：触屏设备在农场点击可操作的农田格子 → 直接执行操作
    // （DOM 按钮/摇杆区域 pointer-events:auto 会拦截事件，不会落到此处）
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handleFarmTap(pointer);
    });
    // 商店面板（DOM 覆盖层；数据变化时刷新 HUD 金币显示；关店时清理输入残留）
    this.uiBus.registerShopPanel(new ShopPanel(
      () => this.updateHUD(),
      () => {
        // 关店清理：丢弃开店期间残留的 E 键，防止下帧立即重开商店
        this.inputManager.clearAction();
        // 重置帧计时，防止关店后时间跳跃（lastFrameTime 仍停在开店前）
        this.lastFrameTime = performance.now();
      },
      // 购买回调：通知每日任务 + 自动选中刚买的种子（HUD「种子」按钮立即显示新种子）
      (itemId: string, _count: number) => {
        onDQBuyShop(1);
        this.updateDailyQuestPanel();
        const bought = itemId.replace(/_seed$/, '') as CropType;
        if (CROP_TYPES.includes(bought)) this.selectedCropType = bought;
        this.updateHUD();
      },
      // 卖出回调：通知每日任务
      (count: number) => {
        // T3.5 前置：卖出过作物即置位（会话级），商店老板「镇子热闹了」可触发
        if (count > 0) this.shopSoldOnce = true;
        onDQSellShop(count);
        this.updateDailyQuestPanel();
      },
    ));

    // 背包面板（DOM 覆盖层；关包时清理 B 键残留；使用钥匙回调）
    this.uiBus.registerBackpackPanel(new BackpackPanel(
      () => {
        this.inputManager.clearAction();
        this.lastFrameTime = performance.now();
      },
      () => this.useManorKey(),
      () => this.updateHUD(),
      () => this.deployRobot(),
    ));
    // 任务面板（v0.5.3-B 任务入口化；关面板清理 J 键残留）
    this.uiBus.registerQuestPanel(new QuestPanel(
      () => {
        this.inputManager.clearAction();
        this.lastFrameTime = performance.now();
      },
      () => {
        this.updateHUD();
        this.updateDailyQuestPanel();
      },
      // 支线任务状态注入（结构化类型，QuestPanel 避免 import MapScene 循环依赖）
      () => ({
        sideXiyaGardenAsked: this.sideXiyaGardenAsked,
        sideXiyaGardenDone: this.sideXiyaGardenDone,
        sideElderTeaAsked: this.sideElderTeaAsked,
        sideElderStarDone: this.sideElderStarDone,
        sideXiyaPhotoAsked: this.sideXiyaPhotoAsked,
        sideXiyaPhotoDone: this.sideXiyaPhotoDone,
        sideXiyaOldShadowAsked: this.sideXiyaOldShadowAsked,
        sideXiyaOldShadowDone: this.sideXiyaOldShadowDone,
        sideMinerLampAsked: this.sideMinerLampAsked,
        sideMinerLampDone: this.sideMinerLampDone,
        sideGardenerPlumAsked: this.sideGardenerPlumAsked,
        sideGardenerPlumDone: this.sideGardenerPlumDone,
        sideGardenerFieldAsked: this.sideGardenerFieldAsked,
        sideGardenerFieldDone: this.sideGardenerFieldDone,
        sideShopCropAsked: this.sideShopCropAsked,
        sideShopCropDone: this.sideShopCropDone,
        xiyaLetterAsked: this.xiyaLetterAsked,
        xiyaLetterDone: this.xiyaLetterDone,
        xiyaBloomAsked: this.xiyaBloomAsked,
        xiyaBloomDone: this.xiyaBloomDone,
      }),
    ));
    // E-09 消磨时间：移动端等待按钮 → 打开等待面板
    setWaitHandler(() => this.tryOpenWait());
    // 农场升级通知（升级时显示气泡提示）
    setOnLevelUp((newLevel: number) => {
      this.showDialogueText(`农场升级！Lv.${newLevel}`);
      this.updateTimeHUD();
    });

    // 每日任务：刷新并渲染面板
    refreshDailyQuests();
    this.createDailyQuestPanel();
    // 需求板引导任务：首次进小镇注入「小镇需求板」引导（必须在 refreshDailyQuests 之后，
    // 否则会被任务池重建清掉；已完成过不再投）
    if (this.mapKey === 'town' && !hasTriggered('board_quest_done')) injectBoardGuideQuest();

    // P1-1 桌面端快捷键提示（J 任务 / B 背包）：首次进入地图显示，使用后本局关闭
    this.setupShortcutHint();

    // 天气系统：检查当前天气状态并设置雨天效果
    this.setupWeather();

    // 离开页面前自动存档（beforeunload + pagehide；pagehide 兜底移动端，只注册一次）
    if (MapScene._beforeUnload) {
      window.removeEventListener('beforeunload', MapScene._beforeUnload);
      window.removeEventListener('pagehide', MapScene._beforeUnload);
    }
    MapScene._beforeUnload = () => {
      // BUG-046 修复：删档后抑制自动存档，防止 beforeunload 重新写入存档
      if (isAutoSaveSuppressed()) return;
      if (this.player && this.player.active) {
        save({
          x: this.player.x, y: this.player.y,
          scene: this.mapKey, facing: this.player.facing,
          dailyQuest: getDailyQuestSaveData(),
        });
      }
    };
    window.addEventListener('beforeunload', MapScene._beforeUnload);
    window.addEventListener('pagehide', MapScene._beforeUnload);

    // 页面隐藏时停环境音（省电 + 防后台爆音），回前台按当前地图恢复
    if (MapScene._visibilityHandler) {
      document.removeEventListener('visibilitychange', MapScene._visibilityHandler);
    }
    MapScene._visibilityHandler = () => {
      if (document.hidden) {
        AmbienceSystem.pause();
      } else if (this.scene.isActive(this.scene.key)) {
        AmbienceSystem.start(this.mapKey, getTime().hour);
      }
    };
    document.addEventListener('visibilitychange', MapScene._visibilityHandler);

    // 淡入过渡（与出口切换的 fadeOut 配对，避免切图瞬间黑屏）
    this.cameras?.main?.fadeIn(300, 0, 0, 0);

    // 环境音：进入地图按 mapKey + 当前小时启动氛围音（白天鸟叫/夜晚虫鸣等）
    AmbienceSystem.start(this.mapKey, getTime().hour);
    // BGM 声音补全 v1.0（2026-08-09）：青禾镇白天播专属日常 BGM（夜晚保持观星音乐统一夜景氛围）
    // v0.11（P0.5 音乐优先级）：进图统一走 playSceneBgm——剧情 > 音乐盒"我的歌" > 地图默认
    const mHour = getTime().hour;
    MusicSystem.playSceneBgm(this.mapKey, mHour);
  }

  /**
   * BUG-FIX（B3/B4）：统一存档入口（带场景存活守卫）。
   * 延迟回调（对白 onComplete / delayedCall / tween onComplete / setTimeout / playMemoryFlashback
   * 回调等）可能在场景 shutdown 后迟到，此时 this.player 已失效或坐标过期，
   * 直接 save 会以过期对象写档。守卫范式复用 beforeunload 处理器既有写法
   * （isAutoSaveSuppressed + player.active）；dailyQuest 由 SaveSystem 自动兜底，无需显式传入。
   */
  private saveAtPlayer(): void {
    if (isAutoSaveSuppressed()) return;
    if (!this.player || !this.player.active) return;
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing });
  }

  /**
   * P1 委托 → CameraDirector.centerOn
   * 将相机中心对准世界坐标 (wx, wy)（zoom 内化）。
   */
  private centerCameraOn(wx: number, wy: number): void {
    this.cameraDirector.centerOn(wx, wy);
  }

  /**
   * P1 委托 → CameraDirector.panTo
   * 相机平滑移动到世界坐标 (wx, wy)（相机中心）。
   * v0.10.4 重写：tween + 手动 zoom 补偿，链式靠 tween onComplete。
   */
  private panCameraTo(wx: number, wy: number, duration: number, onComplete?: () => void): void {
    this.cameraDirector.panTo(wx, wy, duration, onComplete);
  }

  /**
   * P1 委托 → CameraDirector.zoomAt
   * 围绕世界点 (wx,wy) 缩放，保持该点始终在镜头中心。
   * preZoomStart: 停止 stargaze 慢横移 tween，避免 scrollX 双写冲突。
   */
  private zoomCameraAt(wx: number, wy: number, toZoom: number, duration: number, onComplete?: () => void): void {
    this.cameraDirector.zoomAt(wx, wy, toZoom, duration, onComplete, () => {
      this.stargazeDriftTween?.stop();
      this.stargazeDriftTween = null;
    });
  }

  update(timeMs: number): void {
    // create 失败：停止每帧逻辑（错误遮罩已显示，避免空引用持续抛错）
    if (this.createFailed) {
      console.log(`[DEBUG] update skipped: createFailed at ${this.mapKey}`);
      return;
    }

    // 小地图（地图小于相机视野）：相机已在地图中心固定居中（create 时设置），
    // 玩家在地图内活动不会出视野，无需每帧跟随——跟随反而会让画面随玩家滚动
    // （WASD 变成"移动镜头"）。centerSmallMap 保留为状态标记（探针 probe-indoor-center 读取）。
    void this.centerSmallMap;

    // 相簿解锁反馈：对话/闪回结束后再弹出（避免被全屏演出盖住）
    this.maybeShowPhotoUnlockToast();

    // ─── P7a: 交互门控检查（InteractionRouter 路由决策） ───
    // 构建门控快照 → InteractionRouter 判定 → MapScene 执行副作用
    const gate = this.interactionRouter.checkGate(this.buildGateSnapshot());

    switch (gate.type) {
      case 'block':
        // createFailed 已在上方单独处理
        return;

      case 'freeze_all':
        // 完全冻结：Demo 结算/相簿/图鉴/HUD菜单
        this.player.setVelocity(0, 0);
        this.inputManager.clearAction();
        return;

      case 'dialogue_only':
        // 只放行对话推进（观星夜/星光艺术展演出）
        this.player.setVelocity(0, 0);
        this.inputManager.clearAction();
        if (gate.scene === 'stargaze') {
          this.updateStarField();
          this.updateStargaze();
        }
        if (this.storyDialogue?.isOpen()) {
          this.inputManager.update();
          if (this.inputManager.consumeAction()) {
            this.storyDialogue.advance();
          }
        }
        return;

      case 'panel_open':
        // 面板打开：冻结玩家 + 对应键关闭
        this.player.setVelocity(0, 0);
        switch (gate.panel) {
          case 'resident':
            if (this.inputManager.consumeAction()) this.residentBoardPanel.close();
            break;
          case 'shop':
            if (this.inputManager.consumeAction()) this.shopPanel.close();
            break;
          case 'backpack':
            if (Phaser.Input.Keyboard.JustDown(this.inputManager.keyB)) this.backpackPanel.close();
            break;
          case 'quest':
            if (Phaser.Input.Keyboard.JustDown(this.inputManager.keyJ)) this.questPanel.close();
            break;
          case 'wait':
            if (Phaser.Input.Keyboard.JustDown(this.inputManager.keyT)) closeWaitPanel();
            break;
        }
        return;

      case 'none':
      default:
        // 无门控：继续正常 update 流程
        break;
    }

    // B 键打开背包（仅在未与其他面板交互时）
    if (Phaser.Input.Keyboard.JustDown(this.inputManager.keyB)) {
      this.inputManager.clearAction();
      this.hideShortcutHint(); // P1-1：快捷键使用后关闭首次提示
      this.backpackPanel.open();
      return;
    }

    // J 键打开任务面板
    if (Phaser.Input.Keyboard.JustDown(this.inputManager.keyJ)) {
      this.inputManager.clearAction();
      this.hideShortcutHint(); // P1-1：快捷键使用后关闭首次提示
      this.questPanel.open();
      return;
    }

    // T 键打开等待面板（E-09 消磨时间）
    if (Phaser.Input.Keyboard.JustDown(this.inputManager.keyT)) {
      this.inputManager.clearAction();
      this.tryOpenWait();
      return;
    }

    // R 键切换种子类型（仅农场，300ms 冷却）
    if (this.mapKey === 'farm' && Phaser.Input.Keyboard.JustDown(this.inputManager.keyR) && this.seedSwitchCooldown <= 0) {
      this.seedSwitchCooldown = 300;
      const idx = CROP_TYPES.indexOf(this.selectedCropType);
      this.selectedCropType = CROP_TYPES[(idx + 1) % CROP_TYPES.length];
      this.updateHUD();
    }

    // 计算 dt（ms），推进游戏时间；上限 1000ms 防止切后台回来一次性跳太多
    const rawDt = timeMs - this.lastFrameTime;
    const dtMs = Math.max(0, Math.min(rawDt, 1000));
    this.lastFrameTime = timeMs;
    timeTick(dtMs);
    
    // 日常事件触发：每小时检查一次是否有随机事件
    const curHour = getTime().hour;
    if (curHour !== this.lastHour) {
      this.lastHour = curHour;
      // 主线完成后：小时切换时刷新 HUD 目标文案（白天/夜晚文案不同）
      if (getQuestState() === 'completed') {
        const obj = getQuestObjective();
        if (obj !== this.lastQuestObj) {
          this.lastQuestObj = obj;
          this.updateQuestHUD();
        }
      }
      // 日常事件触发（30% 概率）
      if (isTutorialDone() && Math.random() < 0.3) {
        this.triggerDailyEvent();
      }
      // 天气状态更新（每小时检查一次）
      this.updateWeatherState();
    }
    // P0.5 世界规律引导：第一场雨 → 农场里小梅顺口提起。
    // 注意：不能挂在小时切换块里——阿风欢迎演出等自动对白会占住对话导致该帧被跳过，
    // 再等下一小时可能错过整个雨窗；每帧尝试 + 内部守卫（triggerOnce/会话防重/对白互斥）保证只播一次。
    this.tryRainMushroomHint();
    // 种子切换冷却递减
    if (this.seedSwitchCooldown > 0) this.seedSwitchCooldown -= dtMs;

    // 春日集低频重查（BUG-FIX 错过窗口）：原实现只在进 town 后 1 秒查一次——玩家
    // 白天/傍晚进镇、天黑了还没走，就永远错过这次性演出。每 60 真实秒重查一次
    // （含 springFairStoryOwed 补播路径），条件不满足时零成本返回。
    if (this.mapKey === 'town') {
      if (this.springFairRescanCooldownMs > 0) {
        this.springFairRescanCooldownMs -= dtMs;
      } else {
        this.springFairRescanCooldownMs = 60000;
        this.trySpringFairSequence();
      }
    }

    // 观星点显隐 + 呼吸动画（主线完成 + 夜晚时显示）
    this.updateStargaze();
    // 星空闪烁动画
    this.updateStarField();
    // P0-5 农场回暖 v2：暖度随时辰平滑趋近（第二幕时间感）+ 光尘密度微调
    this.updateFarmWarm();

    // 剧情对话打开时：禁止移动，E/空格推进对话
    if (this.storyDialogue) {
      if (this.storyDialogue.isOpen()) {
        // 对话打开期间 update 提前 return，各 checkXxxHint 不再执行；
        // 统一隐藏所有靠近提示，防止互动（按 E 查看/对话）后提示条残留。
        this.hideAllInteractHints();
        // 2026-08-16 体验修复：对话打开时 T 键也应能打开等待面板（消磨时间），
        // 否则玩家"想跳时间等雨/等傍晚"会被自动对白卡住（T 被吞，时间永远不跳）。
        if (Phaser.Input.Keyboard.JustDown(this.inputManager.keyT)) {
          this.inputManager.clearAction();
          this.tryOpenWait();
          return;
        }
        this.inputManager.update();
        this.player.setVelocity(0, 0);
        if (this.inputManager.consumeAction()) {
          this.storyDialogue.advance();
        }
        return;
      }
    }

    // 每帧更新输入（从键盘读移动向量到 moveX/moveY）
    this.inputManager.update();
    // 触屏摇杆拖动时覆盖键盘值（在 inputManager.update 之后、player.update 之前）
    this.touchControls.update();

    // M1-3 花园清理引导：玩家靠近花园区域时首次提示（教程完成后）
    if (this.mapKey === 'farm' && isTutorialDone() && !this.gardenHintShown && this.gardenRestore && this.gardenRestore.stage < 3) {
      const dx = this.player.x - this.gardenRestore.pos.x;
      const dy = this.player.y - this.gardenRestore.pos.y;
      if (dx * dx + dy * dy < 80 * 80) {
        this.gardenHintShown = true;
        this.showDialogueText(this.hintText(
          '这片旧花圃看起来可以清理一下……靠近按 [E] 试试',
          '这片旧花圃看起来可以清理一下……靠近点「交互」试试'
        ));
      }
    }

    // 2026-08-07 GPT 诊断落地 P1-3：猫靠近反馈（一次性，尾巴摆动 + 起身）
    if (this.mapKey === 'town' && this.townCats.length > 0) {
      for (const cat of this.townCats) {
        if (this.townCatReacted.has(cat._catKey)) continue;
        const dx = this.player.x - cat.x;
        const dy = this.player.y - cat.y;
        if (dx * dx + dy * dy < 42 * 42) {
          this.townCatReacted.add(cat._catKey);
          // 尾巴快速摆动两下 + 轻微起身（tween 链，幂等）
          this.tweens.add({
            targets: cat,
            angle: { from: -2, to: 2 },
            duration: 120, yoyo: true, repeat: 3, ease: 'Sine.InOut',
          });
          this.tweens.add({
            targets: cat, y: cat.y - 2,
            duration: 180, yoyo: true, repeat: 1, ease: 'Sine.InOut',
          });
        }
      }
    }

    // P1 未开放区域边界提示：靠近世界边界（非出口）轻提示一次；出口排除由方法内处理
    this.updateBoundaryTip();

    // FEATURE-038 需求板引导：首次靠近需求板时提示（会话级一次性，不入档）
    if (this.mapKey === 'town' && this.residentBoardMark && !this.residentBoardHintShown) {
      const dx = this.player.x - this.residentBoardMark.x;
      const dy = this.player.y - this.residentBoardMark.y;
      if (dx * dx + dy * dy < 96 * 96) {
        this.residentBoardHintShown = true;
        this.showDialogueText(this.hintText(
          '需求板：镇上的人把需要的东西写在上面。靠近按 [E] 查看。',
          '需求板：镇上的人把需要的东西写在上面。靠近点「交互」查看。'
        ));
      }
    }

    // 后山老树交互检测
    this.checkOldTreeInteract();
    // 老屋整理靠近提示（仅 house 场景，距离 + 对话状态门禁）
    this.checkHouseTidyHint();
    // 钓鱼老人老姜：作息显隐 + 靠近提示（优先级高于钓鱼提示，避免双提示叠屏）
    this.checkLaoJiangInteract();
    // 小镇计划·星光艺术展：素材箱/广场夏雅靠近提示 + 活动触发检测
    this.checkArtShowProximity();
    this.checkArtShowAuto();
    // 星光艺术展余波：旅人回访靠近提示（白天/傍晚在艺术角时）
    this.checkArtShowTravelerProximity();
    // 星光艺术展余波：庆典后夏雅靠近提示（白天/傍晚在艺术角时，与旅人提示互斥）
    this.checkArtShowAfterXiyaProximity();
    // 小镇计划·秋日晒场：征集筐/晒场夏雅/永久期老张靠近提示 + 当天演出触发检测
    this.checkDryyardProximity();
    this.checkDryyardAuto();
    // 第二章《故人远来》：节拍1 村民注意灯塔 / 节拍4 旅人随缘 / 节拍5 夜谈触发 / 节拍7 黑点
    this.checkCh2LighthouseTalked();
    this.checkCh2Stranger();
    this.checkCh3LhStage1(); // 灯塔叙事链·阶段1：玻璃被擦过（亮灯后→节拍1 前，farm 西侧）
    this.checkCh3ShipArrival(); // 第三章幕三：来船靠岸（黑点已见 + 灯塔开放后）
    this.checkCh3TownReact(); // 第三章幕三后半：照片传到镇上（注脚级，不决定走向）
    this.checkCh3ShardsDone();   // 幕四：碎片集齐 → 灯室结算
    this.checkCh3FinaleOpen();   // 幕五：归位窗口开启（夜 21+）
    this.checkCh3CaptainMeet();  // 幕三后半：碰面（armed → 码头播放）
    this.checkCh2NightTalk();
    this.checkCh2BlackDot();
    // 第二章节拍2：老钟整点报时（ch2ClockFixed 后，轻提示不叠屏）
    this.checkCh2ClockChime();
    // 第二章：老钟/老船长靠近提示（共用一条 DOM）
    this.checkCh2ProximityHint();
    // 阶段3 光照：town 黄昏暖光按小时切换（小时内幂等）
    this.updateTownDuskOverlay();
    // 钓鱼 Phase 1 靠近提示（仅 town 场景，S6 老河堤钓点附近 + 非钓鱼中 + 无对话）
    this.checkFishingHint();
    // 生活采集 Phase 1 靠近提示（farm/town/forest 三场景，存在未采点 + 无对话）
    this.checkGatherHint();
    // 青禾河畔：码头/凉亭靠近提示 + 断桥一次性提示（未来果园预埋）
    if (this.mapKey === 'qinghe_river') {
      this.checkQingheRiverHints();
      this.checkQingheBridgeTip();
      // Stage 2：夜晚聊天提示（长椅旁）
      this.checkQingheChatterHint();
      // 果园预埋：老周靠近提示（断桥旁）
      this.checkQingheOldManHint();
    }
    // 钓鱼 Phase 4：夏雅交换果干后，次日靠近河边长椅 → 小场景 + 相簿
    this.checkFishRiverside();

    // 后山观景台：靠近一次性触发环境铺垫对白
    this.checkForestLookout();

    this.player.update();

    // Phase 3 §四 S6 老河堤水声（2026-08-13，拍板基线 §四 S6 河堤水声增强）：
    // 位置触发——玩家靠近西侧老河堤时叠加"河水流动"环境音层，远离时移除。
    // 河在 Walls 层 cols0-4 × rows6-28（gid4 水，碰撞），长椅 (5,15) 即西岸第一列可站立地；
    // 触发矩形：x < 6*TILE（col6 边界，即西岸带）且 y 在河纵向范围 rows5-29（余量防边缘抖动）。
    // 左上角草地（rows0-5）x 虽小但 y 不达标，不会误触发。状态变化才调用（幂等 + 零开销）。
    {
      const nearRiver =
        this.mapKey === 'town' &&
        this.player.x < 6 * TILE_SIZE &&
        this.player.y > 5 * TILE_SIZE &&
        this.player.y < 30 * TILE_SIZE;
      if (nearRiver !== this.riverSoundNear) {
        this.riverSoundNear = nearRiver;
        AmbienceSystem.setRiverProximity(nearRiver);
      }
    }

    // NPC 插值移动（仅对当前场景有 sprite 的 NPC 生效）
    updateNPCs(dtMs);

    // 农田选中高亮：跟随玩家面向的格子（仅农场）
    this.updateTargetHighlight();

    // 交互：消费一次动作输入（按一次只触发一次，不会连发）
    if (!this.transitioning) {
      const consumed = this.inputManager.consumeAction();
      if (consumed) {
        console.log(`[DEBUG] update consumeAction=true, calling tryInteract at ${this.mapKey}`);
        this.tryInteract();
      }
    }

    // 切换中则不再检测出口
    if (this.transitioning) return;

    const exits = MAP_EXITS[this.mapKey] ?? [];
    for (const ex of exits) {
      // 锁定出口（未来内容预埋）：不触发切换，玩家到此处只是"过不去"
      // 第三章幕一：灯塔出口按制作人指令解锁（门槛=第二章全节拍完成，可调整）
      if (!this.isExitOpen(ex)) continue;
      // 玩家中心点是否落在出口区域内
      if (
        this.player.x >= ex.x &&
        this.player.x <= ex.x + ex.w &&
        this.player.y >= ex.y &&
        this.player.y <= ex.y + ex.h
      ) {
        console.log(`[Exit] 触发出口: ${this.mapKey} → ${ex.target}`, {
          player: { x: this.player.x, y: this.player.y },
          zone: { x: ex.x, y: ex.y, w: ex.w, h: ex.h },
        });
        this.transitioning = true;
        // 淡出过渡后切换场景，避免瞬间黑屏
        this.cameras.main.fadeOut(300, 0, 0, 0);
        const target = ex.target;
        const spawn = ex.spawn;
        // 声音补全 v1.0（2026-08-09）：室内外进出播门开启音（户外路径切换不响，避免每张图都"门声"违和）
        if (this.mapKey === 'house' || this.mapKey === 'elder_house' || target === 'house' || target === 'elder_house') {
          play('door_open');
        }
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start(target, { spawn });
        });
        // 兜底：fade 事件异常时强制切换；超时后无论如何重置标志防止软锁死
        this.time.delayedCall(1500, () => {
          if (this.transitioning && this.scene.isActive()) {
            this.scene.start(target, { spawn });
          }
          this.transitioning = false;
        });
        return;
      }
    }

    // 每帧刷新时间 HUD（时间在流逝）
    this.updateTimeHUD();
  }

  /**
   * 刷新左上角时间 + 经验 HUD（DOM）
   */
  updateTimeHUD(): void {
    const t = getTime().day;
    const timeStr = isMobileLayout() ? formatTime() : `Day ${t}  ${formatTime()}`;
    this.hudTimeDom.textContent = timeStr;

    // 环境音昼夜翻转检测（白天→夜晚或反之，仅翻转时重启音源组合，零开销）
    AmbienceSystem.update(getTime().hour);

    // 经验条（仅农场场景有 DOM 元素）
    if (!this.xpBarFill) return;
    const lv = getLevel();
    const xp = getXp();
    const next = getXpToNext();
    if (next <= 0) {
      this.xpBarFill.style.width = '100%';
      this.xpBarLabel.textContent = `Lv.${lv} MAX`;
    } else {
      const total = xp + next;
      const pct = Math.round((xp / total) * 100);
      this.xpBarFill.style.width = `${pct}%`;
      this.xpBarLabel.textContent = `Lv.${lv}  ${xp}/${total}`;
    }
  }

  /**
   * 创建当前场景中的 NPC 精灵
   * 根据 TimeSystem 当前时间判定 NPC location，仅渲染在本场景的 NPC
   */
  private setupNPCs(): void {
    // 先刷新日程（确保 currentLocation 与当前时间一致）
    refreshSchedule();
    this.npcList = getNPCsForScene(this.mapKey);
    for (const npc of this.npcList) {
      // NPC 精灵贴图（32x32，缩放 0.5 后显示为 16x16，与瓦片协调）
      const sprite = this.add.image(npc.targetX, npc.targetY, npc.textureKey);
      sprite.setScale(0.5);
      sprite.setDepth(5);
      npc.sprite = sprite;
      // 名字标签（32x32 缩放 0.5 后，标签上移 14 像素贴头顶）
      // 角色主题色 + 黑描边 + 半透明黑底：深/浅背景都清晰，且能区分角色
      // 移动端适配：加大字号(15px)、去掉阴影(防模糊)、加厚描边保可读性
      const label = this.add.text(npc.targetX, npc.targetY - 14, npc.name, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: npc.nameColor,
        stroke: '#000000',
        strokeThickness: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: { x: 4, y: 2 },
      });
      label.setOrigin(0.5).setDepth(6).setScrollFactor(1);
      npc.label = label;
      // 立即吸附到目标位置（避免从原点滑过来）
      npc.snapToTarget();
      // v0.6 阶段 2a：启动视觉生活动作（单帧 Tween 模拟）
      npc.startIdleAnimation(this);
    }
  }

  /**
   * 镇长不在镇上时，显示提示物品（指引玩家去镇长家）
   * 当镇长在家（06:00-08:00 或 18:00+）时，在镇上镇长位置显示一个交互物品
   * 玩家靠近按 E 可看到提示："镇长不在，去镇长家看看？"
   */
  private setupElderHouseHint(): void {
    // 检查镇长是否在镇上
    const elderInTown = this.npcList.some(n => n.id === 'elder');
    if (elderInTown) return; // 镇长在镇上，不显示提示

    // 镇长不在镇上，显示提示物品
    // 2026-08-12 Chapter1 P0-0：town 30x20 → 50x35，坐标随内容平移 dx=10T dy=8T（13→23, 10→18）
    const elderSpot = { x: 23 * TILE_SIZE + TILE_SIZE / 2, y: 18 * TILE_SIZE + TILE_SIZE / 2 };
    
    // 创建交互物品（像素木牌 + 小房子图标，替换 v0.10 前 emoji 🏠；Alpha 审查 P0 #2）
    const hintContainer = this.add.container(elderSpot.x, elderSpot.y).setDepth(4);
    const house = this.add.graphics();
    // 木牌
    house.fillStyle(0x8a6a45, 1);
    house.fillRoundedRect(-9, -8, 18, 15, 2);
    house.fillStyle(0xa8835a, 1);
    house.fillRect(-7, -6, 14, 11);
    house.fillStyle(0x6e5633, 1);
    house.fillRect(-8, 7, 3, 4);
    house.fillRect(5, 7, 3, 4);
    // 小房子图标（屋身 + 三角屋顶 + 烟囱 + 门）
    house.fillStyle(0x9a7a4a, 1);
    house.fillRect(-5, -5, 10, 8);
    house.fillStyle(0xc0392b, 1);
    house.fillTriangle(-6, -5, 6, -5, 0, -10);
    house.fillStyle(0x6e5633, 1);
    house.fillRect(3, -8, 1.5, 3);
    house.fillStyle(0x5a3a26, 1);
    house.fillRect(-1, -1, 3, 4);
    hintContainer.add(house);
    
    // 添加提示文字（显示在木牌下方）
    const hintText = this.add.text(elderSpot.x, elderSpot.y + 16, '镇长家 →', {
      fontSize: '10px',
      color: '#c8a878',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(4);
    
    // 添加呼吸动画（吸引玩家注意）
    this.tweens.add({
      targets: hintContainer,
      alpha: { from: 0.7, to: 1 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
    
    // 存储交互数据
    this.elderHouseHint = { sprite: hintContainer, text: hintText };
  }

  /**
   * 与镇长家提示物品交互（靠近按 E）
   */
  private tryElderHouseHintInteract(): boolean {
    if (!this.elderHouseHint || !this.elderHouseHint.sprite.visible) return false;
    
    const dx = this.player.x - this.elderHouseHint.sprite.x;
    const dy = this.player.y - this.elderHouseHint.sprite.y;
    if (dx * dx + dy * dy > R2(28)) return false;
    
    // 显示提示并切换到镇长家场景
    this.showDialogueText('镇长不在镇上，去镇长家看看？');
    // 声音补全 v1.0（2026-08-09）：进镇长家播门开启音
    play('door_open');
    // 延迟后切换到镇长家场景
    this.time.delayedCall(1000, () => {
      this.scene.start('elder_house', { spawn: { x: 5 * TILE_SIZE, y: 8 * TILE_SIZE } });
    });
    return true;
  }

  /**
   * FEATURE-038 居民需求板：小镇广场右侧信息板交互物。
   * 2026-08-12 Chapter1 P0-0：town 30x20 → 50x35，坐标随内容平移 dx=10T dy=8T（22→32, 8→16）
   * 位置 (32,16)：已验证 Walls 层 gid=0 可走，距所有 NPC 站位 >48px，无交互冲突。
   * 视觉：木牌 + 📌 顶钉 + 下方「需求板」标签 + 呼吸动画（参照 setupElderHouseHint 模式）。
   */
  private setupResidentBoard(): void {
    if (this.mapKey !== 'town') return;
    const T = TILE_SIZE;
    const bx = 32 * T + T / 2;
    const by = 16 * T + T / 2;
    const board = this.add.container(bx, by).setDepth(4);

    // 木牌主体（深棕木板 + 浅色板面 + 顶钉 + 两条腿）
    const g = this.add.graphics();
    g.fillStyle(0x8a6a45, 1);
    g.fillRoundedRect(-11, -8, 22, 15, 2);
    g.fillStyle(0xa8835a, 1);
    g.fillRect(-9, -6, 18, 11);
    g.fillStyle(0x6e5633, 1);
    g.fillRect(-2, -10, 4, 2);
    g.fillRect(-8, 7, 3, 5);
    g.fillRect(5, 7, 3, 5);
    board.add(g);

    // 顶钉（呼吸动画吸引注意）
    const pin = this.add.text(0, -12, '📌', { fontSize: '12px' }).setOrigin(0.5);
    board.add(pin);
    this.tweens.add({
      targets: pin,
      alpha: { from: 0.7, to: 1 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });

    // 「需求板」标签
    const label = this.add.text(0, 13, '需求板', {
      fontSize: '10px',
      color: '#e8d8a8',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    board.add(label);

    this.residentBoardMark = board;
  }

  /**
   * P1 家的音乐盒：老屋（house）音乐盒交互物。
   * 位置 (17,5)：Walls 层空地、距床铺/门口 >3 格、右侧靠墙易发现，无碰撞/出口/剧情冲突。
   * 视觉：木盒 + 金色转盘 + 🎵 音符 + 呼吸光晕 + 「音乐盒」标签（参照需求板模式，零资产）。
   */
  private setupMusicBox(): void {
    if (this.mapKey !== 'house') return;
    const T = TILE_SIZE;
    const bx = 17 * T + T / 2;
    const by = 5 * T + T / 2;
    const box = this.add.container(bx, by).setDepth(4);

    // 呼吸光晕（吸引注意）
    const glow = this.add.ellipse(0, -2, 26, 22, 0xffd98a, 0.18);
    box.add(glow);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.12, to: 0.32 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
    });

    // 木盒 + 盒盖 + 金色转盘
    const g = this.add.graphics();
    g.fillStyle(0x8a6a45, 1);
    g.fillRoundedRect(-8, -5, 16, 11, 2);
    g.fillStyle(0xa8835a, 1);
    g.fillRect(-7, -7, 14, 2);
    g.fillStyle(0xe8c070, 1);
    g.fillCircle(3, 0, 2);
    box.add(g);

    // 顶部音符
    const note = this.add.text(0, -14, '🎵', { fontSize: '12px' }).setOrigin(0.5);
    box.add(note);

    // 「音乐盒」标签
    const label = this.add.text(0, 15, '音乐盒', {
      fontSize: '10px',
      color: '#e8d8a8',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    box.add(label);

    this.musicBoxMark = box;
  }

  /**
   * 与老屋音乐盒交互（靠近按 E 打开曲目面板）
   */
  private tryMusicBoxInteract(): boolean {
    if (!this.musicBoxMark || !this.musicBoxMark.visible) return false;
    const dx = this.player.x - this.musicBoxMark.x;
    const dy = this.player.y - this.musicBoxMark.y;
    if (dx * dx + dy * dy > 48 * 48) return false;

    if (!this.musicBoxPanel) {
      this.uiBus.registerMusicBoxPanel(new MusicBoxPanel(() => this.resumeHouseBgm()));
    }
    this.inputManager.clearAction();
    // v0.11（P0.5）：第一次打开音乐盒加仪式感——先一句浮字台词（"这个音乐盒……还能播放以前的曲子。"），
    // 短暂停顿再弹面板，之后每次打开直接弹列表。
    if (!this.musicBoxIntroduced) {
      this.musicBoxIntroduced = true;
      this.showDialogueText('这个音乐盒……还能播放以前的曲子。');
      this.time.delayedCall(900, () => this.musicBoxPanel?.open());
    } else {
      this.musicBoxPanel.open();
    }
    return true;
  }

  /** 「停止播放」回调：清除音乐盒"我的歌"，恢复老屋（house）日常 BGM（白天 farm_day / 夜晚 stargaze_night） */
  private resumeHouseBgm(): void {
    MusicSystem.setMusicBoxTrack(null);
    const h = getTime().hour;
    MusicSystem.playSceneBgm('house', h);
  }

  /**
   * P0 爷爷的归星包裹（2026-08-11 制作人拍板）：老屋（house）旧木箱交互物。
   * 位置 (17,12)：即 setupHouseFurniture L1-4 装饰木箱（fillRoundedRect(17T,12T,16,16)，中心 (280,200)）。
   * 视觉：木箱上加「爷爷的包裹」标签 + 呼吸光晕（吸引注意，参照音乐盒模式，零资产）。
   * 触发：第一次进入 house 场景且未领取时创建（hasTriggered 判重）；领取后 destroy，此后进屋不再出现。
   */
  private setupGrandpaGift(): void {
    if (this.mapKey !== 'house') return;
    const T = TILE_SIZE;
    const gx = 17 * T + T / 2; // 280
    const gy = 12 * T + T / 2; // 200
    this.grandpaGiftPos = { x: gx, y: gy };
    const box = this.add.container(gx, gy).setDepth(4);

    // 呼吸光晕（吸引注意）
    const glow = this.add.ellipse(0, 0, 26, 20, 0xffd98a, 0.14);
    box.add(glow);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.1, to: 0.28 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
    });

    // 「爷爷的包裹」标签（挂在木箱上方）
    const label = this.add.text(0, -14, '爷爷的包裹', {
      fontSize: '10px',
      color: '#ffe082',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    box.add(label);

    this.grandpaGiftMark = box;
  }

  /**
   * 与老屋旧木箱交互（靠近按 E 打开爷爷的归星包裹面板）
   * 面板点「收下」后发放纪念物 + 启动资源，triggerOnce 持久化 + 存档。
   */
  private tryGrandpaGiftInteract(): boolean {
    if (!this.grandpaGiftMark || !this.grandpaGiftMark.visible) return false;
    const dx = this.player.x - this.grandpaGiftPos.x;
    const dy = this.player.y - this.grandpaGiftPos.y;
    if (dx * dx + dy * dy > 48 * 48) return false;

    if (!this.grandpaGiftPanel) this.uiBus.registerGrandpaGiftPanel(new GiftPanel());
    this.inputManager.clearAction();
    this.grandpaGiftPanel.open(() => this.grantGrandpaGift());
    return true;
  }

  /** 发放爷爷的归星包裹（纪念物 + 启动资源；一次性 triggerOnce 入档，防重复领取） */
  private grantGrandpaGift(): void {
    const granted = triggerOnce('grandpa_gift_opened', () => {
      addItem('grandpa_letter', 1);
      addItem('dried_fish', 1);
      addItem('flower_seedling', 1);
      addItem('wood', 5);
      addItem('stone', 5);
      addCoins(200);
      // 领取后移除木箱提示，此后进屋不再出现
      if (this.grandpaGiftMark) {
        this.grandpaGiftMark.destroy();
        this.grandpaGiftMark = null;
      }
      this.updateHUD();
      this.updateQuestHUD();
      this.showDialogueText('（你收好了爷爷留下的东西。信纸很旧，字迹很稳。）');
    });
    // EventSystem.md 时序纪律：save 必须在 triggerOnce 返回之后（fn 内 save 快照缺当前 key，
    // 异常终止路径读档后可重复领取奖励）；走守卫入口 saveAtPlayer（B3/B4 纪律）
    if (granted) this.saveAtPlayer();
  }

  /**
   * 第一章 P1-1 老屋整理（2026-08-12 垂直切片，章节门禁 chapter ≥ 1）：
   * 4 个整理交互点（旧床/灯/书桌/收音机），程序绘制、零新资产、零新增存档字段。
   * 状态由 EventManager.triggerOnce('ch1_*_done') 持久化（随存档的 triggeredEvents）：
   *   - 已完成（hasTriggered）→ 画"整理后"视觉（drawTidyDone），不挂交互提示
   *   - 未完成 → 呼吸光晕（视觉吸引），靠近时通过 DOM hint 提示"按 [E] 整理"
   * 4 点位置已核验两两间距 > 48px（交互判定不重叠，且均不在床睡觉判定邻近格内）。
   */
  private setupHouseTidy(): void {
    if (this.mapKey !== 'house' || !isChapterAtLeast(CHAPTER_1)) return;
    const T = TILE_SIZE;
    const points: Array<{ key: 'bed' | 'lamp' | 'desk' | 'radio'; x: number; y: number }> = [
      { key: 'bed', x: 2.5 * T, y: 2.5 * T },   // 旧床（叠被子）：床铺 (2,2)-(3,3) 中心
      { key: 'lamp', x: 5.5 * T, y: 3.5 * T },  // 灯（点亮暖光）：床右侧，避让睡觉判定格
      { key: 'desk', x: 13.5 * T, y: 4.5 * T }, // 书桌（左爷爷旧物+右电脑）：右上角墙下
      { key: 'radio', x: 16.5 * T, y: 54 },     // 收音机（擦亮+生活声）：L1-5 装饰中心 (264,54)
    ];
    // B-3 顺序表（2026-08-13 体验债务）：床→灯→书桌→收音机的"先发生这件事，再发生那件事"
    const ORDER: Array<'bed' | 'lamp' | 'desk' | 'radio'> = ['bed', 'lamp', 'desk', 'radio'];
    this.houseTidy = [];
    for (const p of points) {
      const key = `ch1_${p.key}_done`;
      if (hasTriggered(key)) {
        const g = this.add.graphics().setDepth(2);
        this.drawTidyDone(p.key, g);
        this.houseTidy.push({ key: p.key, pos: { x: p.x, y: p.y }, mark: null, done: g, glow: null });
      } else {
        // 交互标记（仅呼吸光晕，无文字标签——靠近时通过 DOM hint 提示）
        // B-3 焦点优先：只有"下一个该整理的"呼吸最强，其余点弱亮——第一眼先被一个点吸引
        const isFocus = ORDER.find((k) => !hasTriggered(`ch1_${k}_done`)) === p.key;
        const mark = this.add.container(p.x, p.y).setDepth(4);
        const glow = this.add.ellipse(0, 0, 26, 20, 0xffd98a, isFocus ? 0.18 : 0.1);
        mark.add(glow);
        this.tweens.add({
          targets: glow,
          alpha: isFocus ? { from: 0.12, to: 0.34 } : { from: 0.06, to: 0.16 },
          duration: isFocus ? 1200 : 1600,
          yoyo: true,
          repeat: -1,
        });
        this.houseTidy.push({ key: p.key, pos: { x: p.x, y: p.y }, mark, done: null, glow });
      }
    }
    // B-1/B-3 分时淡入：未完成点按顺序错峰出现（第一个立即亮，其余顺延 500ms）——
    // 避免"4 个标签同时全亮"的开关清单感，变成"先看到一件，再做下一件"。
    const pending = this.houseTidy.filter((t) => t.mark);
    this.time.delayedCall(0, () => {
      pending.forEach((item, i) => {
        if (!item.mark) return;
        item.mark.setAlpha(0);
        this.tweens.add({
          targets: item.mark,
          alpha: 1,
          duration: 400,
          delay: i * 500,
          ease: 'Sine.easeInOut',
        });
      });
    });
    console.log(`[MapScene:house] 老屋整理点 ${this.houseTidy.filter((t) => t.mark).length} 个待整理`);
  }

  /** 绘制单个整理点的"整理后"视觉（程序 Graphics，零新资产；g 已 setDepth(2)） */
  private drawTidyDone(key: 'bed' | 'lamp' | 'desk' | 'radio', g: Phaser.GameObjects.Graphics): void {
    const T = TILE_SIZE;
    switch (key) {
      case 'bed': {
        // 叠好的被子：盖住 setupHouseBed 的铺开红被，露出床垫，被叠成方块放床尾——"终于像一个可以生活的地方"
        const x = 2 * T, y = 2 * T, w = 2 * T, h = 2 * T;
        g.fillStyle(0xf0ead8, 1);
        g.fillRoundedRect(x + 2, y + 15, w - 4, h - 17, 3); // 床垫（盖住原被子）
        g.lineStyle(1, 0xd8d0c0, 0.8);
        g.lineBetween(x + 2, y + 20, x + w - 2, y + 20);   // 床垫缝线
        g.fillStyle(0xd03020, 1);
        g.fillRoundedRect(x + w - 14, y + 18, 11, 10, 2);  // 叠好的方块被
        g.lineStyle(1, 0xa02018, 0.9);
        g.lineBetween(x + w - 14, y + 22, x + w - 3, y + 22);
        g.lineStyle(1.5, 0xf0ead8, 0.9);
        g.lineBetween(x + w - 6, y + 18, x + w - 6, y + 28); // 白棱线（叠角）
        break;
      }
      case 'lamp': {
        // 点亮的灯：暖黄灯罩 + 光晕——"光，就是有人住的样子"
        const x = 5.5 * T, y = 3.5 * T;
        g.fillStyle(0xffd98a, 0.22);
        g.fillCircle(x, y - 2, 13);                 // 暖光晕
        g.fillStyle(0x4a3018, 1);
        g.fillRoundedRect(x - 4, y + 3, 8, 4, 1);   // 底座
        g.fillRect(x - 1, y - 3, 2, 8);             // 灯柱
        g.fillStyle(0xe8b84a, 1);
        g.fillTriangle(x - 6, y - 3, x + 6, y - 3, x, y - 12); // 灯罩（暖黄）
        g.fillStyle(0xfff0c8, 0.85);
        g.fillCircle(x, y - 1, 1.6);                // 灯芯亮点
        break;
      }
      case 'desk': {
        // 书桌：左=爷爷旧物（旧书+旧相框），右=林澈电脑（屏幕蓝白光）——"过去和现在，都在这一张桌上"
        const x = 13 * T, y = 4 * T;
        g.fillStyle(0x5a3a20, 1);
        g.fillRoundedRect(x, y, 2 * T, T, 2);       // 桌面
        g.fillStyle(0x4a3018, 1);
        g.fillRect(x + 2, y + T, 3, 8);             // 桌腿
        g.fillRect(x + 2 * T - 5, y + T, 3, 8);
        // 左：爷爷旧物
        g.fillStyle(0x8a6a42, 1);
        g.fillRect(x + 3, y + 4, 7, 6);             // 旧书 A
        g.fillRect(x + 6, y + 3, 6, 5);             // 旧书 B（斜叠）
        g.fillStyle(0xb8a888, 1);
        g.fillRect(x + 3, y + 11, 8, 4);            // 旧相框
        g.lineStyle(1, 0x8a6a42, 1);
        g.strokeRect(x + 4, y + 11.5, 6, 3.5);
        // 右：林澈电脑
        g.fillStyle(0x30343c, 1);
        g.fillRect(x + 2 * T - 15, y + 1, 12, 9);   // 屏幕
        g.fillStyle(0x3a4a6a, 0.9);
        g.fillRect(x + 2 * T - 14, y + 2, 10, 7);   // 屏幕蓝光
        g.fillStyle(0x9ab8e8, 0.5);
        g.fillRect(x + 2 * T - 13, y + 3, 8, 1.5);  // 屏幕亮线
        g.fillStyle(0x4a3018, 1);
        g.fillRect(x + 2 * T - 6, y + 10, 8, 2);    // 键盘底座
        break;
      }
      case 'radio': {
        // 擦亮的收音机：侧棱高光 + 暖色频道灯（叠在 L1-5 装饰之上）——"像很久以前的午后"
        const x = 16 * T, y = 3 * T;
        g.fillStyle(0xfff0c8, 0.35);
        g.fillRect(x + 1, y + 1, 2, 10);            // 擦亮高光
        g.fillStyle(0xffd98a, 0.9);
        g.fillCircle(x + 12, y + 3, 1.2);           // 频道灯
        g.fillStyle(0xffd98a, 0.25);
        g.fillCircle(x + 12, y + 3, 3);
        break;
      }
    }
  }

  /**
   * 第一章 P1-1 老屋整理交互（靠近按 E）：
   * 条件事件完整链路 —— ChapterSystem（章节门禁）→ EventCondition（{ chapter: CHAPTER_1 }）
   * → triggerOnceIf（一次性 + 幂等）→ 视觉两态 + 反馈 → save()（triggeredEvents 随存档持久化）。
   * 注意时序：triggerOnce 先执行 fn 再标记状态，因此"存档 + 全部完成判断"必须放在
   * triggerOnceIf 返回之后（此时当前 key 已标记），否则会漏存当前 key、漏判全完成。
   */
  private tryHouseTidyInteract(): boolean {
    if (this.mapKey !== 'house') return false;
    for (const item of this.houseTidy) {
      if (!item.mark) continue; // 已完成（无交互标记）
      const dx = this.player.x - item.pos.x;
      const dy = this.player.y - item.pos.y;
      if (dx * dx + dy * dy > 48 * 48) continue;
      this.inputManager.clearAction();
      const ok = triggerOnceIf(`ch1_${item.key}_done`, { chapter: CHAPTER_1 }, () => {
        this.onTidyItemDone(item);
      });
      if (!ok) continue;
      // triggerOnceIf 已返回：当前 key 已标记。此时存档（确保 ch1_*_done 入档）+
      // 4 点全部完成 → 人生节点（仅一次，showMemoryMoment 不冻结操作）
      save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing });
      // 4 点全部完成 → 聚合事件 ch1_house_tidy_done（仅一次）+ 人生节点
      // （showMemoryMoment 不冻结操作；聚合事件标记后需再次存档，见上方时序纪律）
      if (isHouseTidyComplete()) {
        triggerOnce('ch1_house_tidy_done', () => {
          // P1-2 村长来访前置：记录整理完成的天数（"下一晚"判断：整理完成当天不触发，隔天夜晚才来）
          this.ch1ElderVisitDay = getTime().day;
          this.time.delayedCall(1200, () => {
            showMemoryMoment('这间屋子，开始是我的了。');
          });
        });
        save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing });
      }
      return true;
    }
    return false;
  }

  /**
   * 老屋整理靠近提示检测（DOM 提示，对齐 oldTreeInteractHint 范式）。
   * 仅 house 场景 + 无对话打开时检测；距离 < 48px（与 tryHouseTidyInteract 判定一致）
   * 且存在未完成点 → 显示提示；否则隐藏。
   * 设计：地图上仅保留呼吸光晕（视觉吸引），文字提示靠近时浮现——
   * 避免地图上 4 个"整理床/灯/书桌/收音机"文字标签拥挤。
   */
  private checkHouseTidyHint(): void {
    if (this.mapKey !== 'house' || !this.houseTidy || this.storyDialogue?.isOpen()) {
      this.hideHouseTidyHint();
      return;
    }
    let nearest = false;
    for (const item of this.houseTidy) {
      if (!item.mark) continue; // 已完成的点不显示提示
      const dx = this.player.x - item.pos.x;
      const dy = this.player.y - item.pos.y;
      if (dx * dx + dy * dy < 48 * 48) {
        nearest = true;
        break;
      }
    }
    if (nearest) this.showHouseTidyHint();
    else this.hideHouseTidyHint();
  }

  /** 显示老屋整理交互提示（DOM） */
  private showHouseTidyHint(): void {
    if (this.houseTidyInteractHint) return;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '180px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffffff', fontSize: '13px',
      background: 'rgba(0,0,0,0.65)', padding: '6px 16px', borderRadius: '6px',
      zIndex: '400', pointerEvents: 'none',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    hint.textContent = isMobileLayout() ? '点击「交互」整理' : '按 [E] 整理';
    hint.classList.add('hint-interact'); // 2026-08-16 兜底清扫标记（hideAllInteractHints 强制移除残留）
    document.body.appendChild(hint);
    this.houseTidyInteractHint = hint;
  }

  /** 隐藏老屋整理交互提示 */
  private hideHouseTidyHint(): void {
    if (this.houseTidyInteractHint) {
      this.houseTidyInteractHint.remove();
      this.houseTidyInteractHint = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 第一章 P2 生活采集 Phase 1（2026-08-14 设计稿 v0.1）
  // 依据：《归星物语》生活采集与探索收集系统设计 v0.1
  // 范围：5 种采集物 × farm/town/forest 三场景手工采集点
  // 红线：零新系统 / 零新存档字段 / 零新素材；triggerOnce 持久化"已采"状态
  // 复用：MapScene.tryInteract 范式 + DOM hint（参照 fishing/oldTree）+ Graphics 视觉 + AudioSystem.play
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * 生活采集点设置（设计稿 §六/§七/§八）。
   * - 从 Gathering.ts 读取当前场景采集点定义
   * - 跳过已采点（hasTriggered 判断，已采点不创建视觉，符合 §十三"采完了"）
   * - 程序合成小群落视觉：每株独立 Graphics（主色+高光+接地阴影），整体放在 Container 中
   * - 呼吸光晕轻量（避免视觉过载）：alpha 0.04→0.12 缓慢呼吸
   */
  private setupGatherPoints(): void {
    const defs = getGatherPointsForScene(this.mapKey);
    if (defs.length === 0) return;
    for (const def of defs) {
      const eventKey = gatherEventKey(this.mapKey, def.id);
      if (hasTriggered(eventKey)) continue; // 已采：不创建视觉（"采完了"）
      // 条件资源（2026-08-16 天气扩面）：当前环境不满足出现条件（如晴天河螺）→ 跳过创建，
      // 变天时由 syncWeatherGatherPoints 补建（玩家看到雨下起来，浅滩冒出小螺）。
      const spawn = querySceneResource(this.mapKey, def.kind);
      if (!spawn.present) continue;
      const container = this.createGatherCluster(def);
      container.setDepth(4);
      this.gatherNodes.push({ def, container, collected: false });
    }
  }

  /**
   * 条件采集点补建（2026-08-16 天气扩面）：雨开始时调用一次。
   * 对"当前环境已满足出现条件"的未创建点补建视觉（雨日河畔冒河螺），
   * 已采（triggerOnce）或环境不满足的点跳过。幂等：已创建的 id 不再重复建。
   */
  private syncWeatherGatherPoints(): void {
    const defs = getGatherPointsForScene(this.mapKey);
    if (defs.length === 0) return;
    const existing = new Set(this.gatherNodes.map((n) => n.def.id));
    for (const def of defs) {
      if (existing.has(def.id)) continue;
      const eventKey = gatherEventKey(this.mapKey, def.id);
      if (hasTriggered(eventKey)) continue;
      const spawn = querySceneResource(this.mapKey, def.kind);
      if (!spawn.present) continue;
      const container = this.createGatherCluster(def);
      container.setDepth(4);
      this.gatherNodes.push({ def, container, collected: false });
    }
  }

  /**
   * 程序合成一个小群落（2-4 株），位置围绕 def 中心点小范围散布（§七"本来长在那里"）。
   * 种子驱动，每次刷新视觉位置一致（不闪烁）。
   */
  private createGatherCluster(def: GatherPointDef): Phaser.GameObjects.Container {
    const visual = GATHER_VISUAL[def.kind];
    const container = this.add.container(def.x, def.y);
    const seed = this.hashStr(def.id);
    for (let i = 0; i < def.clusterSize; i++) {
      const ox = (this.pseudoRand(seed + i * 97) - 0.5) * 6;   // -3~+3 px
      const oy = (this.pseudoRand(seed + i * 131) - 0.5) * 4;  // -2~+2 px
      const plant = this.add.graphics();
      this.drawGatherSprite(plant, visual);
      plant.setPosition(ox, oy);
      container.add(plant);
    }
    // 呼吸光晕：极轻量，提示"这里有东西可看"（参照 setupFishingSpot 的水面光晕）
    const glow = this.add.ellipse(0, 0, 16, 10, 0xffffff, 0.06);
    container.add(glow);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.04, to: 0.12 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
    });
    return container;
  }

  /** 绘制单株采集物（主色矩形 + 高光 + 接地阴影，零资产） */
  private drawGatherSprite(g: Phaser.GameObjects.Graphics, v: GatherVisualConfig): void {
    // 接地阴影（深色短矩形，模拟接地暗面）
    g.fillStyle(v.shadow, 0.5);
    g.fillRect(-v.width / 2 - 1, v.height / 2 - 1, v.width + 2, 2);
    // 主色调（株身）
    g.fillStyle(v.color, 1);
    g.fillRect(-v.width / 2, -v.height / 2, v.width, v.height);
    // 高光（左上角小亮块，模拟受光面）
    g.fillStyle(v.highlight, 0.85);
    g.fillRect(-v.width / 2, -v.height / 2, Math.max(1, v.width - 2), Math.max(1, v.height - 4));
  }

  /** 极简字符串哈希（视觉种子用，避免每次刷新位置抖动） */
  private hashStr(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  /** 极简伪随机（0~1，种子驱动，无状态） */
  private pseudoRand(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  /**
   * 采集靠近提示检测（对齐 checkFishingHint 范式）。
   * 存在未采点 + 无对话 → 找最近未采点（距离 < GATHER_INTERACT_RANGE）→ 显示提示
   */
  private checkGatherHint(): void {
    if (this.gatherNodes.length === 0 || this.storyDialogue?.isOpen()) {
      this.nearestGatherIdx = -1;
      this.hideGatherHint();
      return;
    }
    let nearest = -1;
    let nearestDistSq = GATHER_INTERACT_RANGE * GATHER_INTERACT_RANGE;
    for (let i = 0; i < this.gatherNodes.length; i++) {
      const node = this.gatherNodes[i];
      if (node.collected) continue;
      const dx = this.player.x - node.def.x;
      const dy = this.player.y - node.def.y;
      const dsq = dx * dx + dy * dy;
      if (dsq < nearestDistSq) {
        nearestDistSq = dsq;
        nearest = i;
      }
    }
    this.nearestGatherIdx = nearest;
    if (nearest >= 0) this.showGatherHint();
    else this.hideGatherHint();
  }

  /** 显示采集靠近提示（DOM） */
  private showGatherHint(): void {
    if (this.gatherInteractHint) return;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '180px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffffff', fontSize: '13px',
      background: 'rgba(0,0,0,0.65)', padding: '6px 16px', borderRadius: '6px',
      zIndex: '400', pointerEvents: 'none',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    hint.textContent = isMobileLayout() ? '点击「交互」采集' : '按 [E] 采集';
    hint.classList.add('hint-interact'); // 2026-08-16 兜底清扫标记（hideAllInteractHints 强制移除残留）
    document.body.appendChild(hint);
    this.gatherInteractHint = hint;
  }

  /** 隐藏采集靠近提示 */
  private hideGatherHint(): void {
    if (this.gatherInteractHint) {
      this.gatherInteractHint.remove();
      this.gatherInteractHint = null;
    }
  }

  /**
   * 采集交互入口（tryInteract 调用，对齐 tryFishingInteract 范式）。
   * - 存在靠近的未采点 → triggerOnce(eventKey, fn)（先执行 fn 后标记，EventManager 契约）→
   *   fn 内：背包+1 / 音效 / 视觉淡出 / 一行文字反馈
   * - 反馈时长 0.4s（§六 0.3~0.8s 完整反馈目标）
   */
  private tryGatherInteract(): boolean {
    if (this.nearestGatherIdx < 0) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const node = this.gatherNodes[this.nearestGatherIdx];
    if (!node || node.collected) return false;
    // 二次距离校验（防 update 与 tryInteract 之间玩家移出范围）
    const dx = this.player.x - node.def.x;
    const dy = this.player.y - node.def.y;
    if (dx * dx + dy * dy > GATHER_INTERACT_RANGE * GATHER_INTERACT_RANGE) return false;

    const itemId = gatherKindToItem(node.def.kind);
    const eventKey = gatherEventKey(this.mapKey, node.def.id);
    // triggerOnce 契约（docs/dev/EventSystem.md）：先执行 fn 后标记。
    // fn 内放采集副作用（背包/音效/视觉/文字），保证标记与副作用原子一致。
    const first = triggerOnce(eventKey, () => {
      addItem(itemId, 1);
      play('gather');
      // 自然观察（P0 Phase C）：玩家记忆——第一次采到可发现资源则记录（含地点/特殊条件）
      // 只记录"真正产生的发现"（玩家记忆进存档，世界状态/概率不存）
      // 2026-08-16 P0 语义修复（制作人拍板）：rain_forest 由真实天气决定（正在下雨），
      // 不再用 day%5 假定"雨后"。条件与 WeatherSystem 雨幕/雨天湿润同源，玩家所见即所记。
      // 2026-08-16 天气扩面：河螺 rain_river 同理——河螺仅雨天出现，采到即满足雨日条件。
      const discKind = node.def.kind;
      const discLocation = this.mapKey;
      const special = discKind === 'wild_mushroom' && discLocation === 'forest' && isCurrentlyRaining() ? 'rain_forest'
        : discKind === 'river_snail' && discLocation === 'qinghe_river' && isCurrentlyRaining() ? 'rain_river'
        : undefined;
      // P0.5 世界规律引导（发现反馈层）：判定"是否第一次雨中发现蘑菇"必须在 recordDiscovery 之前，
      // 否则记录已写入后 hasSpecialDiscovery 恒为 true，发现文本永不触发。
      const firstRainMushroom =
        discKind === 'wild_mushroom' && discLocation === 'forest' &&
        isCurrentlyRaining() && !hasSpecialDiscovery('wild_mushroom', 'rain_forest');
      // 天气扩面（2026-08-16）：河螺首次雨天发现（同理，必须先于 recordDiscovery 判定）
      const firstRainSnail =
        discKind === 'river_snail' && discLocation === 'qinghe_river' &&
        !hasSpecialDiscovery('river_snail', 'rain_river');
      recordDiscovery({ resourceId: discKind, day: getTime().day, location: discLocation, special });
      // 动作时间成本（P0 Action Time）：采集消耗 n 游戏分钟（可调，见 data/ActionTimeCost）
      consumeMinutes(getActionTimeCost('gathering'));
      this.tweens.add({
        targets: node.container,
        alpha: 0,
        scaleX: 0.6,
        scaleY: 0.6,
        duration: 400,
        onComplete: () => node.container.destroy(),
      });
      this.showDialogueText(
        firstRainMushroom
          ? `发现：野蘑菇。\n雨天的森林，总会冒出一些平时不容易发现的蘑菇。`
          : firstRainSnail
            ? `发现：河螺。\n雨天的浅滩，总会爬上一些平时见不到的小螺。`
            : `采到了 ${getItemDef(itemId).name}。`,
      );
    });
    if (!first) return false; // 已采过（双重保险：update 检测应已跳过此点）

    // 本地状态同步（fn 已执行，标记已落库）
    node.collected = true;
    this.nearestGatherIdx = -1;
    this.hideGatherHint();
    this.inputManager.clearAction();
    return true;
  }

  /** 生活采集资源清理（视觉 + DOM hint；已采状态由 triggerOnce 持久化） */
  private cleanupGathering(): void {
    for (const node of this.gatherNodes) {
      node.container.destroy();
    }
    this.gatherNodes = [];
    this.hideGatherHint();
    this.nearestGatherIdx = -1;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 第一章 P2 钓鱼 Phase 1（2026-08-14，制作人 Decision Override 启动）
  // 依据：《钓鱼MVP-设计与施工规范-v0.1》+ 任务卡 v0.1
  // 范围：1 钓点（S6 老河堤）+ 1 鱼（青禾鲫）+ 纯手感循环
  // 红线：零新系统 / 零新存档字段 / 零新素材；参数集中不散落写死
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * 钓鱼可调参数（任务卡 §四 + 施工规范 §十四）。
   * 集中一处，禁止散落写死。Phase 2 实机手感调整时改这里。
   */
  private static readonly FISHING_CONFIG = {
    biteDelayMin: 2.0,             // 等待阶段最短（秒）
    biteDelayMax: 5.0,             // 等待阶段最长（秒）
    fakeBiteProbability: 0.30,     // 出现试探假动作的概率（行为 B）
    realBiteWindow: 0.8,           // 真咬钩收竿窗口（秒）
    successFeedbackDuration: 0.7,  // 成功反馈时长（秒）
    castDuration: 0.8,            // 甩竿动画时长（秒，0.5~1s 中值）
    fakeBiteDuration: 0.4,         // 试探时浮漂轻下沉持续时间（秒）
    fakeBiteRecoverDuration: 0.3,  // 试探后浮漂恢复时间（秒）
    failFeedbackDuration: 0.4,     // 失败反馈时长（秒）
    interactRange: 32,             // 钓点交互距离（px，比 oldTree 60 小，钓点更聚焦）
    fryChance: 0.15,               // 生态分层 v1.3：普通钓点钓到小鱼苗（低概率特殊事件）的概率
  } as const;

  /**
   * 鱼种行为表（钓鱼 Phase 3，2026-08-14 制作人拍板）。
   * 《施工规范》§十九：河虾 = 更容易出现试探；黄昏鱼 = 更晚咬钩 / 更长等待。
   * 基础值对齐 FISHING_CONFIG（青禾鲫 = 手感基准）。
   */
  private static readonly FISH_KINDS = {
    qinghe_crucian: { name: '青禾鲫', fakeBiteProbability: 0.30, biteDelayMin: 2.0, biteDelayMax: 5.0 },
    river_shrimp: { name: '河虾', fakeBiteProbability: 0.45, biteDelayMin: 2.0, biteDelayMax: 5.0 },
    dusk_fish: { name: '黄昏鱼', fakeBiteProbability: 0.30, biteDelayMin: 4.0, biteDelayMax: 7.0 },
    moon_bass: { name: '月光鲈', fakeBiteProbability: 0.50, biteDelayMin: 3.0, biteDelayMax: 6.0 },
    // 普通特殊鱼（生态可重复，v1.3 制作人拍板）：河鳗=夜行且多试探 / 鲤鱼=常客中规中矩 / 大青鱼=咬得急要多稳
    river_eel: { name: '河鳗', fakeBiteProbability: 0.55, biteDelayMin: 3.0, biteDelayMax: 6.5 },
    common_carp: { name: '鲤鱼', fakeBiteProbability: 0.35, biteDelayMin: 2.0, biteDelayMax: 5.0 },
    big_blue_fish: { name: '大青鱼', fakeBiteProbability: 0.50, biteDelayMin: 2.5, biteDelayMax: 6.0 },
    qinghe_fry: { name: '青禾鱼苗', fakeBiteProbability: 0.40, biteDelayMin: 1.8, biteDelayMax: 4.0 },
  } as const;

  /**
   * 按时段 + 概率挑选本次鱼种（Phase 3，《可流动资源设计》§3.3 鱼类表）：
   *   青禾鲫：全天 55%｜河虾：08:00-17:00 30%｜黄昏鱼：17:00-20:00 15%
   */
  /**
   * 按时段 + 概率挑选本次鱼种（Phase 3，《可流动资源设计》§3.3 鱼类表）。
   * 2026-08-14 分层扩展：
   *   普通钓点（town 河堤，tier=common）：青禾鲫 全天 55%｜河虾 08:00-17:00 30%｜黄昏鱼 17:00-20:00 15%
   *   稀有钓点（farm 池塘，tier=rare）：月光鲈 全天 65%｜河虾 08:00-17:00 25%｜青禾鲫 全天 10%（少量低级鱼）
   */
  /**
   * 钓鱼 Phase 4：NPC 交换配置（一对一、单跳、每 NPC 一次性；《可流动资源设计》§4.2）。
   * 回报：夏雅=次日河边小场景+相簿；商店=归星记录热汤；小梅=farm 花田旁小饭桌；老张=house 门轴+elder_house 夜灯。
   */
  private static readonly FISH_EXCHANGES: Record<string, { item: ItemType; eventId: string }> = {
    xiya: { item: 'qinghe_crucian', eventId: 'fish_exchange_xiya' },
    shopkeeper: { item: 'qinghe_crucian', eventId: 'fish_exchange_shop' },
    gardener: { item: 'river_shrimp', eventId: 'fish_exchange_gardener' },
    miner: { item: 'dusk_fish', eventId: 'fish_exchange_miner' },
    adventurer: { item: 'dusk_fish', eventId: 'fish_exchange_adventurer' },
  };

  /**
   * 采集物交换配置（第一章「复苏」玩法升级：采集 → 换/送/用网络）。
   * 依据：《核心玩法循环优化-v1.0》采集缺口（5 种自然物此前只有"卖"一条流向）。
   * 复用钓鱼「可流动资源」模板：一对一、单跳、每 NPC 一次性、回报含非数值内容（世界变化）。
   * 覆盖（制作人 2026-08-15 拍板）：全部 5 种采集物各 ≥1 个"送给居民→世界小变化"出口——
   *   野莓→小梅（farm 野莓篮）/ 野蘑菇→老张（老宅晾蘑菇串）/ 小野花→夏雅（老屋窗台花，特殊路径）
   *   / 蒲公英→阿风（town 河岸蒲公英丛）/ 树枝→木匠老周（farm 老屋旁木鸟小件）。
   * 特殊 NPC 不走 showDialogue（夏雅由 tryXiyaFlowerExchange 处理），故本配置只列 gardener/miner/adventurer/carpenter。
   */
  private static readonly GATHER_EXCHANGES: Record<string, { item: ItemType; eventId: string }> = {
    gardener: { item: 'wild_berry', eventId: 'ch1_gather_exchange_gardener' },
    miner: { item: 'wild_mushroom', eventId: 'ch1_gather_exchange_miner' },
    adventurer: { item: 'dandelion', eventId: 'ch1_gather_exchange_adventurer' },
    carpenter: { item: 'twig', eventId: 'ch1_gather_exchange_carpenter' },
  };

  /**
   * 钓点交互物设置（S6 老河堤）。
   * 位置参照：town 西侧 cols0-4 是河（gid4 水，碰撞），长椅在 (6,15)。
   * 钓点 = 长椅北侧水边 (5.5, 12)，玩家站此处面水甩竿。
   * 浮漂落点 = 河中央 (3, 13)，视觉上从钓点斜向甩入水中。
   * 零新资产：仅用 Graphics 画呼吸光晕吸引注意（参照 setupMusicBox），无文字标签——
   * 靠近时通过 DOM hint 提示"按 [E] 钓鱼"。
   */
  private setupFishingSpot(): void {
    const spot = MapScene.FISHING_SPOTS[this.mapKey];
    if (!spot) return; // 非钓点地图不设置
    this.fishingSpotPos = { ...spot.pos };
    this.floatPos = { ...spot.floatPos };

    // P5a: 视觉创建委托给 FishingController（条件判断留在 MapScene）
    const hideWaterMark = this.mapKey === 'town' && hasTriggered('laojiang_practice_done');
    const { waterMark } = this.fishingController.createFishingSpotVisual(
      this.fishingSpotPos, this.floatPos, hideWaterMark,
    );
    this.fishingSpotWaterMark = waterMark;
  }

  /**
   * 钓鱼靠近提示检测（对齐 checkOldTreeInteract / checkHouseTidyHint 范式）。
   * 仅 town 场景 + 非钓鱼中 + 无对话打开 + 距离钓点 < interactRange → 显示提示。
   */
  private checkFishingHint(): void {
    if (!MapScene.FISHING_SPOTS[this.mapKey] || this.fishingState !== 'idle' || this.storyDialogue?.isOpen()) {
      this.hideFishingHint();
      return;
    }
    // 青禾河畔：码头未修复时钓点未开放——不显示钓鱼提示（避免与"修码头"提示叠屏）
    if (this.mapKey === 'qinghe_river' && this.qinghePierRestore && !this.qinghePierRestore.restored) {
      this.hideFishingHint();
      return;
    }
    const dx = this.player.x - this.fishingSpotPos.x;
    const dy = this.player.y - this.fishingSpotPos.y;
    const range = MapScene.FISHING_CONFIG.interactRange;
    if (dx * dx + dy * dy < range * range) {
      this.showFishingHint();
    } else {
      this.hideFishingHint();
    }
  }

  /** 显示钓鱼靠近提示（DOM）— P5b 委托给 FishingController */
  private showFishingHint(): void {
    this.fishingController.showFishingInteractHint(isMobileLayout());
  }

  /** 隐藏钓鱼靠近提示 — P5b 委托给 FishingController */
  private hideFishingHint(): void {
    this.fishingController.hideFishingInteractHint();
  }

  // ═══════════════════════════════════════════════════════════════
  // 钓鱼老人 老姜（氛围锚点，2026-08-14 制作人拍板）
  // 依据：《钓鱼老人NPC-氛围锚点设计-v0.2》
  // 定位：最后一个还坚持每天去河边坐一下午的人；无感叹号、无任务图标、不强制触发。
  // 功能：教学（简单直白）/ 鱼种评价（一次性每种）/ 《钓鱼修行》小事件（三鱼入门 → 旧鱼竿）/ 复兴台词 / 老婆轻吐槽
  // 红线：零新系统 / 零新顶层存档字段（全部 triggerOnce + Inventory）/ 台词不解释系统
  // ═══════════════════════════════════════════════════════════════

  /** 老姜靠近检测（update 调用）：作息显隐 + 靠近提示（优先级高于钓鱼提示，避免双提示叠屏） */
  private checkLaoJiangInteract(): void {
    if (this.mapKey !== 'town') return;
    const present = getTime().hour >= 13 && getTime().hour < 17;
    if (this.laoJiangGfx && present !== this.laoJiangPresent) {
      this.laoJiangPresent = present;
      this.laoJiangGfx.setVisible(present);
      this.laoJiangLabel?.setVisible(present);
    }
    if (!present || this.storyDialogue?.isOpen()) {
      this.hideLaoJiangHint();
      return;
    }
    const dx = this.player.x - this.laoJiangPos.x;
    const dy = this.player.y - this.laoJiangPos.y;
    if (dx * dx + dy * dy < MapScene.LAO_JIANG_RANGE * MapScene.LAO_JIANG_RANGE) {
      this.showLaoJiangHint();
      this.hideFishingHint(); // 老姜提示优先：人比钓点近时先说话
    } else {
      this.hideLaoJiangHint();
    }
  }

  /** 显示老姜靠近提示（DOM）— P5b 委托给 FishingController */
  private showLaoJiangHint(): void {
    this.fishingController.showLaoJiangHint(isMobileLayout());
  }

  /** 隐藏老姜靠近提示 — P5b 委托给 FishingController */
  private hideLaoJiangHint(): void {
    this.fishingController.hideLaoJiangHint();
  }

  /**
   * 老姜交互入口（tryInteract 调用，钓鱼之前——人在旁边时先说话，站到水边才钓鱼）。
   * 一次性事件链全部走 triggerOnce 持久化（EventSystem 契约：fn 先执行 → save 在其后）。
   */
  private tryLaoJiangInteract(): boolean {
    if (this.mapKey !== 'town') return false;
    if (!this.laoJiangGfx?.visible) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const dx = this.player.x - this.laoJiangPos.x;
    const dy = this.player.y - this.laoJiangPos.y;
    if (dx * dx + dy * dy >= MapScene.LAO_JIANG_RANGE * MapScene.LAO_JIANG_RANGE) return false;
    const lines = this.buildLaoJiangDialogue();
    if (!lines.length) return false;
    this.hideLaoJiangHint();
    return this.playStory(lines, () => {
      this.updateHUD();
    }, undefined, 'lao_jiang');
  }

  /**
   * 老姜对白构建（build 模式，含一次性事件副作用 + 存档）：
   * ① 教学（fisher_teach_done）——简单直白，不故弄玄虚
   * ② 鱼种评价（laojiang_see_*，一次性每种）——钓到什么 = 被老姜记住
   * ③ 《钓鱼修行》完成（laojiang_practice_done）——三鱼入门 → 送出旧鱼竿（含老婆轻吐槽）
   * ④ 复兴台词变体（laojiang_revival_line，一次性）
   * ⑤ 日常台词（话少、慢、带老婆轻吐槽；按天轮换）
   */
  private buildLaoJiangDialogue(): DialogueLine[] {
    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    const persist = (): void => {
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      } as any);
    };

    // ① 教学（一次性）：NPC 教，不弹窗。话要短、要实，先讲怎么收竿。
    if (!hasTriggered('fisher_teach_done')) {
      triggerOnce('fisher_teach_done', () => { /* 仅标记；教学无奖励 */ });
      persist();
      return [
        narrator('（老姜坐在河边，草帽压得很低。你走近，他抬了抬帽檐。）'),
        { speaker: '老姜', color: COLORS.laojiang, text: '年轻人，也来看水？' },
        { speaker: '林澈', color: COLORS.linche, text: '……想学钓鱼。' },
        { speaker: '老姜', color: COLORS.laojiang, text: '钓鱼啊，不难。' },
        { speaker: '老姜', color: COLORS.laojiang, text: '抛竿下去，盯着浮漂。' },
        { speaker: '老姜', color: COLORS.laojiang, text: '浮漂一沉，就收竿。' },
        { speaker: '老姜', color: COLORS.laojiang, text: '收早了鱼会跑，等它咬实了再拉。多试几次，手就有数了。' },
      ];
    }

    // ② 鱼种评价（一次性每种）：背包有对应鱼 + 未给老姜看过 → 评价（不消耗鱼）
    const fishSeen: Array<[ItemType, string, string, string]> = [
      ['qinghe_crucian', 'laojiang_see_qinghe', '青禾鲫', '小鲫鱼，小时候我天天吃。'],
      ['river_shrimp', 'laojiang_see_shrimp', '河虾', '河虾啊……以前河边一捞就是一碗。'],
      ['dusk_fish', 'laojiang_see_dusk', '黄昏鱼', '黄昏鱼？这个点来钓，会钓鱼。'],
      // 普通特殊鱼（v1.3，制作人 2026-08-15 台词定稿：老姜不是图鉴系统，是"见过这条河变化的人"；
      // 每句带一点"以前什么样 / 现在回来了一点"，人话化定稿如下）
      ['river_eel', 'laojiang_see_eel', '河鳗', '河鳗啊，夜里才出来。以前河边夜钓的人，等的就是它。'],
      ['common_carp', 'laojiang_see_carp', '鲤鱼', '鲤鱼，老河里的常客。前些年少见了，没想到现在又能看见。'],
      ['big_blue_fish', 'laojiang_see_big', '大青鱼', '大青鱼？好些年没见这么大的了。'],
    ];
    for (const [item, evt, name, line] of fishSeen) {
      if (getItemCount(item) > 0 && !hasTriggered(evt)) {
        triggerOnce(evt, () => { /* 仅标记：钓到什么被老姜记住 */ });
        persist();
        return [
          narrator(`（你从背包里拿出${name}，给老姜看了看。）`),
          { speaker: '老姜', color: COLORS.laojiang, text: line },
        ];
      }
    }

    // ③ 《钓鱼修行》完成（一次性）：三种鱼都给老姜看过 → 入门完成，送出旧鱼竿
    if (
      hasTriggered('fisher_teach_done') &&
      hasTriggered('laojiang_see_qinghe') &&
      hasTriggered('laojiang_see_shrimp') &&
      hasTriggered('laojiang_see_dusk') &&
      !hasTriggered('laojiang_practice_done')
    ) {
      triggerOnce('laojiang_practice_done', () => {
        addItem('old_fishing_rod', 1);
        this.clearFishingSpotWaterMark();
      });
      persist();
      return [
        narrator('（老姜看了看你钓上来的鱼，点了点头。）'),
        { speaker: '老姜', color: COLORS.laojiang, text: '青禾鲫、河虾、黄昏鱼——三种都见过了。' },
        { speaker: '老姜', color: COLORS.laojiang, text: '算你入了门。' },
        { speaker: '老姜', color: COLORS.laojiang, text: '这根竿子跟了我大半辈子，送你。以后河边修行，就咱俩了。' },
        { speaker: '林澈', color: COLORS.linche, text: '……老姜，你老伴儿不念叨你吗？' },
        { speaker: '老姜', color: COLORS.laojiang, text: '念叨。说我整天跟鱼过不去，不务正业。' },
        { speaker: '老姜', color: COLORS.laojiang, text: '……鱼也没说什么。' },
        narrator('（你收下了老姜的旧鱼竿。握把上缠着的旧布，已经磨得发亮。）'),
      ];
    }

    // ④ 复兴台词变体（一次性）：集市恢复后
    if (isRestored('marketSquare') && !hasTriggered('laojiang_revival_line')) {
      triggerOnce('laojiang_revival_line', () => { /* 仅标记 */ });
      persist();
      return [
        narrator('（今天河边比往常热闹。老姜看着远处，没回头。）'),
        { speaker: '老姜', color: COLORS.laojiang, text: '集市又开起来了……河边也热闹了。' },
        { speaker: '老姜', color: COLORS.laojiang, text: '年轻时候嫌吵。老了才知道，没人吵才是真的安静。' },
        { speaker: '老姜', color: COLORS.laojiang, text: '……不过，热闹点也好。' },
      ];
    }

    // ④.5 放生彩蛋台词（一次性）：放生 2 天后，河面鱼变多——世界记得放生的行为
    if (this.fishShadowsActive() && !hasTriggered('laojiang_release_line')) {
      triggerOnce('laojiang_release_line', () => { /* 仅标记 */ });
      persist();
      return [
        narrator('（老姜盯着水面，看了好一会儿。）'),
        { speaker: '老姜', color: COLORS.laojiang, text: '最近河里的小家伙，好像多起来了。' },
      ];
    }

    // ④.6 雨天台词（2026-08-16 天气扩面第二刀，制作人拍板）：
    // 雨窗内老姜也在河边（13-17 作息与雨窗 10-16 有交集）——钓雨天的河，是"见过这条河变化的人"的雨天句。
    if (isCurrentlyRaining()) {
      return [
        narrator('（雨落在水面上。老姜的帽子压得更低了，浮漂还是一动不动地立着。）'),
        { speaker: '老姜', color: COLORS.laojiang, text: '鱼在下雨天，嘴巴正馋。' },
        { speaker: '老姜', color: COLORS.laojiang, text: '……就是人得坐得住，别急着收竿。' },
      ];
    }

    // ⑤ 日常台词：话少、慢、带老婆轻吐槽（轻微，不尖锐）
    const day = getTime().day;
    if (day % 2 === 0) {
      return [
        narrator('（老姜盯着浮漂，半天没说话。）'),
        { speaker: '老姜', color: COLORS.laojiang, text: '我那口子说我这是不务正业。' },
        { speaker: '老姜', color: COLORS.laojiang, text: '……她说她的，我钓我的。' },
      ];
    }
    return [
      narrator('（水面上浮漂轻轻晃了一下。老姜没动。）'),
      { speaker: '老姜', color: COLORS.laojiang, text: '坐得住，才钓得到。' },
    ];
  }

  /**
   * 钓鱼交互入口（tryInteract 调用）。
   * - idle 状态 + 靠近钓点 → 启动钓鱼循环
   * - 钓鱼中按 E → 收竿判定（成功 / 过早失败 / casting·waiting 主动取消）
   */
  private tryFishingInteract(): boolean {
    if (!MapScene.FISHING_SPOTS[this.mapKey]) return false;

    // 钓鱼中：按 E = 收竿判定 / 取消 (委托给 FishingController)
    if (this.fishingState !== 'idle') {
      // realBite/fakeBite 收竿；casting/waiting 主动取消
      // FishingController.tryFishingInteract() 内部已实现此逻辑
      return this.fishingController.tryFishingInteract();
    }

    // idle：检测靠近钓点
    const dx = this.player.x - this.fishingSpotPos.x;
    const dy = this.player.y - this.fishingSpotPos.y;
    const range = MapScene.FISHING_CONFIG.interactRange;
    if (dx * dx + dy * dy > range * range) return false;

    // 对话打开时不启动钓鱼
    if (this.storyDialogue?.isOpen()) return false;

    this.inputManager.clearAction();
    // 启动钓鱼 (委托给 FishingController)
    this.fishingController.startFishing();
    return true;
  }

  /**
   * 放生当前鱼：委托给 FishingController
   * P5d: 物理搬迁至 FishingController
   */
  private releaseCurrentFish(): void {
    this.fishingController.releaseCurrentFish();
  }

  /**
   * 小鱼苗特殊事件：委托给 FishingController
   * P5d: 物理搬迁至 FishingController
   */
  private presentFryReleaseChoice(): void {
    // 鱼苗选择对话框

    this.playStory(
      [
        { speaker: '', color: COLORS.system, text: '（手里的小鱼还很小，好像还没准备好离开河流。）' },
        { speaker: '', color: COLORS.system, text: '', options: ['放回河里', '带回去'] },
      ],
      () => this.updateHUD(),
      (index: number) => {
        if (index === 0) {
          this.releaseCurrentFish();
        } else {
          this.keepCurrentFry();
        }
      },
    );
  }

  /** 小鱼苗「带回去」：委托给 FishingController */
  private keepCurrentFry(): void {
    this.fishingController.keepCurrentFry();
  }

  /** 放生彩蛋生效判定：委托给 FishingController */
  private fishShadowsActive(): boolean {
    return this.fishingController.isFishShadowsActive();
  }

  /**
   * 放生彩蛋世界反馈（town create 调用）：放生 2 天后，S6 河堤水面出现 4 条小鱼影缓慢游动。
   * 零素材 Graphics 纯装饰无碰撞；玩家看到"河里的小家伙多起来了"（世界记得你的行为）。
   */
  private setupReleasedFishShadows(): void {
    if (this.mapKey !== 'town') return;
    if (!this.fishShadowsActive()) return;
    if (this.releasedFishGfx) return; // 幂等：同一场景实例内不重复创建
    // P5a: 视觉创建委托给 FishingController（条件判断留在 MapScene）
    const T = TILE_SIZE;
    const spots: Array<{ x: number; y: number; speed: number; phase: number }> = [
      { x: 2.6 * T, y: 13.2 * T, speed: 3400, phase: 0 },
      { x: 3.6 * T, y: 14.0 * T, speed: 4200, phase: 1.2 },
      { x: 2.0 * T, y: 14.6 * T, speed: 3000, phase: 2.1 },
      { x: 4.0 * T, y: 12.6 * T, speed: 3800, phase: 0.6 },
    ];
    this.releasedFishGfx = this.fishingController.createReleasedFishShadows(spots);
  }

  /**
   * 钓鱼资源清理（shutdown 调用）：视觉容器销毁 + DOM hint 移除 + 状态机复位。
   * 委托给 FishingController.forceCancelFishing()
   */
  private cleanupFishing(): void {
    this.fishingController.forceCancelFishing();
    // 注意：forceCancelFishing 已经处理了：
    // 1. 状态复位为 idle
    // 2. 视觉容器销毁
    // 3. DOM 提示清理
  }

  /** 移除钓点常驻浮漂（钓鱼修行完成后不再显示引导性特效）。 */
  private clearFishingSpotWaterMark(): void {
    this.fishingSpotWaterMark?.destroy();
    this.fishingSpotWaterMark = null;
  }

  // ═══════════════════════════════════════════════════════════════
  // 第一章 P2 钓鱼 Phase 4「生活系统」（2026-08-14 制作人拍板）
  // 依据：《钓鱼-可流动资源设计-v0.1.md》v0.2 §4.2（换/送/世界变化）
  // 红线：零新系统 / 零新顶层存档字段 / 一对一单跳一次性 / 台词方向稿待制作人"人话化"定稿
  // ═══════════════════════════════════════════════════════════════

  /**
   * NPC 交换入口（showDialogue 最高优先级注入）。
   * 条件：该 NPC 有交换配置 + 未换过 + 背包有对应鱼。
   * 对白已定稿（制作人 2026-08-14 拍板）：NPC 先作为"人"对鱼做反应，不解释交换系统。
   */
  private buildFishExchangeDialogue(npc: NPC): { lines: DialogueLine[]; onChoice: (i: number) => void } | null {
    const ex = MapScene.FISH_EXCHANGES[npc.id];
    if (!ex) return null;
    if (hasTriggered(ex.eventId)) return null;
    if (getItemCount(ex.item) <= 0) return null;

    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    let intro: DialogueLine[];
    if (npc.id === 'xiya') {
      // 发现时刻（隐藏 P0）——定稿：夏雅注意到鱼，交换理由是"她手里刚好有东西"，不是系统需求
      intro = [
        narrator('（夏雅看见你手里的鱼，走了过来。）'),
        { speaker: '夏雅', color: COLORS.xiya, text: '刚钓的？' },
        { speaker: '林澈', color: COLORS.linche, text: '嗯。' },
        { speaker: '夏雅', color: COLORS.xiya, text: '我那晒了点果干……要不，拿鱼换？反正我一个人也吃不完。' },
      ];
    } else if (npc.id === 'shopkeeper') {
      // 定稿：交易（给我鱼，明天兑现热汤）——与夏雅"交换"形成关系差异
      intro = [
        narrator('（老板接过鱼，掂了掂。）'),
        { speaker: '商店老板', color: '#8ac8a0', text: '哟，这鱼新鲜。搁我这，明天给你留碗热汤。' },
      ];
    } else if (npc.id === 'gardener') {
      // 定稿：小梅只反应"河虾刚好能吃"；小饭桌是玩家自己发现的世界变化（"你等下再来看"）
      intro = [
        narrator('（小梅接过河虾，眼睛亮了。）'),
        { speaker: '花匠小梅', color: COLORS.gardener, text: '呀，河虾！' },
        { speaker: '林澈', color: COLORS.linche, text: '拿着吧，今天刚捞的。' },
        { speaker: '花匠小梅', color: COLORS.gardener, text: '嗯，谢谢。……你等下再来看。' },
      ];
    } else if (npc.id === 'miner') {
      // 定稿：老张话少直接；"往老屋看一眼"是暗示不是信息
      intro = [
        narrator('（老张接过黄昏鱼，掂了掂。）'),
        { speaker: '矿工老张', color: COLORS.miner, text: '这鱼不错。晚上来家里吃。' },
        narrator('（老张转身往老屋方向看了一眼，没再说话。）'),
      ];
    } else {
      // 定稿（2026-08-14）：阿风 = 儿时的旧友（非冒险家）——黄昏鱼勾起小时候河边烤鱼的共同记忆；
      // 回报是晚上河边生火烤鱼（世界变化，见 setupAdventurerCampfire）
      intro = [
        narrator('（阿风看见你手里的鱼，眼睛一亮。）'),
        { speaker: '阿风', color: COLORS.adventurer, text: '哟，今天钓的？' },
        { speaker: '林澈', color: COLORS.linche, text: '嗯。' },
        { speaker: '阿风', color: COLORS.adventurer, text: '小时候咱们在河边烤过鱼，还记得不？' },
        { speaker: '林澈', color: COLORS.linche, text: '记得。糊了。' },
        { speaker: '阿风', color: COLORS.adventurer, text: '……这次不会糊。晚上来。' },
      ];
    }
    const lines: DialogueLine[] = [
      ...intro,
      { speaker: '', color: COLORS.system, text: '', options: ['换', '算了'] },
    ];
    return {
      lines,
      onChoice: (i: number) => {
        if (i === 0) this.doFishExchange(npc.id);
      },
    };
  }

  /** 执行交换：扣鱼 + 一次性事件（fn=回报）+ 存档（EventSystem 契约：save 放 triggerOnce 返回之后） */
  private doFishExchange(npcId: string): void {
    const ex = MapScene.FISH_EXCHANGES[npcId];
    if (!ex || hasTriggered(ex.eventId)) return;
    const have = getItemCount(ex.item);
    if (have <= 0) return;
    setItemCount(ex.item, have - 1);
    triggerOnce(ex.eventId, () => {
      if (npcId === 'xiya') {
        // 记交换日 → 次日河边长椅小场景 + 相簿（见 checkFishRiverside）
        this.fishXiyaExchangeDay = getTime().day;
      } else if (npcId === 'shopkeeper') {
        triggerTag('fish_tomorrow_soup');
      }
      // gardener → farm 小饭桌；miner → house 门轴 + elder_house 夜灯：对应场景 create 时按事件条件渲染
    });
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
  }

  /**
   * 采集物交换入口（showDialogue 注入，与 buildFishExchangeDialogue 并列，优先级低于鱼交换）。
   * 条件：该 NPC 有采集交换配置 + 未换过 + 背包有对应采集物。
   * 台词为草案（制作人定稿前可替换；按钓鱼定稿标准：NPC 先作为"人"对采集物反应，不解释系统）。
   */
  private buildGatherExchangeDialogue(npc: NPC): { lines: DialogueLine[]; onChoice: (i: number) => void } | null {
    const ex = MapScene.GATHER_EXCHANGES[npc.id];
    if (!ex) return null;
    if (hasTriggered(ex.eventId)) return null;
    if (getItemCount(ex.item) <= 0) return null;

    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    let intro: DialogueLine[];
    if (npc.id === 'gardener') {
      // 小梅收野莓：花匠身份的自然反应 → 花田旁野莓篮（世界变化，见 setupGatherBerryBasket）
      intro = [
        narrator('（小梅接过野莓，捻起一颗端详。）'),
        { speaker: '花匠小梅', color: COLORS.gardener, text: '呀，野莓！你摘的？' },
        { speaker: '林澈', color: COLORS.linche, text: '河边摘的，你尝尝。' },
        { speaker: '花匠小梅', color: COLORS.gardener, text: '嗯……甜。小时候我常去林子里摘，嘴都染紫了。' },
        { speaker: '花匠小梅', color: COLORS.gardener, text: '你等下再来看。' },
      ];
    } else if (npc.id === 'miner') {
      // 老张收野蘑菇：矿工/老屋主人的直接反应 → 老家门口晾蘑菇串（世界变化，见 setupGatherMushroomDrying）
      intro = [
        narrator('（老张接过野蘑菇，凑近闻了闻。）'),
        { speaker: '矿工老张', color: COLORS.miner, text: '野蘑菇？这东西认人。' },
        { speaker: '林澈', color: COLORS.linche, text: '认人？' },
        { speaker: '矿工老张', color: COLORS.miner, text: '认我。放心，晚上炖锅汤。' },
      ];
    } else if (npc.id === 'adventurer') {
      // 阿风收蒲公英：儿时旧友，吹绒纪念童年 → town 河岸蒲公英丛（世界变化，见 setupGatherDandelionPatch）
      intro = [
        narrator('（阿风接过蒲公英，放到嘴边鼓起气。）'),
        { speaker: '阿风', color: COLORS.adventurer, text: '蒲公英？小时候在河边吹过，还记得不？' },
        { speaker: '林澈', color: COLORS.linche, text: '记得。你说要许愿。' },
        { speaker: '阿风', color: COLORS.adventurer, text: '（一吹，绒毛四散）……那就许一个吧。让风带个信儿。' },
      ];
    } else {
      // 老周收小树枝：木匠手艺人的直接反应 → farm 老屋旁小木鸟（世界变化，见 setupGatherWoodenStarlingToy）
      intro = [
        narrator('（老周接过小树枝，掂了掂，笑了。）'),
        { speaker: '木匠老周', color: '#c89860', text: '这枯枝，削两下能当木钉使。别小看它。' },
        { speaker: '林澈', color: COLORS.linche, text: '那我多捡几根来？' },
        { speaker: '木匠老周', color: '#c89860', text: '一根就够。我给你削个小东西，回头挂老屋门口。' },
      ];
    }
    const lines: DialogueLine[] = [
      ...intro,
      { speaker: '', color: COLORS.system, text: '', options: ['收下吧', '算了'] },
    ];
    return {
      lines,
      onChoice: (i: number) => {
        if (i === 0) this.doGatherExchange(npc.id);
      },
    };
  }

  /** 执行采集交换：扣采集物 + 一次性事件 + 存档（EventSystem 契约：save 放 triggerOnce 返回之后） */
  private doGatherExchange(npcId: string): void {
    const ex = MapScene.GATHER_EXCHANGES[npcId];
    if (!ex || hasTriggered(ex.eventId)) return;
    const have = getItemCount(ex.item);
    if (have <= 0) return;
    setItemCount(ex.item, have - 1);
    triggerOnce(ex.eventId, () => {
      // 世界变化由各场景 create 按 hasTriggered 渲染：
      //   gardener → farm 花田旁野莓篮（setupGatherBerryBasket）
      //   miner → elder_house 老家门口晾蘑菇串（setupGatherMushroomDrying）
      //   adventurer → town 河岸蒲公英丛（setupGatherDandelionPatch）
      //   carpenter → farm 老屋门口小木鸟（setupGatherWoodenStarlingToy）
    });
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
  }

  /**
   * 采集物交换·夏雅（小野花）：特殊 NPC（不走 showDialogue），由清晨/傍晚交互路径调用。
   * 背包有小野花且未换过 → 播放交换对白（选项 收下吧/算了），返回 true；否则 false。
   * 回报：farm 老屋窗台插花（世界变化，见 setupXiyaWindowFlower）。
   */
  private tryXiyaFlowerExchange(cleanup: () => void): boolean {
    const EVENT = 'ch1_gather_exchange_xiya';
    if (hasTriggered(EVENT)) return false;
    if (getItemCount('small_flower') <= 0) return false;
    cleanup();

    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    this.playStory(
      [
        narrator('（夏雅接过小野花，捧在手心看了很久。）'),
        { speaker: '夏雅', color: COLORS.xiya, text: '这花……是林间的小野花吧？' },
        { speaker: '林澈', color: COLORS.linche, text: '嗯，路上采的。' },
        { speaker: '夏雅', color: COLORS.xiya, text: '谢谢。我把它放在窗台上，风会记得来看它。' },
        { speaker: '', color: COLORS.system, text: '', options: ['收下吧', '算了'] },
      ],
      () => this.updateHUD(),
      (i: number) => {
        if (i === 0) {
          const have = getItemCount('small_flower');
          if (have > 0) {
            setItemCount('small_flower', have - 1);
            triggerOnce(EVENT, () => {
              // 世界变化：farm 老屋窗台插花（setupXiyaWindowFlower 按 hasTriggered 渲染）
            });
          }
        }
        this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
        this.updateHUD();
      },
    );
    return true;
  }
  private tryXiyaFishExchange(cleanup: () => void): boolean {
    const fishEx = this.buildFishExchangeDialogue({ id: 'xiya' } as NPC);
    if (!fishEx) return false;
    cleanup();

    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    this.playStory(fishEx.lines, () => this.updateHUD(), (i: number) => {
      if (i === 0) this.doFishExchange('xiya');
      this.updateHUD();
    });
    return true;
  }

  /** 钓鱼 Phase 4：夏雅交换果干后，次日靠近河边长椅 → 小场景 + 相簿（一次性） */
  private checkFishRiverside(): void {
    if (this.mapKey !== 'town') return;
    if (!hasTriggered('fish_exchange_xiya')) return;
    if (hasTriggered('fish_xiya_riverside')) return;
    if (getTime().day <= this.fishXiyaExchangeDay) return;
    if (this.storyDialogue?.isOpen()) return;
    const T = TILE_SIZE;
    const bx = 5 * T + T / 2, by = 15 * T + T / 2; // S6 长椅 (5,15)
    const dx = this.player.x - bx, dy = this.player.y - by;
    if (dx * dx + dy * dy > 56 * 56) return;
    triggerOnce('fish_xiya_riverside', () => {
      unlockPhoto('xiya_dried_fruit');

      this.playStory([
        { speaker: '', color: COLORS.system, text: '（第二天。长椅旁，夏雅已经坐在那里了。）' },
        { speaker: '夏雅', color: COLORS.xiya, text: '来了？坐。' },
        { speaker: '林澈', color: COLORS.linche, text: '（坐下来，接过果干咬了一口）嗯，甜。' },
        { speaker: '夏雅', color: COLORS.xiya, text: '（笑）晒的时候放了一点盐。' },
      ]);
    });
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
    } as any);
  }

  /** 钓鱼 Phase 4：小梅收河虾后，farm 花田旁摆小饭桌（Graphics 程序绘制，零素材） */
  private setupFishTable(): void {
    if (!hasTriggered('fish_exchange_gardener')) return;
    // P5a: 视觉创建委托给 FishingController
    this.fishingController.createFishTable();
  }

  /**
   * 采集流向扩展：小梅收野莓后，farm 花田旁摆一篮野莓（世界变化，零素材 Graphics）。
   * 位置：花田 (3,7) 右侧空地 (5,8)，避开昆虫墙 (6,6)/野莓采集点 (8,4)/花田本体。
   * 玩家路过看到小梅的野莓篮——"我摘的东西留在了花田边"。
   */
  private setupGatherBerryBasket(): void {
    if (this.mapKey !== 'farm') return;
    if (!hasTriggered('ch1_gather_exchange_gardener')) return;
    if (this.gatherBerryBasketGfx) return; // 幂等：同一场景实例内不重复创建
    const T = TILE_SIZE;
    const x = 5 * T + T / 2, y = 8 * T + T / 2;
    const g = this.add.graphics().setDepth(3);
    g.fillStyle(0x8a5a30, 1); g.fillRect(x - 6, y - 2, 12, 4);          // 篮身
    g.fillStyle(0x6e4624, 1); g.fillRect(x - 7, y - 5, 14, 3);          // 篮沿
    g.fillStyle(0x6e4624, 1); g.fillRect(x - 1, y - 9, 2, 4);           // 提手
    // 野莓（三颗错开）
    g.fillStyle(0xc62828, 1); g.fillCircle(x - 4, y - 3, 1.6);
    g.fillStyle(0xef5350, 1); g.fillCircle(x, y - 3, 1.6);
    g.fillStyle(0x7f0000, 1); g.fillCircle(x + 4, y - 3, 1.6);
    // 几片叶（"刚摘的"）
    g.fillStyle(0x6d9a3a, 1); g.fillRect(x - 6, y - 6, 3, 1); g.fillRect(x + 3, y - 6, 3, 1);
    this.gatherBerryBasketGfx = g;
  }

  /**
   * 采集流向扩展：夏雅收小野花后，farm 老屋窗台插花（世界变化，零素材 Graphics）。
   * 位置：老屋 (11,20) 右侧窗台 (13,20)，避开恢复态灯笼/门前花/交互点。
   * 老屋荒废或恢复都成立——"屋里也有花"，镇子在慢慢回来。
   */
  private setupXiyaWindowFlower(): void {
    if (this.mapKey !== 'farm') return;
    if (!hasTriggered('ch1_gather_exchange_xiya')) return;
    if (this.xiyaWindowFlowerGfx) return; // 幂等
    const T = TILE_SIZE;
    const x = 13 * T + T / 2, y = 20 * T + T / 2;
    const g = this.add.graphics().setDepth(3);
    // 小花瓶（陶瓶）
    g.fillStyle(0x8a7a5a, 1); g.fillRect(x - 2, y - 3, 4, 6);
    g.fillStyle(0xa89a78, 1); g.fillRect(x - 2, y - 3, 4, 2);
    // 花茎 + 花头（三朵错开）
    g.fillStyle(0x5a8a3a, 1); g.fillRect(x - 4, y - 8, 1, 5); g.fillRect(x + 3, y - 9, 1, 6);
    g.fillStyle(0xec407a, 1); g.fillCircle(x - 4, y - 10, 1.8);
    g.fillStyle(0xf48fb1, 1); g.fillCircle(x + 3, y - 11, 1.8);
    g.fillStyle(0xffd166, 1); g.fillCircle(x + 3, y - 11, 0.8);
    this.xiyaWindowFlowerGfx = g;
  }

  /**
   * 采集流向扩展：老张收野蘑菇后，老张家（elder_house）门口晾蘑菇串（世界变化，零素材 Graphics）。
   * 位置：老张家窗边 (6,4)，与夜灯 (5,4) 错开——老张收蘑菇后"晚上炖锅汤"有了挂念。
   */
  private setupGatherMushroomDrying(): void {
    if (this.mapKey !== 'elder_house') return;
    if (!hasTriggered('ch1_gather_exchange_miner')) return;
    if (this.gatherMushroomDryingGfx) return; // 幂等
    const T = TILE_SIZE;
    const x = 6 * T + T / 2, y = 4 * T + T / 2;
    const g = this.add.graphics().setDepth(3);
    // 麻绳
    g.lineStyle(1, 0x6e4a2a, 0.9); g.lineBetween(x - 8, y - 8, x + 8, y - 8);
    // 三朵蘑菇串在绳上
    g.fillStyle(0xa1887f, 1); g.fillCircle(x - 5, y - 5, 2.2); g.fillStyle(0xd7ccc8, 1); g.fillCircle(x - 5, y - 5, 1);
    g.fillStyle(0x8a7a6a, 1); g.fillCircle(x, y - 4, 2); g.fillStyle(0xc8b8a8, 1); g.fillCircle(x, y - 4, 0.9);
    g.fillStyle(0xa1887f, 1); g.fillCircle(x + 5, y - 5, 1.8); g.fillStyle(0xd7ccc8, 1); g.fillCircle(x + 5, y - 5, 0.8);
    // 绳头小结
    g.fillStyle(0x6e4a2a, 1); g.fillCircle(x - 8, y - 8, 1); g.fillCircle(x + 8, y - 8, 1);
    this.gatherMushroomDryingGfx = g;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 居民需求系统升级：需求交付 → 世界变化（第一章 P0「世界反馈」，零素材纯 Graphics）
  // 每条需求交付后，对应场景 create 按 isRequestDone 渲染可见痕迹（幂等，读档自动恢复）
  // ═══════════════════════════════════════════════════════════════════════

  /** 小梅木材交付后：farm 花田旁搭起花架（爬藤 + 横杆），"花架终于搭起来了" */
  private setupReqFlowerTrellis(): void {
    if (this.mapKey !== 'farm') return;
    if (!isRequestDone('resident_req_gardener_wood')) return;
    if (this.reqFlowerTrellisGfx) return; // 幂等
    const T = TILE_SIZE;
    const x = 5 * T + T / 2, y = 7 * T + T / 2;
    const g = this.add.graphics().setDepth(3);
    // 两根立杆 + 一道横杆（竹色）
    g.fillStyle(0x8a6a42, 1); g.fillRect(x - 8, y - 14, 3, 16);
    g.fillRect(x + 6, y - 14, 3, 16);
    g.fillStyle(0xa88355, 1); g.fillRect(x - 8, y - 14, 3, 3); g.fillRect(x + 6, y - 14, 3, 3);
    g.fillStyle(0xa88355, 1); g.fillRect(x - 9, y - 14, 18, 3); // 横杆
    // 爬藤（绿卷须，从杆脚爬到横杆）
    g.fillStyle(0x6d9a3a, 1); g.fillRect(x - 5, y - 8, 1, 2); g.fillRect(x - 4, y - 10, 1, 3);
    g.fillRect(x + 3, y - 9, 1, 3); g.fillRect(x + 2, y - 12, 1, 2);
    // 几朵小花（"等花开"）
    g.fillStyle(0xff9e80, 1); g.fillCircle(x - 4, y - 11, 1.4);
    g.fillStyle(0xe8a0c8, 1); g.fillCircle(x + 2, y - 13, 1.4);
    g.fillStyle(0xffd166, 1); g.fillCircle(x + 2, y - 13, 0.7);
    // 投影
    g.fillStyle(0x2e2e34, 0.18); g.fillEllipse(x, y + 2, 20, 4);
    this.reqFlowerTrellisGfx = g;
  }

  /** 老周木材交付后：farm 老屋门口门框修好（立框 + 横梁 + 新门面），"修东西的人不能绝" */
  private setupReqDoorFrame(): void {
    if (this.mapKey !== 'farm') return;
    if (!isRequestDone('resident_req_carpenter_wood')) return;
    if (this.reqDoorFrameGfx) return; // 幂等
    const T = TILE_SIZE;
    const x = 11 * T + T / 2, y = 21 * T + T / 2;
    const g = this.add.graphics().setDepth(3);
    // 门框（新木色，立框 + 横梁）
    g.fillStyle(0x9a7a4a, 1); g.fillRect(x - 7, y - 10, 3, 12);      // 左框
    g.fillRect(x + 4, y - 10, 3, 12);                                 // 右框
    g.fillStyle(0xb8945c, 1); g.fillRect(x - 8, y - 12, 16, 3);      // 横梁
    // 新门面（浅木色 + 把手）
    g.fillStyle(0xc8a868, 1); g.fillRect(x - 4, y - 9, 8, 10);
    g.fillStyle(0xa8844c, 1); g.fillRect(x - 4, y - 9, 8, 2);
    g.fillStyle(0x6e5230, 1); g.fillCircle(x + 2, y - 4, 0.9);       // 门把手
    this.reqDoorFrameGfx = g;
  }

  /** 镇长灯笼交付后：town 挂起红灯笼（暖光呼吸），"夜里回来的人看得见镇子" */
  private setupReqLantern(): void {
    if (this.mapKey !== 'town') return;
    if (!isRequestDone('resident_req_elder_lantern')) return;
    if (this.reqLanternGfx) return; // 幂等
    const T = TILE_SIZE;
    const x = 23 * T + T / 2, y = 8 * T + T / 2;
    const g = this.add.graphics().setDepth(3);
    // 挂绳 + 红灯笼
    g.lineStyle(1, 0x6a4a2a, 0.9); g.lineBetween(x, y - 16, x, y - 8);
    g.fillStyle(0xcf3a2a, 1); g.fillRoundedRect(x - 4, y - 8, 8, 10, 3);
    g.fillStyle(0xffd166, 1); g.fillCircle(x, y - 3, 1.4);           // 灯芯
    // 暖光（呼吸，ADD）
    const glow = this.add.ellipse(x, y - 3, 40, 30, 0xffc878, 0.2).setDepth(2);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: { from: 0.12, to: 0.26 }, duration: 1400, yoyo: true, repeat: -1 });
    this.reqLanternGfx = g;
  }

  /** 阿风食物交付后：town 河边小灶（石灶 + 小锅 + 火苗），"河边煮一锅热乎的" */
  private setupReqStove(): void {
    if (this.mapKey !== 'town') return;
    if (!isRequestDone('resident_req_adventurer_food')) return;
    if (this.reqStoveGfx) return; // 幂等
    const T = TILE_SIZE;
    const x = 6 * T + T / 2, y = 16 * T + T / 2;
    const g = this.add.graphics().setDepth(3);
    // 石头灶（三块石围一圈）
    g.fillStyle(0x9a9aa2, 1); g.fillCircle(x - 6, y, 2.6);
    g.fillCircle(x + 6, y, 2.6);
    g.fillCircle(x, y + 4, 3);
    // 小锅（铁黑 + 边缘）
    g.fillStyle(0x3a3a42, 1); g.fillRoundedRect(x - 4, y - 6, 8, 5, 2);
    g.fillStyle(0x5a5a64, 1); g.fillRect(x - 5, y - 7, 10, 2);
    // 火苗（灶内）
    g.fillStyle(0xe07030, 1); g.fillCircle(x, y + 1, 2.4);
    g.fillStyle(0xffa040, 1); g.fillCircle(x, y, 1.6);
    g.fillStyle(0xffe080, 1); g.fillCircle(x, y - 1, 0.8);
    this.reqStoveGfx = g;
  }

  /** 老姜鱼获交付后：town 河边鱼篓（竹篓 + 鱼干挂绳），"河虾配酒" */
  private setupReqFishBasket(): void {
    if (this.mapKey !== 'town') return;
    if (!isRequestDone('resident_req_laojiang_fish')) return;
    if (this.reqFishBasketGfx) return; // 幂等
    const T = TILE_SIZE;
    const x = 6 * T + T / 2, y = 12 * T + T / 2;
    const g = this.add.graphics().setDepth(3);
    // 竹篓（圆篓 + 编织线）
    g.fillStyle(0xb8985a, 1); g.fillRoundedRect(x - 5, y - 4, 10, 9, 3);
    g.fillStyle(0x8a6a42, 1); g.lineStyle(0.8, 0x8a6a42, 0.9);
    g.lineBetween(x - 4, y - 2, x + 4, y - 2);
    g.lineBetween(x - 4, y + 1, x + 4, y + 1);
    // 篓口 + 提手
    g.fillStyle(0xd8b878, 1); g.fillRect(x - 5, y - 5, 10, 2);
    g.fillStyle(0x8a6a42, 1); g.fillRect(x - 1, y - 9, 2, 4);
    // 一条小鱼干挂篓边（"河虾配酒"）
    g.fillStyle(0xd8a878, 1); g.fillEllipse(x + 7, y - 1, 5, 3);
    g.fillStyle(0xc89868, 1); g.fillTriangle(x + 9, y - 1, x + 11, y - 2, x + 10, y);
    this.reqFishBasketGfx = g;
  }

  /**
   * 采集流向扩展：阿风收蒲公英后，town 河岸草丛冒出一小丛蒲公英（世界变化，零素材 Graphics）。
   * 位置：town 河西岸 (42,15)，与既有河岸蒲公英采集点 (40,14) 错开——"风吹去的种子落了地"。
   * 阿风把蒲公英吹散后，过段时间河岸边多了一丛野生的——玩家路过能认出"这是我给阿风的"。
   */
  private setupGatherDandelionPatch(): void {
    if (this.mapKey !== 'town') return;
    if (!hasTriggered('ch1_gather_exchange_adventurer')) return;
    if (this.gatherDandelionPatchGfx) return; // 幂等
    const T = TILE_SIZE;
    const x = 42 * T + 8, y = 15 * T + 8;
    const g = this.add.graphics().setDepth(3);
    // 一小丛蒲公英（三株错落，花 + 几朵已散落的种子小白点）
    for (const [dx, dy] of [[-3, 0], [1, 1], [4, 0]]) {
      const px = x + dx * 2, py = y + dy * 2;
      g.fillStyle(0x5a8a3a, 1); g.fillRect(px - 0.6, py - 6, 1.2, 6);   // 茎
      g.fillStyle(0xffeb3b, 1); g.fillCircle(px, py - 9, 2.2);          // 花冠
      g.fillStyle(0xfff9c4, 1); g.fillCircle(px, py - 9, 0.9);          // 花心高光
    }
    // 风留下的几颗种子小点（飘散在草地上）
    g.fillStyle(0xf5f0dc, 1); g.fillCircle(x + 10, y - 2, 0.9);
    g.fillStyle(0xf5f0dc, 1); g.fillCircle(x - 8, y - 3, 0.8);
    g.fillStyle(0xf5f0dc, 1); g.fillCircle(x + 2, y + 3, 0.7);
    this.gatherDandelionPatchGfx = g;
  }

  /**
   * 采集流向扩展：老周（木匠）收小树枝后，farm 老屋门口挂一只削的小木鸟（世界变化，零素材 Graphics）。
   * 位置：老屋 (11,20) 门口旁 (8,21)，与老屋窗台花 (13,20) 错开——老周说的"挂老屋门口"。
   * 玩家再路过老屋，能看见那根枯枝被老周削成了一只小木鸟："我给的东西，变成了有人会做的东西。"
   */
  private setupGatherWoodenStarlingToy(): void {
    if (this.mapKey !== 'farm') return;
    if (!hasTriggered('ch1_gather_exchange_carpenter')) return;
    if (this.gatherWoodenStarlingGfx) return; // 幂等
    const T = TILE_SIZE;
    const x = 8 * T + 4, y = 21 * T + 6;
    const g = this.add.graphics().setDepth(4);
    // 细绳吊挂的木鸟（圆身 + 小喙 + 尾羽）
    g.lineStyle(0.8, 0x8a6a45, 0.9); g.lineBetween(x, y - 10, x, y - 4); // 绳
    g.fillStyle(0xa0805a, 1); g.fillCircle(x, y, 2.6);                   // 鸟身
    g.fillStyle(0xc8a878, 1); g.fillCircle(x, y - 0.6, 1.1);             // 腹高光
    g.fillStyle(0x8a6a45, 1); g.fillTriangle(x + 2.4, y - 0.4, x + 4, y - 1, x + 2.6, y + 1.4); // 喙
    g.fillStyle(0xa0805a, 1); g.fillTriangle(x - 1.8, y + 0.8, x - 4, y + 1.5, x - 1.6, y + 2.4); // 尾
    g.fillStyle(0x3a2a18, 1); g.fillCircle(x - 0.8, y - 0.8, 0.4);       // 眼睛
    this.gatherWoodenStarlingGfx = g;
  }

  /** 钓鱼 Phase 4：老张收黄昏鱼后，house 老屋门轴修好（门旁暖色木钮 + 微光） */
  private setupFishDoorHinge(): void {
    if (!hasTriggered('fish_exchange_miner')) return;
    // P5a: 视觉创建委托给 FishingController
    this.fishingController.createFishDoorHinge();
  }

  /** 钓鱼 Phase 4：阿风收黄昏鱼后，晚上河边生火烤鱼（"这次不会糊"；零素材 Graphics，S6 老河堤岸线） */
  private setupAdventurerCampfire(): void {
    if (!hasTriggered('fish_exchange_adventurer')) return;
    const h = getTime().hour;
    if (h >= 6 && h < 18) return; // 阿风说"晚上来"——夜晚才出现
    // P5a: 视觉创建委托给 FishingController
    this.fishingController.createAdventurerCampfire();
  }

  /**
   * 表现层实验：夜晚河边火堆场景（2026-08-14）。
   * 四项：① 夜晚压暗 overlay + 火光 Add 混合暖光（呼吸）② 火星/萤火虫粒子（零素材 generateTexture）
   *       ③ 前景草叶遮挡（屏幕固定，scrollFactor 0）④ 玩家靠近火堆时镜头呼吸微动。
   * 实验范围：town 夜晚 + 阿风烤鱼交换已触发；通过后推广为统一视觉语言。
   */
  private setupNightCampfireVisuals(): void {
    if (!MapScene.NIGHT_VISUAL_EXPERIMENT) return;
    if (this.mapKey !== 'town') return;
    if (!hasTriggered('fish_exchange_adventurer')) return;
    const h = getTime().hour;
    if (h >= 6 && h < 18) return;

    const T = TILE_SIZE;
    const fx = 7 * T + T / 2, fy = 16 * T + T / 2; // 火堆位置

    // ① 夜晚压暗（屏幕固定，UI 之下；火光在它之上形成暖池）
    const dark = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height, 0x0a1428, 0.34,
    ).setScrollFactor(0).setDepth(190);
    dark.setInteractive(false);

    // ② 火光：Add 混合暖光（呼吸，范围大于基础光晕）
    const glow = this.add.ellipse(fx, fy, 130, 90, 0xffa050, 0.30).setDepth(191);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.16, to: 0.36 }, scaleX: { from: 0.9, to: 1.08 }, scaleY: { from: 0.85, to: 1.05 },
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // 火星粒子（零素材：Graphics → generateTexture）
    const sparkTex = this.make.graphics({ x: 0, y: 0 }, false);
    sparkTex.fillStyle(0xffd080, 1); sparkTex.fillCircle(2, 2, 2);
    sparkTex.generateTexture('fx_fire_spark', 4, 4);
    this.add.particles(fx, fy, 'fx_fire_spark', {
      speed: { min: 20, max: 55 },
      angle: { min: 240, max: 300 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 700, max: 1400 },
      frequency: 120,
      blendMode: Phaser.BlendModes.ADD,
      emitting: true,
    }).setDepth(191);

    // 萤火虫（河边慢飘 + 闪烁）
    const fireflyTex = this.make.graphics({ x: 0, y: 0 }, false);
    fireflyTex.fillStyle(0xe8ffb0, 1); fireflyTex.fillCircle(2, 2, 2);
    fireflyTex.generateTexture('fx_firefly', 4, 4);
    this.add.particles(0, 0, 'fx_firefly', {
      x: { min: 70, max: 210 }, y: { min: 205, max: 295 },
      speed: { min: 6, max: 16 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 1.1 },
      alpha: { start: 1, end: 0.15 },
      lifespan: { min: 1800, max: 2600 },
      frequency: 800,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(191);

    // ③ 前景遮挡：屏幕底部草叶剪影（scrollFactor 0，产生空间层次）
    const fg = this.add.graphics().setScrollFactor(0).setDepth(196);
    fg.fillStyle(0x0d1a0c, 0.92);
    for (let i = 0; i < 20; i++) {
      const bx = i * 68 + (i % 3) * 10;
      const bh = 26 + (i % 4) * 10;
      fg.fillTriangle(bx, this.scale.height, bx + 26, this.scale.height - bh, bx + 52, this.scale.height);
      fg.fillRect(bx + 4, this.scale.height - 8, 44, 8);
    }
    fg.fillRect(0, this.scale.height - 4, this.scale.width, 4);

    // ④ 镜头微动：玩家靠近火堆时轻微呼吸缩放（1.00 ± 0.015）
    const near = Math.hypot(this.player.x - fx, this.player.y - fy) < 150;
    if (near) {
      this.tweens.add({
        targets: this.cameras.main,
        zoom: { from: 0.99, to: 1.015 },
        duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  /**
   * 生命化改造·河岸段（2026-08-14，D-030 方向）：生活痕迹 + 岸线层次 + 前景芦苇。
   * 全部 Graphics 程序绘制（路线 C：零 tile 修改 / 零新素材 / 零存档字段）。
   * 目标：S6 河堤从"水 + 岸线"变成"有人生活过的河岸"。
   */
  private setupRiverbankLife(): void {
    if (this.mapKey !== 'town') return;
    const T = TILE_SIZE;
    const px = (c: number, r: number): [number, number] => [c * T + T / 2, r * T + T / 2];

    // ① 拴船桩 + 绳子（旧木桩，绳垂向水面——"这里有人靠过船"）
    {
      const [x, y] = px(6, 14);
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x5b4226, 1); g.fillRect(x - 2, y - 6, 4, 9);
      g.fillStyle(0x6e4a2c, 1); g.fillRect(x - 1, y - 6, 2, 2);
      g.fillStyle(0x3a2a18, 0.6); g.fillRect(x - 1, y + 2, 3, 2);
      g.lineStyle(1.5, 0xb8a878, 0.85); g.lineBetween(x + 2, y - 2, x - 8, y + 8);
    }
    // ② 旧木桶（路边遗弃物）
    {
      const [x, y] = px(7, 18);
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x7a5a33, 1); g.fillRoundedRect(x - 4, y - 3, 8, 7, 2);
      g.lineStyle(1, 0x4c3618, 0.9); g.strokeRoundedRect(x - 4, y - 3, 8, 7, 2);
      g.lineStyle(1.5, 0x5b4226, 0.9); g.lineBetween(x - 4, y, x + 4, y);
    }
    // ③ 渔网一角（晾在岸石上）
    {
      const [x, y] = px(5, 20);
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x8a8a92, 1); g.fillRect(x - 5, y - 2, 10, 4);
      g.lineStyle(1, 0xb8c8b8, 0.55);
      g.lineBetween(x - 8, y - 1, x + 8, y - 1);
      for (let i = 0; i < 5; i++) g.lineBetween(x - 8 + i * 4, y - 3, x - 6 + i * 3, y + 4);
    }
    // ④ 石子滩（水边碎石，岸线层次）
    {
      const g = this.add.graphics().setDepth(2);
      for (const [cx, cy, s] of [[5.1, 10, 2], [5.5, 13, 1.5], [5.3, 15, 2], [5.6, 17, 1.5], [5.2, 19, 1.5]]) {
        const [x, y] = px(cx, cy);
        g.fillStyle(0x9a9aa2, 1); g.fillCircle(x, y, s);
        g.fillStyle(0xb8b8c0, 0.7); g.fillCircle(x - s * 0.4, y - s * 0.4, s * 0.4);
      }
    }
    // ⑤ 碎花/草簇（岸线生活痕迹）
    {
      const g = this.add.graphics().setDepth(2);
      for (const [cx, cy, col] of [[7, 13, 0xd860a0], [7.5, 16, 0xe8b040], [7, 19, 0xd860a0], [7.8, 21, 0xe8b040]]) {
        const [x, y] = px(cx, cy);
        g.fillStyle(0x5a8a4a, 1); g.fillRect(x - 1, y - 1, 2, 3);
        g.fillStyle(col, 1); g.fillRect(x - 2, y - 3, 1, 1); g.fillRect(x + 1, y - 3, 1, 1); g.fillRect(x, y - 4, 1, 1);
      }
    }
    // ⑥ 前景芦苇（水缘，depth 高于玩家——走过时轻微遮挡，形成空间层次）
    {
      const g = this.add.graphics().setDepth(12);
      for (const [cx, cy, h] of [[4.2, 13, 10], [4.1, 16, 13], [4.3, 19, 11], [4.0, 21, 14]]) {
        const [x, y] = px(cx, cy);
        g.fillStyle(0x2e4a18, 1); g.fillRect(x - 1, y - h, 2, h);
        g.fillStyle(0x6a4a2a, 1); g.fillRect(x - 2, y - h - 2, 4, 3);
      }
    }
    // ⑦ 散步路径感：岸线内侧轻微踩踏痕迹（低透明暗绿，提示"有人常走这里"）
    {
      const g = this.add.graphics().setDepth(2);
      for (const [cx, cy] of [[6.3, 13], [6.5, 15], [6.2, 17], [6.5, 19], [6.2, 21]]) {
        const [x, y] = px(cx, cy);
        g.fillStyle(0x3a5a30, 0.16);
        g.fillEllipse(x, y, 12, 5);
      }
    }
    // ⑧ 河岸树列（内侧 x7.5-8.5，错落；纯视觉 sprite 不参与碰撞，形成"水岸的框"）
    {
      const trees: [number, number, string][] = [
        [7.5, 11, 'tree1'], [8.5, 13, 'tree_big'], [7.5, 15, 'tree2'],
        [8.5, 17, 'tree1'], [8.5, 19, 'tree2'], [8.5, 21, 'tree_big'], [7.5, 23, 'tree1'],
      ];
      for (const [cx, cy, key] of trees) {
        const [x, y] = px(cx, cy);
        const s = this.add.image(x, y, key).setScale(0.5).setDepth(4);
        if (key === 'tree_big') s.setOrigin(0.5, 1);
      }
    }
    // ⑨ 旧木栈台（水缘小幅延伸的磨损木台——"有人在这儿坐了很久"）
    {
      const [x0, y0] = px(3.8, 14.7);
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x8a6a45, 1); g.fillRect(x0, y0, 22, 3);                 // 台面
      g.fillStyle(0x9a7a52, 0.9); g.fillRect(x0 + 7, y0, 3, 3); g.fillRect(x0 + 15, y0, 3, 3);
      g.fillStyle(0x5b4226, 1); g.fillRect(x0, y0 - 1, 22, 1);             // 板缝暗线
      g.fillStyle(0x6e5633, 1); g.fillRect(x0 + 2, y0 + 3, 2, 5); g.fillRect(x0 + 18, y0 + 3, 2, 5); // 支柱
      g.fillStyle(0x000000, 0.10); g.fillRect(x0 - 1, y0 + 3, 24, 3);      // 水面投影
    }
    // ⑩ 钓鱼装备簇（竹竿斜靠 + 鱼篓 + 鱼饵盒 + 保温茶壶——"江叔的装备"）
    {
      const [bx, by] = px(7.2, 16);
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x8a9a3a, 1); g.fillRect(bx - 2, by - 18, 2, 20);         // 竹竿
      g.fillStyle(0xa8b858, 1); g.fillRect(bx - 2, by - 18, 1, 20);
      g.fillStyle(0xb89858, 1); g.fillRect(bx + 5, by - 8, 8, 7);           // 鱼篓
      g.fillStyle(0x9a7a3a, 1); g.fillRect(bx + 6, by - 8, 6, 2);
      g.fillStyle(0x8a6a45, 1); g.fillRect(bx + 1, by - 4, 5, 3);           // 鱼饵盒
      g.fillStyle(0x9a9aa2, 1); g.fillRect(bx - 7, by - 6, 5, 5);           // 保温茶壶
      g.fillStyle(0xb8b8c0, 0.8); g.fillRect(bx - 6, by - 6, 3, 2);
      g.fillStyle(0x8a8a92, 1); g.fillRect(bx - 7, by - 7, 2, 1);
    }
    // ⑪ 大石步（不规则天然落脚石，升级石子滩）
    {
      const g = this.add.graphics().setDepth(2);
      for (const [cx, cy, s] of [[5.3, 14, 3], [5.4, 16, 2.5], [5.2, 18, 3]]) {
        const [x, y] = [cx * T + T / 2, cy * T + T / 2];
        g.fillStyle(0x8a8a92, 1); g.fillEllipse(x, y, s * 3, s * 2);
        g.fillStyle(0xa8a8b0, 0.8); g.fillEllipse(x - 1, y - 1, s * 2, s);
      }
    }
    // ⑫ 水草（水缘暗绿簇，"水里有东西"）
    {
      const g = this.add.graphics().setDepth(2);
      for (const [cx, cy] of [[3.3, 14], [3.6, 16], [3.1, 18], [3.8, 15]]) {
        const [x, y] = [cx * T + T / 2, cy * T + T / 2];
        g.fillStyle(0x3a5a30, 0.8);
        g.fillRect(x - 2, y - 4, 1, 5); g.fillRect(x, y - 6, 1, 6); g.fillRect(x + 2, y - 3, 1, 4);
      }
    }
    // ⑬ 老姜（钓鱼老人）视觉锚点：草帽大叔，坐在水岸小板凳上、靛蓝旧衫（深描边，与草地/木色拉开）、竹竿垂向水面、脚边茶杯。
    // 依据《钓鱼老人NPC-氛围锚点设计-v0.2》（制作人 2026-08-14 拍板：名字老姜 / 草帽大叔外观）。
    // 作息：13:00-17:00 在场（update 按小时切换显隐），其余时段"收竿回家"。
    // 交互：靠近按 E 对话（教学 / 鱼种评价 / 《钓鱼修行》/ 老婆轻吐槽），见 buildLaoJiangDialogue。
    {
      const [x, y] = [84, 232]; // 世界 (84,232)：钓点南侧岸线（距钓点 32px，交互范围不打架），面朝西侧水面
      const g = this.add.graphics().setDepth(4);
      // 脚底投影（先把人"压"在地面上，再谈细节——草地上的立身锚点）
      g.fillStyle(0x14240f, 0.34); g.fillEllipse(x, y + 7, 22, 5);
      // 小板凳（深色轮廓 + 旧木坐面/腿）
      g.fillStyle(0x2e2012, 1); g.fillRect(x - 5, y + 1, 11, 6);
      g.fillStyle(0x9a6a38, 1); g.fillRect(x - 4, y + 2, 9, 2);
      g.fillStyle(0x6e4a24, 1); g.fillRect(x - 4, y + 4, 2, 3); g.fillRect(x + 3, y + 4, 2, 3);
      // 身体：深色描边 + 靛蓝旧衫（与草地绿 / 木台棕错开）+ 衣领高光 + 深灰裤
      g.fillStyle(0x26303e, 1); g.fillRect(x - 4, y - 8, 9, 11);
      g.fillStyle(0x4a5a78, 1); g.fillRect(x - 3, y - 7, 7, 9);
      g.fillStyle(0x5a6a88, 1); g.fillRect(x - 2, y - 7, 2, 4);
      g.fillStyle(0x2e2e3a, 1); g.fillRect(x - 3, y - 2, 3, 4); g.fillRect(x + 1, y - 2, 3, 4);
      // 手臂 + 竹竿（暗线垫底 = 描边，亮竹绿在上；竿斜向左上伸向水面，鱼线垂落——老姜面朝西侧河流）
      g.fillStyle(0x4a5a78, 1); g.fillRect(x - 2, y - 7, 3, 3);
      g.lineStyle(2, 0x2e3014, 1); g.lineBetween(x - 1, y - 6, x - 11, y - 14);
      g.lineStyle(1.3, 0xa0b048, 1); g.lineBetween(x - 1, y - 6, x - 11, y - 14);
      g.lineStyle(1, 0x6a7a28, 0.8); g.lineBetween(x - 11, y - 14, x - 14, y - 8);
      g.lineStyle(0.8, 0xf0f0f0, 0.6); g.lineBetween(x - 14, y - 8, x - 12, y + 2);
      // 头 + 草帽（暖肤 + 亮草帽，帽檐压低——"他在看水，不看玩家"）
      g.fillStyle(0x26303e, 1); g.fillCircle(x, y - 10, 4);
      g.fillStyle(0xe8b088, 1); g.fillCircle(x, y - 10, 3);
      g.fillStyle(0x2e2012, 1); g.fillEllipse(x, y - 13, 12, 4);
      g.fillStyle(0xe8c878, 1); g.fillEllipse(x, y - 13, 10, 3);
      g.fillStyle(0x8a6a2a, 1); g.fillRect(x - 1, y - 14, 3, 2);   // 帽带
      g.fillStyle(0x2e2012, 1); g.fillRect(x - 2, y - 17, 5, 4);   // 帽顶描边
      g.fillStyle(0xd8a848, 1); g.fillRect(x - 1, y - 16, 3, 3);   // 帽顶
      // 脚边茶杯（深边 + 浅杯身，杯口冒一点热气）
      g.fillStyle(0x3a3a3a, 1); g.fillRect(x + 4, y - 2, 5, 4);
      g.fillStyle(0xd0d0d0, 1); g.fillRect(x + 5, y - 1, 3, 2);
      g.fillStyle(0xffffff, 0.4); g.fillRect(x + 6, y - 3, 1, 2);
      // 名字标牌（老姜；与 NPC 标牌同范式，depth 5）
      this.laoJiangLabel = this.add.text(x, y - 22, '老姜', {
        fontSize: '11px', color: '#f0c860',
        stroke: '#000000', strokeThickness: 3,
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(5);
      // 竿尖轻点（"有动静"的呼吸感，不改坐标）
      this.tweens.add({
        targets: g,
        angle: { from: 0, to: 0.6 },
        duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      // 作息：13:00-17:00 在场（初始状态按当前时间）
      this.laoJiangGfx = g;
      this.laoJiangPresent = getTime().hour >= 13 && getTime().hour < 17;
      g.setVisible(this.laoJiangPresent);
      this.laoJiangLabel.setVisible(this.laoJiangPresent);
    }
  }

  /**
   * 生命化改造·场景密度（2026-08-14）：在空旷草地区补装饰簇（草簇/小花/小灌木/石），
   * 打破"大片单色地面"的空旷感。零素材 Graphics、无碰撞、不挡路。
   * 位置按 town 地面栅格人工避让：道路/石板/建筑/NPC 站位/出口/集市区。
   */
  private setupTownDensityClusters(): void {
    if (this.mapKey !== 'town') return;
    // P4: 物理搬迁到 WorldDecorator
    this.worldDecorator.decorateTownDensityClusters();
  }

  /**
   * 阶段4 中央广场生活化（2026-08-14，执行方案 P1 中央广场：装饰物 + 夜晚灯光 + 生活痕迹）。
   * 定位：石板十字广场 = 青禾镇视觉中心（P0 已石板化，7 NPC 站场）；这里补"有人在这里停留"的物件。
   * 零素材纯 Graphics、无碰撞、不挡路、避开 NPC 站位（town SPOTS）与路带：
   *   ① 西北角石井（记忆点：老井 = 广场的历史）
   *   ② 东南/西南角石凳 ×2（歇脚点，强化聚集感）
   *   ③ 石板踩踏斑驳 + 落叶（"有人走"的生活痕迹）
   *   ④ 东北角灯柱（夜晚暖光呼吸，广场夜晚灯光）
   */
  private setupCentralPlaza(): void {
    if (this.mapKey !== 'town') return;
    // P4: 物理搬迁到 WorldDecorator（石井/石凳/石板/灯柱）
    this.worldDecorator.decorateCentralPlaza();
    // 灯柱暖光：夜晚（18:00-06:00）才显示 —— 时间判断保留在 MapScene
    const h = getTime().hour;
    if (h >= 18 || h < 6) {
      this.worldDecorator.startLampGlow();
    }
  }

  /**
   * town 下方西侧生活角美化（2026-08 制作人要求）：大片草地补"有人生活的角落"。
   * 位置：row 19-25, col 5-9（下方西侧草地，避开主干道石板/建筑/河岸/需求板）。
   * 零素材纯 Graphics，无碰撞、不挡路；生活痕迹 = 柴堆 / 晾衣绳 / 石凳 / 水桶 / 花丛 / 踩踏小路。
   */
  private setupTownBottomLife(): void {
    if (this.mapKey !== 'town') return;
    const T = TILE_SIZE;
    const px = (c: number, r: number): [number, number] => [c * T + T / 2, r * T + T / 2];

    // ① 柴堆（生活痕迹：几根圆木靠墙摞着）
    {
      const [x, y] = px(5, 19);
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x8a6a42, 1); g.fillRect(x - 7, y + 1, 14, 3);              // 底柴
      g.fillStyle(0x9a7a4e, 1); g.fillRect(x - 7, y + 1, 14, 1);              // 柴顶亮面
      g.fillStyle(0x6e4a2a, 1); g.fillRect(x - 5, y - 2, 10, 3);             // 第二层
      g.fillStyle(0x8a6a42, 1); g.fillRect(x - 3, y - 5, 6, 3);              // 顶层
      g.fillStyle(0x5b3d1e, 1); g.fillRect(x - 7, y + 1, 2, 3);              // 阴影端
    }
    // ② 晾衣绳（生活感：两木杆 + 横绳 + 蓝/粉衣物，随风微晃）
    {
      const [x0, y0] = px(7, 19);
      const [x1, y1] = px(9, 19);
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x6e4a2a, 1); g.fillRect(x0 - 2, y0 - 10, 3, 12);          // 左杆
      g.fillRect(x1 - 2, y1 - 10, 3, 12);                                    // 右杆
      g.lineStyle(1, 0x8a6a42, 0.9); g.lineBetween(x0, y0 - 8, x1, y1 - 8);  // 横绳
      // 衣物（挂在绳上：蓝衫 + 粉布 + 白袜）
      g.fillStyle(0x6a94b8, 1); g.fillRect(x0 + 3, y0 - 7, 4, 5);            // 蓝衫
      g.fillStyle(0xc878a0, 1); g.fillRect(x0 + 10, y0 - 7, 3, 4);           // 粉布
      g.fillStyle(0xe8e8f0, 1); g.fillRect(x1 - 8, y1 - 7, 3, 3);            // 白袜
      // 衣物夹子
      g.fillStyle(0x4a4a52, 1); g.fillRect(x0 + 3, y0 - 8, 4, 1);
      g.fillRect(x0 + 10, y0 - 8, 3, 1);
      g.fillRect(x1 - 8, y1 - 8, 3, 1);
    }
    // ③ 石凳（歇脚点：两石墩 + 石板面，傍晚微光）
    {
      const [x, y] = px(6, 23);
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x9a9aa2, 1); g.fillRect(x - 8, y - 2, 16, 3);             // 石面
      g.fillStyle(0x8a8a92, 1); g.fillRect(x - 7, y + 1, 5, 4);              // 左墩
      g.fillRect(x + 2, y + 1, 5, 4);                                        // 右墩
      g.fillStyle(0xb8b8c0, 0.7); g.fillRect(x - 8, y - 2, 16, 1);           // 面高光
    }
    // ④ 木水桶（生活痕迹：井边/门口常见）
    {
      const [x, y] = px(8, 24);
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x8a6a42, 1); g.fillRect(x - 3, y - 3, 6, 6);              // 桶身
      g.fillStyle(0x6e4a2a, 1); g.fillRect(x - 3, y - 3, 6, 2);              // 桶口
      g.fillStyle(0x9a7a4e, 1); g.fillRect(x - 3, y - 2, 6, 1);              // 高光
      g.fillStyle(0x4a3626, 1); g.fillRect(x - 4, y + 3, 8, 1);              // 底影
      g.fillStyle(0x6e4a2a, 1); g.fillRect(x - 1, y - 6, 2, 3);              // 提手
    }
    // ⑤ 小花丛（点缀生活感）
    {
      const [x, y] = px(5, 25);
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x5a8a3a, 1); g.fillRect(x - 6, y, 1, 4);                  // 茎
      g.fillRect(x - 1, y + 1, 1, 3);
      g.fillRect(x + 4, y, 1, 4);
      g.fillStyle(0xff9e80, 1); g.fillCircle(x - 6, y - 2, 1.6);             // 花
      g.fillStyle(0xf4b8d8, 1); g.fillCircle(x - 1, y - 1, 1.4);
      g.fillStyle(0xffd166, 1); g.fillCircle(x + 4, y - 2, 1.5);
      g.fillStyle(0x8abc5a, 1); g.fillRect(x - 4, y - 1, 1, 2);              // 叶
      g.fillRect(x + 2, y - 1, 1, 2);
    }
    // ⑥ 踩踏小路（草地踏痕，从建筑门口到河边，提示"有人常走"）
    {
      const g = this.add.graphics().setDepth(2);
      for (const [c, r] of [[5, 20], [5, 21], [5, 22], [5, 23], [5, 24]] as Array<[number, number]>) {
        const [x, y] = px(c, r);
        g.fillStyle(0x3a5a30, 0.16);
        g.fillEllipse(x, y, 12, 4);
      }
    }
  }

  /**
   * town 南郊自然美化（2026-08 制作人要求"继续美术风格优化"）：
   * 位置：row 29-34, col 2-15（row 28 石板路南侧大片草地）。
   * 零素材纯 Graphics，无碰撞不挡路；南郊 = 自然过渡（树/花/草/石）+ 生活痕迹（踩踏小路）。
   */
  private setupTownSouthLife(): void {
    if (this.mapKey !== 'town') return;
    // P4: 物理搬迁到 WorldDecorator（树/花/草/石/踩踏小路）
    this.worldDecorator.decorateTownSouthLife();
  }

  // ═══════════════════════════════════════════════════════════════
  // 小镇计划·星光艺术展（Feature-XXX，2026-08-15 制作人拍板）
  // 依据：《星光艺术展-垂直切片设计稿-v0.2-拍板基线.md》+《任务卡 v0.1》
  // 循环：解锁 → 筹备（环境/人际/素材）→ 当天（约 10 分钟演出）→ 永久变化（广场东侧艺术角）
  // 红线：软期限无倒计时 / 面板只读观察 / 零新系统（MapSceneFlags + triggerOnce + 现有系统组合）
  // ═══════════════════════════════════════════════════════════════

  private static readonly ARTSHOW = {
    corner: { x: 500, y: 285 },   // 展台
    sign: { x: 484, y: 262 },     // 展示牌
    bench: { x: 512, y: 322 },    // 长椅
    box: { x: 526, y: 304 },      // 素材箱
    xiya: { x: 492, y: 276 },     // 广场夏雅（筹备期策划）
    plaza: { x: 400, y: 288 },    // 广场中心（活动触发判定）
  };
  /** 秋日晒场落点：镇东头空地（地图 50x35，东头 x38-48 / y14-19 tiles 为空旷带，不与艺术角(≈x31)/NPC 站位冲突） */
  private static readonly DRYYARD = {
    yard:  { x: 656, y: 262 },    // 晒场中心（环境物件簇 + 当天演出触发判定）
    box:   { x: 624, y: 292 },    // 征集筐（「今年的收成」交付点）
    xiya:  { x: 676, y: 236 },    // 筹备期晒场夏雅（抱旧照片）
    sign:  { x: 620, y: 238 },    // 「青禾晒场」木牌（永久期）
    laozhang: { x: 648, y: 288 }, // 永久期老张停留（照看晒架）
  };
  /** 收获专属描述（v1.1 收获仪式感：让每种作物有自己的"手感"） */
  private static readonly HARVEST_DESC: Record<CropType, string> = {
    radish: '水灵灵的萝卜',
    tomato: '熟透的番茄',
    corn: '饱满的玉米',
    strawberry: '红得发亮的草莓',
  };
  /** 会话级：环境物件已构建到第几阶段（幂等，避免重复 add） */
  private artShowEnvBuilt = 0;

  private artShowAvailable(): boolean {
    return isChapterAtLeast(CHAPTER_1) && hasTriggered('ch1_spring_fair');
  }

  private artShowPeopleDone(): boolean {
    return hasTriggered('artshow_xiya_plan')
      && hasTriggered('artshow_elder_coord')
      && hasTriggered('artshow_carpenter_photo')
      && hasTriggered('artshow_gardener_flower');
  }

  private artShowReady(): boolean {
    return this.artShowUnlocked && this.artShowEnvStage >= 3
      && this.artShowPeopleDone() && this.artShowMaterialsDone && !this.artShowHeld;
  }

  /** create 挂载（town）：按状态重建艺术角/环境物件/素材箱/广场夏雅/永久变化 */
  private setupArtShow(): void {
    if (this.mapKey !== 'town' || !this.artShowUnlocked) return;
    this.artShowEnvBuilt = 0;
    this.buildArtShowEnvObjects();
    this.buildArtShowBox();
    this.spawnArtShowXiya();
    if (this.artShowPerm) {
      this.buildArtShowPermanent();
      this.setupArtShowTraveler();
      this.setupArtShowAfterXiya();
    }
  }

  /** 环境物件（按 envStage 增量构建：展台→灯光→花艺） */
  private buildArtShowEnvObjects(): void {
    if (this.mapKey !== 'town') return;
    const c = MapScene.ARTSHOW.corner;
    if (this.artShowEnvStage >= 1 && this.artShowEnvBuilt < 1) {
      this.artShowEnvBuilt = 1;
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x2e2e34, 0.25); g.fillEllipse(c.x, c.y + 6, 46, 7);   // 投影
      g.fillStyle(0x6e4a24, 1); g.fillRect(c.x - 17, c.y, 3, 6); g.fillRect(c.x + 14, c.y, 3, 6); // 台脚
      g.fillStyle(0x8a6a45, 1); g.fillRect(c.x - 18, c.y - 4, 36, 4);    // 台面
      g.fillStyle(0x5b4226, 1); g.fillRect(c.x - 18, c.y - 5, 36, 1);    // 板缝
      g.fillStyle(0x9a7a52, 0.9); g.fillRect(c.x - 12, c.y - 4, 3, 2); g.fillRect(c.x + 8, c.y - 4, 3, 2);
      g.lineStyle(1.2, 0x7a5a33, 1); g.lineBetween(c.x + 8, c.y - 16, c.x + 4, c.y - 2); // 画架
      g.lineBetween(c.x + 8, c.y - 16, c.x + 14, c.y - 2);
    }
    if (this.artShowEnvStage >= 2 && this.artShowEnvBuilt < 2) {
      this.artShowEnvBuilt = 2;
      const lx = c.x + 24, ly = c.y - 20;
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x3a3a44, 1); g.fillRect(lx - 1, ly, 2, 20);
      g.fillStyle(0xffd98a, 1); g.fillRect(lx - 2, ly - 3, 4, 4);
      const h = getTime().hour;
      if (h >= 18 || h < 6) {
        const glow = this.add.ellipse(lx, ly - 1, 44, 30, 0xffc878, 0.18).setDepth(3);
        glow.setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: glow, alpha: { from: 0.10, to: 0.24 }, duration: 1600, yoyo: true, repeat: -1 });
      }
    }
    if (this.artShowEnvStage >= 3 && this.artShowEnvBuilt < 3) {
      this.artShowEnvBuilt = 3;
      const g = this.add.graphics().setDepth(3);
      for (const ox of [-26, 26]) {
        g.fillStyle(0x9a6a3a, 1); g.fillRect(c.x + ox - 3, c.y + 1, 6, 5);
        g.fillStyle(0xd860a0, 1); g.fillRect(c.x + ox - 1, c.y - 3, 2, 4);
        g.fillStyle(0xe8b040, 1); g.fillRect(c.x + ox - 4, c.y - 2, 1, 2); g.fillRect(c.x + ox + 3, c.y - 2, 1, 2);
        g.fillStyle(0x5a8a4a, 1); g.fillRect(c.x + ox - 1, c.y - 1, 1, 2);
      }
    }
  }

  /** 素材箱（艺术角交付点） */
  private buildArtShowBox(): void {
    const b = MapScene.ARTSHOW.box;
    const c = this.add.container(b.x, b.y).setDepth(3);
    const g = this.add.graphics();
    g.fillStyle(0x8a6a45, 1); g.fillRect(-7, -5, 14, 8);
    g.lineStyle(1, 0x4c3618, 0.9); g.strokeRect(-7, -5, 14, 8);
    g.lineStyle(1, 0x5b4226, 0.9); g.lineBetween(-7, -1, 7, -1);
    c.add(g);
    this.add.text(b.x, b.y - 12, '征集箱', {
      fontSize: '10px', color: '#e8d8a8', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(4);
    this.artShowBox = c;
  }

  /** 筹备期广场夏雅（白天出现；策划事件未触发时） */
  private spawnArtShowXiya(): void {
    if (hasTriggered('artshow_xiya_plan')) return;
    const t = getTime();
    if (t.hour < 8 || t.hour >= 18) return;
    const p = MapScene.ARTSHOW.xiya;
    this.artShowXiya = this.add.sprite(p.x, p.y, 'npc_xiya');
    this.artShowXiya.setScale(0.5).setDepth(5);
    this.add.text(p.x, p.y - 24, '夏雅', {
      fontSize: '12px', color: '#f0a050', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6);
  }

  /** 永久变化：艺术角（展示牌/长椅/旅人作品/白天看展剪影） */
  private buildArtShowPermanent(): void {
    if (this.mapKey !== 'town') return;
    const c = MapScene.ARTSHOW;
    // 展示牌
    const sign = this.add.graphics().setDepth(3);
    sign.fillStyle(0x6e4a24, 1); sign.fillRect(c.sign.x - 1, c.sign.y - 12, 2, 14);
    sign.fillStyle(0x8a6a45, 1); sign.fillRect(c.sign.x - 8, c.sign.y - 16, 16, 7);
    sign.fillStyle(0xffe9b0, 0.9); sign.fillRect(c.sign.x - 6, c.sign.y - 14, 12, 3);
    this.add.text(c.sign.x, c.sign.y - 18, '星光艺术展', {
      fontSize: '9px', color: '#ffe9b0', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(4);
    // 长椅
    const bench = this.add.graphics().setDepth(3);
    bench.fillStyle(0x2e2e34, 0.25); bench.fillEllipse(c.bench.x, c.bench.y + 3, 22, 4);
    bench.fillStyle(0x4a4a52, 1); bench.fillRect(c.bench.x - 8, c.bench.y - 3, 16, 3);
    bench.fillStyle(0x3a3a42, 1); bench.fillRect(c.bench.x - 7, c.bench.y, 2, 3); bench.fillRect(c.bench.x + 5, c.bench.y, 2, 3);
    // 旅人作品（画架上的画："把星光留下"——深蓝画布 + 星光点）
    const art = this.add.graphics().setDepth(3);
    art.lineStyle(1.2, 0x7a5a33, 1);
    art.lineBetween(c.corner.x + 8, c.corner.y - 16, c.corner.x + 4, c.corner.y - 2);
    art.lineBetween(c.corner.x + 8, c.corner.y - 16, c.corner.x + 14, c.corner.y - 2);
    art.fillStyle(0x3a4a5a, 1); art.fillRect(c.corner.x + 5, c.corner.y - 14, 6, 8);
    art.fillStyle(0xffe9b0, 0.95); art.fillRect(c.corner.x + 6, c.corner.y - 13, 1, 1);
    art.fillRect(c.corner.x + 8, c.corner.y - 11, 1, 1);
    art.fillRect(c.corner.x + 9, c.corner.y - 8, 1, 1);
    // 白天"有人坐艺术角"由可交互的旅人回访承担（见 setupArtShowTraveler）：
    // 此处不再额外画静态剪影，避免与旅人精灵重叠（baseline §八.1「NPC 会在那里停留」）。
  }

  /**
   * 星光艺术展余波·旅人回访：艺术展办完后，旅人艺术家回来坐艺术角长椅看自己的展品。
   * 出现时段：晨/白天/傍晚（08-20 时）——"以后每年这段时间我再回来看看它"；
   * 夜晚（20 点后）旅人歇息不出现，广场只剩灯和作品。
   * 可交互：靠近 → 一句余波台词（一次性 `artshow_traveler_return`）。
   * 零新系统：Graphics 旅人剪影（复用旅人 #c8a8e8 配色），复用现有 hint/对白范式。
   */
  private setupArtShowTraveler(): void {
    if (this.mapKey !== 'town') return;
    if (!this.artShowPerm) return;
    if (this.artShowTravelerGfx) return; // 幂等
    const h = getTime().hour;
    if (h < 8 || h >= 20) return;       // 夜晚不在
    const p = this.artShowTravelerPos;
    const g = this.add.graphics().setDepth(5);
    // 身形（坐在长椅上：腿放松、一手支着下巴看展）
    g.fillStyle(0x2e2a3a, 1); g.fillCircle(p.x - 3, p.y - 9, 3.4);      // 头
    g.fillStyle(0xc8a8e8, 0.9); g.fillCircle(p.x - 3, p.y - 9, 2.6);    // 肤色（旅人浅紫调）
    g.fillStyle(0x3a3a48, 1); g.fillRect(p.x - 6, p.y - 5, 9, 5);       // 上身/外套
    g.fillStyle(0x2e2a3a, 1); g.fillRect(p.x - 5, p.y - 2, 8, 2);       // 腿（坐姿，垂在凳前）
    g.fillStyle(0x2e2a3a, 1); g.fillRect(p.x - 7, p.y - 9, 1, 3);       // 上扬手臂（支下巴）
    // 身旁靠着一个画夹（"他还在画"）
    g.fillStyle(0x4a3a2a, 1); g.fillRect(p.x + 5, p.y - 6, 2, 4);
    // 名字标牌（旅人；与 NPC 标牌同范式，depth 5）
    this.artShowTravelerLabel = this.add.text(p.x, p.y - 21, '旅人', {
      fontSize: '11px', color: '#c8a8e8',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 2, y: 1 },
    }).setOrigin(0.5).setDepth(5);
    this.artShowTravelerGfx = g;
    // 轻微呼吸（"坐一会儿"的氛围）
    this.tweens.add({
      targets: g,
      angle: { from: 0, to: 0.6 },
      duration: 3600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  /** 旅人回访交互入口（town，靠近长椅按 E） */
  private tryArtShowTravelerInteract(): boolean {
    if (this.mapKey !== 'town') return false;
    if (!this.artShowPerm) return false;
    if (!this.artShowTravelerGfx?.visible) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const h = getTime().hour;
    if (h < 8 || h >= 20) return false; // 夜晚不在
    const dx = this.player.x - this.artShowTravelerPos.x;
    const dy = this.player.y - this.artShowTravelerPos.y;
    if (dx * dx + dy * dy >= 42 * 42) return false;
    this.hideArtShowTravelerHint();
    this.inputManager.clearAction();
    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    // 余波台词（方向稿）：第一次回访一句，随后是日常看展句，都克制、具体。
    const once = triggerOnce('artshow_traveler_return', () => { /* 仅标记回访已读过 */ });
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    const lines: DialogueLine[] = once ? [
      narrator('（旅人坐在长椅上，正对着一幅画，一动不动。）'),
      { speaker: '旅人', color: '#c8a8e8', text: '……回来了。你们的星光，我画下来的地方。' },
      { speaker: '林澈', color: COLORS.linche, text: '还想再看看？' },
      { speaker: '旅人', color: '#c8a8e8', text: '嗯。把它留在纸上，走到哪儿都能带着。' },
    ] : [
      narrator('（旅人又来看那幅画了。这一次，他带了个新的小本子。）'),
      { speaker: '旅人', color: '#c8a8e8', text: '这镇子安静，画得下去。' },
    ];
    return this.playStory(lines, () => this.updateHUD(), undefined, 'artshow_traveler');
  }

  /** 旅人回访靠近提示（update 调用，仅在白天/傍晚在此时显示；夜晚隐去） */
  private checkArtShowTravelerProximity(): void {
    if (this.mapKey !== 'town' || !this.artShowPerm) {
      this.hideArtShowTravelerHint();
      return;
    }
    // 时间显隐：夜晚（20 点后 / 晨间 8 点前）旅人不出现（他歇息，广场只剩灯和展品）
    const h = getTime().hour;
    const present = h >= 8 && h < 20;
    if (this.artShowTravelerGfx) this.artShowTravelerGfx.setVisible(present);
    if (this.artShowTravelerLabel) this.artShowTravelerLabel.setVisible(present);
    if (!present) { this.hideArtShowTravelerHint(); return; }
    const dx = this.player.x - this.artShowTravelerPos.x;
    const dy = this.player.y - this.artShowTravelerPos.y;
    if (dx * dx + dy * dy < 42 * 42 && !this.storyDialogue?.isOpen()) {
      this.hideArtShowHint(); // 互斥：旅人与庆典后夏雅提示同底栏，只留一条
      this.showArtShowTravelerHint();
    } else {
      this.hideArtShowTravelerHint();
    }
  }

  private showArtShowTravelerHint(): void {
    if (this.artShowTravelerHint) return;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '180px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffe9b0', fontSize: '13px',
      background: 'rgba(0,0,0,0.65)', padding: '6px 16px', borderRadius: '6px',
      zIndex: '400', pointerEvents: 'none',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    hint.textContent = isMobileLayout() ? '点击「交互」对话' : '按 [E] 对话';
    hint.classList.add('hint-interact'); // 2026-08-16 兜底清扫标记（hideAllInteractHints 强制移除残留）
    document.body.appendChild(hint);
    this.artShowTravelerHint = hint;
  }

  private hideArtShowTravelerHint(): void {
    if (this.artShowTravelerHint) {
      this.artShowTravelerHint.remove();
      this.artShowTravelerHint = null;
    }
  }

  /** 庆典后夏雅（艺术角展台旁，白天照看；对齐旅人回访范式） */
  private setupArtShowAfterXiya(): void {
    if (this.mapKey !== 'town' || !this.artShowPerm) return;
    if (this.artShowAfterXiya) return; // 幂等：同一场景实例内不重复创建
    const h = getTime().hour;
    if (h < 8 || h >= 20) return;       // 夜晚不在（与旅人一致：广场只剩灯和作品）
    const p = MapScene.ARTSHOW.xiya;    // 展台旁（原筹备期站位；旅人在长椅 (516,322)，距离 >52px 不重叠）
    this.artShowAfterXiya = this.add.sprite(p.x, p.y, 'npc_xiya');
    this.artShowAfterXiya.setScale(0.5).setDepth(5);
    this.artShowAfterXiyaLabel = this.add.text(p.x, p.y - 24, '夏雅', {
      fontSize: '12px', color: '#f0a050', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6);
  }

  /** 庆典后夏雅交互入口（town，展台旁按 E）：余波一次 + 日常轮换 */
  private tryArtShowAfterXiyaInteract(): boolean {
    if (this.mapKey !== 'town' || !this.artShowPerm) return false;
    if (!this.artShowAfterXiya?.visible) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const h = getTime().hour;
    if (h < 8 || h >= 20) return false; // 夜晚不在
    const dx = this.player.x - this.artShowAfterXiya.x;
    const dy = this.player.y - this.artShowAfterXiya.y;
    if (dx * dx + dy * dy >= 34 * 34) return false;
    this.hideArtShowHint();
    this.inputManager.clearAction();
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    // 余波台词（方向稿）：第一次一句，随后按天奇偶轮换日常句，都克制、具体。
    const once = triggerOnce('artshow_xiya_after', () => { /* 仅标记：庆典后夏雅余波已读 */ });
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    const day = getTime().day;
    const lines: DialogueLine[] = once ? [
      narrator('（展办完的第二天，夏雅又站在展台边，把那盏星光灯擦亮了。）'),
      { speaker: '夏雅', color: COLORS.xiya, text: '灯还亮着。路过的人，都会停下来看一眼。' },
      { speaker: '林澈', color: COLORS.linche, text: '会一直有人来看的。' },
      { speaker: '夏雅', color: COLORS.xiya, text: '嗯。……我就在这儿等着。' },
    ] : (day % 2 === 0 ? [
      narrator('（夏雅在展台边，给花换了个方向。）'),
      { speaker: '夏雅', color: COLORS.xiya, text: '今天也有人来看画。……挺好的。' },
    ] : [
      narrator('（夏雅坐在艺术角的长椅边上，看着远处。）'),
      { speaker: '夏雅', color: COLORS.xiya, text: '那盏灯晚上亮起来，河边也能看见。' },
    ]);
    this.playStory(lines, () => this.updateHUD(), undefined, "")
    return true;
  }

  /** 庆典后夏雅靠近提示（update 调用；复用 artShowHint 底栏，与旅人提示互斥） */
  private checkArtShowAfterXiyaProximity(): void {
    if (this.mapKey !== 'town' || !this.artShowPerm || !this.artShowAfterXiya) {
      this.hideArtShowHint();
      return;
    }
    const h = getTime().hour;
    const present = h >= 8 && h < 20;
    if (this.artShowAfterXiya) this.artShowAfterXiya.setVisible(present);
    if (this.artShowAfterXiyaLabel) this.artShowAfterXiyaLabel.setVisible(present);
    if (!present) { this.hideArtShowHint(); return; }
    if (this.storyDialogue?.isOpen() || this.townPlanPanel) {
      this.hideArtShowHint();
      return;
    }
    const dx = this.player.x - this.artShowAfterXiya.x;
    const dy = this.player.y - this.artShowAfterXiya.y;
    if (dx * dx + dy * dy < 34 * 34) {
      this.hideArtShowTravelerHint(); // 互斥：同一底栏位置只保留一条提示
      this.showArtShowHint();
    } else {
      this.hideArtShowHint();
    }
  }

  /** 清理庆典后夏雅（场景切换时调用，防残留） */
  private clearArtShowAfterXiya(): void {
    this.artShowAfterXiya?.destroy();
    this.artShowAfterXiya = null;
    this.artShowAfterXiyaLabel?.destroy();
    this.artShowAfterXiyaLabel = null;
    this.hideArtShowHint();
  }

  /** 统一隐藏所有靠近交互提示（对话打开 / 场景切换时调用，防 DOM 提示残留） */
  private hideAllInteractHints(): void {
    this.hideOldTreeHint();
    this.hideHouseTidyHint();
    // P5b: 钓鱼相关 3 个提示统一清理
    this.fishingController.cleanupAllHints();
    this.hideGatherHint();
    this.hideArtShowHint();
    this.hideArtShowTravelerHint();
    this.hideQinghePierHint();
    this.hideQinghePavilionHint();
    this.hideQingheChatterHint();
    this.hideQingheOldManHint();
    this.hideCh2Hint();
    // 2026-08-16 兜底：无论上面某个提示是否漏清/引用丢失/成孤儿节点，
    // 只要还挂在 document.body 上的底部交互提示一律强制移除，根治「一直停在屏幕上」。
    document.querySelectorAll<HTMLElement>('.hint-interact').forEach((el) => el.remove());
  }

  /** 清理旅人回访（场景切换时调用，防残留） */
  private cleanupArtShowTraveler(): void {
    this.artShowTravelerGfx?.destroy();
    this.artShowTravelerGfx = null;
    this.artShowTravelerLabel?.destroy();
    this.artShowTravelerLabel = null;
    this.hideArtShowTravelerHint();
  }

  /** 打开「小镇计划」面板（只读观察 + 素材放入动作；首次打开 = 解锁契机） */
  private openTownPlan(): void {
    if (this.townPlanPanel) { this.closeTownPlan(); return; }
    const panel = document.createElement('div');
    panel.id = 'town-plan-panel';
    Object.assign(panel.style, {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      width: 'min(380px, 88vw)', maxHeight: '84vh', overflowY: 'auto',
      background: 'rgba(25,20,15,0.96)', border: '2px solid #8a6a45', borderRadius: '12px',
      padding: '16px 18px', zIndex: '600', color: '#e0e0e0', fontSize: '13px', lineHeight: '1.7',
    });
    const title = document.createElement('div');
    title.style.cssText = 'font-size:16px;font-weight:bold;color:#ffe9b0;margin-bottom:10px;';
    title.textContent = '🗓 小镇计划';
    panel.appendChild(title);
    const content = document.createElement('div');
    content.id = 'town-plan-content';
    panel.appendChild(content);
    const close = document.createElement('div');
    close.style.cssText = 'margin-top:12px;text-align:center;color:#ffd98a;cursor:pointer;';
    close.textContent = '关闭';
    close.addEventListener('click', () => this.closeTownPlan());
    panel.appendChild(close);
    document.body.appendChild(panel);
    this.townPlanPanel = panel;
    // 首次打开：解锁 + 契机文本
    if (!this.artShowUnlocked && this.artShowAvailable()) {
      this.artShowUnlocked = true;
      // 解锁后即时挂载：素材箱 / 环境物件 / 筹备期广场夏雅（幂等）
      if (!this.artShowBox) this.buildArtShowBox();
      this.buildArtShowEnvObjects();
      this.spawnArtShowXiya();
      save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    }
    this.refreshTownPlanPanel();
  }

  private closeTownPlan(): void {
    if (this.townPlanPanel) {
      this.townPlanPanel.remove();
      this.townPlanPanel = null;
    }
  }

  /** 刷新面板内容（状态 + 素材放入按钮） */
  private refreshTownPlanPanel(): void {
    const content = this.townPlanPanel?.querySelector('#town-plan-content');
    if (!content) return;
    content.innerHTML = '';
    const addSection = (label: string, items: Array<{ ok: boolean; text: string }>): void => {
      const sec = document.createElement('div');
      sec.style.cssText = 'margin-bottom:10px;';
      const h = document.createElement('div');
      h.style.cssText = 'color:#d8b878;font-weight:bold;margin-bottom:4px;';
      h.textContent = label;
      sec.appendChild(h);
      for (const it of items) {
        const row = document.createElement('div');
        row.style.cssText = `color:${it.ok ? '#8bc34a' : '#b0b0b0'};padding-left:10px;`;
        row.textContent = `${it.ok ? '✔' : '○'} ${it.text}`;
        sec.appendChild(row);
      }
      content.appendChild(sec);
    };
    const planName = this.artShowHeld ? '星光艺术展 · 已举办' : '星光艺术展 · 筹备中';
    const head = document.createElement('div');
    head.style.cssText = 'font-size:14px;color:#ffe9b0;margin-bottom:8px;';
    head.textContent = planName;
    content.appendChild(head);
    if (!this.artShowUnlocked) {
      const intro = document.createElement('div');
      intro.style.cssText = 'color:#b0b0b0;margin-bottom:10px;white-space:pre-line;';
      intro.textContent = '春日大集之后，镇上的人开始议论——\n"原来咱们还能热闹起来。"\n\n夏雅说：把现在的青禾镇摆出来，给大家看看。\n\n邮递员送来一封信：一位旅人艺术家听说这里，想来看一看。';
      content.appendChild(intro);
    }
    if (this.artShowHeld) {
      const done = document.createElement('div');
      done.style.cssText = 'color:#8bc34a;margin-bottom:8px;';
      done.textContent = '展览办完了。广场东侧多了个艺术角——以后路过，有人会坐在那里看一会儿。';
      content.appendChild(done);
    } else {
    addSection('环境', [
      { ok: this.artShowEnvStage >= 1, text: '展台（木材×2）' },
      { ok: this.artShowEnvStage >= 2, text: '灯光（矿石×1）' },
      { ok: this.artShowEnvStage >= 3, text: '花艺（野花×2）' },
    ]);
    addSection('人际', [
      { ok: hasTriggered('artshow_xiya_plan'), text: '夏雅 · 设计展区' },
      { ok: hasTriggered('artshow_elder_coord'), text: '镇长 · 协调区域' },
      { ok: hasTriggered('artshow_carpenter_photo'), text: '老周 · 旧照片' },
      { ok: hasTriggered('artshow_gardener_flower'), text: '小梅 · 花艺' },
    ]);
    addSection('素材', [
      { ok: this.artShowMaterialsDone, text: '晚餐食材（鱼×1）' },
    ]);
    // 素材放入按钮
    if (!this.artShowReady()) {
      const mat = document.createElement('div');
      mat.style.cssText = 'margin-top:8px;';
      const btnStyle = 'display:inline-block;margin:3px 6px 3px 0;padding:4px 10px;border-radius:6px;cursor:pointer;pointer-events:auto;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:#e0e0e0;font-size:12px;';
      const addBtn = (label: string, act: () => void, disabled: boolean): void => {
        const b = document.createElement('span');
        b.textContent = label;
        b.style.cssText = btnStyle + (disabled ? 'opacity:0.4;cursor:default;' : '');
        if (!disabled) b.addEventListener('click', () => { act(); this.refreshTownPlanPanel(); });
        mat.appendChild(b);
      };
      addBtn('放入木材×2', () => this.artShowDeliver('wood', 2, () => { this.artShowEnvStage = Math.max(this.artShowEnvStage, 1); }), getItemCount('wood') < 2);
      addBtn('放入矿石×1', () => this.artShowDeliverOre(), this.artShowOreCount() < 1);
      addBtn('放入野花×2', () => this.artShowDeliverFlower(), this.artShowFlowerCount() < 2);
      addBtn('放入鱼×1', () => this.artShowDeliver('qinghe_crucian', 1, () => { this.artShowMaterialsDone = true; }), getItemCount('qinghe_crucian') < 1);
      const tip = document.createElement('div');
      tip.style.cssText = 'color:#8a8a80;font-size:11px;margin-top:6px;';
      tip.textContent = '素材从镇子四周带来——去采集、钓鱼、挖矿，带回来放进征集箱。';
      mat.appendChild(tip);
      content.appendChild(mat);
    }
    }

    // ── 秋日晒场（EventPlan 第二实例）：状态 + 三类准备 + 交付按钮 ──
    if (this.dryyardUnlocked || this.dryyardAvailable()) {
      const sep = document.createElement('div');
      sep.style.cssText = 'border-top:1px solid rgba(216,184,120,0.25);margin:12px 0;';
      content.appendChild(sep);
      const dHead = document.createElement('div');
      dHead.style.cssText = 'font-size:14px;color:#ffe9b0;margin-bottom:8px;';
      dHead.textContent = this.dryyardHeld ? '秋日晒场 · 已举办' : '秋日晒场 · 筹备中';
      content.appendChild(dHead);
      if (!this.dryyardUnlocked) {
        const dIntro = document.createElement('div');
        dIntro.style.cssText = 'color:#b0b0b0;margin-bottom:10px;white-space:pre-line;';
        dIntro.textContent = '今年的玉米收下来了，镇上的人在议论收成。\n\n傍晚的镇子里，好像有老人想起了什么旧事。';
        content.appendChild(dIntro);
      } else if (this.dryyardHeld) {
        const dDone = document.createElement('div');
        dDone.style.cssText = 'color:#8bc34a;margin-bottom:8px;';
        dDone.textContent = '晒场办过了。镇子东头多了一处「青禾晒场」——以后路过，有人在那里晒今年的东西。';
        content.appendChild(dDone);
      } else {
        addSection('晒场恢复', [
          { ok: this.dryyardEnvStage >= 1, text: '晒架（木材×2）' },
          { ok: this.dryyardEnvStage >= 2, text: '竹席·鱼干架（鱼×1）' },
          { ok: this.dryyardEnvStage >= 3, text: '玉米串·辣椒串（玉米×2）' },
        ]);
        addSection('人际', [
          { ok: hasTriggered('dryyard_laozhang_craft'), text: '老张 · 过去（旧手艺）' },
          { ok: hasTriggered('dryyard_xiya_photo'), text: '夏雅 · 现在（旧照片）' },
          { ok: hasTriggered('dryyard_afeng_help'), text: '阿风 · 未来（搭把手）' },
        ]);
        addSection('今年的收成', [
          { ok: this.dryyardMaterialsDone, text: '蔬菜或野花×1' },
        ]);
        const dMat = document.createElement('div');
        dMat.style.cssText = 'margin-top:8px;';
        const btnStyle = 'display:inline-block;margin:3px 6px 3px 0;padding:4px 10px;border-radius:6px;cursor:pointer;pointer-events:auto;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:#e0e0e0;font-size:12px;';
        const addBtn = (label: string, act: () => void, disabled: boolean): void => {
          const b = document.createElement('span');
          b.textContent = label;
          b.style.cssText = btnStyle + (disabled ? 'opacity:0.4;cursor:default;' : '');
          if (!disabled) b.addEventListener('click', () => { act(); this.refreshTownPlanPanel(); });
          dMat.appendChild(b);
        };
        addBtn('放入木材×2', () => this.dryyardDeliver('wood', 2, () => { this.dryyardEnvStage = Math.max(this.dryyardEnvStage, 1); }), getItemCount('wood') < 2);
        addBtn('放入鱼×1', () => this.dryyardDeliver('qinghe_crucian', 1, () => { this.dryyardEnvStage = Math.max(this.dryyardEnvStage, 2); }), getItemCount('qinghe_crucian') < 1);
        addBtn('放入玉米×2', () => this.dryyardDeliver('corn', 2, () => { this.dryyardEnvStage = Math.max(this.dryyardEnvStage, 3); }), getItemCount('corn') < 2);
        addBtn('放入蔬菜或野花×1', () => this.dryyardDeliverCrop(), this.dryyardCropCount() < 1);
        const dTip = document.createElement('div');
        dTip.style.cssText = 'color:#8a8a80;font-size:11px;margin-top:6px;';
        dTip.textContent = '收成筐在镇子东头的晒场边——老张说，把这一年种出来的东西，摆一些出来。';
        dMat.appendChild(dTip);
        content.appendChild(dMat);
      }
    }
  }

  /** 晒场「今年的收成」可用蔬菜/野花计数（番茄/萝卜/野花/蒲公英任一） */
  private dryyardCropCount(): number {
    return getItemCount('tomato') + getItemCount('radish') + getItemCount('small_flower') + getItemCount('dandelion');
  }

  /** 晒场「今年的收成」交付（蔬菜或野花任一 → materialsDone） */
  private dryyardDeliverCrop(): void {
    for (const id of ['tomato', 'radish', 'small_flower', 'dandelion'] as const) {
      if (getItemCount(id) > 0) {
        setItemCount(id, getItemCount(id) - 1);
        break;
      }
    }
    this.dryyardMaterialsDone = true;
    this.buildDryyardEnvObjects();
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    if (this.dryyardReady()) this.showDialogueText('镇子说：都齐了，挑个傍晚，把晒场办起来。');
  }

  /** 晒场交付素材：扣库存 → 状态变化 → 世界物件 → 存档（对齐 artShowDeliver 范式） */
  private dryyardDeliver(item: 'wood' | 'qinghe_crucian' | 'corn', count: number, onChange: () => void): void {
    if (getItemCount(item) < count) return;
    setItemCount(item, getItemCount(item) - count);
    onChange();
    this.buildDryyardEnvObjects();
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    if (this.dryyardReady()) this.showDialogueText('镇子说：都齐了，挑个傍晚，把晒场办起来。');
  }

  private artShowOreCount(): number {
    return getItemCount('stone') + getItemCount('copper') + getItemCount('iron');
  }

  private artShowFlowerCount(): number {
    return getItemCount('small_flower') + getItemCount('dandelion');
  }

  /** 交付素材：扣库存 → 状态变化 → 世界物件 → 存档 */
  private artShowDeliver(item: 'wood' | 'qinghe_crucian', count: number, onChange: () => void): void {
    if (getItemCount(item) < count) return;
    setItemCount(item, getItemCount(item) - count);
    onChange();
    this.buildArtShowEnvObjects();
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    if (this.artShowReady()) this.showDialogueText('镇子说：都准备好了，明晚办展。');
  }

  private artShowDeliverOre(): void {
    for (const id of ['stone', 'copper', 'iron'] as const) {
      if (getItemCount(id) > 0) {
        setItemCount(id, getItemCount(id) - 1);
        break;
      }
    }
    this.artShowEnvStage = Math.max(this.artShowEnvStage, 2);
    this.buildArtShowEnvObjects();
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    if (this.artShowReady()) this.showDialogueText('镇子说：都准备好了，明晚办展。');
  }

  private artShowDeliverFlower(): void {
    for (const id of ['small_flower', 'dandelion'] as const) {
      const n = Math.min(getItemCount(id), 2);
      if (n > 0) { setItemCount(id, getItemCount(id) - n); if (n >= 2) break; }
    }
    this.artShowEnvStage = Math.max(this.artShowEnvStage, 3);
    this.buildArtShowEnvObjects();
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    if (this.artShowReady()) this.showDialogueText('镇子说：都准备好了，明晚办展。');
  }

  /** 人际准备注入（showDialogue 调用）：镇长协调 / 老周旧照片 / 小梅花艺 */
  private buildArtShowDialogue(npc: NPC): DialogueLine[] | null {
    if (!this.artShowUnlocked || this.artShowPeopleDone()) return null;
    const map: Record<string, { evt: string; lines: DialogueLine[] }> = {
      elder: {
        evt: 'artshow_elder_coord',
        lines: [
          { speaker: '林澈', color: COLORS.linche, text: '镇长，展览的事……' },
          { speaker: '镇长', color: COLORS.elder, text: '广场那块地，本来就是要给大家用的。办吧。' },
          { speaker: '', color: COLORS.system, text: '（第二天，广场边上多了一张告示。）' },
        ],
      },
      carpenter: {
        evt: 'artshow_carpenter_photo',
        lines: [
          { speaker: '老周', color: '#c89860', text: '展览？我这儿有几张老照片。' },
          { speaker: '', color: COLORS.system, text: '（老周翻出一叠泛黄的照片——都是年轻时候的镇子。）' },
          { speaker: '老周', color: '#c89860', text: '……拿去摆吧。有人记得，就有人看。' },
        ],
      },
      gardener: {
        evt: 'artshow_gardener_flower',
        lines: [
          { speaker: '花匠小梅', color: COLORS.gardener, text: '花艺交给我吧。' },
          { speaker: '', color: COLORS.system, text: '（小梅在展台两侧比划了一下，定好了花的位置。）' },
        ],
      },
    };
    const entry = map[npc.id];
    if (!entry || hasTriggered(entry.evt)) return null;
    triggerOnce(entry.evt, () => { /* 仅标记 */ });
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    return entry.lines;
  }

  /** 广场夏雅交互（策划，一次性） */
  private tryArtShowXiyaInteract(): boolean {
    if (!this.artShowXiya || !this.artShowXiya.visible) return false;
    if (hasTriggered('artshow_xiya_plan')) return false;
    const dx = this.player.x - this.artShowXiya.x;
    const dy = this.player.y - this.artShowXiya.y;
    if (dx * dx + dy * dy > 34 * 34) return false;
    // 互动即隐藏靠近提示（对齐 tryArtShowTravelerInteract 范式：开对话前先隐藏）
    this.hideArtShowHint();
    triggerOnce('artshow_xiya_plan', () => {
      this.artShowXiya?.destroy();
      this.artShowXiya = null;

      this.playStory([
        { speaker: '夏雅', color: COLORS.xiya, text: '林澈，你觉得……把现在的青禾镇摆出来，大家会看吗？' },
        { speaker: '林澈', color: COLORS.linche, text: '会。' },
        { speaker: '夏雅', color: COLORS.xiya, text: '那我就去设计了。展区那边，交给我。' },
      ], () => this.updateHUD());
    });
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    return true;
  }

  /** 素材箱/广场夏雅靠近提示（update 调用） */
  private checkArtShowProximity(): void {
    if (this.mapKey !== 'town' || !this.artShowUnlocked) {
      this.hideArtShowHint();
      return;
    }
    // 庆典已办：筹备期素材箱/夏雅提示失效，artShowHint 由 checkArtShowAfterXiyaProximity 接管。
    // 2026-08-16 修复：此处原为 `return` 不隐藏，若提示节点已显示则会残留卡屏——改为显式隐藏。
    if (this.artShowHeld) { this.hideArtShowHint(); return; }
    if (this.storyDialogue?.isOpen() || this.townPlanPanel) {
      this.hideArtShowHint();
      return;
    }
    let near = false;
    if (this.artShowBox) {
      const dx = this.player.x - MapScene.ARTSHOW.box.x;
      const dy = this.player.y - MapScene.ARTSHOW.box.y;
      near = near || dx * dx + dy * dy < 34 * 34;
    }
    if (this.artShowXiya) {
      const dx = this.player.x - this.artShowXiya.x;
      const dy = this.player.y - this.artShowXiya.y;
      near = near || dx * dx + dy * dy < 34 * 34;
    }
    if (near) this.showArtShowHint(); else this.hideArtShowHint();
  }

  private showArtShowHint(): void {
    if (this.artShowHint) return;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '180px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffe9b0', fontSize: '13px',
      background: 'rgba(0,0,0,0.65)', padding: '6px 16px', borderRadius: '6px',
      zIndex: '400', pointerEvents: 'none',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    hint.textContent = isMobileLayout() ? '点击「交互」查看' : '按 [E] 查看';
    hint.classList.add('hint-interact'); // 2026-08-16 兜底清扫标记（hideAllInteractHints 强制移除残留）
    document.body.appendChild(hint);
    this.artShowHint = hint;
  }

  private hideArtShowHint(): void {
    if (this.artShowHint) {
      this.artShowHint.remove();
      this.artShowHint = null;
    }
  }

  /** 活动触发检测（update 调用）：三类准备完成 + 傍晚进广场 → 办展（一次性） */
  private checkArtShowAuto(): void {
    if (this.mapKey !== 'town' || !this.artShowReady()) return;
    if (this.inArtShowCutscene || this.storyDialogue?.isOpen()) return;
    const h = getTime().hour;
    if (h < 17 || h >= 22) return;
    const dx = this.player.x - MapScene.ARTSHOW.plaza.x;
    const dy = this.player.y - MapScene.ARTSHOW.plaza.y;
    if (dx * dx + dy * dy > 200 * 200) return;
    this.startArtShow();
  }

  private startArtShow(): void {
    // BUG-FIX（P0-3）：runner 占用时 playStory 会被静默吞掉——而本函数是"标记/存档先行"模式
    // （artshow_held triggerOnce + save），一旦吞段 = 三段演出永久丢失且永不重放。
    // 窗口期直接不触发，玩家仍站在广场时 update 下一帧会重查重试。
    if (this.storySequenceRunner?.isPlaying?.()) return;
    if (!this.artShowReady() || this.artShowHeld || this.inArtShowCutscene) return;
    this.inArtShowCutscene = true;
    this.artShowHeld = true;
    const ok = triggerOnce('artshow_held', () => this.runArtShow());
    if (!ok) {
      this.inArtShowCutscene = false;
      this.artShowHeld = false;
      return;
    }
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
  }

  /** 当天演出（三段对白链 + 居民入场/星空装置/夜晚/C 艺术家/永久变化） */
  private runArtShow(): void {

    const C = COLORS.system;
    const narrator = (text: string): DialogueLine => ({ speaker: '', color: C, text });
    this.clearArtShowSprites();
    // 第一段：下午入场，居民各带一点东西
    this.playStory([
      narrator('（傍晚。你走进广场，发现平时空着的位置全都变了。）'),
      narrator('（展台立着，灯光挂着，花艺摆好了——筹备期的活儿，一样都没落下。）'),
      narrator('（老人抱着旧照片慢慢走过来，孩子举着画跑在前面。）'),
      { speaker: '夏雅', color: COLORS.xiya, text: '来了？就等你了。' },
    ], () => {
      this.spawnArtShowResidents();

      // 第二段：展示（看画/听故事/星空装置）
      this.playStory([
        narrator('（展台上摆着老周翻出来的旧照片——井边排队打水，树下一排人乘凉。）'),
        { speaker: '老周', color: '#c89860', text: '这张是建井那年拍的。那时候镇上人多。' },
        narrator('（孩子的画挂在一边，歪歪扭扭的，颜色很亮。）'),
        narrator('（展台中央，一个玻璃瓶里装着小小的星光灯——旅人把它留在了这里。）'),
        { speaker: '旅人', color: '#c8a8e8', text: '我听说这里晚上有星星。来了以后发现，镇子自己就会发光。' },
      ], () => {
        // 第三段：夜晚灯光 + C 开幕 + 永久变化
        this.artShowNightFinale();
      });
    });
  }

  /** 夜晚收尾：时间推进 + 灯光 + 灯塔回应 + C 艺术家 + 永久变化 */
  private artShowNightFinale(): void {
    const t = getTime();
    if (t.hour < 20) setTimeFull(t.day, 20, 0);
    this.updateTownDuskOverlay();
    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    // 艺术角夜晚灯光（展台挂灯 + 暖光）
    const c = MapScene.ARTSHOW.corner;
    const glow = this.add.ellipse(c.x + 8, c.y - 14, 60, 40, 0xffc878, 0.22).setDepth(4);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: { from: 0.12, to: 0.28 }, duration: 1600, yoyo: true, repeat: -1 });
    this.artShowSprites.push(glow);

    this.playStory([
      narrator('（夜色落下来。广场的灯一盏盏亮起来，河面上有了倒影。）'),
      narrator('（远处的灯塔方向，海面上好像亮了一下。）'),
      { speaker: '旅人', color: '#c8a8e8', text: '这幅画留给你们——以后每年这时候，我再回来看看它。' },
      { speaker: '夏雅', color: COLORS.xiya, text: '明年来的人，就能看到今天这些了。' },
    ], () => {
      // 永久变化落地
      this.artShowPerm = true;
      this.buildArtShowPermanent();
      this.clearArtShowSprites();
      this.inArtShowCutscene = false;
      this.updateHUD();
      this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
      setTimeout(() => showMemoryMoment('星光艺术展办完的那天晚上，青禾镇多了一个会被记住的角落。'), 1600);
    });
  }

  /** 居民入场精灵（复用现有 npc 贴图；演出结束销毁） */
  private spawnArtShowResidents(): void {
    const spots: Array<[string, number, number, string]> = [
      ['npc_elder', 368, 268, '老人'],
      ['npc_girl', 408, 276, '孩子'],
      ['npc_gardener', 432, 312, '小梅'],
      ['npc_xiya', 456, 300, '夏雅'],
      ['npc_carpenter', 344, 304, '老周'],
      ['npc_miner', 392, 328, '老张'],
    ];
    for (const [tex, x, y, name] of spots) {
      const s = this.add.sprite(x, y, tex);
      s.setScale(0.5).setDepth(5);
      const label = this.add.text(x, y - 22, name, {
        fontSize: '11px', color: '#e0d8c8', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(6);
      this.artShowSprites.push(s);
      this.artShowSprites.push(label);
    }
  }

  private clearArtShowSprites(): void {
    for (const s of this.artShowSprites) s.destroy();
    this.artShowSprites = [];
  }

  // ═══════════════════════════════════════════════════════════════
  // 小镇计划·秋日晒场（EventPlan 第二实例）
  // 依据：docs/design/秋日晒场-垂直切片设计稿-v1.0.md（v1.1 定稿）
  //      + docs/design/秋日晒场-剧情文本草稿-2026-08-16.md（台词定稿 v0.3，2026-08-19 拍板）
  //      + docs/tasks/任务-秋日晒场-EventPlan第二实例-v1.0.md（施工任务卡）
  // 核心立意：不是庆祝丰收，而是证明这里还有人在生活。
  // 范式：完全对齐星光艺术展（第一实例）——mapFlags 状态 + triggerOnce 一次性 + 零素材 Graphics。
  // ═══════════════════════════════════════════════════════════════

  /** 触发门禁：春日集完成 + 首次收获玉米（设计定稿 §四：玉米首收即解锁，前置链） */
  private dryyardAvailable(): boolean {
    return isChapterAtLeast(CHAPTER_1) && hasTriggered('ch1_spring_fair') && hasTriggered('crop_corn_first_harvest');
  }

  /** 人际三时代完成判定（老张·过去 / 夏雅·现在 / 阿风·未来） */
  private dryyardPeopleDone(): boolean {
    return hasTriggered('dryyard_laozhang_craft')
      && hasTriggered('dryyard_xiya_photo')
      && hasTriggered('dryyard_afeng_help');
  }

  /** 三类准备齐备（环境 + 人际 + 资源） */
  private dryyardReady(): boolean {
    return this.dryyardUnlocked && this.dryyardEnvStage >= 3
      && this.dryyardPeopleDone() && this.dryyardMaterialsDone && !this.dryyardHeld;
  }

  /** create 挂载（town）：按存档状态重建晒场环境物件/征集筐/筹备夏雅/永久变化 */
  private setupDryyard(): void {
    if (this.mapKey !== 'town' || !this.dryyardUnlocked) return;
    this.dryyardEnvBuilt = 0;
    this.buildDryyardEnvObjects();
    this.buildDryyardBox();
    this.spawnDryyardXiya();
    if (this.dryyardPerm) {
      this.buildDryyardPermanent();
      this.setupDryyardLaozhang();
    }
  }

  /** 环境物件（按 envStage 增量构建：晒架→竹席晒篮→玉米串辣椒串；镇东头空地） */
  private buildDryyardEnvObjects(): void {
    if (this.mapKey !== 'town') return;
    const y = MapScene.DRYYARD.yard;
    // Stage 1 · 晒架（木架）：两排立柱 + 横杆（老张拍过灰的那副旧架子）
    if (this.dryyardEnvStage >= 1 && this.dryyardEnvBuilt < 1) {
      this.dryyardEnvBuilt = 1;
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x2e2e34, 0.25); g.fillEllipse(y.x, y.y + 8, 76, 9);          // 地面投影
      for (const ox of [-20, 0, 20]) {
        g.fillStyle(0x6e4a24, 1); g.fillRect(y.x + ox - 1, y.y - 16, 3, 24);      // 立柱
      }
      g.fillStyle(0x8a6a45, 1); g.fillRect(y.x - 24, y.y - 18, 48, 3);           // 横杆
      g.fillStyle(0x5b4226, 1); g.fillRect(y.x - 24, y.y - 16, 48, 1);            // 杆缝
      // 挂钩（后阶段挂玉米串用）
      g.fillStyle(0x4c3618, 1);
      for (const hx of [-14, -4, 6, 16]) g.fillRect(y.x + hx, y.y - 15, 1, 3);
    }
    // Stage 2 · 竹席 + 晒篮（摊在地上晒）
    if (this.dryyardEnvStage >= 2 && this.dryyardEnvBuilt < 2) {
      this.dryyardEnvBuilt = 2;
      const g = this.add.graphics().setDepth(3);
      // 竹席（浅黄编织纹，两块）
      for (const [mx, my] of [[-30, 12], [14, 16]] as const) {
        g.fillStyle(0xd8c89a, 0.95); g.fillRect(y.x + mx, y.y + my, 26, 14);
        g.lineStyle(1, 0xb8a878, 0.8);
        for (let i = 1; i < 4; i++) g.lineBetween(y.x + mx + i * 6.5, y.y + my, y.x + mx + i * 6.5, y.y + my + 14);
        g.lineBetween(y.x + mx, y.y + my + 7, y.x + mx + 26, y.y + my + 7);
        g.lineStyle(1, 0xa89868, 0.9); g.strokeRect(y.x + mx, y.y + my, 26, 14);
      }
      // 晒篮（圆浅口篮 ×2）
      for (const [bx, by] of [[-14, 4], [22, 2]] as const) {
        g.fillStyle(0x9a7a52, 1); g.fillEllipse(y.x + bx, y.y + by, 14, 6);
        g.fillStyle(0xb89868, 1); g.fillEllipse(y.x + bx, y.y + by - 1, 14, 5);
        g.lineStyle(1, 0x7a5a33, 1); g.strokeEllipse(y.x + bx, y.y + by, 14, 6);
      }
    }
    // Stage 3 · 玉米串 + 辣椒串 + 鱼干架（镇上东西陆续挂上来）
    if (this.dryyardEnvStage >= 3 && this.dryyardEnvBuilt < 3) {
      this.dryyardEnvBuilt = 3;
      const g = this.add.graphics().setDepth(3);
      // 玉米串（横杆上挂 3 串：绳 + 金黄玉米粒）
      for (const hx of [-14, -4, 6]) {
        g.lineStyle(1, 0xd8c89a, 0.9); g.lineBetween(y.x + hx, y.y - 15, y.x + hx, y.y - 6);
        g.fillStyle(0xe8b040, 1);
        for (let i = 0; i < 3; i++) g.fillRect(y.x + hx - 2, y.y - 13 + i * 3, 4, 2);
      }
      // 辣椒串（右侧挂 2 串红）
      for (const hx of [16, 20]) {
        g.lineStyle(1, 0xd8c89a, 0.9); g.lineBetween(y.x + hx, y.y - 15, y.x + hx, y.y - 8);
        g.fillStyle(0xc03828, 1);
        for (let i = 0; i < 2; i++) g.fillRect(y.x + hx - 1, y.y - 13 + i * 3, 2, 2);
      }
      // 海边鱼干架（晒场南端独立小架：两柱一杆，挂咸鱼）
      const fx = y.x + 30, fy = y.y + 20;
      g.fillStyle(0x6e4a24, 1); g.fillRect(fx - 1, fy - 10, 2, 12); g.fillRect(fx + 13, fy - 10, 2, 12);
      g.fillStyle(0x8a6a45, 1); g.fillRect(fx - 3, fy - 12, 20, 2);
      for (const dx of [1, 6, 11]) {
        g.fillStyle(0xa89878, 1); g.fillRect(fx + dx, fy - 10, 3, 6);   // 咸鱼（银灰）
        g.fillStyle(0x88846a, 1); g.fillRect(fx + dx, fy - 4, 3, 1);   // 鱼尾
      }
    }
  }

  /** 征集筐（「今年的收成」交付点） */
  private buildDryyardBox(): void {
    const b = MapScene.DRYYARD.box;
    const c = this.add.container(b.x, b.y).setDepth(3);
    const g = this.add.graphics();
    g.fillStyle(0x9a7a52, 1); g.fillEllipse(0, 0, 16, 9);            // 筐口
    g.fillStyle(0xb89868, 1); g.fillEllipse(0, -1, 16, 8);
    g.lineStyle(1, 0x7a5a33, 1); g.strokeEllipse(0, -1, 16, 8);
    g.fillStyle(0x8a6a45, 1); g.fillRect(-7, 0, 14, 5);               // 筐身
    g.lineStyle(1, 0x6a4a28, 0.9); g.lineBetween(-6, 2, 6, 2);
    c.add(g);
    this.add.text(b.x, b.y - 14, '收成筐', {
      fontSize: '10px', color: '#e8d8a8', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(4);
    this.dryyardBox = c;
  }

  /** 筹备期晒场夏雅（白天出现，抱旧照片；照片对白未触发时） */
  private spawnDryyardXiya(): void {
    if (this.mapKey !== 'town') return;
    if (hasTriggered('dryyard_xiya_photo')) return;
    const t = getTime();
    if (t.hour < 8 || t.hour >= 18) return;
    const p = MapScene.DRYYARD.xiya;
    this.dryyardXiya = this.add.sprite(p.x, p.y, 'npc_xiya');
    this.dryyardXiya.setScale(0.5).setDepth(5);
    this.dryyardXiyaLabel = this.add.text(p.x, p.y - 24, '夏雅', {
      fontSize: '12px', color: '#f0a050', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6);
  }

  /**
   * 开场演出软触发（create 后 1.6s）：
   * 玉米首收 + 春日集后 → 傍晚（17-22 时）进 town → 镇民讨论 → 老张提起晒场（triggerOnce 一次性）。
   * 与其他自动演出互斥（春日集/观星夜/艺术展当天，对齐 trySpringFairSequence 范式）。
   */
  private tryDryyardIntro(): void {
    if (this.mapKey !== 'town') return;
    if (this.inStargazeCutscene || this.inSpringFairCutscene || this.inArtShowCutscene || this.inDryyardCutscene) return;
    if (this.firstMorningActive) return;
    if (!this.dryyardAvailable()) return;
    if (hasTriggered('dryyard_intro')) return;
    const t = getTime();
    if (t.hour < 17 || t.hour >= 22) return; // 傍晚（「收成的时候」+ 收工后的闲时）
    this.startDryyardIntro();
  }

  /** 开场演出：镇民讨论 → 老张提起晒场（台词定稿 v0.3【触发】段） */
  private startDryyardIntro(): void {
    // BUG-FIX：runner 被其他对白（如随机日常 daily_event）占用时，playSequence 会静默丢弃本段
    // （返回 false 但 triggerOnce 按「先执行后标记」契约已入库）→ intro 永不落地 + cutscene 卡死。
    // 延后有界重试：tryDryyardIntro 的 22 点窗口关闸保证不会无限循环。
    if (this.storySequenceRunner?.isPlaying()) {
      this.time.delayedCall(1200, () => this.tryDryyardIntro());
      return;
    }
    this.inDryyardCutscene = true;
    const ok = triggerOnce('dryyard_intro', () => {

      const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
      this.playStory([
        narrator('（傍晚。林澈把今年的玉米从地里收回来。镇上有人在议论。）'),
        { speaker: '镇民甲', color: '#b8b8a8', text: '最近这批玉米，长得真不错。' },
        { speaker: '镇民乙', color: '#a8b8b0', text: '今年雨水好，地也养回来了。' },
        narrator('（老张走过来，看了一眼晒在墙角的玉米，没说话。过了一会儿，他开口了。）'),
        { speaker: '老张', color: COLORS.miner, text: '以前每到这个时候，镇里都会把这一年的东西，拿到晒场上去晒一晒。' },
        { speaker: '林澈', color: COLORS.linche, text: '晒场？' },
        { speaker: '老张', color: COLORS.miner, text: '嗯。镇子东头那块空地。晒粮食、晒鱼、晒菜干。那时候家家户户都往那儿搬。' },
        narrator('（老张拍了拍旁边的木架子，灰尘扬起来。）'),
        { speaker: '老张', color: COLORS.miner, text: '木架还没烂透。搭起来，应该还能晒一季。' },
      ], () => {
        // EventPlan 解锁：环境物件（旧晒架雏形）/征集筐/晒场夏雅即时挂载（幂等）
        this.dryyardUnlocked = true;
        this.buildDryyardEnvObjects();
        if (!this.dryyardBox) this.buildDryyardBox();
        this.spawnDryyardXiya();
        this.inDryyardCutscene = false;
        this.updateHUD();
        showMemoryMoment('老张说：木架还没烂透。');
      });
    });
    // ★ triggerOnce 已返回（先执行 fn 后标记）→ 存档（EventSystem.md 时序纪律）
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    if (!ok) {
      this.inDryyardCutscene = false;
    }
  }

  /** 人际三时代注入（showDialogue 调用）：老张·过去（旧手艺）/ 阿风·未来（搭把手，不站队商业）；夏雅走独立交互点 */
  private buildDryyardDialogue(npc: NPC): DialogueLine[] | null {
    if (!this.dryyardUnlocked || this.dryyardPeopleDone()) return null;
    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    if (npc.id === 'miner' && !hasTriggered('dryyard_laozhang_craft')) {
      triggerOnce('dryyard_laozhang_craft', () => { /* 仅标记 */ });
      save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
      return [
        narrator('（晒场清理那天，老张来得最早。）'),
        { speaker: '老张', color: COLORS.miner, text: '这活儿我熟。以前晒场就是我们家管的。鱼要怎么挂、菜要怎么摊，我心里有数。' },
      ];
    }
    if (npc.id === 'adventurer' && !hasTriggered('dryyard_afeng_help')) {
      triggerOnce('dryyard_afeng_help', () => { /* 仅标记 */ });
      save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
      return [
        narrator('（阿风扛着一筐玉米过来，放在晒架下。）'),
        { speaker: '阿风', color: '#8ab8d8', text: '我小时候没见过这阵仗。不过看着挺踏实的。' },
        { speaker: '林澈', color: COLORS.linche, text: '你也来帮忙？' },
        { speaker: '阿风', color: '#8ab8d8', text: '那当然。这么好的日子，不搭把手说不过去。要是以后有人路过瞧见，说不定也会喜欢。' },
        { speaker: '老张', color: COLORS.miner, text: '（头也不抬）喜欢不喜欢另说。先把今年的东西晒好，别糟蹋了。' },
      ];
    }
    return null;
  }

  /** 晒场夏雅交互（旧照片，一次性；台词定稿 v0.3【筹备·人际】段） */
  private tryDryyardXiyaInteract(): boolean {
    if (this.mapKey !== 'town') return false;
    if (!this.dryyardXiya || !this.dryyardXiya.visible) return false;
    if (hasTriggered('dryyard_xiya_photo')) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const dx = this.player.x - this.dryyardXiya.x;
    const dy = this.player.y - this.dryyardXiya.y;
    if (dx * dx + dy * dy > 34 * 34) return false;
    // 互动即隐藏靠近提示（对齐 tryArtShowXiyaInteract 范式：开对话前先隐藏）
    this.hideDryyardHint();
    this.inputManager.clearAction();
    triggerOnce('dryyard_xiya_photo', () => {
      this.dryyardXiya?.destroy();
      this.dryyardXiya = null;
      this.dryyardXiyaLabel?.destroy();
      this.dryyardXiyaLabel = null;

      const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
      this.playStory([
        narrator('（夏雅抱着一叠旧照片来了。）'),
        { speaker: '夏雅', color: COLORS.xiya, text: '我在柜子底下翻到这些。你看——这是以前的晒场，边上站了一排人。' },
        { speaker: '林澈', color: COLORS.linche, text: '那时候真热闹。' },
        { speaker: '夏雅', color: COLORS.xiya, text: '嗯。小时候我还在里面跑过，大人老喊我别踩到晒好的东西。' },
        narrator('（夏雅把照片放在晒架边上。）'),
        { speaker: '夏雅', color: COLORS.xiya, text: '我还以为这些照片也该不知道丢哪去了。' },
        { speaker: '夏雅', color: COLORS.xiya, text: '结果翻箱子的时候，它们还夹在里面。' },
        { speaker: '夏雅', color: COLORS.xiya, text: '……还能摆回这里。' },
      ], () => this.updateHUD());
    });
    // ★ triggerOnce 已返回 → 存档（EventSystem.md 时序纪律）
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    return true;
  }

  /** 征集筐/晒场夏雅/永久期老张靠近提示（update 调用） */
  private checkDryyardProximity(): void {
    if (this.mapKey !== 'town' || !this.dryyardUnlocked) {
      this.hideDryyardHint();
      return;
    }
    // 当天已办：筹备期提示失效，仅保留永久期老张提示
    if (this.storyDialogue?.isOpen() || this.townPlanPanel) {
      this.hideDryyardHint();
      return;
    }
    let near = false;
    if (!this.dryyardHeld && this.dryyardBox) {
      const dx = this.player.x - MapScene.DRYYARD.box.x;
      const dy = this.player.y - MapScene.DRYYARD.box.y;
      near = near || dx * dx + dy * dy < 34 * 34;
    }
    if (!this.dryyardHeld && this.dryyardXiya) {
      const dx = this.player.x - this.dryyardXiya.x;
      const dy = this.player.y - this.dryyardXiya.y;
      near = near || dx * dx + dy * dy < 34 * 34;
    }
    if (this.dryyardPerm && this.dryyardLaozhang) {
      const dx = this.player.x - MapScene.DRYYARD.laozhang.x;
      const dy = this.player.y - MapScene.DRYYARD.laozhang.y;
      near = near || dx * dx + dy * dy < 34 * 34;
    }
    if (near) this.showDryyardHint(); else this.hideDryyardHint();
  }

  private showDryyardHint(): void {
    if (this.dryyardHint) return;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '180px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffe9b0', fontSize: '13px',
      background: 'rgba(0,0,0,0.65)', padding: '6px 16px', borderRadius: '6px',
      zIndex: '400', pointerEvents: 'none',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    hint.textContent = isMobileLayout() ? '点击「交互」查看' : '按 [E] 查看';
    hint.classList.add('hint-interact'); // 兜底清扫标记（hideAllInteractHints 强制移除残留）
    document.body.appendChild(hint);
    this.dryyardHint = hint;
  }

  private hideDryyardHint(): void {
    if (this.dryyardHint) {
      this.dryyardHint.remove();
      this.dryyardHint = null;
    }
  }

  /** 当天演出触发检测（update 调用）：三类准备完成 + 傍晚靠近晒场 → 办晒场（一次性） */
  private checkDryyardAuto(): void {
    if (this.mapKey !== 'town' || !this.dryyardReady()) return;
    if (this.inDryyardCutscene || this.storyDialogue?.isOpen()) return;
    const h = getTime().hour;
    if (h < 17 || h >= 22) return;
    const dx = this.player.x - MapScene.DRYYARD.yard.x;
    const dy = this.player.y - MapScene.DRYYARD.yard.y;
    if (dx * dx + dy * dy > 190 * 190) return;
    this.startDryyard();
  }

  private startDryyard(): void {
    if (!this.dryyardReady() || this.dryyardHeld || this.inDryyardCutscene) return;
    this.inDryyardCutscene = true;
    this.dryyardHeld = true;
    const ok = triggerOnce('dryyard_held', () => this.runDryyard());
    if (!ok) {
      this.inDryyardCutscene = false;
      this.dryyardHeld = false;
      return;
    }
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
  }

  /** 当天演出（对白链三段：傍晚晒场 → 夜晚长桌 → 灯塔回应；台词定稿 v0.3【当天】段） */
  private runDryyard(): void {

    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    this.clearDryyardSprites();
    // 第一段：傍晚晒场（晒架搭好，众人各忙各的，孩子跑过）
    this.playStory([
      narrator('（晒场搭好了。木架上挂着一串串辣椒，竹席上摊着玉米和萝卜干，鱼干架边晾着几条咸鱼。）'),
      narrator('（老张在理晒架，夏雅把旧照片一张张摆在长凳上，阿风来回搬东西。）'),
      narrator('（一个小孩跑过晒场，差点踩到竹席上的玉米。）'),
      { speaker: '小孩他娘', color: '#d8a8b8', text: '慢点！别踩到晒好的东西！' },
      { speaker: '小孩', color: '#c8d8f0', text: '知道啦——' },
      narrator('（远处传来几声笑。晒场边上，有人搬来板凳，有人提着菜篮子。）'),
    ], () => {
      this.spawnDryyardResidents();
      if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
      // 第二段：夜晚海边长桌（无篝火——"很久没有这样坐下来吃一顿饭了"）
      this.dryyardNightFinale();
    });
  }

  /** 夜晚长桌 + 灯塔回应 + 永久变化落地（克制：无烟花，高潮=人回来了+灯塔亮一下） */
  private dryyardNightFinale(): void {
    const t = getTime();
    if (t.hour < 20) setTimeFull(t.day, 20, 0);
    this.updateTownDuskOverlay();
    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    // 长桌暖光（灯笼一盏一盏挂起来——对齐艺术展夜晚收尾的暖光范式）
    const y = MapScene.DRYYARD.yard;
    const glow = this.add.ellipse(y.x, y.y - 6, 110, 60, 0xffc878, 0.22).setDepth(4);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: { from: 0.12, to: 0.28 }, duration: 1600, yoyo: true, repeat: -1 });
    this.dryyardSprites.push(glow);
    // 长桌（零素材 Graphics：长板桌 + 碗筷热气）
    const table = this.add.graphics().setDepth(4);
    table.fillStyle(0x2e2e34, 0.25); table.fillEllipse(y.x, y.y + 26, 90, 10);
    table.fillStyle(0x8a6a45, 1); table.fillRect(y.x - 42, y.y + 20, 84, 5);
    table.fillStyle(0x6e4a24, 1); table.fillRect(y.x - 40, y.y + 25, 3, 8); table.fillRect(y.x + 37, y.y + 25, 3, 8);
    for (const dx of [-30, -10, 12, 30]) table.fillStyle(0xd8d0c0, 1), table.fillEllipse(y.x + dx, y.y + 19, 6, 3);
    this.dryyardSprites.push(table);
    // 灯笼（两盏，暖黄呼吸）
    for (const lx of [y.x - 48, y.x + 48]) {
      const lamp = this.add.graphics().setDepth(4);
      lamp.fillStyle(0xd86028, 1); lamp.fillEllipse(lx, y.y - 8, 6, 8);
      lamp.fillStyle(0xffd98a, 0.95); lamp.fillEllipse(lx, y.y - 8, 3, 4);
      this.tweens.add({ targets: lamp, alpha: 0.55, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.dryyardSprites.push(lamp);
    }

    this.playStory([
      narrator('（天暗下来。灯笼一盏一盏挂起来。海风从桌边吹过去，桌上的菜还冒着热气。）'),
      narrator('（大家围着长桌坐下来。夹菜声。碗碰碗。）'),
      { speaker: '老人', color: '#c8b898', text: '（夹了一筷子菜）以前镇里人多的时候，每年都这么坐一桌。' },
      narrator('（有人给旁边人添了碗汤。）'),
      { speaker: '另一老人', color: '#b8c8a8', text: '好多年没坐过这么多人了。' },
      narrator('（小孩从桌子底下钻过去，被绊了一下。有人笑。有人喊：慢点吃。）'),
      narrator('（阿风把一盘菜推到老张面前。老张看了一眼，没说话，夹了一筷子。）'),
    ], () => {

      // 第三段：高潮——灯塔亮了一下（极克制：不解释，林澈看过去，没有说话）
      this.playStory([
        narrator('（远处，灯塔忽然亮了一下。不是庆典的光，就是亮了一下。）'),
        narrator('（林澈看过去。）'),
        narrator('（没有说话。）'),
      ], () => {
        // 永久变化落地：青禾晒场
        this.dryyardPerm = true;
        this.buildDryyardPermanent();
        this.setupDryyardLaozhang();
        this.clearDryyardSprites();
        this.inDryyardCutscene = false;
        this.updateHUD();
        this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
        // 完成瞬间：世界反馈句 → UI（设计定稿 §三：先「多年以后…」，再「青禾晒场已恢复。」）
        showMemoryMoment('多年以后，青禾镇又晒起了今年的收成。');
        setTimeout(() => showMemoryMoment('青禾晒场已恢复。'), 1800);
      });
    });
  }

  /** 当天居民入场精灵（傍晚晒场段；演出结束销毁） */
  private spawnDryyardResidents(): void {
    const y = MapScene.DRYYARD.yard;
    const spots: Array<[string, number, number, string]> = [
      ['npc_miner', y.x - 8, y.y - 4, '老张'],
      ['npc_xiya', y.x + 14, y.y - 10, '夏雅'],
      ['npc_adventurer', y.x + 26, y.y + 6, '阿风'],
      ['npc_girl', y.x - 22, y.y + 10, '孩子'],
      ['npc_elder', y.x + 6, y.y + 14, '老人'],
      ['npc_carpenter', y.x - 34, y.y + 16, '老周'],
    ];
    for (const [tex, x, yy, name] of spots) {
      const s = this.add.sprite(x, yy, tex);
      s.setScale(0.5).setDepth(5);
      const label = this.add.text(x, yy - 22, name, {
        fontSize: '11px', color: '#e0d8c8', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(6);
      this.dryyardSprites.push(s);
      this.dryyardSprites.push(label);
    }
  }

  /** 永久变化：青禾晒场（晒架含收成串/鱼干架/竹席晒篮/木牌——读档保持） */
  private buildDryyardPermanent(): void {
    if (this.mapKey !== 'town') return;
    // 环境物件（含三阶段全部内容；幂等由 dryyardEnvBuilt 保证——永久期强制满进度重建）
    this.dryyardEnvStage = Math.max(this.dryyardEnvStage, 3);
    this.dryyardEnvBuilt = 0;
    this.buildDryyardEnvObjects();
    const s = MapScene.DRYYARD.sign;
    // 「青禾晒场」木牌
    const sign = this.add.graphics().setDepth(3);
    sign.fillStyle(0x6e4a24, 1); sign.fillRect(s.x - 1, s.y - 12, 2, 14);
    sign.fillStyle(0x8a6a45, 1); sign.fillRect(s.x - 9, s.y - 16, 18, 7);
    sign.fillStyle(0xffe9b0, 0.9); sign.fillRect(s.x - 7, s.y - 14, 14, 3);
    this.add.text(s.x, s.y - 20, '青禾晒场', {
      fontSize: '9px', color: '#ffe9b0', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(4);
  }

  /** 永久期晒场老张（白天停留照看晒架；傍晚回家后不在，对齐 NPC 作息直觉） */
  private setupDryyardLaozhang(): void {
    if (this.mapKey !== 'town') return;
    if (!this.dryyardPerm) return;
    if (this.dryyardLaozhang) return; // 幂等
    const h = getTime().hour;
    if (h < 8 || h >= 18) return;      // 晒场照看时段：白天
    const p = MapScene.DRYYARD.laozhang;
    this.dryyardLaozhang = this.add.sprite(p.x, p.y, 'npc_miner');
    this.dryyardLaozhang.setScale(0.5).setDepth(5);
    this.dryyardLaozhangLabel = this.add.text(p.x, p.y - 24, '老张', {
      fontSize: '11px', color: '#d8a050', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6);
  }

  /** 永久期老张交互：收成时令台词（首次一句 + 日常句；「第二次路过晒场不一样」的载体之一） */
  private tryDryyardLaozhangInteract(): boolean {
    if (this.mapKey !== 'town') return false;
    if (!this.dryyardPerm) return false;
    if (!this.dryyardLaozhang || !this.dryyardLaozhang.visible) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const dx = this.player.x - MapScene.DRYYARD.laozhang.x;
    const dy = this.player.y - MapScene.DRYYARD.laozhang.y;
    if (dx * dx + dy * dy >= 42 * 42) return false;
    this.hideDryyardHint();
    this.inputManager.clearAction();
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    const once = triggerOnce('dryyard_laozhang_first', () => { /* 仅标记 */ });
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    const lines: DialogueLine[] = once ? [
      narrator('（老张站在晒架边上，翻动着竹席上的萝卜干。）'),
      { speaker: '老张', color: COLORS.miner, text: '……晒场又像样了。有些东西，放一放，不会坏。' },
    ] : [
      narrator('（老张照看着晒场，不时翻一翻晒着的东西。）'),
      { speaker: '老张', color: COLORS.miner, text: '晒个三五天，收进屋里，今年的日子就算全落定了。' },
    ];
    this.playStory(lines, () => this.updateHUD(), undefined, "")
    return true;
  }

  private clearDryyardSprites(): void {
    for (const s of this.dryyardSprites) s.destroy();
    this.dryyardSprites = [];
  }

  /** 场景切换清理（视觉 + label + DOM hint；状态已由 mapFlags/triggerOnce 持久化） */
  private cleanupDryyard(): void {
    this.dryyardBox?.destroy();
    this.dryyardBox = null;
    this.dryyardXiya?.destroy();
    this.dryyardXiya = null;
    this.dryyardXiyaLabel?.destroy();
    this.dryyardXiyaLabel = null;
    this.dryyardLaozhang?.destroy();
    this.dryyardLaozhang = null;
    this.dryyardLaozhangLabel?.destroy();
    this.dryyardLaozhangLabel = null;
    this.clearDryyardSprites();
    this.hideDryyardHint();
    this.dryyardEnvBuilt = 0; // 会话级幂等标记复位（下个 town 实例重建）
  }

  // ═══════════════════════════════════════════════════════════════
  // 种植升级 v2：收获去向（切片 A，2026-08-15 制作人拍板）
  // 依据：《种植系统生活化方向-v0.1.md》第六层
  // 三条去向 = 三个维度（出售=经济 / 赠予居民=关系与生活 / 活动使用=小镇变化），不做数值对比。
  // 触发 = 玩家种→收→路过→NPC 发现（不是任务："给他一些"是生活里的顺手，不是委托）。
  // ═══════════════════════════════════════════════════════════════

  /**
   * 作物赠予注入（showDialogue 调用）：
   * ① 萝卜×老张：赠予 → 第二天河边腌萝卜罐（世界留下痕迹）→ 之后一句晒萝卜干
   * ② 玉米×小镇：首次收获玉米后，镇长/老张一句"今年玉米长得不错"（丰收节铺垫，一次性）
   */
  private buildCropGiftDialogue(npc: NPC): { lines: DialogueLine[]; onChoice: (i: number) => void } | null {
    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    const persist = (): void => {
      save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    };
    // ① 萝卜×老张：已赠过 → 补一句晒萝卜干（一次性）
    if (npc.id === 'miner' && hasTriggered('crop_radish_laozhang') && !hasTriggered('crop_radish_dryline')) {
      triggerOnce('crop_radish_dryline', () => { /* 仅标记 */ });
      persist();
      return {
        lines: [{ speaker: '老张', color: COLORS.miner, text: '天气好的时候，晒一点萝卜干，味道比买来的好多了。' }],
        onChoice: () => { /* 无选项 */ },
      };
    }
    // ① 萝卜×老张：背包有萝卜且未赠过 → 赠予入口
    if (npc.id === 'miner' && !hasTriggered('crop_radish_laozhang') && getItemCount('radish') > 0) {
      return {
        lines: [
          narrator('（老张看见你手里的萝卜。）'),
          { speaker: '老张', color: COLORS.miner, text: '萝卜啊……好久没吃到自己地里长出来的了。' },
          { speaker: '', color: COLORS.system, text: '', options: ['给他一些', '算了'] },
        ],
        onChoice: (i: number) => {
          if (i === 0) this.doCropGiftRadish();
        },
      };
    }
    // ② 玉米×小镇：首次收获后，居民一句（丰收节铺垫，一次性）
    if (hasTriggered('crop_corn_first_harvest') && !hasTriggered('crop_corn_comment') && (npc.id === 'elder' || npc.id === 'miner')) {
      triggerOnce('crop_corn_comment', () => { /* 仅标记 */ });
      persist();
      const speaker = npc.id === 'elder' ? '镇长' : '老张';
      const color = npc.id === 'elder' ? COLORS.elder : COLORS.miner;
      return {
        lines: [{ speaker, color, text: '今年玉米长得不错。' }],
        onChoice: () => { /* 无选项 */ },
      };
    }
    return null;
  }

  /** 执行赠予：扣萝卜 + 一次性标记（EventSystem 契约：fn 先执行 → save 在其后） */
  private doCropGiftRadish(): void {
    if (hasTriggered('crop_radish_laozhang')) return;
    if (getItemCount('radish') <= 0) return;
    setItemCount('radish', getItemCount('radish') - 1);
    triggerOnce('crop_radish_laozhang', () => { /* 世界变化由 town create 按事件渲染 */ });
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    this.updateHUD();
  }

  /** 番茄×夏雅（"她记得"）：背包有番茄且未触发 → 一句记忆 + 埋切片B种子（crop_tomato_xiya_seen）；
   *  切片B 番茄架由 farm 的 setupTomatoTrellis 按该事件状态渲染（植物改变空间，非本处直画）。 */
  private tryCropTomatoXiya(cleanup: () => void): boolean {
    if (!this.dawnXiya || !this.dawnXiya.visible) return false;
    if (hasTriggered('crop_tomato_xiya_seen')) return false;
    if (getItemCount('tomato') <= 0) return false;
    const dx = this.player.x - this.dawnXiya.x;
    const dy = this.player.y - this.dawnXiya.y;
    if (dx * dx + dy * dy > R2(28)) return false;
    cleanup();
    setItemCount('tomato', getItemCount('tomato') - 1);
    triggerOnce('crop_tomato_xiya_seen', () => {

      this.playStory([
        { speaker: '', color: COLORS.system, text: '（夏雅看见你手里的番茄，愣了一下。）' },
        { speaker: '夏雅', color: COLORS.xiya, text: '这个味道……有点像以前。' },
        { speaker: '林澈', color: COLORS.linche, text: '以前？' },
        { speaker: '', color: COLORS.system, text: '（她没再说下去，只是接过番茄。）' },
      ], () => this.updateHUD());
    });
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    return true;
  }

  /** 土地回应系统 v1.4：农田"活过来"后，夏雅路过一句（一次性）——"世界回应玩家长期种地" */
  private tryCropFieldAliveXiya(cleanup: () => void): boolean {
    if (!this.dawnXiya || !this.dawnXiya.visible) return false;
    if (!hasTriggered('crop_field_alive')) return false;
    if (hasTriggered('crop_field_alive_xiya')) return false;
    const dx = this.player.x - this.dawnXiya.x;
    const dy = this.player.y - this.dawnXiya.y;
    if (dx * dx + dy * dy > R2(28)) return false;
    cleanup();
    triggerOnce('crop_field_alive_xiya', () => {

      this.playStory([
        { speaker: '', color: COLORS.system, text: '（夏雅站在田边，看了好一会儿。）' },
        { speaker: '夏雅', color: COLORS.xiya, text: '感觉这片地又活过来了。' },
      ], () => this.updateHUD());
    });
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    return true;
  }

  /** 萝卜赠予后的世界变化（town create 调用）：河边长椅旁 腌萝卜罐 + 小菜碟——"这个世界留下了你的痕迹" */
  private setupCropLifeLeftovers(): void {
    if (this.mapKey !== 'town') return;
    if (!hasTriggered('crop_radish_laozhang')) return;
    if (this.cropLifeLeftoverGfx) return; // 幂等：同一场景实例内不重复创建
    const T = TILE_SIZE;
    // S6 长椅旁（长椅在 (6,15)）：一小碟腌萝卜 + 一罐萝卜干
    const bx = 6 * T + T / 2, by = 15 * T + T / 2;
    const g = this.add.graphics().setDepth(3);
    // 腌萝卜罐（陶罐 + 盖 + 高光）
    g.fillStyle(0x8a6a45, 1); g.fillRect(bx - 12, by - 4, 8, 8);
    g.fillStyle(0x9a7a52, 1); g.fillRect(bx - 12, by - 4, 8, 2);
    g.fillStyle(0x6e4a24, 1); g.fillRect(bx - 13, by - 5, 10, 2);   // 罐盖
    g.fillStyle(0xb89858, 0.9); g.fillRect(bx - 11, by - 1, 2, 2);   // 高光
    // 小菜碟（浅碟 + 两片萝卜）
    g.fillStyle(0xd8d0c0, 1); g.fillEllipse(bx - 2, by + 3, 10, 4);
    g.fillStyle(0xe8a0a0, 1); g.fillRect(bx - 5, by + 2, 2, 1); g.fillRect(bx + 1, by + 3, 2, 1);
    // 投影
    g.fillStyle(0x2e2e34, 0.25); g.fillEllipse(bx - 5, by + 7, 18, 4);
    this.cropLifeLeftoverGfx = g;
  }

  /**
   * 种植升级 v2 切片B：番茄架（植物改变空间，2026-08-15 制作人拍板开工）。
   * 触发：crop_tomato_xiya_seen（夏雅"她记得"）→ farm 农田北缘草地出现一排番茄架。
   * 定位：番茄架是"植物改变环境"的第一种示例（非夏雅专属剧情），后续扩展模板：
   *       花 → 花圃 / 玉米 → 丰收角 / 草莓 → 小菜园（见 docs/design/种植系统生活化方向-v0.1.md 切片B）。
   * 位置：农田北缘草地 (12-14,7)，避开森林入口出生点 (15,6)/树位/花田 (3,7)/篱笆 (27,7)/菜畦 (30-31,8)。
   * 零素材 Graphics：竹竿 + 横杆 + 绑绳 + 藤蔓 + 番茄果 + 投影；纯装饰无碰撞；随场景 shutdown 自动销毁。
   */
  private setupTomatoTrellis(): void {
    if (this.mapKey !== 'farm') return;
    if (!hasTriggered('crop_tomato_xiya_seen')) return;
    if (this.tomatoTrellisGfx) return; // 幂等：同一场景实例内不重复创建
    const T = TILE_SIZE;
    const baseY = 7 * T + T / 2;                                   // 农田北缘草地带（土壤上方一排）
    const poleX = [12 * T + T / 2, 13 * T + T / 2, 14 * T + T / 2]; // 三根竹竿（跨 2 格）
    const g = this.add.graphics().setDepth(3);
    // 脚底投影（让架子"落在地上"，同腌萝卜罐范式）
    g.fillStyle(0x2e2e34, 0.22);
    g.fillEllipse(13 * T + T / 2, baseY + 7, 46, 6);
    // 三根竹竿（浅竹色 + 竹节深线）
    for (const px of poleX) {
      g.fillStyle(0xc8a868, 1); g.fillRect(px - 2, baseY - 30, 4, 38);
      g.fillStyle(0xa8844c, 1); g.fillRect(px - 2, baseY - 30, 4, 3);
      g.fillRect(px - 2, baseY - 16, 4, 2);
      g.fillRect(px - 2, baseY - 2, 4, 2);
    }
    // 两道横杆（横跨三根竹竿）
    g.fillStyle(0xb8965c, 1);
    g.fillRect(poleX[0] - 8, baseY - 24, poleX[2] - poleX[0] + 16, 3);
    g.fillRect(poleX[0] - 8, baseY - 12, poleX[2] - poleX[0] + 16, 3);
    // 绑绳结（横杆与竹竿交点的小棕点）
    g.fillStyle(0x8a6a42, 1);
    for (const px of poleX) {
      g.fillRect(px - 2, baseY - 25, 4, 2);
      g.fillRect(px - 2, baseY - 13, 4, 2);
    }
    // 藤蔓（两根绿色竖线，轻微 S 形）
    g.lineStyle(1.2, 0x5a9a3a, 0.95);
    g.beginPath();
    g.moveTo(poleX[0] + 4, baseY - 2); g.lineTo(poleX[0] + 4, baseY - 22);
    g.lineTo(poleX[1] - 3, baseY - 22); g.lineTo(poleX[1] - 3, baseY - 26);
    g.moveTo(poleX[1] + 4, baseY - 2); g.lineTo(poleX[1] + 4, baseY - 20);
    g.lineTo(poleX[2] - 3, baseY - 20);
    g.strokePath();
    // 番茄果（红果 ×3 + 未熟绿果 ×1，错落挂在藤上）
    const tomato = (tx: number, ty: number, color: number, hl: number): void => {
      g.fillStyle(color, 1); g.fillCircle(tx, ty, 3);
      g.fillStyle(hl, 0.8); g.fillCircle(tx - 1, ty - 1, 1);
      g.fillStyle(0x3c8a33, 1); g.fillRect(tx, ty - 3, 1, 2); // 果蒂
    };
    tomato(poleX[0] + 4, baseY - 16, 0xe04a3a, 0xff8a72);
    tomato(poleX[1] - 3, baseY - 20, 0xc63a2a, 0xff8a72);
    tomato(poleX[1] + 4, baseY - 13, 0xe04a3a, 0xff8a72);
    tomato(poleX[2] - 3, baseY - 15, 0x9abf5a, 0xc8df88); // 未熟
    // 叶簇（藤上两三片小叶）
    g.fillStyle(0x6da544, 1);
    g.fillRect(poleX[0] + 1, baseY - 20, 3, 1); g.fillRect(poleX[0] + 1, baseY - 20, 1, 2);
    g.fillRect(poleX[2] - 4, baseY - 18, 3, 1); g.fillRect(poleX[2] - 4, baseY - 18, 1, 2);
    this.tomatoTrellisGfx = g;
  }

  /**
   * 阶段3 光照：town 黄昏暖光（2026-08-14，执行方案 §3 光照表现 + 钓鱼点美术方向 17:00 暖黄夕阳）。
   * 零素材纯代码：全屏暖橙 ADD overlay（depth 4.5，盖地面/装饰≤4、不盖 NPC/玩家，同 farmWarm 范式）
   * + 顶部天空渐变（ADD，WebGL 下生效）+ 河面暖光斑（钓鱼点西侧水面，呼吸闪烁）。
   * 生效窗口 17:00-19:00；其余时段 alpha=0（无玩法/存档/碰撞影响，scene shutdown 自动销毁）。
   */
  private setupTownDuskOverlay(): void {
    if (this.mapKey !== 'town' || !this.groundLayer) return;
    if (this.townDuskOverlay) return; // 幂等
    const w = this.groundLayer.displayWidth;
    const h = this.groundLayer.displayHeight;
    // 全屏暖橙 ADD 罩色（fillAlpha=1，alpha 由 setAlpha/tween 控制——farm 同款注意点）
    const overlay = this.add.rectangle(0, 0, w, h, 0xffb878, 1)
      .setOrigin(0).setDepth(4.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.townDuskOverlay = overlay;
    // 天空暖光渐变：顶部亮→底部弱（模拟低垂夕阳从画面上方斜射）
    const skyGlow = this.add.graphics();
    skyGlow.setDepth(4.4);
    skyGlow.fillGradientStyle(0xffa050, 0xffa050, 0xffa050, 0xffa050, 0.5, 0.5, 0.02, 0.02);
    skyGlow.fillRect(0, 0, w, h);
    skyGlow.setBlendMode(Phaser.BlendModes.ADD);
    skyGlow.setAlpha(0);
    this.townDuskSkyGlow = skyGlow;
    // 河面暖光斑（S6 老河堤西侧水面，黄昏时"水面上有光"）
    const glints = this.add.graphics().setDepth(4.6);
    glints.fillStyle(0xffe9b0, 0.35);
    glints.fillEllipse(58, 216, 10, 4);   // 浮漂附近
    glints.fillEllipse(66, 246, 14, 5);
    glints.fillEllipse(58, 276, 12, 4);
    glints.fillEllipse(72, 302, 16, 5);
    glints.setBlendMode(Phaser.BlendModes.ADD);
    glints.setAlpha(0);
    glints.setVisible(false);
    this.townDuskGlints = glints;
    // 夜晚月光冷色：normal 混合深蓝罩色（压暗 + 偏冷；alpha 由时段控制）
    const night = this.add.rectangle(0, 0, w, h, 0x1a2a48, 1)
      .setOrigin(0).setDepth(4.5)
      .setAlpha(0);
    this.townNightCool = night;
    // 白天太阳方向感：左上→右下暖色渐变（极弱 ADD，"光从一边来"）
    const daySun = this.add.graphics();
    daySun.setDepth(4.4);
    daySun.fillGradientStyle(0xffd8a0, 0xffd8a0, 0xffd8a0, 0xffd8a0, 0.5, 0.15, 0.1, 0.02);
    daySun.fillRect(0, 0, w, h);
    daySun.setBlendMode(Phaser.BlendModes.ADD);
    daySun.setAlpha(0);
    this.townDaySun = daySun;
    // 初始按当前时间
    this.townDuskLastHour = -1;
    this.updateTownDuskOverlay();
  }

  /**
   * town 时段光照的按小时更新（update 调用；小时内幂等，跨小时才处理）。
   * 三档：白天 6-17（太阳方向感）/ 黄昏 17-19（暖橙夕阳 + 河面光斑）/ 夜晚 ≥19 或 <6（月光冷色）。
   * 全部纯视觉：不碰碰撞/存档/玩法；淡入淡出由 tween 完成。
   */
  private updateTownDuskOverlay(): void {
    if (this.mapKey !== 'town' || !this.townDuskOverlay) return;
    const h = getTime().hour;
    if (h === this.townDuskLastHour) return;
    this.townDuskLastHour = h;
    const overlay = this.townDuskOverlay;
    const skyGlow = this.townDuskSkyGlow;
    const glints = this.townDuskGlints;
    const night = this.townNightCool;
    const daySun = this.townDaySun;
    const fadeTo = (t: Phaser.GameObjects.GameObject | null, a: number, d: number): void => {
      if (!t) return;
      this.tweens.killTweensOf(t);
      this.tweens.add({ targets: t, alpha: a, duration: d, ease: 'Sine.easeOut' });
    };
    const hideGlints = (d: number): void => {
      if (!glints) return;
      this.tweens.killTweensOf(glints);
      this.tweens.add({
        targets: glints, alpha: 0, duration: d, ease: 'Sine.easeIn',
        onComplete: () => glints.setVisible(false),
      });
    };
    if (h >= 17 && h < 19) {
      // 黄昏：暖橙夕阳 + 天空渐变 + 河面光斑
      fadeTo(overlay, 0.08, 900);
      fadeTo(skyGlow, 0.2, 900);
      fadeTo(night, 0, 900);
      fadeTo(daySun, 0, 900);
      if (glints) {
        this.tweens.killTweensOf(glints);
        glints.setVisible(true);
        glints.setAlpha(0.4);
        this.tweens.add({
          targets: glints,
          alpha: { from: 0.3, to: 0.65 },
          duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      }
    } else if (h >= 19 || h < 6) {
      // 夜晚：月光冷色（暖光灯具在其上仍可透出——ADD 光源不被冷罩盖死）
      fadeTo(overlay, 0, 1200);
      fadeTo(skyGlow, 0, 1200);
      fadeTo(night, 0.16, 1200);
      fadeTo(daySun, 0, 1200);
      hideGlints(1200);
    } else {
      // 白天：极弱太阳方向感（左上暖 → 右下弱）
      fadeTo(overlay, 0, 1200);
      fadeTo(skyGlow, 0, 1200);
      fadeTo(night, 0, 1200);
      fadeTo(daySun, 0.08, 1200);
      hideGlints(1200);
    }
  }

  /** 钓鱼 Phase 4：老张收黄昏鱼后，夜晚老张家灯亮（暖光，复用 Phase3 夜灯范式） */
  private setupElderNightLamp(): void {
    if (!hasTriggered('fish_exchange_miner')) return;
    const h = getTime().hour;
    if (h >= 6 && h < 18) return;
    const T = TILE_SIZE;
    const x = 5 * T + T / 2, y = 4 * T + T / 2;
    const glow = this.add.ellipse(x, y, 64, 44, 0xffc878, 0.18).setDepth(4);
    this.tweens.add({ targets: glow, alpha: { from: 0.10, to: 0.24 }, duration: 1500, yoyo: true, repeat: -1 });
  }

  /** 单个整理点完成（视觉 + 反馈台词 + 音效闪光，基线 §7.2 语义；存档与全完成判断由 tryHouseTidyInteract 在 triggerOnceIf 返回后执行） */
  private onTidyItemDone(item: { key: 'bed' | 'lamp' | 'desk' | 'radio'; pos: { x: number; y: number }; mark: Phaser.GameObjects.Container | null; done: Phaser.GameObjects.Graphics | null }): void {
    if (item.mark) {
      item.mark.destroy();
      item.mark = null;
    }
    const g = this.add.graphics().setDepth(2);
    this.drawTidyDone(item.key, g);
    item.done = g;
    const lines: Record<string, string> = {
      // 情绪曲线（制作人 2026-08-12 拍板）：第一件（床）=生活；中间两件（灯/书桌）不强调"家"；
      // 四件全完成的归属感由 tryHouseTidyInteract 的完成句「这间屋子，开始是我的了。」承载。
      bed: '被褥叠好了。这张床……终于像一个可以生活的地方了。',
      lamp: '灯亮了，昏黄的暖光铺满屋子。晚上回来，不用摸黑了。',
      desk: '桌子摆好了。左边是爷爷的旧物，右边是我的电脑。过去和现在，都在这一张桌上。',
      radio: '收音机擦亮了。拧开旋钮，传来模糊的电流声……像很久以前的午后。',
    };
    this.showDialogueText(lines[item.key]);
    // B-2（2026-08-13 体验债务）：每一件整理都有专属反馈音效——第一章 P0「世界反馈」：
    // 玩家每一次动作，世界都回应（此前床/灯/书桌仅收音机有声，其余三件无声无光效）。
    const sfxByKey = {
      bed: 'tidy_bed', lamp: 'tidy_lamp', desk: 'tidy_desk', radio: 'radio_life',
    } as const;
    play(sfxByKey[item.key]);
    // B-2 闪光 FX：暖色光斑由亮散开（一次性 0.5s，叠在"整理后"视觉之上，强调"完成了"）
    const flash = this.add.ellipse(item.pos.x, item.pos.y, 40, 30, 0xffd98a, 0.45).setDepth(5);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: { from: 0.5, to: 1.5 },
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * 与居民需求板交互（靠近按 E 打开面板）
   */
  private tryResidentBoardInteract(): boolean {
    if (!this.residentBoardMark || !this.residentBoardMark.visible) return false;
    const dx = this.player.x - this.residentBoardMark.x;
    const dy = this.player.y - this.residentBoardMark.y;
    if (dx * dx + dy * dy > 48 * 48) return false;

    if (!this.residentBoardPanel) {
      this.uiBus.registerResidentBoardPanel(new ResidentBoardPanel((reqId) => this.onResidentDeliver(reqId)));
    }
    this.inputManager.clearAction();
    // 需求板引导任务：打开一次即完成；首次打开标记 board_quest_done（防后续重复投放）
    onDQOpenBoard();
    const firstOpen = triggerOnce('board_quest_done', () => {});
    // EventSystem.md 时序纪律：save 在 triggerOnce 返回之后，快照才含当前 key
    if (firstOpen) {
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      });
    }
    this.residentBoardPanel.open();
    return true;
  }

  /**
   * 需求交付成功回调（面板内点「交付」→ 扣资源并标记完成后调用）：
   * 触发归星记录 help_resident 标签 → 播放 NPC 反馈对白 → 存档。
   */
  private onResidentDeliver(reqId: string): void {
    const req = getRequestById(reqId);
    if (!req) return;
    // 交付成功：关闭需求板，再播反馈对白（面板淡出与对白淡入可并行）
    this.residentBoardPanel?.close();
    triggerTag('help_resident');
    // 多句反馈（\n 分隔）逐句播放，避免整段堆在一起
    const lines = req.rewardDialogue.split('\n').map((text) => ({
      speaker: req.npcName, color: req.npcColor, text,
    }));
    this.playStory(lines, () => {
      this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
    }, undefined, 'resident_deliver');
  }

  /**
   * 天气系统初始化（P3 迁移到 WeatherDirector）
   * 仅在雨天时创建，非雨天不创建任何对象（零开销）
   */
  private setupWeather(): void {
    const cur = isCurrentlyRaining();
    this.weatherDirector.setupIfRaining(cur);
    if (cur) this.syncWeatherGatherPoints();
  }

  /**
   * 更新天气状态（每小时调用一次，P3 迁移到 WeatherDirector）
   */
  private updateWeatherState(): void {
    const isRaining = isCurrentlyRaining();
    this.weatherDirector.updateWeatherState(isRaining);
  }

  /**
   * 雨天自动湿润农田（不耗水壶）
   * 在跨天时调用，检查当天是否下雨，如果是则自动湿润所有已播种的农田
   */
  private rainAutoMoisten(): number {
    // 按"今天是否为雨天"判定（而非当前小时）：trySleep 在次日 06:00 调用，
    // 而雨天窗口 10:00-16:00，isCurrentlyRaining() 在清晨恒 false → 会漏触发。
    // 雨天当天清晨把 planted 变 watered（不耗水壶），与机器人浇水幂等不重复。
    if (getWeather(getTime().day) !== 'rain') return 0;

    // 遍历所有农田，将 planted 状态的格子自动变为 watered
    let n = 0;
    for (let row = FARM_AREA.row0; row <= FARM_AREA.row1; row++) {
      for (let col = FARM_AREA.col0; col <= FARM_AREA.col1; col++) {
        if (getTileState(col, row) === 'planted') {
          setTileState(col, row, 'watered');
          const crop = getCrop(col, row);
          if (crop) setCrop(col, row, { ...crop, watered: true });
          n++;
        }
      }
    }
    return n;
  }

  /**
   * v0.5.3 剧情密度 E1：清晨偶遇的夏雅
   * 教程完成后，清晨 06-08 时进入农场时在庄园出现；玩家靠近按 E 播放 XIYA_DAWN_DIALOGUE。
   * 当天触发过一次后不再出现（dawnXiyaDay 记录，跨天由 onDayChange 重置）。
   * 纯陪伴事件：无任务、无奖励、不影响主线/教程。
   */
  private setupDawnXiya(): void {
    const t = getTime();
    if (t.hour < 6 || t.hour >= 8) return;
    if (this.dawnXiyaDay === t.day) return;

    // v0.6 NPC 生活化 P0：清晨夏雅在花园浇水（花园右上角外 col 33, row 4，与见证位错开）
    const dx = 33 * TILE_SIZE + TILE_SIZE / 2;
    const dy = 4 * TILE_SIZE + TILE_SIZE / 2;
    this.dawnXiya = this.add.sprite(dx, dy, 'npc_xiya');
    // 2026-08-14 夏雅精灵升级（28×64 全身图）：scale 0.42 ≈ 12×27px（全身角色，视觉与其他 NPC 协调）
    this.dawnXiya.setScale(0.5).setDepth(5);
    this.dawnXiyaLabel = this.add.text(dx, dy - 24, '夏雅', {
      fontSize: '13px', color: '#f0a050',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 3, y: 2 },
    }).setShadow(0, 1, '#000000', 2).setOrigin(0.5).setDepth(6);
    // 花园浇水动作（浇花 tween：微蹲 + 前倾，模拟拿壶浇水）
    this.tweens.add({
      targets: this.dawnXiya,
      scaleY: { from: 0.5, to: 0.46 },
      y: { from: dy, to: dy + 2 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  /** 与清晨夏雅交互（靠近按 E → 播放偶遇对话） */
  private tryDawnXiyaInteract(): boolean {
    if (!this.dawnXiya || !this.dawnXiya.visible) return false;
    if (getTime().hour < 6 || getTime().hour >= 8) return false;
    const dx = this.player.x - this.dawnXiya.x;
    const dy = this.player.y - this.dawnXiya.y;
    if (dx * dx + dy * dy > R2(28)) return false;

    // 钓鱼 Phase 4：夏雅看到鱼才产生偶遇（发现时刻）——背包有青禾鲫且未换过 → 交换优先
    if (this.tryXiyaFishExchange(() => {
      this.dawnXiyaDay = getTime().day;
      this.dawnXiya?.destroy(); this.dawnXiya = null;
      this.dawnXiyaLabel?.destroy(); this.dawnXiyaLabel = null;
    })) return true;

    // 采集流向扩展：小野花交换（背包有小野花且未换过 → 夏雅收下 → 老屋窗台插花）
    if (this.tryXiyaFlowerExchange(() => {
      this.dawnXiyaDay = getTime().day;
      this.dawnXiya?.destroy(); this.dawnXiya = null;
      this.dawnXiyaLabel?.destroy(); this.dawnXiyaLabel = null;
    })) return true;

    // 种植升级 v2：番茄×夏雅（"她记得"——埋切片B种子；番茄架由 farm create 按事件状态渲染）
    if (this.tryCropTomatoXiya(() => {
      this.dawnXiyaDay = getTime().day;
      this.dawnXiya?.destroy(); this.dawnXiya = null;
      this.dawnXiyaLabel?.destroy(); this.dawnXiyaLabel = null;
    })) return true;

    // 土地回应系统 v1.4：农田"活过来"后夏雅一句"感觉这片地又活过来了"（一次性）
    if (this.tryCropFieldAliveXiya(() => {
      this.dawnXiyaDay = getTime().day;
      this.dawnXiya?.destroy(); this.dawnXiya = null;
      this.dawnXiyaLabel?.destroy(); this.dawnXiyaLabel = null;
    })) return true;

    this.dawnXiyaDay = getTime().day;
    this.dawnXiya.destroy();
    this.dawnXiya = null;
    if (this.dawnXiyaLabel) { this.dawnXiyaLabel.destroy(); this.dawnXiyaLabel = null; }

    // E1/E9 修复（2026-08-06）：当天已触发标记立即入档，刷新后同一天不再重复触发
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    this.playStory(
      this.buildDawnXiyaLines(),
      () => {
        this.updateHUD();
      },
      (index: number) => {
        // 第一章 P2 捕虫「自然记录」：玩家选择「给她看蝴蝶」，解锁夏雅旧日记忆（一次性，无好感数值）
        if (index === 0) {
          if (getItemCount('butterfly_specimen') > 0) {
            addItem('butterfly_specimen', -1);
            triggerOnce('natural_record_butterfly_xiya', () => {
              this.storyDialogue!.play(XIYA_BUTTERFLY_SHARE_DIALOGUE, () => this.updateHUD());
            });
          }
        }
        this.updateHUD();
      },
    );
    return true;
  }

  /** 第一章 P2 捕虫「自然记录」：清晨对话行——若背包有蝴蝶标本且未分享过，末尾追加分享选项 */
  private buildDawnXiyaLines(): DialogueLine[] {
    const lines = [...XIYA_DAWN_DIALOGUE];
    if (getItemCount('butterfly_specimen') > 0 && !hasTriggered('natural_record_butterfly_xiya')) {
      lines.push({ speaker: '', color: '#aaaaaa', text: '', options: ['给她看蝴蝶标本', '没什么'] });
    }
    return lines;
  }

  /**
   * day2 清晨「岛屿的第一声回应」（制作人定稿 2026-08-07，见 docs/tasks/任务-岛屿的第一声回应-day2清晨剧情.md）
   * 玩家第一天睡觉后第一次"完整循环"的回报：睡醒演出 → 夏雅自动出现在老屋门口看农田 → 自动播对白
   * → 注入复兴引导任务（收获/种植/清理）。
   * 一次性：EventManager.triggerOnce('first_morning_response') 持久化判重（随每次 save 入档）；
   * 与 day3+ 清晨 dawnXiya 闲聊（XIYA_DAWN_DIALOGUE）并存互不干扰。
   * 双挂钩点：trySleep（醒来仍在 farm）+ create（睡醒后切场景/重进 farm）都会尝试，触发一次后静默。
   */
  private tryFirstMorningSequence(): void {
    if (this.mapKey !== 'farm') return;
    // 第一章 P0 残留清理（2026-08-14）：chapter>=1 后第0章 day2 清晨「岛屿的第一声回应」不再触发。
    // 该演出是第0章"完整循环"教学回报；第一章拥有自己的清晨演出（木匠回归/阿风欢迎/村长来访），
    // 且 Dev Hub 第一章跳档会清空事件（first_morning_response 未标记）+ day>=2 → 误触发第0章提示。
    if (isChapterAtLeast(CHAPTER_1)) return;
    if (this.inStargazeCutscene) return; // v0.10.4 观星夜演出中不触发
    if (!isTutorialDone()) return;
    if (getTime().day < 2) return;
    if (hasTriggered('first_morning_response')) return;
    if (this.firstMorningDone) return;
    this.firstMorningDone = true;
    triggerOnce('first_morning_response', () => {
      // 2026-08-11：演出窗口开始（到对白结束为止），窗口内首次收获的情绪对白被抑制并延后补播
      this.firstMorningActive = true;
      // ① 睡醒演出：窗外阳光旁白（鸟叫/风由 farm 白天 ambience 自动播放）
      // 林澈个人曲（2026-08-09 制作人归档《The Waiting Shore》）：主角清晨独处的内心时刻
      // v0.11（P0.5）：剧情覆盖走 playStory，结束恢复统一 playSceneBgm（剧情>我的歌>地图默认）
      MusicSystem.playStory('linche_theme');
      showMemoryMoment('清晨。阳光从老屋的窗户透进来，外面传来鸟叫和风吹树叶的声音。');
      // ② 夏雅自动出现在老屋门口（老屋东侧空地，看着农田；避开 oldHouseRestore 锚点 col11,row20 与 house 出口）
      const T = TILE_SIZE;
      const mx = 10 * T + T / 2;
      const my = 21 * T + T / 2;
      this.morningXiya = this.add.sprite(mx, my, 'npc_xiya');
      this.morningXiya.setScale(0.5).setDepth(5);
      this.morningXiyaLabel = this.add.text(mx, my - 24, '夏雅', {
        fontSize: '13px', color: '#f0a050',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(6);
      // ③ 演出后自动播对白（不等玩家靠近）
      this.time.delayedCall(2600, () => {
        if (this.inStargazeCutscene) return; // P1 守卫：观星夜演出中不播清晨对白（验收遗留，2026-08-08）
        // 林澈个人曲仅属于主角独处时刻——夏雅对白开始（世界的声音回来）即恢复农场场景 BGM
        // v0.11（P0.5）：先清除剧情覆盖再恢复，若玩家选了"我的歌"则回到我的歌
        const h = getTime().hour;
        MusicSystem.endStory();
        MusicSystem.playSceneBgm('farm', h);
        if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
        // 2026-08-11 守卫：玩家手速快在演出触发前（trySleep 挂钩 1800ms 窗口内）抢先首次收获时，
        // 首次收获对白此刻正在播放——等它播完再播清晨对白，防止两个剧情竞争 StoryDialogue 单实例互相覆盖。
        //（演出窗口内收割走 pendingFirstHarvest 补播链；本守卫覆盖「演出触发前已收割」的另一条真实路径。）
        const playMorningDialogue = (): void => {
          this.storyDialogue!.play(FIRST_MORNING_RESPONSE_DIALOGUE, () => {
          // ④ 对白结束：注入复兴引导任务（收获/种植/清理）→ 刷新面板/HUD → 存档（含 triggerOnce 状态）
          injectRevivalQuests();
          this.createDailyQuestPanel();
          this.updateQuestHUD();
          // 演出精灵生命周期闭合（BUG-071：对白结束夏雅离开，防止僵尸夏雅与后续时段实例同场）
          this.clearMorningXiya();
          this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
          // 2026-08-11：演出窗口结束；窗口内玩家抢先完成的首次收获对白在此补播
          //（防两个剧情互相覆盖：先完整播完清晨回应，再播首次收获情绪）
          this.firstMorningActive = false;
          if (this.pendingFirstHarvest) {
            this.pendingFirstHarvest = false;
            this.time.delayedCall(200, () => this.playFirstHarvestDialogue());
          }
          });
        };
        // 轮询等当前对白（首次收获情绪瞬间）播完再播清晨回应；20s 兜底防死等
        const waitForCurrentDialogue = (tries = 0): void => {
          if (this.storyDialogue!.isOpen() && tries < 100) {
            this.time.delayedCall(200, () => waitForCurrentDialogue(tries + 1));
            return;
          }
          playMorningDialogue();
        };
        waitForCurrentDialogue();
      });
    });
  }

  /**
   * 第一章 P1-2 村长来访（Sprint 2 Vertical Slice，制作人 2026-08-12 拍板）
   *
   * 叙事定位：老屋整理完成后的"连接点"——玩家从"我开始在这里生活了"过渡到
   * "为什么我要帮助这个镇？"（青禾镇正在尝试重新开始）。
   * 触发条件（EventCondition 不扩展，时间/进度条件在调用层组合）：
   *   chapter >= 1（ChapterSystem）
   *   && isHouseTidyComplete()（老屋整理完成，HouseTidy 派生）
   *   && 未触发过（triggerOnceIf 幂等）
   * 触发时机：整理完成后的下一次进入老屋（house）场景即触发。
   *   （2026-08-14 放宽：原要求「20点后 + 隔天」，玩家白天整理完→睡觉跨天→到不了夜晚老屋状态，经常不触发。）
   * 表现：老屋（house 场景）门口，村长出现 → 敲门声 → 对白（"灯亮着"→ 灯是小镇复苏的隐喻）
   *   → 选项 A/B（愿意帮忙 / 还没想好）→ 记录态度（ch1ElderChoice：'help' | 'unsure'，随 flags 入档）
   *   → 村长离开（清理精灵）→ 存档。
   * 对白内联（StorySystem 冻结区单写者制，只读导入，不新增剧情数据）。
   * 参照：tryFirstMorningSequence / tryCarpenterReturn 演出范式。
   */
  private tryElderVisitSequence(): void {
    if (this.mapKey !== 'house') return;
    if (!isChapterAtLeast(CHAPTER_1)) return;
    if (!isHouseTidyComplete()) return;
    if (hasTriggered('ch1_elder_visit')) return;
    if (this.elderVisitDone) return;
    // BUG-FIX（P1）：对白/演出被占用时窗口期不触发（同 startArtShow 范式）——
    // ch1_elder_visit 在演出开始前就标记，若 1.2s 敲门延迟内对白被别的剧情占用，
    // play 会静默覆盖打开中的对白 → endVisit 永不执行 → 村长精灵残留、选择不入档。
    if (this.storyDialogue?.isOpen() || this.storySequenceRunner?.isPlaying?.()) return;
    // 2026-08-14 触发放宽（制作人拍板）：整理完成 + 下次进老屋即触发。
    // 原逻辑要求「20 点后且整理完成隔天」（t.hour<20 / t.day<=ch1ElderVisitDay 拦截），
    // 玩家白天整理完 → 睡觉跨天 → 永远到不了"夜晚+老屋"状态，镇长上门经常触发不了。
    // 现改为无条件：整理完成的下一进屋，镇长来敲门（叙事"听说你把老屋收拾好了"）。
    this.elderVisitDone = true;
    triggerOnceIf('ch1_elder_visit', { chapter: CHAPTER_1 }, () => {
      // ① 敲门声（程序合成，低音量；零资产）
      play('knock');
      // ② 村长出现在老屋门口（底部门内侧空地；避开整理点/家具/出口触发区）
      const T = TILE_SIZE;
      const ex = 9.5 * T + T / 2;
      const ey = 13 * T + T / 2;
      this.elderVisitSprite = this.add.sprite(ex, ey, 'npc_elder');
      this.elderVisitSprite.setScale(0.5).setDepth(5);
      this.elderVisitLabel = this.add.text(ex, ey - 14, '镇长', {
        fontSize: '13px', color: '#c8b898',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(6);
      // ③ 敲门声后 1.2s 自动播对白（忙则每秒重试，上限 30 次；延迟窗口内的占用在
      // 入口守卫之外仍可能发生——如整点日常事件对白恰好插入）
      this.time.delayedCall(1200, () => this.queueElderVisitDialogue());
    });
  }

  /**
   * 村长来访对白入队：对白/演出被占用时每秒重试（上限 30 次），超限放弃播对白但
   * 仍走 endVisit 收尾（清精灵+存档，宁可丢演出不可残留僵尸村长/丢选择入档）。
   * 修复：此前忙时直接 play 会静默覆盖打开中的对白 → endVisit 永不执行。
   */
  private queueElderVisitDialogue(attempts = 0): void {
    if (!this.scene.isActive()) return;
    if (this.storyDialogue?.isOpen() || this.storySequenceRunner?.isPlaying?.()) {
      if (attempts < 30) {
        this.time.delayedCall(1000, () => this.queueElderVisitDialogue(attempts + 1));
        return;
      }
      console.warn('[MapScene] 村长来访对白 30s 未获得播放权，放弃演出走收尾');
      this.clearElderVisit();
      this.saveAtPlayer();
      return;
    }
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    // 收尾（幂等）：村长离开 → 存档（含 ch1_elder_visit / ch1ElderChoice，时序纪律见 docs/dev/EventSystem.md）。
    // 注意：StoryDialogue 选项行被点击后只回调 onChoice、不回调 onComplete（观星夜同范式），
    // 因此清理+存档必须在 onChoice 内也执行，否则村长精灵残留、选择不入档、读档重复触发。
    let ended = false;
    const endVisit = (): void => {
      if (ended) return;
      ended = true;
      this.clearElderVisit();
      this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
    };
    this.storyDialogue!.play(
      [
        { speaker: '镇长', color: '#c8b898', text: '今晚路过，看见你屋里的灯亮着。' },
        { speaker: '林澈', color: '#7eb8da', text: '……镇长？这么晚了，怎么过来了？' },
        { speaker: '镇长', color: '#c8b898', text: '以前镇上的灯，也是这样一点一点亮起来的。' },
        { speaker: '镇长', color: '#c8b898', text: '最近有人开始问，集市还能不能重新开起来。' },
        { speaker: '', color: '#aaaaaa', text: '', options: ['如果能帮上忙，我愿意试试。', '我还没想好。'] },
      ],
      () => endVisit(), // Skip 路径
      (index: number) => {
        // ⑤ 记录态度：'help' 愿意帮忙 / 'unsure' 还没想好（随 flags 入档，集市恢复时消费）
        this.ch1ElderChoice = index === 0 ? 'help' : 'unsure';
        endVisit();     // 正常选项路径：选项行不回调 onComplete，须在此收尾
      },
    );
  }

  /** 村长来访演出清理：移除精灵/标签，恢复玩家操作 */
  private clearElderVisit(): void {
    this.elderVisitSprite?.destroy();
    this.elderVisitSprite = null;
    this.elderVisitLabel?.destroy();
    this.elderVisitLabel = null;
  }

  /**
   * P0.5 世界规律引导（2026-08-16 制作人拍板：生活发现式引导，不做任务）：
   * 第一场雨 → 小梅在农场顺口提起"后山蘑菇"。
   * 触发：farm + 正在下雨 + 第一章 + 未触发过（triggerOnce 持久化）。
   * 原则：只提示不指派，玩家想去就去、不去无惩罚。
   */
  private tryRainMushroomHint(): void {
    if (this.mapKey !== 'farm') return;
    if (!isChapterAtLeast(CHAPTER_1)) return;
    if (this.rainHintDone) return;
    if (hasTriggered('world_hint_rain_mushroom')) { this.rainHintDone = true; return; }
    if (!isCurrentlyRaining()) return;
    // 演出互斥：观星/春日集/清晨演出期间不插话，避免抢占对白
    if (this.inStargazeCutscene || this.inSpringFairCutscene || this.firstMorningActive) return;
    if (this.storyDialogue?.isOpen()) return;
    this.rainHintDone = true;
    triggerOnce('world_hint_rain_mushroom', () => {

      this.playStory(RAIN_MUSHROOM_HINT_DIALOGUE, () => {
        this.updateHUD();
        this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
      });
    });
  }

  /**
   * P0.5 世界规律引导（环境暗示层）：
   * 雨天第一次进森林 → 一句环境观察（"地上好像多了些平时没见过的东西"），不直接告诉答案。
   */
  private tryRainForestEntranceHint(): void {
    if (this.mapKey !== 'forest') return;
    if (!isChapterAtLeast(CHAPTER_1)) return;
    if (this.rainForestHintDone) return;
    if (hasTriggered('world_hint_rain_forest_entrance')) { this.rainForestHintDone = true; return; }
    if (!isCurrentlyRaining()) return;
    if (this.storyDialogue?.isOpen()) return;
    this.rainForestHintDone = true;
    const hinted = triggerOnce('world_hint_rain_forest_entrance', () => {
      this.showDialogueText(RAIN_FOREST_ENTRANCE_HINT_DIALOGUE[0].text);
    });
    // EventSystem.md 时序纪律：save 在 triggerOnce 返回之后，快照才含当前 key
    if (hinted) {
      this.saveAtPlayer();
    }
  }

  /**
   * FEATURE-041 复兴循环 v0.11：木匠老周回归演出（制作人拍板 2026-08-07，见 docs/tasks/任务-FEATURE041-复兴循环v0.11-复兴度与木匠回归.md）
   * 老屋（oldHouse）修复完成后，当晚/次日进入 farm 时自动触发：
   * 木匠出现在老屋旁（farm 场景）→ 自动播放 CARPENTER_RETURN_DIALOGUE → 成为常驻 NPC（此后按 NPCSystem 日程出现）。
   * 一次性：EventManager.triggerOnce('carpenter_returned') 持久化判重（随每次 save 入档）；
   * 与 day2 清晨剧情（tryFirstMorningSequence）互不干扰（各自判重隔离，可先后触发）。
   * 双挂钩点：trySleep（醒来仍在 farm）+ create（睡醒后切场景/重进 farm）都会尝试，触发一次后静默。
   */
  private tryCarpenterReturn(): void {
    if (this.mapKey !== 'farm') return;
    if (!isRestored('oldHouse')) return;
    if (hasTriggered('carpenter_returned')) return;
    if (this.carpenterReturnDone) return;
    this.carpenterReturnDone = true;
    triggerOnce('carpenter_returned', () => {
      // ① 演出旁白：老屋修好的第二天清晨
      showMemoryMoment('老屋修好的第二天清晨。屋瓦还是新的，门轴转得比以前顺滑。');
      // ② 木匠出现在老屋旁空地（避开 oldHouseRestore 锚点 col11,row20 与 house 出口 col5-7,rows18-20）
      const T = TILE_SIZE;
      const cx = 12 * T + T / 2;
      const cy = 21 * T + T / 2;
      this.carpenterReturnSprite = this.add.sprite(cx, cy, 'npc_carpenter');
      this.carpenterReturnSprite.setScale(0.5).setDepth(5);
      this.add.text(cx, cy - 14, '木匠老周', {
        fontSize: '13px', color: '#c89860',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(6);
      // ③ 演出后自动播对白（不等玩家靠近）
      this.time.delayedCall(2600, () => {
        if (this.inStargazeCutscene) return; // P1 守卫：观星夜演出中不播木匠回归对白（同 first-morning）

        this.playStory(CARPENTER_RETURN_DIALOGUE, () => {
          // ④ 对白结束：木匠成为常驻 NPC → 刷新 HUD → 存档（含 triggerOnce 状态）
          this.updateHUD();
          this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
        });
      });
    });
  }

  /**
   * 反馈 #28：阿风热情欢迎「你回来了！」
   * 玩家去过镇上（第一章，ch1TownIntroDone）后再次进入农场时自动触发：
   * 阿风出现在木屋旁 → 自动播放 ADVENTURER_WELCOME_BACK_DIALOGUE → 一次性（triggerOnce('adventurer_welcome_back')）。
   * 触发时机依赖 ch1TownIntroDone，天然错开 day2 清晨 first_morning_response 演出。
   * 双挂钩点：create（从镇上/外部切回农场）+ trySleep（睡醒仍在农场）。
   */
  private tryAdventurerWelcome(): void {
    if (this.mapKey !== 'farm') return;
    if (this.inStargazeCutscene) return; // v0.10.4 观星夜演出中不触发
    if (!isTutorialDone()) return;
    if (!isCh1TownIntroDone()) return;
    if (hasTriggered('adventurer_welcome_back')) return;
    if (this.adventurerWelcomeDone) return;
    this.adventurerWelcomeDone = true;
    triggerOnce('adventurer_welcome_back', () => {
      // 阿风出现在木屋旁空地（避开 morningXiya 10*T 与 carpenter 12*T 锚点、house 出口）
      const T = TILE_SIZE;
      const ax = 11 * T + T / 2;
      const ay = 21 * T + T / 2;
      this.adventurerWelcomeSprite = this.add.sprite(ax, ay, 'npc_adventurer');
      this.adventurerWelcomeSprite.setScale(0.5).setDepth(5);
      this.adventurerWelcomeLabel = this.add.text(ax, ay - 14, '阿风', {
        fontSize: '13px', color: '#88b8e8',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(6);
      // 演出后自动播对白（不等玩家靠近）
      this.time.delayedCall(1800, () => {
        if (this.inStargazeCutscene) return; // P1 守卫：观星夜演出中不播阿风欢迎对白（同 first-morning）

        this.playStory(ADVENTURER_WELCOME_BACK_DIALOGUE, () => {
          // 对白结束：阿风离开（移除演出精灵）→ 刷新 HUD → 存档（含 triggerOnce 状态）
          this.adventurerWelcomeSprite?.destroy();
          this.adventurerWelcomeSprite = null;
          this.adventurerWelcomeLabel?.destroy();
          this.adventurerWelcomeLabel = null;
          this.updateHUD();
          this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
        });
      });
    });
  }

  /**
   * v0.5.3 剧情密度 E9：傍晚关心的夏雅
   * 教程完成后，傍晚 18-20 时进入农场时在庄园出现；玩家靠近按 E 播放 XIYA_EVENING_DIALOGUE。
   * 当天触发过一次后不再出现（eveningXiyaDay 记录，跨天重置）。
   * 纯陪伴事件：无任务、无奖励、不影响主线/教程。
   */
  private setupEveningXiya(): void {
    const t = getTime();
    if (t.hour < 18 || t.hour >= 20) return;
    if (this.eveningXiyaDay === t.day) return;
    // D-011 让位（BUG-071）：《春深有信·一》剧情专线 A/D 段需要夏雅精灵时（12-20 时窗口重叠），
    // 傍晚闲聊（纯陪伴，低优先级）让位，避免傍晚同时出现两个夏雅；B/C 段（无夏雅精灵）不受影响。
    if (this.xiyaLetterDone !== true) {
      const needXiya = this.xiyaLetterStage === 0 || this.xiyaLetterStage >= 3;
      if (needXiya) return;
    }

    const dx = 14 * TILE_SIZE + TILE_SIZE / 2;
    const dy = 6 * TILE_SIZE + TILE_SIZE / 2;
    this.eveningXiya = this.add.sprite(dx, dy, 'npc_xiya');
    this.eveningXiya.setScale(0.5).setDepth(5);
    this.eveningXiya.setFlipX(true);
    this.eveningXiyaLabel = this.add.text(dx, dy - 24, '夏雅', {
      fontSize: '13px', color: '#f0a050',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 3, y: 2 },
    }).setShadow(0, 1, '#000000', 2).setOrigin(0.5).setDepth(6);
  }

  /** 与傍晚夏雅交互（靠近按 E → 播放关心对话） */
  private tryEveningXiyaInteract(): boolean {
    if (!this.eveningXiya || !this.eveningXiya.visible) return false;
    if (getTime().hour < 18 || getTime().hour >= 20) return false;
    const dx = this.player.x - this.eveningXiya.x;
    const dy = this.player.y - this.eveningXiya.y;
    if (dx * dx + dy * dy > R2(28)) return false;

    // 钓鱼 Phase 4：夏雅看到鱼才产生偶遇（发现时刻）——与清晨路径一致，交换优先
    if (this.tryXiyaFishExchange(() => {
      this.eveningXiyaDay = getTime().day;
      this.eveningXiya?.destroy(); this.eveningXiya = null;
      this.eveningXiyaLabel?.destroy(); this.eveningXiyaLabel = null;
    })) return true;

    // 采集流向扩展：小野花交换（与清晨路径一致）
    if (this.tryXiyaFlowerExchange(() => {
      this.eveningXiyaDay = getTime().day;
      this.eveningXiya?.destroy(); this.eveningXiya = null;
      this.eveningXiyaLabel?.destroy(); this.eveningXiyaLabel = null;
    })) return true;

    this.eveningXiyaDay = getTime().day;
    this.eveningXiya.destroy();
    this.eveningXiya = null;
    if (this.eveningXiyaLabel) { this.eveningXiyaLabel.destroy(); this.eveningXiyaLabel = null; }

    // E1/E9 修复（2026-08-06）：当天已触发标记立即入档，刷新后同一天不再重复触发
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    this.playStory(XIYA_EVENING_DIALOGUE, () => {
      // 灯意象彩蛋（L2/L3，制作人拍板 2026-08-05）：首次傍晚对话结束后追加观察台词 + 童年点灯闪回
      if (!this.lampFlashbackDone) {
        this.lampFlashbackDone = true;
        this.playEveningLampSequence();
        return;
      }
      this.updateHUD();
    });
    return true;
  }

  /**
   * 灯意象彩蛋序列（L3 观察台词 → L2 童年点灯回忆闪回）。
   * 由 tryEveningXiyaInteract 首次触发调用（lampFlashbackDone 控制，一次性，不入档）。
   * 观察台词为林澈内心独白，闪回复用 MemoryFlashbacks 演出系统。
   */
  private playEveningLampSequence(): void {

    this.playStory(XIYA_EVENING_OBS_DIALOGUE, () => {
      // 灯意象闪回配剧情插图（xiya_lamp_v1，2026-08-08 AI 生成；文字在插图上、暗角下，不遮挡）
      playMemoryFlashback(XIYA_LAMP_FLASHBACK, () => {
        this.updateHUD();
      }, 'assets/images/story/xiya_lamp_v1.jpg');
    });
  }

  /** 清除傍晚夏雅精灵（场景切换/跨天时调用） */
  private clearEveningXiya(): void {
    if (this.eveningXiya) { this.eveningXiya.destroy(); this.eveningXiya = null; }
    if (this.eveningXiyaLabel) { this.eveningXiyaLabel.destroy(); this.eveningXiyaLabel = null; }
  }

  /** 河畔夏雅（2026-08-16 NPC 剧情覆盖日程扩展）：16-18 时在青禾河畔看水，18 点后回农场 */
  private setupRiversideXiya(): void {
    if (this.mapKey !== 'qinghe_river') return;
    if (!isTutorialDone()) return;
    const t = getTime();
    if (t.hour < 16 || t.hour >= 18) return;
    if (this.riversideXiyaDay === t.day) return;
    // 河畔凉亭东侧南岸（避开码头修复点/钓点/凉亭交互锚点）：面向河看水
    const dx = 18 * TILE_SIZE + TILE_SIZE / 2;
    const dy = 19 * TILE_SIZE + TILE_SIZE / 2;
    this.riversideXiya = this.add.sprite(dx, dy, 'npc_xiya');
    this.riversideXiya.setScale(0.5).setDepth(5);
    this.riversideXiyaLabel = this.add.text(dx, dy - 24, '夏雅', {
      fontSize: '13px', color: '#f0a050',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 3, y: 2 },
    }).setShadow(0, 1, '#000000', 2).setOrigin(0.5).setDepth(6);
  }

  /** 与河畔夏雅交互（靠近按 E → 播放看水对话，当天一次） */
  private tryRiversideXiyaInteract(): boolean {
    if (!this.riversideXiya || !this.riversideXiya.visible) return false;
    if (getTime().hour < 16 || getTime().hour >= 18) return false;
    const dx = this.player.x - this.riversideXiya.x;
    const dy = this.player.y - this.riversideXiya.y;
    if (dx * dx + dy * dy > R2(28)) return false;

    this.riversideXiyaDay = getTime().day;
    this.riversideXiya.destroy();
    this.riversideXiya = null;
    if (this.riversideXiyaLabel) { this.riversideXiyaLabel.destroy(); this.riversideXiyaLabel = null; }

    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    this.playStory(
      // 天气扩面第二刀（2026-08-16）：雨日河畔看水播雨天变体。
      // 判定用「今日为雨日」而非正在下雨——看水窗口 16-18 与雨窗 10-16 无交集，
      // 夏雅看的是"雨后的河"（呼应今天刚爬过浅滩的河螺），雨日傍晚雨停了仍在场。
      getWeather(getTime().day) === 'rain' ? XIYA_RIVERSIDE_RAIN_DIALOGUE : XIYA_RIVERSIDE_DIALOGUE,
      () => this.updateHUD(),
    );
    return true;
  }

  /** 清除河畔夏雅精灵（场景切换/跨天时调用） */
  private clearRiversideXiya(): void {
    if (this.riversideXiya) { this.riversideXiya.destroy(); this.riversideXiya = null; }
    if (this.riversideXiyaLabel) { this.riversideXiyaLabel.destroy(); this.riversideXiyaLabel = null; }
  }

  /** 清除 day2 清晨演出夏雅精灵（对白结束/场景切换/跨天时调用；BUG-071 演出精灵生命周期闭合） */
  private clearMorningXiya(): void {
    if (this.morningXiya) { this.morningXiya.destroy(); this.morningXiya = null; }
    if (this.morningXiyaLabel) { this.morningXiyaLabel.destroy(); this.morningXiyaLabel = null; }
  }

  /**
   * 创建森林星之碎片采集点（VIS-01 升级：幽蓝发光星芒 + 呼吸光晕 + 浮游微光）
   * 仅任务状态为 accepted 时显示；采集后销毁
   */
  private setupShard(): void {
    if (getQuestState() !== 'accepted') return;
    // 采集点位置：森林 (20, 10) 瓦片中心
    const cx = 20 * TILE_SIZE + TILE_SIZE / 2;
    const cy = 10 * TILE_SIZE + TILE_SIZE / 2;

    // 1) 外光晕：大椭圆呼吸脉动（幽蓝，叠加透明度变化）
    this.shardGlow = this.add.ellipse(cx, cy, TILE_SIZE * 2.4, TILE_SIZE * 2.4, 0x66ccff, 0.22);
    this.shardGlow.setDepth(4);
    this.shardTweens.push(this.tweens.add({
      targets: this.shardGlow,
      scale: 1.3, alpha: 0.08,
      duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));

    // 2) 内核星体：幽蓝高亮（交互判定仍用 shardSprite）
    this.shardSprite = this.add.ellipse(cx, cy, 14, 14, 0x9fd8ff, 0.95);
    this.shardSprite.setDepth(5);
    this.shardTweens.push(this.tweens.add({
      targets: this.shardSprite,
      scale: 1.18,
      duration: 950, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));

    // 3) 旋转星芒：四主光 + 四斜短光（绕碎片中心缓慢旋转）
    this.shardStar = this.add.graphics();
    this.shardStar.setDepth(5);
    const L = TILE_SIZE * 0.8;
    this.shardStar.lineStyle(2, 0x88ddff, 0.85);
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const len = i % 2 === 0 ? L : L * 0.55;
      this.shardStar.lineBetween(-Math.cos(ang) * len, -Math.sin(ang) * len, Math.cos(ang) * len, Math.sin(ang) * len);
    }
    this.shardStar.setPosition(cx, cy);
    this.shardTweens.push(this.tweens.add({
      targets: this.shardStar,
      angle: 24,
      duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));

    // 4) 浮游微光粒子：幽蓝光点向上飘散（复用 __WHITE 纹理惯例，ADD 叠加）
    if (!this.textures.exists('__WHITE')) {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 8;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 2, 8);
      this.textures.addCanvas('__WHITE', canvas);
    }
    this.shardParticles = this.add.particles(cx, cy, '__WHITE', {
      lifespan: 1400,
      speedY: { min: -36, max: -12 },
      speedX: { min: -15, max: 15 },
      quantity: 1,
      frequency: 400,
      blendMode: 'ADD',
      alpha: { start: 0.9, end: 0 },
      scale: { start: 0.35, end: 0.12 },
      tint: 0x88ccff,
    });
    this.shardParticles.setDepth(5);
  }

  /**
   * 后山老树（守望古树，核心意象）
   * 位于森林地图左侧空地，大树 + 交互
   */
  private setupOldTree(): void {
    // 老树位置：森林 (8, 8) 瓦片中心
    const cx = 8 * TILE_SIZE + TILE_SIZE / 2;
    const cy = 8 * TILE_SIZE + TILE_SIZE / 2;
    this.oldTreePos = { x: cx, y: cy };

    const container = this.add.container(cx, cy);

    // ── 地面阴影（树底，更立体） ──
    const groundShadow = this.add.graphics();
    groundShadow.fillStyle(0x000000, 0.18);
    groundShadow.fillEllipse(0, 42, 92, 22);
    container.add(groundShadow);

    // ── 树根（向四周延伸，更自然） ──
    const roots = this.add.graphics();
    roots.fillStyle(0x2e2012, 1);
    roots.fillEllipse(-20, 40, 24, 9);
    roots.fillEllipse(22, 40, 26, 9);
    roots.fillEllipse(0, 42, 18, 8);
    roots.fillStyle(0x4a3520, 0.6);
    roots.fillEllipse(-18, 38, 14, 5);
    roots.fillEllipse(20, 38, 15, 5);
    container.add(roots);

    // ── 树干（多层，深棕 + 树皮纹理） ──
    const trunk = this.add.graphics();
    trunk.fillStyle(0x332415, 1);
    trunk.fillRoundedRect(-14, -22, 28, 64, 5);
    // 树皮条纹（深浅交替竖纹）
    trunk.fillStyle(0x4a3520, 0.85);
    trunk.fillRoundedRect(-10, -18, 5, 56, 2);
    trunk.fillRoundedRect(4, -14, 4, 52, 2);
    trunk.fillStyle(0x2a1d10, 0.7);
    trunk.fillRoundedRect(-2, -16, 3, 54, 1);
    trunk.fillRoundedRect(8, -10, 3, 48, 1);
    // 树节（疤痕）
    trunk.fillStyle(0x1f1508, 0.9);
    trunk.fillEllipse(-6, 8, 5, 7);
    trunk.fillStyle(0x4a3520, 0.5);
    trunk.fillEllipse(-6, 8, 3, 5);
    container.add(trunk);

    // ── 树枝（向四周伸展） ──
    const branches = this.add.graphics();
    branches.lineStyle(5, 0x332415, 1);
    branches.lineBetween(-14, -10, -44, -30);
    branches.lineBetween(14, -10, 44, -30);
    branches.lineStyle(3.5, 0x332415, 0.85);
    branches.lineBetween(-44, -30, -62, -40);
    branches.lineBetween(44, -30, 62, -40);
    branches.lineBetween(-44, -30, -50, -18);
    branches.lineBetween(44, -30, 50, -18);
    // 上枝
    branches.lineStyle(3.5, 0x332415, 0.9);
    branches.lineBetween(0, -24, -14, -54);
    branches.lineBetween(0, -24, 14, -54);
    branches.lineBetween(0, -24, 0, -60);
    container.add(branches);

    // ── 树冠（多层圆形 + 边缘叶簇，更茂密） ──
    const canopy = this.add.graphics();
    // 底层（最深的绿，外轮廓）
    canopy.fillStyle(0x143c0c, 0.95);
    canopy.fillCircle(0, -48, 52);
    canopy.fillCircle(-34, -38, 38);
    canopy.fillCircle(34, -38, 38);
    canopy.fillCircle(-14, -28, 34);
    canopy.fillCircle(14, -28, 34);
    // 中层（主绿）
    canopy.fillStyle(0x1e4e10, 0.9);
    canopy.fillCircle(0, -52, 44);
    canopy.fillCircle(-28, -42, 32);
    canopy.fillCircle(28, -42, 32);
    canopy.fillCircle(-12, -34, 28);
    canopy.fillCircle(12, -34, 28);
    // 亮层（叶簇受光）
    canopy.fillStyle(0x2e6418, 0.85);
    canopy.fillCircle(0, -58, 36);
    canopy.fillCircle(-22, -48, 26);
    canopy.fillCircle(22, -48, 26);
    // 顶层高光（阳光）
    canopy.fillStyle(0x3e7a20, 0.6);
    canopy.fillCircle(0, -64, 24);
    canopy.fillCircle(-14, -54, 16);
    canopy.fillCircle(14, -54, 16);
    canopy.fillStyle(0x508a2a, 0.4);
    canopy.fillCircle(0, -70, 14);
    container.add(canopy);

    // ── 垂下的枝条（树冠边缘） ──
    const vines = this.add.graphics();
    vines.lineStyle(2, 0x2e4a18, 0.7);
    vines.lineBetween(-40, -30, -46, -8);
    vines.lineBetween(-46, -8, -44, 4);
    vines.lineBetween(38, -30, 44, -10);
    vines.lineBetween(44, -10, 42, 2);
    vines.lineBetween(-18, -20, -24, 0);
    container.add(vines);

    // ── 光斑（树叶间隙的阳光） ──
    const light = this.add.graphics();
    light.fillStyle(0xffffcc, 0.18);
    light.fillCircle(-18, -50, 9);
    light.fillCircle(12, -60, 7);
    light.fillCircle(22, -44, 8);
    light.fillCircle(-6, -68, 5);
    container.add(light);

    // ── 树干上的刻痕（小时候林澈刻的，保留） ──
    const mark = this.add.text(0, 0, '✦', {
      fontSize: '8px',
      color: '#8a7a5a',
    }).setOrigin(0.5);
    container.add(mark);

    // 设置深度（树冠高于玩家）
    container.setDepth(8);

    this.oldTree = container;
  }

  /** 老树交互检测 */
  private checkOldTreeInteract(): void {
    if (!this.oldTree || this.mapKey !== 'forest') return;

    const dx = this.player.x - this.oldTreePos.x;
    const dy = this.player.y - this.oldTreePos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 60 && !this.storyDialogue?.isOpen()) {
      this.showOldTreeHint();
    } else {
      this.hideOldTreeHint();
    }
  }

  /** 显示老树交互提示 */
  private showOldTreeHint(): void {
    if (this.oldTreeInteractHint) return;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '180px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffffff', fontSize: '13px',
      background: 'rgba(0,0,0,0.65)', padding: '6px 16px', borderRadius: '6px',
      zIndex: '400', pointerEvents: 'none',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    hint.textContent = isMobileLayout() ? '点击「交互」查看' : '按 [E] 查看';
    hint.classList.add('hint-interact'); // 2026-08-16 兜底清扫标记（hideAllInteractHints 强制移除残留）
    document.body.appendChild(hint);
    this.oldTreeInteractHint = hint;
  }

  /** 隐藏老树交互提示 */
  private hideOldTreeHint(): void {
    if (this.oldTreeInteractHint) {
      this.oldTreeInteractHint.remove();
      this.oldTreeInteractHint = null;
    }
  }

  /** 触发老树交互 */
  private triggerOldTreeInteract(): void {
    if (!this.oldTree || this.mapKey !== 'forest') return;
    if (this.storyDialogue?.isOpen()) return;

    const dx = this.player.x - this.oldTreePos.x;
    const dy = this.player.y - this.oldTreePos.y;
    if (dx * dx + dy * dy > 60 * 60) return;

    // 根据碎片数量和游戏进度显示不同台词
    const shardCount = getItemCount('star_shard');
    const isTutorialDone = getStoryStep() === 'done';
    let lines: { speaker: string; color: string; text: string }[];

    if (shardCount === 0 && !isTutorialDone) {
      // 教程期：第一次见老树
      lines = [
        { speaker: '', color: '#aaaaaa', text: '一棵很老的树。' },
        { speaker: '', color: '#aaaaaa', text: '树干上有一道道刻痕，像是有人在这里留下过痕迹。' },
        { speaker: '', color: '#aaaaaa', text: '（树冠茂密，阳光从叶缝间洒落。）' },
        { speaker: '', color: '#aaaaaa', text: '……不知道为什么，站在这里会觉得很安心。' },
      ];
    } else if (shardCount === 0) {
      // 教程后，未收集碎片
      lines = [
        { speaker: '', color: '#aaaaaa', text: '这棵树比想象中还要老。' },
        { speaker: '', color: '#aaaaaa', text: '树皮上的纹路，像极了爷爷手上的皱纹。' },
        { speaker: '', color: '#aaaaaa', text: '（你伸手摸了摸树干，粗糙但温暖。）' },
        { speaker: '', color: '#aaaaaa', text: '夏雅说，爷爷经常来这里。' },
        { speaker: '', color: '#aaaaaa', text: '……他在看什么？' },
      ];
    } else if (shardCount === 1) {
      lines = [
        { speaker: '', color: '#aaaaaa', text: '你又来了。' },
        { speaker: '', color: '#aaaaaa', text: '树干上的刻痕，有一道特别深——' },
        { speaker: '', color: '#aaaaaa', text: '旁边刻着一个日期，已经模糊了。' },
        { speaker: '', color: '#aaaaaa', text: '（风吹过，树叶沙沙作响。）' },
        { speaker: '', color: '#aaaaaa', text: '……像是有人在说话，但听不清。' },
      ];
    } else if (shardCount === 2) {
      lines = [
        { speaker: '', color: '#aaaaaa', text: '小时候的记忆突然涌上来——' },
        { speaker: '', color: '#aaaaaa', text: '你曾在这棵树下爬上爬下，' },
        { speaker: '', color: '#aaaaaa', text: '爷爷在旁边喊："小心点！"' },
        { speaker: '', color: '#aaaaaa', text: '（树冠沙沙作响，像是在回应你。）' },
        { speaker: '', color: '#aaaaaa', text: '……那道最深的刻痕，是你的身高。' },
        { speaker: '', color: '#aaaaaa', text: '爷爷每年都带你来量一次。' },
      ];
    } else if (shardCount === 3) {
      lines = [
        { speaker: '', color: '#aaaaaa', text: '这棵树，一直站在这里。' },
        { speaker: '', color: '#aaaaaa', text: '他不在了，但树还在。' },
        { speaker: '', color: '#aaaaaa', text: '每年都在长高，每年都在看同样的星星。' },
        { speaker: '', color: '#aaaaaa', text: '（你靠着树干坐下，抬头看穿过树叶的天空。）' },
        { speaker: '', color: '#aaaaaa', text: '……原来他一直在这里。' },
        { speaker: '', color: '#aaaaaa', text: '不是守着什么，只是……想离你近一点。' },
      ];
    } else {
      // 碎片收集完成后的特殊台词
      lines = [
        { speaker: '', color: '#aaaaaa', text: '你站在树下，手里握着星之碎片。' },
        { speaker: '', color: '#aaaaaa', text: '碎片微微发光，像是在回应这棵树。' },
        { speaker: '', color: '#aaaaaa', text: '（树叶开始发光，一片一片，像星星落在枝头。）' },
        { speaker: '', color: '#aaaaaa', text: '……你突然明白了。' },
        { speaker: '', color: '#aaaaaa', text: '爷爷不是在看星星。' },
        { speaker: '', color: '#aaaaaa', text: '他是在等你回来。' },
        { speaker: '', color: '#aaaaaa', text: '（你把碎片放在树根旁，光芒缓缓融入树干。）' },
        { speaker: '', color: '#aaaaaa', text: '……谢谢你，一直在这里等我。' },
      ];
    }

    // RECORD-01 归星录扩展：童年记忆浮现时记录「老树记忆」（幂等 Set，重复触发无副作用）
    if (shardCount >= 2) {
      triggerTag('old_tree_memory');
      // 归星录·相簿：完成「后山老树」→ 解锁《后山观景》（幂等）
      if (!isPhotoUnlocked('hillside_view')) {
        unlockPhoto('hillside_view');
        this.notifyPhotoUnlocked('hillside_view');
      }
    }

    this.hideOldTreeHint();

    this.playStory(lines, undefined, undefined, "")
  }

  /**
   * 创建矿洞矿脉精灵
   * 已开采的矿脉不显示（当日不可重复开采）
   */
  private setupOres(): void {
    this.oreSprites = [];
    for (const deposit of ORE_DEPOSITS) {
      if (isOreMined(deposit.id)) continue;
      const cx = deposit.col * TILE_SIZE + TILE_SIZE / 2;
      const cy = deposit.row * TILE_SIZE + TILE_SIZE / 2;
      // 矿石贴图（32x32，按类型缩放显示：石头 12 / 铜 14 / 铁 16 像素）
      const textureKey = `ore_${deposit.oreType}`;
      const size = deposit.oreType === 'iron' ? 16 : deposit.oreType === 'copper' ? 14 : 12;
      const sprite = this.add.image(cx, cy, textureKey);
      sprite.setScale(size / 32);
      sprite.setDepth(5);
      this.oreSprites.push({ deposit, sprite });

      // 矿石发光效果（微弱脉冲，营造神秘感）
      if (deposit.oreType !== 'stone') {
        const glowColor = deposit.oreType === 'copper' ? 0xffaa66 : 0xaaddff;
        const glow = this.add.circle(cx, cy, size * 0.8, glowColor, 0.3);
        glow.setDepth(4);
        this.tweens.add({
          targets: glow,
          alpha: { from: 0.15, to: 0.4 },
          duration: 1500 + Math.random() * 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }

    // 矿洞环境音效：滴水声 + 远处回响
    if (this.mapKey === 'mine') {
      // 尘埃粒子（缓慢飘落，营造地下氛围）
      for (let i = 0; i < 15; i++) {
        const x = Phaser.Math.Between(32, 30 * TILE_SIZE - 32);
        const y = Phaser.Math.Between(32, 20 * TILE_SIZE - 32);
        const dust = this.add.circle(x, y, Phaser.Math.Between(1, 2), 0xccccaa, 0.4);
        dust.setDepth(15);
        this.tweens.add({
          targets: dust,
          y: y + Phaser.Math.Between(20, 60),
          x: x + Phaser.Math.Between(-15, 15),
          alpha: { from: 0.4, to: 0 },
          duration: Phaser.Math.Between(3000, 6000),
          repeat: -1,
          delay: Phaser.Math.Between(0, 3000),
          onRepeat: () => {
            dust.x = Phaser.Math.Between(32, 30 * TILE_SIZE - 32);
            dust.y = Phaser.Math.Between(32, 20 * TILE_SIZE - 32);
            dust.alpha = 0.4;
          },
        });
      }
    }
  }

  /**
   * 创建程序化占位瓦片纹理（tileset 图片加载失败时兜底，防止黑屏）
   * 14 个瓦片（16x16），简单配色模拟地面/墙/水/树
   */
  private createFallbackTilesTexture(): void {
    if (this.textures.exists('fallback_tiles')) return;
    const tex = this.textures.createCanvas('fallback_tiles', 14 * 16, 16);
    if (!tex) return;
    const ctx = tex.getContext();
    const colors = [
      '#3a5a3a', '#4a6a4a', '#4a4a4a', '#3a3a6a', // 1-4: 地面/深地/石墙/水
      '#5a4a2a', '#8a7a5a', '#6a6a4a', '#2a8a2a', // 5-8: 土壤/木地板/小路/花
      '#2a5a2a', '#2a6a2a', '#2a4a2a', '#1a4a2a', // 9-12: 树
      '#5a4a3a', '#3a3a3a',                        // 13-14: 树桩/矿
    ];
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(i * 16, 0, 16, 16);
    }
    tex.refresh();
  }

  /**
   * 致命错误遮罩（DOM）：场景构建异常时显示，避免黑屏且无任何反馈
   * 提供错误信息 + 刷新按钮，便于用户自救与排查
   */
  private showFatalError(err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    let el = document.getElementById('fatal-error-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fatal-error-overlay';
      el.style.cssText =
        'position:fixed;top:0;right:0;bottom:0;left:0;background:#000;z-index:9999;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'font-family:Arial,sans-serif;text-align:center;padding:20px';
      document.body.appendChild(el);
    }
    el.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = '地图加载出错了';
    title.style.cssText = 'font-size:18px;color:#ffe082;margin-bottom:12px';
    el.appendChild(title);
    const detail = document.createElement('div');
    detail.textContent = msg;
    detail.style.cssText = 'font-size:13px;color:#aaa;max-width:80%;word-break:break-all;margin-bottom:16px';
    el.appendChild(detail);
    const reloadBtn = document.createElement('button');
    reloadBtn.textContent = '刷新页面重试';
    reloadBtn.style.cssText = 'padding:8px 20px;font-size:14px;cursor:pointer';
    reloadBtn.addEventListener('click', () => location.reload());
    el.appendChild(reloadBtn);
  }

  /**
   * M1-2 农场动态氛围（方案 B，v0.6 视觉增强）
   * 零资源纯代码：水塘涟漪 + 花草摆动 + 暖色光斑。
   * 仅 farm 场景调用；纯视觉装饰，不触碰碰撞/存档/出口/玩法逻辑。
   * tween 随场景 shutdown 自动销毁，无需手动清理。
   */
  /**
   * 灯塔"世界回应"远景（2026-08-14 制作人拍板：春日集后远处灯塔亮起）
   * 定位：青禾镇复兴的情绪反馈，不是新地图。触发链：集市恢复 → 春日集完成 → 首次进 farm。
   * 视觉：屏幕固定（scrollFactor 0）远处灯塔——塔身剪影 + 灯室暖光呼吸 + 旋转光束。
   * 状态：markRestored('lighthouseLit') 持久化（常驻亮灯）；triggerOnce('lighthouse_lit_seen') 一次性首映台词。
   * 不拆石墙 / 不开放入口（exits.ts 仍 locked）——灯塔现在是"这个世界正在回来"的灯。
   */
  private setupLighthouseDistant(): void {
    if (this.mapKey !== 'farm') return;
    if (!isRestored('marketSquare')) return;   // 前置：集市恢复
    if (!hasTriggered('ch1_spring_fair')) return; // 前置：春日集完成
    // 灯塔远景：屏幕固定（scrollFactor 0）在画面左上角——"西边远处地平线上的灯塔"。
    // 玩家在 farm 任何位置都能看到远处灯塔亮起（制作人：春日集后远处灯塔亮，不开放入口）。
    // 注意：Phaser scrollFactor 0 元素渲染于 (worldX - scroll*0) * zoom = worldX * zoom，
    // 容器 (110,100) → 屏幕 (220,200)；塔身高 84 → 塔顶屏幕 y = (100-84)*2 = 32，完整可见。
    const c = this.add.container(110, 100).setScrollFactor(0).setDepth(160);
    // 塔身剪影（深蓝紫）
    const tower = this.add.graphics();
    tower.fillStyle(0x3a4460, 1);
    tower.fillRect(-9, -72, 18, 72);      // 塔身
    tower.fillRect(-14, -84, 28, 14);     // 塔顶
    tower.fillStyle(0x2a3450, 1);
    tower.fillRect(-12, -14, 24, 14);     // 塔基
    c.add(tower);
    // 塔身微光
    const edge = this.add.graphics();
    edge.fillStyle(0x5a6888, 0.8);
    edge.fillRect(-9, -72, 4, 72);
    c.add(edge);
    // 灯室（暖黄实色，呼吸）
    const lamp = this.add.ellipse(0, -62, 20, 20, 0xffd98a, 0.95);
    c.add(lamp);
    this.tweens.add({
      targets: lamp,
      alpha: { from: 0.6, to: 1.0 },
      scaleX: { from: 0.85, to: 1.2 }, scaleY: { from: 0.85, to: 1.2 },
      duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    // 光晕（暖黄扩散，ADD 混合发光）
    const glow = this.add.ellipse(0, -62, 90, 90, 0xffd98a, 0.3);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    c.add(glow);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.18, to: 0.4 }, scaleX: { from: 0.9, to: 1.3 }, scaleY: { from: 0.9, to: 1.3 },
      duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    // 旋转光束
    const beam = this.add.graphics();
    c.add(beam);
    const beamAngle = { a: -0.6 };
    this.tweens.add({
      targets: beamAngle, a: 0.9,
      duration: 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      onUpdate: () => {
        beam.clear();
        beam.fillStyle(0xffd98a, 0.16);
        const len = 110;
        beam.fillTriangle(
          Math.cos(beamAngle.a) * 8, -62 + Math.sin(beamAngle.a) * 8,
          Math.cos(beamAngle.a + 0.1) * len, -62 + Math.sin(beamAngle.a + 0.1) * len,
          Math.cos(beamAngle.a - 0.1) * len, -62 + Math.sin(beamAngle.a - 0.1) * len,
        );
      },
    });
    // 灯光持久化：markRestored('lighthouseLit')（世界常驻，读档保持亮灯）
    if (!isRestored('lighthouseLit')) {
      markRestored('lighthouseLit');
      save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    }
    // 首映台词（一次性）：镇长"西边的灯塔…又亮起来了"
    if (!hasTriggered('lighthouse_lit_seen')) {
      triggerOnce('lighthouse_lit_seen', () => {
        this.time.delayedCall(800, () => {

          this.playStory([
            { speaker: '镇长', color: '#c8b898', text: '西边的灯塔……' },
            { speaker: '', color: '#aaaaaa', text: '（远处，海平线上那盏灯，好像亮了一下。）' },
            { speaker: '镇长', color: '#c8b898', text: '我还以为，它再也不会亮了。' },
            { speaker: '', color: '#aaaaaa', text: '（你往西边望了望。去灯塔的路，还堵着。）' },
          ], () => this.updateHUD());
        });
        save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
      });
    }
  }

  /**
   * 农场环境氛围：委托给 FarmController
   */
  private setupFarmAmbience(): void {
    this.farmController.setupFarmAmbience();
  }

  /**
   * 农场西侧海湾（2026-08-10 制作人方案：灯塔岛在农场西边）已撤除（2026-08-11 制作人反馈"灯塔影子效果不好"）。
   * 现状：farm.json Walls 层 rows 10-13 / col0 石墙已补回，西侧缺口完全堵住，灯塔远景不再可见；
   *      locked 出口（exits.ts）保留，未来开放时移除 locked + 打通石墙 + 重建海湾视觉。
   * 未来恢复点（见 docs/design/灯塔未来内容预埋方案-v1.0.md）：
   *   1. farm.json Walls 层 rows 10-13 / col0 恢复 0（打通缺口）
   *   2. 重建本方法（海面/浪花/沙滩/灯塔剪影/碰撞墙/夜星月光）——灯室点亮用 night ? 0.75 : 0 + 呼吸 + 光束
   *   3. exits.ts farm 西侧海湾出口移除 locked → 玩家可走进灯塔
   */

  /**
   * 镇长家室内氛围（视觉升级，零资源纯代码）
   * 暖炉辉光 + 浮尘微光 + 门口柔光，呼应"家"的温暖感。
   * 仅 elder_house 场景调用；纯视觉装饰，不触碰碰撞/存档/出口/玩法逻辑。
   * 辉光中心 (6T, 5T) 位于家具核心区（rows 4-5, cols 4-7），镇长站位 (88,88) 在前方不受影响。
   */
  private setupElderHouseAmbience(): void {
    const T = TILE_SIZE;
    this.ensureWhiteTexture();

    // 1) 暖炉辉光：大暖光晕呼吸脉动 + 内层火光核心（更暖更亮，模拟炉火）
    const cx = 6 * T;  // 96
    const cy = 5 * T;  // 80
    this.elderHouseGlow = this.add.ellipse(cx, cy, T * 5, T * 5, 0xffb866, 0.16);
    this.elderHouseGlow.setDepth(2);
    this.tweens.add({
      targets: this.elderHouseGlow,
      scale: 1.12,
      alpha: 0.07,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const core = this.add.ellipse(cx, cy, T * 2.2, T * 2.2, 0xffd9a0, 0.2);
    core.setDepth(2);
    this.tweens.add({
      targets: core,
      scale: { from: 0.85, to: 1.15 },
      alpha: { from: 0.2, to: 0.11 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 2) 浮尘微光：室内中央缓慢漂移的金色尘埃（ADD 叠加，极低透明度）
    this.elderHouseDust = this.add.particles(6 * T, 4.5 * T, '__WHITE', {
      lifespan: 2600,
      speedY: { min: -12, max: -4 },
      speedX: { min: -8, max: 8 },
      quantity: 1,
      frequency: 500,
      blendMode: 'ADD',
      alpha: { start: 0.22, end: 0 },
      scale: { start: 0.3, end: 0.12 },
      tint: 0xffe9b0,
    });
    this.elderHouseDust.setDepth(3);

    // 3) 门口柔光：门口（rows 7-8, cols 5-6）暖光，呼应底部出口箭头
    this.elderHouseDoorGlow = this.add.ellipse(5.5 * T, 7.5 * T, T * 3, T * 3, 0xfff3c4, 0.1);
    this.elderHouseDoorGlow.setDepth(2);
    this.tweens.add({
      targets: this.elderHouseDoorGlow,
      alpha: 0.04,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * 青禾镇氛围（视觉升级，零资源纯代码）
   * 炊烟（4 栋民居屋顶升烟）+ 窗灯（8 扇窗户暖光，傍晚/清晨亮起）+ 落叶（道路行道树）。
   * 仅 town 场景调用；纯视觉装饰，不触碰碰撞/存档/出口/玩法逻辑。
   * 位置已核对 town Walls 层：烟囱在屋顶上方空地、窗灯在 gid12 窗格、落叶在两棵 gid16 树上。
   */
  private setupTownAmbience(): void {
    const T = TILE_SIZE;
    this.ensureWhiteTexture();

    // 1) 炊烟：4 栋民居屋顶缓缓升烟（灰白低透明度，NORMAL 混合不发光）
    // 2026-08-12 Chapter1 P0-0：town 30x20 → 50x35，坐标随内容平移 dx=10T dy=8T
    const chimneys: Array<[number, number]> = [
      [16 * T, 10.5 * T],   // 左上屋
      [32 * T, 10.5 * T],   // 右上屋
      [16 * T, 19.5 * T],   // 左下屋
      [32 * T, 19.5 * T],   // 右下屋
    ];
    chimneys.forEach(([x, y]) => {
      const p = this.add.particles(x, y, '__WHITE', {
        lifespan: 2400,
        speedY: { min: -26, max: -12 },
        speedX: { min: -5, max: 5 },
        quantity: 1,
        frequency: 1400,
        alpha: { start: 0.3, end: 0 },
        scale: { start: 0.35, end: 0.95 },
        tint: 0xbfc4c8,
      });
      p.setDepth(3);
      this.townSmoke.push(p);
    });

    // 2) 窗灯：8 扇窗户暖光，傍晚(≥18时)/清晨(<6时)亮起，白天零创建（零开销）
    const t = getTime();
    if (t.hour >= 18 || t.hour < 6) {
      const windows: Array<[number, number]> = [
        [15 * T + 8, 14 * T + 8],  [18 * T + 8, 14 * T + 8],   // 左上屋
        [31 * T + 8, 14 * T + 8], [34 * T + 8, 14 * T + 8],  // 右上屋
        [15 * T + 8, 23 * T + 8], [18 * T + 8, 23 * T + 8],  // 左下屋
        [31 * T + 8, 23 * T + 8], [34 * T + 8, 23 * T + 8], // 右下屋
      ];
      windows.forEach(([x, y]) => {
        const w = this.add.ellipse(x, y, 18, 18, 0xffcc88, 0.14);
        w.setDepth(2);
        this.tweens.add({
          targets: w,
          scale: 1.18,
          alpha: 0.08,
          duration: 1300 + Math.random() * 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.townWindows.push(w);
      });
    }

    // 3) 落叶：道路上方两棵行道树（Walls gid16）飘落绿叶（旋转 + 飘移）
    // 2026-08-12 Chapter1 P0-0：town 30x20 → 50x35，坐标随内容平移 dx=10T dy=8T
    const trees: Array<[number, number]> = [
      [21 * T + 8, 11 * T + 8],
      [28 * T + 8, 11 * T + 8],
    ];
    trees.forEach(([x, y]) => {
      const p = this.add.particles(x, y, '__WHITE', {
        lifespan: 3200,
        speedY: { min: 14, max: 34 },
        speedX: { min: -18, max: 18 },
        gravityY: 12,
        quantity: 1,
        frequency: 1000,
        alpha: { start: 0.85, end: 0.15 },
        scale: { start: 0.38, end: 0.2 },
        tint: 0x7ec850,
        rotate: { start: 0, end: 200 },
      });
      p.setDepth(4);
      this.townLeaves.push(p);
    });

    // 青禾镇生活化升级（P1）：生活杂物 / 小动物 / 晨雾 / 夜间萤火虫
    this.setupTownDecorations();
  }

  /**
   * Phase 2 衰败态叙事物件补完（2026-08-13，青禾镇舞台块定义-v1.0.md S1/S2/S4 初始状态）
   * 瓦片无法精表达的"衰败态细节"用纯代码 Graphics 补充（零资源，路线 C 不扩 tileset）：
   *   S1 镇门：歪斜"青禾镇"木牌（第一眼记忆点——褪色匾额，立在竖路西侧墙边）
   *   S2 老街：空招牌（木杆 + 空木板，无文字——"以前有店"）
   *   S4 旧宅：院内瓦砾堆（残垣根部的碎石）
   * 深度 3（与生活杂物一致，玩家 depth=10 可自然覆盖）；计入 townLife.decor。
   * 纯视觉装饰：不触碰碰撞/存档/出口/玩法逻辑；场景 shutdown 自动销毁。
   */
  private setupTownPhase2Details(): void {
    if (this.mapKey !== 'town') return;
    const T = TILE_SIZE;
    const px = (c: number, r: number): [number, number] => [c * T + T / 2, r * T + T / 2];

    // ---- S1 镇门：歪斜"青禾镇"木牌（褪色感：低饱和棕 + 深色描边 + 褪色字迹刻痕）----
    {
      const [x, y] = px(22, 26);
      const g = this.add.graphics();
      // 斜插木桩（加粗加高，站得住）
      g.fillStyle(0x5b4226, 1);
      g.fillRect(x - 2.5, y - 1, 4, 12);
      // 歪斜木板（平行四边形，左高右低，加大到 26×16）
      g.fillStyle(0x8a6b3f, 0.95);
      g.fillTriangle(x - 13, y - 16, x + 13, y - 18, x + 13, y - 6);
      g.fillTriangle(x - 13, y - 16, x - 13, y - 6, x + 13, y - 6);
      g.lineStyle(1.5, 0x5b4226, 0.8);
      g.strokeTriangle(x - 13, y - 16, x + 13, y - 18, x + 13, y - 6);
      g.strokeTriangle(x - 13, y - 16, x - 13, y - 6, x + 13, y - 6);
      // 褪色"青禾镇"字迹（两行短刻痕，模拟旧匾额残留字）
      g.lineStyle(1.5, 0x6e4a26, 0.5);
      g.lineBetween(x - 9, y - 13, x - 3, y - 13.6);
      g.lineBetween(x + 1, y - 13.8, x + 8, y - 14.4);
      g.lineBetween(x - 9, y - 9.5, x - 2, y - 10.1);
      g.lineBetween(x + 1, y - 10.3, x + 8, y - 10.9);
      g.setDepth(3);
      this.townLife.decor++;
    }

    // ---- S2 老街：空招牌（木杆 + 空木板，无文字——"以前有店"）----
    {
      const [x, y] = px(37, 2);
      const g = this.add.graphics();
      // 木杆（加高，招牌立得住）
      g.fillStyle(0x6e5633, 1);
      g.fillRect(x - 1.5, y - 12, 3.5, 15);
      // 空木牌（微斜，加大到 22×11）
      g.fillStyle(0x9a7a4a, 0.95);
      g.fillTriangle(x - 11, y - 12, x + 11, y - 13.5, x + 11, y - 4.5);
      g.fillTriangle(x - 11, y - 12, x - 11, y - 4.5, x + 11, y - 4.5);
      g.lineStyle(1.5, 0x5b4226, 0.8);
      g.strokeTriangle(x - 11, y - 12, x + 11, y - 13.5, x + 11, y - 4.5);
      g.strokeTriangle(x - 11, y - 12, x - 11, y - 4.5, x + 11, y - 4.5);
      // 空木牌上的钉孔（两颗锈钉印）
      g.fillStyle(0x3f2f1c, 0.9);
      g.fillCircle(x - 7, y - 10.5, 1.2);
      g.fillCircle(x + 6, y - 11.5, 1.2);
      g.setDepth(3);
      this.townLife.decor++;
    }

    // ---- S2 老街：残破摊架（"以前有店"——门口歪倒的旧货架）----
    {
      const [x, y] = px(31, 6);
      const g = this.add.graphics();
      // 两条歪斜木腿
      g.fillStyle(0x6e5633, 1);
      g.fillRect(x - 6, y - 5, 2.5, 9);
      g.fillRect(x + 4, y - 7, 2.5, 10);
      // 斜搭的破木板
      g.fillStyle(0x8a6b3f, 0.95);
      g.fillTriangle(x - 8, y - 5, x + 8, y - 8, x + 8, y - 2);
      g.fillTriangle(x - 8, y - 5, x - 8, y - 2, x + 8, y - 2);
      g.lineStyle(1, 0x5b4226, 0.8);
      g.strokeTriangle(x - 8, y - 5, x + 8, y - 8, x + 8, y - 2);
      g.strokeTriangle(x - 8, y - 5, x - 8, y - 2, x + 8, y - 2);
      g.setDepth(3);
      this.townLife.decor++;
    }

    // ---- S2 老街：歪倒木桶（路边遗弃物）----
    {
      const [x, y] = px(39, 7);
      const g = this.add.graphics();
      g.fillStyle(0x7a5a33, 1);
      g.fillRoundedRect(x - 4, y - 3, 8, 7, 2);
      g.lineStyle(1, 0x4c3618, 0.9);
      g.strokeRoundedRect(x - 4, y - 3, 8, 7, 2);
      // 桶箍两道
      g.lineStyle(1.5, 0x5b4226, 0.8);
      g.lineBetween(x - 4, y - 1, x + 4, y - 1);
      g.lineBetween(x - 4, y + 2, x + 4, y + 2);
      g.setDepth(3);
      this.townLife.decor++;
    }

    // ---- S4 旧宅：院内瓦砾堆（残垣根部碎石）----
    {
      const [x, y] = px(23, 30);
      const g = this.add.graphics();
      g.fillStyle(0x9a9aa2, 1);
      g.fillRect(x - 6, y + 2, 5, 3);
      g.fillRect(x + 1, y + 3, 4, 3);
      g.fillRect(x - 2, y + 1, 3, 2);
      g.fillStyle(0xb8b8c0, 0.7);
      g.fillRect(x - 5, y + 1, 2, 2);
      g.setDepth(3);
      this.townLife.decor++;
    }

    // ---- S4 旧宅：院门口瓦砾 + 乱草（墙外可见，俯视不被屋顶遮挡）----
    {
      const [x, y] = px(24, 33);
      const g = this.add.graphics();
      g.fillStyle(0x9a9aa2, 1);
      g.fillRect(x - 4, y - 1, 4, 3);
      g.fillRect(x + 1, y, 3, 2);
      g.fillStyle(0xb8b8c0, 0.7);
      g.fillRect(x - 3, y - 2, 2, 2);
      // 乱草几丛
      g.fillStyle(0x6a8a3a, 0.9);
      g.fillTriangle(x - 8, y + 2, x - 5, y - 2, x - 2, y + 2);
      g.fillTriangle(x + 4, y + 2, x + 7, y - 1, x + 10, y + 2);
      g.setDepth(3);
      this.townLife.decor++;
    }
  }

  /**
   * Phase 3 修复态 GameObjects（2026-08-13，青禾镇Phase3美术升级-拍板基线-v1.0.md §六）
   * 路线 C：不扩 tileset，修复态用独立 sprite（增删切换，不碰 tile）。
   * 触发条件（对照 §六 施工清单，只绑定已实现的游戏状态，避免"任务提前投放"）：
   *   S1 镇门路灯（P0-1）：村长来访 ch1_elder_visit 后点亮 ——"有人在修了"
   *   S2 老街招牌/窗灯/花坛（P0-2/P1-1/P1-2）：集市恢复 marketSquare 后 ——"以前很热闹"
   *   S6 河堤长椅（P0-3）：常驻（制作人 P0 优先级=现在就有的停留点）+ 夜晚灯光
   *   S4 老屋灯亮/花坛：暂不挂 —— 四阶段修复任务未实现，提前亮灯破坏"被遗忘感"（§六 灯亮=阶段④）
   * 纯视觉装饰：不触碰碰撞/存档/出口/玩法逻辑；场景 shutdown 自动销毁。
   * 所有挂载对象记入 phase3Objects（探针验证数量/位置/显隐）。
   */
  private setupPhase3Restoration(): void {
    if (this.mapKey !== 'town') return;
    const T = TILE_SIZE;
    const px = (c: number, r: number): [number, number] => [c * T + T / 2, r * T + T / 2];
    const t = getTime();
    const isNight = t.hour >= 18 || t.hour < 6;
    const track = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.phase3Objects.push(o);
      return o;
    };
    const warmGlow = (x: number, y: number, r: number, a: number): void => {
      const g = track(this.add.ellipse(x, y, r, r, 0xffd98a, a));
      g.setDepth(2);
      this.tweens.add({
        targets: g,
        alpha: a * 0.45,
        scale: 1.15,
        duration: 1400 + Math.random() * 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    };

    // ---- S1 镇门遗址：路灯点亮（P0-1，村长来访后）----
    if (hasTriggered('ch1_elder_visit')) {
      const [x, y] = px(22, 27); // 坏路灯基座（Walls 22,27 gid13）
      const lamp = track(this.add.image(x, y, 'spr_lamp'));
      lamp.setOrigin(0.5, 1).setPosition(x, y).setDepth(3);
      warmGlow(x, y - 38, T * 3.2, 0.22);
    }

    // ---- S2 老街·记忆街：招牌挂回 + 窗灯亮 + 路侧花坛（集市恢复后）----
    if (isRestored('marketSquare')) {
      // 招牌挂回：老街屋墙 (35,3)（"这里曾经有生活"）
      const [sx, sy] = px(35, 3);
      const sign = track(this.add.image(sx, sy, 'spr_sign'));
      sign.setOrigin(0.5, 1).setPosition(sx, sy).setDepth(3);
      // 窗灯亮：空窗格 (34,4) gid12（"有人回来"）
      // 2026-08-14 缩放修复：原图 47×48 未缩放 ≈ 3 瓦片宽，视觉过大（用户反馈"缩放异常"）；
      // 窗灯应为 1.5-2 瓦片宽 → scale 0.62 ≈ 29px。
      const [wx, wy] = px(34, 4);
      const win = track(this.add.image(wx, wy, 'spr_window'));
      win.setOrigin(0.5, 0.5).setPosition(wx, wy).setScale(0.62).setDepth(4);
      // 路侧花坛：(33,6)（"有人生活"）
      // 2026-08-14 缩放修复：原图 61×32 未缩放 ≈ 4 瓦片宽，视觉过大（用户反馈"花坛没缩放"）；
      // 花坛应为 2-2.5 瓦片宽 → scale 0.65 ≈ 40px。
      const [fx, fy] = px(33, 6);
      const flower = track(this.add.image(fx, fy, 'spr_flowerbed'));
      flower.setOrigin(0.5, 0.5).setPosition(fx, fy).setScale(0.65).setDepth(3);
    }

    // ---- S6 老河堤：长椅常驻（P0-3）+ 夜晚灯光 ----
    {
      // 长椅：岸线 (6,15) 面水（"愿意坐下来的地方"）
      // 2026-08-14 位置调整：原 (5,15) 在最左列，紧贴地图边缘被裁切（用户反馈"凳子太靠左"）；
      // 右移一列到 (6,15)，仍面水、贴近河岸，但避开边缘裁切。
      const [bx, by] = px(6, 15);
      const bench = track(this.add.image(bx, by, 'spr_bench'));
      bench.setOrigin(0.5, 1).setPosition(bx, by).setScale(0.85).setDepth(3);
      if (isNight) {
        // 夜晚灯光（暖黄）
        const [sx, sy] = px(5, 11);
        const lamp = track(this.add.image(sx, sy, 'spr_lamp'));
        lamp.setOrigin(0.5, 1).setPosition(sx, sy).setDepth(3);
        warmGlow(sx, sy - 38, T * 3, 0.2);
      }
    }
  }

  /**
   * 青禾镇生活化升级（零资源纯代码，视觉方案 v0.10+ P1）。
   * 1) 生活杂物层：木柴/花盆/水桶/木箱/小推车/晾衣架/石凳/扫帚/路边石/草丛
   * 2) 小动物活动点：2 只小鸟固定小范围活动（复用蝴蝶 tween 模式）
   * 3) 晨雾（06-09 时）/ 夜间萤火虫（≥18 时或 <6 时，复用 forest 参数）
   * 坐标已核对 town Walls/Ground 层（30x20）+ NPC 站位 + 出口：
   *   四角房屋（col4-9/19-25 各 rows3-7、12-16）、行道树（col10-11/14、rows3-5）、
   *   中央广场 NPC 区（col12-18、rows8-12）、出口（左 col0-2 row9-11 / 顶 col14-16 row0-2 /
   *   右下 col18-20 row12-14）均避开。
   * 纯视觉装饰：不触碰碰撞/存档/出口/玩法逻辑；场景 shutdown 自动销毁。
   */
  private setupTownDecorations(): void {
    const T = TILE_SIZE;
    const px = (c: number, r: number): [number, number] => [c * T + T / 2, r * T + T / 2];
    const t = getTime();
    // 2026-08-14 镇子杂物 sprite 替换：AI 出图 → 抠图入库的 decor_* sprite 替代原 Graphics 绘制。
    // 存在 sprite 时用 sprite（精致像素），缺失时 fallback 到下方 Graphics 兜底。
    const decorSprite = (c: number, r: number, key: string, originY = 1, scale = 1, depth = 3): boolean => {
      if (!this.textures.exists(key)) return false;
      const [x, y] = px(c, r);
      const img = this.add.image(x, y, key);
      img.setOrigin(0.5, originY).setScale(scale).setDepth(depth);
      this.townLife.decor++;
      return true;
    };

    // ---- 1) 生活杂物层（深度 3，位于角色之下）----
    // 2026-08-07 GPT 诊断落地 P0-1：木柴/晾衣架/水桶为核心大锚点，放大 1.5~2x 提升视觉权重
    const woodpile = (c: number, r: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x8a6a45, 1);
      g.fillRoundedRect(x - 9, y + 2, 18, 5, 1.5);
      g.fillRoundedRect(x - 7, y - 3, 15, 5, 1.5);
      g.fillRoundedRect(x - 5, y - 8, 12, 5, 1.5);
      g.fillStyle(0xa8835a, 1);
      g.fillCircle(x - 4, y - 7, 2);
      g.fillCircle(x + 3, y - 3, 2);
      g.fillCircle(x + 6, y + 2, 2);
      g.setDepth(3);
      this.townLife.decor++;
    };
    const pot = (c: number, r: number, color: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x8c5a3c, 1);
      g.fillRect(x - 3, y - 1, 6, 4);
      g.fillRect(x - 4, y - 2, 8, 2);
      g.fillStyle(0x3a6a20, 1);
      g.fillRect(x - 0.5, y - 4, 1, 3);
      g.fillStyle(color, 1);
      g.fillCircle(x - 2, y - 4, 1.8);
      g.fillCircle(x + 2, y - 5, 1.8);
      g.fillCircle(x, y - 6, 1.6);
      g.setDepth(3);
      this.townLife.decor++;
    };
    const bucket = (c: number, r: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x5a6a78, 1);
      g.fillRect(x - 4, y - 3, 8, 7);
      g.lineStyle(1, 0x8a9aa8, 1);
      g.strokeRect(x - 4, y - 3, 8, 7);
      g.lineBetween(x - 4, y - 3, x, y - 8);
      g.lineBetween(x + 4, y - 3, x, y - 8);
      g.setDepth(3);
      this.townLife.decor++;
    };
    const crate = (c: number, r: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x9a7a4a, 1);
      g.fillRect(x - 5, y - 4, 10, 8);
      g.lineStyle(1, 0x6e5633, 1);
      g.strokeRect(x - 5, y - 4, 10, 8);
      g.lineBetween(x - 5, y - 4, x + 5, y + 4);
      g.lineBetween(x + 5, y - 4, x - 5, y + 4);
      g.setDepth(3);
      this.townLife.decor++;
    };
    const cart = (c: number, r: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x7a5a38, 1);
      g.fillRect(x - 6, y - 3, 9, 5);
      g.fillStyle(0x5a4028, 1);
      g.fillCircle(x - 4, y + 3, 2.2);
      g.fillCircle(x + 2, y + 3, 2.2);
      g.lineStyle(1.5, 0x7a5a38, 1);
      g.lineBetween(x + 3, y - 2, x + 7, y - 5);
      g.fillStyle(0x8a6a45, 1);
      g.fillRect(x + 5, y - 7, 2, 2);
      g.setDepth(3);
      this.townLife.decor++;
    };
    const clothesline = (c: number, r: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x6e5633, 1);
      g.fillRect(x - T - 1, y - 9, 3, 12);
      g.fillRect(x + T - 1, y - 9, 3, 12);
      g.lineStyle(1.5, 0x555555, 1);
      g.lineBetween(x - T, y - 7, x + T, y - 6);
      g.fillStyle(0xcfe0e8, 1);
      g.fillRect(x - T + 5, y - 9, 8, 7);
      g.fillStyle(0xe8a0a0, 1);
      g.fillRect(x - 6, y - 8, 6, 7);
      g.fillStyle(0xd0e8a0, 1);
      g.fillRect(x + T - 10, y - 7, 5, 8);
      g.setDepth(3);
      this.townLife.decor++;
    };
    const stool = (c: number, r: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x8a6a45, 1);
      g.fillRect(x - 4, y - 1, 8, 2);
      g.fillRect(x - 3, y + 1, 1.5, 4);
      g.fillRect(x + 1.5, y + 1, 1.5, 4);
      g.setDepth(3);
      this.townLife.decor++;
    };
    const broom = (c: number, r: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.lineStyle(1.5, 0x8a6a45, 1);
      g.lineBetween(x, y + 5, x + 2, y - 4);
      g.fillStyle(0xc9a86a, 1);
      g.fillRect(x - 1.5, y + 3, 5, 3);
      g.setDepth(3);
      this.townLife.decor++;
    };
    const stone = (c: number, r: number, s: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x9a9aa2, 1);
      g.fillCircle(x, y, s);
      g.fillStyle(0xb8b8c0, 0.6);
      g.fillCircle(x - s * 0.3, y - s * 0.3, s * 0.4);
      g.setDepth(3);
      this.townLife.decor++;
    };
    const grass = (c: number, r: number, tone: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      for (let i = -2; i <= 2; i += 2) {
        g.lineStyle(1, tone, 0.9);
        g.lineBetween(x + i - 1, y + 2, x + i, y - 2);
        g.lineBetween(x + i + 1, y + 2, x + i, y - 2);
      }
      g.setDepth(3);
      this.townLife.decor++;
    };

    // 2026-08-12 Chapter1 P0-0：town 30x20 → 50x35，装饰坐标随内容平移 dx=10列 dy=8行
    // 2026-08-14 减负整理：同类杂物去重（每种保留 1 处叙事锚点，消除堆砌感）；
    // 路边石/草丛稀疏化（"一个地方一个记忆点"，见 Phase3 拍板基线 §五 设计哲学）。
    // 2026-08-14 资产精修：优先用 AI sprite（decor_*），缺失时 fallback 到 Graphics 绘制。
    decorSprite(12, 12, 'decor_woodpile') || woodpile(12, 12);                              // 木柴堆：左上屋左侧
    decorSprite(20, 15, 'decor_pot') || pot(20, 15, 0xf0d080);
    decorSprite(13, 21, 'decor_pot', 1, 0.85) || pot(13, 21, 0xc0a0e8);  // 花盆 ×2（广场边 + 左下屋前）
    decorSprite(12, 13, 'decor_bucket') || bucket(12, 13);                                // 水桶：左上屋旁
    decorSprite(21, 12, 'decor_crate') || crate(21, 12);                                 // 木箱：广场北侧
    decorSprite(38, 12, 'decor_cart') || cart(38, 12);                                  // 小推车：右上屋旁（老街生活感）
    decorSprite(13, 16, 'decor_clothesline') || clothesline(13, 16);                           // 晾衣架：左上屋南
    decorSprite(33, 16, 'decor_stool') || stool(33, 16);                                 // 石凳（右上屋南侧广场边）
    decorSprite(36, 22, 'decor_broom') || broom(36, 22);                                 // 扫帚（右下屋旁）
    stone(15, 17, 2.5); stone(39, 14, 2.5);        // 路边石 ×2（Graphics 兜底）
    decorSprite(15, 17, 'decor_rock') || stone(15, 17, 2.5);
    decorSprite(39, 14, 'decor_rock', 1, 0.9) || stone(39, 14, 2.5);
    grass(11, 18, 0x4a8a30); grass(27, 17, 0x4a8a30);
    grass(23, 27, 0x5a9a3a);                        // 草丛 ×3（稀疏点缀）
    decorSprite(11, 18, 'decor_grass') || grass(11, 18, 0x4a8a30);
    decorSprite(27, 17, 'decor_grass', 1, 0.85) || grass(27, 17, 0x4a8a30);
    decorSprite(23, 27, 'decor_grass', 1, 0.9) || grass(23, 27, 0x5a9a3a);

    // ---- 2) 小动物（2026-08-07 GPT 诊断落地 P1-3：一次性事件 > 持续低频动画）----
    // 鸟：从树冠飞起 → 落到屋顶（一次性飞落，进图即发生，比无限 hover 更易被注意到）
    const birdFly = (fromX: number, fromY: number, toX: number, toY: number, delay: number): void => {
      const b = this.add.graphics();
      b.fillStyle(0x5a6a78, 1);
      b.fillEllipse(0, 0, 8, 6);
      b.fillStyle(0x8a9aa8, 1);
      b.fillCircle(-3, 0, 2);
      b.fillStyle(0xe8a030, 1);
      b.fillTriangle(-4.5, -1.5, -6.5, 0.5, -4.5, 1.5);
      b.fillStyle(0x202020, 0.9);
      b.fillCircle(-3.5, -0.5, 0.6);
      b.fillStyle(0x6e7a88, 1);
      b.fillEllipse(2, 1, 5, 3);
      const c = this.add.container(fromX, fromY, [b]);
      c.setDepth(4);
      // 原地扑翼 0.8s（起飞前），再弧线飞落到屋顶，落定后低频扑翼
      this.tweens.add({ targets: b, scaleY: { from: 1, to: 0.6 }, duration: 130, yoyo: true, repeat: -1, delay });
      this.tweens.add({
        targets: c, x: toX, y: toY,
        duration: 1600, delay: delay + 800, ease: 'Quad.easeOut',
        onComplete: () => {
          // 落定后低频扑翼（不再移动，成为"栖息"状态）
          this.tweens.add({ targets: b, scaleY: { from: 1, to: 0.7 }, duration: 200, yoyo: true, repeat: -1, delay: 1200 });
        },
      });
      this.townLife.wildlife++;
    };
    // 顶部树 → 左上屋顶；广场南树 → 左下屋顶（2026-08-12 平移 dx=10T dy=8T）
    birdFly(22 * T + 8, 11 * T + 8, 16 * T + 8, 10.5 * T + 8, 0);
    birdFly(26 * T + 8, 11 * T + 8, 32 * T + 8, 10.5 * T + 8, 900);

    // 猫：屋角静坐，玩家靠近（≤40px）触发尾巴摆动 + 起身（一次性事件，幂等）
    const cat = (c: number, r: number, key: string): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      // 身体（坐姿）
      g.fillStyle(0x6a5a48, 1);
      g.fillEllipse(0, 2, 10, 8);
      // 头
      g.fillCircle(0, -4, 4.5);
      // 耳
      g.fillTriangle(-4, -8, -3, -11, -1, -8);
      g.fillTriangle(4, -8, 3, -11, 1, -8);
      // 眼（两点）
      g.fillStyle(0xd8e8c0, 1);
      g.fillCircle(-1.5, -4.5, 0.9);
      g.fillCircle(1.5, -4.5, 0.9);
      // 尾（垂在身侧，可摆）
      g.lineStyle(1.5, 0x6a5a48, 1);
      g.lineBetween(6, 4, 9, 0);
      const c2 = this.add.container(x, y, [g]);
      c2.setDepth(4);
      this.townLife.wildlife++;
      // 玩家靠近检测（update 中轮询，见 update()）
      (c2 as unknown as { _catKey: string })._catKey = key;
      this.townCats.push(c2 as unknown as Phaser.GameObjects.Container & { _catKey: string });
    };
    cat(17, 14, 'c1');   // 左上屋墙角（2026-08-12 平移 dx=10 dy=8）
    cat(35, 22, 'c2'); // 右下屋墙角

    // ---- 2.5) 前景遮挡层（2026-08-07 GPT 诊断落地 P0-2）----
    // 前景草丛/杂物盖住角色脚部，制造"被环境包围"的遮挡感（depth 6 > 角色 5）。
    // 这是像素游戏"高级感"的主要来源：不是素材多，而是遮挡关系。
    const fgGrass = (c: number, r: number, tone: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      for (let i = -3; i <= 3; i += 2) {
        g.lineStyle(2, tone, 1);
        g.lineBetween(x + i - 1, y + 3, x + i, y - 1);
        g.lineBetween(x + i + 1, y + 3, x + i, y - 1);
      }
      g.setDepth(6); // 前景：盖住角色
      this.townLife.decor++;
    };
    const fgRock = (c: number, r: number, s: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x8a8a92, 1);
      g.fillCircle(x, y + 2, s);
      g.fillStyle(0xa8a8b0, 0.6);
      g.fillCircle(x - s * 0.3, y + 1, s * 0.4);
      g.setDepth(6);
      this.townLife.decor++;
    };
    // 放置：道路两侧 + 出口附近的遮挡（避开 NPC 站位与交互点）（2026-08-12 平移 dx=10列 dy=8行）
    // 2026-08-14 减负整理：前景遮挡从 8→4，只保留出口/路口关键遮挡，避免视觉压迫。
    fgGrass(13, 20, 0x3a7a28); fgGrass(37, 23, 0x4a8a30);
    fgGrass(11, 19, 0x3a7a28);                       // 出口附近
    fgRock(14, 19, 2.5);
    // 2026-08-14 前景植被 sprite 替换（depth 6 遮挡角色）
    decorSprite(13, 20, 'decor_fg_grass', 1, 1.1, 6) || fgGrass(13, 20, 0x3a7a28);
    decorSprite(37, 23, 'decor_fg_grass', 1, 1.0, 6) || fgGrass(37, 23, 0x4a8a30);
    decorSprite(11, 19, 'decor_fg_grass', 1, 0.95, 6) || fgGrass(11, 19, 0x3a7a28);

    // ---- 3) 晨雾（06-09 时）：低透明度雾带缓慢横移，白天零创建 ----
    if (t.hour >= 6 && t.hour < 9) {
      // 2026-08-12 平移 dx=10列 dy=8行
      const fogSpots: Array<[number, number]> = [[16, 11], [25, 11], [34, 11]];
      fogSpots.forEach(([c, r], i) => {
        const f = this.add.ellipse(c * T + T / 2, r * T + T / 2, 260, 64, 0xffffff, 0.05 + i * 0.005);
        f.setDepth(2);
        this.tweens.add({
          targets: f,
          x: { from: c * T + T / 2 - 22, to: c * T + T / 2 + 22 },
          duration: 9000 + i * 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut',
        });
        this.townLife.fog++;
      });
    }

    // ---- 4) 夜间萤火虫（≥18 时或 <6 时）：复用 forest 参数，白天零创建 ----
    if (t.hour >= 18 || t.hour < 6) {
      // 2026-08-12 平移 dx=10列 dy=8行
      const glowSpots: Array<[number, number]> = [[22, 12], [27, 12], [17, 18]];
      glowSpots.forEach(([c, r]) => {
        const p = this.add.particles(c * T + T / 2, r * T + T / 2, '__WHITE', {
          lifespan: 2600,
          speedY: { min: -14, max: 14 },
          speedX: { min: -14, max: 14 },
          quantity: 1,
          frequency: 900,
          alpha: { start: 0.55, end: 0 },
          scale: { start: 0.22, end: 0.08 },
          tint: 0xccff88,
          blendMode: 'ADD',
        });
        p.setDepth(4);
        this.townLife.fireflies++;
      });
    }

    // 第一章 P2 捕虫玩法 V0.1（2026-08-13）：town 蝴蝶（白天 06-18 时，2 只）
    this.spawnTownButterflies();
  }

  /** 确保 __WHITE 纯白纹理存在（粒子发射器共用材质，全局只创建一次） */
  private ensureWhiteTexture(): void {
    if (this.textures.exists('__WHITE')) return;
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 8;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 2, 8);
    this.textures.addCanvas('__WHITE', canvas);
  }

  /**
   * 试玩-11 森林内容填充：后山氛围装饰（零资源纯代码）。
   * 1) 野花/草丛装饰（Graphics 纯绘制，散落空地，避开交互点）
   * 2) 夜间萤火虫（绿色微光慢漂，后山夜晚的生命感）
   * 3) 白天落叶（淡绿叶片飘落，复用 town 落叶模式）
   * 位置已核对 forest Walls/Ground 层：老树(8,8)、碎片(20,10)、
   * 后山道路修复(cols13-16,rows10-16)、farm出口(14-16,row18)、mine出口(cols28-29,rows9-11)均避开。
   * 纯视觉装饰：不触碰碰撞/存档/出口/玩法逻辑。
   */
  private setupForestAmbience(): void {
    const T = TILE_SIZE;
    this.ensureWhiteTexture();

    // 1) 野花装饰：Graphics 纯绘制，散落在地图空闲格（Ground gid 1 草地）
    const flowerSpots: Array<[number, number]> = [
      [3, 4], [6, 11], [10, 6], [12, 3], [17, 8], [21, 13], [24, 2], [26, 6], [5, 16], [23, 17],
    ];
    flowerSpots.forEach(([c, r], i) => {
      const g = this.add.graphics();
      const x = c * T + T / 2;
      const y = r * T + T / 2;
      // 茎
      g.lineStyle(1, 0x3a6a20, 0.8);
      g.lineBetween(x - 2, y + 3, x, y - 2);
      g.lineBetween(x, y - 2, x + 2, y + 3);
      // 花瓣（两点小圆点，颜色随序号交替：白/黄/粉/紫）
      const petals = [0xf2e6d8, 0xf0d080, 0xe8a0a0, 0xc0a0e8];
      g.fillStyle(petals[i % petals.length], 0.9);
      g.fillCircle(x, y - 4, 1.6);
      g.fillCircle(x - 1.5, y - 3, 1.4);
      g.fillCircle(x + 1.5, y - 3, 1.4);
      g.setDepth(3);
      this.forestDecor.push(g);
    });

    // 2) 夜间萤火虫：绿色微光慢漂（仅傍晚/清晨出现，白天零创建零开销）
    const t = getTime();
    if (t.hour >= 18 || t.hour < 6) {
      const glowSpots: Array<[number, number]> = [
        [9 * T + 8, 7 * T + 8],
        [6 * T + 8, 13 * T + 8],
        [19 * T + 8, 6 * T + 8],
        [24 * T + 8, 11 * T + 8],
      ];
      glowSpots.forEach(([x, y]) => {
        const p = this.add.particles(x, y, '__WHITE', {
          lifespan: 2600,
          speedY: { min: -14, max: 14 },
          speedX: { min: -14, max: 14 },
          quantity: 1,
          frequency: 900,
          alpha: { start: 0.55, end: 0 },
          scale: { start: 0.22, end: 0.08 },
          tint: 0xccff88,
          blendMode: 'ADD',
        });
        p.setDepth(4);
        this.forestFireflies.push(p);
      });
    }

    // 3) 白天落叶：树冠下飘落淡绿叶片（旋转 + 飘移）
    const leafTrees: Array<[number, number]> = [
      [4 * T + 8, 3 * T + 8],
      [11 * T + 8, 3 * T + 8],
      [19 * T + 8, 4 * T + 8],
      [26 * T + 8, 3 * T + 8],
    ];
    leafTrees.forEach(([x, y]) => {
      const p = this.add.particles(x, y, '__WHITE', {
        lifespan: 3200,
        speedY: { min: 14, max: 34 },
        speedX: { min: -18, max: 18 },
        gravityY: 12,
        quantity: 1,
        frequency: 1100,
        alpha: { start: 0.8, end: 0.1 },
        scale: { start: 0.34, end: 0.18 },
        tint: 0x9adf6a,
        rotate: { start: 0, end: 200 },
      });
      p.setDepth(4);
      this.forestLeaves.push(p);
    });
  }

  /**
   * 后山观景台（v0.10.2 第二层：环境铺垫——"先让环境说话"）
   * 位置：森林 (20,7) 空地（星之碎片 (20,10) 上方，玩家走向碎片时先经过）。
   * 旧木台：木板发黑、边角围栏塌了半边（与 FOREST_LOOKOUT_DIALOGUE 文案一致）。
   * 靠近自动触发一次性对白（triggerOnce('forest_lookout_first_visit') 持久化判重），不改变碎片流程。
   */
  private setupForestLookout(): void {
    const T = TILE_SIZE;
    const cx = 20 * T + T / 2;
    const cy = 7 * T + T / 2;
    this.lookoutPos = { x: cx, y: cy };

    const container = this.add.container(cx, cy);

    // ── 地面阴影（更立体） ──
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.16);
    shadow.fillEllipse(0, 16, 66, 12);
    container.add(shadow);

    // ── 木台（发黑的旧木板 + 缝隙） ──
    const deck = this.add.graphics();
    deck.fillStyle(0x3a2c1c, 1);
    deck.fillRoundedRect(-26, 4, 52, 10, 2);
    deck.fillStyle(0x241a0e, 0.8);
    deck.fillRoundedRect(-26, 10, 52, 4, 1);
    deck.fillStyle(0x1a1208, 0.9);
    for (let i = -3; i <= 3; i++) deck.fillRect(i * 8 - 1, 5, 1.5, 8);
    container.add(deck);

    // ── 后侧两根立柱 + 顶横梁（门框感） ──
    const posts = this.add.graphics();
    posts.fillStyle(0x2e2014, 1);
    posts.fillRect(-24, -20, 5, 26);
    posts.fillRect(19, -20, 5, 26);
    posts.fillStyle(0x241a0e, 1);
    posts.fillRect(-25, -23, 51, 4);
    container.add(posts);

    // ── 前侧围栏：左边保留两格横杆，右边塌了半边（横杆一端垂下） ──
    const rail = this.add.graphics();
    rail.fillStyle(0x2e2014, 0.95);
    rail.fillRect(-24, -6, 18, 3);
    rail.fillRect(-22, 0, 14, 3);
    // 塌掉的右半：横杆从右柱位置向下歪垂
    rail.lineStyle(3, 0x2e2014, 0.9);
    rail.lineBetween(12, -6, 22, 10);
    rail.fillStyle(0x1a1208, 0.8);
    rail.fillRect(20, 10, 5, 4);
    container.add(rail);

    // ── 苔藓（久无人迹） ──
    const moss = this.add.graphics();
    moss.fillStyle(0x4a6a28, 0.75);
    moss.fillCircle(-18, 4, 2.2);
    moss.fillCircle(6, 3, 2.6);
    moss.fillCircle(22, -18, 2);
    moss.fillCircle(-24, -18, 2.2);
    container.add(moss);

    container.setDepth(5);
    this.lookout = container;
  }

  /** 观景台靠近检测（update 每帧）：玩家进入范围 → 一次性播放 FOREST_LOOKOUT_DIALOGUE */
  private checkForestLookout(): void {
    if (!this.lookout || this.mapKey !== 'forest') return;
    if (this.lookoutTriggered) return;
    if (hasTriggered('forest_lookout_first_visit')) {
      this.lookoutTriggered = true; // 已触发过（含读档恢复），不再检测
      return;
    }
    const dx = this.player.x - this.lookoutPos.x;
    const dy = this.player.y - this.lookoutPos.y;
    if (dx * dx + dy * dy > 70 * 70) return;
    if (this.storyDialogue?.isOpen()) return;
    this.lookoutTriggered = true;
    triggerOnce('forest_lookout_first_visit', () => {

      this.playStory(FOREST_LOOKOUT_DIALOGUE, () => {
        this.updateHUD();
        this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
      });
    });
  }

  /**
   * 创建农场树木精灵
   * 新游戏无存档时初始化树木状态；有存档时 FarmState 已由 apply() 恢复
   * 树木贴图 32x32，缩放 0.5 与 16x16 瓦片协调；附带静态碰撞体
   */
  private setupTrees(): void {
    // 新游戏：树木状态表为空时初始化（有存档时 apply() 已恢复）
    if (!getTree(FARM_TREE_POSITIONS[0].col, FARM_TREE_POSITIONS[0].row)) {
      initTrees();
    }
    // 按位置创建精灵（根据存档状态决定显示树或树桩）
    for (const pos of FARM_TREE_POSITIONS) {
      const tree = getTree(pos.col, pos.row);
      if (!tree) continue;
      const cx = pos.col * TILE_SIZE + TILE_SIZE / 2;
      const cy = pos.row * TILE_SIZE + TILE_SIZE / 2;
      // 美术升级 2026-08-09：树有大有小——(col+row)%3===0 的树用大树（树冠占 2 格宽），其余小树交替阔叶/松
      const isBig = !tree.isStump && (pos.col + pos.row) % 3 === 0;
      const textureKey = tree.isStump
        ? 'stump'
        : isBig
          ? 'tree_big'
          : (pos.col + pos.row) % 2 === 0 ? 'tree1' : 'tree2';
      // 大树：锚点底部中心（树冠向上展开 2 格宽视觉），显示 32×32；碰撞仅底部树格 1 格（不堵 2 格路）
      const sprite = this.add.image(cx, cy, textureKey);
      if (isBig) sprite.setOrigin(0.5, 1);
      sprite.setScale(0.5);
      sprite.setDepth(4);
      // 静态物理体（树桩也建 body，便于 3 天后恢复为树时重新启用碰撞）
      this.physics.add.existing(sprite, true);
      if (tree.isStump) {
        // 树桩不挡路（制作人需求 2026-08-07：木桩无碰撞体积）；已消失的树桩保持隐藏
        (sprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        if (tree.stumpGone) {
          sprite.setVisible(false);
        } else {
          // 树桩只保留几秒后消失（砍倒后立刻切场景时，重进补调度淡出）
          this.scheduleStumpFade(sprite, tree);
        }
      } else {
        // 树木碰撞：小树 1 格；大树收窄到底部树格（sprite 显示 32×32 锚点底中：树格=相对左上 offset(8,24) 的 16×16）
        if (isBig) {
          (sprite.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 16, false).setOffset(8, 24);
        }
        this.physics.add.collider(this.player, sprite);
      }
      this.treeSprites.set(`${pos.col},${pos.row}`, sprite);
    }
  }

  /**
   * 树视觉升级：程序绘制多种装饰树（打破千篇一律的 3 种 sprite，零素材）。
   * kind：fruit 果树（红果）/ blossom 开花树（粉花）/ willow 垂柳 / pine 松 / oak 老橡树。
   * (x,y) = 树底部中心（地面）；树冠向上展开；depth 4 与可砍树一致。
   * 注意：不用 setScale（Graphics 缩放围绕原点 (0,0) 会使世界坐标绘制内容偏移）；
   * 大小差异由各树型自身的尺寸承担（oak 高、blossom 小）。
   */
  private drawGroveTree(
    kind: 'fruit' | 'blossom' | 'willow' | 'pine' | 'oak',
    x: number, y: number,
  ): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(4);
    const trunk = 0x6d4c2a;
    if (kind === 'oak') {
      // 老橡树：粗干 + 宽冠（成片树丛的"主树"）
      g.fillStyle(0x5a3f22, 1); g.fillRect(x - 4, y - 12, 8, 12);       // 粗干
      g.fillStyle(trunk, 1); g.fillRect(x - 3, y - 10, 6, 10);           // 干面
      g.fillStyle(0x3f6d2a, 1); g.fillCircle(x, y - 20, 9);              // 冠底
      g.fillStyle(0x528a38, 1); g.fillCircle(x - 4, y - 22, 5);          // 冠侧
      g.fillCircle(x + 4, y - 22, 5);
      g.fillStyle(0x3f6d2a, 1); g.fillCircle(x, y - 27, 5);              // 冠顶
      g.fillStyle(0x6da544, 0.8); g.fillCircle(x - 2, y - 24, 3);        // 高光
    } else if (kind === 'fruit') {
      // 果树：细干 + 圆冠 + 红果
      g.fillStyle(0x8a6a45, 1); g.fillRect(x - 2, y - 10, 4, 10);        // 干
      g.fillStyle(0x4a9e3f, 1); g.fillCircle(x, y - 16, 7);              // 冠
      g.fillStyle(0x5db84a, 1); g.fillCircle(x - 2, y - 18, 4);
      g.fillStyle(0xe85050, 1); g.fillCircle(x - 4, y - 14, 1.3);        // 果
      g.fillStyle(0xff6b6b, 1); g.fillCircle(x + 3, y - 17, 1.3);
      g.fillStyle(0xe85050, 1); g.fillCircle(x + 1, y - 12, 1.3);
    } else if (kind === 'blossom') {
      // 开花树：细干 + 粉冠 + 花点（"春天里的树"）
      g.fillStyle(0x9a7a5a, 1); g.fillRect(x - 2, y - 9, 4, 9);          // 干
      g.fillStyle(0xe8a0c8, 1); g.fillCircle(x, y - 15, 6);              // 冠
      g.fillStyle(0xf4b8d8, 1); g.fillCircle(x - 2, y - 17, 3.5);
      g.fillStyle(0xe8a0c8, 1); g.fillCircle(x + 2, y - 12, 3);
      g.fillStyle(0xffffff, 0.9); g.fillCircle(x - 4, y - 16, 0.9);      // 花点
      g.fillStyle(0xfff0f6, 0.9); g.fillCircle(x + 2, y - 17, 0.9);
      g.fillStyle(0xffffff, 0.9); g.fillCircle(x + 5, y - 13, 0.9);
    } else if (kind === 'willow') {
      // 垂柳：细干 + 椭圆冠 + 垂条（"风一吹就动"）
      g.fillStyle(0x6d5a3a, 1); g.fillRect(x - 2, y - 11, 4, 11);        // 干
      g.fillStyle(0x7aaa5a, 1); g.fillEllipse(x, y - 17, 15, 11);        // 冠
      g.fillStyle(0x8abc6a, 1); g.fillRect(x - 6, y - 13, 1, 7);         // 垂条
      g.fillRect(x - 3, y - 12, 1, 8);
      g.fillRect(x, y - 12, 1, 8);
      g.fillRect(x + 3, y - 12, 1, 8);
      g.fillRect(x + 6, y - 13, 1, 7);
      g.fillStyle(0x94c878, 1); g.fillRect(x - 4, y - 16, 8, 2);         // 冠顶亮面
    } else {
      // pine 松：细干 + 叠三角冠（"像青禾镇周边的小松林"）
      g.fillStyle(0x7a5a32, 1); g.fillRect(x - 2, y - 8, 4, 8);          // 干
      g.fillStyle(0x2e5a24, 1); g.fillTriangle(x, y - 28, x - 7, y - 14, x + 7, y - 14);
      g.fillStyle(0x3a6e2e, 1); g.fillTriangle(x, y - 22, x - 5, y - 10, x + 5, y - 10);
      g.fillStyle(0x4a7f3a, 1); g.fillTriangle(x, y - 16, x - 3, y - 6, x + 3, y - 6);
    }
    return g;
  }

  /**
   * 树视觉升级：farm 成片装饰树丛（集中成林，混合多种树，零碰撞零存档）。
   * 位置（经 farm.json 草地验证，避开森林入口/可砍树/农田/水塘/装饰区）：
   *   北缘树丛（cols 20-24, rows 1-2）：森林入口西侧的"小松林+果树"
   *   东缘树丛（cols 34-37, rows 18-20）：往小镇路上的"果树林子"
   */
  private setupFarmTreeGroves(): void {
    if (this.mapKey !== 'farm') return;
    if (this.groveTrees.length > 0) return; // 幂等
    const T = TILE_SIZE;
    // 北缘树丛（5 棵，错落：主树 oak + fruit + pine + blossom + willow）
    const north: Array<['oak' | 'fruit' | 'blossom' | 'willow' | 'pine', number, number]> = [
      ['oak', 20, 1], ['fruit', 22, 1], ['pine', 24, 1],
      ['blossom', 21, 2], ['willow', 23, 2],
    ];
    // 东缘树丛（5 棵：fruit ×2 + oak + pine + blossom）
    const east: Array<['oak' | 'fruit' | 'blossom' | 'willow' | 'pine', number, number]> = [
      ['fruit', 34, 18], ['oak', 36, 18], ['willow', 34, 20],
      ['pine', 36, 20], ['blossom', 37, 19],
    ];
    const plant = (arr: Array<['oak' | 'fruit' | 'blossom' | 'willow' | 'pine', number, number]>): void => {
      for (const [kind, c, r] of arr) {
        const g = this.drawGroveTree(kind, c * T + T / 2, r * T + T / 2);
        this.groveTrees.push(g);
      }
    };
    plant(north);
    plant(east);
  }

  /** 树桩短暂保留（3.2s）后淡出消失并标记，防止切场景后残留 */
  private scheduleStumpFade(sprite: Phaser.GameObjects.Image, tree: TreeState): void {
    this.tweens.add({
      targets: sprite,
      alpha: 0,
      delay: 3200,
      duration: 800,
      onComplete: () => {
        sprite.setVisible(false);
        tree.stumpGone = true;
      },
    });
  }

  /**
   * v1.1 采集体验升级：一次性粒子爆发（木屑/树叶/石屑/闪光）。
   * 用 __WHITE 像素纹理 + tint 着色（零资源，与既有粒子模式一致）；爆发后自动销毁。
   */
  private burstParticles(
    x: number,
    y: number,
    opts: { count: number; tint: number; speed: number; gravityY: number; lifespan?: number; scale?: number },
  ): void {
    const p = this.add.particles(x, y, '__WHITE', {
      lifespan: opts.lifespan ?? 520,
      speedX: { min: -opts.speed, max: opts.speed },
      speedY: { min: -opts.speed * 0.5, max: opts.speed * 0.6 },
      gravityY: opts.gravityY,
      scale: { start: opts.scale ?? 0.5, end: 0.05 },
      alpha: { start: 1, end: 0 },
      tint: opts.tint,
      emitting: false,
    } as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig);
    p.setDepth(6);
    p.explode(opts.count, x, y);
    this.time.delayedCall((opts.lifespan ?? 520) + 60, () => p.destroy());
  }

  /**
   * v1.1 采集体验升级：树干/岩石裂纹图形（1px 深色折线，纯 Graphics 零资源）。
   * 返回 Graphics 供调用方持有并在后续击打/击破时销毁。
   */
  private drawCrack(x: number, y: number, color: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.lineStyle(1, color, 0.9);
    g.beginPath();
    g.moveTo(x - 5, y - 2);
    g.lineTo(x - 2, y - 6);
    g.lineTo(x + 1, y - 4);
    g.lineTo(x + 4, y - 9);
    g.lineTo(x + 6, y - 8);
    g.strokePath();
    g.setDepth(6);
    return g;
  }

  /**
   * v1.1 采集体验升级：树倒下动画（短促倾斜 → 倒地），完成后变树桩并调度淡出。
   * 倒向远离玩家（玩家在左 → 树向右倒），避免压向玩家；倒树期间玩家可通行。
   */
  private playTreeFall(sprite: Phaser.GameObjects.Image, col: number, row: number, cx: number, cy: number): void {
    const dir = this.player.x <= cx ? 1 : -1; // 1=右倒（角度正），-1=左倒
    // 大量木屑（树干处）+ 树叶（树冠处，飘落感）
    this.burstParticles(cx, cy - 2, { count: 14, tint: 0x8a5a2b, speed: 90, gravityY: 260 });
    this.burstParticles(cx, cy - 14, { count: 10, tint: 0x6da544, speed: 70, gravityY: 40 });
    // 轻微震屏（短促，采集成就感）
    this.cameras.main.shake(220, 0.005);
    // 先杀旧晃动 tween，避免与倒下动画冲突
    this.tweens.killTweensOf(sprite);
    this.tweens.add({
      targets: sprite,
      angle: 88 * dir,
      y: cy + 2,
      duration: 420,
      ease: 'Quad.easeIn',
      onComplete: () => {
        sprite.setTexture('stump');
        sprite.setAngle(0);
        sprite.setPosition(cx, cy);
        // 树桩短暂保留后淡出消失（切场景后 setupTrees 会为树桩重新调度淡出）
        const tree = getTree(col, row);
        if (tree) this.scheduleStumpFade(sprite, tree);
      },
    });
  }

  /** 出口指示箭头：在每个出口区域边缘显示方向 + 目标名称（锁定出口不显示） */
  private setupExitIndicators(): void {
    const exits = MAP_EXITS[this.mapKey] ?? [];
    for (const ex of exits) {
      // 锁定出口（未来内容预埋）：不显示箭头，避免引导玩家去"去不了"的地方
      if (!this.isExitOpen(ex)) continue;
      const targetName = MAP_NAMES[ex.target] ?? ex.target;
      const cx = ex.x + ex.w / 2;
      const cy = ex.y + ex.h / 2;

      // 根据出口在地图边缘的位置决定箭头方向
      let arrow: string;
      let labelY = cy;
      if (ex.y <= 0) {
        // 顶部出口 → 向上箭头，文字在下方
        arrow = '▲';
        labelY = cy + 14;
      } else if (ex.y + ex.h >= this.physics.world.bounds.height) {
        // 底部出口 → 向下箭头，文字在上方
        arrow = '▼';
        labelY = cy - 14;
      } else if (ex.x <= 0) {
        // 左侧出口 → 向左箭头
        arrow = '◀';
      } else if (ex.x + ex.w >= this.physics.world.bounds.width) {
        // 右侧出口 → 向右箭头
        arrow = '▶';
      } else {
        arrow = '◆';
      }

      const txt = this.add.text(cx, labelY, `${arrow} ${targetName}`, {
        fontSize: '10px',
        color: '#ffcc44',
        stroke: '#000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(9);

      // 闪烁动画吸引注意
      this.tweens.add({
        targets: txt,
        alpha: 0.4,
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  // ============ 新手教程 ============

  /**
   * 教程设置：根据当前场景和步骤创建门/夏雅/提示
   */
  private setupTutorial(): void {
    // 复用 StoryDialogue 实例，避免场景切换时 DOM 累积
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    this.tutorialProgress = 0;
    const step = getStoryStep();

    if (this.mapKey === 'gate') {
      this.setupGateTutorial(step);
    } else if (this.mapKey === 'farm') {
      this.setupFarmTutorial(step);
    }
  }

  /** 大门地图教程：门墙 + 夏雅 */
  private setupGateTutorial(step: string): void {
    // 兜底：xiya_talk 是对话中间态，如果 scene 重建时卡在此步（对话被打断），
    // 回退到 arrive_manor 让玩家可重新与夏雅对话获取钥匙
    if (step === 'xiya_talk') {
      setStoryStep('arrive_manor');
      step = 'arrive_manor';
    }
    // 庄园大门墙壁（物理阻挡，使用钥匙后销毁）
    const stepsBeforeGate = ['station_intro', 'station_move', 'arrive_manor', 'xiya_talk', 'get_key'];
    if (stepsBeforeGate.includes(step)) {
      // 大门在门柱之间（cols 14-15, rows 8-9），2格宽×2格高木门
      const gateX = 15 * TILE_SIZE;  // 中心 x
      const gateY = 9 * TILE_SIZE;   // 中心 y（row 9 = rows 8-9 中点）
      this.gateWall = this.add.rectangle(gateX, gateY, 2 * TILE_SIZE, 2 * TILE_SIZE, 0x8b4513, 0.9);
      this.gateWall.setDepth(4);
      this.physics.add.existing(this.gateWall, true);
      this.physics.add.collider(this.player, this.gateWall);
      // gate 美术升级：在物理墙上方叠加像素风双扇木门视觉（含挂锁，随 gateWall 一起销毁）
      this.gateDoorVisual = this.createGateDoorVisual(gateX, gateY);
      this.gateDoorVisual.setDepth(4);
    }

    // 夏雅 NPC（开门前显示在门南侧，row 11-12）
    if (step === 'arrive_manor' || step === 'xiya_talk' || step === 'get_key') {
      const xiyaX = 15 * TILE_SIZE + TILE_SIZE / 2;
      const xiyaY = 11 * TILE_SIZE + TILE_SIZE / 2;
      this.xiyaSprite = this.add.sprite(xiyaX, xiyaY, 'npc_xiya');
      this.xiyaSprite.setScale(0.5).setDepth(5);
      this.add.text(xiyaX, xiyaY - 24, '夏雅', {
        fontSize: '13px', color: '#f0a050',
        stroke: '#000000', strokeThickness: 3,
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 3, y: 2 },
      }).setShadow(0, 1, '#000000', 2).setOrigin(0.5).setDepth(6);
    }

    // ── 庄园大门交互物品（增加场景氛围和代入感） ──
    this.createGateInteractables(step);

    // 提示
    const hints: Partial<Record<string, string>> = {
      arrive_manor: this.hintText('→ 靠近夏雅，按 [E] 键对话', '→ 靠近夏雅，点「交互」对话'),
      get_key: this.hintText('→ 按 [B] 键打开背包，选择钥匙使用', '→ 点按右下角「背包」按钮，选择钥匙使用'),
    };
    if (hints[step]) this.showTutorialHint(hints[step]!);
  }

  /**
   * gate 美术升级：像素风双扇木门视觉（叠加在物理墙上方，随 gateWall 一起销毁）。
   * 纯视觉：不参与物理碰撞；开门时随物理墙一起销毁，配合 gate_open 音效。
   */
  private createGateDoorVisual(gateX: number, gateY: number): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    // 门框（深棕外框，嵌入门柱间）
    g.fillStyle(0x4a3220, 1);
    g.fillRect(-16, -17, 32, 32);
    // 左扇门板
    g.fillStyle(0x6e4a2e, 1);
    g.fillRect(-14, -14, 13, 28);
    // 右扇门板
    g.fillRect(1, -14, 13, 28);
    // 门缝（中缝深色线）
    g.fillStyle(0x3a2818, 1);
    g.fillRect(-0.5, -14, 1, 28);
    // 门板横纹（木板拼缝）
    g.fillStyle(0x5a3c24, 1);
    g.fillRect(-14, -8, 13, 1);
    g.fillRect(-14, 0, 13, 1);
    g.fillRect(-14, 8, 13, 1);
    g.fillRect(1, -8, 13, 1);
    g.fillRect(1, 0, 13, 1);
    g.fillRect(1, 8, 13, 1);
    // 门环（左右扇各一，金色）
    g.fillStyle(0xd8b060, 1);
    g.fillCircle(-7.5, -3, 2.2);
    g.fillCircle(7.5, -3, 2.2);
    g.fillStyle(0x4a3220, 1);
    g.fillCircle(-7.5, -3, 0.8);
    g.fillCircle(7.5, -3, 0.8);
    // 门锁（金色挂锁，门缝上端；替换 v0.10 前 emoji 🔒，随门视觉一起销毁）
    g.fillStyle(0xd8b060, 1);
    g.fillRoundedRect(-3, -8, 6, 7, 1);
    g.lineStyle(1.5, 0xd8b060, 1);
    g.beginPath();
    g.arc(0, -8, 3, Math.PI, 0, false);
    g.strokePath();
    g.fillStyle(0x4a3220, 1);
    g.fillCircle(0, -5, 1);
    // 门楣（门上方横梁）
    g.fillStyle(0x5a3c24, 1);
    g.fillRect(-17, -18, 34, 3);
    return this.add.container(gateX, gateY, [g]);
  }

  /**
   * gate 庄园大门美术升级（零资源纯代码，视觉方案 v0.10+ 简单升级）。
   * 1) 生活杂物层：花盆×2 / 木柴堆 / 石凳 / 水桶 / 木箱 / 路边石×3 / 草丛×4
   * 2) 小动物：1 只小鸟固定小范围活动（复用 town 模式）
   * 3) 夜间门柱暖光（≥18 时或 <6 时，复用 town 窗灯模式）
   * 坐标已核对 gate Ground/Walls 层（30x20）+ 教程交互点 + 出口：
   *   出口（cols14-15, rows0-2 路径）、大门（cols14-15, rows8-9）、夏雅站位（col15, rows11-12）、
   *   emoji 交互点（12,10 / 13,9 / 17,9 / 13,12 / 17,12 / 14,13 / 14,8 / 16,8 / 16,12）均避开。
   * 纯视觉装饰：不触碰碰撞/存档/出口/教程逻辑；场景 shutdown 自动销毁。
   */
  private setupGateDecorations(): void {
    const T = TILE_SIZE;
    const px = (c: number, r: number): [number, number] => [c * T + T / 2, r * T + T / 2];
    const t = getTime();
    // 2026-08-14 资产精修：与 town 共用的 decor_* sprite 优先，缺失时 fallback 到 Graphics
    const decorSprite = (c: number, r: number, key: string, originY = 1, scale = 1): boolean => {
      if (!this.textures.exists(key)) return false;
      const [x, y] = px(c, r);
      const img = this.add.image(x, y, key);
      img.setOrigin(0.5, originY).setScale(scale).setDepth(3);
      this.gateLife.decor++;
      return true;
    };

    // ---- 1) 生活杂物层（深度 3，位于角色之下）----
    const woodpile = (c: number, r: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x8a6a45, 1);
      g.fillRoundedRect(x - 6, y + 1, 12, 3, 1);
      g.fillRoundedRect(x - 5, y - 2, 10, 3, 1);
      g.fillRoundedRect(x - 4, y - 5, 8, 3, 1);
      g.fillStyle(0xa8835a, 1);
      g.fillCircle(x - 3, y - 5, 1.3);
      g.fillCircle(x + 2, y - 2, 1.3);
      g.fillCircle(x + 4, y + 1, 1.3);
      g.setDepth(3);
      this.gateLife.decor++;
    };
    const pot = (c: number, r: number, color: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x8c5a3c, 1);
      g.fillRect(x - 3, y - 1, 6, 4);
      g.fillRect(x - 4, y - 2, 8, 2);
      g.fillStyle(0x3a6a20, 1);
      g.fillRect(x - 0.5, y - 4, 1, 3);
      g.fillStyle(color, 1);
      g.fillCircle(x - 2, y - 4, 1.8);
      g.fillCircle(x + 2, y - 5, 1.8);
      g.fillCircle(x, y - 6, 1.6);
      g.setDepth(3);
      this.gateLife.decor++;
    };
    const bucket = (c: number, r: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x5a6a78, 1);
      g.fillRect(x - 3, y - 2, 6, 5);
      g.lineStyle(1, 0x8a9aa8, 1);
      g.strokeRect(x - 3, y - 2, 6, 5);
      g.lineBetween(x - 3, y - 2, x, y - 6);
      g.lineBetween(x + 3, y - 2, x, y - 6);
      g.setDepth(3);
      this.gateLife.decor++;
    };
    const crate = (c: number, r: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x9a7a4a, 1);
      g.fillRect(x - 5, y - 4, 10, 8);
      g.lineStyle(1, 0x6e5633, 1);
      g.strokeRect(x - 5, y - 4, 10, 8);
      g.lineBetween(x - 5, y - 4, x + 5, y + 4);
      g.lineBetween(x + 5, y - 4, x - 5, y + 4);
      g.setDepth(3);
      this.gateLife.decor++;
    };
    const stool = (c: number, r: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x8a6a45, 1);
      g.fillRect(x - 4, y - 1, 8, 2);
      g.fillRect(x - 3, y + 1, 1.5, 4);
      g.fillRect(x + 1.5, y + 1, 1.5, 4);
      g.setDepth(3);
      this.gateLife.decor++;
    };
    const stone = (c: number, r: number, s: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      g.fillStyle(0x9a9aa2, 1);
      g.fillCircle(x, y, s);
      g.fillStyle(0xb8b8c0, 0.6);
      g.fillCircle(x - s * 0.3, y - s * 0.3, s * 0.4);
      g.setDepth(3);
      this.gateLife.decor++;
    };
    const grass = (c: number, r: number, tone: number): void => {
      const [x, y] = px(c, r);
      const g = this.add.graphics();
      for (let i = -2; i <= 2; i += 2) {
        g.lineStyle(1, tone, 0.9);
        g.lineBetween(x + i - 1, y + 2, x + i, y - 2);
        g.lineBetween(x + i + 1, y + 2, x + i, y - 2);
      }
      g.setDepth(3);
      this.gateLife.decor++;
    };

    decorSprite(10, 10, 'decor_pot') || pot(10, 10, 0xf0d080);
    decorSprite(18, 10, 'decor_pot', 1, 0.9) || pot(18, 10, 0xe8a0a0);   // 花盆 ×2（大门两侧前院）
    decorSprite(20, 12, 'decor_woodpile') || woodpile(20, 12);                                // 木柴堆（右侧空地）
    decorSprite(3, 12, 'decor_stool') || stool(3, 12);                                    // 石凳（左侧树荫下）
    decorSprite(25, 9, 'decor_bucket') || bucket(25, 9);                                   // 水桶（右院墙脚）
    decorSprite(20, 10, 'decor_crate') || crate(20, 10);                                   // 木箱（右院）
    decorSprite(2, 12, 'decor_rock') || stone(2, 12, 2.5);
    decorSprite(23, 9, 'decor_rock', 1, 0.85) || stone(23, 9, 2);
    decorSprite(27, 12, 'decor_rock', 1, 0.9) || stone(27, 12, 2.5); // 路边石 ×3
    decorSprite(9, 13, 'decor_grass') || grass(9, 13, 0x4a8a30);
    decorSprite(19, 13, 'decor_grass', 1, 0.85) || grass(19, 13, 0x5a9a3a);
    decorSprite(18, 14, 'decor_grass', 1, 0.9) || grass(18, 14, 0x4a8a30);
    decorSprite(5, 10, 'decor_grass', 1, 0.9) || grass(5, 10, 0x5a9a3a); // 草丛 ×4

    // ---- 2) 小动物：1 只小鸟固定小范围活动（深度 4，与角色同层）----
    const bird = (x: number, y: number, seed: number): void => {
      const b = this.add.graphics();
      b.fillStyle(0x5a6a78, 1);
      b.fillEllipse(0, 0, 8, 6);
      b.fillStyle(0x8a9aa8, 1);
      b.fillCircle(-3, 0, 2);
      b.fillStyle(0xe8a030, 1);
      b.fillTriangle(-4.5, -1.5, -6.5, 0.5, -4.5, 1.5);
      b.fillStyle(0x202020, 0.9);
      b.fillCircle(-3.5, -0.5, 0.6);
      b.fillStyle(0x6e7a88, 1);
      b.fillEllipse(2, 1, 5, 3);
      const c = this.add.container(x, y, [b]);
      c.setDepth(4);
      this.tweens.add({ targets: b, scaleY: { from: 1, to: 0.7 }, duration: 140, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: c, y: y - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: seed });
      this.tweens.add({ targets: c, x: x + 6, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: seed + 350 });
      this.gateLife.wildlife++;
    };
    bird(18 * T + 8, 6 * T + 8, 0);   // 右侧树梢旁

    // ---- 3) 夜间门柱暖光（≥18 时或 <6 时）：门柱两侧灯笼光晕，白天零创建 ----
    if (t.hour >= 18 || t.hour < 6) {
      const lampSpots: Array<[number, number]> = [[14, 8], [16, 8]]; // 与现有 🏮 灯笼重叠
      lampSpots.forEach(([c, r]) => {
        const w = this.add.ellipse(c * T + T / 2, r * T + T / 2, 20, 20, 0xffcc88, 0.14);
        w.setDepth(2);
        this.tweens.add({
          targets: w,
          scale: 1.18,
          alpha: 0.08,
          duration: 1300 + Math.random() * 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.gateLampGlows.push(w);
      });
    }
    this.gateLife.lamp = this.gateLampGlows.length;
  }

  /** 农场教程：锄地/播种/浇水/睡觉 */
  private setupFarmTutorial(step: string): void {
    const hints: Partial<Record<string, string>> = {
      clear_land: this.hintText('→ 对着农田区域按 [E] 锄地，清理 3 块土地', '→ 对着农田区域点「交互」锄地，清理 3 块土地'),
      sow_seeds: this.hintText('→ 按 [R] 切换到萝卜种子，播种 3 块土地', '→ 对着锄过的土地点「交互」播种萝卜（默认种子），播种 3 块土地'),
      water_crops: this.hintText('→ 对已播种的土地按 [E] 浇水', '→ 对已播种的土地点「交互」浇水'),
      evening_talk: this.hintText('→ 回到床前按 [E] 睡觉，结束第一天', '→ 回到屋内床前点「交互」睡觉，结束第一天'),
    };
    if (hints[step]) this.showTutorialHint(hints[step]!);
  }

  /**
   * 庄园大门场景氛围物品（像素化版本）。
   * v0.10 前为 emoji 文本占位（🏠🪵🌾🏮📮🪣），Alpha 玩家流程审查 P0 #1 要求
   * gate 场景玩家可见范围无任何 emoji 字符 → 全部替换为 Graphics 像素绘制（零素材）。
   * 坐标/深度/文案保持不变；不触碰碰撞/存档/教程逻辑；随场景 shutdown 自动销毁。
   */
  private createGateInteractables(_step: string): void {
    // 只在大门场景创建
    if (this.mapKey !== 'gate') return;
    const T = TILE_SIZE;
    const px = (c: number, r: number): [number, number] => [c * T + T / 2, r * T + T / 2];

    // 旧木牌（庄园入口标识）→ 像素木牌 + 「星黎庄园」文字（保留）
    const [signX, signY] = px(12, 10);
    const sign = this.add.graphics();
    sign.fillStyle(0x8a6a45, 1);
    sign.fillRoundedRect(signX - 9, signY - 7, 18, 14, 2);
    sign.fillStyle(0xa8835a, 1);
    sign.fillRect(signX - 7, signY - 5, 14, 10);
    sign.fillStyle(0x6e5633, 1);
    sign.fillRect(signX - 6, signY - 7, 4, 2);
    sign.fillRect(signX + 2, signY - 7, 4, 2);
    sign.fillRect(signX - 6, signY + 7, 3, 4);
    sign.fillRect(signX + 3, signY + 7, 3, 4);
    sign.setDepth(3);
    this.add.text(signX, signY + 14, '星黎庄园', {
      fontSize: '9px', color: '#c8a878',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(3);

    // 破旧栅栏（门左侧）→ 像素横栏+竖桩
    const [fenceX, fenceY] = px(13, 9);
    const fence = this.add.graphics();
    fence.fillStyle(0x8a6a45, 1);
    fence.fillRect(fenceX - 7, fenceY - 4, 14, 2.5);
    fence.fillRect(fenceX - 7, fenceY + 1, 14, 2.5);
    fence.fillStyle(0x6e5633, 1);
    fence.fillRect(fenceX - 6, fenceY - 5, 2, 9);
    fence.fillRect(fenceX - 1, fenceY - 5, 2, 9);
    fence.fillRect(fenceX + 4, fenceY - 5, 2, 9);
    fence.setDepth(2);

    // 门右侧栅栏（同款）
    const [fence2X, fence2Y] = px(17, 9);
    const fence2 = this.add.graphics();
    fence2.fillStyle(0x8a6a45, 1);
    fence2.fillRect(fence2X - 7, fence2Y - 4, 14, 2.5);
    fence2.fillRect(fence2X - 7, fence2Y + 1, 14, 2.5);
    fence2.fillStyle(0x6e5633, 1);
    fence2.fillRect(fence2X - 6, fence2Y - 5, 2, 9);
    fence2.fillRect(fence2X - 1, fence2Y - 5, 2, 9);
    fence2.fillRect(fence2X + 4, fence2Y - 5, 2, 9);
    fence2.setDepth(2);

    // 杂草（庄园荒废感）→ 像素枯草簇
    const weedPositions: Array<[number, number]> = [[13, 12], [17, 12], [14, 13]];
    for (const [c, r] of weedPositions) {
      const [wx, wy] = px(c, r);
      const w = this.add.graphics();
      for (let i = -2; i <= 2; i += 2) {
        w.lineStyle(1, 0x8a7a3a, 0.9);
        w.lineBetween(wx + i - 1, wy + 2, wx + i, wy - 2);
        w.lineStyle(1, 0xb8a060, 0.7);
        w.lineBetween(wx + i + 1, wy + 2, wx + i + 2, wy - 1);
      }
      w.setDepth(2);
    }

    // 旧灯笼（门柱旁）→ 像素红灯笼（夜间光晕由 setupGateDecorations 叠加）
    const lanternSpots: Array<[number, number]> = [[14, 8], [16, 8]];
    for (const [c, r] of lanternSpots) {
      const [lx, ly] = px(c, r);
      const l = this.add.graphics();
      l.lineStyle(1, 0x8a6a45, 1);
      l.lineBetween(lx, ly - 7, lx, ly - 4);
      l.fillStyle(0xc0392b, 1);
      l.fillRoundedRect(lx - 3, ly - 4, 6, 8, 2);
      l.fillStyle(0xe8b64a, 1);
      l.fillRect(lx - 3, ly - 4, 6, 1.5);
      l.fillRect(lx - 3, ly + 2.5, 6, 1.5);
      l.setDepth(3);
    }

    // 散落的信件（爷爷的信，氛围物件）→ 像素信封
    const [letterX, letterY] = px(16, 12);
    const letter = this.add.graphics();
    letter.fillStyle(0xe8d8c8, 1);
    letter.fillRoundedRect(letterX - 5, letterY - 3, 10, 6, 1);
    letter.lineStyle(1, 0xc0392b, 1);
    letter.lineBetween(letterX - 5, letterY - 3, letterX, letterY);
    letter.lineBetween(letterX + 5, letterY - 3, letterX, letterY);
    letter.setDepth(2);

    // 旧水壶（被遗忘在角落）→ 像素陶水壶
    const [waterX, waterY] = px(14, 13);
    const water = this.add.graphics();
    water.fillStyle(0x8c5a3c, 1);
    water.fillRoundedRect(waterX - 3, waterY - 3, 6, 6, 2);
    water.fillRect(waterX - 4, waterY - 4, 8, 2);
    water.fillStyle(0x6e3a26, 1);
    water.fillRect(waterX - 1, waterY - 5, 2, 1.5);
    water.setDepth(2);
  }

  /** 显示教程提示 */
  private showTutorialHint(text: string): void {
    this.removeTutorialHint();
    this.tutorialHint = document.createElement('div');
    Object.assign(this.tutorialHint.style, {
      position: 'fixed', bottom: '80px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffcc00', fontSize: '14px',
      background: 'rgba(0,0,0,0.7)', padding: '8px 20px', borderRadius: '8px',
      zIndex: '400', pointerEvents: 'none',
      border: '1px solid rgba(255,204,0,0.3)',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    this.tutorialHint.textContent = text;
    document.body.appendChild(this.tutorialHint);
  }

  private removeTutorialHint(): void {
    if (this.tutorialHint) { this.tutorialHint.remove(); this.tutorialHint = null; }
  }

  /** P1-1 桌面端快捷键提示：非触屏设备首次进入显示「J 任务 · B 背包」，使用一次后本局关闭 */
  private setupShortcutHint(): void {
    if (this.shortcutHintDone || isTouchDevice()) return;
    this.removeShortcutHint();
    this.shortcutHint = document.createElement('div');
    Object.assign(this.shortcutHint.style, {
      position: 'fixed', bottom: '120px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffe082', fontSize: '13px',
      fontFamily: 'monospace', background: 'rgba(0,0,0,0.65)',
      padding: '6px 16px', borderRadius: '8px', zIndex: '400',
      pointerEvents: 'none', border: '1px solid rgba(255,224,130,0.25)',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    this.shortcutHint.textContent = '按 J 打开任务 · 按 B 打开背包';
    document.body.appendChild(this.shortcutHint);
  }

  private removeShortcutHint(): void {
    if (this.shortcutHint) { this.shortcutHint.remove(); this.shortcutHint = null; }
  }

  private hideShortcutHint(): void {
    this.shortcutHintDone = true;
    this.removeShortcutHint();
  }

  /** 与夏雅交互 */
  private tryXiyaInteract(): boolean {
    if (!this.xiyaSprite || !this.xiyaSprite.visible) return false;
    const dx = this.player.x - this.xiyaSprite.x;
    const dy = this.player.y - this.xiyaSprite.y;
    if (dx * dx + dy * dy > R2(28)) return false;

    if (getStoryStep() === 'arrive_manor') {
      setStoryStep('xiya_talk');
      this.storyDialogue!.play(XIYA_DIALOGUE, () => {
        addItem('manor_key', 1);
        triggerTag('obtain_manor_key');
        advanceStory(); // → get_key
        this.showTutorialHint(this.hintText('→ 按 [B] 键打开背包，选择钥匙使用', '→ 点按右下角「背包」按钮，选择钥匙使用'));
        this.updateHUD();
      });
      return true;
    }
    return false;
  }

  /** 使用庄园钥匙（BackpackPanel 调用） */
  useManorKey(): boolean {
    if (getStoryStep() !== 'get_key') {
      this.showDialogueText('大门锁着，需要先拿到钥匙。');
      return false;
    }

    // 销毁大门物理墙 + 木门视觉（gate 美术升级：视觉随门一起销毁）
    if (this.gateWall) {
      this.gateWall.destroy();
      this.gateWall = null;
    }
    if (this.gateDoorVisual) {
      this.gateDoorVisual.destroy();
      this.gateDoorVisual = null;
    }
    if (this.xiyaSprite) { this.xiyaSprite.destroy(); this.xiyaSprite = null; }
    this.removeTutorialHint();
    play('gate_open'); // 大门开启演出音效（试玩-14，原占位 harvest 音移除）
    addItem('manor_key', -1);
    advanceStory(); // → gate_opened

    this.storyDialogue!.play(GATE_OPENED_DIALOGUE, () => {
      addItem('old_hoe', 1);
      advanceStory(); // → clear_land
      this.tutorialProgress = 0;
      // 大门地图 → 提示去农场；农场地图 → 提示锄地
      if (this.mapKey === 'gate') {
        this.showTutorialHint('→ 大门已开，穿过大门前往庄园');
      } else {
        this.showTutorialHint(this.hintText('→ 对着农田区域按 [E] 锄地，清理 3 块土地', '→ 对着农田区域点「交互」锄地，清理 3 块土地'));
      }
      this.updateHUD();
    });
    return true;
  }

  /** 教程中锄地/播种/浇水的进度检测 */
  private checkTutorialProgress(action: 'till' | 'sow' | 'water'): void {
    const step = getStoryStep();
    if (step === 'done') return;

    if (step === 'clear_land' && action === 'till') {
      this.tutorialProgress++;
      this.showTutorialHint(`→ 清理土地 ${this.tutorialProgress}/${this.TUTORIAL_TARGET}`);
      if (this.tutorialProgress >= this.TUTORIAL_TARGET) {
        this.removeTutorialHint();
        this.tutorialProgress = 0;
        addItem('radish_seed', 3);
        advanceStory(); // → sow_seeds
        this.storyDialogue!.play(SOW_SEEDS_DIALOGUE, () => {
          this.showTutorialHint(this.hintText('→ 按 [R] 切换到萝卜种子，播种 3 块土地', '→ 对着锄过的土地点「交互」播种萝卜（默认种子），播种 3 块土地'));
          this.updateHUD();
        });
      }
      return;
    }

    if (step === 'sow_seeds' && action === 'sow') {
      this.tutorialProgress++;
      this.showTutorialHint(`→ 播种 ${this.tutorialProgress}/${this.TUTORIAL_TARGET}`);
      if (this.tutorialProgress >= this.TUTORIAL_TARGET) {
        this.removeTutorialHint();
        this.tutorialProgress = 0;
        addItem('old_watering_can', 1);
        advanceStory(); // → water_crops
        this.storyDialogue!.play(WATER_CROPS_DIALOGUE, () => {
          this.showTutorialHint(this.hintText('→ 对已播种的土地按 [E] 键浇水', '→ 对已播种的土地点「交互」浇水'));
          this.updateHUD();
        });
      }
      return;
    }

    if (step === 'water_crops' && action === 'water') {
      this.tutorialProgress++;
      this.showTutorialHint(`→ 浇水 ${this.tutorialProgress}/${this.TUTORIAL_TARGET}`);
      if (this.tutorialProgress >= this.TUTORIAL_TARGET) {
        this.removeTutorialHint();
        advanceStory(); // → evening_talk
        this.storyDialogue!.play(EVENING_DIALOGUE, () => {
          this.showTutorialHint(this.hintText('→ 回到床前按 [E] 睡觉，结束第一天', '→ 回到屋内床前点「交互」睡觉，结束第一天'));
          this.updateHUD();
        });
      }
      return;
    }
  }

  /** 教程晚间睡觉 */
  private tryTutorialSleep(): boolean {
    if (getStoryStep() !== 'evening_talk') return false;
    this.sleeping = true;
    try {
      advanceStory(); // → done
      addItem('old_axe', 1); // 完成教程赠送斧头（解锁砍树玩法）
      this.removeTutorialHint();
      this.showDialogueText('第一天：归乡 — 游戏保存中…');
      timeNextDay();
      resetDailyEvents(); // 重置日常事件
      resetStamina();
      resetOres();
      refreshDailyQuests();
      injectGuideQuests(); // 教程完成 → 投放挖矿/砍树引导任务（此时已获得斧头）
      this.createDailyQuestPanel();
      this.refreshFarmVisual();
      this.rebuildNPCs();
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      } as any);
      this.updateHUD();
      this.updateQuestHUD(); // 教程完成 → 切换到主线任务目标
      return true;
    } finally {
      this.sleeping = false;
    }
  }

  /**
   * 刷新任务追踪卡 HUD（左侧，UI v1.0 归星记录册风格）
   * 标题：主线任务·星之碎片（教程期=教程引导）；目标：getQuestObjective()
   * PC 端完整卡片；移动端紧凑单行
   */
  updateQuestHUD(): void {
    // 第一章 P0 残留清理（2026-08-13 制作人拍板）：chapter>=1 后第0章"星之碎片"任务已结束，
    // 隐藏 HUD 任务追踪卡（玩家心理已从"完成任务"转为"开始生活"，旧卡会自我否定章节转换）
    if (isChapterAtLeast(CHAPTER_1)) {
      this.hudQuestDom.style.display = 'none';
      return;
    }
    const state = getQuestState();
    // 主线完成且观星夜也完成：任务全部结束，隐藏追踪卡
    if (state === 'completed' && isObservatoryComplete()) {
      this.hudQuestDom.style.display = 'none';
      return;
    }
    this.hudQuestDom.style.display = 'block';
    const obj = getQuestObjective();
    const pc = !isMobileLayout();
    const title = pc
      ? (isTutorialDone() ? '主线任务 · 星之碎片' : '新手引导')
      : (isTutorialDone() ? '✦ 星之碎片' : '✦ 引导');
    const stateColor = pc
      ? (state === 'completed' ? '#a5c08e' : state === 'collected' ? '#8fb0d0' : state === 'accepted' ? '#d8c49a' : '#d8c49a')
      : '#d8c49a';
    this.hudQuestDom.style.borderLeftColor = stateColor;
    // 目标文本中插入目标图标（金币/物品 emoji 已含 HTML，直接 innerHTML）
    this.hudQuestDom.innerHTML = pc
      ? `<div style="display:flex;align-items:center;gap:6px;">
           <span style="font-size:13px;color:#d8c49a;text-shadow:1px 1px 0 #000;">✦</span>
           <span style="font-size:13px;font-weight:bold;color:#e5d9bd;text-shadow:1px 1px 0 #000;white-space:nowrap;">${title}</span>
         </div>
         <div style="font-size:12px;color:#e8e0d0;margin-top:2px;text-shadow:1px 1px 0 #000;line-height:1.35;">${obj}</div>`
      : `<span style="font-size:12px;color:#e5d9bd;text-shadow:1px 1px 0 #000;white-space:nowrap;">✦ ${title}：${obj}</span>`;
  }

  /** 触屏背包按钮：对话/面板/切图期间不响应（对应键盘 B） */
  private tryOpenBackpack(): void {
    if (this.transitioning) return;
    if (this.storyDialogue && this.storyDialogue.isOpen()) return;
    if (this.shopPanel.isOpen() || this.backpackPanel.isOpen() || this.questPanel.isOpen()) return;
    this.inputManager.clearAction();
    this.backpackPanel.open();
  }

  /** 触屏任务按钮：对话/面板/切图期间不响应（对应键盘 J，打开任务面板 QuestPanel） */
  private tryOpenQuest(): void {
    if (this.transitioning) return;
    if (this.storyDialogue && this.storyDialogue.isOpen()) return;
    if (this.shopPanel.isOpen() || this.backpackPanel.isOpen()) return;
    this.inputManager.clearAction();
    this.questPanel.open();
  }

  /** 教程提示文案：移动端（无键盘）与桌面端差异 */
  private hintText(pc: string, mob: string): string {
    return isMobileLayout() ? mob : pc;
  }

  /** 未开放区域边界提示（P1）：靠近世界边界（非出口触发区）轻提示一次；离开边界带后重置 */
  private updateBoundaryTip(): void {
    // 仅开放地图生效；house 室内 / gate 车站剧情场景不提示
    if (this.mapKey !== 'farm' && this.mapKey !== 'forest' && this.mapKey !== 'town' && this.mapKey !== 'mine') return;
    // 教程未完成不提示（避免与教程引导抢占注意力）
    if (!isTutorialDone()) return;
    const wb = this.physics.world.bounds;
    const M = 24; // 边界检测带宽度（px，约 1.5 格）
    const x = this.player.x;
    const y = this.player.y;
    // 判断玩家靠近哪条边（可能同时靠近多条边，取最近的）
    const nearTop = y <= wb.y + M;
    const nearBottom = y >= wb.bottom - M;
    const nearLeft = x <= wb.x + M;
    const nearRight = x >= wb.right - M;
    if (!nearTop && !nearBottom && !nearLeft && !nearRight) {
      // 回到地图内部 → 重置 flag，再次靠近可再提示
      this.boundaryTipShown = false;
      return;
    }
    // 检查该边是否有出口（有出口 = 可通行区域，不弹提示）
    const exits = MAP_EXITS[this.mapKey] ?? [];
    const hasExitOnEdge = (edge: 'top' | 'bottom' | 'left' | 'right'): boolean => {
      for (const ex of exits) {
        if (!this.isExitOpen(ex)) continue;
        switch (edge) {
          case 'top':    if (ex.y <= wb.y + M) return true; break;
          case 'bottom': if (ex.y + ex.h >= wb.bottom - M) return true; break;
          case 'left':   if (ex.x <= wb.x + M) return true; break;
          case 'right':  if (ex.x + ex.w >= wb.right - M) return true; break;
        }
      }
      return false;
    };
    if ((nearTop && hasExitOnEdge('top')) || (nearBottom && hasExitOnEdge('bottom')) ||
        (nearLeft && hasExitOnEdge('left')) || (nearRight && hasExitOnEdge('right'))) {
      return; // 该边有出口，不弹提示
    }
    if (!this.boundaryTipShown) {
      this.boundaryTipShown = true;
      this.showDialogueText('前面的区域，以后再来探索吧！');
    }
  }

  /**
   * 显示自定义文字对话框（3 秒后自动消失）
   * 用于任务对话/采集提示等非 NPC 固定台词
   * PC：玩家头顶跟随（不变）
   * 移动端：屏幕底部固定居中（setScrollFactor 0），避开摇杆/按钮
   */
  /** E-09 消磨时间：打开等待面板（22:00 后就寝前可用） */
  private tryOpenWait(): void {
    if (getTime().hour >= 22) {
      this.showDialogueText('已经到就寝时间了，去睡吧。');
      return;
    }
    openWaitPanel(
      (targetHour) => this.doWait(targetHour),
      () => {
        this.inputManager.clearAction();
        this.lastFrameTime = performance.now();
      },
    );
  }

  /** E-09 执行等待：推进到目标时间（不超过 22:00），不跨天 */
  private doWait(targetHour: number): void {
    const now = getTime();
    // targetHour ≤ 12 视为相对增量（小憩 2h / 午觉 4h）；18/20 为绝对目标时段
    const destHour = Math.min(targetHour <= 12 ? now.hour + targetHour : targetHour, 22);
    if (destHour <= now.hour) {
      this.showDialogueText('还不到能等到更晚的时候……');
      return;
    }
    this.fadeWaitTransition(destHour);
  }

  /** 渐暗 → 时间推进 → 渐亮（视觉反馈，不突然跳时间） */
  private fadeWaitTransition(destHour: number): void {
    let fade = document.getElementById('wait-fade');
    if (!fade) {
      fade = document.createElement('div');
      fade.id = 'wait-fade';
      fade.style.cssText =
        'position:fixed;inset:0;z-index:205;background:#000;opacity:0;pointer-events:none;transition:opacity 0.28s ease;';
      document.body.appendChild(fade);
    }
    fade.style.opacity = '0.68';
    // BUG-FIX（P1）：改走 delayedCall + isActive 守卫——裸 setTimeout 在切图/重启后回调迟到，
    // 会在已销毁场景上调 updateHUD（B3/B4 延迟回调存档守卫纪律）
    this.time.delayedCall(420, () => {
      setTime(destHour, 0);
      refreshSchedule(); // NPC 位置按新时间刷新
      if (this.scene.isActive()) this.updateHUD();
      if (fade) fade.style.opacity = '0';
    });
  }

  private showDialogueText(text: string): void {
    if (this.dialogueText) {
      this.dialogueText.destroy();
      this.dialogueText = null;
    }
    if (this.dialogueTimer) {
      this.dialogueTimer.remove();
      this.dialogueTimer = null;
    }
    const mobile = isMobileLayout();
    // 移动端：屏幕底部居中；PC：玩家头顶跟随
    const x = mobile ? this.scale.width / 2 : this.player.x;
    const y = mobile ? this.scale.height - 180 : this.player.y - 24;
    const originX = 0.5;
    const originY = mobile ? 1 : 0.5;
    const scrollFactor = mobile ? 0 : 1;
    const fontSize = mobile ? '14px' : '12px';
    const wrapWidth = mobile ? this.scale.width - 120 : 300;

    this.dialogueText = this.add
      .text(x, y, text, {
        fontFamily: 'Arial',
        fontSize,
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 6, y: 4 },
        wordWrap: { width: wrapWidth },
      })
      .setOrigin(originX, originY)
      .setScrollFactor(scrollFactor)
      .setDepth(200);
    this.dialogueTimer = this.time.delayedCall(4000, () => {
      if (this.dialogueText) {
        this.dialogueText.destroy();
        this.dialogueText = null;
      }
      this.dialogueTimer = null;
    });
  }

  /**
   * 触发日常事件（归星岛复兴循环 v0.10）
   * 随机选择一个可触发的事件，播放对话
   */
  private triggerDailyEvent(): void {
    // 守卫：对话已打开时不打断（避免每日事件覆盖主线/交付/教程对话，BUG：交付观星引导被吞）
    if (this.storyDialogue?.isOpen?.()) return;
    // 守卫：runner 占用（对话刚结束/演出切换窗口）时不插话
    // BUG-FIX：与老周对话刚结束的整点窗口 → 夏雅日常凭空弹出（串线）
    if (this.storySequenceRunner?.isPlaying?.()) return;
    const event = triggerRandomEvent();
    if (!event) return;
    // 守卫：发言 NPC 不在场时不凭空说话（BUG：老周在 farm 干活，夏雅人不在却弹出"下午好呀"）
    // 事件已被标记今日已触发 → 语义为"今天没遇上"，次日可再触发
    if (!this.isDailyEventSpeakerPresent(event.id)) return;

    // 使用 playStory 统一播放事件对话
    this.playStory(event.dialogue, undefined, undefined, 'daily_event');
  }

  /**
   * BUG-FIX：日常事件发言 NPC 在场检查（防"凭空说话"穿帮）
   * 事件 id 前缀与 NPCSystem id 对齐（elder_/gardener_/miner_/adventurer_）；
   * 夏雅不在 NPCSystem（特殊剧情精灵），用 xiya_ 前缀特判，任一夏雅形态精灵在场即可。
   */
  private isDailyEventSpeakerPresent(eventId: string): boolean {
    if (eventId.startsWith('xiya_')) return this.isXiyaVisibleInScene();
    const npcId = eventId.split('_')[0];
    if (!npcId) return true;
    // 判定模式与 findNearestNPC 一致：无 sprite / 已消失 / 不可见 → 不在场
    return this.npcList.some((n) => n.id === npcId && n.sprite && !n.vanished && n.sprite.visible);
  }

  /** 夏雅在当前场景是否有可见活动精灵（dryyardXiya 是旧照片装饰，不算真人在场） */
  private isXiyaVisibleInScene(): boolean {
    const sprites = [
      this.xiyaSprite, this.dawnXiya, this.morningXiya, this.eveningXiya,
      this.riversideXiya, this.gardenXiya, this.artShowXiya,
      this.artShowAfterXiya, this.letterXiya, this.bloomXiya,
    ];
    return sprites.some((s) => !!s && s.visible);
  }

  /**
   * BUG-026 A1：无效操作反馈——目标格短暂红闪 + 低音（区分成功反馈）
   * 用独立闪烁矩形叠加，不改原 rect 的 fillStyle，避免破坏格子恢复逻辑
   */
  private flashTileError(col: number, row: number): void {
    const cx = col * TILE_SIZE + TILE_SIZE / 2;
    const cy = row * TILE_SIZE + TILE_SIZE / 2;
    const flash = this.add
      .rectangle(cx, cy, TILE_SIZE, TILE_SIZE, 0xff6b5e, 0.55)
      .setDepth(4)
      .setScrollFactor(1);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 260,
      onComplete: () => flash.destroy(),
    });
    play('invalid');
  }

  /**
   * Plot 级无效操作反馈：整块田红闪 + 低音（批量模式的 flashTileError 等价物）
   * 种植区域交互优化 v0.1
   */
  private flashPlotError(plotId: FarmPlotId): void {
    const r = getPlotRect(plotId);
    const flash = this.add
      .rectangle(r.x + r.width / 2, r.y + r.height / 2, r.width, r.height, 0xff6b5e, 0.32)
      .setDepth(8)
      .setScrollFactor(1);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });
    play('invalid');
  }

  /**
   * BUG-026 A2：格子处成功飘字（播种/收获/浇水等奖励瞬间）
   * 在世界坐标格子处上浮淡出；带描边保证可读性
   */
  private showFloatText(worldX: number, worldY: number, text: string, color = '#ffe082'): void {
    const t = this.add
      .text(worldX, worldY - 4, text, {
        fontFamily: 'Arial',
        fontSize: '13px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(201)
      .setScrollFactor(1);
    this.tweens.add({
      targets: t,
      y: t.y - 22,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /**
   * 浇水反馈：水花粒子（零资源，纯 Graphics + tween）
   * 制作人反馈：手机端模型小、浇水特效不明显 → 格子上方喷出 6 滴水珠，
   * 即使是 FIT 小画布也能感知"这次浇水成功了"。
   * 纯视觉装饰，不触碰状态/存档/玩法逻辑；tween 完成后自动销毁。
   */
  private waterSplash(worldX: number, worldY: number): void {
    const DROP_COUNT = 6;
    for (let i = 0; i < DROP_COUNT; i++) {
      const drop = this.add.circle(worldX, worldY - 2, 2.2, 0x9fd8f5, 0.95);
      drop.setDepth(6);
      // 向上扇形喷射（-135° ~ -45°，y 轴向下故取负角），随机距离 10-20px
      const angle = Phaser.Math.FloatBetween(-Math.PI * 0.75, -Math.PI * 0.25);
      const dist = Phaser.Math.Between(10, 20);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 4;
      this.tweens.add({
        targets: drop,
        x: worldX + dx,
        y: worldY + dy,
        alpha: 0,
        scale: 0.35,
        duration: Phaser.Math.Between(320, 560),
        ease: 'Quad.Out',
        onComplete: () => drop.destroy(),
      });
    }
  }

  // ============ v1.0 生活仪式感：普通动作即时反馈（零资源 Graphics/emoji，tween 自动销毁） ============

  /** 锄地土屑：6 颗土色颗粒向两侧扇形喷出 + 渐隐（每次锄地） */
  private soilDust(worldX: number, worldY: number): void {
    const COLORS = [0x8a6a42, 0x6a4a28, 0x9a7a50];
    for (let i = 0; i < 6; i++) {
      const p = this.add.circle(worldX, worldY, 1.8, COLORS[i % 3], 0.9);
      p.setDepth(6);
      const angle = Phaser.Math.FloatBetween(-Math.PI * 0.9, -Math.PI * 0.1);
      const dist = Phaser.Math.Between(8, 16);
      this.tweens.add({
        targets: p,
        x: worldX + Math.cos(angle) * dist,
        y: worldY + Math.sin(angle) * dist - 3,
        alpha: 0, scale: 0.3,
        duration: Phaser.Math.Between(260, 460),
        ease: 'Quad.Out',
        onComplete: () => p.destroy(),
      });
    }
  }

  /** 播种落种：🌱 从上方落入土中 + 土粒覆盖 + 小芽短暂出现（每次播种，快速不打断） */
  private seedDrop(worldX: number, worldY: number): void {
    const seed = this.add.text(worldX, worldY - 14, '🌱', { fontSize: '13px' }).setOrigin(0.5).setDepth(7);
    this.tweens.add({
      targets: seed, y: worldY - 4, alpha: 0.9,
      duration: 220, ease: 'Quad.In',
      onComplete: () => seed.destroy(),
    });
    // 土粒覆盖（3 颗小土点落向落点）
    for (let i = 0; i < 3; i++) {
      const g = this.add.circle(worldX + Phaser.Math.Between(-5, 5), worldY - 8, 1.4, 0x7a5a38, 0.85);
      g.setDepth(6);
      this.tweens.add({
        targets: g, y: worldY - 3, alpha: 0,
        duration: 280, ease: 'Quad.In',
        onComplete: () => g.destroy(),
      });
    }
    // 小芽短暂出现（绿点 + 两片小叶，模拟"种下去了"）
    const sprout = this.add.graphics();
    sprout.fillStyle(0x5a8a3a, 0.95);
    sprout.fillCircle(worldX, worldY - 6, 1.6);
    sprout.fillRect(worldX - 1, worldY - 7.5, 1, 2.2);
    sprout.fillRect(worldX + 0.6, worldY - 7.8, 1.2, 1.8);
    sprout.setDepth(6);
    this.tweens.add({
      targets: sprout, alpha: 0, scaleY: 1.25,
      duration: 460, ease: 'Quad.Out', delay: 120,
      onComplete: () => sprout.destroy(),
    });
  }

  /** 浇水湿润：格子深棕湿润色 overlay 渐隐（每次浇水，配合水花粒子） */
  private moistDarken(worldX: number, worldY: number): void {
    const wet = this.add.graphics();
    wet.fillStyle(0x4a3018, 0.4);
    wet.fillRoundedRect(worldX - 7, worldY - 7, 14, 14, 3);
    wet.setDepth(4);
    this.tweens.add({
      targets: wet, alpha: 0,
      duration: 320, ease: 'Quad.Out',
      onComplete: () => wet.destroy(),
    });
  }

  /** first moment 柔和高亮：格子圆形光晕渐隐（第一次锄地/播种用，500ms） */
  private tileGlowHighlight(worldX: number, worldY: number, color = 0xffe082): void {
    const glow = this.add.graphics();
    glow.fillStyle(color, 0.55);
    glow.fillCircle(worldX, worldY, 9);
    glow.setDepth(5);
    this.tweens.add({
      targets: glow, alpha: 0, scale: 1.5,
      duration: 520, ease: 'Quad.Out',
      onComplete: () => glow.destroy(),
    });
  }


  /**
   * 批量浇水反馈：区域水波扩散（从 Plot 中心向外扩散的两圈圆环）
   * 替代 16 次逐格水花——一次操作感知"整块田都浇到了"。
   * 纯视觉装饰，不触碰状态/存档；tween 完成后自动销毁。
   */
  private plotWaterRipple(plotId: FarmPlotId): void {
    const c = getPlotCenter(plotId);
    const r = getPlotRect(plotId);
    const maxR = Math.max(r.width, r.height) * 0.55;
    for (let i = 0; i < 2; i++) {
      const ring = this.add
        .circle(c.x, c.y, maxR, 0x9fd8f5, 0)
        .setStrokeStyle(3, 0xcdefff, 0.95)
        .setDepth(6);
      ring.setScale(0.06 + i * 0.06);
      ring.setAlpha(0.55);
      this.tweens.add({
        targets: ring,
        scaleX: 1,
        scaleY: 1,
        alpha: 0,
        duration: 650,
        delay: i * 170,
        ease: 'Quad.Out',
        onComplete: () => ring.destroy(),
      });
    }
  }

  /** v0.5.3：NPC 每日随机句的"当天已说过"内存标记（不进入存档） */
  private npcDailySaid = new Map<string, number>();

  /**
   * 播放 NPC 对话（靠近 NPC 按 E 触发，全屏打字机剧本）
   * 使用 StoryDialogue 全屏播放 npc.dialogues
   * v0.5.3：当日首次对话时，在固定对白之后追加一句随机生活台词
   */
  private showDialogue(npc: NPC): void {
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    // v0.5.3 剧情密度：当日首次对话时追加随机生活句（只对老张/小梅/阿风）
    // 2026-08-16 逻辑修复：阿风按当前所在场景选固定对白——他在后山(forest)时不说「有空来后山带你转转」
    const baseLines = npc.id === 'adventurer'
      ? getAdventurerDialogue(npc.currentLocation)
      : npc.dialogues;
    let lines = baseLines;
    const today = getTime().day;
    // 去重粒度：小梅按「NPC+位置」当天各说一次时段对白（上午农场/下午后山都能各触发一句，
    // 世界在回应时间才真正可感知）；其余 NPC 沿用「按天各说一次」，避免量级变化导致话痨。
    const dedupKey = npc.id === 'gardener' ? `${npc.id}:${npc.currentLocation}` : npc.id;
    if (this.npcDailySaid.get(dedupKey) !== today) {
      // P1 时段切片：把当前所在场景传给 getDailyNpcLine（小梅据此切换上午/下午口吻）
      const daily = getDailyNpcLine(npc.id, today, npc.currentLocation);
      if (daily) {
        // 用 baseLines 而非 npc.dialogues——阿风在后山(forest)时生活句应拼到后山变体上
        lines = [...baseLines, ...daily];
        this.npcDailySaid.set(dedupKey, today);
      }
    }
    // v0.5.3 剧情密度 E6：观星夜后少女追加一句（仅观星完成，追加到固定对话末尾）
    if (npc.id === 'mystery' && isObservatoryComplete()) {
      lines = [...lines, ...getMysteryAfterObservatory()];
    }
    // 2026-08-11 制作人拍板（商人回镇 + 商店剧情化）：镇子商店状态剧情（关闭 → 带作物开店 → 营业）
    // 优先级最高：触发时完全替代默认欢迎词（避免「店门关着还欢迎光临」的矛盾）
    // BUG 修复（2026-08-11）：三个商店 build 必须守卫 npc.id === 'shopkeeper'——
    // 此前无守卫，任何 NPC（神秘女/阿风等）对话都会命中商店剧情，台词被覆盖成商店老板的。
    const isShop = npc.id === 'shopkeeper';
    const stateLines = isShop ? this.buildShopStateDialogue() : null;
    // T3.5 商店老板「镇子热闹了」：首次卖出作物后，白天对话触发（一次性）
    // 在欢迎剧本前注入入口对白（asked）或交付链（done），不抢走 shopkeeper 打开商店流程
    const shopSide = isShop ? this.buildShopSideDialogue() : null;
    // SHOP-01 商店复兴：老板「复兴度观察者」三阶段台词（档位推进才播，优先级低于 T3.5 事件链）
    const revivalLines = isShop ? this.buildShopRevivalDialogue() : null;
    // 星光艺术展余波：旅人离镇前在商店留了张便条，老板第一次提到（一次性，随后正常营业）
    const travelerNoteLines = isShop && this.artShowPerm ? this.buildTravelerNoteDialogue() : null;
    // 钓鱼 Phase 4：NPC 交换（最高优先级——未换过 + 背包有对应鱼时完全替代默认对白）
    const fishEx = this.buildFishExchangeDialogue(npc);
    // 采集流向扩展：NPC 交换（次高优先级——鱼交换未命中时尝试采集交换；小梅/老张）
    const gatherEx = this.buildGatherExchangeDialogue(npc);
    // 种植升级 v2：作物赠予（萝卜×老张赠予+腌萝卜罐 / 玉米×小镇丰收台词；三条去向之一=关系与生活反馈）
    const cropEx = this.buildCropGiftDialogue(npc);
    // 小镇计划·星光艺术展：人际准备注入（镇长协调 / 老周旧照片 / 小梅花艺；未参与过时替代默认对白）
    const artShowLines = this.buildArtShowDialogue(npc);
    // 小镇计划·秋日晒场：人际三时代注入（老张·过去旧手艺 / 阿风·未来搭把手；晒场夏雅走独立交互点）。
    // 优先于日常交换类——EventPlan 阶段推进 > 生活交换（dryyardUnlocked 且人际未完成时才命中）。
    const dryyardLines = this.buildDryyardDialogue(npc);
    const finalLines = dryyardLines
      ? dryyardLines
      : fishEx
      ? fishEx.lines
      : gatherEx
        ? gatherEx.lines
        : cropEx
          ? cropEx.lines
      : artShowLines
        ? artShowLines
      : stateLines
        ? stateLines
        : shopSide
          ? [...shopSide, ...(revivalLines ?? []), ...(travelerNoteLines ? [...travelerNoteLines, ...lines] : lines)]
          : revivalLines
            ? [...revivalLines, ...(travelerNoteLines ? [...travelerNoteLines, ...lines] : lines)]
            : travelerNoteLines
              ? [...travelerNoteLines, ...lines]
              : lines;
    // 动作时间成本（P0 Action Time）：一次 NPC 对话消耗 n 游戏分钟（可调）
    consumeMinutes(getActionTimeCost('dialogue'));
    this.playStory(finalLines, () => {
      // BUG-041：神秘少女对白末尾「消失在林间」→ 对话完成隐藏精灵（演出层，不存档）
      if (npc.id === 'mystery') {
        npc.setVanished();
      }
      // 商店老板：对话结束后自动打开商店
      // 商店状态剧情（关闭/待开店）时不打开——仅 'opened'（营业中）才弹商店面板
      if (npc.id === 'shopkeeper' && this.shopState === 'opened') {
        this.inputManager.clearAction();
        this.shopPanel.open();
      }
    }, fishEx ? fishEx.onChoice : gatherEx ? gatherEx.onChoice : cropEx ? cropEx.onChoice : undefined);
  }

  /**
   * T3.5 商店老板「镇子热闹了」事件链（build 模式，供 showDialogue 注入）：
   * - 未卖出作物 / 夜间 / 已完成 → 返回 null（走正常商店剧本）
   * - 首次（asked 未置位）→ 置位 asked + 返回入口对白
   * - 已 asked 且作物≥3 → 聚合扣除 + 置位 done + 返回完成对白（含记忆卡回调）
   * - 已 asked 且作物<3 → 返回提示对白（不扣不完成）
   */
  private buildShopSideDialogue(): DialogueLine[] | null {
    if (this.sideShopCropDone) return null;
    if (!this.shopSoldOnce) return null;
    const hour = getTime().hour;
    if (hour < 6 || hour >= 18) return null;

    if (!this.sideShopCropAsked) {
      this.sideShopCropAsked = true;
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      } as any);
      return SHOP_CROP_ENTRY_DIALOGUE;
    }

    const FOOD_ITEMS = ['radish', 'tomato', 'corn', 'strawberry'] as const;
    const have = FOOD_ITEMS.reduce((sum, id) => sum + getItemCount(id), 0);
    if (have < 3) {
      return SHOP_CROP_NEED_DIALOGUE;
    }

    let need = 3;
    for (const id of FOOD_ITEMS) {
      const c = getItemCount(id);
      if (c <= 0) continue;
      const take = Math.min(c, need);
      addItem(id, -take);
      need -= take;
      if (need <= 0) break;
    }
    this.sideShopCropDone = true;
    // 完成对白后接记忆卡（通过完成后回调链：对话结束 → 闪回 → 回响）
    const doneLines = [...SHOP_CROP_DONE_DIALOGUE];
    queueMicrotask(() => {
      // 在 showDialogue 的完成回调之后触发闪回（延迟一拍，避免打断对白收尾）
      setTimeout(() => {
        playMemoryFlashback(SHOP_CROP_FLASHBACK, () => {
          showMemoryMoment('店里的货，越来越有人买了。');
          this.updateHUD();
          this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
        });
      }, 250);
    });
    return doneLines;
  }

  /**
   * 2026-08-11 制作人拍板（商人回镇 + 商店剧情化）：镇子商店状态剧情机
   * build 模式，供 showDialogue 注入（优先级最高——触发时完全替代默认欢迎词）：
   * - 'none'（白天首次对话）→ 关闭剧情（老板 + 夏雅各一句）→ 转 'closed' + 入档，不打开商店
   * - 'closed' 且携带作物 → 扣除 1 个作物 → 开店剧情（「青禾镇今年第一次收到的新鲜蔬菜」+ 复兴反馈）→
   *   转 'opened' + 更新门面 + 入档，对话结束由 showDialogue 打开商店
   * - 'closed' 且无作物 → 短台词提示（店门还关着，等有新鲜东西）
   * - 'opened' → null（走正常商店剧本：T3.5 送菜链 / SHOP-01 复兴台词 / 欢迎词）
   * 台词内联于 MapScene（StorySystem 冻结区单写者制，不新增剧情数据）。
   */
  private buildShopStateDialogue(): DialogueLine[] | null {
    if (this.shopState === 'opened') return null;
    const FOOD_ITEMS = ['radish', 'tomato', 'corn', 'strawberry'] as const;
    const have = FOOD_ITEMS.reduce((sum, id) => sum + getItemCount(id), 0);

    if (this.shopState === 'none') {
      this.shopState = 'closed';
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      } as any);
      return [
        { speaker: '', color: COLORS.system, text: '（招牌还挂着，店门却关得严严实实，门上钉着一块木板。）' },
        { speaker: '商店老板', color: '#8ac8a0', text: '以前这里每天都有人来，现在大家都没什么心气了。' },
        { speaker: '夏雅', color: COLORS.xiya, text: '以前爷爷他们还在的时候，镇上的集市很热闹。' },
        { speaker: '商店老板', color: '#8ac8a0', text: '要是你能种出点新鲜东西来……说不定这店，还能重新开起来。' },
        { speaker: '商店老板', color: '#8ac8a0', text: '店现在还没重新开起来，不过我留了个旧售货机，至少不会让你连种子都买不到。' },
      ];
    }

    // shopState === 'closed'：等待第一批农产品开店
    if (have <= 0) {
      return [
        { speaker: '商店老板', color: '#8ac8a0', text: '店门还关着……等有新鲜东西再说吧。' },
      ];
    }

    // 有作物：扣除 1 个作为第一批货，开店（复兴反馈通过台词表达，不新增数值系统）
    let need = 1;
    for (const id of FOOD_ITEMS) {
      const c = getItemCount(id);
      if (c <= 0) continue;
      const take = Math.min(c, need);
      addItem(id, -take);
      need -= take;
      if (need <= 0) break;
    }
    this.shopState = 'opened';
    this.updateTownShopVisual();
    // 2026-08-11 制作人拍板：开店瞬间反馈（door_open 音效 + 招牌弹起，纯演出层零存档风险）
    play('door_open');
    const mark = this.townShop?.mark;
    if (mark) {
      mark.setScale(0.8, 0.8);
      this.tweens.add({
        targets: mark,
        scaleX: 1,
        scaleY: 1,
        duration: 320,
        ease: 'Back.Out',
      });
    }
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    return [
      { speaker: '', color: COLORS.system, text: '（林澈把第一批作物放在了柜台上。）' },
      { speaker: '商店老板', color: '#8ac8a0', text: '这是青禾镇今年第一次收到的新鲜蔬菜。' },
      { speaker: '商店老板', color: '#8ac8a0', text: '……行，这店，重新开张！' },
      { speaker: '', color: COLORS.system, text: '（店铺重新营业了。镇子，好像又活过来了一点。）' },
    ];
  }

  /**
   * SHOP-01 商店复兴：老板「复兴度观察者」三阶段台词（2026-08-09 制作人拍板）
   * - 档位 = getRevivalLevel()（Lv0 荒废 / Lv1 初步恢复 / Lv2 小型社区），三建设点派生
   * - 只在档位推进时播一次（shopRevivalTier 入档，读档不重复）：
   *   Lv0 首次开店 → 「好久没人买这么多东西了。」（冷清）
   *   Lv1 到达     → 「最近镇上的人好像又多起来了。」（有人气）
   *   Lv2 到达     → 「没想到这间店还能重新热闹起来。」（重新营业感）
   * - 台词内联于 MapScene（StorySystem 冻结区单写者制，只读导入，不新增剧情数据）
   */
  private buildShopRevivalDialogue(): DialogueLine[] | null {
    const tier = getRevivalLevel();
    if (tier <= this.shopRevivalTier) return null;
    this.shopRevivalTier = tier;
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    const lines: DialogueLine[] = tier === 0
      ? [{ speaker: '商店老板', color: '#8ac8a0', text: '好久没人买这么多东西了。' }]
      : tier === 1
        ? [{ speaker: '商店老板', color: '#8ac8a0', text: '最近镇上的人好像又多起来了。' }]
        : [{ speaker: '商店老板', color: '#8ac8a0', text: '没想到这间店还能重新热闹起来。' }];
    return lines;
  }

  /**
   * 星光艺术展余波·商店留言：旅人离镇前在商店留了张便条，老板第一次向玩家提起（一次性）。
   * 触发：`artShowPerm`（艺术展已办完）+ 未读过便条 → 老板谈到旅人的留言，随后照常营业。
   * 依据：任务卡 §五.1「永久变化存在：商店留言」。台词方向稿，制作人定稿前可替换。
   */
  private buildTravelerNoteDialogue(): DialogueLine[] | null {
    if (hasTriggered('artshow_traveler_note')) return null;
    if (this.shopState !== 'opened') return null; // 店门关着时不留便条语境
    triggerOnce('artshow_traveler_note', () => {
      // 仅标记已读；便条是"留下的一句话"，不兑现物品
    });
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    return [
      { speaker: '', color: COLORS.system, text: '（柜台上压着一张字条，字迹有点潦草。老板见你看过去，开口说：）' },
      { speaker: '商店老板', color: '#8ac8a0', text: '那位画画的朋友走之前，在这儿留了句话。' },
      { speaker: '商店老板', color: '#8ac8a0', text: '"这镇子把光留下了。我把它画下来，带回去给别人看。"' },
      { speaker: '商店老板', color: '#8ac8a0', text: '……没懂他说什么。不过，有人把这里记在心里，总归是好事。' },
    ];
  }

  /**
   * 渲染农田可耕区域的格子覆盖层
   * P6a: 委托给 FarmController
   */
  private setupFarmTiles(): void {
    this.farmController.setupFarmTiles();
  }

  /**
   * 根据土地状态刷新单格视觉
   * P6a: 委托给 FarmController
   */
  private updateTileVisual(col: number, row: number, visual: TileVisual): void {
    this.farmController.updateTileVisual(col, row, visual);
  }

  /**
   * 刷新 HUD 文本（区域名 + 天数 + 金币 + 操作提示，农场额外显示种子/萝卜）
   * PC：完整单行（含操作提示 WASD/E/出口切换）
   * 移动端：精简两行，删除操作提示（摇杆+按钮已是教学）
   *   农场：第一行 区域名+天数，第二行 种子/萝卜/金币
   *   其他：第一行 区域名+天数，第二行 金币
   */
  private updateHUD(): void {
    const name = MAP_NAMES[this.mapKey] ?? this.mapKey;
    const day = `第${getTime().day}天`;
    const coins = `${itemIconHtml('coin', 13)}${getCoins()}`;
    const diamonds = `${itemIconHtml('diamond', 13)}${getItemCount('diamond')}`;
    const stamina = `${itemIconHtml('stamina', 13)}${getStamina()}/${MAX_STAMINA}`;
    const lv = `Lv.${getLevel()}`;
    const seedDef = CROP_DEFS[this.selectedCropType];
    const seedItem = seedDef.seedItem as any;
    const seedInfo = `${itemIconHtml(seedItem, 13)}${seedDef.name}种子:${getItemCount(seedItem)}`;
    // 农场触屏：种子切换按钮显示当前种子 + 库存（仅触屏设备）
    if (this.seedSwitchBtn) {
      const show = isTouchDevice() && this.mapKey === 'farm';
      this.seedSwitchBtn.style.display = show ? 'block' : 'none';
      if (show) this.seedSwitchBtn.innerHTML = `${itemIconHtml(seedItem, 14)} ${seedDef.name}种子 · 库存 ${getItemCount(seedItem)} ▾`;
    }
    if (isMobileLayout()) {
      if (this.mapKey === 'farm') {
        this.hudAreaDom.innerHTML = `${name} ${day} ${lv} | ${stamina} ${seedInfo} ${coins} ${diamonds}`;
      } else {
        this.hudAreaDom.innerHTML = `${name} ${day} ${lv} | ${stamina} ${coins} ${diamonds}`;
      }
    } else {
      if (this.mapKey === 'farm') {
        this.hudAreaDom.innerHTML =
          `${name} | ${day} | ${lv} | ${stamina} | WASD/E交互 | R切换:${seedInfo} | ${coins} | ${diamonds} | 出口切换`;
      } else {
        this.hudAreaDom.innerHTML = `${name} | ${day} | ${lv} | ${stamina} | WASD 移动 | ${coins} | ${diamonds} | 出口切换`;
      }
    }
  }

  /**
   * 刷新所有农田格子的视觉（public，供 debug.nextDay 成长判定后调用）
   * 遍历 tileRects 重新读取 FarmState 状态并刷新显示
   */
  refreshFarmVisual(): void {
    for (const [key, visual] of this.tileRects) {
      const [col, row] = key.split(',').map(Number);
      this.updateTileVisual(col, row, visual);
    }
    this.updateHUD();
    // 土地回应系统 v1.4：同时 ≥3 格成熟作物 → 农田"活过来"（世界回应，一次性入档）
    this.checkFieldAlive();
    // 邮箱系统：跨天/收获后推进来信队列（2-3 天随机，事件信插队）
    this.updateMailQueue();
  }

  /**
   * 土地回应系统 v1.4（制作人 2026-08-15 拍板）：玩家长期种地 → 整个环境回应。
   * 触发：farm 同时有 ≥3 格成熟作物（世界状态，不做成就/生态值）→ crop_field_alive 一次性入档
   * → 农田边缘永久出现蝴蝶/蜜蜂 + 夏雅一句"感觉这片地又活过来了"（见 tryCropFieldAliveXiya）。
   */
  private checkFieldAlive(): void {
    if (this.mapKey !== 'farm') return;
    if (hasTriggered('crop_field_alive')) return;
    if (countGrownTiles() < 3) return;
    triggerOnce('crop_field_alive', () => { /* 仅标记：世界变化由 setupFieldLife 按事件状态渲染 */ });
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    // EventSystem 契约：fn 先执行→标记，save/后续渲染放 triggerOnce 之后（此刻事件已标记，守卫放行）
    this.setupFieldLife();
  }

  /** 农田"活过来"后的蝴蝶/蜜蜂（farm create 或触发时调用；随场景重建） */
  private setupFieldLife(): void {
    if (this.mapKey !== 'farm') return;
    if (!hasTriggered('crop_field_alive')) return;
    if (this.fieldLifeGfx) return; // 幂等
    const T = TILE_SIZE;
    const g = this.add.container(0, 0).setDepth(4);
    // 农田边缘草地（避开树位/花田/池塘/木屋/菜畦）
    this.createFieldButterfly(11 * T + T / 2, 10 * T + T / 2, g);
    this.createFieldButterfly(29 * T + T / 2, 10 * T + T / 2, g);
    this.createFieldButterfly(20 * T + T / 2, 7 * T + T / 2, g);
    this.createFieldBee(16 * T + T / 2, 7 * T + T / 2, g);
    this.createFieldBee(24 * T + T / 2, 17 * T + T / 2, g);
    this.fieldLifeGfx = g;
  }

  /** 农田氛围蝴蝶（非可捕捉，纯环境生命感；花色随机） */
  private createFieldButterfly(x: number, y: number, container: Phaser.GameObjects.Container): void {
    const t = this.pickButterflyType();
    const v = MapScene.BUTTERFLY_VARIANTS[t] ?? MapScene.BUTTERFLY_VARIANTS.yellow;
    const wings = this.add.graphics();
    wings.fillStyle(v.wing1, 1);
    wings.fillEllipse(-3, 0, 6, 4);
    wings.fillEllipse(3, 0, 6, 4);
    wings.fillStyle(v.body, 1);
    wings.fillCircle(0, 0, 1);
    const c = this.add.container(x, y, [wings]);
    container.add(c);
    this.tweens.add({ targets: wings, scaleX: { from: 1, to: 0.25 }, duration: 130, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: c, x: x + 8, y: y - 6, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  /** 农田氛围蜜蜂（黄身白翅小点，缓慢绕飞） */
  private createFieldBee(x: number, y: number, container: Phaser.GameObjects.Container): void {
    const bee = this.add.container(x, y);
    const body = this.add.graphics();
    body.fillStyle(0xe8c020, 1);
    body.fillEllipse(0, 0, 4, 3);
    body.fillStyle(0x202020, 1);
    body.fillRect(-1, -1, 2, 2);
    const wings = this.add.graphics();
    wings.fillStyle(0xe8f0f8, 0.75);
    wings.fillEllipse(-3, -1, 3, 2);
    wings.fillEllipse(3, -1, 3, 2);
    bee.add([body, wings]);
    container.add(bee);
    this.tweens.add({ targets: wings, scaleY: { from: 1, to: 0.2 }, duration: 100, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: bee, x: x + 10, y: y - 4, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  /**
   * P7a: 构建交互门控快照
   * 收集当前所有门控状态，供 InteractionRouter 判定
   */
  private buildGateSnapshot(): GateSnapshot {
    const cs = this.cutsceneGuard.getSnapshot();
    return {
      createFailed: this.createFailed,
      endingPanelOpen: !!this.endingPanel?.isOpen(),
      // P8: cutscene 旗标统一由 CutsceneGuard 管理
      inStargazeCutscene: cs.inStargazeCutscene,
      inArtShowCutscene: cs.inArtShowCutscene,
      inSpringFairCutscene: cs.inSpringFairCutscene,
      inDryyardCutscene: cs.inDryyardCutscene,
      firstMorningActive: cs.firstMorningActive,
      photoAlbumOpen: !!this.photoAlbumPanel?.isOpen(),
      discoveryOpen: isDiscoveryPanelOpen(),
      hudMenuOpen: isHudMenuOpen(),
      residentBoardOpen: !!this.residentBoardPanel?.isOpen(),
      shopOpen: this.shopPanel.isOpen(),
      backpackOpen: this.backpackPanel.isOpen(),
      questOpen: this.questPanel.isOpen(),
      waitPanelOpen: isWaitPanelOpen(),
    };
  }

  /**
   * P7b: 构建交互目标候选列表
   * 按 tryInteract 原 if-return 顺序排列（优先级从高到低）
   * 每个 check() 为纯函数（无副作用），仅返回是否命中
   * 
   * P7b 核心红线：目标解析优先级不可改变
   */
  private buildInteractionCandidates(): InteractionCandidate[] {
    return [
      // 1. house_tidy: 老屋整理（house 场景）
      {
        id: 'house_tidy',
        check: () => this.mapKey === 'house' && this.canTryHouseTidy(),
      },
      // 2. house_old_shadow: 旧日留影相框（house 场景）
      {
        id: 'house_old_shadow',
        check: () => this.mapKey === 'house' && this.canTrySideXiyaOldShadow(),
      },
      // 3. bed: 睡觉（house/farm 床铺）
      {
        id: 'bed',
        check: () => this.canTryBed(),
      },
      // 4. music_box: 音乐盒（house 场景）
      {
        id: 'music_box',
        check: () => this.mapKey === 'house' && !!this.musicBoxMark && this.canTryMusicBox(),
      },
      // 5. grandpa_gift: 归星包裹（house 场景）
      {
        id: 'grandpa_gift',
        check: () => this.mapKey === 'house' && !!this.grandpaGiftMark && this.canTryGrandpaGift(),
      },
      // 6. stargaze: 观星点
      {
        id: 'stargaze',
        check: () => this.canTryStargaze(),
      },
      // 7. butterfly: 捕虫（farm/town）
      {
        id: 'butterfly',
        check: () => (this.mapKey === 'farm' || this.mapKey === 'town') && this.canTryCatchButterfly(),
      },
      // 8. art_show_xiya: 星光艺术展夏雅
      {
        id: 'art_show_xiya',
        check: () => this.canTryArtShowXiya(),
      },
      // 9. art_show_box: 艺术展素材箱
      {
        id: 'art_show_box',
        check: () => this.canTryArtShowBox(),
      },
      // 10. art_show_traveler: 艺术展旅人
      {
        id: 'art_show_traveler',
        check: () => this.canTryArtShowTraveler(),
      },
      // 11. art_show_after_xiya: 艺术展后夏雅
      {
        id: 'art_show_after_xiya',
        check: () => this.canTryArtShowAfterXiya(),
      },
      // 12. dryyard_xiya: 秋日晒场夏雅
      {
        id: 'dryyard_xiya',
        check: () => this.canTryDryyardXiya(),
      },
      // 13. dryyard_box: 晒场征集筐
      {
        id: 'dryyard_box',
        check: () => this.canTryDryyardBox(),
      },
      // 14. dryyard_laozhang: 晒场老张
      {
        id: 'dryyard_laozhang',
        check: () => this.canTryDryyardLaozhang(),
      },
      // 15. laojiang: 钓鱼老人
      {
        id: 'laojiang',
        check: () => this.canTryLaoJiang(),
      },
      // 16. qinghe_pier: 青禾码头修复
      {
        id: 'qinghe_pier',
        check: () => this.mapKey === 'qinghe_river' && this.canTryQinghePier(),
      },
      // 16b. ch2_clock: 第二章·广场老钟（town）
      {
        id: 'ch2_clock',
        check: () => this.canTryCh2Clock(),
      },
      // 16c. ch2_captain: 第二章·码头老船长（qinghe_river）
      {
        id: 'ch2_captain',
        check: () => this.canTryCh2Captain(),
      },
      // 17. qinghe_pavilion: 青禾凉亭
      {
        id: 'qinghe_pavilion',
        check: () => this.mapKey === 'qinghe_river' && this.canTryQinghePavilion(),
      },
      // 18. qinghe_chatter: 青禾夜晚聊天
      {
        id: 'qinghe_chatter',
        check: () => this.mapKey === 'qinghe_river' && this.canTryQingheChatter(),
      },
      // 19. qinghe_old_man: 青禾老周
      {
        id: 'qinghe_old_man',
        check: () => this.mapKey === 'qinghe_river' && this.canTryQingheOldMan(),
      },
      // 20. qinghe_riverside_xiya: 河畔夏雅
      {
        id: 'qinghe_riverside_xiya',
        check: () => this.mapKey === 'qinghe_river' && this.canTryRiversideXiya(),
      },
      // 21. fishing: 钓鱼
      {
        id: 'fishing',
        check: () => !!MapScene.FISHING_SPOTS[this.mapKey] && this.canTryFishing(),
      },
      // 22. gather: 采集
      {
        id: 'gather',
        check: () => this.gatherNodes.length > 0 && this.canTryGather(),
      },
      // 23. lighthouse: 灯塔探索
      {
        id: 'ch3_archive',
        check: () => this.isLighthouseUnlocked() && this.canTryCh3Archive(),
      },
      {
        id: 'ch3_keeper',
        check: () => this.mapKey === 'lighthouse' && this.isLighthouseUnlocked() && this.canTryCh3Keeper(),
      },
      {
        id: 'ch3_bell',
        check: () => this.mapKey === 'lighthouse' && this.isLighthouseUnlocked() && this.canTryCh3Bell(),
      },
      {
        id: 'ch3_shard',
        check: () => this.canTryCh3Shard(),
      },
      {
        id: 'ch3_end_ship',
        check: () => this.canTryCh3EndShip(),
      },
      {
        id: 'ch3_stranger',
        check: () => this.mapKey === 'qinghe_river' && hasTriggered('ch3_ship_arrived') && this.canTryCh3Stranger(),
      },
      {
        id: 'lighthouse',
        check: () => this.mapKey === 'lighthouse' && this.canTryLighthouse(),
      },
      // 第三章幕二：灯塔三件套深交互（执灯人日常 / 铃铛 / 日志续写与望远镜在 lighthouse 分支内分流）
      // 24. elder_star: 镇长委托
      {
        id: 'elder_star',
        check: () => this.canTrySideElderStar(),
      },
      // 25. xiya_gate: 大门夏雅
      {
        id: 'xiya_gate',
        check: () => (this.mapKey === 'gate' || this.mapKey === 'farm') && !!this.xiyaSprite && this.canTryXiya(),
      },
      // 26. gate_wall: 大门锁
      {
        id: 'gate_wall',
        check: () => this.mapKey === 'gate' && !!this.gateWall && this.canTryGateWall(),
      },
      // 27. dawn_xiya: 清晨夏雅
      {
        id: 'dawn_xiya',
        check: () => this.mapKey === 'farm' && !!this.dawnXiya && this.canTryDawnXiya(),
      },
      // 28. elder_hint: 镇长家提示
      {
        id: 'elder_hint',
        check: () => this.mapKey === 'town' && !!this.elderHouseHint && this.canTryElderHouseHint(),
      },
      // 29. gardener_plum: 小梅种花
      {
        id: 'gardener_plum',
        check: () => this.mapKey === 'town' && this.canTrySideGardenerPlum(),
      },
      // 30. market_square: 集市广场
      {
        id: 'market_square',
        check: () => this.canTryMarketSquare(),
      },
      // 31. shop_machine: 自动售货机
      {
        id: 'shop_machine',
        check: () => this.canTryShopMachine(),
      },
      // 32. resident_board: 居民需求板
      {
        id: 'resident_board',
        check: () => this.mapKey === 'town' && !!this.residentBoardMark && this.canTryResidentBoard(),
      },
      // 33. evening_xiya: 傍晚夏雅
      {
        id: 'evening_xiya',
        check: () => this.mapKey === 'farm' && !!this.eveningXiya && this.canTryEveningXiya(),
      },
      // 34. grandpa_note: 爷爷笔记
      {
        id: 'grandpa_note',
        check: () => this.mapKey === 'farm' && !!this.grandpaNote && this.canTryGrandpaNote(),
      },
      // 35. garden_restore: 花园恢复
      {
        id: 'garden_restore',
        check: () => this.mapKey === 'farm' && !!this.gardenRestore && this.gardenRestore.stage < 3 && this.canTryGardenRestore(),
      },
      // 36. xiya_garden: 院子照顾
      {
        id: 'xiya_garden',
        check: () => this.mapKey === 'farm' && isRestored('garden') && !this.gardenXiya && this.canTrySideXiyaGarden(),
      },
      // 37. old_house_restore: 老屋修复
      {
        id: 'old_house_restore',
        check: () => this.mapKey === 'farm' && !!this.oldHouseRestore && !this.oldHouseRestore.restored && this.canTryOldHouseRestore(),
      },
      // 38. mailbox: 邮箱
      {
        id: 'mailbox',
        check: () => this.mapKey === 'farm' && this.canTryMailbox(),
      },
      // 39. xiya_old_shadow_deliver: 旧照片交付
      {
        id: 'xiya_old_shadow_deliver',
        check: () => this.mapKey === 'farm' && isRestored('oldHouse') && this.sideXiyaOldShadowAsked && !this.sideXiyaOldShadowDone && this.canTryXiyaOldShadowDeliver(),
      },
      // 40. xiya_photo: 整理旧照片
      {
        id: 'xiya_photo',
        check: () => this.mapKey === 'farm' && isRestored('oldHouse') && this.canTrySideXiyaPhoto(),
      },
      // 41. xiya_letter: 春深有信·一
      {
        id: 'xiya_letter',
        check: () => this.mapKey === 'farm' && isTutorialDone() && this.canTryXiyaLetter(),
      },
      // 42. bloom_xiya: 花期未至
      {
        id: 'bloom_xiya',
        check: () => this.mapKey === 'town' && isTutorialDone() && this.canTryBloomXiya(),
      },
      // 43. gardener_field: 花田开垦
      {
        id: 'gardener_field',
        check: () => this.mapKey === 'farm' && this.canTrySideGardenerField(),
      },
      // 44. forest_road: 山路修复
      {
        id: 'forest_road',
        check: () => this.mapKey === 'forest' && !!this.forestRoadRestore && !this.forestRoadRestore.restored && this.canTryForestRoadRestore(),
      },
      // 45. garden_xiya: 花园夏雅
      {
        id: 'garden_xiya',
        check: () => this.mapKey === 'farm' && !!this.gardenXiya && this.canTryGardenXiya(),
      },
      // 46. old_robot: 旧农业机器人
      {
        id: 'old_robot',
        check: () => this.mapKey === 'farm' && !!this.oldRobot && this.canTryOldRobot(),
      },
      // 47. stall_keeper: 集市摊主
      {
        id: 'stall_keeper',
        check: () => this.mapKey === 'town' && this.marketStallKeepers.length > 0 && this.canTryStallKeeper(),
      },
      // 48. npc: 最近 NPC（含小梅观察分支）
      {
        id: 'npc',
        check: () => {
          const nearest = this.findNearestNPC();
          if (!nearest) return false;
          // 小梅观察分支优先
          if (nearest.id === 'gardener') {
            if (getItemCount('butterfly_specimen') > 0 && !hasTriggered('ch1_natural_record_1')) return true;
            if (getItemCount('willow_specimen') > 0 && !hasTriggered('ch1_natural_record_2')) return true;
            if (getItemCount('moth_specimen') > 0 && !hasTriggered('ch1_natural_record_3')) return true;
          }
          return true;
        },
        data: () => {
          const nearest = this.findNearestNPC();
          return nearest ? { npcId: nearest.id } : null;
        },
      },
      // 49. town_shop: 镇商店门面
      {
        id: 'town_shop',
        check: () => this.canTryTownShop(),
      },
      // 50. old_tree: 后山老树
      {
        id: 'old_tree',
        check: () => this.mapKey === 'forest' && !!this.oldTree && this.canTryOldTree(),
      },
      // 51. forest_shard: 森林星之碎片
      {
        id: 'forest_shard',
        check: () => this.mapKey === 'forest' && !!this.shardSprite && this.shardSprite.visible && this.canTryForestShard(),
      },
      // 52. mine_lamp: 矿灯
      {
        id: 'mine_lamp',
        check: () => this.mapKey === 'mine' && this.canTrySideMinerLamp(),
      },
      // 53. mine_ore: 挖矿
      {
        id: 'mine_ore',
        check: () => this.mapKey === 'mine' && this.canTryMineOre(),
      },
      // 54. chop_tree: 砍树
      {
        id: 'chop_tree',
        check: () => this.mapKey === 'farm' && this.canTryChopTree(),
      },
      // 55. farm_tile: 农田交互（兜底，总是匹配）
      {
        id: 'farm_tile',
        check: () => this.mapKey === 'farm',
      },
    ];
  }

  /**
   * P7b: 执行已解析的交互目标
   * 根据 ResolvedTarget.id 分发执行对应交互逻辑
   * 所有副作用（启动对话、打开面板、执行操作等）在此处执行
   */
  private executeInteractionTarget(target: ResolvedTarget): boolean {
    switch (target.id) {
      case 'house_tidy':
        return this.tryHouseTidyInteract();
      case 'house_old_shadow':
        return this.trySideXiyaOldShadow();
      case 'bed':
        return this.executeBedInteract();
      case 'music_box':
        return this.tryMusicBoxInteract();
      case 'grandpa_gift':
        return this.tryGrandpaGiftInteract();
      case 'stargaze':
        return this.tryStargaze();
      case 'butterfly':
        return this.tryCatchNearestButterfly();
      case 'art_show_xiya':
        return this.tryArtShowXiyaInteract();
      case 'art_show_box':
        this.openTownPlan();
        return true;
      case 'art_show_traveler':
        return this.tryArtShowTravelerInteract();
      case 'art_show_after_xiya':
        return this.tryArtShowAfterXiyaInteract();
      case 'dryyard_xiya':
        return this.tryDryyardXiyaInteract();
      case 'dryyard_box':
        this.openTownPlan();
        return true;
      case 'dryyard_laozhang':
        return this.tryDryyardLaozhangInteract();
      case 'laojiang':
        return this.tryLaoJiangInteract();
      case 'qinghe_pier':
        return this.tryQinghePierInteract();
      case 'ch2_clock':
        return this.tryCh2ClockInteract();
      case 'ch2_captain':
        return this.tryCh2CaptainInteract();
      case 'qinghe_pavilion':
        return this.tryQinghePavilionInteract();
      case 'qinghe_chatter':
        return this.tryQingheChatterInteract();
      case 'qinghe_old_man':
        return this.tryQingheOldManInteract();
      case 'qinghe_riverside_xiya':
        return this.tryRiversideXiyaInteract();
      case 'fishing':
        return this.tryFishingInteract();
      case 'gather':
        return this.tryGatherInteract();
      case 'lighthouse':
        return this.tryLighthouseInteract();
      case 'ch3_archive':
        return this.tryCh3ArchiveInteract();
      case 'ch3_keeper':
        return this.tryCh3KeeperInteract();
      case 'ch3_bell':
        return this.tryCh3BellInteract();
      case 'ch3_shard':
        return this.tryCh3ShardInteract();
      case 'ch3_end_ship':
        return this.tryCh3EndShipInteract();
      case 'ch3_stranger':
        return this.tryCh3StrangerInteract();
      case 'elder_star':
        return this.trySideElderStar();
      case 'xiya_gate':
        return this.tryXiyaInteract();
      case 'gate_wall':
        this.executeGateWallInteract();
        return true;
      case 'dawn_xiya':
        return this.tryDawnXiyaInteract();
      case 'elder_hint':
        return this.tryElderHouseHintInteract();
      case 'gardener_plum':
        return this.trySideGardenerPlum();
      case 'market_square':
        return this.executeMarketSquareInteract();
      case 'shop_machine':
        this.inputManager.clearAction();
        this.shopPanel.open('machine');
        return true;
      case 'resident_board':
        return this.tryResidentBoardInteract();
      case 'evening_xiya':
        return this.tryEveningXiyaInteract();
      case 'grandpa_note':
        return this.tryGrandpaNoteInteract();
      case 'garden_restore':
        return this.tryGardenRestoreInteract();
      case 'xiya_garden':
        return this.trySideXiyaGarden();
      case 'old_house_restore':
        return this.tryOldHouseRestoreInteract();
      case 'mailbox':
        return this.tryMailboxInteract();
      case 'xiya_old_shadow_deliver':
        return this.tryXiyaOldShadowDeliver();
      case 'xiya_photo':
        return this.trySideXiyaPhoto();
      case 'xiya_letter':
        return this.tryXiyaLetterInteract();
      case 'bloom_xiya':
        return this.tryBloomXiyaInteract();
      case 'gardener_field':
        return this.trySideGardenerField();
      case 'forest_road':
        return this.tryForestRoadRestoreInteract();
      case 'garden_xiya':
        return this.tryGardenXiyaInteract();
      case 'old_robot':
        return this.tryOldRobotInteract();
      case 'stall_keeper':
        return this.tryStallKeeperInteract();
      case 'npc':
        return this.executeNPCInteract(target);
      case 'town_shop':
        return this.executeTownShopInteract();
      case 'old_tree':
        this.triggerOldTreeInteract();
        return true;
      case 'forest_shard':
        this.executeForestShardInteract();
        return true;
      case 'mine_lamp':
        return this.trySideMinerLamp();
      case 'mine_ore':
        this.executeMineOreInteract();
        return true;
      case 'chop_tree':
        return this.tryChopTree();
      case 'farm_tile':
        this.tryFarmInteract();
        return false; // farm_tile 是兜底，不应消费交互
      default:
        return false;
    }
  }

  /**
   * P7b: 查找最近的 NPC（纯函数，无副作用）
   */
  private findNearestNPC(): NPC | null {
    let nearest: NPC | null = null;
    let nearestDist = 24 * 24;
    for (const npc of this.npcList) {
      if (!npc.sprite || npc.vanished) continue;
      const dx = this.player.x - npc.sprite.x;
      const dy = this.player.y - npc.sprite.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < nearestDist) {
        nearestDist = d2;
        nearest = npc;
      }
    }
    return nearest;
  }

  /**
   * P7b: 执行床交互（原 tryInteract 内联逻辑）
   */
  private executeBedInteract(): boolean {
    // 防重复睡觉
    if (this.sleeping) {
      console.log('[MapScene] 睡觉中，忽略重复触发');
      return true;
    }
    // 教程中：只有 evening_talk 允许睡觉
    if (!isTutorialDone() && getStoryStep() !== 'evening_talk') {
      this.showDialogueText('还不到睡觉的时候……先把今天的农活做完吧。');
      return true;
    }
    // 教程：晚间睡觉 → 结束教程
    if (!isTutorialDone() && this.tryTutorialSleep()) return true;
    // 自由模式白天：弹睡觉选项
    if (getTime().hour < 20 && !isObservatoryComplete()) {
      this.promptSleepChoice();
      return true;
    }
    this.trySleep();
    return true;
  }

  /**
   * P7b: 执行大门墙交互（原 tryInteract 内联逻辑）
   */
  private executeGateWallInteract(): void {
    // 注：距离检查已在 canTryGateWall() 中完成
    this.showDialogueText(getItemCount('manor_key') > 0
      ? '大门锁着，打开背包选择庄园钥匙使用吧。'
      : '大门锁着，好像需要一把钥匙……');
  }

  /**
   * P7b: 执行集市广场交互（清理/布置分支）
   */
  private executeMarketSquareInteract(): boolean {
    if (this.marketSquareRestore && !this.marketSquareRestore.restored) {
      if (this.marketSquareRestore.cleared) {
        return this.tryMarketSquareArrangeInteract();
      } else {
        return this.tryMarketSquareInteract();
      }
    }
    return false;
  }

  /**
   * P7b: 执行 NPC 交互（包含小梅观察分支）
   */
  private executeNPCInteract(_target: ResolvedTarget): boolean {
    const nearest = this.findNearestNPC();
    if (!nearest) return false;

    // 小梅观察分支
    if (nearest.id === 'gardener') {
      if (getItemCount('butterfly_specimen') > 0 && !hasTriggered('ch1_natural_record_1')) {
        this.tryXiaomeiObserve();
        return true;
      }
      if (getItemCount('willow_specimen') > 0 && !hasTriggered('ch1_natural_record_2')) {
        this.tryXiaomeiObserveWillow();
        return true;
      }
      if (getItemCount('moth_specimen') > 0 && !hasTriggered('ch1_natural_record_3')) {
        this.tryXiaomeiObserveMoth();
        return true;
      }
    }

    // 通知每日任务
    onDQTAlkNpc(nearest.id);
    this.updateDailyQuestPanel();

    // 镇长对话
    if (nearest.id === 'elder') {

      const elderBusy = isElderBusyDay();
      this.playStory(getElderDialogue(), () => {
        this.updateQuestHUD();
        this.updateHUD();
        if (elderBusy) {
          triggerOnce('elder_starter_gift', () => this.grantElderStarterGift());
        }
        if (!this.sideElderTeaAsked && !this.sideElderStarDone && isObservatoryComplete()) {
          this.sideElderTeaAsked = true;
          this.storyDialogue!.play(ELDER_TEA_QUEST_DIALOGUE, () => this.updateHUD());
        }
        if (this.mapKey === 'farm' && isRestored('farmWarm') && !this.farmController.isWarmActive()) {
          this.setupFarmWarm();
        }
        this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
      });
    } else if (nearest.id === 'shopkeeper') {
      this.showDialogue(nearest);
    } else {
      this.showDialogue(nearest);
    }
    return true;
  }

  /**
   * P7b: 执行镇商店交互（老板在场对话 / 不在场自动售货机）
   */
  private executeTownShopInteract(): boolean {
    if (this.mapKey !== 'town' || !this.townShop) return false;
    const dx = this.player.x - this.townShop.pos.x;
    const dy = this.player.y - this.townShop.pos.y;
    if (dx * dx + dy * dy >= R2(30)) return false;
    const boss = this.npcList.find((n) => n.id === 'shopkeeper');
    if (boss && boss.sprite && !boss.vanished) {
      this.showDialogue(boss);
    } else {
      this.inputManager.clearAction();
      this.shopPanel.open('machine');
    }
    return true;
  }

  /**
   * P7b: 执行森林碎片交互（首次对话后自动采集）
   */
  private executeForestShardInteract(): void {
    if (!this.shardDialoguePlayed) {
      this.shardDialoguePlayed = true;

      this.playStory(FOREST_SHARD_DIALOGUE, () => {
        this.doCollectShard();
      });
    }
  }

  /**
   * P7b: 执行挖矿交互（引导 + 实际挖矿）
   */
  private executeMineOreInteract(): void {
    const nearOre = this.oreSprites.some((e) => {
      if (!e.sprite.visible) return false;
      const dx = this.player.x - e.sprite.x;
      const dy = this.player.y - e.sprite.y;
      return dx * dx + dy * dy < R2(24);
    });
    if (nearOre && !this.mineTipShown) {
      this.mineTipShown = true;

      this.playStory(MINE_TIP_DIALOGUE, undefined, undefined, "")
      return;
    }
    this.tryMine();
  }

  /**
   * P7b 辅助: 纯函数检查方法 —— 每个对应 tryInteract 中的一个 if 条件
   * 这些方法都是纯函数，不修改任何状态
   */

  // --- house_tidy ---
  // BUG-FIX (P0 床交互)：条件须与执行器 tryHouseTidyInteract 一致（mark 存在 = 未完成 = 可交互）。
  // 此前写成 !item.mark（只匹配已完成点）：① 未整理时 house_tidy 永不成为候选 → 床点直接走 bed；
  // ② 整理完成后 mark=null 的点反而命中 → house_tidy 以 #1 优先级抢走交互，而执行器跳过
  // 已完成点 → 静默返回 false → 床前按 E 无反应（"床睡不了觉"，桌面端同样复现）。
  private canTryHouseTidy(): boolean {
    if (this.mapKey !== 'house') return false;
    for (const item of this.houseTidy) {
      if (item.mark) {
        const dx = this.player.x - item.pos.x;
        const dy = this.player.y - item.pos.y;
        if (dx * dx + dy * dy < 48 * 48) return true;
      }
    }
    return false;
  }

  // --- house_old_shadow ---
  private canTrySideXiyaOldShadow(): boolean {
    if (this.mapKey !== 'house') return false;
    if (this.sideXiyaOldShadowDone) return false;
    if (this.sideXiyaOldShadowAsked) return false;
    if (!isHouseTidyComplete()) return false;
    if (!this.xiyaOldShadowMark) return false;
    const dx = this.player.x - this.xiyaOldShadowMark.x;
    const dy = this.player.y - this.xiyaOldShadowMark.y;
    return dx * dx + dy * dy <= 48 * 48;
  }

  // --- bed ---
  private canTryBed(): boolean {
    if (this.mapKey !== 'house' && this.mapKey !== 'farm') return false;
    const pc = Math.floor(this.player.x / TILE_SIZE);
    const pr = Math.floor(this.player.y / TILE_SIZE);
    const onBed = this.bedTiles.has(`${pc},${pr}`);
    const nearBed = this.mapKey === 'house' && this.isNearBedTile(pc, pr);
    return onBed || nearBed;
  }

  // --- music_box ---
  private canTryMusicBox(): boolean {
    if (!this.musicBoxMark || !this.musicBoxMark.visible) return false;
    const dx = this.player.x - this.musicBoxMark.x;
    const dy = this.player.y - this.musicBoxMark.y;
    return dx * dx + dy * dy <= 48 * 48;
  }

  // --- grandpa_gift ---
  private canTryGrandpaGift(): boolean {
    if (!this.grandpaGiftMark || !this.grandpaGiftMark.visible) return false;
    const dx = this.player.x - this.grandpaGiftPos.x;
    const dy = this.player.y - this.grandpaGiftPos.y;
    return dx * dx + dy * dy <= 48 * 48;
  }

  // --- stargaze ---
  private canTryStargaze(): boolean {
    if (this.mapKey !== 'farm') return false;
    if (getQuestState() !== 'completed' || isObservatoryComplete()) return false;
    const dx = this.player.x - this.STARGAZE_POS.x;
    const dy = this.player.y - this.STARGAZE_POS.y;
    return dx * dx + dy * dy <= 48 * 48;
  }

  // --- butterfly ---
  private canTryCatchButterfly(): boolean {
    // BUG-FIX（P1）：钓鱼中（casting/waiting/realBite/fakeBite）捕虫不抢占——
    // 候选序里 butterfly 在 fishing 之前，等咬钩 0.8s 收竿窗口内按 E 曾被 24px 内
    // 的蝴蝶抢走 → 超时判负。钓鱼期间蝴蝶候选一律让位。
    if (this.fishingState !== 'idle') return false;
    for (const b of this.catchableButterflies) {
      if (b.getData('captured')) continue;
      if (!b.visible) continue;
      const dx = this.player.x - b.x;
      const dy = this.player.y - b.y;
      if (dx * dx + dy * dy < R2(24)) return true;
    }
    return false;
  }

  // --- art_show_xiya ---
  private canTryArtShowXiya(): boolean {
    if (!this.artShowXiya || !this.artShowXiya.visible) return false;
    if (hasTriggered('artshow_xiya_plan')) return false;
    const dx = this.player.x - this.artShowXiya.x;
    const dy = this.player.y - this.artShowXiya.y;
    return dx * dx + dy * dy <= 34 * 34;
  }

  // --- art_show_box ---
  private canTryArtShowBox(): boolean {
    if (this.mapKey !== 'town' || !this.artShowBox || this.artShowHeld) return false;
    const dx = this.player.x - MapScene.ARTSHOW.box.x;
    const dy = this.player.y - MapScene.ARTSHOW.box.y;
    return dx * dx + dy * dy < 34 * 34;
  }

  // --- art_show_traveler ---
  private canTryArtShowTraveler(): boolean {
    if (this.mapKey !== 'town') return false;
    if (!this.artShowPerm) return false;
    if (!this.artShowTravelerGfx?.visible) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const h = getTime().hour;
    if (h < 8 || h >= 20) return false;
    const dx = this.player.x - this.artShowTravelerPos.x;
    const dy = this.player.y - this.artShowTravelerPos.y;
    return dx * dx + dy * dy < 42 * 42;
  }

  // --- art_show_after_xiya ---
  private canTryArtShowAfterXiya(): boolean {
    if (this.mapKey !== 'town' || !this.artShowPerm) return false;
    if (!this.artShowAfterXiya?.visible) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const h = getTime().hour;
    if (h < 8 || h >= 20) return false;
    const dx = this.player.x - this.artShowAfterXiya.x;
    const dy = this.player.y - this.artShowAfterXiya.y;
    return dx * dx + dy * dy < 34 * 34;
  }

  // --- dryyard_xiya ---
  private canTryDryyardXiya(): boolean {
    if (this.mapKey !== 'town') return false;
    if (!this.dryyardXiya || !this.dryyardXiya.visible) return false;
    if (hasTriggered('dryyard_xiya_photo')) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const dx = this.player.x - this.dryyardXiya.x;
    const dy = this.player.y - this.dryyardXiya.y;
    return dx * dx + dy * dy <= 34 * 34;
  }

  // --- dryyard_box ---
  private canTryDryyardBox(): boolean {
    if (this.mapKey !== 'town' || !this.dryyardBox || this.dryyardHeld) return false;
    const dx = this.player.x - MapScene.DRYYARD.box.x;
    const dy = this.player.y - MapScene.DRYYARD.box.y;
    return dx * dx + dy * dy < 34 * 34;
  }

  // --- dryyard_laozhang ---
  private canTryDryyardLaozhang(): boolean {
    if (this.mapKey !== 'town') return false;
    if (!this.dryyardPerm) return false;
    if (!this.dryyardLaozhang || !this.dryyardLaozhang.visible) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const dx = this.player.x - MapScene.DRYYARD.laozhang.x;
    const dy = this.player.y - MapScene.DRYYARD.laozhang.y;
    return dx * dx + dy * dy < 42 * 42;
  }

  // --- laojiang ---
  private canTryLaoJiang(): boolean {
    if (this.mapKey !== 'town') return false;
    if (!this.laoJiangGfx?.visible) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const dx = this.player.x - this.laoJiangPos.x;
    const dy = this.player.y - this.laoJiangPos.y;
    if (dx * dx + dy * dy >= MapScene.LAO_JIANG_RANGE * MapScene.LAO_JIANG_RANGE) return false;
    const lines = this.buildLaoJiangDialogue();
    return lines.length > 0;
  }

  // --- qinghe_pier ---
  private canTryQinghePier(): boolean {
    const g = this.qinghePierRestore;
    if (!g || g.restored || this.mapKey !== 'qinghe_river') return false;
    const dx = this.player.x - g.pos.x;
    const dy = this.player.y - g.pos.y;
    if (dx * dx + dy * dy > 34 * 34) return false;
    return !this.storyDialogue?.isOpen();
  }

  // --- qinghe_pavilion ---
  private canTryQinghePavilion(): boolean {
    if (!this.qinghePavilion || this.mapKey !== 'qinghe_river') return false;
    if (this.storyDialogue?.isOpen()) return false;
    const dx = this.player.x - this.qinghePavilion.pos.x;
    const dy = this.player.y - this.qinghePavilion.pos.y;
    return dx * dx + dy * dy <= 42 * 42;
  }

  // --- qinghe_chatter ---
  private canTryQingheChatter(): boolean {
    if (this.mapKey !== 'qinghe_river' || !isRestored('marketSquare')) return false;
    const h = getTime().hour;
    if (h < 18 && h >= 6) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const T = TILE_SIZE;
    const x = 15 * T + T / 2, y = 20 * T + T / 2;
    const dx = this.player.x - x, dy = this.player.y - y;
    return dx * dx + dy * dy < 48 * 48;
  }

  // --- qinghe_old_man ---
  private canTryQingheOldMan(): boolean {
    if (this.mapKey !== 'qinghe_river' || !this.qingheOldMan?.visible) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const h = getTime().hour;
    if (h < 8 || h >= 18) return false;
    const dx = this.player.x - this.qingheOldMan.x;
    const dy = this.player.y - this.qingheOldMan.y;
    return dx * dx + dy * dy < 42 * 42;
  }

  // --- qinghe_riverside_xiya ---
  private canTryRiversideXiya(): boolean {
    if (!this.riversideXiya || !this.riversideXiya.visible) return false;
    if (getTime().hour < 16 || getTime().hour >= 18) return false;
    const dx = this.player.x - this.riversideXiya.x;
    const dy = this.player.y - this.riversideXiya.y;
    return dx * dx + dy * dy <= R2(28);
  }

  // --- fishing ---
  private canTryFishing(): boolean {
    if (!MapScene.FISHING_SPOTS[this.mapKey]) return false;
    if (this.fishingState !== 'idle') return true; // 钓鱼中可收竿
    const dx = this.player.x - this.fishingSpotPos.x;
    const dy = this.player.y - this.fishingSpotPos.y;
    const range = MapScene.FISHING_CONFIG.interactRange;
    if (dx * dx + dy * dy > range * range) return false;
    return !this.storyDialogue?.isOpen();
  }

  // --- gather ---
  private canTryGather(): boolean {
    if (this.nearestGatherIdx < 0) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const node = this.gatherNodes[this.nearestGatherIdx];
    if (!node || node.collected) return false;
    const dx = this.player.x - node.def.x;
    const dy = this.player.y - node.def.y;
    return dx * dx + dy * dy <= GATHER_INTERACT_RANGE * GATHER_INTERACT_RANGE;
  }

  // --- lighthouse ---
  private canTryLighthouse(): boolean {
    if (this.mapKey !== 'lighthouse') return false;
    for (const s of this.lighthouseSpots) {
      const dx = this.player.x - s.x;
      const dy = this.player.y - s.y;
      if (dx * dx + dy * dy <= R2(32)) return true;
    }
    return false;
  }

  // --- elder_star ---
  private canTrySideElderStar(): boolean {
    if (this.mapKey !== 'farm') return false;
    if (!this.sideElderTeaAsked || this.sideElderStarDone) return false;
    const dx = this.player.x - this.STARGAZE_POS.x;
    const dy = this.player.y - this.STARGAZE_POS.y;
    return dx * dx + dy * dy <= 48 * 48;
  }

  // --- xiya_gate ---
  private canTryXiya(): boolean {
    if (!this.xiyaSprite || !this.xiyaSprite.visible) return false;
    if (getStoryStep() !== 'arrive_manor') return false;
    const dx = this.player.x - this.xiyaSprite.x;
    const dy = this.player.y - this.xiyaSprite.y;
    return dx * dx + dy * dy <= R2(28);
  }

  // --- gate_wall ---
  private canTryGateWall(): boolean {
    const dx = this.player.x - 15 * TILE_SIZE;
    const dy = this.player.y - 9 * TILE_SIZE;
    return dx * dx + dy * dy < R2(30);
  }

  // --- dawn_xiya ---
  private canTryDawnXiya(): boolean {
    if (!this.dawnXiya || !this.dawnXiya.visible) return false;
    if (getTime().hour < 6 || getTime().hour >= 8) return false;
    const dx = this.player.x - this.dawnXiya.x;
    const dy = this.player.y - this.dawnXiya.y;
    return dx * dx + dy * dy <= R2(28);
  }

  // --- elder_hint ---
  private canTryElderHouseHint(): boolean {
    if (!this.elderHouseHint || !this.elderHouseHint.sprite.visible) return false;
    const dx = this.player.x - this.elderHouseHint.sprite.x;
    const dy = this.player.y - this.elderHouseHint.sprite.y;
    return dx * dx + dy * dy <= R2(28);
  }

  // --- gardener_plum ---
  private canTrySideGardenerPlum(): boolean {
    if (this.mapKey !== 'town') return false;
    if (this.sideGardenerPlumDone) return false;
    // 让位：玩家贴近任何可见 NPC（<24px）时，小梅花让位给 NPC 对话
    for (const n of this.npcList) {
      if (!n.sprite || n.vanished) continue;
      const ndx = this.player.x - n.sprite.x;
      const ndy = this.player.y - n.sprite.y;
      if (ndx * ndx + ndy * ndy < R2(24)) return false;
    }
    const T = TILE_SIZE;
    const px = 28 * T + T / 2;
    const py = 16 * T + T / 2;
    const dx = this.player.x - px;
    const dy = this.player.y - py;
    return dx * dx + dy * dy <= 48 * 48;
  }

  // --- market_square ---
  private canTryMarketSquare(): boolean {
    if (this.mapKey !== 'town' || !this.marketSquareRestore || this.marketSquareRestore.restored) return false;
    // 需要实际进入 tryMarketSquareInteract / tryMarketSquareArrangeInteract 的检查逻辑
    // 这里返回 true 让路由进入 executeMarketSquareInteract 处理
    return this.canTryMarketSquareInteract() || this.canTryMarketSquareArrangeInteract();
  }

  // --- shop_machine ---
  private canTryShopMachine(): boolean {
    if (this.mapKey !== 'town' || !this.shopMachine) return false;
    const dx = this.player.x - this.shopMachine.pos.x;
    const dy = this.player.y - this.shopMachine.pos.y;
    return dx * dx + dy * dy < R2(20);
  }

  // --- resident_board ---
  private canTryResidentBoard(): boolean {
    if (!this.residentBoardMark || !this.residentBoardMark.visible) return false;
    const dx = this.player.x - this.residentBoardMark.x;
    const dy = this.player.y - this.residentBoardMark.y;
    return dx * dx + dy * dy <= 48 * 48;
  }

  // --- evening_xiya ---
  private canTryEveningXiya(): boolean {
    if (!this.eveningXiya || !this.eveningXiya.visible) return false;
    if (getTime().hour < 18 || getTime().hour >= 20) return false;
    const dx = this.player.x - this.eveningXiya.x;
    const dy = this.player.y - this.eveningXiya.y;
    return dx * dx + dy * dy <= R2(28);
  }

  // --- grandpa_note ---
  private canTryGrandpaNote(): boolean {
    if (!this.grandpaNote || !this.grandpaNote.visible) return false;
    const p = this.grandpaNotePos;
    const dx = this.player.x - p.x;
    const dy = this.player.y - p.y;
    return dx * dx + dy * dy <= R2(28);
  }

  // --- garden_restore ---
  private canTryGardenRestore(): boolean {
    const g = this.gardenRestore;
    if (!g || g.stage >= 3) return false;
    const dx = this.player.x - g.pos.x;
    const dy = this.player.y - g.pos.y;
    return dx * dx + dy * dy <= 34 * 34;
  }

  // --- xiya_garden ---
  private canTrySideXiyaGarden(): boolean {
    if (this.sideXiyaGardenDone) return false;
    const T = TILE_SIZE;
    const gx = 30 * T + T / 2;
    const gy = 5 * T + T / 2;
    const dx = this.player.x - gx;
    const dy = this.player.y - gy;
    return dx * dx + dy * dy <= 44 * 44;
  }

  // --- old_house_restore ---
  private canTryOldHouseRestore(): boolean {
    const g = this.oldHouseRestore;
    if (!g || g.restored) return false;
    const dx = this.player.x - g.pos.x;
    const dy = this.player.y - g.pos.y;
    return dx * dx + dy * dy <= 34 * 34;
  }

  // --- mailbox ---
  private canTryMailbox(): boolean {
    if (!this.mailboxGfx || !this.mailUnlocked) return false;
    if (!this.mailboxGfx.visible) return false;
    if (this.storyDialogue?.isOpen()) return false;
    if (isMailboxPanelOpen()) return false;
    const dx = this.player.x - this.mailboxPos.x;
    const dy = this.player.y - this.mailboxPos.y;
    return dx * dx + dy * dy <= 34 * 34;
  }

  // --- xiya_old_shadow_deliver ---
  private canTryXiyaOldShadowDeliver(): boolean {
    if (this.mapKey !== 'farm') return false;
    if (this.sideXiyaOldShadowDone) return false;
    if (!this.sideXiyaOldShadowAsked) return false;
    if (!isRestored('oldHouse')) return false;
    const g = this.oldHouseRestore;
    if (!g) return false;
    const dx = this.player.x - g.pos.x;
    const dy = this.player.y - g.pos.y;
    return dx * dx + dy * dy <= 48 * 48;
  }

  // --- xiya_photo ---
  private canTrySideXiyaPhoto(): boolean {
    if (this.mapKey !== 'farm') return false;
    if (this.sideXiyaPhotoDone) return false;
    if (!isRestored('oldHouse')) return false;
    const g = this.oldHouseRestore;
    if (!g) return false;
    const dx = this.player.x - g.pos.x;
    const dy = this.player.y - g.pos.y;
    return dx * dx + dy * dy <= 48 * 48;
  }

  // --- xiya_letter ---
  private canTryXiyaLetter(): boolean {
    if (this.mapKey !== 'farm') return false;
    if (this.xiyaLetterDone) return false;
    if (!isTutorialDone()) return false;
    if (!this.letterTimeOk()) return false;
    const R = 32 * 32;
    // 判定源必须与 tryXiyaLetterInteract 的 4 段分支一一对应：
    // BUG-FIX（P0-4）：stage1/2 恢复的是花苗/记录标记（setupLetterXiya 只 spawn 标记、不 spawn 夏雅），
    // 原先 B/C/D 段只查 letterXiya.visible → 刷新后 B/C 段交互永远不可达，任务链死锁。
    // A 段：初始夏雅（visible 检查）
    if (!this.xiyaLetterAsked && this.letterXiya?.visible) {
      const dx = this.player.x - this.letterXiya.x;
      const dy = this.player.y - this.letterXiya.y;
      if (dx * dx + dy * dy <= R) return true;
    }
    // B 段：「花苗」交互点
    if (this.letterFlowerMark) {
      const dx = this.player.x - this.letterFlowerMark.x;
      const dy = this.player.y - this.letterFlowerMark.y;
      if (dx * dx + dy * dy <= R) return true;
    }
    // C 段：「旧花种记录」交互点
    if (this.letterRecordMark) {
      const dx = this.player.x - this.letterRecordMark.x;
      const dy = this.player.y - this.letterRecordMark.y;
      if (dx * dx + dy * dy <= R) return true;
    }
    // D 段：收尾夏雅（visible 检查）
    if (this.xiyaLetterAsked && this.xiyaLetterStage >= 3 && this.letterXiya?.visible) {
      const dx = this.player.x - this.letterXiya.x;
      const dy = this.player.y - this.letterXiya.y;
      if (dx * dx + dy * dy <= R) return true;
    }
    return false;
  }

  // --- bloom_xiya ---
  private canTryBloomXiya(): boolean {
    if (this.mapKey !== 'town') return false;
    if (this.xiyaBloomDone) return false;
    if (!isTutorialDone()) return false;
    return this.bloomPrereqOk();
  }

  // --- gardener_field ---
  private canTrySideGardenerField(): boolean {
    if (this.mapKey !== 'farm') return false;
    if (this.sideGardenerFieldDone) return false;
    // 让位：小梅在花田旁时，玩家贴近小梅优先触发 NPC 对话
    const gardener = this.npcList.find((n) => n.id === 'gardener' && n.sprite && n.sprite.visible);
    if (gardener && gardener.sprite) {
      const ndx = this.player.x - gardener.sprite.x;
      const ndy = this.player.y - gardener.sprite.y;
      if (ndx * ndx + ndy * ndy < R2(24)) return false;
    }
    const T = TILE_SIZE;
    const gx = 3 * T + T / 2;
    const gy = 7 * T + T / 2;
    const dx = this.player.x - gx;
    const dy = this.player.y - gy;
    return dx * dx + dy * dy <= 44 * 44;
  }

  // --- forest_road ---
  private canTryForestRoadRestore(): boolean {
    const g = this.forestRoadRestore;
    if (!g || g.restored) return false;
    const dx = this.player.x - g.pos.x;
    const dy = this.player.y - g.pos.y;
    return dx * dx + dy * dy <= 34 * 34;
  }

  // --- garden_xiya ---
  private canTryGardenXiya(): boolean {
    if (!this.gardenXiya || !this.gardenXiya.visible) return false;
    const dx = this.player.x - this.gardenXiya.x;
    const dy = this.player.y - this.gardenXiya.y;
    return dx * dx + dy * dy <= R2(28);
  }

  // --- old_robot ---
  private canTryOldRobot(): boolean {
    if (!this.oldRobot || !this.oldRobot.visible) return false;
    const dx = this.player.x - this.oldRobotPos.x;
    const dy = this.player.y - this.oldRobotPos.y;
    return dx * dx + dy * dy <= R2(30);
  }

  // --- stall_keeper ---
  private canTryStallKeeper(): boolean {
    if (this.mapKey !== 'town') return false;
    if (!this.marketStallKeepers || this.marketStallKeepers.length === 0) return false;
    let nearest: Phaser.GameObjects.Container | null = null;
    let best = 40 * 40;
    for (const c of this.marketStallKeepers) {
      if (!c.visible) continue;
      const pos = c.getData('keeperPos') as { x: number; y: number } | undefined;
      if (!pos) continue;
      const dx = this.player.x - pos.x;
      const dy = this.player.y - pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        nearest = c;
      }
    }
    return nearest !== null;
  }

  // --- town_shop ---
  private canTryTownShop(): boolean {
    if (this.mapKey !== 'town' || !this.townShop) return false;
    const dx = this.player.x - this.townShop.pos.x;
    const dy = this.player.y - this.townShop.pos.y;
    return dx * dx + dy * dy < R2(30);
  }

  // --- old_tree ---
  private canTryOldTree(): boolean {
    const dx = this.player.x - this.oldTreePos.x;
    const dy = this.player.y - this.oldTreePos.y;
    return dx * dx + dy * dy < 60 * 60;
  }

  // --- forest_shard ---
  private canTryForestShard(): boolean {
    if (!this.shardSprite) return false;
    const dx = this.player.x - this.shardSprite.x;
    const dy = this.player.y - this.shardSprite.y;
    return dx * dx + dy * dy < R2(24);
  }

  // --- mine_lamp ---
  private canTrySideMinerLamp(): boolean {
    if (this.mapKey !== 'mine') return false;
    if (this.sideMinerLampDone) return false;
    const T = TILE_SIZE;
    const lx = 12 * T + T / 2;
    const ly = 8 * T + T / 2;
    const dx = this.player.x - lx;
    const dy = this.player.y - ly;
    return dx * dx + dy * dy <= 44 * 44;
  }

  // --- mine_ore ---
  private canTryMineOre(): boolean {
    const nearOre = this.oreSprites.some((e) => {
      if (!e.sprite.visible) return false;
      const dx = this.player.x - e.sprite.x;
      const dy = this.player.y - e.sprite.y;
      return dx * dx + dy * dy < R2(24);
    });
    return nearOre;
  }

  // --- chop_tree ---
  private canTryChopTree(): boolean {
    for (const pos of FARM_TREE_POSITIONS) {
      const tree = getTree(pos.col, pos.row);
      if (!tree || tree.isStump) continue;
      const cx = pos.col * TILE_SIZE + TILE_SIZE / 2;
      const cy = pos.row * TILE_SIZE + TILE_SIZE / 2;
      const dx = this.player.x - cx;
      const dy = this.player.y - cy;
      if (dx * dx + dy * dy < R2(24)) return true;
    }
    return false;
  }

  // --- market_square 子检查 ---
  private canTryMarketSquareInteract(): boolean {
    const g = this.marketSquareRestore;
    if (!g || g.restored) return false;
    const dx = this.player.x - g.pos.x;
    const dy = this.player.y - g.pos.y;
    return dx * dx + dy * dy <= 48 * 48;
  }

  private canTryMarketSquareArrangeInteract(): boolean {
    const g = this.marketSquareRestore;
    if (!g || g.restored || !g.cleared) return false;
    // 找最近一个未摆放的布置点
    let idx = -1;
    let best = 40 * 40;
    g.arrangeSpots.forEach((spot) => {
      if (spot.mark === null) return;
      const dx = this.player.x - spot.x;
      const dy = this.player.y - spot.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; idx = g.arrangeSpots.indexOf(spot); }
    });
    return idx >= 0;
  }

  /**
   * P7b: 交互入口（动作键触发，consumeAction 消费一次）
   * 使用 InteractionRouter.resolveTarget 解析目标优先级，再分发执行
   * 
   * 流程：
   *   1. 夜晚疲劳提示（前置逻辑）
   *   2. 构建候选列表（纯函数检查）
   *   3. 按优先级解析目标
   *   4. 执行目标交互（副作用）
   */
  private tryInteract(): void {
    // 夜晚疲劳提示（P0 §3.2，最小版）：21:00 起，当夜第一次按 E 时弹一句提示，不强制、不打断。
    // 去重：记录提示时的"当日分钟"；时间推进 ≥1 小时后才可能再提示（跨过 21:00 窗口或 debug 回拨均安全）。
    // 床上睡觉时不提示（避免与睡觉演出抢文本）。
    const t = getTime();
    const dayMinute = t.hour * 60 + t.minute;
    const bedInteract = (this.mapKey === 'house' || this.mapKey === 'farm') &&
      (() => {
        const pc = Math.floor(this.player.x / TILE_SIZE);
        const pr = Math.floor(this.player.y / TILE_SIZE);
        return this.bedTiles.has(`${pc},${pr}`) || (this.mapKey === 'house' && this.isNearBedTile(pc, pr));
      })();
    if (t.hour >= 21 && dayMinute >= this.nightFatigueHintShownMinute + 60 && !bedInteract) {
      this.nightFatigueHintShownMinute = dayMinute;
      this.showDialogueText('天色晚了，有些困了……');
    }

    // P7b: 构建候选列表 → 解析目标 → 执行交互（替代原 if-return 链）
    const candidates = this.buildInteractionCandidates();
    const target = this.interactionRouter.resolveTarget(candidates);
    
    if (target) {
      console.log(`[MapScene] P7b target resolved: ${target.id}`);
      this.executeInteractionTarget(target);
    }
    return; // P7b: 提前返回，不再执行原 if-return 链
  }

  /**
   * f5（2026-08-07 制作人拍板）：镇长第一天赠送启动资源大礼包
   * 种子 / 工具 / 金币 / 木材 / 石头 / 特殊道具（钻石），仅发放一次
   * 调用方须用 triggerOnce('elder_starter_gift', ...) 防重复，结束后由外层回调 save 入档
   */
  private grantElderStarterGift(): void {
    addItem('radish_seed', 5);
    addItem('tomato_seed', 3);
    addItem('corn_seed', 3);
    addItem('old_hoe', 1);
    addItem('old_watering_can', 1);
    addItem('old_axe', 1);
    addCoins(100);
    addItem('wood', 10);
    addItem('stone', 5);
    addItem('diamond', 1);
    this.showDialogueText('收到镇长的启动物资：种子、工具、金币、木材、石头、钻石！');
    this.updateHUD();
    this.updateQuestHUD();
  }

  /**
   * 睡觉选择弹窗：睡到天亮 / 休息到傍晚（自由模式白天；选项行不允许跳过）
   * 复用 StoryDialogue 选项机制（与观星夜三选项同一组件）
   */
  private promptSleepChoice(): void {
    // BUG-FIX：runner 占用时 playStory 会被静默吞掉 → 床上按 E 无任何反应
    // （与 dryyard BUG-FIX 同源：playSequence 的 if (this.playing) return false 静默丢段）
    // 延迟重试；重试前确认对话未打开且玩家仍在床上，防止走开后突然弹窗
    if (this.storySequenceRunner?.isPlaying?.()) {
      this.time.delayedCall(1200, () => {
        if (this.storyDialogue?.isOpen?.()) return;
        if (!this.canTryBed()) return;
        this.promptSleepChoice();
      });
      return;
    }

    this.playStory(
      [
        { speaker: '', color: COLORS.system, text: '（林澈躺在床上。天还早——直接睡到明天，还是先休息到傍晚？）' },
        { speaker: '', color: COLORS.system, text: '', options: ['睡到天亮', '休息到傍晚'] },
      ],
      () => { /* 选项行不可跳过，正常不会走到；兜底不睡 */ },
      (index: number) => {
        if (index === 0) this.trySleep();
        else this.restUntilEvening();
      },
    );
  }

  /** 休息到傍晚 18:00：不跨天、不结算作物（advanceDay 只在 nextDay 调用） */
  private restUntilEvening(): void {
    setTimeFull(getTime().day, 18, 0);
    this.rebuildNPCs();
    this.updateTimeHUD();
    this.showDialogueText('休息到傍晚……天色渐渐暗了下来。');
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
  }

  /**
   * 睡觉：TimeSystem.nextDay() → FarmState.advanceDay()
   * 时间重置为次日 06:00，作物成长结算
   * 同时刷新 NPC 日程（次日 06:00 NPC 回到 farm 出生点）
   */
  private trySleep(): void {
    this.sleeping = true;
    try {
      timeNextDay();
      // v0.6 庄园自动化：机器人每日清晨自动浇水/收获（在成长结算后，仅农场生效）
      this.runRobotsDaily();
      // 天气系统：雨天自动湿润农田（不耗水壶，返回实际湿润格数用于提示）
      const rainMoistened = this.rainAutoMoisten();
      resetStamina();
      resetOres();
      // BUG-FIX（P1-1）：跨天重置日常事件——此前 resetDailyEvents 只挂在教程睡觉路径（tryTutorialSleep），
      // 正常睡觉漏挂：触发过的"每日"事件本会话内不再触发、刷新页面后又复活（触发状态纯内存）。
      resetDailyEvents();
      let treesRefreshed = false;
      if (getTime().day % TREE_REFRESH_INTERVAL === 0) {
        refreshStumps();
        if (this.mapKey === 'farm') this.refreshTreeVisuals();
        treesRefreshed = true;
      }
      refreshDailyQuests();
      injectGuideQuests(); // 引导任务（挖矿/砍树）未完成时跨天保留补发，旧存档玩家也能拿到
      this.createDailyQuestPanel();
      this.refreshFarmVisual();
      this.rebuildNPCs();
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      } as any);
      this.showDialogueText(
        (treesRefreshed ? '已保存 Zzz... 树木也生长恢复了！' : '已保存 Zzz...') +
          (rainMoistened > 0 ? ' 雨水帮忙浇过了农田！' : ''),
      );
      // 第三章幕五（槽 D2）：归位状态下的"留岛"结局——睡在自家床（行为承载，无选项面板）
      if (this.ch3FinaleActive()) {
        this.time.delayedCall(1600, () => {
          if (!this.scene.isActive()) return;
          this.playStory(
            [
              { speaker: '', color: '#aaaaaa', text: '（躺下之前，你把灯留在窗边——让西边那盏，也能看见这一点光。）' },
              { speaker: '', color: '#aaaaaa', text: '（今晚，你留在这里。）' },
              { speaker: '', color: '#aaaaaa', text: '（不是不能走。是想留下的夜晚，比想走的多了一个。）' },
              { speaker: '', color: '#aaaaaa', text: '（第三章·归位——完）' },
            ],
            () => {
              triggerOnce('ch3_end_stay', () => {});
              this.saveAtPlayer();
            },
          );
        });
      }
      // P2：检查是否有成熟作物可收获
      if (this.mapKey === 'farm') {
        const readyCrops = getAllCropEntries().filter(([, c]) => {
          const def = CROP_DEFS[c.cropType];
          return def && getTime().day >= c.plantDay + def.growthDays;
        });
        if (readyCrops.length > 0) {
          // BUG-FIX（P1）：裸 setTimeout 不随 shutdown 清理，切图/重启后回调迟到会解引用旧 player
          this.time.delayedCall(1200, () => {
            if (!this.scene.isActive()) return;
            this.showDialogueText(`🌱 有 ${readyCrops.length} 块作物成熟了，快去收获吧！`);
          });
        }
        // P2-1 认知补强：已播种未浇水（planted，机器人已先执行浇水）→ 提醒玩家缺水，区分"时间未到"与"缺浇水"
        const dryCrops = getAllCropEntries().filter(([key]) => {
          const [c, r] = key.split(',').map(Number);
          return getTileState(c, r) === 'planted';
        });
        if (dryCrops.length > 0) {
          this.time.delayedCall(1400, () => {
            if (!this.scene.isActive()) return;
            this.showDialogueText(`💧 有 ${dryCrops.length} 块作物土壤发干，记得浇水！`);
          });
        }

        // 碎片收集进度：睡前内心独白（根据碎片数量显示不同台词）
        const shardCount = getItemCount('star_shard');
        const progressLines = SHARD_PROGRESS_LINES[shardCount] ?? [];
        if (progressLines.length > 0) {
          const randomLine = progressLines[Math.floor(Math.random() * progressLines.length)];
          this.time.delayedCall(2000, () => {
            if (!this.scene.isActive()) return;
            showMemoryMoment(randomLine);
          });
        }
      }
      // day2 清晨「岛屿的第一声回应」：睡醒（次日 06:00）仍留在 farm 时立即尝试触发
      this.time.delayedCall(1800, () => this.tryFirstMorningSequence());
      // FEATURE-041 木匠回归演出：睡醒后仍留在 farm 时立即尝试触发（老屋已完成且未回归过）
      this.time.delayedCall(2000, () => this.tryCarpenterReturn());
      // 反馈 #28 阿风欢迎「你回来了！」：睡醒后仍留在 farm 时尝试触发
      this.time.delayedCall(2200, () => this.tryAdventurerWelcome());
      // 第一章 P2 捕虫玩法 V0.1（2026-08-13）：跨天刷新蝴蝶（已捕捉的重生）
      this.refreshButterfliesNextDay();
    } finally {
      this.sleeping = false;
    }
  }

  /**
   * 创建观星点视觉（双层光圈 + ✦ 标记，初始隐藏）
   * 主线完成 + 夜晚时由 updateStargaze 显示
   */
  private createStargazePoint(): void {
    const { x, y } = this.STARGAZE_POS;
    const outer = this.add.ellipse(x, y, 46, 46, 0x8a9bd6, 0.12);
    const inner = this.add.ellipse(x, y, 22, 22, 0xaebff5, 0.28);
    outer.setDepth(5);
    inner.setDepth(6);
    this.stargazeMark = this.add.text(x, y - 6, '✦', {
      fontFamily: 'Arial', fontSize: '20px', color: '#e8ecff',
    }).setOrigin(0.5).setDepth(7);
    this.stargazeSprites = [outer, inner];
    this.setStargazeVisible(false);
  }

  /** 控制观星点整体显隐 */
  private setStargazeVisible(visible: boolean): void {
    for (const s of this.stargazeSprites) s.setVisible(visible);
    if (this.stargazeMark) this.stargazeMark.setVisible(visible);
  }

  /**
   * 创建星空背景（MVP：静态星野底 + 星点闪烁）
   * 仅 farm 场景使用，观星夜/夜晚时显示
   */
  private createStarField(): void {
    if (this.mapKey !== 'farm') return;
    // P0 修复（2026-08-09）：farm 场景多次重进时，Phaser shutdown 会自动销毁场景内对象，
    // 但 starTwinkle/stargazeDust/starCross 数组不会自动清空，残留已销毁的精灵/粒子引用。
    // 观星夜 setStarFieldVisible 对悬垂 emitter 调 start() 会触发 Phaser resetCounters 的 null.fill 崩溃
    // （probe-full-story-run 观星夜复现，堆栈：setStarFieldVisible → start → resetCounters）。
    this.starTwinkle = [];
    this.starCross = [];
    this.stargazeDust = [];
    this.stargazeMoon = null;
    this.stargazeTownLights = null;
    this.starField = null;
    // 屏幕坐标系修复（2026-08-12）：starField 从世界坐标(scrollFactor=1)改为屏幕坐标
    // (scrollFactor=0)，使 (0,0) 永远钉在相机视口左上角，fillRect 精确覆盖可视区域。
    // scrollFactor(0) 的对象不受 zoom 影响（同 rainOverlay 处理方式），直接用 cam.width/height。
    // 之前错误地除以 zoom 导致尺寸缩小，幕布无法覆盖全屏。
    const cam = this.cameras.main;
    const starW = cam.width + 4;  // +4px 余量防浮点取整缝隙
    const starH = cam.height + 4;
    // 静态星野底（深蓝渐变 + 散布星点）
    this.starField = this.add.graphics();
    this.starField.setDepth(15); // 高于玩家(10)和作物(2-3)，盖住农田
    this.starField.setScrollFactor(0); // 屏幕坐标：不随相机 scroll 移动
    // 深蓝夜空渐变（v2 微调：暗部略提亮 0x0a1628→0x0d1a30）
    this.starField.fillGradientStyle(0x0d1a30, 0x0d1a30, 0x1a2a4a, 0x1a2a4a, 1, 1, 1, 1);
    this.starField.fillRect(0, 0, starW, starH);
    // 静态星点（确定性，基于位置哈希；v2 分两层：近层亮 + 远层暗）
    const rng = (seed: number) => {
      let s = seed;
      return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    };
    const rand = rng(42);
    // 近层 80 颗（亮 0.6~0.9，稍大）
    for (let i = 0; i < 80; i++) {
      const sx = rand() * starW;
      const sy = rand() * starH;
      const size = 1 + rand() * 1.4;
      const alpha = 0.6 + rand() * 0.3;
      this.starField.fillStyle(0xffffff, alpha);
      this.starField.fillCircle(sx, sy, size);
    }
    // 远层 60 颗（暗 0.2~0.4，偏小）
    for (let i = 0; i < 60; i++) {
      const sx = rand() * starW;
      const sy = rand() * starH;
      const size = 0.5 + rand() * 0.9;
      const alpha = 0.2 + rand() * 0.2;
      this.starField.fillStyle(0xffffff, alpha);
      this.starField.fillCircle(sx, sy, size);
    }
    // 银河带（半透明白色带状，v2 宽度微增——更"银河"感）
    this.starField.fillStyle(0xffffff, 0.06);
    this.starField.beginPath();
    this.starField.moveTo(starW * 0.18, 0);
    this.starField.lineTo(starW * 0.38, starH);
    this.starField.lineTo(starW * 0.64, starH);
    this.starField.lineTo(starW * 0.28, 0);
    this.starField.closePath();
    this.starField.fillPath();
    // v0.10.4 银河叠淡蓝带（A 档：更"银河"感——真实夜晚而非幻想，0.04 蓝叠加白带，宽度同步微增）
    this.starField.fillStyle(0x8fb8ff, 0.04);
    this.starField.beginPath();
    this.starField.moveTo(starW * 0.2, 0);
    this.starField.lineTo(starW * 0.4, starH);
    this.starField.lineTo(starW * 0.62, starH);
    this.starField.lineTo(starW * 0.3, 0);
    this.starField.closePath();
    this.starField.fillPath();
    // v0.10.4 远景小镇灯光（观星夜远景：地平线一排暖黄光点——"青禾镇还亮着"，纯装饰）
    // 与星空同显同隐（setStarFieldVisible 同步）
    // 屏幕坐标：灯光铺在屏幕底部 75% 处（地平线位置），横向铺满
    this.stargazeTownLights = this.add.graphics();
    this.stargazeTownLights.setScrollFactor(0);
    this.stargazeTownLights.fillStyle(0xffddaa, 0.85);
    const townY = starH * 0.75;
    for (let i = 0; i < 9; i++) {
      const lx = starW * (0.15 + 0.70 * (i / 8)) + (rand() - 0.5) * 6;
      const ly = townY + (rand() - 0.5) * 4;
      this.stargazeTownLights.fillCircle(lx, ly, 1 + rand() * 0.8);
    }
    this.stargazeTownLights.setDepth(15); // 与星空底同层，低于闪烁星(16)
    this.stargazeTownLights.setVisible(false);
    // 动态星点（v2：50 颗闪烁——8 颗大星带十字光芒 + 42 颗普通，旋转慢闪）
    this.starTwinkle = [];
    this.starCross = [];
    // 大星（8 颗：十字光芒 = 4 条短 line 交叉，container 整体旋转慢闪）
    for (let i = 0; i < 8; i++) {
      const cx = rand() * starW;
      const cy = rand() * starH;
      const c = this.add.container(cx, cy);
      const g = this.add.graphics();
      g.lineStyle(1, 0xffffff, 0.55);
      g.lineBetween(-7, 0, 7, 0);
      g.lineBetween(0, -7, 0, 7);
      g.lineStyle(1, 0xddeeff, 0.3);
      g.lineBetween(-11, 0, -7, 0);
      g.lineBetween(7, 0, 11, 0);
      g.lineBetween(0, -11, 0, -7);
      g.lineBetween(0, 7, 0, 11);
      c.add(g);
      const star = this.add.ellipse(0, 0, 2.4, 2.4, 0xffffff, 0.9);
      c.add(star);
      c.setDepth(16);
      c.setScrollFactor(0); // 屏幕坐标：与 starField 同步
      c.setData('phase', rand() * Math.PI * 2);
      c.setData('speed', 0.5 + rand() * 1.0);
      this.starCross.push(c);
      this.starTwinkle.push(star);
    }
    // 普通闪烁星（42 颗）
    for (let i = 0; i < 42; i++) {
      const tx = rand() * starW;
      const ty = rand() * starH;
      const tSize = 1 + rand() * 2;
      const star = this.add.ellipse(tx, ty, tSize, tSize, 0xffffff, 0.8);
      star.setDepth(16); // 高于星空底(15)，盖住农田
      star.setScrollFactor(0); // 屏幕坐标：与 starField 同步
      star.setData('phase', rand() * Math.PI * 2);
      star.setData('speed', 0.5 + rand() * 1.5);
      this.starTwinkle.push(star);
    }
    // v2 月光：淡月（天空）+ 观星点旁月光斑（让旧墙/石头收到月光，ADD 泛光）
    // 月亮位置用绝对坐标 (400,112)：观星点(504,232) zoom≈2.15 居中时视野 y∈[82,382]，
    // 原相对位 (W*0.62,H*0.16)=(397,64) 在视野上方之外 → 月亮全程不可见（2026-08-11 修复）。
    this.stargazeMoon = this.add.container(0, 0);
    const moonGlow = this.add.graphics();
    moonGlow.fillStyle(0xcfe0ff, 0.1);
    moonGlow.fillCircle(400, 112, 18);
    moonGlow.fillStyle(0xdbe8ff, 0.35);
    moonGlow.fillCircle(400, 112, 7);
    this.stargazeMoon.add(moonGlow);
    const groundMoon = this.add.ellipse(this.STARGAZE_POS.x, this.STARGAZE_POS.y + 14, 90, 30, 0xa9c4ff, 0.1);
    groundMoon.setBlendMode(Phaser.BlendModes.ADD);
    this.stargazeMoon.add(groundMoon);
    this.stargazeMoon.setDepth(15);
    this.stargazeMoon.setVisible(false);
    // v2 星光粒子：观星点上空 20 颗淡蓝白星光慢漂（复用森林萤火虫模式，ADD）
    const dustSpots: Array<[number, number]> = [
      [this.STARGAZE_POS.x - 10, this.STARGAZE_POS.y - 46],
      [this.STARGAZE_POS.x + 18, this.STARGAZE_POS.y - 60],
      [this.STARGAZE_POS.x + 44, this.STARGAZE_POS.y - 38],
      [this.STARGAZE_POS.x + 6, this.STARGAZE_POS.y - 74],
    ];
    dustSpots.forEach(([dx, dy]) => {
      const p = this.add.particles(dx, dy, '__WHITE', {
        lifespan: 3400,
        speedY: { min: -16, max: 16 },
        speedX: { min: -14, max: 14 },
        quantity: 1,
        frequency: 480,
        alpha: { start: 0.5, end: 0 },
        scale: { start: 0.24, end: 0.08 },
        tint: 0xddeeff,
        blendMode: 'ADD',
      });
      p.setDepth(17); // 高于闪烁星(16)，星光点近景感
      p.stop();
      this.stargazeDust.push(p);
    });
    this.starField.setVisible(false);
    this.setStarTwinkleVisible(false);
  }

  /** 控制星空显隐 */
  private setStarFieldVisible(visible: boolean): void {
    this.starFieldVisible = visible;
    if (this.starField) this.starField.setVisible(visible);
    // v0.10.4 远景小镇灯光与星空同显同隐
    if (this.stargazeTownLights) this.stargazeTownLights.setVisible(visible);
    // v2 月光 / 星光粒子随星空同显同隐（粒子启动/停止）
    if (this.stargazeMoon) this.stargazeMoon.setVisible(visible);
    for (const p of this.stargazeDust) {
      if (visible) p.start(); else p.stop();
    }
    this.setStarTwinkleVisible(visible);
  }

  /** 控制闪烁星点显隐 */
  private setStarTwinkleVisible(visible: boolean): void {
    for (const s of this.starTwinkle) s.setVisible(visible);
    for (const c of this.starCross) c.setVisible(visible);
  }

  /** 更新星空闪烁动画（每帧调用） */
  private updateStarField(): void {
    if (!this.starFieldVisible) return;
    const t = this.time.now / 1000;
    for (const star of this.starTwinkle) {
      const phase = star.getData('phase') as number;
      const speed = star.getData('speed') as number;
      const alpha = 0.4 + 0.6 * Math.sin(t * speed + phase);
      star.setAlpha(alpha);
    }
    // v2 大星十字光芒：慢速旋转（缓慢扫动，增加星空层次）
    for (const c of this.starCross) {
      const phase = c.getData('phase') as number;
      const speed = c.getData('speed') as number;
      c.setRotation(0.15 * Math.sin(t * speed * 0.4 + phase));
      c.setAlpha(0.5 + 0.5 * Math.sin(t * speed + phase));
    }
  }

  /** 观星点显隐 + 呼吸闪烁（每帧，仅 farm 且主线完成时显示；白天可靠近选"坐等天黑"） */
  private updateStargaze(): void {
    if (this.mapKey !== 'farm' || this.stargazeSprites.length === 0) return;
    const eligible = getQuestState() === 'completed' && !isObservatoryComplete();
    const show = eligible && !(this.storyDialogue && this.storyDialogue.isOpen());
    this.setStargazeVisible(show);
    // 主线完成后实时刷新 HUD 目标文案（白天/夜晚文案不同）
    const obj = getQuestObjective();
    if (obj !== this.lastQuestObj) {
      this.lastQuestObj = obj;
      this.updateQuestHUD();
    }
    if (!show) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 400);
    this.stargazeSprites[0].setAlpha(0.08 + 0.1 * pulse);
    this.stargazeSprites[1].setAlpha(0.22 + 0.14 * pulse);
    if (this.stargazeMark) this.stargazeMark.setAlpha(0.6 + 0.4 * pulse);
  }

  /**
   * 观星交互：主线完成（第一章收束）+ 靠近观星点按 E
   * - 夜晚 20:00 后 → 直接触发观星收尾剧情
   * - 白天 → 弹"坐等天黑"选项，快进到当晚 20:00 后触发（只触发一次）
   */
  private tryStargaze(): boolean {
    if (this.mapKey !== 'farm') return false;
    if (getQuestState() !== 'completed' || isObservatoryComplete()) return false;
    const dx = this.player.x - this.STARGAZE_POS.x;
    const dy = this.player.y - this.STARGAZE_POS.y;
    if (dx * dx + dy * dy > 48 * 48) return false;
    // 白天：提供"坐等天黑"（快进到当晚 20:00 后触发观星夜）
    if (getTime().hour < 20) {
      this.promptWaitForNight();
      return true;
    }
    this.startStargaze();
    return true;
  }

  /** 坐等天黑：快进到当晚 20:00 → 触发观星夜（选项行不可跳过，不选则保持现状） */
  private promptWaitForNight(): void {

    this.playStory(
      [
        { speaker: '', color: COLORS.system, text: '（你坐在观星点旁。天色还亮着——要在这里等到天黑吗？）' },
        { speaker: '', color: COLORS.system, text: '', options: ['坐等天黑', '再等等'] },
      ],
      () => { /* 选项行不可跳过，正常不会走到；兜底不触发 */ },
      (index: number) => {
        if (index !== 0) return;
        setTimeFull(getTime().day, 20, 0);
        this.rebuildNPCs();
        this.updateTimeHUD();
        this.startStargaze();
      },
    );
  }

  /** 观星夜触发主体（原 tryStargaze 后半段）：标记终态 + 播放收尾剧情 */
  private startStargaze(): void {
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    this.inStargazeCutscene = true; // v0.10.4 演出互斥：镜头期间抑制其他自动演出
    markObservatoryComplete();
    triggerTag('stargaze_night');
    // v0.11（P0.5）：观星终章为剧情覆盖，晨曦结束（回到白天）时由 endStory() 清除
    MusicSystem.playStory('stargaze_final');
    play('stargaze'); // 观星夜演出音效（试玩-14）
    play('wind');     // v0.10.4 微风：树叶沙沙 + 远处虫鸣（低音量一次性，约 20% 强度）
    // 显示星空（v0.10.4 A 档：静态星野底 + 银河叠淡蓝 + 远景小镇灯光 + 星点闪烁）
    this.setStarFieldVisible(true);
    // 观星夜居中兜底（2026-08-11）：starField 已扩展覆盖最大视野，这里再把相机背景
    // 设为深蓝夜空色双保险，覆盖任何边角（晨曦结束时 setBackgroundColor() 恢复透明，防黑屏）。
    this.cameras.main.setBackgroundColor(0x0d1a30);
    // 解除相机跟随 + 边界（#29 补丁 2026-08-08）：
    // 1. useBounds=false：观星点 (504,232) 靠近地图右下缘，zoom=2 视野 400x300 下
    //    clamp 上限只有 scroll=(40,-50)（相机中心最大 240,100），玩家会被推到画布右侧之外，
    //    表现为"观星夜画面偏左、看不到玩家"。解除 bounds 后相机才能滚到观星点使其真正居中。
    // 2. stopFollow：Phaser pan 结束后 follow 立即恢复（Camera.js: follow && !panEffect.isRunning），
    //    每帧把相机拉回玩家——实测 1.5s 即偏 8px，17 行演出期间会彻底拖离观星点，
    //    手机端表现为"画面中心不在屏幕正中间"。演出期间相机必须钉在观星点。
    this.cameras.main.stopFollow();
    this.cameras.main.useBounds = false;
    // v0.10.4 流星：演出期间随机 2-3 颗划过（2.2s/6.2s/10.2s，一次性销毁）
    this.time.delayedCall(2200, () => this.spawnShootingStar());
    this.time.delayedCall(6200, () => this.spawnShootingStar());
    this.time.delayedCall(10200, () => this.spawnShootingStar());
    // v2 镜头三段（克制版，纯 pan 零 zoom——farm 640×400 右下角拉远会露背景灰边）：
    // 段1 近景（2s）：pan 至观星点中心——"抬头看天"（玩家原位与观星点近，天然抬头幅度）
    this.panCameraTo(this.STARGAZE_POS.x, this.STARGAZE_POS.y, 2000, () => {
      // 段2 中景（3s）：pan 看向农田/老屋方向——"我刚刚做的事情留在这个世界里"
      this.panCameraTo(400, 220, 3000, () => {
        // 段3 远景（3s）：pan 回观星点中心 + 星空展开——小镇灯光淡入 + 亮度脉冲 + 流星
        this.panCameraTo(this.STARGAZE_POS.x, this.STARGAZE_POS.y, 3000, () => {
          // 小镇灯光淡入（远景地平线亮起——"青禾镇还亮着"）
          if (this.stargazeTownLights) {
            this.stargazeTownLights.setVisible(true).setAlpha(0);
            this.tweens.add({ targets: this.stargazeTownLights, alpha: 1, duration: 1500, ease: 'Sine.out' });
          }
          // 星空亮度脉冲一次（"爷爷记忆里的星空"）
          this.tweens.add({ targets: this.starField, alpha: 0.72, duration: 700, yoyo: true, ease: 'Sine.out' });
          // v2 对话阶段：绕观星点中心极慢横移（±12px 往返，1.6s 一个周期，持续到分支独白）
          // 不单向漂移（会逐渐把观星点推出屏幕中心）——保持"画面中央=观星点"的前提下轻微呼吸
          const cam = this.cameras.main;
          const baseX = cam.scrollX;
          this.stargazeDriftTween = this.tweens.add({
            targets: cam,
            scrollX: baseX + 12,
            duration: 1600,
            ease: 'Sine.inOut',
            yoyo: true,
            repeat: -1,
          });
          // 分支独白 zoom 开始前会 stop（避免与 zoom 冲突），停时回到 baseX 附近
          // 镜头到位后显示记忆片段 + 开始对话
          showMemoryMoment('这片星空，和爷爷记忆里的一样。');
          this.storyDialogue?.play(
            this.buildStargazeLines(),
            () => this.finishStargaze(),
            (index: number) => {
              const choice: EndingChoice = index === 0 ? 'try_stay' : index === 1 ? 'unknown' : 'tonight';
              setEndingChoice(choice);
              this.playStargazeAfter(DEMO_ENDING_BRANCHES[choice]);
            },
          );
        });
      });
    });
  }

  /**
   * B 观星夜呼应：构建观星夜对白（·一 完成 → 夏雅加半句，玩家做的事被世界记住）。
   * - 观星夜对白 `DEMO_ENDING_DIALOGUE` 逐句定稿（一字不改红线），此处用副本注入，不碰定稿数组。
   * - 插在夏雅"总有一天，会有人回来继续看。"之后、信揭示之前。
   * - 定稿（制作人 2026-08-19 拍板候选 4，替换 08-15 方向稿）："……最近，看星星的人，好像多了。"
   *   callback 爷爷"总有一天，会有人回来继续看"→"看星星的人多了"；避开与爷爷笔记"今晚的星星，比往年亮"撞车；
   *   不说"亮"、不说"变好"，留白给玩家自己拼（有人回来了）。
   */
  private buildStargazeLines(): DialogueLine[] {
    const lines = [...DEMO_ENDING_DIALOGUE];
    if (this.xiyaLetterDone) {
      lines.splice(6, 0, { speaker: '夏雅', color: COLORS.xiya, text: '……最近，看星星的人，好像多了。' });
    }
    return lines;
  }

  /** v0.10.4 流星：头亮尾淡的短尾迹，斜向划过 1.2s，一次性销毁（纯 Graphics + tween） */
  private spawnShootingStar(): void {
    if (!this.starFieldVisible) return;
    // 屏幕坐标：流星在可视区域内随机生成，与 starField 同坐标系
    // scrollFactor(0) 不受 zoom 影响，直接用 cam.width/height
    const cam = this.cameras.main;
    const vw = cam.width;
    const vh = cam.height;
    const sx = vw * (0.25 + Math.random() * 0.45);
    const sy = vh * (0.12 + Math.random() * 0.18);
    const angle = Math.PI / 4 + Math.random() * Math.PI / 8; // 斜向（右上→左下）
    const vx = Math.cos(angle), vy = Math.sin(angle);
    const c = this.add.container(sx, sy).setDepth(16);
    c.setScrollFactor(0); // 屏幕坐标：与 starField 同步
    const g = this.add.graphics();
    // 头部亮点 + 递减尾迹（3 段，从头部向后 60px）
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(0, 0, 1.8);
    g.lineStyle(1.5, 0xffffff, 0.35);
    g.lineBetween(0, 0, -vx * 22, -vy * 22);
    g.lineStyle(1.2, 0xffffff, 0.18);
    g.lineBetween(-vx * 22, -vy * 22, -vx * 44, -vy * 44);
    g.lineStyle(1, 0xffffff, 0.08);
    g.lineBetween(-vx * 44, -vy * 44, -vx * 62, -vy * 62);
    c.add(g);
    this.tweens.add({
      targets: c,
      x: sx + vx * 240, y: sy + vy * 240,
      duration: 1200, ease: 'Linear',
      onComplete: () => c.destroy(),
    });
  }

  /** 观星夜跳过/未选择时走默认分支 */
  private finishStargaze(): void {
    if (getEndingChoice()) return;
    setEndingChoice('try_stay');
    this.playStargazeAfter(DEMO_ENDING_BRANCHES['try_stay']);
  }

/** 观星夜：分支独白 → 次日清晨 → 结算面板 + 存档 */
  private playStargazeAfter(branch: DialogueLine[]): void {
    if (!this.storyDialogue) return;
    // v2 分支独白：镜头拉近（2.0→2.15，1.5s）聚焦角色（以观星点为中心，配合上抬位）
    this.zoomCameraAt(this.STARGAZE_POS.x, this.STARGAZE_POS.y, 2.15, 1500);
    this.playStory(branch, () => {
      this.storyDialogue!.play(DEMO_ENDING_FINALE, () => {
        // v2 分支独白结束后镜头缓缓拉回 2.0（晨曦全景），zoom 复位避免状态残留
        const cam = this.cameras.main;
        const p2 = { z: cam.zoom };
        this.tweens.add({
          targets: p2,
          z: 2.0,
          duration: 1200,
          ease: 'Sine.inOut',
          onUpdate: () => {
            cam.zoom = p2.z;
            cam.scrollX = this.STARGAZE_POS.x - cam.width / (2 * cam.zoom);
            cam.scrollY = this.STARGAZE_POS.y - cam.height / (2 * cam.zoom);
          },
        });
        // v2 第一缕阳光：晨曦中段（1.6s）地平线斜向一道淡金线扫过 1.5s（"新一天的第一束光"）
        this.time.delayedCall(1600, () => {
          const cam0 = this.cameras.main;
          const sun = this.add.graphics();
          sun.setScrollFactor(0).setDepth(99);
          // 斜向光带（从画面左下往右上方向，淡金色）
          const x0 = -60, y0 = cam0.height * 0.72;
          const x1 = cam0.width * 0.95, y1 = cam0.height * 0.28;
          sun.lineStyle(3, 0xffe9b8, 0.5);
          sun.lineBetween(x0, y0, x1, y1);
          sun.lineStyle(7, 0xffe9b8, 0.22);
          sun.lineBetween(x0, y0, x1, y1);
          sun.setAlpha(0);
          this.tweens.add({
            targets: sun, alpha: 1,
            duration: 500, ease: 'Sine.in',
            yoyo: true, hold: 500,
            onComplete: () => sun.destroy(),
          });
        });
        // 晨曦过渡（v0.10.4：2s → 3.5s，制作人拍板节奏——0s 夜空 → 1.5s 变亮 → 3.5s 角色站晨光里）
        // 不是"新一天开始"的高潮，而是"昨晚发生的事情是真的"；ease Sine.easeOut 前快后缓
        this.tweens.add({
          targets: cam,
          duration: 3500,
          ease: 'Sine.easeOut',
          onUpdate: (_tween, target: Phaser.Cameras.Scene2D.Camera) => {
            // 渐变天空颜色（通过 tint 模拟晨曦；_tween.progress 已含 ease 曲线）
            const progress = _tween.progress;
            const r = Math.floor(8 + progress * 52);
            const g = Math.floor(16 + progress * 40);
            const b = Math.floor(38 - progress * 10);
            target.setBackgroundColor(`rgb(${r},${g},${b})`);
          },
          onComplete: () => {
            // 隐藏星空，恢复白天
            this.setStarFieldVisible(false);
            // v0.11（P0.5）：观星夜演出结束（回到白天），清除剧情覆盖；
            // 之后结算/回主菜单/继续游玩都按"剧情 > 我的歌 > 地图默认"重新决策
            MusicSystem.endStory();
            // 重置相机背景为透明（防黑屏：setBackgroundColor 持久化会导致后续场景黑屏）
            cam.setBackgroundColor();
            // 镜头拉回玩家位置（zoom 补偿见 panCameraTo，#29）
            this.panCameraTo(this.player.x, this.player.y, 1000, () => {
              this.updateHUD();
              // 恢复相机边界（#29）：观星期间临时 useBounds=false，此刻玩家已回到可
              // 见区域，恢复后 follow 正常。EndingPanel 紧随其后全屏打开，无可见跳变。
              this.cameras.main.useBounds = true;
              // 恢复相机跟随（BUG-050 修复）：cam.pan / panCameraTo 内部会自动
              // stopFollow() 解除跟随绑定，观星夜两次 pan 后跟随失效，导致结束后
              // 玩家移动时相机不再跟随（走到下方角色出框说法不成立）。此处按初始参数重新绑定。
              if (!this.centerSmallMap) {
                this.cameras.main.startFollow(this.player, true, 0.1, 0.1, 0, 0);
              }
              // v2 结束方式：1s 黑场呼吸（记录时刻的庄重——"昨晚是真的"）后再打开结算
              const veil = this.add.rectangle(0, 0, cam.width, cam.height, 0x000000, 0)
                .setOrigin(0).setScrollFactor(0).setDepth(100);
              this.tweens.add({
                targets: veil, alpha: 0.85,
                duration: 450, yoyo: true, hold: 100, ease: 'Sine.out',
                onComplete: () => {
                  veil.destroy();
                  // [A-1] 章节切换仪式感（2026-08-13 制作人拍板）：EndingPanel 关闭后
                  // 触发 CH1_AWAKENING_DIALOGUE，建立"新生活开始"信号，承接第0章、引出老屋整理。
                  // onClose 只在首次创建时注入（避免重复绑定）；triggerOnce 保证一次性。
                  if (!this.endingPanel) {
                    this.uiBus.registerEndingPanel(new EndingPanel(() => {
                      this.time.delayedCall(600, () => {
                        if (hasTriggered('ch1_awakening')) return;
                        if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
                        triggerOnce('ch1_awakening', () => {
                          this.storyDialogue!.play(CH1_AWAKENING_DIALOGUE, () => {
                            this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
                          });
                        });
                      });
                    }));
                  }
                  // 第一章衔接（P0-1，2026-08-12）：观星夜完成 → 进入第一章「复苏」
                  // 必须在本次存档前设置，使 chapter 随档持久化；D-025 时序红线：观星夜之后才进第1章
                  setChapter(CHAPTER_1);
                  this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
                  this.inStargazeCutscene = false; // v0.10.4 演出结束，恢复自动演出
                  this.endingPanel.open();
                },
              });
            });
          },
        });
      });
    });
  }

  /** 采集星之碎片（森林对话结束后自动执行） */
  private doCollectShard(): void {
    // 获取当前碎片数量（采集前），用于确定播放哪段闪回
    const shardIndex = getItemCount('star_shard');
    const flashback = getShardFlashback(shardIndex);

    // 播放记忆闪回
    if (flashback) {
      // 碎片闪回配剧情插图背景：
      //   shard 0 牵牛星·田埂看星 → stargaze_niulang_v1
      //   shard 1 老槐树·午后孩子群 → shard2_huai_tree_v1
      const FLASHBACK_BG: Record<number, string> = {
        0: 'assets/images/story/stargaze_niulang_v1.jpg',
        1: 'assets/images/story/shard2_huai_tree_v1.jpg',
      };
      const bg = FLASHBACK_BG[shardIndex];
      playMemoryFlashback(flashback, () => {
        // 闪回结束后执行采集
        this.executeShardCollection();
      }, bg);
    } else {
      // 无闪回数据，直接采集
      this.executeShardCollection();
    }
  }

  /** 执行碎片采集（数据层） */
  private executeShardCollection(): void {
    play('shard'); // 星之碎片拾取演出音效（试玩-14）
    collectShard();
    this.shardSprite?.destroy();
    this.shardSprite = null;
    // VIS-01：清理碎片视觉（光晕/星芒/粒子/tween）
    this.shardGlow?.destroy();
    this.shardGlow = null;
    this.shardStar?.destroy();
    this.shardStar = null;
    this.shardParticles?.destroy();
    this.shardParticles = null;
    this.shardTweens.forEach((t) => t.stop());
    this.shardTweens = [];
    addItem('star_shard', 1);
    onDQCollect('star_shard');
    this.updateDailyQuestPanel();
    this.showDialogueText('采集到「星之碎片」！返回镇长交付任务。');
    this.updateQuestHUD();
    // 里程碑保存（v0.5.2 P0）：碎片采集后立即入档
    this.saveAtPlayer(); // BUG-FIX（B3/B4）：异步入口（playMemoryFlashback 回调）统一走守卫入口
  }

  /**
   * 收集屋内真实床铺格（Ground 层 gid 9）。
   * 扫描睡觉判定格：
   *   house → Ground 层 gid 9（真实床铺）
   *   farm  → Walls 层 gid 6（木屋地板；教程提示在 farm，玩家在木屋内按 E 即可睡觉）
   * 扫描失败时回退到已知区域（house cols 2-3, rows 2-3；farm cols 3-8, rows 19-23），保证睡觉判定不失效。
   */
  private collectBedTiles(map: Phaser.Tilemaps.Tilemap): void {
    this.bedTiles.clear();
    // house: Ground 层 gid 9；farm: Walls 层 gid 6
    const targetLayerName = this.mapKey === 'house' ? 'Ground' : 'Walls';
    const targetGid = this.mapKey === 'house' ? 9 : 6;
    for (const layerData of map.layers) {
      if (layerData?.name !== targetLayerName) continue;
      const data = layerData?.data;
      if (!data) continue;
      for (let r = 0; r < data.length; r++) {
        for (let c = 0; c < data[r].length; c++) {
          if (data[r][c]?.index === targetGid) {
            this.bedTiles.add(`${c},${r}`);
          }
        }
      }
    }
    if (this.bedTiles.size === 0) {
      if (this.mapKey === 'house') {
        for (let c = 2; c <= 3; c++) {
          for (let r = 2; r <= 3; r++) {
            this.bedTiles.add(`${c},${r}`);
          }
        }
      } else {
        for (let c = 3; c <= 8; c++) {
          for (let r = 19; r <= 23; r++) {
            this.bedTiles.add(`${c},${r}`);
          }
        }
      }
    }
    console.log(`[MapScene:${this.mapKey}] 睡觉判定格 ${this.bedTiles.size} 个`);
  }

  /**
   * house 场景：床铺格（Ground gid 9）叠加程序化绘制的俯视床。
   * 背景：gid9 在 tileset 里是屋顶瓦片（陶土红），2×2 平铺看不出是床，
   * 玩家无法一眼识别睡觉点。这里在床区域绘制「床头板+床垫+枕头+红被子+格纹」，
   * 并在床头上方加 💤 睡眠标记。睡觉判定逻辑（bedTiles）不受影响。
   */
  private setupHouseBed(): void {
    // 床区域：tile (2,2)-(3,3) → 像素 (32,32)-(64,64)（2×2 tile = 32×32）
    const x = 2 * TILE_SIZE;
    const y = 2 * TILE_SIZE;
    const w = 2 * TILE_SIZE;
    const h = 2 * TILE_SIZE;

    const bed = this.add.graphics();
    // ── 床外框（深棕木框，与木地板区分） ──
    bed.fillStyle(0x4a3018, 1);
    bed.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 3);
    // ── 床垫（米白） ──
    bed.fillStyle(0xf0ead8, 1);
    bed.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 3);
    // ── 枕头（纯白，床头下方） ──
    bed.fillStyle(0xffffff, 1);
    bed.fillRoundedRect(x + 7, y + 5, w - 14, 8, 3);
    bed.lineStyle(1, 0xd8d0c0, 0.8);
    bed.lineBetween(x + 7, y + 9, x + w - 7, y + 9);
    // ── 被子（鲜红，盖住下半部分） ──
    bed.fillStyle(0xd03020, 1);
    bed.fillRoundedRect(x + 2, y + 15, w - 4, h - 17, 3);
    // 被子格纹（深红横线，清晰）
    bed.lineStyle(1, 0xa02018, 0.9);
    bed.lineBetween(x + 3, y + 20, x + w - 3, y + 20);
    bed.lineBetween(x + 3, y + 25, x + w - 3, y + 25);
    bed.setDepth(2);

    // ── 💤 睡眠标记（床头上方，静态，玩家一眼识别） ──
    const zzz = this.add.text(x + w / 2, y - 9, '💤', {
      fontSize: '13px',
      color: '#ffffff',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(3);
    void zzz;
  }

  /**
   * 老屋生活家具（v0.10.2 制作人拍板：L1 生活家具 + L2 生活痕迹）
   * 原则："不是把爷爷摆出来，而是让爷爷留下来的生活自然存在"。
   * 旧≠破：归星岛是"被时间暂停的地方"，不是"被遗弃的废墟"——用褪色/磨损，不用裂纹/倒塌。
   * L3 私人遗物（旧课本/信件/照片）暂缓，等"整理老屋"剧情节点。
   * 全部纯装饰 Graphics：不交互、不弹提示、不加剧情、不加存档、无碰撞（与 setupHouseBed 一致）。
   */
  private setupHouseFurniture(): void {
    const T = TILE_SIZE;
    const WOOD_DARK = 0x4a3018, WOOD_MID = 0x5a3a20, WOOD_LIGHT = 0x8a6a42;
    const OLD_TAN = 0xb8a888, METAL = 0x8a8a84, BAMBOO = 0xc8a868, LINEN = 0xe0d8c8;

    // ── L1-1 餐桌 + 2 椅（右下客厅区，贴墙避让主通道） ──
    const tx = 14 * T, ty = 8 * T;
    const table = this.add.graphics();
    table.fillStyle(WOOD_DARK, 1);
    table.fillRoundedRect(tx, ty, 4 * T, 24, 3);          // 桌面 64×24
    table.fillStyle(WOOD_MID, 1);
    table.fillRect(tx + 4, ty + 24, 5, 12);               // 桌腿 ×4
    table.fillRect(tx + 4 * T - 9, ty + 24, 5, 12);
    table.fillStyle(OLD_TAN, 0.3);
    table.fillRect(tx + 10, ty + 9, 3 * T, 2);            // 桌面旧痕（磨损非破损）
    table.fillRect(tx + 14, ty + 14, 2 * T, 2);
    table.setDepth(2);
    // 椅 A（桌左侧） / 椅 B（桌下前方）
    const chairA = this.add.graphics();
    chairA.fillStyle(WOOD_MID, 1);
    chairA.fillRect(tx - 9, ty + 6, 14, 3);               // 坐面
    chairA.fillStyle(WOOD_DARK, 0.9);
    chairA.fillRect(tx - 9, ty + 9, 3, 10);               // 腿/靠背
    chairA.fillRect(tx + 2, ty + 9, 3, 10);
    chairA.setDepth(2);
    const chairB = this.add.graphics();
    chairB.fillStyle(WOOD_MID, 1);
    chairB.fillRect(tx + 16, ty + 28, 14, 3);             // 坐面（桌前）
    chairB.fillStyle(WOOD_DARK, 0.9);
    chairB.fillRect(tx + 16, ty + 31, 3, 8);
    chairB.fillRect(tx + 27, ty + 31, 3, 8);
    chairB.setDepth(2);

    // ── L1-2 碗柜（厨房区，灶台 gid12 右侧） ──
    const wcx = 5 * T, wcy = 11 * T;
    const cabinet = this.add.graphics();
    cabinet.fillStyle(WOOD_DARK, 1);
    cabinet.fillRoundedRect(wcx, wcy, 2 * T, 2 * T, 2);
    cabinet.fillStyle(WOOD_MID, 0.9);
    cabinet.fillRect(wcx + 2, wcy + 2, T - 2, 2 * T - 4); // 双开门
    cabinet.fillRect(wcx + T + 2, wcy + 2, T - 4, 2 * T - 4);
    cabinet.lineStyle(1, WOOD_LIGHT, 0.7);
    cabinet.strokeRect(wcx + 2, wcy + 2, T - 2, 2 * T - 4);
    cabinet.fillStyle(LINEN, 0.85);
    cabinet.fillCircle(wcx + T - 8, wcy + T, 2);          // 拉手
    cabinet.fillCircle(wcx + 2 * T - 8, wcy + T, 2);
    cabinet.setDepth(2);

    // ── L1-3 衣柜（卧室区，床右侧贴墙） ──
    const wdx = 7 * T, wdy = 2 * T;
    const wardrobe = this.add.graphics();
    wardrobe.fillStyle(WOOD_DARK, 1);
    wardrobe.fillRoundedRect(wdx, wdy, 2 * T, 2 * T, 2);
    wardrobe.fillStyle(WOOD_MID, 0.9);
    wardrobe.fillRect(wdx + 2, wdy + 2, T - 2, 2 * T - 4);
    wardrobe.fillRect(wdx + T + 2, wdy + 2, T - 4, 2 * T - 4);
    wardrobe.lineStyle(1, WOOD_LIGHT, 0.7);
    wardrobe.strokeRect(wdx + 2, wdy + 2, T - 2, 2 * T - 4);
    wardrobe.fillStyle(LINEN, 0.85);
    wardrobe.fillCircle(wdx + T - 8, wdy + T, 2);
    wardrobe.fillCircle(wdx + 2 * T - 8, wdy + T, 2);
    wardrobe.setDepth(2);

    // ── L1-4 木箱（右下角落） ──
    const bx = 17 * T, by = 12 * T;
    const box = this.add.graphics();
    box.fillStyle(WOOD_MID, 1);
    box.fillRoundedRect(bx, by, T, T, 2);
    box.fillStyle(WOOD_DARK, 0.9);
    box.fillRect(bx + 1, by + 4, T - 2, 2);               // 箱盖线
    box.fillStyle(OLD_TAN, 0.4);
    box.fillRect(bx + 4, by + 8, 3, 4);                   // 旧痕
    box.fillStyle(METAL, 0.8);
    box.fillRect(bx + 2, by + 2, 3, 3);                   // 铁皮角
    box.setDepth(2);

    // ── L1-5 老式收音机（客厅角落，靠右墙） ──
    const rx = 16 * T, ry = 3 * T;
    const radio = this.add.graphics();
    radio.fillStyle(0x6a4a28, 1);
    radio.fillRoundedRect(rx, ry, T, 12, 2);              // 木壳
    radio.fillStyle(0xd8c8a8, 0.9);
    radio.fillRoundedRect(rx + 3, ry + 3, 6, 6, 1);       // 喇叭格
    radio.lineStyle(1, WOOD_DARK, 0.8);
    radio.lineBetween(rx + 4, ry + 4, rx + 8, ry + 8);
    radio.lineBetween(rx + 8, ry + 4, rx + 4, ry + 8);
    radio.fillStyle(OLD_TAN, 1);
    radio.fillCircle(rx + 12, ry + 6, 1.6);               // 旋钮
    radio.setDepth(2);

    // ── L1-6 水壶（灶台旁） ──
    const kx = 12 * T, ky = 11 * T;
    const kettle = this.add.graphics();
    kettle.fillStyle(METAL, 1);
    kettle.fillRoundedRect(kx + 2, ky + 6, 10, 8, 2);     // 壶身
    kettle.fillRect(kx + 2, ky + 8, 3, 3);                // 壶嘴
    kettle.fillStyle(0x6a6a64, 1);
    kettle.fillRect(kx + 6, ky + 2, 2, 6);                // 提梁
    kettle.setDepth(2);

    // ── L1-7 菜篮（水壶旁，编竹） ──
    const cx2 = 13 * T, cy2 = 12 * T;
    const basket = this.add.graphics();
    basket.fillStyle(BAMBOO, 1);
    basket.fillRoundedRect(cx2, cy2, T, 10, 2);           // 篮身
    basket.lineStyle(1, 0xa88848, 0.8);
    basket.lineBetween(cx2 + 2, cy2 + 3, cx2 + 14, cy2 + 3);  // 编织线
    basket.lineBetween(cx2 + 2, cy2 + 6, cx2 + 14, cy2 + 6);
    basket.setDepth(2);

    // ── L2-1 农具挂墙（左墙，锄头斜挂 + 扁担横放） ──
    const ax = 1 * T, ay = 11 * T;
    const tools = this.add.graphics();
    tools.lineStyle(3, WOOD_MID, 1);
    tools.lineBetween(ax + 2, ay + 18, ax + 14, ay + 2);  // 锄柄（斜靠）
    tools.fillStyle(METAL, 1);
    tools.fillRect(ax + 12, ay, 4, 6);                    // 锄头铁
    tools.lineStyle(3, BAMBOO, 0.9);
    tools.lineBetween(ax + 2, ay + 6, ax + 14, ay + 6);   // 扁担（横挂）
    tools.setDepth(2);

    // ── L2-2 水桶（右下角落） ──
    const pxx = 18 * T, pyy = 12 * T;
    const pail = this.add.graphics();
    pail.fillStyle(METAL, 1);
    pail.fillRoundedRect(pxx + 2, pyy + 3, 12, 10, 2);    // 桶身
    pail.fillStyle(0x6a6a64, 1);
    pail.fillRect(pxx + 7, pyy - 1, 2, 5);                // 提手
    pail.fillStyle(0xb0b0a8, 0.5);
    pail.fillEllipse(pxx + 8, pyy + 3, 10, 2.5);          // 桶口
    pail.setDepth(2);

    // ── L2-3 竹筐 + 旧瓶（左上角落，收起来的生活） ──
    const yx = 1 * T, yy = 2 * T;
    const crate = this.add.graphics();
    crate.fillStyle(BAMBOO, 1);
    crate.fillRoundedRect(yx + 2, yy + 4, 12, 10, 2);     // 竹筐
    crate.lineStyle(1, 0xa88848, 0.8);
    crate.lineBetween(yx + 4, yy + 6, yx + 12, yy + 6);
    crate.fillStyle(0x7a8a5a, 0.85);
    crate.fillRect(yx + 10, yy, 4, 8);                    // 旧瓶（绿色玻璃）
    crate.fillStyle(OLD_TAN, 0.6);
    crate.fillRect(yx + 11, yy - 1, 2, 2);                // 瓶口
    crate.setDepth(2);

    // ── v0.10.3 补两件小物（最多两件，不再加） ──
    // 茶杯（餐桌上，白瓷 + 茶色水线）
    const cup = this.add.graphics();
    cup.fillStyle(LINEN, 1);
    cup.fillEllipse(tx + 46, ty + 8, 8, 4);               // 杯口
    cup.fillStyle(0x9a6a3a, 1);
    cup.fillEllipse(tx + 46, ty + 8.5, 5.5, 2.4);         // 茶色水面
    cup.fillStyle(LINEN, 1);
    cup.fillRect(tx + 43, ty + 7, 6, 7);                  // 杯身
    cup.lineStyle(1, OLD_TAN, 0.5);
    cup.lineBetween(tx + 44, ty + 10, tx + 49, ty + 9);   // 杯身旧痕
    cup.setDepth(2);
    // 小凳（餐桌左下，矮木凳 + 使用痕迹）
    const stool = this.add.graphics();
    stool.fillStyle(WOOD_MID, 1);
    stool.fillRoundedRect(tx - 14, ty + 30, 18, 4, 2);    // 坐面
    stool.fillStyle(WOOD_DARK, 0.9);
    stool.fillRect(tx - 14, ty + 34, 4, 8);               // 腿
    stool.fillRect(tx, ty + 34, 4, 8);
    stool.fillStyle(OLD_TAN, 0.35);
    stool.fillRect(tx - 10, ty + 31, 10, 1.5);            // 坐面磨痕
    stool.setDepth(2);
  }

  /** 玩家所在格是否在任一床铺格的相邻 1 格内（含床格本身） */
  private isNearBedTile(pc: number, pr: number): boolean {
    for (const key of this.bedTiles) {
      const [c, r] = key.split(',').map(Number);
      if (Math.abs(pc - c) <= 1 && Math.abs(pr - r) <= 1) return true;
    }
    return false;
  }

  /**
   * 刷新树木视觉（树桩恢复为树后更新贴图）
   * 仅更新当前贴图为 stump 但状态已恢复的精灵
   */
  private refreshTreeVisuals(): void {
    for (const [key, sprite] of this.treeSprites) {
      const [col, row] = key.split(',').map(Number);
      const tree = getTree(col, row);
      if (!tree) continue;
      if (!tree.isStump && sprite.texture.key === 'stump') {
        const textureKey = (col + row) % 2 === 0 ? 'tree1' : 'tree2';
        sprite.setTexture(textureKey);
        // 树再生长：还原显示 / 透明度 / 碰撞（树桩曾淡出隐藏并禁用碰撞）
        sprite.setVisible(true);
        sprite.setAlpha(1);
        (sprite.body as Phaser.Physics.Arcade.StaticBody).enable = true;
      }
    }
  }

  /**
   * 重建当前场景的 NPC（睡觉/时间跳变后调用）
   * 销毁旧 sprite，按新日程重新创建
   */
  rebuildNPCs(): void {
    for (const npc of this.npcList) {
      // v0.6 阶段 2a：销毁前先停止 idle tween（防止 sprite 引用失效后崩溃）
      npc.stopIdleAnimation();
      if (npc.sprite) {
        npc.sprite.destroy();
        npc.sprite = null;
      }
      if (npc.label) {
        npc.label.destroy();
        npc.label = null;
      }
    }
    this.setupNPCs();
    // v0.5.3 E1：跨天后重新判断清晨夏雅（清空旧精灵 + 按新天数重建）
    this.clearDawnXiya();
    // v0.5.3 E9：跨天后重新判断傍晚夏雅
    this.clearEveningXiya();
    // day2 清晨演出夏雅：跨天后不应残留（BUG-071）
    this.clearMorningXiya();
    if (this.mapKey === 'farm' && isTutorialDone()) {
      this.setupDawnXiya();
      this.setupEveningXiya();
    }
    // D-011 《春深有信·一》：跨天后重新判断剧情专线（清旧 + 按新时段重建；完成态不再生成）
    if (this.mapKey === 'farm' && isTutorialDone()) {
      this.clearLetterXiya();
      this.setupLetterXiya();
    }
    // D-011 《春深有信·二 花期未至》：跨天后重新判断剧情专线（完成态只挂永久视觉）
    if (this.mapKey === 'town' && isTutorialDone()) {
      this.clearBloomXiya();
      this.setupBloomXiya();
    }
    // v0.5.3 E5：跨天后刷新爷爷笔记（按新天数轮换，重建精灵保持坐标）
    if (this.mapKey === 'farm') {
      this.clearGrandpaNote();
      this.setupGrandpaNote();
    }
  }

  /** 清除清晨夏雅精灵（场景切换/跨天时调用） */
  private clearDawnXiya(): void {
    if (this.dawnXiya) { this.dawnXiya.destroy(); this.dawnXiya = null; }
    if (this.dawnXiyaLabel) { this.dawnXiyaLabel.destroy(); this.dawnXiyaLabel = null; }
  }

  /** 清除镇长家提示物品（场景切换时调用） */
  private clearElderHouseHint(): void {
    if (this.elderHouseHint) {
      this.elderHouseHint.sprite.destroy();
      this.elderHouseHint.text.destroy();
      this.elderHouseHint = null;
    }
  }

  /** v0.5.3 剧情密度 E5：创建爷爷的笔记（庄园左上角落可读物件，纸面风 label） */
  private setupGrandpaNote(): void {
    if (this.mapKey !== 'farm') return;
    // 位置 (1,6)：远离第一棵树 (2,3)（原 (1,3) 距树仅 17.9px，会抢占砍树引导）
    const nx = 1 * TILE_SIZE + TILE_SIZE / 2;
    const ny = 6 * TILE_SIZE + TILE_SIZE / 2;
    const note = this.add.ellipse(nx, ny, 16, 16, 0xe8d8a8, 0.55);
    note.setDepth(3);
    const mark = this.add.text(nx, ny - 8, '笔记', {
      fontFamily: 'Arial', fontSize: '10px', color: '#e8d8a8',
    }).setOrigin(0.5).setDepth(4);
    // 交互基准用椭圆实际坐标（label 相对偏移 -8px，用它判定会偏上）
    this.grandpaNote = mark;
    this.grandpaNotePos = { x: nx, y: ny };
  }

  // ============ 灯塔轻量版（2026-08-10 制作人解冻）============

  /**
   * 灯塔礁石岛探索交互点：航海日志 / 灯塔铭牌 / 老望远镜。
   * 定位：岛屿边界扩展方案 v1.0 P2 老航线区域——farm 海角"看得见的灯塔远景"
   * 变成"可进入的探索区域"（"制造未来"方法论）。轻量版 = 一张 tilemap + 出口 +
   * 基础探索文本，零新系统/新任务/新存档字段。
   * 物件在 Walls gid 13（旧物，碰撞），交互锚点取物件南侧可走格（玩家站旁边按 E）。
   */
  private setupLighthouseExploration(): void {
    if (this.mapKey !== 'lighthouse') return;
    const spots = [
      // (col,row,label,eventKey,text) —— 物件格 + 南侧可站锚点
      {
        c: 10, r: 12, label: '航海日志', key: 'lighthouse_logbook',
        text: '一本泛黄的航海日志，夹着海风的咸味。最后一页写着——「等星星落下来，就带你去灯塔。」',
      },
      {
        c: 18, r: 10, label: '铭牌', key: 'lighthouse_sign',
        text: '「归星灯塔 · 守夜人守则」：每夜点灯，为归航的人照亮回家的路。',
      },
      {
        c: 24, r: 12, label: '望远镜', key: 'lighthouse_telescope',
        text: '一台老式望远镜，镜片蒙着灰。透过它，能望见青禾镇的海岸线与炊烟。',
      },
    ];
    for (const s of spots) {
      // 标记画在物件格上方（label 提示，仿 grandpaNote 风格）
      const mx = s.c * TILE_SIZE + TILE_SIZE / 2;
      const my = s.r * TILE_SIZE + TILE_SIZE / 2;
      const mark = this.add.text(mx, my - 10, s.label, {
        fontFamily: 'Arial', fontSize: '10px', color: '#ffdda0',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(4);
      this.lighthouseMarks.push(mark);
      // 交互锚点 = 物件南侧可站格（碰撞格上玩家站不进去）
      this.lighthouseSpots.push({
        x: s.c * TILE_SIZE + TILE_SIZE / 2,
        y: (s.r + 1) * TILE_SIZE + TILE_SIZE / 2,
        label: s.label, key: s.key, text: s.text,
      });
    }
  }

  /** 灯塔探索交互（靠近旧物件按 E → 读文本；triggerOnce 记录探索足迹） */
  private tryLighthouseInteract(): boolean {
    if (this.mapKey !== 'lighthouse') return false;
    for (const s of this.lighthouseSpots) {
      const dx = this.player.x - s.x;
      const dy = this.player.y - s.y;
      if (dx * dx + dy * dy > R2(32)) continue;
      console.log(`[Lighthouse] 交互: ${s.label} at (${s.x},${s.y})`);
      // 探索足迹入档（一次性；轻量版无新系统，供未来 P2 剧情/相簿判断）
      triggerOnce(s.key, () => {});
      // 第三章幕二深交互：日志（续写）与望远镜（观察模式）从"读一句话"升级为行为
      if (s.key === 'lighthouse_logbook') { this.interactCh3Logbook(); return true; }
      if (s.key === 'lighthouse_telescope') { this.interactCh3Telescope(); return true; }
      this.showDialogueText(s.text);
      return true;
    }
    return false;
  }

  /** 清除灯塔探索交互标记（场景切换/跨天时调用） */
  private clearLighthouseMarks(): void {
    for (const m of this.lighthouseMarks) m.destroy();
    this.lighthouseMarks = [];
    this.lighthouseSpots = [];
  }

  // ═══════════════════════════════════════════════════════════════
  // 青禾河畔（2026-08-15 制作人拍板：第一章替代灯塔开放的可玩新地图）
  // 依据：《青禾河畔与废弃果园-区域设计方案-v0.1.md》
  // 范围：氛围 / 钓鱼（复用 setupFishingSpot）/ 码头修复（木材×20）/ 凉亭 / 断桥预埋
  // 红线：零新系统 / 零新存档字段（triggerOnce 持久化）；复用 Gathering / FarmRestore 范式
  // ═══════════════════════════════════════════════════════════════

  /** 河畔整体美术（水波 / 岸线层次 / 前景遮挡 / 树列框景 / 生活痕迹，零资产纯代码） */
  private setupQingheRiverAmbience(): void {
    if (this.mapKey !== 'qinghe_river') return;
    const T = TILE_SIZE;
    const night = getTime().hour >= 18 || getTime().hour < 6;
    const px = (c: number, r: number): [number, number] => [c * T + T / 2, r * T + T / 2];

    // ① 河流水波光斑（4 个错落扩散，参照 setupFarmAmbience 水塘涟漪）
    for (const [c, r, delay] of [[2, 11, 0], [20, 12, 700], [36, 10, 1300], [28, 11, 500]] as const) {
      const ring = this.add.graphics();
      ring.fillStyle(0x9fd8f5, 0.32);
      ring.fillCircle(0, 0, 4);
      ring.setPosition(c * T + T / 2, r * T + T / 2);
      ring.setDepth(2);
      this.tweens.add({
        targets: ring,
        scale: { from: 0.3, to: 1.2 },
        alpha: { from: 0.55, to: 0 },
        duration: 2300,
        delay,
        repeat: -1,
        ease: 'Quad.Out',
      });
    }
    // ② 河面流动光带（细长高光横线，缓慢东移——"水在流"）
    {
      const g = this.add.graphics().setDepth(2);
      g.fillStyle(0xc8e8f8, 0.28);
      for (const [cx, cy, w] of [[6, 10.4, 8], [14, 11.6, 6], [23, 10.7, 9], [31, 12.3, 7], [37, 10.8, 6]]) {
        const [x, y] = px(cx, cy);
        g.fillRect(x - w, y, w * 2, 1);
      }
      this.tweens.add({
        targets: g,
        x: { from: -20, to: 20 },
        duration: 6000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    // ③ 石子滩（两岸水缘碎石，岸线层次）
    {
      const g = this.add.graphics().setDepth(2);
      for (const [cx, cy, s] of [[3.2, 14.4, 2], [4.8, 14.6, 1.5], [10.3, 14.3, 2], [14.5, 14.6, 1.5], [22.3, 14.4, 2], [28.5, 14.6, 1.5], [34.3, 14.4, 2], [38.5, 14.6, 1.5]]) {
        const [x, y] = px(cx, cy);
        g.fillStyle(0x9a9aa2, 1); g.fillCircle(x, y, s);
        g.fillStyle(0xb8b8c0, 0.7); g.fillCircle(x - s * 0.4, y - s * 0.4, s * 0.4);
      }
    }
    // ④ 岸线碎花/草簇（生活痕迹，北岸+南岸零星）
    {
      const g = this.add.graphics().setDepth(2);
      for (const [cx, cy, col] of [[3, 7, 0xd860a0], [12, 6, 0xe8b040], [20, 7, 0xd860a0], [26, 6, 0xe8b040], [35, 7, 0xd860a0], [10, 19, 0xe8b040], [14, 21, 0xd860a0], [22, 19, 0xe8b040], [27, 21, 0xd860a0], [34, 19, 0xe8b040]]) {
        const [x, y] = px(cx, cy);
        g.fillStyle(0x5a8a4a, 1); g.fillRect(x - 1, y - 1, 2, 3);
        g.fillStyle(col, 1); g.fillRect(x - 2, y - 3, 1, 1); g.fillRect(x + 1, y - 3, 1, 1); g.fillRect(x, y - 4, 1, 1);
      }
    }
    // ⑤ 前景芦苇（水缘，depth 高于玩家——走过时轻微遮挡，形成空间层次）
    {
      const g = this.add.graphics().setDepth(12);
      for (const [cx, cy, h] of [[3.2, 14.8, 12], [5.2, 14.6, 10], [9.8, 14.7, 13], [16.2, 14.5, 11], [21.8, 14.7, 12], [27.2, 14.5, 10], [33.2, 14.7, 13], [38.2, 14.5, 11]]) {
        const [x, y] = px(cx, cy);
        g.fillStyle(0x2e4a18, 1); g.fillRect(x - 1, y - h, 2, h);
        g.fillStyle(0x6a4a2a, 1); g.fillRect(x - 2, y - h - 2, 4, 3);
      }
    }
    // ⑥ 北岸树列（小树林内侧，形成"河的框"；纯视觉 sprite 不碰撞）
    {
      const trees: [number, number, string][] = [
        [2, 4, 'tree1'], [6, 3, 'tree_big'], [10, 4, 'tree2'], [15, 3, 'tree1'],
        [19, 4, 'tree_big'], [24, 3, 'tree2'], [29, 4, 'tree1'], [34, 3, 'tree_big'], [38, 4, 'tree2'],
      ];
      for (const [cx, cy, key] of trees) {
        const [x, y] = px(cx, cy);
        const s = this.add.image(x, y, key).setScale(0.5).setDepth(4);
        if (key === 'tree_big') s.setOrigin(0.5, 1);
      }
    }
    // ⑦ 南岸树列（内侧点缀，框住河岸动线）
    {
      const trees: [number, number, string][] = [
        [12, 19, 'tree2'], [16, 18, 'tree1'], [25, 19, 'tree2'], [30, 18, 'tree1'], [37, 19, 'tree2'],
      ];
      for (const [cx, cy, key] of trees) {
        const [x, y] = px(cx, cy);
        const s = this.add.image(x, y, key).setScale(0.5).setDepth(4);
        if (key === 'tree_big') s.setOrigin(0.5, 1);
      }
    }
    // ⑧ 散步路径感：南岸小径内侧踩踏痕迹（提示"有人常走这里"）
    {
      const g = this.add.graphics().setDepth(2);
      for (const [cx, cy] of [[6.3, 16.5], [8.5, 16.5], [12, 16.5], [15, 16.5], [18, 16.5], [22, 16.5], [25, 16.5], [29, 16.5], [31, 16.5]]) {
        const [x, y] = px(cx, cy);
        g.fillStyle(0x3a5a30, 0.14);
        g.fillEllipse(x, y, 11, 4);
      }
    }
    // ⑨ 夜晚萤火虫（河畔空气里零星光点，呼吸闪烁）
    if (night) {
      for (let i = 0; i < 8; i++) {
        const fx = 2 * T + Math.floor(i * 4.7) * T;
        const fy = 16 * T + (i % 3) * 4 * T + 8;
        const dot = this.add.ellipse(fx, fy, 2, 2, 0xd8f0a8, 0.8).setDepth(3);
        this.tweens.add({
          targets: dot,
          alpha: { from: 0.08, to: 0.9 },
          x: { from: fx, to: fx + 3 },
          duration: 1600 + i * 250,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
    // ⑩ 入口路牌（北侧入口缓冲：引导玩家"这里通向青禾河畔"）
    {
      const [x, y] = px(22.5, 2.5);
      const g = this.add.graphics().setDepth(4);
      g.fillStyle(0x6e4a2c, 1); g.fillRect(x - 1, y - 2, 2, 10);   // 木柱
      g.fillStyle(0x8a6a45, 1); g.fillRect(x - 8, y - 7, 16, 6);   // 牌面
      g.fillStyle(0xa8835a, 0.9); g.fillRect(x - 6, y - 6, 12, 2); // 牌面高光
      this.add.text(x, y - 4, '青禾河畔', {
        fontSize: '8px', color: '#f0d8a0', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(5);
    }
    // ⑪ 白天暖光 / 夜晚冷色：极轻环境 overlay（不遮细节，只给"时间感"）
    if (!night) {
      const warm = this.add.rectangle(
        this.cameras.main.width / 2, this.cameras.main.height / 2,
        this.cameras.main.width, this.cameras.main.height,
        0xffe8b0, 0.05,
      ).setScrollFactor(0).setDepth(90);
      warm.setBlendMode(Phaser.BlendModes.ADD);
    } else {
      const cool = this.add.rectangle(
        this.cameras.main.width / 2, this.cameras.main.height / 2,
        this.cameras.main.width, this.cameras.main.height,
        0x4060a0, 0.08,
      ).setScrollFactor(0).setDepth(90);
      cool.setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 第二章《故人远来》（2026-08-28 制作人拍板 v1.0 节拍表 · 7 节拍人线）
  // 护栏：① 节拍1 只做状态递进不制造新演出 ② 夏雅身世只揭一层
  //       ③ 老船长/旅人严格货位（旅人随缘：看见即可，不追不等不补课）
  //       ④ 探针全程同步（probe-ch2-return.mjs）
  // 谜团预算：1 主悬念（夏雅为何认识那盏灯）+ 1 远景钩子（海平线黑点）
  // ══════════════════════════════════════════════════════════════════

  // ---- 节拍1 · 村民注意灯塔（town，只做状态递进——护栏1：不制造新演出）----
  private checkCh2LighthouseTalked(): void {
    if (this.mapKey !== 'town' || hasTriggered('ch2_lighthouse_talked')) return;
    if (!hasTriggered('lighthouseLit')) return;          // 灯塔亮是既有事实（春日集后已触发）
    if (this.storyDialogue?.isOpen()) return;
    const t = getTime();
    if (t.hour < 8 || t.hour >= 21) return;
    const m = MapScene.CH2.market;
    const dx = this.player.x - m.x, dy = this.player.y - m.y;
    if (dx * dx + dy * dy > 120 * 120) return;           // 集市广场（人流处）
    this.ch2LighthouseTalked = true;
    triggerOnce('ch2_lighthouse_talked', () => {
      this.playStory([
        { speaker: '阿风', color: '#d8a8b8', text: '西边那塔，这几天好像天天亮。' },
        { speaker: '老周', color: '#c8b8a0', text: '……嗯。有人回来了。' },
        { speaker: '', color: '#aaaaaa', text: '（谁也没接话。阿风低头理他的货，老周喝了口茶。像一件平常事。）' },
      ], () => this.updateHUD());
      save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    });
  }

  // ---- 节拍2 · 广场老钟（town；夏雅身世只揭一层——护栏2）----
  private setupCh2Clock(): void {
    if (this.mapKey !== 'town') return;
    const p = MapScene.CH2.clock;
    const done = hasTriggered('ch2_clock_fixed');
    const g = this.add.graphics().setDepth(3);
    g.fillStyle(0x5b4226, 1); g.fillRect(p.x - 2, p.y - 20, 4, 20);          // 木杆
    g.fillStyle(done ? 0x8a6a45 : 0x4a3018, 1); g.fillRect(p.x - 9, p.y - 30, 18, 12); // 钟体
    g.fillStyle(done ? 0xfff0c0 : 0x2e2a3a, 1); g.fillCircle(p.x, p.y - 24, 4);        // 钟面
    if (done) {
      g.fillStyle(0x3a3a44, 1); g.fillRect(p.x - 1, p.y - 19, 2, 3);          // 摆锤在走
    } else {
      g.fillStyle(0x2e2a3a, 1); g.fillRect(p.x - 1, p.y - 20, 2, 2);          // 摆锤停住
      // 未修：呼吸光晕提示可交互
      const glow = this.add.ellipse(p.x, p.y - 22, 34, 26, 0xffd98a, 0.14).setDepth(2);
      this.tweens.add({ targets: glow, alpha: { from: 0.10, to: 0.26 }, duration: 1300, yoyo: true, repeat: -1 });
    }
  }

  private canTryCh2Clock(): boolean {
    if (this.mapKey !== 'town' || hasTriggered('ch2_clock_fixed')) return false;
    const p = MapScene.CH2.clock;
    const dx = this.player.x - p.x, dy = this.player.y - p.y;
    if (dx * dx + dy * dy > 40 * 40) return false;
    return !this.storyDialogue?.isOpen();
  }

  private tryCh2ClockInteract(): boolean {
    if (!this.canTryCh2Clock()) return false;
    this.hideCh2Hint();
    this.inputManager.clearAction();
    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    this.playStory([
      narrator('（广场的老钟停了很多年。今天钟前人站着夏雅，脚边一把梯子，工具箱摊开。）'),
      { speaker: '夏雅', color: '#d8a8b8', text: '你来啦。搭把手——扶一下梯子。' },
      { speaker: '', color: '#aaaaaa', text: '（你扶住梯子。她踩着上去，打开钟面，拿油壶给机芯上了两滴油。）' },
      { speaker: '夏雅', color: '#d8a8b8', text: '钟摆要上油了。老人们听它报时听惯了，不能让它一直停着。' },
      { speaker: '林澈', color: '#c8d8f0', text: '你对这钟很熟？' },
      { speaker: '夏雅', color: '#d8a8b8', text: '……我家以前，也走过船。' },
      { speaker: '', color: '#aaaaaa', text: '（她说到这儿停了一下，没往下说。手上把钟摆轻轻一推——钟摆走了。）' },
      { speaker: '夏雅', color: '#d8a8b8', text: '好了。' },
      { speaker: '', color: '#aaaaaa', text: '（钟面下，钟摆一下一下地摆起来。她站在钟下听了一阵。）' },
      { speaker: '夏雅', color: '#d8a8b8', text: '……走得真准。' },
    ], () => {
      this.ch2ClockFixed = true; markTriggered('ch2_clock_fixed');
        markTriggered('ch2_clock_fixed');
      save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
      this.updateHUD();
    });
    return true;
  }

  /** 老钟整点报时（ch2ClockFixed 后；轻提示一次，不叠屏） */
  private checkCh2ClockChime(): void {
    if (this.mapKey !== 'town' || !this.ch2ClockFixed) return;
    if (this.storyDialogue?.isOpen()) return;
    const t = getTime();
    if (t.minute !== 0) return;
    const key = `ch2_chime_${t.hour}`;
    if (this.ch2ChimeKeys.has(key)) return;
    this.ch2ChimeKeys.add(key);
    this.time.delayedCall(900, () => {
      if (!this.scene.isActive()) return;
      this.showDialogueText('（老钟敲了几下。镇上的人听了，没什么人抬头——像是早就习惯了。）');
    });
  }

  // ---- 节拍3 · 老船长旧船靠岸（qinghe_river 玩家修的青禾码头）----
  private setupCh2Captain(): void {
    if (this.mapKey !== 'qinghe_river') return;
    if (!hasTriggered('ch2_clock_fixed')) return;  // 节拍2 完成后才出现（跨场景读模块内存）
    if (this.ch2CaptainGfx || this.ch2BoatGfx) return; // 幂等
    const b = MapScene.CH2.boat;
    const c = MapScene.CH2.captain;
    // 旧船（船头朝岸，深木色）
    const boat = this.add.graphics().setDepth(3);
    boat.fillStyle(0x4a3622, 1); boat.fillEllipse(b.x, b.y, 46, 14);       // 船身
    boat.fillStyle(0x3a2a18, 1); boat.fillRect(b.x + 10, b.y - 6, 16, 3);  // 船头翘起
    boat.fillStyle(0x2e2416, 1); boat.fillRect(b.x - 16, b.y - 3, 30, 2);  // 船舷
    this.ch2BoatGfx = boat;
    // 船灯（旧船灯，常亮暖黄——"有人回来了"的视觉标记）
    const lamp = this.add.graphics().setDepth(4);
    lamp.fillStyle(0x6e4a24, 1); lamp.fillRect(b.x - 12, b.y - 12, 3, 8);
    lamp.fillStyle(0xffd98a, 0.95); lamp.fillEllipse(b.x - 11, b.y - 14, 5, 6);
    this.tweens.add({ targets: lamp, alpha: { from: 0.7, to: 1.0 }, duration: 1100, yoyo: true, repeat: -1 });
    // 老船长剪影（蹲在船边修船；短、硬、不解释）
    const cap = this.add.graphics().setDepth(5);
    cap.fillStyle(0x3a4a5a, 1); cap.fillCircle(c.x, c.y - 9, 3.2);        // 头（深蓝灰外套）
    cap.fillStyle(0x8a7a6a, 1); cap.fillCircle(c.x, c.y - 9, 2.4);        // 肤色
    cap.fillStyle(0x3a4a5a, 1); cap.fillRect(c.x - 5, c.y - 5, 10, 6);    // 上身（蹲姿）
    cap.fillStyle(0x2e3a46, 1); cap.fillRect(c.x - 4, c.y - 1, 8, 2);     // 腿（蹲）
    cap.fillStyle(0x6e4a2c, 1); cap.fillRect(c.x + 2, c.y - 4, 1, 5);     // 手里木楔
    this.ch2CaptainGfx = cap;
    this.setupCh2PierLife(); // 修复已完成的老档：进图即有码头生活（幂等）
    this.add.text(c.x, c.y - 21, '老船长', {
      fontSize: '11px', color: '#a8b8c8', stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.45)', padding: { x: 2, y: 1 },
    }).setOrigin(0.5).setDepth(5);
  }

  /**
   * 节拍3 余韵（拍板基线：之后码头开始有人走动——晾网、搬筐、蹲着抽烟）：
   * 码头生活剪影 ×2 + 晾网绳，`ch2_pier_repaired` 后常驻（每次进 qinghe_river 重建；
   * 零资产，春日集人群剪影范式；不解释、无对白——"有人回来了"的可见证据）。
   */
  private setupCh2PierLife(): void {
    if (this.mapKey !== 'qinghe_river') return;
    if (!hasTriggered('ch2_pier_repaired')) return;
    this.ch2PierLifeGfx = this.ch2PierLifeGfx.filter((o) => o.active);
    if (this.ch2PierLifeGfx.length > 0) return; // 幂等
    const c = MapScene.CH2.captain;
    // 晾网绳：两根短柱间一条网线（淡，像刚用起来）
    const net = this.add.graphics().setDepth(3);
    net.fillStyle(0x6e5a3a, 1);
    net.fillRect(c.x + 42, c.y - 22, 2, 22);
    net.fillRect(c.x + 92, c.y - 26, 2, 26);
    net.lineStyle(1, 0x9a8a6a, 0.7);
    net.lineBetween(c.x + 43, c.y - 20, c.x + 93, c.y - 24);
    net.lineStyle(1, 0x9a8a6a, 0.4);
    net.lineBetween(c.x + 55, c.y - 21, c.x + 55, c.y - 8);
    net.lineBetween(c.x + 70, c.y - 22, c.x + 70, c.y - 9);
    net.lineBetween(c.x + 84, c.y - 23, c.x + 84, c.y - 10);
    this.ch2PierLifeGfx.push(net);
    // 晾网的人（站立，轻微晃动）
    const a = this.add.graphics().setDepth(4);
    a.fillStyle(0x5a4a3a, 1); a.fillCircle(c.x + 60, c.y - 14, 3);
    a.fillStyle(0x4a3a2c, 1); a.fillRect(c.x + 57, c.y - 11, 6, 11);
    a.fillStyle(0x3a3026, 1); a.fillRect(c.x + 58, c.y, 2, 5);
    a.fillStyle(0x3a3026, 1); a.fillRect(c.x + 62, c.y, 2, 5);
    this.tweens.add({ targets: a, x: c.x + 61.5, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.ch2PierLifeGfx.push(a);
    // 背筐走过的人（横移循环——"搬筐"）
    const b = this.add.graphics().setDepth(4);
    b.fillStyle(0x4a4438, 1); b.fillCircle(c.x + 120, c.y - 12, 3);
    b.fillStyle(0x3c3428, 1); b.fillRect(c.x + 117, c.y - 9, 6, 10);
    b.fillStyle(0x6e5a3a, 1); b.fillRect(c.x + 114, c.y - 16, 5, 6);   // 背上的筐
    b.fillStyle(0x30281e, 1); b.fillRect(c.x + 118, c.y + 1, 2, 4);
    b.fillStyle(0x30281e, 1); b.fillRect(c.x + 122, c.y + 1, 2, 4);
    this.tweens.add({ targets: b, x: c.x + 88, duration: 5200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.ch2PierLifeGfx.push(b);
  }

  // ---- 节拍1 · 远处灯塔（qinghe_river 入海口方向；复用第一章 lighthouseLit 既有状态：只状态递进，不新演出——护栏1）----
  private setupCh2LighthouseDistant(): void {
    if (this.mapKey !== 'qinghe_river') return;
    if (this.ch2LighthouseGfx) return;            // 幂等
    if (!hasTriggered('lighthouseLit')) return;   // 第一章春日集已点亮（既有事实），未亮不画
    const p = MapScene.CH2.lighthouse;
    const g = this.add.graphics().setScrollFactor(0).setDepth(160);
    g.fillStyle(0x1a2436, 0.9); g.fillRect(p.x - 3, p.y - 34, 6, 34);  // 塔身（远景小）
    g.fillStyle(0x2a3550, 1); g.fillRect(p.x - 4, p.y - 38, 8, 5);     // 塔顶机房
    g.fillStyle(0xffe6a0, 1); g.fillEllipse(p.x, p.y - 37, 5, 5);      // 灯火（常亮，持续事实）
    g.fillStyle(0xffe6a0, 0.18); g.fillCircle(p.x, p.y - 37, 9);       // 光晕
    this.ch2LighthouseGfx = g;
  }

  private canTryCh2Captain(): boolean {
    if (this.mapKey !== 'qinghe_river' || !this.ch2CaptainGfx || hasTriggered('ch2_pier_repaired')) return false;
    const c = MapScene.CH2.captain;
    const dx = this.player.x - c.x, dy = this.player.y - c.y;
    if (dx * dx + dy * dy > 40 * 40) return false;
    return !this.storyDialogue?.isOpen();
  }

  private tryCh2CaptainInteract(): boolean {
    if (!this.canTryCh2Captain()) return false;
    this.hideCh2Hint();
    this.inputManager.clearAction();
    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    this.playStory([
      narrator('（码头边靠着一艘旧船。老船长蹲在船边，往船板上抹桐油。）'),
      { speaker: '老船长', color: '#a8b8c8', text: '修好了，就能再出去一趟。' },
      { speaker: '林澈', color: '#c8d8f0', text: '您要出海？' },
      { speaker: '老船长', color: '#a8b8c8', text: '不一定。船不响了，心里才踏实。' },
      { speaker: '', color: '#aaaaaa', text: '（他说完继续抹他的桐油。你没再问。船头的旧船灯亮着。）' },
    ], () => {
      this.ch2PierRepaired = true; markTriggered('ch2_pier_repaired');
        markTriggered('ch2_pier_repaired');
      markRestored('ch2_pier_lit'); // 船灯长期挂起（读档保持）
      this.setupCh2PierLife(); // 节拍3 余韵：码头开始有人走动（拍板基线"晾网、搬筐"）
      save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
      this.updateHUD();
    });
    return true;
  }

  // ---- 节拍4 · 奇怪的旅人（随缘三次；看见即可，不追、不等、不补课——护栏3）----
  private checkCh2Stranger(): void {
    if (this.ch2StrangerSeen >= 3) return;
    if (!hasTriggered('ch2_lighthouse_talked')) return;   // 节拍1 后出现
    if (this.storyDialogue?.isOpen()) return;
    const t = getTime();
    const d = t.day;
    if (t.hour < 17 || t.hour >= 21) {                   // 只傍晚出现
      if (this.ch2StrangerAlive) this.despawnCh2Stranger();
      this.ch2StrangerAlive = false;
      return;
    }
    if (!this.ch2StrangerAlive && this.ch2StrangerDay === d) return; // 当天已刷过且已消失
    const spot = MapScene.CH2.stranger[Math.min(this.ch2StrangerSeen, 2)];
    if (spot.scene !== this.mapKey) return;              // 本档位在别的场景，等到了再说
    if (!this.ch2StrangerAlive) {
      this.spawnCh2Stranger(spot);
      this.ch2StrangerDay = d;
      this.ch2StrangerAlive = true;
      this.ch2StrangerSpawnAt = this.time.now;
    }
    // 靠近（70px 视野内）→ 自动触发台词（看见即可，无需按键）
    const dx = this.player.x - spot.x, dy = this.player.y - spot.y;
    if (dx * dx + dy * dy < 70 * 70) {
      this.triggerCh2StrangerTalk();
      return;
    }
    // 在场超 10 秒未靠近 → 消失（不追不等；明天傍晚同一档再刷）
    if (this.time.now - this.ch2StrangerSpawnAt > 10000) {
      this.despawnCh2Stranger();
      this.ch2StrangerAlive = false;
    }
  }

  private spawnCh2Stranger(spot: { scene: string; x: number; y: number }): void {
    this.despawnCh2Stranger();
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x2e2a3a, 1); g.fillCircle(spot.x, spot.y - 9, 3.2);    // 头
    g.fillStyle(0xc8a8e8, 1); g.fillCircle(spot.x, spot.y - 9, 2.4);    // 肤色（浅紫调）
    g.fillStyle(0x3a3a48, 1); g.fillRect(spot.x - 5, spot.y - 5, 10, 6); // 外套
    g.fillStyle(0x2e2a3a, 1); g.fillRect(spot.x - 4, spot.y - 1, 8, 2); // 腿
    this.ch2StrangerGfx = g;
    this.ch2StrangerLabel = this.add.text(spot.x, spot.y - 21, '生面孔', {
      fontSize: '11px', color: '#c8a8e8', stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.45)', padding: { x: 2, y: 1 },
    }).setOrigin(0.5).setDepth(5);
    this.tweens.add({ targets: g, angle: { from: 0, to: 0.5 }, duration: 3200, yoyo: true, repeat: -1 });
  }

  private despawnCh2Stranger(): void {
    this.ch2StrangerGfx?.destroy(); this.ch2StrangerGfx = null;
    this.ch2StrangerLabel?.destroy(); this.ch2StrangerLabel = null;
  }

  private triggerCh2StrangerTalk(): void {
    if (!this.ch2StrangerAlive) return;
    this.ch2StrangerAlive = false;
    this.despawnCh2Stranger();
    const n = this.ch2StrangerSeen;
    let lines: DialogueLine[];
    if (n === 0) {
      lines = [
        { speaker: '生面孔', color: '#c8a8e8', text: '这海，夜里看着挺静的。' },
        { speaker: '', color: '#aaaaaa', text: '（说完他就走了。像是个闲逛的人。）' },
      ];
    } else if (n === 1) {
      lines = [
        { speaker: '生面孔', color: '#c8a8e8', text: '今晚月亮落得早。' },
        { speaker: '', color: '#aaaaaa', text: '（他蹲着逗了会儿猫，起身走了。语气平平，像在说天气。）' },
      ];
    } else {
      lines = [
        { speaker: '生面孔', color: '#c8a8e8', text: '……你身上，也有那个味道。' },
        { speaker: '', color: '#aaaaaa', text: '（他停下来看了你一会儿，说完就走了，没回头。）' },
      ];
    }
    this.playStory(lines, () => {
      this.ch2StrangerSeen = Math.min(3, this.ch2StrangerSeen + 1);
      save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
      this.updateHUD();
    });
  }

  // ---- 节拍5/6 · 码头夜谈 + 夏雅秘密（qinghe_river，全章情绪高潮）----
  private checkCh2NightTalk(): void {
    if (this.mapKey !== 'qinghe_river' || this.ch2NightTalkActive) return;
    // BUG-FIX（丢剧情，同春日集范式）：夜谈为"标记先行"，被切图/打断后 owed 补播——
    // 全章高潮演出不可因一次打断永久丢失（ch2NightTalkActive 无 create 复位的旧实现会锁死）
    if (this.ch2NightTalkOwed) {
      if (this.storyDialogue?.isOpen() || this.storySequenceRunner?.isPlaying?.()) return;
      this.startCh2NightTalk();
      return;
    }
    if (hasTriggered('ch2_night_talk')) return;
    if (!hasTriggered('ch2_clock_fixed') || !hasTriggered('ch2_pier_repaired')) return;  // 两条人线完成
    if (this.storyDialogue?.isOpen()) return;
    const t = getTime();
    if (t.hour < 18 || t.hour >= 23) return;                    // 夜里
    const p = MapScene.CH2.captain;
    const dx = this.player.x - p.x, dy = this.player.y - p.y;
    if (dx * dx + dy * dy > 180 * 180) return;                  // 码头一带
    this.startCh2NightTalk();
  }

  private startCh2NightTalk(): void {
    if (this.ch2NightTalkActive) return;
    this.ch2NightTalkActive = true;
    if (this.ch2NightTalkOwed) {
      this.runCh2NightTalk(); // 补播路径：已标记过，直接跑
      return;
    }
    const ok = triggerOnce('ch2_night_talk', () => this.runCh2NightTalk());
    if (!ok) { this.ch2NightTalkActive = false; return; }
    this.ch2NightTalkOwed = true; // 演出收尾前视为"欠播"——被打断不许丢剧情
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
  }

  private runCh2NightTalk(): void {
    const narrator = (text: string): DialogueLine => ({ speaker: '', color: COLORS.system, text });
    // 补播防御：清掉上次中断残留的死 FX 引用
    this.ch2NightTalkFX = this.ch2NightTalkFX.filter((o) => o.active);
    const p = MapScene.CH2.captain;
    // 灯下暖光（对齐秋日晒场长桌暖光范式，零资源）
    const glow = this.add.ellipse(p.x, p.y - 2, 130, 70, 0xffc878, 0.20).setDepth(4);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: { from: 0.10, to: 0.26 }, duration: 1600, yoyo: true, repeat: -1 });
    this.ch2NightTalkFX.push(glow);
    // 夏雅剪影（夜谈围坐；临时，演出后清理）
    const xi = this.add.graphics().setDepth(5);
    xi.fillStyle(0x2e2438, 1); xi.fillCircle(p.x + 22, p.y - 9, 3.2);
    xi.fillStyle(0xd8b8a8, 1); xi.fillCircle(p.x + 22, p.y - 9, 2.4);
    xi.fillStyle(0x4a3a58, 1); xi.fillRect(p.x + 18, p.y - 5, 10, 6);
    xi.fillStyle(0x3a2e46, 1); xi.fillRect(p.x + 19, p.y - 1, 8, 2);
    this.ch2NightTalkFX.push(xi);
    const xiLabel = this.add.text(p.x + 22, p.y - 21, '夏雅', {
      fontSize: '11px', color: '#c8b8e0', stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.45)', padding: { x: 2, y: 1 },
    }).setOrigin(0.5).setDepth(5);
    this.ch2NightTalkFX.push(xiLabel);

    // 夜谈（情绪高潮：多停顿、递东西、问一句答一句；不解释任何世界观——不解释清单）
    this.playStory([
      narrator('（码头边点起一盏灯。老船长、夏雅，还有你，围着灯坐下来。）'),
      narrator('（海风从河面上吹过来，灯焰晃了晃。没人急着说话。）'),
      { speaker: '老船长', color: '#a8b8c8', text: '以前这码头，一天好几条船。卸货的、进货的、走亲戚的。' },
      { speaker: '老船长', color: '#a8b8c8', text: '后来船少了。再后来，大家宁愿在城里，也不回来。' },
      { speaker: '老船长', color: '#a8b8c8', text: '你爷爷当年想修这条道。没修成。' },
      { speaker: '', color: '#aaaaaa', text: '（他看向夏雅。停了一会儿。）' },
      { speaker: '老船长', color: '#a8b8c8', text: '你爸那年也是，船都订好了。' },
      { speaker: '夏雅', color: '#c8b8e0', text: '……嗯。搬出去过两年。' },
      { speaker: '林澈', color: '#c8d8f0', text: '……怎么又回来了？' },
      { speaker: '夏雅', color: '#c8b8e0', text: '这儿有人认识我。' },
      narrator('（半天没人说话。夏雅从包里掏出那把旧扳手，递过来。）'),
      { speaker: '夏雅', color: '#c8b8e0', text: '搬走那天，我把我爸锁在工具箱里的这个带出来了。' },
      { speaker: '夏雅', color: '#c8b8e0', text: '总觉得，哪天还会用上。' },
      { speaker: '林澈', color: '#c8d8f0', text: '这扳手是不锈钢的？' },
      { speaker: '夏雅', color: '#c8b8e0', text: '嗯。' },
      narrator('（你把它还给她。谁都没再说话。过了一会儿——）'),
      { speaker: '老船长', color: '#a8b8c8', text: '你们还愿意回来，这岛就没白等。' },
    ], () => {
      // 节拍6 · 夏雅秘密（同夜延续：主悬念留白）
      this.playStory([
        narrator('（人散了。夏雅没走，站在码头边，朝西边望。）'),
        { speaker: '林澈', color: '#c8d8f0', text: '……夏雅？' },
        { speaker: '夏雅', color: '#c8b8e0', text: '灯亮了。' },
        { speaker: '林澈', color: '#c8d8f0', text: '嗯。' },
        { speaker: '夏雅', color: '#c8b8e0', text: '那盏灯……我好像认识它。' },
        { speaker: '林澈', color: '#c8d8f0', text: '……什么意思？' },
        { speaker: '夏雅', color: '#c8b8e0', text: '没事。可能小时候见过。走了。' },
        narrator('（她走了两步，又停下来。）'),
        { speaker: '夏雅', color: '#c8b8e0', text: '你早点睡。' },
      ], () => {
        this.ch2NightTalkDone = true; markTriggered('ch2_night_talk');
        markTriggered('ch2_night_talk');
        this.ch2XiyaSecretDone = true; markTriggered('ch2_xiya_secret');
        markTriggered('ch2_xiya_secret');
        for (const o of this.ch2NightTalkFX) o.destroy();
        this.ch2NightTalkFX = [];
        this.ch2NightTalkActive = false;
        this.ch2NightTalkOwed = false;
        markRestored('ch2_pier_lit');
        save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
        this.updateHUD();
      });
    });
  }

  // ---- 节拍7 · 海平线黑点（farm，第三章唯一硬钩子；无台词）----
  private checkCh2BlackDot(): void {
    if (this.mapKey !== 'farm' || hasTriggered('ch2_black_dot')) return;
    if (!hasTriggered('ch2_night_talk')) return;
    if (this.storyDialogue?.isOpen()) return;
    const t = getTime();
    if (t.hour >= 20 || t.hour < 5) {
      if (this.player.x > 140) return;   // 农场西侧（灯塔远景方向）
      this.ch2BlackDotSeen = true;
      triggerOnce('ch2_black_dot', () => {
        // 海平线黑点（淡入淡出，无台词；叠在灯塔远景上层）
        const c = this.add.container(190, 150).setScrollFactor(0).setDepth(161);
        const dot = this.add.circle(0, 0, 3.5, 0x0a0a14, 1);
        dot.setBlendMode(Phaser.BlendModes.ADD);
        c.add(dot);
        c.setAlpha(0);
        this.tweens.add({
          targets: c, alpha: { from: 0, to: 1 }, duration: 2600, hold: 4200, yoyo: true,
          onComplete: () => c.destroy(),
        });
        save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
      });
    }
  }

  // ---- 靠近提示（老钟 / 老船长共用一条 DOM，避免叠屏）----
  private checkCh2ProximityHint(): void {
    if (this.storyDialogue?.isOpen()) { this.hideCh2Hint(); return; }
    if (this.canTryCh2Clock() || this.canTryCh2Captain()) {
      this.showCh2Hint(this.hintText('按 [E] 搭把手', '点击「交互」搭把手'));
    } else {
      this.hideCh2Hint();
    }
  }

  private showCh2Hint(text: string): void {
    if (this.ch2Hint) return;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '180px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffd98a', fontSize: '13px',
      background: 'rgba(0,0,0,0.65)', padding: '6px 16px', borderRadius: '6px',
      zIndex: '400', pointerEvents: 'none', textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    hint.textContent = text;
    hint.classList.add('hint-interact'); // 兜底清扫标记（hideAllInteractHints 强制移除残留）
    document.body.appendChild(hint);
    this.ch2Hint = hint;
  }

  private hideCh2Hint(): void {
    if (this.ch2Hint) { this.ch2Hint.remove(); this.ch2Hint = null; }
  }

  /** 码头修复交互点：木材×20 → 码头出现（Stage 1；triggerOnce 持久化，读档恢复） */
  private setupQinghePierRestore(): void {
    if (this.mapKey !== 'qinghe_river') return;
    const T = TILE_SIZE;
    // 码头平台中心（Ground 石板区 2-8, 20-23 的中心偏水边）
    const pos = { x: 5 * T + T / 2, y: 20 * T + T / 2 };
    const restored = hasTriggered('qinghe_pier_repaired');
    this.qinghePierRestore = { pos, mark: null, restored };
    // 码头生活痕迹（鱼篓/小凳/晾绳——"有人在这里落脚"；修复前破旧、修复后完整）
    {
      const [bx, by] = [pos.x + 14, pos.y + 4];
      const g = this.add.graphics().setDepth(3);
      if (restored) {
        // 鱼篓（编织感）
        g.fillStyle(0xb89858, 1); g.fillRect(bx - 5, by - 6, 10, 8);
        g.fillStyle(0x9a7a3a, 1); g.fillRect(bx - 5, by - 6, 10, 2);
        g.lineStyle(1, 0x7a5a33, 0.7); g.lineBetween(bx - 5, by - 3, bx + 5, by - 3);
        // 小木凳
        g.fillStyle(0x8a6a45, 1); g.fillRect(bx + 8, by - 4, 6, 3);
        g.fillStyle(0x6e4a2c, 1); g.fillRect(bx + 9, by - 1, 1, 4); g.fillRect(bx + 13, by - 1, 1, 4);
      } else {
        // 破桶 + 断绳（荒废感）
        g.fillStyle(0x7a5a33, 1); g.fillRoundedRect(bx - 5, by - 5, 9, 8, 2);
        g.lineStyle(1, 0x4c3618, 0.9); g.strokeRoundedRect(bx - 5, by - 5, 9, 8, 2);
        g.lineStyle(1.5, 0x8a8a92, 0.6); g.lineBetween(bx - 6, by - 6, bx + 6, by + 6);
      }
    }
    if (!restored) {
      // 未修复：破木桩 + 呼吸光晕（提示可交互）
      const mark = this.add.container(pos.x, pos.y).setDepth(4);
      const g = this.add.graphics();
      g.fillStyle(0x5b4226, 1); g.fillRect(-8, -6, 16, 12);       // 木桩
      g.fillStyle(0x3a2a18, 1); g.fillRect(-9, -7, 18, 2);         // 桩顶
      g.fillStyle(0x6e4a2c, 1); g.fillRect(-8, -6, 4, 2);          // 高光
      mark.add(g);
      const glow = this.add.ellipse(0, 2, 30, 18, 0xffd98a, 0.16);
      mark.add(glow);
      this.tweens.add({ targets: glow, alpha: { from: 0.10, to: 0.28 }, duration: 1300, yoyo: true, repeat: -1 });
      this.qinghePierRestore.mark = mark;
    } else {
      // 已修复：完整码头（木台 + 护栏 + 桩）
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x6e4a2c, 1); g.fillRect(pos.x - 14, pos.y - 3, 28, 3);   // 台面
      g.fillStyle(0x5b4226, 1); g.fillRect(pos.x - 14, pos.y - 4, 28, 1);   // 台沿
      g.fillStyle(0x4a3018, 1); g.fillRect(pos.x - 13, pos.y, 2, 5); g.fillRect(pos.x + 11, pos.y, 2, 5); // 桩
      g.fillStyle(0x7a5a34, 1); g.fillRect(pos.x - 14, pos.y - 8, 2, 4); g.fillRect(pos.x + 12, pos.y - 8, 2, 4); // 护栏
      g.fillStyle(0x8a6a45, 1); g.fillRect(pos.x - 15, pos.y - 9, 30, 1);   // 扶手
    }
  }

  /** 码头修复交互（tryInteract 调用）：木材×20 → markRestored + 码头视觉替换 + 存档 */
  private tryQinghePierInteract(): boolean {
    const g = this.qinghePierRestore;
    if (!g || g.restored || this.mapKey !== 'qinghe_river') return false;
    const dx = this.player.x - g.pos.x;
    const dy = this.player.y - g.pos.y;
    if (dx * dx + dy * dy > 34 * 34) return false;
    if (this.storyDialogue?.isOpen()) return false;
    this.hideQinghePierHint();
    if (getItemCount('wood') < 20) {

      this.playStory([
        { speaker: '', color: COLORS.system, text: '码头塌了大半。要修好，得先准备一些木材……' },
        { speaker: '', color: '#aaaaaa', text: `（还缺木头×${Math.max(0, 20 - getItemCount('wood'))}。）` },
      ], () => this.updateHUD());
      return true;
    }
    this.inputManager.clearAction();
    setItemCount('wood', getItemCount('wood') - 20);
    triggerOnce('qinghe_pier_repaired', () => {
      g.restored = true;
      g.mark?.destroy();
      g.mark = null;
      // 重建码头视觉（同 setupQinghePierRestore 已修复分支）
      const vis = this.add.graphics().setDepth(3);
      vis.fillStyle(0x6e4a2c, 1); vis.fillRect(g.pos.x - 14, g.pos.y - 3, 28, 3);
      vis.fillStyle(0x5b4226, 1); vis.fillRect(g.pos.x - 14, g.pos.y - 4, 28, 1);
      vis.fillStyle(0x4a3018, 1); vis.fillRect(g.pos.x - 13, g.pos.y, 2, 5); vis.fillRect(g.pos.x + 11, g.pos.y, 2, 5);
      vis.fillStyle(0x7a5a34, 1); vis.fillRect(g.pos.x - 14, g.pos.y - 8, 2, 4); vis.fillRect(g.pos.x + 12, g.pos.y - 8, 2, 4);
      vis.fillStyle(0x8a6a45, 1); vis.fillRect(g.pos.x - 15, g.pos.y - 9, 30, 1);

      this.playStory([
        { speaker: '', color: COLORS.system, text: '（你把松动的木板重新钉好，码头又立了起来。）' },
        { speaker: '', color: '#aaaaaa', text: '以后钓鱼，就有个正经地方落脚了。' },
      ], () => this.updateHUD());
    });
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    this.updateHUD();
    return true;
  }

  /** 凉亭停留空间：视觉（柱/顶/座）+ 交互一句（看河/看星） */
  private setupQinghePavilion(): void {
    if (this.mapKey !== 'qinghe_river') return;
    const T = TILE_SIZE;
    const pos = { x: 18.5 * T, y: 22 * T + T / 2 };
    const g = this.add.graphics().setDepth(3);
    // 四柱 + 顶（屋顶红棕，柱子深木）+ 檐下横梁 + 座椅
    g.fillStyle(0x6e4a2c, 1);
    g.fillRect(pos.x - 16, pos.y - 4, 3, 12); g.fillRect(pos.x + 13, pos.y - 4, 3, 12);
    g.fillRect(pos.x - 16, pos.y + 8, 3, 5); g.fillRect(pos.x + 13, pos.y + 8, 3, 5);
    g.fillStyle(0xa84a38, 1);
    g.fillTriangle(pos.x - 20, pos.y - 8, pos.x + 20, pos.y - 8, pos.x, pos.y - 22);
    g.fillStyle(0x8a3a2a, 1);
    g.fillRect(pos.x - 20, pos.y - 8, 40, 3);
    // 檐下横梁（浅色原木）
    g.fillStyle(0xa8835a, 1);
    g.fillRect(pos.x - 15, pos.y - 1, 30, 2);
    // 底座横板（可坐）+ 坐垫痕（生活感）
    g.fillStyle(0x8a6a45, 1);
    g.fillRect(pos.x - 15, pos.y + 4, 30, 3);
    g.fillStyle(0x9a7a52, 0.8);
    g.fillRect(pos.x - 10, pos.y + 4, 7, 2); // 坐过的位置颜色略浅
    // 亭边一盏旧灯（夜晚暖光）
    const lampX = pos.x + 24, lampY = pos.y - 2;
    g.fillStyle(0x4a3018, 1); g.fillRect(lampX - 1, lampY, 2, 8);
    g.fillStyle(0xffd98a, 1); g.fillRect(lampX - 3, lampY - 4, 6, 5);
    if (getTime().hour >= 18 || getTime().hour < 6) {
      const glow = this.add.ellipse(lampX, lampY - 1, 26, 20, 0xffc878, 0.22).setDepth(3);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, alpha: { from: 0.12, to: 0.28 }, duration: 1500, yoyo: true, repeat: -1 });
    }
    this.qinghePavilion = { pos, mark: null };
  }

  /** 凉亭交互（tryInteract 调用）：一句停留台词（白天看河 / 夜晚看星） */
  private tryQinghePavilionInteract(): boolean {
    if (!this.qinghePavilion || this.mapKey !== 'qinghe_river') return false;
    if (this.storyDialogue?.isOpen()) return false;
    const dx = this.player.x - this.qinghePavilion.pos.x;
    const dy = this.player.y - this.qinghePavilion.pos.y;
    if (dx * dx + dy * dy > 42 * 42) return false;
    this.hideQinghePavilionHint();
    this.inputManager.clearAction();
    const night = getTime().hour >= 18 || getTime().hour < 6;
    const lines: DialogueLine[] = night ? [
      { speaker: '', color: COLORS.system, text: '（你在凉亭坐下。河面倒着星光，水声很轻。）' },
    ] : [
      { speaker: '', color: COLORS.system, text: '（你在凉亭坐下。河风从水面吹过来，带着一点凉。）' },
    ];
    return this.playStory(lines, () => this.updateHUD(), undefined, 'qinghe_pavilion');
  }

  /** 断桥视觉（东侧河上；未来果园预埋，靠近提示一句） */
  private setupQingheBrokenBridge(): void {
    if (this.mapKey !== 'qinghe_river') return;
    const T = TILE_SIZE;
    // 断桥两段（木板 + 断口空隙），叠在 Ground 石板桥面上
    const g = this.add.graphics().setDepth(3);
    g.fillStyle(0x8a6a45, 1);
    g.fillRect(31 * T + 4, 9 * T + 4, 14, 5);   // 左段
    g.fillRect(33 * T + 6, 9 * T + 4, 14, 5);   // 右段（错位）
    g.fillStyle(0x6e4a2c, 1);
    g.fillRect(31 * T + 6, 9 * T + 6, 4, 2);    // 左段木板缝
    g.fillRect(34 * T + 8, 9 * T + 6, 4, 2);
    // 断口处碎木（"桥断了"）
    g.fillStyle(0x5b4226, 1);
    g.fillRect(32 * T + 6, 10 * T + 2, 5, 3);
    g.fillRect(32 * T + 10, 11 * T, 4, 3);
    // 桥头旧石 + 一截断绳（"有人曾想从这里过河"）
    const [sx, sy] = [32 * T + T / 2, 15 * T + T / 2];
    g.fillStyle(0x9a9aa2, 1); g.fillCircle(sx, sy, 3);
    g.fillStyle(0xb8b8c0, 0.7); g.fillCircle(sx - 1, sy - 1, 1.2);
    g.lineStyle(1.5, 0x8a8a92, 0.7); g.lineBetween(sx + 2, sy - 2, sx + 10, sy + 2);
  }

  /** 河畔 Stage 2（集市恢复后）：长椅 + 路灯 + 白天有人坐/夜晚有人聊天 */
  private setupQingheStage2(): void {
    if (this.mapKey !== 'qinghe_river') return;
    if (!isRestored('marketSquare')) return; // 集市恢复后河畔开始有人来
    const T = TILE_SIZE;
    const night = getTime().hour >= 18 || getTime().hour < 6;
    const add = (o: Phaser.GameObjects.GameObject) => { this.qingheStage2Gfx.push(o); return o; };
    // ① 长椅（凉亭东侧南岸，面向河）：集市后才有闲坐的人
    {
      const x = 15 * T + T / 2, y = 20 * T + T / 2;
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x4a4a52, 1); g.fillRect(x - 8, y - 3, 16, 3);
      g.fillStyle(0x3a3a42, 1); g.fillRect(x - 7, y, 2, 3); g.fillRect(x + 5, y, 2, 3);
      add(g);
      // 白天有人坐（剪影：老人拄拐看河）
      if (!night) {
        const s = this.add.graphics().setDepth(5);
        s.fillStyle(0x2e2a3a, 1); s.fillCircle(x - 2, y - 9, 3.2);   // 头
        s.fillStyle(0x3a3a48, 1); s.fillRect(x - 5, y - 5, 9, 4);     // 上身
        s.fillStyle(0x2e2a3a, 1); s.fillRect(x - 4, y - 2, 7, 2);     // 腿
        s.fillStyle(0x5b4226, 1); s.fillRect(x + 4, y - 7, 1, 7);     // 拐杖
        add(s);
      }
    }
    // ② 路灯（入口路牌旁 + 凉亭旁）：夜晚暖光
    for (const [lx, ly] of [[23 * T, 4 * T], [16 * T, 21 * T]] as const) {
      const g = this.add.graphics().setDepth(4);
      g.fillStyle(0x3a3a44, 1); g.fillRect(lx + T / 2 - 1, ly, 2, 14);
      g.fillStyle(0xffd98a, 1); g.fillRect(lx + T / 2 - 2, ly - 3, 4, 4);
      add(g);
      if (night) {
        const glow = this.add.ellipse(lx + T / 2, ly - 1, 30, 22, 0xffc878, 0.2).setDepth(3);
        glow.setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: glow, alpha: { from: 0.10, to: 0.26 }, duration: 1500, yoyo: true, repeat: -1 });
        add(glow);
      }
    }
    // ③ 夜晚聊天（长椅旁两人剪影——"晚上有人聊天"）
    if (night) {
      const x = 15 * T + T / 2 + 2, y = 20 * T + T / 2;
      const s = this.add.graphics().setDepth(5);
      // 两人并坐
      s.fillStyle(0x2e2a3a, 1); s.fillCircle(x - 6, y - 9, 3.0); s.fillCircle(x + 5, y - 9, 3.0);
      s.fillStyle(0x3a3a48, 1); s.fillRect(x - 9, y - 5, 8, 4); s.fillRect(x + 1, y - 5, 8, 4);
      s.fillStyle(0x2e2a3a, 1); s.fillRect(x - 8, y - 2, 7, 2); s.fillRect(x + 1, y - 2, 7, 2);
      add(s);
    }
  }

  /** 河畔 Stage 2：夜晚聊天靠近提示（update 调用） */
  private checkQingheChatterHint(): void {
    if (this.mapKey !== 'qinghe_river' || !isRestored('marketSquare')) {
      this.hideQingheChatterHint();
      return;
    }
    const h = getTime().hour;
    if (h < 18 && h >= 6) { // 仅夜晚
      this.hideQingheChatterHint();
      return;
    }
    if (this.storyDialogue?.isOpen()) { this.hideQingheChatterHint(); return; }
    const T = TILE_SIZE;
    const x = 15 * T + T / 2, y = 20 * T + T / 2;
    const dx = this.player.x - x, dy = this.player.y - y;
    if (dx * dx + dy * dy < 48 * 48) {
      this.hideQingheOldManHint();
      this.showQingheChatterHint();
    } else {
      this.hideQingheChatterHint();
    }
  }

  private showQingheChatterHint(): void {
    if (this.qingheChatterHint) return;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '180px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffd98a', fontSize: '13px',
      background: 'rgba(0,0,0,0.65)', padding: '6px 16px', borderRadius: '6px',
      zIndex: '400', pointerEvents: 'none',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    hint.textContent = isMobileLayout() ? '点击「交互」听听他们在聊什么' : '按 [E] 听听他们在聊什么';
    hint.classList.add('hint-interact'); // 2026-08-16 兜底清扫标记（hideAllInteractHints 强制移除残留）
    document.body.appendChild(hint);
    this.qingheChatterHint = hint;
  }

  private hideQingheChatterHint(): void {
    if (this.qingheChatterHint) {
      this.qingheChatterHint.remove();
      this.qingheChatterHint = null;
    }
  }

  /** 河畔 Stage 2：夜晚聊天交互（一次 + 日常轮换） */
  private tryQingheChatterInteract(): boolean {
    if (this.mapKey !== 'qinghe_river' || !isRestored('marketSquare')) return false;
    const h = getTime().hour;
    if (h < 18 && h >= 6) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const T = TILE_SIZE;
    const x = 15 * T + T / 2, y = 20 * T + T / 2;
    const dx = this.player.x - x, dy = this.player.y - y;
    if (dx * dx + dy * dy >= 48 * 48) return false;
    this.hideQingheChatterHint();
    this.inputManager.clearAction();

    const once = triggerOnce('qinghe_chatter_seen', () => { /* 仅标记 */ });
    const lines: DialogueLine[] = once ? [
      { speaker: '', color: COLORS.system, text: '（长椅上坐着两个人，声音压得很低。）' },
      { speaker: '', color: '#aaaaaa', text: '……"集市都开了，河边也该热闹热闹。"' },
    ] : [
      { speaker: '', color: COLORS.system, text: '（夜风把说话声吹散了一些。）' },
      { speaker: '', color: '#aaaaaa', text: '……"明天还想来钓鱼。"' },
    ];
    return this.playStory(lines, () => this.updateHUD(), undefined, 'qinghe_chatter');
  }

  /** 果园预埋：断桥旁老周（白天出现，一次性台词——"河对岸以前是果园"） */
  private setupQingheOldMan(): void {
    if (this.mapKey !== 'qinghe_river') return;
    const h = getTime().hour;
    if (h < 8 || h >= 18) return; // 白天
    const T = TILE_SIZE;
    const x = 32 * T + T / 2, y = 17 * T + T / 2; // 断桥南岸桥头旁
    this.qingheOldMan = this.add.sprite(x, y, 'npc_carpenter');
    this.qingheOldMan.setScale(0.5).setDepth(5);
    this.qingheOldManLabel = this.add.text(x, y - 22, '老周', {
      fontSize: '11px', color: '#e0d8c8', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6);
  }

  /** 果园预埋：老周靠近提示（update 调用） */
  private checkQingheOldManHint(): void {
    if (this.mapKey !== 'qinghe_river' || !this.qingheOldMan?.visible) {
      this.hideQingheOldManHint();
      return;
    }
    const h = getTime().hour;
    if (h < 8 || h >= 18 || this.storyDialogue?.isOpen()) {
      this.hideQingheOldManHint();
      return;
    }
    const dx = this.player.x - this.qingheOldMan.x;
    const dy = this.player.y - this.qingheOldMan.y;
    if (dx * dx + dy * dy < 42 * 42) {
      this.hideQingheChatterHint();
      this.showQingheOldManHint();
    } else {
      this.hideQingheOldManHint();
    }
  }

  private showQingheOldManHint(): void {
    if (this.qingheOldManHint) return;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '180px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffe9b0', fontSize: '13px',
      background: 'rgba(0,0,0,0.65)', padding: '6px 16px', borderRadius: '6px',
      zIndex: '400', pointerEvents: 'none',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    hint.textContent = isMobileLayout() ? '点击「交互」和老周聊聊' : '按 [E] 和老周聊聊';
    hint.classList.add('hint-interact'); // 2026-08-16 兜底清扫标记（hideAllInteractHints 强制移除残留）
    document.body.appendChild(hint);
    this.qingheOldManHint = hint;
  }

  private hideQingheOldManHint(): void {
    if (this.qingheOldManHint) {
      this.qingheOldManHint.remove();
      this.qingheOldManHint = null;
    }
  }

  /** 果园预埋：老周交互（一次性台词，埋第二章《故人远来》钩子） */
  private tryQingheOldManInteract(): boolean {
    if (this.mapKey !== 'qinghe_river' || !this.qingheOldMan?.visible) return false;
    if (this.storyDialogue?.isOpen()) return false;
    const h = getTime().hour;
    if (h < 8 || h >= 18) return false;
    const dx = this.player.x - this.qingheOldMan.x;
    const dy = this.player.y - this.qingheOldMan.y;
    if (dx * dx + dy * dy >= 42 * 42) return false;
    this.hideQingheOldManHint();
    this.inputManager.clearAction();
    // 台词方向稿：克制、具体、埋第二章（老周=木匠，"河对岸以前是果园"）
    const once = triggerOnce('qinghe_orchard_oldman', () => { /* 仅标记 */ });
    const lines: DialogueLine[] = once ? [
      { speaker: '', color: COLORS.system, text: '（老周站在断桥边，望着河对岸，很久没说话。）' },
      { speaker: '木匠老周', color: '#c89860', text: '河对岸……以前是片果园。' },
      { speaker: '林澈', color: COLORS.linche, text: '果园？' },
      { speaker: '木匠老周', color: '#c89860', text: '嗯。我小时候，常去那儿摘果子。' },
      { speaker: '木匠老周', color: '#c89860', text: '桥断了之后，就没再过去过。' },
      { speaker: '', color: COLORS.system, text: '（他拍了拍桥头的旧石，转身往回走。）' },
    ] : [
      { speaker: '木匠老周', color: '#c89860', text: '这桥……要是能修好，那边的果子，怕是还甜。' },
    ];
    return this.playStory(lines, () => this.updateHUD(), undefined, 'qinghe_oldman');
  }

  /** 河畔 Stage 2 / 果园预埋清理（场景切换时调用，防残留） */
  private cleanupQingheStage2(): void {
    for (const o of this.qingheStage2Gfx) o.destroy();
    this.qingheStage2Gfx = [];
    this.hideQingheChatterHint();
    this.qingheOldMan?.destroy();
    this.qingheOldMan = null;
    this.qingheOldManLabel?.destroy();
    this.qingheOldManLabel = null;
    this.hideQingheOldManHint();
  }

  /** 断桥靠近提示（update 调用；未开放区域——未来果园） */
  private checkQingheBridgeTip(): void {
    if (this.mapKey !== 'qinghe_river') return;
    if (hasTriggered('qinghe_bridge_seen')) return; // 一次性：只提示一次
    const T = TILE_SIZE;
    // 南岸桥头（护栏下方可站格，玩家走到断桥前触发）
    const bx = 32 * T + T / 2, by = 14 * T + T / 2;
    const dx = this.player.x - bx;
    const dy = this.player.y - by;
    if (dx * dx + dy * dy > 56 * 56) return;
    if (this.storyDialogue?.isOpen()) return;
    triggerOnce('qinghe_bridge_seen', () => {
      this.showDialogueText('桥断了，过不去。河对岸……以后再来看看。');
    });
  }

  /** 码头靠近提示（DOM，会话级） */
  private showQinghePierHint(): void {
    if (this.qinghePierHint) return;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '180px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffd98a', fontSize: '13px',
      background: 'rgba(0,0,0,0.65)', padding: '6px 16px', borderRadius: '6px',
      zIndex: '400', pointerEvents: 'none',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    hint.textContent = isMobileLayout() ? '点击「交互」修码头（木头×20）' : '按 [E] 修码头（木头×20）';
    hint.classList.add('hint-interact'); // 2026-08-16 兜底清扫标记（hideAllInteractHints 强制移除残留）
    document.body.appendChild(hint);
    this.qinghePierHint = hint;
  }

  private hideQinghePierHint(): void {
    if (this.qinghePierHint) {
      this.qinghePierHint.remove();
      this.qinghePierHint = null;
    }
  }

  /** 凉亭靠近提示（DOM，会话级） */
  private showQinghePavilionHint(): void {
    if (this.qinghePavilionHint) return;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '180px', left: '50%',
      transform: 'translateX(-50%)', color: '#e8d8c0', fontSize: '13px',
      background: 'rgba(0,0,0,0.65)', padding: '6px 16px', borderRadius: '6px',
      zIndex: '400', pointerEvents: 'none',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    hint.textContent = isMobileLayout() ? '点击「交互」坐一会儿' : '按 [E] 坐一会儿';
    hint.classList.add('hint-interact'); // 2026-08-16 兜底清扫标记（hideAllInteractHints 强制移除残留）
    document.body.appendChild(hint);
    this.qinghePavilionHint = hint;
  }

  private hideQinghePavilionHint(): void {
    if (this.qinghePavilionHint) {
      this.qinghePavilionHint.remove();
      this.qinghePavilionHint = null;
    }
  }

  /** 河畔靠近提示检测（update 调用）：码头（未修复）/ 凉亭 就近一条 */
  private checkQingheRiverHints(): void {
    if (this.mapKey !== 'qinghe_river' || this.storyDialogue?.isOpen()) {
      this.hideQinghePierHint();
      this.hideQinghePavilionHint();
      return;
    }
    let pierNear = false;
    if (this.qinghePierRestore && !this.qinghePierRestore.restored) {
      const dx = this.player.x - this.qinghePierRestore.pos.x;
      const dy = this.player.y - this.qinghePierRestore.pos.y;
      pierNear = dx * dx + dy * dy < 34 * 34;
    }
    let pavNear = false;
    if (this.qinghePavilion) {
      const dx = this.player.x - this.qinghePavilion.pos.x;
      const dy = this.player.y - this.qinghePavilion.pos.y;
      pavNear = dx * dx + dy * dy < 42 * 42;
    }
    // 互斥：同一底栏只留一条（码头优先）
    if (pierNear) { this.hideQinghePavilionHint(); this.showQinghePierHint(); }
    else if (pavNear) { this.hideQinghePierHint(); this.showQinghePavilionHint(); }
    else { this.hideQinghePierHint(); this.hideQinghePavilionHint(); }
  }

  /** 河畔资源清理（场景切换时调用，防 DOM 残留） */
  private cleanupQingheRiver(): void {
    this.hideQinghePierHint();
    this.hideQinghePavilionHint();
  }

  /**
   * 灯塔视觉打磨（2026-08-10 制作人"功能可用 → 展示级"阶段）
   * 纯 Graphics/对象，零资源；scene 关闭自动销毁（不存引用）。
   * 目标：玩家第一眼觉得"这里以前有人守护过"，而不是"这里有一个建筑"。
   *  1. 塔身层次：石砖横线/竖缝 + 风化斑 + 锈蚀痕 + 白漆斑驳 + 塔基石阶线
   *  2. 灯室强化：玻璃反光 + 十字窗棂（暖光溢出已预埋禁用——见下）
   *  3. 光束扫海面（⚠️ 预埋禁用：灯塔=未来内容预埋，当前灯室恒熄灭）
   *  4. 海岸环境：浪花潮汐呼吸 / 礁石不规则变化 / 漂流木 / 贝壳 / 海草摆动 / 风吹草
   *  5. 故事感（不可交互）：守塔人小屋残迹 / 废弃工具（铁锹+木桶）/ 生锈标牌
   *  6. 夜晚光影：星点闪烁 + 月光银带（夜空环境保留；塔基地面暖光预埋禁用）
   * ⚠️ 2026-08-10 制作人方向对齐（灯塔=未来内容预埋）：
   *    灯室恒熄灭、无光束、无地面光斑——"现在它是黑的，有一天它会亮"。
   *    未来链路：城市复兴 → 执灯人归来 → 灯塔重新点灯 → 开放灯塔（届时恢复点亮逻辑）。
   * 昼夜判定与 farm 远景一致：create 时按当前时间，scene.restart 重建。
   */
  /**
   * 第三章幕一：farm 西侧海湾缺口视觉重建（零资产纯代码；灯塔未来内容预埋方案 §四 恢复点）。
   * farm.json Walls rows10-13/col0 已打通（本批次），本方法只补"墙外是海"的可见性。
   */
  private setupFarmWestGap(): void {
    if (this.mapKey !== 'farm') return;
    const T = TILE_SIZE;
    const gap = this.add.graphics().setDepth(1);
    // 海水（西边缘外，rows 10-13 对应 y 160-224）
    gap.fillStyle(0x3a6a8a, 1);
    gap.fillRect(-6, 9.6 * T, 22, 4.8 * T);
    gap.fillStyle(0x4a7a9a, 1);
    gap.fillRect(-6, 9.6 * T, 22, 1.6 * T);
    // 沙滩过渡 + 浪线（潮汐呼吸）
    gap.fillStyle(0xcbb88a, 1);
    gap.fillRect(10, 9.7 * T, 8, 4.6 * T);
    const foam = this.add.graphics().setDepth(2);
    foam.fillStyle(0xcfeeff, 0.55);
    foam.fillRect(9, 10.1 * T, 9, 2);
    foam.fillRect(9, 11.4 * T, 9, 2);
    foam.fillRect(9, 12.9 * T, 9, 2);
    this.tweens.add({ targets: foam, alpha: { from: 0.7, to: 0.3 }, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  /** 第三章幕一：执灯人（灯塔方案 §七 预留 NPC；身份不进谜团预算——拍板 §七.6）。
   *  静态剪影 + 标签，不接日程系统（零新系统）；对白见 tryCh3LighthouseArrival（方向稿未定稿）。 */
  private setupCh3Keeper(): void {
    if (this.mapKey !== 'lighthouse') return;
    if (this.ch3KeeperGfx) return; // 幂等（create 复用实例）
    const T = TILE_SIZE;
    const kx = 13.4 * T, ky = 10.2 * T; // 塔基旁（塔身 x 208-272 之西侧，不挡出口通道）
    const k = this.add.graphics().setDepth(5);
    k.fillStyle(0x4a4438, 1); k.fillCircle(kx, ky - 12, 3.2);          // 头
    k.fillStyle(0x8a7a6a, 1); k.fillCircle(kx, ky - 12, 2.4);          // 肤色
    k.fillStyle(0x5a5a48, 1); k.fillRect(kx - 5, ky - 9, 10, 12);      // 上身（工装）
    k.fillStyle(0x3c382e, 1); k.fillRect(kx - 4, ky + 3, 3, 6);        // 腿
    k.fillStyle(0x3c382e, 1); k.fillRect(kx + 2, ky + 3, 3, 6);
    k.fillStyle(0xd8c8a0, 1); k.fillRect(kx + 5, ky - 6, 2, 8);        // 手里的除尘布
    this.ch3KeeperGfx = k;
    // 铜铃（檐下小钟；幕二交互物）
    const b = MapScene.CH3.bell;
    const bell = this.add.graphics().setDepth(4);
    bell.fillStyle(0x6e5a3a, 1); bell.fillRect(b.x - 1, b.y - 10, 2, 4);   // 挂绳
    bell.fillStyle(0xb8a05a, 1); bell.fillEllipse(b.x, b.y - 3, 8, 9);     // 钟体
    bell.fillStyle(0x8a7440, 1); bell.fillRect(b.x - 4, b.y - 4, 8, 2);    // 钟口沿
    bell.fillStyle(0x6e5a2a, 1); bell.fillCircle(b.x, b.y + 1, 1.5);       // 钟舌
    this.ch3BellGfx = bell;
    this.add.text(kx, ky - 22, '陈叔', {
      fontSize: '11px', color: '#ffe6a0', stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.45)', padding: { x: 2, y: 1 },
    }).setOrigin(0.5).setDepth(5);
  }

  /**
   * 第三章幕一：首次走进灯塔的演出（方向稿台词，未定稿——定稿权在制作人）。
   * 占用范式：忙时每秒重试（上限 30 次），超限放弃本次、保留触发机会（update 每帧重查直至播成）。
   */
  private tryCh3LighthouseArrival(): void {
    if (this.mapKey !== 'lighthouse' || !this.isLighthouseUnlocked()) return;
    if (hasTriggered('ch3_lighthouse_arrival') || this.ch3ArrivalQueued) return;
    if (this.storyDialogue?.isOpen() || this.storySequenceRunner?.isPlaying?.()) return;
    this.ch3ArrivalQueued = true;
    this.time.delayedCall(1400, () => this.queueCh3ArrivalDialogue());
  }

  private queueCh3ArrivalDialogue(attempts = 0): void {
    if (!this.scene.isActive()) { this.ch3ArrivalQueued = false; return; } // shutdown：未标记，重进重试
    if (this.storySequenceRunner?.isPlaying?.() || this.storyDialogue?.isOpen()) {
      if (attempts < 30) {
        this.time.delayedCall(1000, () => this.queueCh3ArrivalDialogue(attempts + 1));
      } else {
        this.ch3ArrivalQueued = false; // 超限：未标记，玩家下次进灯塔重新触发（不丢演出）
      }
      return;
    }
    const ok = this.playStory(
      [
        { speaker: '', color: '#aaaaaa', text: '（塔内比想象中亮。灯室的暖光，落在旋转的阶梯上。）' },
        { speaker: '', color: '#aaaaaa', text: '（一个背影正在给灯罩除尘。听见脚步，没有回头。）' },
        { speaker: '陈叔', color: '#ffe6a0', text: '……门没锁，就是给愿意上来的人留的。' },
        { speaker: '林澈', color: '#c8d8f0', text: '您是……？' },
        { speaker: '陈叔', color: '#ffe6a0', text: '（把抹布搭到肩上）我叫陈叔，守灯的。你爷爷那时候，这灯就亮着。' },
        { speaker: '陈叔', color: '#ffe6a0', text: '（顿了顿）现在，又亮了。' },
        { speaker: '', color: '#aaaaaa', text: '（他没再说话。灯室的光，慢慢扫过海面。）' },
      ],
      () => {
        triggerOnce('ch3_lighthouse_arrival', () => {});
        this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
        this.ch3ArrivalQueued = false;
      },
    );
    if (!ok) {
      // 理论不可达（已查过占用）；防御：一秒后重试
      this.time.delayedCall(1000, () => this.queueCh3ArrivalDialogue(attempts + 1));
    }
  }

  // ═════ 第三章幕二 · 执灯人三件套深交互（D-012 范式：完成→留下痕迹，不解释奖励） ═════
  // 台词均为方向稿（未定稿）；日志续写内容刻意留白不碰真相（碎片骨架纪律）。

  /** 幕四：日记深读（渐进解锁——段1 随碰面后首读；段2/段3 由碎片进度解锁；指引下一碎片位置） */
  private interactCh3Diary(): void {
    if (!hasTriggered('ch3_diary_2')) {
      this.playStory(
        [
          { speaker: '', color: '#aaaaaa', text: '（你翻开旧页。里面夹着一张手绘的海图，角上标着一个记号——栈板尽头。）' },
          { speaker: '', color: '#aaaaaa', text: '（下一行写着：星星落进浪里，也捡得回来。）' },
        ],
        () => {
          triggerOnce('ch3_diary_2', () => {});
          this.saveAtPlayer();
        },
      );
      return;
    }
    if (!hasTriggered('ch3_diary_3')) {
      this.playStory(
        [
          { speaker: '', color: '#aaaaaa', text: '（再往后翻，字迹老了些——「西墙开一口子吧。路是人走出来的，墙是人守出来的。」）' },
          { speaker: '', color: '#aaaaaa', text: '（页脚还有一个未画完的小图——海湾缺口的形状。）' },
        ],
        () => {
          triggerOnce('ch3_diary_3', () => {});
          this.saveAtPlayer();
        },
      );
      return;
    }
    this.showDialogueText('（日记停在这一页。剩下的，好像要去把散落的星屑凑齐了才读得下去。）');
  }

  /** 航海日志·续写：爷爷笔迹停在多年前；玩家可留下一行（三选一互斥，triggerOnce 承载，零新字段） */
  private interactCh3Logbook(): void {
    // 幕五（槽 D2）：归位活动期 → 桥结局（把日志留在灯塔——连接行为）
    if (this.ch3FinaleActive()) { this.tryCh3EndBridge(); return; }
    // 幕四：碰面后 → 日记深读流程（段2/段3 渐进解锁）
    if (hasTriggered('ch3_captain_meet')) { this.interactCh3Diary(); return; }
    const writtenA = hasTriggered('ch3_log_line_a');
    const writtenB = hasTriggered('ch3_log_line_b');
    if (writtenA || writtenB) {
      const line = writtenA ? '今天，灯还亮着。' : '风很好，海也平。';
      this.showDialogueText(`（日志摊在最后一页。你写下的那行还在——「${line}」墨迹很新。）`);
      return;
    }
    this.playStory(
      [
        { speaker: '', color: '#aaaaaa', text: '一本泛黄的航海日志，夹着海风的咸味。最后一页写着——「等星星落下来，就带你去灯塔。」' },
        { speaker: '', color: '#aaaaaa', text: '（铅笔就夹在页脚。墨迹停在很多年前。）' },
        { speaker: '', color: '#aaaaaa', text: '（要写点什么吗？）', options: ['「今天，灯还亮着。」', '「风很好，海也平。」', '（不写。轻轻放回）'] },
      ],
      undefined,
      (index: number) => {
        if (index === 0) {
          triggerOnce('ch3_log_line_a', () => {});
          this.playStory([{ speaker: '', color: '#aaaaaa', text: '（你写下了这句。墨迹很新，压着旧年的字。）' }]);
        } else if (index === 1) {
          triggerOnce('ch3_log_line_b', () => {});
          this.playStory([{ speaker: '', color: '#aaaaaa', text: '（你写下了这句。像一句给以后的人的天气报。）' }]);
        } else {
          this.playStory([{ speaker: '', color: '#aaaaaa', text: '（你把铅笔放了回去。有些页，该留给写它的人。）' }]);
        }
      },
    );
  }

  /** 老望远镜·观察模式：透镜视野看海（夜：黑点方向；昼：海岸线）。纯视觉，无对白解释。 */
  private interactCh3Telescope(): void {
    if (this.ch3TelescopeActive) return;
    this.ch3TelescopeActive = true;
    const night = getTime().hour >= 18 || getTime().hour < 6;
    this.cameras.main.zoomTo(1.9, 900);
    const vig = this.add.graphics().setScrollFactor(0).setDepth(300);
    const cx = 512, cy = 384, r = 200;
    vig.fillStyle(0x06090f, 0.82);
    vig.fillRect(0, 0, 1024, cy - r);
    vig.fillRect(0, cy + r, 1024, 384 - cy + r);
    vig.fillRect(0, cy - r, cx - r, 2 * r);
    vig.fillRect(cx + r, cy - r, 1024 - cx - r, 2 * r);
    vig.lineStyle(3, 0x1a1410, 0.9);
    vig.strokeCircle(cx, cy, r);
    const line = night
      ? (hasTriggered('ch2_black_dot')
          ? '（镜筒压低，对准海平线。那个黑点还在老地方——一动不动。）'
          : '（镜筒缓缓扫过夜海。远处只有浪，和浪里的星光。）')
      : '（白天的海面亮得晃眼。青禾镇的海岸线，你从没看得这么清楚过。）';
    this.playStory(
      [{ speaker: '', color: '#aaaaaa', text: line }],
      () => {
        this.cameras.main.zoomTo(1, 700);
        this.time.delayedCall(750, () => { vig.destroy(); this.ch3TelescopeActive = false; });
      },
    );
  }

  /** 执灯人日常交互：轮换短句（行动型角色）；日志续写后追加一句 D-012 半句话 */
  private canTryCh3Keeper(): boolean {
    if (!this.ch3KeeperGfx) return false;
    const k = MapScene.CH3.keeper;
    const dx = this.player.x - k.x, dy = this.player.y - k.y;
    return dx * dx + dy * dy <= R2(40);
  }

  private tryCh3KeeperInteract(): boolean {
    this.inputManager.clearAction();
    const lines = [
      '（他朝你点了下头，继续擦灯罩。）',
      '灯油不缺。缺的是来看海的人。',
      '（他把抹布叠好）你常来，灯就多个人看。',
    ];
    const i = Math.min(this.ch3KeeperTalkCount, lines.length - 1);
    this.ch3KeeperTalkCount++;
    if (this.ch3KeeperTalkCount === 4 && (hasTriggered('ch3_log_line_a') || hasTriggered('ch3_log_line_b'))) {
      // D-012 半句话：看到玩家续写的日志后（一次性插入，不打乱轮换）
      this.showDialogueText('陈叔：……（他瞥了一眼日志上你的字）字不错。');
      return true;
    }
    this.showDialogueText(`陈叔：${lines[i]}`);
    return true;
  }

  /** 铜铃（灯塔方案预留）：敲响 → 夜里黑点方向的回应光。行为交互，无奖励。 */
  private canTryCh3Bell(): boolean {
    if (!this.ch3BellGfx) return false;
    const b = MapScene.CH3.bell;
    const dx = this.player.x - b.x, dy = this.player.y - b.y;
    return dx * dx + dy * dy <= R2(34);
  }

  private tryCh3BellInteract(): boolean {
    this.inputManager.clearAction();
    play('harvest_first'); // 风铃质感（程序合成，零资产）
    const night = getTime().hour >= 18 || getTime().hour < 6;
    if (night && hasTriggered('ch2_black_dot')) {
      this.showDialogueText('（铃声荡出去，很久才散。远处海面上，好像有光应了一下。）');
    } else if (night) {
      this.showDialogueText('（铃声荡进夜里，散在浪声里。）');
    } else {
      this.showDialogueText('（铃声很轻，被风接走了。）');
    }
    return true;
  }

  // ═════ 第三章幕三 · 来船靠岸 + 商业化冲突开局（方向稿；来船性质/幕后留白不解答） ═════

  /**
   * 幕三后半 · 镇民反应注脚（D-012 注脚级；**不决定提案走向**——走向属幕五前拍板项）：
   * 照片传到镇上（B 钉在需求板旁）→ 玩家进 town 广场触发一次注脚演出：
   * 镇长（收束者）/ 夏雅（"被看见也没不好，但这岛不是拍给人看的"）/ B（"不催"）。
   * 触发：ch3_b_photo + 进 town 需求板区 + 对白空闲；占用规范（重试不丢）。
   */
  private checkCh3TownReact(): void {
    if (this.mapKey !== 'town' || this.ch3TownReactQueued) return;
    if (hasTriggered('ch3_town_react')) return;
    if (!hasTriggered('ch3_b_photo')) return;
    if (this.storyDialogue?.isOpen() || this.storySequenceRunner?.isPlaying?.()) return;
    const T = TILE_SIZE;
    const dx = this.player.x - (32 * T + T / 2), dy = this.player.y - (16 * T + T / 2);
    if (dx * dx + dy * dy > 150 * 150) return;
    this.ch3TownReactQueued = true;
    this.time.delayedCall(1100, () => this.startCh3TownReact());
  }

  private startCh3TownReact(): void {
    if (this.ch3TownReactOwed) { this.runCh3TownReact(); return; }
    const ok = triggerOnce('ch3_town_react', () => this.runCh3TownReact());
    if (!ok) { this.ch3TownReactQueued = false; return; }
    this.ch3TownReactOwed = true; // 被打断不丢注脚（同 owed 范式）
  }

  private runCh3TownReact(): void {
    this.setupCh3BoardPhoto();
    this.playStory(
      [
        { speaker: '', color: '#aaaaaa', text: '（需求板旁边，多了一张钉起来的照片——码头，老船，和一个举着相机的身影。）' },
        { speaker: '旅人', color: '#c8e0d8', text: '（正往照片上按图钉）借你们板子一角。回头再贴新的。' },
        { speaker: '镇长', color: '#c8b898', text: '（背着手看了半天）……让镇子自己慢慢想。这事，急不得。' },
        { speaker: '夏雅', color: '#d8a8b8', text: '被看见，也没什么不好。不过——这岛不是拍给人看的。' },
        { speaker: '旅人', color: '#c8e0d8', text: '我没打算催。' },
        { speaker: '', color: '#aaaaaa', text: '（谁也没把话说满。照片就钉在那儿，风吹得它轻轻响。）' },
      ],
      () => {
        this.ch3TownReactOwed = false;
        this.ch3TownReactQueued = false;
        this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
      },
    );
  }

  /** 幕三后半常驻视觉：需求板旁钉着的小照片（D-012 痕迹，create 重建） */
  private setupCh3BoardPhoto(): void {
    if (this.mapKey !== 'town') return;
    if (this.ch3BoardPhotoGfx) return;
    const T = TILE_SIZE;
    const px = 32 * T + T / 2 + 14, py = 16 * T + T / 2 - 6;
    const g = this.add.graphics().setDepth(4);
    g.fillStyle(0xf0e8d0, 1); g.fillRect(px - 5, py - 6, 10, 8);
    g.lineStyle(1, 0x3a3026, 1); g.strokeRect(px - 5, py - 6, 10, 8);
    g.fillStyle(0x8a7440, 1); g.fillRect(px - 1, py - 8, 2, 3); // 图钉
    this.ch3BoardPhotoGfx = g;
  }

  /**
   * 灯塔叙事链·阶段1（灯塔区域生产方案 §三：有人在重新在意它）：
   * 亮灯首映后、第二章村民注意（节拍1）前，玩家路过 farm 西侧 → 一次性细节
   * "玻璃好像被人擦过了"。不解释谁擦的（执灯人伏笔，D-012 注脚级）。
   */
  private checkCh3LhStage1(): void {
    if (this.mapKey !== 'farm' || this.player.x > 6 * TILE_SIZE) return;
    if (!hasTriggered('lighthouse_lit_seen') || hasTriggered('ch2_lighthouse_talked')) return;
    if (hasTriggered('ch3_lh_stage1') || this.storyDialogue?.isOpen()) return;
    triggerOnce('ch3_lh_stage1', () => {});
    this.showDialogueText('（远处灯塔的玻璃……好像被人擦过了。谁会去擦它呢。）');
  }

  /** 触发：黑点已见 + 灯塔已开放 + 夜 19-23 + 玩家在码头一带（目击靠岸） */
  private checkCh3ShipArrival(): void {
    if (this.mapKey !== 'qinghe_river' || this.ch3ShipQueued) return;
    if (hasTriggered('ch3_ship_arrived')) return;
    if (!hasTriggered('ch2_black_dot') || !hasTriggered('ch3_lighthouse_arrival')) return;
    if (this.storyDialogue?.isOpen() || this.storySequenceRunner?.isPlaying?.()) return;
    const t = getTime();
    if (t.hour < 19 || t.hour >= 23) return;
    const p = MapScene.CH2.captain;
    const dx = this.player.x - p.x, dy = this.player.y - p.y;
    if (dx * dx + dy * dy > 220 * 220) return;
    this.ch3ShipQueued = true;
    this.time.delayedCall(1200, () => this.startCh3ShipArrival());
  }

  private startCh3ShipArrival(): void {
    if (this.ch3ShipOwed) { this.runCh3ShipArrival(); return; }
    const ok = triggerOnce('ch3_ship_arrived', () => this.runCh3ShipArrival());
    if (!ok) { this.ch3ShipQueued = false; return; }
    this.ch3ShipOwed = true; // 演出收尾前视为欠播（被打断不丢剧情，同夜谈范式）
  }

  private runCh3ShipArrival(): void {
    // ① 灯火由远及近（黑点方向 → 码头），然后靠岸视觉
    const ship = MapScene.CH3.ship;
    const glow = this.add.graphics().setDepth(4);
    glow.fillStyle(0xffe6a0, 0.9);
    glow.fillCircle(430, 372, 2.5);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, x: ship.x, y: ship.y - 6, duration: 2600, ease: 'Sine.inOut' });
    this.time.delayedCall(2700, () => {
      glow.destroy();
      this.setupCh3Ship();
      this.setupCh3StrangerNpc();
      // ② 对白（方向稿，未定稿；不解释船的性质——谜面留给玩家）
      this.playStory(
        [
          { speaker: '', color: '#aaaaaa', text: '（夜里。海平线上那个黑点，动了。）' },
          { speaker: '', color: '#aaaaaa', text: '（一点灯火由远及近——是一艘船。比老船新得多。）' },
          { speaker: '', color: '#aaaaaa', text: '（船靠了岸。旅人从船上跳下来，肩上多了一台相机。）' },
          { speaker: '旅人', color: '#c8e0d8', text: '我说过我会回来。这次带着相机。' },
          { speaker: '旅人', color: '#c8e0d8', text: '这座岛……值得被外面的人看见。我想把它记下来——照片、文字，都行。' },
          { speaker: '老船长', color: '#a8b8c8', text: '看归看。别踩坏栈板。' },
          { speaker: '旅人', color: '#c8e0d8', text: '放心，我不捣乱。我只是想……让更多人知道这里。' },
          { speaker: '', color: '#aaaaaa', text: '（船没走，就停在老船旁边。船是什么来头，没人问，他也没说。）' },
        ],
        () => {
          this.ch3ShipOwed = false;
          this.ch3ShipQueued = false;
          markRestored('ch3_ship_docked');
          this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
        },
      );
    });
  }

  /** 幕三常驻视觉：外来船（比老船新，舷灯冷白——与老船灯暖黄对照："新与旧并排"） */
  private setupCh3Ship(): void {
    if (this.mapKey !== 'qinghe_river') return;
    if (this.ch3ShipGfx.length > 0) { this.ch3ShipGfx = this.ch3ShipGfx.filter((o) => o.active); if (this.ch3ShipGfx.length) return; }
    const s = MapScene.CH3.ship;
    const g = this.add.graphics().setDepth(3);
    g.fillStyle(0x2a3440, 1); g.fillEllipse(s.x, s.y, 56, 16);        // 船身（更修长）
    g.fillStyle(0x1e2830, 1); g.fillRect(s.x + 14, s.y - 8, 20, 4);   // 船楼
    g.fillStyle(0xbcc8d0, 1); g.fillRect(s.x + 20, s.y - 12, 2, 6);   // 桅杆
    this.ch3ShipGfx.push(g);
    const lamp = this.add.graphics().setDepth(4);
    lamp.fillStyle(0xcfe8ff, 0.9); lamp.fillEllipse(s.x + 12, s.y - 14, 4, 4); // 舷灯（冷白）
    lamp.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: lamp, alpha: { from: 0.5, to: 1.0 }, duration: 1300, yoyo: true, repeat: -1 });
    this.ch3ShipGfx.push(lamp);
  }

  /** 幕三常驻：旅人（码头；相机挂在胸前。候选 ch3_stranger 日常交互） */
  private setupCh3StrangerNpc(): void {
    if (this.mapKey !== 'qinghe_river') return;
    if (this.ch3StrangerNpcGfx.length > 0) { this.ch3StrangerNpcGfx = this.ch3StrangerNpcGfx.filter((o) => o.active); if (this.ch3StrangerNpcGfx.length) return; }
    const s = MapScene.CH3.strangerNpc;
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x3c4a44, 1); g.fillCircle(s.x, s.y - 13, 3.2);        // 头
    g.fillStyle(0x9a8a7a, 1); g.fillCircle(s.x, s.y - 13, 2.4);        // 肤色
    g.fillStyle(0x46564e, 1); g.fillRect(s.x - 5, s.y - 10, 10, 13);   // 上身
    g.fillStyle(0x323e38, 1); g.fillRect(s.x - 4, s.y + 3, 3, 6);      // 腿
    g.fillStyle(0x323e38, 1); g.fillRect(s.x + 2, s.y + 3, 3, 6);
    g.fillStyle(0x22282c, 1); g.fillRect(s.x - 2, s.y - 7, 7, 5);      // 胸前相机
    this.ch3StrangerNpcGfx.push(g);
    this.add.text(s.x, s.y - 23, '旅人', {
      fontSize: '11px', color: '#c8e0d8', stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.45)', padding: { x: 2, y: 1 },
    }).setOrigin(0.5).setDepth(5);
  }

  private canTryCh3Stranger(): boolean {
    if (this.ch3StrangerNpcGfx.length === 0) return false;
    const s = MapScene.CH3.strangerNpc;
    const dx = this.player.x - s.x, dy = this.player.y - s.y;
    return dx * dx + dy * dy <= R2(40);
  }

  private tryCh3StrangerInteract(): boolean {
    this.inputManager.clearAction();
    // 阶段化（幕三后半「岛屿记录计划」，方向稿未定稿；谜底零触碰——B 定位来自拍板基线 §1.7 记录者）：
    // 0-2 次：日常轮换 → 第 4 次：提案（想拍一张"有人在生活"的码头照片）→ 第 5 次：拍照完成
    // （照片钉柱常驻 + 老船长无注音注脚 + B 冲突留白句）→ 之后：整理照片静态句
    if (hasTriggered('ch3_b_photo')) {
      this.showDialogueText('（他在整理这一卷照片。把最好的一张，钉在了柱子上。）');
      return true;
    }
    if (this.ch3StrangerTalkCount === 3 && !hasTriggered('ch3_b_proposal')) {
      this.ch3StrangerTalkCount++;
      this.playStory(
        [
          { speaker: '旅人', color: '#c8e0d8', text: '我想给码头拍一张照片。得是有人的样子——有人在生活的那种。' },
          { speaker: '旅人', color: '#c8e0d8', text: '你在这儿忙你的，别管我。生活是演不出来的。' },
        ],
        () => {
          triggerOnce('ch3_b_proposal', () => {});
          this.saveAtPlayer();
        },
      );
      return true;
    }
    if (this.ch3StrangerTalkCount >= 4 && hasTriggered('ch3_b_proposal')) {
      this.ch3StrangerTalkCount++;
      this.playStory(
        [
          { speaker: '', color: '#aaaaaa', text: '（你在码头边忙你的。咔嚓。）' },
          { speaker: '旅人', color: '#c8e0d8', text: '（他把照片钉在柱子上）……你看。有人生活的地方，照片自己会说话。' },
          { speaker: '旅人', color: '#c8e0d8', text: '至于让多少人看见……我想再听听大家的想法。不急。' },
          { speaker: '', color: '#aaaaaa', text: '（老船长瞥了一眼那张照片，没说什么，嘴角松了一下。）' },
        ],
        () => {
          triggerOnce('ch3_b_photo', () => {});
          this.setupCh3PhotoPinned();
          this.saveAtPlayer();
        },
      );
      return true;
    }
    const lines = [
      '（他在拍栈板上的钉子。）现在的人，就爱拍这些。',
      '照片不会说谎。但挑哪张给人看……是门学问。',
      '别担心，我不是来买岛的。……现在还不是。',
    ];
    const i = Math.min(this.ch3StrangerTalkCount, lines.length - 1);
    this.ch3StrangerTalkCount++;
    this.showDialogueText(`旅人：${lines[i]}`);
    return true;
  }

  /** 幕三后半常驻视觉：照片钉在码头柱上（D-012 痕迹——"有人生活的地方"被记了下来） */
  private setupCh3PhotoPinned(): void {
    if (this.mapKey !== 'qinghe_river') return;
    if (this.ch3PhotoPinnedGfx) return;
    const s = MapScene.CH3.strangerNpc;
    const g = this.add.graphics().setDepth(4);
    g.fillStyle(0x6e5a3a, 1); g.fillRect(s.x + 34, s.y - 26, 2, 18);   // 柱
    g.fillStyle(0xf0e8d0, 1); g.fillRect(s.x + 30, s.y - 22, 10, 8);   // 照片
    g.lineStyle(1, 0x3a3026, 1);
    g.strokeRect(s.x + 30, s.y - 22, 10, 8);
    this.ch3PhotoPinnedGfx = g;
  }

  // ═════ 幕三后半 · 冲突展开（槽 A1：岛民分化，镇长搁置；保留句「船停着，人住着，慢慢看。」） ═════

  /** 当前地图的 B 机位（未拍摄才有） */
  private ch3ArchiveSpot(): { ev: string; note: string; pos: { x: number; y: number } } | null {
    if (!this.isLighthouseUnlocked()) return null;
    for (const a of MapScene.CH3_ARCHIVE) {
      if (a.mapKey !== this.mapKey) continue;
      if (hasTriggered(a.ev)) return null; // 拍完收摊
      return { ev: a.ev, note: a.note, pos: a.mapKey === 'town' ? MapScene.CH3.arcTown
        : a.mapKey === 'farm' ? MapScene.CH3.arcFarm : MapScene.CH3.arcLh };
    }
    return null;
  }

  private ch3ArchiveDoneCount(): number {
    return (['ch3_archive_town', 'ch3_archive_farm', 'ch3_archive_lh'] as const)
      .filter((e) => hasTriggered(e)).length;
  }

  private canTryCh3Archive(): boolean {
    const s = this.ch3ArchiveSpot();
    if (!s) return false;
    const dx = this.player.x - s.pos.x, dy = this.player.y - s.pos.y;
    return dx * dx + dy * dy <= R2(34);
  }

  private tryCh3ArchiveInteract(): boolean {
    this.inputManager.clearAction();
    const s = this.ch3ArchiveSpot();
    if (!s) return false;
    triggerOnce(s.ev, () => {});
    this.showDialogueText(`旅人（远处喊）：帮我看看水平泡居中没？${s.note}`);
    const done = this.ch3ArchiveDoneCount();
    // 三机位全拍完 → 码头碰面演出（保留句；镇长"灯下再议"= 幕四钩子）
    if (done === 3) this.ch3QueueCaptainMeet();
    return true;
  }

  /** 码头碰面：老船长与 B（克制，不站队）；镇长"灯下再议"= 幕四钩子 */
  private ch3QueueCaptainMeet(): void {
    // 碰面应在码头（qinghe_river）：武装后由 update 驱动，玩家到码头且空闲才播
    if (this.ch3MeetQueued || this.ch3MeetOwed || hasTriggered('ch3_captain_meet')) return;
    this.ch3MeetQueued = true;
  }

  /** update 驱动：armed → 玩家在 qinghe_river 码头一带且对白空闲 → 播放碰面 */
  private checkCh3CaptainMeet(): void {
    if (!this.ch3MeetQueued || this.ch3MeetOwed || this.ch3AnyEndingDone()) return;
    if (hasTriggered('ch3_captain_meet')) { this.ch3MeetQueued = false; return; }
    if (this.mapKey !== 'qinghe_river') return;
    if (this.storyDialogue?.isOpen() || this.storySequenceRunner?.isPlaying?.()) return;
    const p = MapScene.CH2.captain;
    const dx = this.player.x - p.x, dy = this.player.y - p.y;
    if (dx * dx + dy * dy > 220 * 220) return;
    const ok = triggerOnce('ch3_captain_meet', () => this.runCh3CaptainMeet());
    if (!ok) { this.ch3MeetQueued = false; return; }
    this.ch3MeetOwed = true;
  }

  private runCh3CaptainMeet(): void {
    const night = getTime().hour >= 18 || getTime().hour < 6;
    this.playStory(
      [
        { speaker: '', color: '#aaaaaa', text: night
          ? '（夜里。B 的三个机位，摆满了岛的三个角落。码头上，老船长收起桐油罐。）'
          : '（B 的三个机位，摆满了岛的三个角落。码头上，老船长收起桐油罐。）' },
        { speaker: '老船长', color: '#a8b8c8', text: '拍完了？' },
        { speaker: '旅人', color: '#c8e0d8', text: '拍完了。都在。船、屋、灯……还有人。' },
        { speaker: '老船长', color: '#a8b8c8', text: '拍这些，做什么用？' },
        { speaker: '旅人', color: '#c8e0d8', text: '让没来过的人，知道这里在。' },
        { speaker: '', color: '#aaaaaa', text: '（沉默一阵。浪拍了两下栈板。）' },
        { speaker: '老船长', color: '#a8b8c8', text: '船停着，人住着，慢慢看。' },
        { speaker: '', color: '#aaaaaa', text: '（后来镇长听说了照片的事，只说了一句：灯下再议。）' },
      ],
      () => {
        this.ch3MeetOwed = false;
        this.ch3MeetQueued = false;
        this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
      },
    );
  }

  /** 幕三后半常驻视觉：B 的三脚架+相机（未拍摄的机位才显示，拍完收摊） */
  private setupCh3ArchiveTripod(): void {
    if (this.ch3ArchiveVisual) { this.ch3ArchiveVisual.destroy(); this.ch3ArchiveVisual = null; }
    const s = this.ch3ArchiveSpot();
    if (!s) return;
    const g = this.add.graphics().setDepth(4);
    g.fillStyle(0x3a3a30, 1);                                  // 三脚架（三条斜腿）
    g.lineStyle(1.5, 0x3a3a30, 1);
    g.beginPath();
    g.moveTo(s.pos.x, s.pos.y - 14); g.lineTo(s.pos.x - 5, s.pos.y + 2);
    g.moveTo(s.pos.x, s.pos.y - 14); g.lineTo(s.pos.x + 5, s.pos.y + 2);
    g.moveTo(s.pos.x, s.pos.y - 14); g.lineTo(s.pos.x, s.pos.y + 2);
    g.strokePath();
    g.fillStyle(0x22282c, 1); g.fillRect(s.pos.x - 4, s.pos.y - 20, 8, 6); // 相机
    g.fillStyle(0x9adf6a, 0.8); g.fillCircle(s.pos.x + 4, s.pos.y - 17, 1); // 录制灯
    this.ch3ArchiveVisual = g;
  }

  // ═════ 幕四 · 观察日记 + 碎片（槽 B1/C1：碎片×3 渐进发现；谜底方向=C1，正文方向稿未定稿） ═════

  /** 碎片可见性（B1：看见→寻找→理解；渐进解锁） */
  private ch3ShardVisible(which: 'lh' | 'qh' | 'fm'): boolean {
    if (!hasTriggered('ch3_captain_meet')) return false;
    if (hasTriggered('ch3_shard_' + which)) return false; // 已拾取
    if (which === 'lh') return true;                                   // ① 灯塔内：碰面后即可见
    if (which === 'qh') return hasTriggered('ch3_diary_2');            // ② 日记段2 指引栈板尽头
    return hasTriggered('ch3_diary_3');                                // ③ 日记段3 指引海湾缺口
  }

  private ch3ShardPos(which: 'lh' | 'qh' | 'fm'): { x: number; y: number } {
    return which === 'lh' ? { x: 250, y: 170 } : which === 'qh' ? { x: 150, y: 336 } : { x: 60, y: 196 };
  }

  /** 幕四常驻视觉：碎片光点（呼吸；create 重建，已拾取不画） */
  private setupCh3Shards(): void {
    // 灯塔内（碰面后可见）
    if (this.mapKey === 'lighthouse') {
      if (this.ch3ShardVisible('lh')) {
        if (this.ch3ShardGfx_lh && this.ch3ShardGfx_lh.active) return;
        const s = this.ch3ShardPos('lh');
        this.ch3ShardGfx_lh = this.drawCh3Shard(s.x, s.y);
      } else if (this.ch3ShardGfx_lh) { this.ch3ShardGfx_lh.destroy(); this.ch3ShardGfx_lh = null; }
    }
    // qinghe 栈板尽头（段2 后可见）
    if (this.mapKey === 'qinghe_river') {
      if (this.ch3ShardVisible('qh')) {
        if (this.ch3ShardGfx_qh && this.ch3ShardGfx_qh.active) return;
        const s = this.ch3ShardPos('qh');
        this.ch3ShardGfx_qh = this.drawCh3Shard(s.x, s.y);
      } else if (this.ch3ShardGfx_qh) { this.ch3ShardGfx_qh.destroy(); this.ch3ShardGfx_qh = null; }
    }
    // farm 海湾缺口（段3 后可见）
    if (this.mapKey === 'farm') {
      if (this.ch3ShardVisible('fm')) {
        if (this.ch3ShardGfx_fm && this.ch3ShardGfx_fm.active) return;
        const s = this.ch3ShardPos('fm');
        this.ch3ShardGfx_fm = this.drawCh3Shard(s.x, s.y);
      } else if (this.ch3ShardGfx_fm) { this.ch3ShardGfx_fm.destroy(); this.ch3ShardGfx_fm = null; }
    }
  }

  /** 碎片光点绘制（蓝白星屑，呼吸） */
  private drawCh3Shard(x: number, y: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(4);
    g.fillStyle(0x9fd8ff, 0.9); g.fillCircle(x, y, 3);
    g.fillStyle(0xd8f0ff, 0.5); g.fillCircle(x, y, 6);
    g.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: g, alpha: { from: 0.45, to: 1 }, duration: 1200, yoyo: true, repeat: -1 });
    return g;
  }


  private ch3ShardWhichHere(): 'lh' | 'qh' | 'fm' | null {
    for (const which of ['lh', 'qh', 'fm'] as const) {
      if (!this.ch3ShardVisible(which)) continue;
      const s = this.ch3ShardPos(which);
      const dx = this.player.x - s.x, dy = this.player.y - s.y;
      if (dx * dx + dy * dy <= R2(34)) return which;
    }
    return null;
  }

  private canTryCh3Shard(): boolean { return this.ch3ShardWhichHere() !== null; }

  private tryCh3ShardInteract(): boolean {
    this.inputManager.clearAction();
    const which = this.ch3ShardWhichHere();
    if (!which) return false;
    triggerOnce('ch3_shard_' + which, () => {});
    play('shard');
    this.setupCh3Shards(); // 拾取后即时消失
    this.showDialogueText('（星屑入手微凉。像捡起了一句没说完的话。）');
    this.checkCh3ShardsDone();
    return true;
  }

  /** 集齐三片 → 灯室结算演出（C1 方向稿正文，未定稿；约束：不是预言，是相信） */
  private checkCh3ShardsDone(): void {
    if (!hasTriggered('ch3_shard_lh') || !hasTriggered('ch3_shard_qh') || !hasTriggered('ch3_shard_fm')) return;
    if (hasTriggered('ch3_diary_finale') || this.ch3FinaleQueued) return;
    if (this.mapKey !== 'lighthouse') return; // 结算在灯室发生
    if (this.storyDialogue?.isOpen() || this.storySequenceRunner?.isPlaying?.()) return;
    this.ch3FinaleQueued = true;
    this.time.delayedCall(1200, () => this.runCh3DiaryFinale());
  }

  private runCh3DiaryFinale(): void {
    this.playStory(
      [
        { speaker: '', color: '#aaaaaa', text: '（三片星屑在灯室里排成一线，像一段没写完的话，被补上了最后一句。）' },
        { speaker: '陈叔', color: '#ffe6a0', text: '（把日志递还给你）最后一页，是给你留的。' },
        { speaker: '', color: '#aaaaaa', text: '（那一页只有短短几行——是爷爷的字。）' },
        { speaker: '', color: '#ffe9c8', text: '「灯不是为哪一艘船点的。是给所有想回来的人留的。我不知道回来的是谁。但只要灯亮着，回来的路上，就不会黑。」' },
        { speaker: '林澈', color: '#c8d8f0', text: '……原来爷爷不是在等我。' },
        { speaker: '陈叔', color: '#ffe6a0', text: '他是在等"有人"。' },
        { speaker: '林澈', color: '#c8d8f0', text: '（想起铭牌上的字）「每日点灯，为归航的人照亮回家的路」——原来这句话，不是写给船的。' },
        { speaker: '林澈', color: '#c8d8f0', text: '那现在呢？' },
        { speaker: '陈叔', color: '#ffe6a0', text: '（看了一眼灯）现在，灯等的是下一个十年。' },
        { speaker: '', color: '#aaaaaa', text: '（光束扫过海面。那一夜，灯塔比任何一夜都亮。）' },
      ],
      () => {
        triggerOnce('ch3_diary_finale', () => {});
        this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
      },
    );
  }

  // ═════ 幕五 · 归位（槽 D2：三结局行为承载，无选项面板） ═════

  private ch3AnyEndingDone(): boolean {
    return hasTriggered('ch3_end_stay') || hasTriggered('ch3_end_leave') || hasTriggered('ch3_end_bridge');
  }

  /** 归位状态：集齐+结算后，某夜 21 点后开启"最后一个行为"窗口 */
  private checkCh3FinaleOpen(): void {
    if (!hasTriggered('ch3_diary_finale') || hasTriggered('ch3_finale_open')) return;
    if (this.ch3FinaleOpenQueued) return;
    const t = getTime();
    if (t.hour < 21) return;
    this.ch3FinaleOpenQueued = true;
    const ok = triggerOnce('ch3_finale_open', () => {
      this.playStory(
        [
          { speaker: '', color: '#aaaaaa', text: '（光束扫过海面。灯下，那个问题浮了上来：那我呢？我要怎么回来？）' },
          { speaker: '', color: '#aaaaaa', text: '（三个方向都在脚边——床，船，灯。）' },
        ],
        () => this.saveAtPlayer(),
      );
    });
    if (!ok) this.ch3FinaleOpenQueued = false;
  }

  /** 归位活动期（最后一个行为未做出） */
  private ch3FinaleActive(): boolean {
    return hasTriggered('ch3_finale_open') && !this.ch3AnyEndingDone();
  }

  /** 结局一（返城）：走上外来船 */
  private canTryCh3EndShip(): boolean {
    if (!this.ch3FinaleActive() || this.mapKey !== 'qinghe_river') return false;
    const s = MapScene.CH3.ship;
    const dx = this.player.x - s.x, dy = this.player.y - s.y;
    return dx * dx + dy * dy <= R2(40);
  }

  private tryCh3EndShipInteract(): boolean {
    this.inputManager.clearAction();
    this.playStory(
      [
        { speaker: '', color: '#aaaaaa', text: '（船板轻轻晃了一下。你跳了上去。）' },
        { speaker: '旅人', color: '#c8e0d8', text: '（收起相机）我送你一程。正好，拍一张离岸的。' },
        { speaker: '', color: '#aaaaaa', text: '（船离岸。灯塔的光从你背后扫过来，落在甲板上。）' },
        { speaker: '林澈', color: '#c8d8f0', text: '我会知道这里在哪里。' },
        { speaker: '', color: '#aaaaaa', text: '（第三章·归位——完）' },
      ],
      () => {
        triggerOnce('ch3_end_leave', () => {});
        this.saveAtPlayer();
      },
    );
    return true;
  }

  /** 结局三（桥）：日志交互在归位期 = 把日志留在灯塔（连接行为），自己不上船、不回家睡 */
  private tryCh3EndBridge(): boolean {
    this.playStory(
      [
        { speaker: '', color: '#aaaaaa', text: '（你没有上船，也没有回家。你把日志放在了灯室的窗台上——摊开到有爷爷字迹的那页。）' },
        { speaker: '陈叔', color: '#ffe6a0', text: '（看懂了。他往灯里添了一勺油。）留着吧。以后回来的人，读得到。' },
        { speaker: '', color: '#aaaaaa', text: '（你走下灯塔，坐在庄园门口。没有睡，看那道光扫到天亮。）' },
        { speaker: '林澈', color: '#c8d8f0', text: '（轻声）这样，我两边都在。' },
        { speaker: '', color: '#aaaaaa', text: '（第三章·归位——完）' },
      ],
      () => {
        triggerOnce('ch3_end_bridge', () => {});
        this.saveAtPlayer();
      },
    );
    return true;
  }

  private setupLighthouseVisuals(): void {
    if (this.mapKey !== 'lighthouse') return;
    const night = getTime().hour >= 18 || getTime().hour < 6;
    const T = TILE_SIZE;
    const tx0 = 13 * T, tx1 = 17 * T; // 塔身 x 208-272

    // ===== 1. 塔身层次（叠加在塔身 tiles 上） =====
    const tower = this.add.graphics();
    // 石砖横线（塔身 rows 4-7：y 64-128，每 8px 一道）
    tower.lineStyle(1, 0x2a3a4a, 0.5);
    for (let y = 4 * T + 8; y < 8 * T; y += 8) {
      tower.beginPath();
      tower.moveTo(tx0, y); tower.lineTo(tx1, y);
      tower.strokePath();
    }
    // 错落竖缝
    tower.lineStyle(1, 0x2a3a4a, 0.3);
    let brickRow = 0;
    for (let y = 4 * T; y < 8 * T; y += 8) {
      for (let x = tx0 + 4 + (brickRow % 2) * 8; x < tx1; x += 16) {
        tower.beginPath(); tower.moveTo(x, y); tower.lineTo(x, y + 8); tower.strokePath();
      }
      brickRow++;
    }
    // 风化斑
    tower.fillStyle(0x4a5c6e, 0.35);
    for (const [fx, fy, fw, fh] of [[tx0 + 3, 4 * T + 6, 4, 3], [tx0 + 10, 6 * T + 2, 3, 5], [tx0 + 14, 5 * T + 10, 4, 3], [tx0 + 4, 7 * T + 4, 3, 4]]) {
      tower.fillRect(fx, fy, fw, fh);
    }
    // 锈蚀痕（塔基下部橙褐）
    tower.fillStyle(0x7a4a2a, 0.4);
    for (const [rx, ry, rw, rh] of [[tx0 + 2, 8 * T + 2, 3, 6], [tx0 + 13, 8 * T + 6, 3, 5], [tx0 + 10, 9 * T, 4, 4]]) {
      tower.fillRect(rx, ry, rw, rh);
    }
    // 白漆斑驳（灯塔经典亮块，塔身上部）
    tower.fillStyle(0x5c6c7e, 0.4);
    for (const [px, py, pw, ph] of [[tx0 + 2, 4 * T + 2, 5, 4], [tx0 + 9, 5 * T + 2, 4, 5], [tx0 + 8, 6 * T + 9, 4, 3]]) {
      tower.fillRect(px, py, pw, ph);
    }
    // 塔基石阶线
    tower.lineStyle(1, 0x2a2a34, 0.5);
    tower.beginPath(); tower.moveTo(tx0, 9 * T); tower.lineTo(tx1, 9 * T); tower.strokePath();
    tower.setDepth(2);

    // ===== 2. 灯室强化（玻璃反光 + 窗棂 + 夜晚暖光溢出） =====
    const room = this.add.graphics();
    room.fillStyle(0xffffff, 0.25);
    room.fillRect(14 * T + 3, 2 * T + 3, 5, 2); // 玻璃反光斜条
    room.fillRect(15 * T + 5, 3 * T + 2, 3, 2);
    room.lineStyle(1, 0x2a3a4a, 0.5);
    room.beginPath(); room.moveTo(15 * T, 2 * T); room.lineTo(15 * T, 4 * T); room.strokePath(); // 窗棂
    room.beginPath(); room.moveTo(tx0, 3 * T); room.lineTo(tx1, 3 * T); room.strokePath();
    room.setDepth(2);
    // 暖光晕单独成 Graphics，alpha 走 GameObject setAlpha（探针可断言 + 语义清晰）：
    // 注意：fillStyle 的 alpha 是烘焙在填充色里的，读 .alpha 恒为 1——必须 setAlpha 控制
    // ⚠️ 2026-08-10 制作人方向对齐：灯塔=未来内容预埋，当前灯室恒熄灭。
    //    预埋：城市复兴 → 执灯人归来 → 灯塔重新点灯 后，改回 `night ? 0.35 : 0.06`。
    this.lhRoomGlow = this.add.graphics();
    this.lhRoomGlow.fillStyle(0xffdda0, 1);
    this.lhRoomGlow.fillEllipse(15 * T, 3 * T, 34, 26);
    this.lhRoomGlow.setDepth(2);
    // 第三章幕一（制作人 2026-08-31 开工指令）：灯塔开放 → 灯室亮起（预埋恢复点，值按注释取）
    if (this.isLighthouseUnlocked()) {
      const litNight = getTime().hour >= 18 || getTime().hour < 6;
      this.lhRoomGlow.setAlpha(litNight ? 0.35 : 0.06);
      this.tweens.add({ targets: this.lhRoomGlow, alpha: { from: litNight ? 0.28 : 0.05, to: litNight ? 0.42 : 0.08 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    } else {
    this.lhRoomGlow.setAlpha(0); // 恒熄灯（预埋状态）
    }

    // ===== 3. 光束扫海面（预埋：当前恒不亮；未来灯塔点亮后恢复"夜晚光束"） =====
    // 2026-08-10 制作人方向对齐：现在灯塔=黑，光束属于"未来灯塔亮起"的视觉，
    // 现阶段不创建（lhBeam 恒为 null）。恢复时：night 分支创建此图形 + 呼吸 tween。

    // 【已恢复·第三章幕一】灯塔开放后夜晚创建光束（缓慢摆动扫海面，scrollFactor 0）
    if (this.isLighthouseUnlocked() && night) {
      const beam = this.add.graphics().setScrollFactor(0).setDepth(158);
      beam.fillStyle(0xffe6a0, 0.14);
      beam.fillTriangle(15 * T, 3 * T, 15 * T + 420, 3 * T + 96, 15 * T + 420, 3 * T - 40);
      beam.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: beam, angle: { from: -7, to: 7 }, duration: 5200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    // ===== 4. 海岸环境 =====
    // 浪花（岩石岸线与海交界白线，潮汐呼吸）
    const coast = this.add.graphics();
    coast.fillStyle(0xcfeeff, 0.5);
    // 顶岸 row 2（y 40-44，避开出口通道 cols 12-17 上方无碍）
    for (const [wx, wy, ww] of [[64, 40, 12], [120, 42, 8], [200, 40, 10], [280, 42, 9], [360, 40, 12], [408, 42, 8]]) {
      coast.fillRect(wx, wy, ww, 3);
    }
    // 左岸 col 2（x 36-42；⚠️ 避开西侧入口通道 y 144-224——2026-08-10 入口移到西侧）
    for (const [wx, wy, wh] of [[38, 72, 10], [40, 130, 10], [42, 250, 10]]) {
      coast.fillRect(wx, wy, 3, wh);
    }
    // 右岸 col 26（x 426-432）
    for (const [wx, wy, wh] of [[430, 80, 12], [426, 140, 9], [432, 210, 11]]) {
      coast.fillRect(wx, wy, 3, wh);
    }
    // 底岸 row 16（y 264-268，x 避开出口通道 192-288）
    for (const [wx, wy, ww] of [[64, 264, 10], [140, 266, 8], [180, 264, 8], [300, 266, 10], [404, 264, 10]]) {
      coast.fillRect(wx, wy, ww, 3);
    }
    coast.setDepth(2);
    this.tweens.add({ targets: coast, alpha: { from: 0.4, to: 0.85 }, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // 礁石变化（岩石带叠加不规则灰块，打破规则方块感）
    // ⚠️ 2026-08-10 入口移到西侧（x 0-64, y 144-224 通道），原 (56,179) 礁石挡入口已移除，
    //    (40,146)/(50,228) 挪出通道
    const rocks = this.add.graphics();
    rocks.fillStyle(0x3c3c46, 0.6);
    for (const [rx, ry, rw, rh] of [[2 * T + 2, 6 * T + 2, 6, 4], [26 * T + 3, 5 * T + 5, 6, 4], [27 * T + 6, 13 * T + 2, 5, 5], [7 * T + 2, 2 * T + 4, 6, 4], [20 * T + 4, 16 * T + 2, 6, 4]]) {
      rocks.fillRect(rx, ry, rw, rh);
    }
    rocks.fillStyle(0x4c4c58, 0.5);
    for (const [rx, ry] of [[2 * T + 8, 6 * T + 10], [3 * T + 2, 15 * T + 8], [27 * T + 2, 8 * T + 4], [26 * T + 10, 15 * T + 3]]) {
      rocks.fillRect(rx, ry, 4, 3);
    }
    rocks.setDepth(2);

    // 漂流木（沙滩棕色长条）
    const drift = this.add.graphics();
    drift.fillStyle(0x8a6a4a, 0.9);
    drift.fillRect(6 * T + 2, 13 * T + 6, 10, 2);
    drift.fillRect(21 * T + 3, 5 * T + 10, 8, 2);
    drift.fillStyle(0x6a4a2a, 0.8);
    drift.fillRect(6 * T + 2, 13 * T + 8, 6, 1);
    drift.fillRect(21 * T + 3, 5 * T + 12, 5, 1);
    drift.setDepth(2);

    // 贝壳 / 小石头（沙地白点灰点）
    const shells = this.add.graphics();
    shells.fillStyle(0xe8e0d0, 0.8);
    for (const [sx, sy] of [[5 * T + 4, 12 * T + 4], [7 * T + 8, 14 * T + 2], [22 * T + 2, 6 * T + 6], [24 * T + 6, 13 * T + 5], [9 * T + 3, 4 * T + 6]]) {
      shells.fillRect(sx, sy, 2, 2);
    }
    shells.fillStyle(0x9a9aa2, 0.7);
    for (const [sx, sy] of [[6 * T + 10, 15 * T + 4], [23 * T + 8, 5 * T + 4], [10 * T + 6, 14 * T + 8]]) {
      shells.fillRect(sx, sy, 3, 2);
    }
    shells.setDepth(2);

    // 海草摆动（深绿细条，angle 来回）
    for (const [wx, wy] of [[3 * T + 6, 15 * T + 8], [26 * T + 8, 14 * T + 6], [5 * T + 4, 3 * T + 8], [24 * T + 10, 3 * T + 6]]) {
      const w = this.add.rectangle(wx, wy, 2, 7, 0x1e4a2a, 0.75);
      w.setDepth(2);
      this.tweens.add({ targets: w, angle: { from: -12, to: 12 }, duration: 1400 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    // 风吹草（草地浅绿小条 alpha 摆动）
    for (const [gx, gy] of [[7 * T + 4, 8 * T + 4], [12 * T + 8, 11 * T + 3], [19 * T + 2, 9 * T + 5], [22 * T + 6, 12 * T + 6], [9 * T + 9, 6 * T + 5]]) {
      const g = this.add.rectangle(gx, gy, 2, 5, 0x7aa860, 0.7);
      g.setDepth(2);
      this.tweens.add({ targets: g, alpha: { from: 0.3, to: 0.8 }, duration: 1800 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    // ===== 5. 故事感（不可交互视觉叙事；避开交互锚点/出口平台） =====
    // 守塔人小屋残迹（塔基东南 x 320-362, y 196-240：地基 + 两段断墙）
    const ruin = this.add.graphics();
    ruin.fillStyle(0x8a8a92, 0.5);
    ruin.fillRect(20 * T, 13 * T, 40, 32); // 地基
    ruin.fillStyle(0x6a6a72, 0.6);
    ruin.fillRect(20 * T + 2, 12 * T + 4, 18, 14); // 断墙 A
    ruin.fillRect(20 * T + 28, 12 * T + 6, 14, 12); // 断墙 B
    ruin.fillStyle(0x5c5c66, 0.5);
    ruin.fillRect(20 * T + 6, 12 * T + 8, 4, 6); // 墙面剥落
    ruin.setDepth(2);

    // 废弃工具（铁锹 + 木桶，塔基西侧 x 180-221, y 200-224）
    const tools = this.add.graphics();
    tools.fillStyle(0x6b5238, 0.9);
    tools.fillRect(11 * T + 4, 13 * T - 4, 2, 12); // 铁锹木柄
    tools.fillStyle(0x5a5a64, 0.9);
    tools.fillRect(11 * T + 1, 13 * T + 6, 8, 3); // 锹头
    tools.fillStyle(0x7a5a3a, 0.9);
    tools.fillRect(13 * T + 6, 13 * T - 2, 7, 9); // 木桶
    tools.fillStyle(0x5a3a22, 0.9);
    tools.fillRect(13 * T + 6, 13 * T, 7, 1); // 桶箍
    tools.fillRect(13 * T + 6, 13 * T + 5, 7, 1);
    tools.setDepth(2);

    // 生锈标牌（塔基西侧 x 195-207, y 152-170，歪斜）
    const sign = this.add.graphics();
    sign.fillStyle(0x4a3a2a, 0.9);
    sign.fillRect(12 * T + 8, 10 * T + 2, 2, 10); // 木杆
    sign.fillStyle(0x6a5a44, 0.9);
    sign.fillRect(12 * T + 3, 10 * T - 4, 12, 7); // 铁牌
    sign.fillStyle(0x8a7a5a, 0.5);
    sign.fillRect(12 * T + 4, 10 * T - 2, 4, 2); // 锈迹
    sign.setDepth(2);
    sign.setAngle(-4);

    // ===== 6. 夜晚光影（星点 + 月光银带；塔基地面暖光预埋禁用——灯未亮无光斑） =====
    if (night) {
      // 星点（30 颗散布夜空，alpha 闪烁）——夜空环境，非灯塔灯
      const stars = this.add.graphics();
      stars.fillStyle(0xffffff, 0.8);
      let seed = 42;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 30; i++) {
        stars.fillRect(rnd() * 480, rnd() * 240, 1, 1);
      }
      stars.setDepth(6);
      stars.setAlpha(0.7);
      this.lhStars = stars;
      this.tweens.add({ targets: stars, alpha: { from: 0.4, to: 1 }, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      // 月光银带（两侧海面反光）——月光环境，非灯塔灯
      const moon = this.add.graphics();
      moon.fillStyle(0xa9c4ff, 0.25);
      moon.fillRect(16, 48, 6, 96);
      moon.fillRect(458, 40, 6, 100);
      moon.setDepth(2);
      this.tweens.add({ targets: moon, alpha: { from: 0.1, to: 0.4 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      // 塔基地面暖光（预埋：灯未亮，无光斑；未来灯塔点亮后恢复此块）
    }
  }

  /**
   * P0-5 农场回暖 v2
   * P6a: 委托给 FarmController
   */
  private setupFarmWarm(originX?: number, originY?: number): void {
    if (!this.groundLayer) return;
    this.farmController.setupFarmWarm(this.groundLayer, originX, originY);
  }

  /** 每帧更新农场暖度：委托给 FarmController */
  private updateFarmWarm(): void {
    this.farmController.updateFarmWarm();
  }

  /** 与爷爷笔记交互（靠近按 E → 播放当天一条笔记） */
  private tryGrandpaNoteInteract(): boolean {
    if (!this.grandpaNote || !this.grandpaNote.visible) return false;
    const p = this.grandpaNotePos;
    const dx = this.player.x - p.x;
    const dy = this.player.y - p.y;
    if (dx * dx + dy * dy > R2(28)) return false;
    const note = getGrandpaNote(getTime().day);
    return this.playStory([note], () => {
      this.updateHUD();
    }, undefined, 'grandpa_note');
  }

  /** 清除爷爷笔记精灵（场景切换/跨天时调用） */
  private clearGrandpaNote(): void {
    if (this.grandpaNote) { this.grandpaNote.destroy(); this.grandpaNote = null; }
  }

  // ============ M1-3 爷爷旧花园恢复点 ============

  /**
   * 初始化爷爷旧花园恢复点（farm 农田右上方 cols 28-32 / rows 4-7）。
   * 注意：区域全部为草地（Ground gid 1）、Walls 无碰撞，玩家可通行；
   * 交互锚点选区域中心（col 30, row 5）可走格。
   * 恢复前：荒土瓦片（gid 2）+ 倒木/破花架/荒草（Graphics）
   * 恢复后：花丛（gid 8）+ 小路（gid 7）+ 蝴蝶
   * 状态持久化：FarmRestore.isRestored('garden')，刷新/重进保持恢复态。
   */
  private setupGardenRestore(): void {
    if (this.mapKey !== 'farm') return;
    const T = TILE_SIZE;
    const restored = isRestored('garden');
    this.gardenRestore = {
      stage: restored ? 3 : 0,
      debris: [],
      butterflies: [],
      mark: null,
      // 区域中心（col 30, row 5）作交互基准：可走格，距农田/出口均无碰撞依赖
      pos: { x: 30 * T + T / 2, y: 5 * T + T / 2 },
    };
    if (restored) {
      this.buildGardenRestored();
    } else {
      this.buildGardenRuined();
    }
  }

  /** 恢复前视觉：荒土瓦片 + 三组装饰（倒木/破花架/荒草）+ 交互提示标记 */
  private buildGardenRuined(): void {
    const g = this.gardenRestore;
    if (!g) return;
    const T = TILE_SIZE;
    // 荒土（gid 2）：农田右上方 cols 28-32, rows 4-7（全草地可走，远离木屋/农田）
    for (let r = 4; r <= 7; r++) {
      for (let c = 28; c <= 32; c++) {
        this.groundLayer.putTileAt(2, c, r);
      }
    }
    // 组1 倒木：横躺木段 ×2
    const log = this.add.graphics();
    log.fillStyle(0x8d6e4a, 1);
    log.fillRoundedRect(-9, -3, 18, 6, 3);
    log.setPosition(29 * T + T / 2, 5 * T + T / 2);
    log.setRotation(-0.25);
    log.setDepth(3);
    // 组2 破花架：歪斜木架（两竖 + 横梁）
    const frame = this.add.graphics();
    frame.fillStyle(0x9c7b52, 1);
    frame.fillRect(-1, -7, 2, 14);
    frame.fillRect(5, -7, 2, 14);
    frame.fillRect(-1, -7, 8, 2);
    frame.setPosition(31 * T + T / 2, 4 * T + T / 2);
    frame.setRotation(0.3);
    frame.setDepth(3);
    // 组3 荒草：绿色短线 ×5
    const weeds = this.add.graphics();
    weeds.fillStyle(0x7a9a4a, 1);
    for (let i = 0; i < 5; i++) {
      weeds.fillRect(-12 + i * 6, 0, 1, 4 + (i % 3) * 2);
    }
    weeds.setPosition(30 * T + T / 2, 6 * T + T / 2);
    weeds.setDepth(3);
    g.debris = [log, frame, weeds];
    // 交互提示标记
    g.mark = this.add.text(g.pos.x, g.pos.y - 10, '旧花圃', {
      fontFamily: 'Arial', fontSize: '10px', color: '#e8d8a8',
    }).setOrigin(0.5).setDepth(4);
  }

  /** 恢复后视觉：清除荒土 → 花丛 + 小路 + 蝴蝶 */
  private buildGardenRestored(): void {
    const T = TILE_SIZE;
    // 荒土（gid 2）→ 草地（gid 1）：cols 28-32, rows 4-7
    for (let r = 4; r <= 7; r++) {
      for (let c = 28; c <= 32; c++) {
        this.groundLayer.putTileAt(1, c, r);
      }
    }
    // 小路（gid 7）：下缘一行 row 7, cols 28-32（衔接农田方向）
    for (let c = 28; c <= 32; c++) {
      this.groundLayer.putTileAt(7, c, 7);
    }
    // 花丛（gid 8）：区域内交错 6 朵（全在草地空地，无碰撞）
    const flowerSpots: [number, number][] = [
      [28, 4], [30, 4], [32, 4], [29, 5], [31, 5], [29, 6],
    ];
    for (const [c, r] of flowerSpots) {
      this.wallsLayer.putTileAt(8, c, r);
    }
    // 提示标记消失
    if (this.gardenRestore?.mark) {
      this.gardenRestore.mark.destroy();
      this.gardenRestore.mark = null;
    }
    // 蝴蝶 ×3（花丛间飞，捕虫 V0.2：黄 + 蓝 固定花色 + 1 只青禾凤蝶（花园"有故事的虫"，首次捕获触发世界观描述））
    this.createButterfly(29 * T + T / 2, 4 * T + T / 2, { type: 'yellow' });
    this.createButterfly(31 * T + T / 2, 6 * T + T / 2, { type: 'blue' });
    this.createButterfly(30 * T + T / 2, 5 * T + T / 2, { type: 'qinghe' });

    // 动态花精灵（摆动）已删除（2026-08-07 制作人反馈：左右晃动效违和；
    // 静态花丛瓦片 gid 8 与蝴蝶保留，仅去除摆动精灵层）
    const glow = this.add.graphics();
    glow.fillStyle(0xffeec8, 0.18);
    glow.fillCircle(0, 0, 22);
    glow.setPosition(30 * T + T / 2, 5 * T + T / 2);
    glow.setDepth(2);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.55, to: 1 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  /**
   * 捕虫玩法 V0.2（2026-08-13）：蝴蝶品种。
   * white/yellow/blue 为常见花色；qinghe 为青禾凤蝶（花园里的"有故事的虫"，首次捕捉触发世界观描述）。
   * 第一章 P2「自然记录」收敛（2026-08-13）：去掉稀有度随机，改为固定品种——青禾凤蝶是角色叙事工具而非稀有掉落。
   */
  private static BUTTERFLY_VARIANTS: Record<string, { wing1: number; wing2: number; body: number; name: string }> = {
    white: { wing1: 0xffffff, wing2: 0xe3f2fd, body: 0xcfd8dc, name: '白蝶' },
    yellow: { wing1: 0xffe082, wing2: 0xfff9c4, body: 0xffb300, name: '黄蝶' },
    blue: { wing1: 0x90caf9, wing2: 0xe3f2fd, body: 0x64b5f6, name: '蓝蝶' },
    qinghe: { wing1: 0xb3e5fc, wing2: 0xe3f6ff, body: 0x4fc3f7, name: '青禾凤蝶' },
    // 第一章 v0.11 图鉴墙（2026-08-14，制作人拍板）：柳叶蝶（河边柳树下，白天）/ 夜光蛾（老树旁，夜晚）
    willow: { wing1: 0xa5d6a7, wing2: 0xc8e6c9, body: 0x66bb6a, name: '柳叶蝶' },
    moth: { wing1: 0x9aa0b8, wing2: 0x6f7590, body: 0xe8d8a0, name: '夜光蛾' },
  };

  /** 随机抽品种：均匀落在白/黄/蓝（青禾凤蝶为固定叙事品种，不参与随机；无稀有度） */
  private pickButterflyType(): string {
    const normals = ['white', 'yellow', 'blue'];
    return normals[Math.floor(Math.random() * normals.length)];
  }

  /**
   * 创建一只蝴蝶（Graphics 双翼 + 扇动/绕飞 tween，随场景 shutdown 自动销毁）。
   * 第一章 P2 捕虫玩法 V0.1（2026-08-13）：opts.catchable=true 时挂点击/E 键捕捉交互。
   * V0.2（2026-08-13）：opts.type 指定花色；缺省时随机抽取（含稀有）。
   */
  private createButterfly(x: number, y: number, opts?: { catchable?: boolean; type?: string }): void {
    const t = opts?.type ?? this.pickButterflyType();
    const v = MapScene.BUTTERFLY_VARIANTS[t] ?? MapScene.BUTTERFLY_VARIANTS.yellow;
    const wings = this.add.graphics();
    wings.fillStyle(v.wing1, 1);
    wings.fillEllipse(-3, 0, 6, 4);
    wings.fillEllipse(3, 0, 6, 4);
    wings.fillStyle(v.body, 1);
    wings.fillCircle(0, 0, 1);
    const c = this.add.container(x, y, [wings]);
    c.setDepth(4);
    c.setData('type', t);
    this.tweens.add({
      targets: wings,
      scaleX: { from: 1, to: 0.25 },
      duration: 130, yoyo: true, repeat: -1,
    });
    this.tweens.add({
      targets: c,
      x: x + 8, y: y - 6,
      duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut',
    });
    this.gardenRestore?.butterflies.push(c);
    // 捕虫玩法 V0.1：挂交互（默认 catchable=true，保持现有 farm 调用兼容）
    const catchable = opts?.catchable ?? true;
    if (catchable) {
      c.setData('captured', false);
      c.setInteractive(new Phaser.Geom.Circle(0, 0, 14), Phaser.Geom.Circle.Contains);
      c.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        // 仅响应鼠标左键（移动端 touch 事件无 button 属性，自动放行）
        const ev = pointer.event as MouseEvent;
        if (ev && typeof ev.button === 'number' && ev.button !== 0) return;
        this.tryCatchButterfly(c);
      });
      this.catchableButterflies.push(c);
    }
  }

  /**
   * 捕虫玩法 V0.1（2026-08-13）：捕捉一只蝴蝶。
   * - 触发：靠近按 E（tryCatchNearestButterfly）或直接点击蝴蝶
   * - 反馈：飞走动画 + 进背包（蝴蝶标本，不可售纪念物）+ 浮字
   * - 防重复：captured 标记
   * - 不与剧情对白冲突：StoryDialogue isOpen 守卫
   */
  private tryCatchButterfly(b: Phaser.GameObjects.Container): void {
    if (b.getData('captured')) return;
    if (this.storyDialogue?.isOpen()) return;
    b.setData('captured', true);
    this.tweens.killTweensOf(b);
    this.tweens.add({
      targets: b,
      y: b.y - 50,
      alpha: 0,
      duration: 600,
      ease: 'Sine.In',
      onComplete: () => b.setVisible(false),
    });
    // 捕虫「自然记录」收敛：青禾凤蝶是"有故事的虫"（叙事工具，非稀有掉落）——捕捉得普通标本
    const t = b.getData('type');
    if (t === 'willow') {
      // 第一章 v0.11 图鉴墙：柳叶蝶（河边柳树下，白天）→ 柳叶蝶标本（不可售纪念物）
      addItem('willow_specimen', 1);
      play('ui_confirm');
      showMemoryMoment('柳叶蝶，贴着河面的风飞。翅膀绿得像刚抽芽的柳叶。');
    } else if (t === 'moth') {
      // 第一章 v0.11 图鉴墙：夜光蛾（老树旁，夜里）→ 夜光蛾标本（不可售纪念物）
      addItem('moth_specimen', 1);
      play('ui_confirm');
      showMemoryMoment('夜光蛾，白天躲在树影里，天一黑才出来。翅膀上有一点很淡的光。');
    } else {
      addItem('butterfly_specimen', 1);
      play('ui_confirm');
      if (t === 'qinghe') {
        // 第一段「捉虫引导」：第一次奖励不是金币，而是一句世界观描述（建立"这里的东西都有故事"）
        showMemoryMoment('青禾凤蝶，喜欢停留在花丛附近。小时候，这里经常能看到它。');
        triggerOnce('ch1_qinghe_butterfly_guide', () => { /* 一次性：仅标记，无额外逻辑 */ });
      } else {
        showMemoryMoment('捉到了一只蝴蝶。翅膀薄得能透光。');
      }
    }
  }

  // 第一章 P2「自然记录」第三段昆虫观察（2026-08-13）：小梅递放大镜，玩家逐项观察青禾凤蝶 3 特点。
  // 需背包有青禾凤蝶标本（butterfly_specimen）且未解锁 ch1_natural_record_1；一次性。
  // 第一章 v0.11 图鉴墙（2026-08-14）：扩展为按标本种类观察——凤蝶（1/10）→ 柳叶蝶（2/10）→ 夜光蛾（3/10）。
  private xiaomeiObserveSeen: boolean[] = [false, false, false];
  private xiaomeiObserveKind: 'qinghe' | 'willow' | 'moth' = 'qinghe';

  /** 青禾凤蝶观察（原有入口，保持与冻结探针一致） */
  private tryXiaomeiObserve(): void {
    this.tryXiaomeiObserveKind('qinghe');
  }

  /** 第一章 v0.11：柳叶蝶观察（第二条自然记录） */
  private tryXiaomeiObserveWillow(): void {
    this.tryXiaomeiObserveKind('willow');
  }

  /** 第一章 v0.11：夜光蛾观察（第三条自然记录） */
  private tryXiaomeiObserveMoth(): void {
    this.tryXiaomeiObserveKind('moth');
  }

  private tryXiaomeiObserveKind(kind: 'qinghe' | 'willow' | 'moth'): void {

    this.xiaomeiObserveKind = kind;
    this.xiaomeiObserveSeen = [false, false, false];
    const intro = kind === 'qinghe'
      ? XIAOMEI_OBSERVE_INTRO_DIALOGUE
      : kind === 'willow'
        ? XIAOMEI_OBSERVE_WILLOW_INTRO_DIALOGUE
        : XIAOMEI_OBSERVE_MOTH_INTRO_DIALOGUE;
    this.playStory(intro, () => {
      this.playXiaomeiObserveChoices();
    });
  }

  /** 选手一个特点后，若三项未集齐则继续进入下一轮选项；集齐则填自然笔记 + 收束 */
  private playXiaomeiObserveChoices(): void {

    this.playStory(XIAOMEI_OBSERVE_CHOICES_DIALOGUE, () => {
      this.updateHUD();
    }, (index: number) => {
      if (index >= 0 && index < 3) {
        this.xiaomeiObserveSeen[index] = true;
        const kind = this.xiaomeiObserveKind;
        const detail = kind === 'qinghe'
          ? XIAOMEI_OBSERVE_DETAIL_DIALOGUE
          : kind === 'willow'
            ? XIAOMEI_OBSERVE_WILLOW_DETAIL_DIALOGUE
            : XIAOMEI_OBSERVE_MOTH_DETAIL_DIALOGUE;
        this.storyDialogue!.play(detail[index], () => {
          if (this.xiaomeiObserveSeen.every(Boolean)) {
            // 三项观察完成 → 填自然笔记 + 一次性解锁对应自然记录
            this.finishXiaomeiObserve();
          } else {
            // 未集齐 → 继续下一轮观察
            this.playXiaomeiObserveChoices();
          }
        });
      }
    });
  }

  /** 填自然笔记收束：按虫种解锁 1/10 凤蝶 · 2/10 柳叶蝶 · 3/10 夜光蛾（各自一次性） */
  private finishXiaomeiObserve(): void {
    const kind = this.xiaomeiObserveKind;
    if (kind === 'qinghe') {
      triggerOnce('ch1_natural_record_1', () => {
        this.storyDialogue!.play(XIAOMEI_OBSERVE_DONE_DIALOGUE, () => {
          showMemoryMoment('青禾镇自然记录 1/10 · 青禾凤蝶');
          this.buildInsectWall();
          this.updateHUD();
        });
      });
    } else if (kind === 'willow') {
      triggerOnce('ch1_natural_record_2', () => {
        this.storyDialogue!.play(XIAOMEI_OBSERVE_WILLOW_DONE_DIALOGUE, () => {
          showMemoryMoment('青禾镇自然记录 2/10 · 柳叶蝶');
          this.buildInsectWall();
          this.updateHUD();
        });
      });
    } else {
      triggerOnce('ch1_natural_record_3', () => {
        this.storyDialogue!.play(XIAOMEI_OBSERVE_MOTH_DONE_DIALOGUE, () => {
          showMemoryMoment('青禾镇自然记录 3/10 · 夜光蛾');
          this.buildInsectWall();
          this.updateHUD();
        });
      });
    }
  }

  /** 捕虫玩法 V0.1：tryInteract 入口分支——玩家靠近未捕捉的蝴蝶时按 E 捕捉（半径 24px） */
  private tryCatchNearestButterfly(): boolean {
    for (const b of this.catchableButterflies) {
      if (b.getData('captured')) continue;
      if (!b.visible) continue;
      const dx = this.player.x - b.x;
      const dy = this.player.y - b.y;
      if (dx * dx + dy * dy < R2(24)) {
        this.tryCatchButterfly(b);
        return true;
      }
    }
    return false;
  }

  /**
   * 捕虫玩法 V0.1：town 蝴蝶生成（白天 06-18 时，2 只）。
   * 位置避开 NPC 区（col12-18 rows8-12）/ 出口 / 碰撞；夜间不出现（与萤火虫错开）。
   */
  private spawnTownButterflies(): void {
    if (this.mapKey !== 'town') return;
    const t = getTime();
    if (t.hour < 6 || t.hour >= 18) return;
    const T = TILE_SIZE;
    // 左下草丛 (11,15) + 右侧广场南 (28,16)，均避开 NPC 区与出口（捕虫 V0.2：固定花色）
    this.createButterfly(11 * T + T / 2, 15 * T + T / 2, { type: 'white' });
    this.createButterfly(28 * T + T / 2, 16 * T + T / 2, { type: 'yellow' });
    // 第一章 v0.11 图鉴墙：河边柳树下 (6,16) 柳叶蝶（白天；河畔空地，避开长椅与出口）
    this.createButterfly(6 * T + T / 2, 16 * T + T / 2, { type: 'willow' });
  }

  /**
   * 捕虫玩法 v0.11（2026-08-14）：森林夜光蛾（夜间 18-06 时，老树旁 1 只）。
   * 位置 (7,7) 避开老树树体（(8,8) 树冠向上延伸）与星之碎片交互区；白天不出现（与蝴蝶错开时段）。
   */
  private spawnForestMoths(): void {
    if (this.mapKey !== 'forest') return;
    const t = getTime();
    if (t.hour >= 6 && t.hour < 18) return;
    const T = TILE_SIZE;
    this.createButterfly(7 * T + T / 2, 7 * T + T / 2, { type: 'moth' });
  }

  /**
   * 捕虫玩法 V0.1：跨天刷新——销毁当前场景所有可捕捉蝴蝶并重建（次日刷新）。
   * 仅刷新当前场景；其他场景下次 create 会自然重建。
   */
  private refreshButterfliesNextDay(): void {
    for (const b of this.catchableButterflies) {
      b.destroy();
    }
    this.catchableButterflies = [];
    if (this.mapKey === 'farm' && this.gardenRestore) {
      this.gardenRestore.butterflies = [];
      if (isRestored('garden')) {
        const T = TILE_SIZE;
        this.createButterfly(29 * T + T / 2, 4 * T + T / 2, { type: 'yellow' });
        this.createButterfly(31 * T + T / 2, 6 * T + T / 2, { type: 'blue' });
        this.createButterfly(30 * T + T / 2, 5 * T + T / 2, { type: 'qinghe' });
      }
    }
    if (this.mapKey === 'town') {
      this.spawnTownButterflies();
    }
    if (this.mapKey === 'forest') {
      this.spawnForestMoths();
    }
  }

  /** 与旧花园交互：未恢复时靠近按 E，三阶段清理推进（0→1 倒木 →2 破花架 →3 花丛） */
  private tryGardenRestoreInteract(): boolean {
    const g = this.gardenRestore;
    if (!g || g.stage >= 3) return false;
    const dx = this.player.x - g.pos.x;
    const dy = this.player.y - g.pos.y;
    if (dx * dx + dy * dy > 34 * 34) return false;

    const next = g.stage + 1;
    const msgs = [
      '这里乱糟糟的……像是很久没人打理了。',
      '把破花架也收拾一下吧。',
      '重新翻土，种上花。',
    ];
    this.showDialogueText(msgs[next - 1]);
    g.debris[next - 1]?.destroy();
    g.stage = next;
    if (next === 3) {
      this.buildGardenRestored();
      markRestored('garden');
      triggerTag('restore_garden');
      // 声音补全 v1.0（2026-08-09）：修复成功——"岛屿正在恢复"的成就感
      play('repair_complete');
      // 归星录·相簿：完成「整理旧花园」→ 解锁《夏日花园》（幂等）
      if (!isPhotoUnlocked('summer_garden')) {
        unlockPhoto('summer_garden');
        this.notifyPhotoUnlocked('summer_garden');
      }
      // 里程碑入档：恢复完成后立即保存（刷新/重进保持恢复态）
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      } as any);
      setTimeout(() => showMemoryMoment('爷爷曾经走过的路，今天又有人继续走下去了。'), 1400);
      // M1-3 夏雅见证：恢复完成的瞬间，夏雅走到花园旁（无需等待特定时段）
      this.spawnGardenXiya();
      // FEATURE-036：恢复完成的瞬间，花园旁出现旧农业机器人（可立即修复获得）
      this.setupOldRobot();
    }
    return true;
  }

  // ============ FEATURE-037 老屋修复（farm 左下角木屋） ============

  /**
   * 初始化老屋修复点（farm 左下角木屋 cols 3-8 / rows 19-23，主角家=爷爷留下的老屋）。
   * 交互锚点选木屋右侧空地（col 11, row 20），避开左下 house 出口（col 5-7, rows 18-20）。
   * 恢复前：屋顶破洞/外墙裂缝/门前杂草（Graphics）
   * 恢复后：破旧清除 → 红灯笼 ×2 / 炊烟 / 门牌 / 门前花
   * 状态持久化：FarmRestore.isRestored('oldHouse')，刷新/重进保持恢复态。
   */
  private setupOldHouseRestore(): void {
    if (this.mapKey !== 'farm') return;
    const T = TILE_SIZE;
    const restored = isRestored('oldHouse');
    this.oldHouseRestore = {
      restored,
      debris: [],
      mark: null,
      pos: { x: 11 * T + T / 2, y: 20 * T + T / 2 },
    };
    if (restored) {
      this.buildOldHouseRestored();
    } else {
      this.buildOldHouseRuined();
    }
  }

  /** 恢复前视觉（v4 2D 门脸）：像一张房子正面图整体上移——三角破屋顶 + 墙 + 封板门 + 裂纹窗，玩家在门前走 */
  private buildOldHouseRuined(): void {
    const g = this.oldHouseRestore;
    if (!g) return;
    const debris: Phaser.GameObjects.Graphics[] = [];
    const add = (o: Phaser.GameObjects.Graphics): void => { debris.push(o); };
    // 屋顶（2D 三角坡顶，rows 14-17；深度 4，玩家始终在其前方可见）
    const roof = this.add.graphics();
    roof.fillStyle(0x5e3a26, 1);
    roof.fillTriangle(44, 280, 148, 280, 96, 226);
    roof.fillStyle(0x422818, 1);
    roof.fillTriangle(44, 280, 148, 280, 96, 284);  // 屋檐底沿
    roof.fillStyle(0x52331e, 1);
    roof.fillRect(90, 220, 12, 8);                   // 残破屋脊
    roof.lineStyle(1, 0x402818, 0.8);
    roof.lineBetween(54, 262, 138, 262);
    roof.lineBetween(64, 248, 128, 248);
    // 破洞（缺瓦 + 内黑影 + 断椽）
    roof.fillStyle(0x241812, 1);
    roof.fillTriangle(72, 268, 100, 268, 86, 246);
    roof.lineStyle(1, 0x1a100c, 1);
    roof.lineBetween(76, 266, 84, 254);
    roof.lineBetween(96, 266, 90, 256);
    roof.setDepth(4);
    add(roof);
    // 地面投影（让破房子也"落在地上"）
    const groundShadow = this.add.graphics();
    groundShadow.fillStyle(0x1a1a22, 0.12);
    groundShadow.fillEllipse(96, 324, 112, 22);
    groundShadow.setDepth(3);
    add(groundShadow);
    // 墙（rows 17-20，暗木 + 板缝）
    const wall = this.add.graphics();
    wall.fillStyle(0x6a5236, 1);
    wall.fillRect(48, 276, 96, 40);
    wall.lineStyle(1, 0x4a3a24, 0.8);
    wall.lineBetween(48, 288, 144, 288);
    wall.lineBetween(48, 300, 144, 300);
    wall.setDepth(4);
    add(wall);
    // 屋檐下暗影带（屋顶压墙的厚度感）
    const eaveShadow = this.add.graphics();
    eaveShadow.fillStyle(0x241812, 0.16);
    eaveShadow.fillRect(48, 280, 96, 6);
    eaveShadow.setDepth(4);
    add(eaveShadow);
    // 窗（墙上左右，暗 + 裂纹）
    const win = (x: number): void => {
      const w = this.add.graphics();
      w.fillStyle(0x3a3026, 1);
      w.fillRect(x - 9, 280, 18, 14);
      w.lineStyle(1, 0x564a3a, 1);
      w.strokeRect(x - 8, 281, 16, 12);
      w.lineBetween(x, 281, x, 293);
      w.lineStyle(1, 0x2c241a, 1);
      w.lineBetween(x - 3, 286, x + 3, 292);
      w.setDepth(4);
      add(w);
    };
    win(64);
    win(128);
    // 门（col 6 门口，钉板封死）
    const door = this.add.graphics();
    door.fillStyle(0x4e3824, 1);
    door.fillRect(86, 294, 20, 24);
    door.fillStyle(0x6e5236, 1);
    door.fillRect(88, 296, 16, 20);
    door.lineStyle(1, 0x4e3824, 1);
    door.lineBetween(88, 301, 104, 301);
    door.lineBetween(88, 307, 104, 307);
    door.lineBetween(88, 313, 104, 313);
    door.setDepth(4);
    add(door);
    // 基础（row 20）
    const base = this.add.graphics();
    base.fillStyle(0x4a3a28, 1);
    base.fillRect(48, 312, 96, 8);
    base.setDepth(4);
    add(base);
    // 门前杂草
    const weeds = this.add.graphics();
    weeds.fillStyle(0x8aaa58, 1);
    for (let i = 0; i < 5; i++) weeds.fillRect(106 + i * 4, 310, 1, 3 + (i % 3) * 2);
    weeds.setDepth(4);
    add(weeds);
    g.debris = debris;
    g.mark = this.add.text(g.pos.x, g.pos.y - 10, '老屋', {
      fontFamily: 'Arial', fontSize: '10px', color: '#e8d8a8',
    }).setOrigin(0.5).setDepth(4);
  }

  /** 恢复后视觉（v4 2D 门脸）：像一张房子正面图整体上移——三角坡顶 + 墙 + 门 + 暖光窗，
   *  门口在下方，玩家始终在房子前方走（不被盖住），可从门口进出。 */
  private buildOldHouseRestored(): void {
    const g = this.oldHouseRestore;
    if (!g) return;
    for (const d of g.debris) d.destroy();
    g.debris = [];
    if (g.mark) { g.mark.destroy(); g.mark = null; }
    const decor: Phaser.GameObjects.Graphics[] = [];
    const add = (o: Phaser.GameObjects.Graphics): void => { decor.push(o); };
    // 屋顶（2D 三角坡顶，rows 14-17；深度 4，玩家始终在其前方可见）
    const roof = this.add.graphics();
    roof.fillStyle(0xa0603e, 1);
    roof.fillTriangle(44, 280, 148, 280, 96, 226);
    roof.fillStyle(0x7a4a2e, 1);
    roof.fillTriangle(44, 280, 148, 280, 96, 284);  // 屋檐底沿
    roof.fillStyle(0xb88058, 1);
    roof.fillRect(90, 220, 12, 8);                   // 屋脊盖
    roof.lineStyle(1, 0x6e3e26, 0.8);
    roof.lineBetween(54, 264, 138, 264);
    roof.lineBetween(64, 250, 128, 250);
    roof.lineBetween(74, 238, 118, 238);
    roof.setDepth(4);
    add(roof);
    // 地面投影（让房子落在地上，不飘）
    const groundShadow = this.add.graphics();
    groundShadow.fillStyle(0x1a1a22, 0.11);
    groundShadow.fillEllipse(96, 324, 112, 22);
    groundShadow.setDepth(3);
    add(groundShadow);
    // 烟囱 + 炊烟（右坡面上，烟往上飘）
    const chimney = this.add.graphics();
    chimney.fillStyle(0xb88060, 1);
    chimney.fillRect(118, 230, 8, 26);
    chimney.fillStyle(0x96684c, 1);
    chimney.fillRect(116, 228, 12, 4);
    chimney.setDepth(4);
    add(chimney);
    const smoke = this.add.graphics();
    smoke.fillStyle(0xcfcbc4, 0.85);
    smoke.fillCircle(0, -14, 3);
    smoke.fillCircle(4, -8, 2.5);
    smoke.fillCircle(-3, -3, 2);
    smoke.setPosition(122, 224);
    smoke.setDepth(4);
    this.tweens.add({
      targets: smoke,
      y: smoke.y - 10,
      alpha: { from: 0.9, to: 0 },
      duration: 2200,
      repeat: -1,
      ease: 'Sine.Out',
    });
    add(smoke);
    // 墙（rows 17-20，暖木 + 板缝）
    const wall = this.add.graphics();
    wall.fillStyle(0x9a7848, 1);
    wall.fillRect(48, 276, 96, 40);
    wall.lineStyle(1, 0x6e5234, 0.7);
    wall.lineBetween(48, 288, 144, 288);
    wall.lineBetween(48, 300, 144, 300);
    wall.setDepth(4);
    add(wall);
    // 屋檐下暗影带（屋顶压墙的厚度感）
    const eaveShadow = this.add.graphics();
    eaveShadow.fillStyle(0x3a2416, 0.15);
    eaveShadow.fillRect(48, 280, 96, 6);
    eaveShadow.setDepth(4);
    add(eaveShadow);
    // 窗（墙上左右，暖光）
    const win = (x: number): void => {
      const w = this.add.graphics();
      w.fillStyle(0x5e3c22, 1);
      w.fillRect(x - 10, 279, 20, 16);
      w.fillStyle(0xffe8a0, 1);
      w.fillRect(x - 8, 281, 16, 12);
      w.lineStyle(1, 0x4a2c18, 1);
      w.strokeRect(x - 8, 281, 16, 12);
      w.lineBetween(x, 281, x, 293);
      w.setDepth(4);
      add(w);
    };
    win(64);
    win(128);
    // 门（col 6 门口）：门框 + 木门 + 门顶 + 把手
    const door = this.add.graphics();
    door.fillStyle(0xa87c4c, 1);
    door.fillRect(86, 294, 20, 24);
    door.fillStyle(0xe0bc78, 1);
    door.fillRect(88, 296, 16, 20);
    door.fillStyle(0xc89a60, 1);
    door.fillRect(88, 296, 16, 3);
    door.lineStyle(1, 0x8a6038, 0.8);
    door.lineBetween(90, 306, 102, 306);
    door.fillStyle(0x8a6a40, 1);
    door.fillCircle(101, 305, 1.2);
    door.setDepth(4);
    add(door);
    // 基础（row 20）
    const base = this.add.graphics();
    base.fillStyle(0x6a4e30, 1);
    base.fillRect(48, 312, 96, 8);
    base.setDepth(4);
    add(base);
    // 灯笼 ×2（门两侧墙上）
    const lantern = (x: number, y: number): void => {
      const l = this.add.graphics();
      l.fillStyle(0xe04a36, 1);
      l.fillRoundedRect(-2, -4, 4, 8, 2);
      l.fillStyle(0xffe088, 1);
      l.fillCircle(0, 0, 1.2);
      l.fillRect(-1, -6, 2, 2);
      l.setPosition(x, y);
      l.setDepth(4);
      add(l);
    };
    lantern(76, 296);
    lantern(116, 296);
    // 门牌（门上方墙上）
    this.add.text(96, 290, '归星小屋', {
      fontFamily: 'Arial', fontSize: '10px', color: '#f4e3c1',
      backgroundColor: '#6a4a2a', padding: { x: 4, y: 1 },
    }).setOrigin(0.5).setDepth(5);
    // 门前花：门旁地上
    const flower = this.add.graphics();
    flower.fillStyle(0xffb098, 1);
    flower.fillCircle(0, 0, 2);
    flower.fillStyle(0xffe088, 1);
    flower.fillCircle(0, 0, 1);
    flower.setPosition(106, 318);
    flower.setDepth(4);
    add(flower);
    g.debris = decor;
  }

  // ═══════════════════════════════════════════════════════════
  // 邮箱系统（2026-08-15 制作人拍板）
  // 定位：不是消息中心——信是"玩家做完事以后，NPC 告诉他'我看见了'"。
  // 解锁：grandpa_gift_opened（收到爷爷的信）→ farm 老屋门口东侧出现信箱。
  // 节奏：2-3 游戏日一封（随机不固定）；世界事件信插队；未读最多积累 6 封。
  // ═══════════════════════════════════════════════════════════

  /** 邮箱本体（farm 老屋门口东侧空地 (9,18)，距修复锚点 45px 无交互冲突） */
  private setupMailbox(): void {
    if (this.mapKey !== 'farm') return;
    if (!hasTriggered('grandpa_gift_opened')) return; // 收到爷爷的信后解锁
    const T = TILE_SIZE;
    this.mailboxPos = { x: 9 * T + T / 2, y: 18 * T + T / 2 };
    // 首次解锁：队列放入爷爷首封（必达），设定下次来信日（2-3 天随机）
    if (!this.mailUnlocked) {
      this.mailUnlocked = true;
      this.mailQueue = ['grandpa_first'];
      this.mailLastDay = getTime().day;
      this.mailNextDay = getTime().day + 2 + Math.floor(Math.random() * 2);
      save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    }
    const box = this.add.container(this.mailboxPos.x, this.mailboxPos.y).setDepth(4);
    // 木柱 + 箱体（投信口）
    const post = this.add.graphics();
    post.fillStyle(0x6a4a2a, 1); post.fillRect(-3, 2, 6, 22);
    post.fillStyle(0x8a6a42, 1); post.fillRect(-3, 2, 2, 22);
    const body = this.add.graphics();
    body.fillStyle(0x7a5a34, 1); body.fillRect(-14, -12, 28, 18);
    body.fillStyle(0x9a7a4a, 1); body.fillRect(-14, -12, 28, 3);
    body.fillStyle(0x3a2a18, 1); body.fillRect(-14, 2, 28, 3);
    body.fillStyle(0x6e5234, 1); body.fillRect(-2, -8, 2, 12);
    box.add([post, body]);
    // 未读小旗（有信时立起）
    const flag = this.add.graphics();
    flag.fillStyle(0xcf3a2a, 1); flag.fillRect(8, -14, 13, 2);
    flag.fillStyle(0xe04a36, 1); flag.fillTriangle(8, -14, 21, -11, 8, -7);
    box.add(flag);
    // 呼吸光点（吸引注意，参照音乐盒/包裹）
    const glow = this.add.ellipse(0, -2, 22, 16, 0xffd98a, 0.14);
    box.add(glow);
    this.tweens.add({ targets: glow, alpha: { from: 0.1, to: 0.3 }, duration: 1100, yoyo: true, repeat: -1 });
    this.mailboxGfx = box;
    // 回家时推进来信队列（补发积累的信）
    this.updateMailQueue();
    this.refreshMailboxFlag();
  }

  /** 来信队列推进：世界事件信插队 → 爷爷首封补位 → 定时生活信（2-3 天随机，未读上限 6） */
  private updateMailQueue(): void {
    if (!this.mailUnlocked) return;
    let changed = false;
    let guard = 0;
    while (guard++ < 6) {
      if (this.mailQueue.length >= 6) break;
      const worldId = this.pickPendingWorldLetter();
      if (worldId) {
        this.mailQueue.push(worldId);
        changed = true;
        this.mailLastDay = getTime().day;
        this.mailNextDay = getTime().day + 2 + Math.floor(Math.random() * 2);
        continue;
      }
      if (!this.mailRead.includes('grandpa_first') && !this.mailQueue.includes('grandpa_first')) {
        this.mailQueue.unshift('grandpa_first');
        changed = true;
        this.mailLastDay = getTime().day;
        this.mailNextDay = getTime().day + 2 + Math.floor(Math.random() * 2);
        continue;
      }
      if (getTime().day < this.mailNextDay) break;
      const lifeId = this.pickPendingLifeLetter();
      if (lifeId) {
        this.mailQueue.push(lifeId);
        changed = true;
        this.mailLastDay = getTime().day;
        this.mailNextDay = getTime().day + 2 + Math.floor(Math.random() * 2);
      } else {
        break;
      }
    }
    if (changed) {
      this.refreshMailboxFlag();
      save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
    }
  }

  /** 世界事件信（各 1 封，按优先级：老屋→集市→放生→番茄架→艺术展余波） */
  private pickPendingWorldLetter(): string | null {
    const rules: Array<{ id: string; ready: () => boolean }> = [
      { id: 'laozhou_oldhouse', ready: () => isRestored('oldHouse') },
      { id: 'elder_market', ready: () => isRestored('marketSquare') },
      { id: 'laojiang_release', ready: () => this.fishReleaseDay >= 0 },
      { id: 'xiya_tomato', ready: () => hasTriggered('crop_tomato_xiya_seen') },
      { id: 'traveler_artshow', ready: () => this.artShowHeld },
    ];
    for (const r of rules) {
      if (r.ready() && !this.mailQueue.includes(r.id) && !this.mailRead.includes(r.id)) return r.id;
    }
    return null;
  }

  /** 普通生活信（未读未排中随机一封） */
  private pickPendingLifeLetter(): string | null {
    const pending = MAIL_LETTERS.filter(
      (l) => l.type === 'life' && !this.mailQueue.includes(l.id) && !this.mailRead.includes(l.id),
    );
    if (pending.length === 0) return null;
    return pending[Math.floor(Math.random() * pending.length)].id;
  }

  /** 小旗显隐（有未读立起） */
  private refreshMailboxFlag(): void {
    if (!this.mailboxGfx) return;
    const flag = this.mailboxGfx.getAt(2) as Phaser.GameObjects.Graphics | null;
    if (flag) flag.setVisible(this.mailQueue.length > 0);
  }

  /** 邮箱交互：首次打开走爷爷首封演出，之后进列表 */
  private tryMailboxInteract(): boolean {
    if (!this.mailboxGfx || !this.mailUnlocked) return false;
    if (!this.mailboxGfx.visible) return false;
    const dx = this.player.x - this.mailboxPos.x;
    const dy = this.player.y - this.mailboxPos.y;
    if (dx * dx + dy * dy > 34 * 34) return false;
    if (this.storyDialogue?.isOpen()) return false;
    if (isMailboxPanelOpen()) return false;
    this.inputManager.clearAction();
    // 首次：信箱里的第一封信（爷爷）——唯一演出
    if (this.mailQueue.includes('grandpa_first') && !this.mailRead.includes('grandpa_first')) {
      const letter = getMailLetter('grandpa_first');
      if (letter) {
        showFirstMailLetter(letter, () => {
          this.markMailRead('grandpa_first');
          this.openMailboxPanel();
        });
        return true;
      }
    }
    this.openMailboxPanel();
    return true;
  }

  /** 标记已读：移出队列 + 入归档 + 存档 */
  private markMailRead(id: string): void {
    if (!this.mailRead.includes(id)) this.mailRead.push(id);
    this.mailQueue = this.mailQueue.filter((q) => q !== id);
    this.refreshMailboxFlag();
    this.saveAtPlayer(); // BUG-FIX（B3/B4）：异步入口（信件回调）统一走守卫入口
  }

  /** 打开邮箱面板（未读列表 + 已读归档） */
  private openMailboxPanel(): void {
    const unread = this.mailQueue.map((id) => getMailLetter(id)).filter((l): l is MailLetter => !!l);
    const read = this.mailRead.map((id) => getMailLetter(id)).filter((l): l is MailLetter => !!l);
    openMailbox({
      unread,
      read,
      onRead: (id: string) => this.markMailRead(id),
      onClose: () => { /* 存档已由 markMailRead 处理 */ },
    });
  }

  /**
   * 资源快速置换（2026-08-11 制作人拍板）：建设/交付资源不足时，若金币足以按商店价补齐缺失
   * 木材/石头，弹选项「用金币一键补齐（X G）」/「先不买」；购买成功由 onBuy 执行完成逻辑。
   * 金币不足补齐全部 → 不弹选项，维持原有不足提示。
   */
  private offerQuickBuy(opts: {
    shortfallText: string;
    cost: number | null;
    onBuy: () => void;
  }): void {
    if (opts.cost === null) {
      this.showDialogueText(opts.shortfallText);
      return;
    }

    this.playStory(
      [
        {
          speaker: '',
          color: COLORS.system,
          text: opts.shortfallText,
          options: [`用金币一键补齐（${opts.cost} G）`, '先不买'],
        },
      ],
      () => this.updateHUD(),
      (index: number) => {
        if (index === 0 && opts.cost !== null) {
          if (spendCoins(opts.cost)) {
            opts.onBuy();
          } else {
            this.showDialogueText('金币不够……先去卖掉一些收获吧。');
          }
        }
      },
    );
  }

  /**
   * 与老屋交互：未恢复时靠近按 E → 检查资源（木头×30 石头×20 金币×100）→
   * 资源不足提示缺什么；足够则扣除 → markRestored('oldHouse') → 外观替换 → 存档。
   */
  private tryOldHouseRestoreInteract(): boolean {
    const g = this.oldHouseRestore;
    if (!g || g.restored) return false;
    const dx = this.player.x - g.pos.x;
    const dy = this.player.y - g.pos.y;
    if (dx * dx + dy * dy > 34 * 34) return false;

    const missing = getProjectShortfall('oldHouse', {
      wood: getItemCount('wood'),
      stone: getItemCount('stone'),
      gold: getCoins(),
    });
    if (missing.length > 0) {
      const cost = getQuickBuyCost('oldHouse', {
        wood: getItemCount('wood'),
        stone: getItemCount('stone'),
        gold: getCoins(),
      });
      this.offerQuickBuy({
        shortfallText: `老屋破损严重，还缺：${missing.join('、')}。`,
        cost,
        onBuy: () => {
          const needWood = 30 - getItemCount('wood');
          if (needWood > 0) addItem('wood', needWood);
          const needStone = 20 - getItemCount('stone');
          if (needStone > 0) addItem('stone', needStone);
          this.tryOldHouseRestoreComplete();
        },
      });
      return true;
    }
    this.tryOldHouseRestoreComplete();
    return true;
  }

  /** 老屋修复完成逻辑（资源已足够/一键补齐后） */
  private tryOldHouseRestoreComplete(): void {
    addItem('wood', -30);
    addItem('stone', -20);
    spendCoins(100);
    markRestored('oldHouse');
    const g = this.oldHouseRestore;
    if (g) g.restored = true;
    // 声音补全 v1.0（2026-08-09）：修复成功——老屋恢复的成就感
    play('repair_complete');
    // FEATURE-041：老屋修复完成 → 归星记录「修复老屋」（木匠回归判定的状态条件之一）
    triggerTag('restore_oldhouse');
    this.buildOldHouseRestored();
    // 里程碑入档：完成后立即保存（刷新/重进保持恢复态）
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    this.updateHUD();
    // FEATURE-037 统一对白批次 environment_restore_v010：老屋完成 → 镇长（单次触发）

    this.playStory(OLD_HOUSE_RESTORED_DIALOGUE, () => {
      // L3 重要事件记忆卡（反馈层级 L3）：复兴事件·老屋修复完成——"你改变了什么"
      setTimeout(() => showStoryComplete('老屋复原', '这座岛，开始像家了。'), 1600);
    });
  }

  // ============ 第一章 P2-1 集市广场恢复（town 中央偏北，Sprint 3） ============

  /**
   * 集市广场恢复点（town 中央偏北 cols 18-32 / rows 2-7，制作人 2026-08-12 Sprint 3 拍板）。
   * 叙事定位：集市=玩家第一次亲手让青禾镇恢复生活的证明（村长来访 ch1_elder_visit 后解锁）。
   * 解锁条件：chapter >= 1 && hasTriggered('ch1_elder_visit')（村长邀请过 → 玩家知道"为什么修"）。
   * 恢复模式：一次资源交付（木材×25 + 石头×15 + 金币×80，FarmRestore RESTORE_PROJECTS.marketSquare）
   * 三通道反馈：地图（荒地→摊位+灯光）→ NPC 对白变化 → 存档（worldRestore.marketSquare）。
   * 零新系统：复用 FarmRestore / EventManager / 演出范式；纯 Graphics 零新素材。
   */
  private setupMarketSquare(): void {
    if (this.mapKey !== 'town') return;
    const T = TILE_SIZE;
    // 集市解锁：村长来访后（未解锁时完全不出现，避免"任务提前投放"）
    const unlocked = isChapterAtLeast(CHAPTER_1) && hasTriggered('ch1_elder_visit');
    const restored = isRestored('marketSquare');
    const cleared = hasTriggered('ch1_market_cleared');
    // 布置态：已清理但未开张（或已开张但需重建已放摊位）
    const placed = [1, 2, 3].map((i) => hasTriggered(`ch1_market_stall_${i}`));
    if (!unlocked && !restored) {
      this.marketSquareRestore = null;
      return;
    }
    this.marketSquareRestore = {
      restored,
      cleared,
      debris: [],
      mark: null,
      // 区域中心（col 25, row 4.5）：中央偏北空白区，避开 NPC/商店/需求板/出口
      pos: { x: 25 * T + T / 2, y: 4.5 * T + T / 2 },
      // Phase 2 布置点：索引 0=工具摊 1=小吃摊 2=花摊（对应 MARKET_STALL_*_DIALOGUES 下标）
      // 工具摊靠路边（左）、小吃摊中间聚人气（下中）、花摊放老树旁（右）
      arrangeSpots: [
        { type: 'tool', x: 25 * T - 6 * T + T / 2, y: 4.5 * T + T / 2, mark: null, placed: false },
        { type: 'food', x: 25 * T + T / 2, y: 4.5 * T + 2.5 * T + T / 2, mark: null, placed: false },
        { type: 'flower', x: 25 * T + 6 * T + T / 2, y: 4.5 * T + T / 2, mark: null, placed: false },
      ],
    };
    if (restored) {
      this.buildMarketSquareRestored();
    } else if (cleared) {
      this.buildMarketSquareCleared();
      // 重建已摆放的摊位（读档/重进保持布置进度）
      placed.forEach((p, i) => {
        if (p) this.placeMarketStall(i);
      });
    } else {
      this.buildMarketSquareRuined();
    }
  }

  /** 恢复前视觉：荒废广场（杂草碎石 + 破旧摊位残骸）+ 交互提示标记 */
  private buildMarketSquareRuined(): void {
    const g = this.marketSquareRestore;
    if (!g) return;
    const T = TILE_SIZE;
    // 荒土（gid 2）铺底：cols 18-32, rows 2-7（当前全草地 gid1）
    for (let r = 2; r <= 7; r++) {
      for (let c = 18; c <= 32; c++) {
        this.groundLayer.putTileAt(2, c, r);
      }
    }
    // 组1 碎石堆：灰圆点 ×5（广场中心乱石）
    const rocks = this.add.graphics();
    rocks.fillStyle(0x8a8a92, 1);
    rocks.fillCircle(-16, 0, 3);
    rocks.fillCircle(8, 4, 2.5);
    rocks.fillCircle(22, -2, 3.5);
    rocks.fillCircle(-4, -8, 2);
    rocks.fillCircle(16, 8, 2.5);
    rocks.setPosition(g.pos.x, g.pos.y);
    rocks.setDepth(3);
    // 组2 破旧摊位残骸：歪斜木架 + 断布（左一摊）
    const stall = this.add.graphics();
    stall.fillStyle(0x8d6e4a, 1);
    stall.fillRect(-2, -10, 2, 16);   // 立杆
    stall.fillRect(10, -8, 2, 14);    // 立杆
    stall.fillRect(-2, -10, 14, 2);   // 横梁
    stall.fillStyle(0x9a8a7a, 0.7);
    stall.fillRect(-2, -9, 12, 2);    // 破布垂下
    stall.setPosition(g.pos.x - 14 * T, g.pos.y + 2 * T);
    stall.setRotation(0.18);
    stall.setDepth(3);
    // 组3 荒草：绿色短线 ×6（摊位周围）
    const weeds = this.add.graphics();
    weeds.fillStyle(0x7a9a4a, 1);
    for (let i = 0; i < 6; i++) {
      weeds.fillRect(-20 + i * 8, 4, 1, 3 + (i % 3) * 2);
    }
    weeds.setPosition(g.pos.x + 6 * T, g.pos.y + 3 * T);
    weeds.setDepth(3);
    g.debris = [rocks, stall, weeds];
    // 空角的老树（荒地时仍在，但枯败）："树一直在，等生活回来"——生命感先于功能
    // 位置与恢复后空角一致（pos +5T,+4T），玩家恢复前就能看到这棵树
    const cornerX = g.pos.x + 5 * T;
    const cornerY = g.pos.y + 4 * T;
    const deadTree = this.add.graphics();
    deadTree.fillStyle(0x4a4030, 1);
    deadTree.fillRect(cornerX - 2, cornerY - 2, 4, 9);   // 树干（深、枯）
    deadTree.lineStyle(1.5, 0x4a4030, 1);
    deadTree.lineBetween(cornerX, cornerY - 3, cornerX - 5, cornerY - 9);  // 枯枝
    deadTree.lineBetween(cornerX, cornerY - 3, cornerX + 5, cornerY - 10);
    deadTree.fillStyle(0x7a8a5a, 0.8);
    deadTree.fillCircle(cornerX - 5, cornerY - 10, 3);   // 稀疏叶
    deadTree.fillCircle(cornerX + 5, cornerY - 11, 2.5);
    deadTree.setDepth(3);
    g.debris.push(deadTree);
    // 交互提示标记
    g.mark = this.add.text(g.pos.x, g.pos.y - 12, '集市广场', {
      fontFamily: 'Arial', fontSize: '10px', color: '#e8d8a8',
    }).setOrigin(0.5).setDepth(4);
  }

  /** 恢复后视觉：摊位 + 灯光 + 空地清理（集市=生活重新出现） */
  private buildMarketSquareRestored(): void {
    const g = this.marketSquareRestore;
    if (!g) return;
    const T = TILE_SIZE;
    // 荒地 → 草地（gid 1）：cols 18-32, rows 2-7
    for (let r = 2; r <= 7; r++) {
      for (let c = 18; c <= 32; c++) {
        this.groundLayer.putTileAt(1, c, r);
      }
    }
    // 摊位 ×3：按布置点位置重建（开张态 = 三个摊位都已摆好）
    for (let i = 0; i < 3; i++) this.placeMarketStall(i);
    // 灯光：两盏暖黄挂灯（摊位上方，傍晚/夜间亮起效果）
    const lamp1 = this.add.graphics();
    lamp1.fillStyle(0xffd98a, 0.9);
    lamp1.fillCircle(g.pos.x - 6 * T, g.pos.y - 3 * T, 1.5);
    lamp1.fillStyle(0xffd98a, 0.2);
    lamp1.fillCircle(g.pos.x - 6 * T, g.pos.y - 3 * T, 5);
    lamp1.setDepth(3);
    const lamp2 = this.add.graphics();
    lamp2.fillStyle(0xffd98a, 0.9);
    lamp2.fillCircle(g.pos.x + 6 * T, g.pos.y - 1 * T, 1.5);
    lamp2.fillStyle(0xffd98a, 0.2);
    lamp2.fillCircle(g.pos.x + 6 * T, g.pos.y - 1 * T, 5);
    lamp2.setDepth(3);
    g.debris.push(lamp1, lamp2);
    // 集市空角（2026-08-13 制作人 Phase 2 拍板）：广场东南角留"人停下来聊天"的空间锚点
    // 老树 + 石凳 + 空地 + 小物件——不填满集市，真实集市不是商业展厅
    // 位置：pos 右下（+5T,+4T）≈ (col30,row8)，避开摊位/竖路 col25/出口区
    const cornerX = g.pos.x + 5 * T;
    const cornerY = g.pos.y + 4 * T;
    // 老树（gid16 大树冠 + 深色树干）：空间锚点，未来夏雅聊天/NPC 闲聊/赶集围绕点
    const tree = this.add.graphics();
    tree.fillStyle(0x5a4a34, 1);
    tree.fillRect(cornerX - 2, cornerY - 2, 4, 8);      // 树干
    tree.fillStyle(0x4a8a30, 1);
    tree.fillCircle(cornerX, cornerY - 7, 9);           // 树冠
    tree.fillStyle(0x639922, 0.9);
    tree.fillCircle(cornerX - 4, cornerY - 9, 5);       // 树冠亮面
    tree.setDepth(3);
    // 石凳（老树旁两块圆石）："有人会坐在这里"
    const bench = this.add.graphics();
    bench.fillStyle(0x9a9aa2, 1);
    bench.fillRect(cornerX - 10, cornerY + 4, 6, 3);
    bench.fillRect(cornerX + 4, cornerY + 4, 6, 3);
    bench.fillStyle(0xb8b8c0, 0.8);
    bench.fillRect(cornerX - 8, cornerY + 2, 3, 3);
    bench.fillRect(cornerX + 6, cornerY + 2, 3, 3);
    bench.setDepth(3);
    // 小物件：旧木牌（"谁都可以来坐坐"的乡村感，不写字——留白让玩家想象）
    const sign = this.add.graphics();
    sign.fillStyle(0x8a6a45, 1);
    sign.fillRect(cornerX + 12, cornerY - 8, 2, 12);
    sign.fillRect(cornerX + 8, cornerY - 10, 10, 4);
    sign.fillStyle(0x6e5633, 1);
    sign.fillRect(cornerX + 10, cornerY - 8, 6, 1.5);
    sign.setDepth(3);
    // 空地感：树下留草地（gid1 已铺），石凳旁加一小丛草
    const grassPatch = this.add.graphics();
    grassPatch.fillStyle(0x7a9a4a, 1);
    for (let i = 0; i < 4; i++) {
      grassPatch.fillRect(cornerX - 14 + i * 4, cornerY + 8, 1, 3 + (i % 2) * 2);
    }
    grassPatch.setDepth(3);
    g.debris.push(tree, bench, sign, grassPatch);
    // 集市恢复成功 → 归星记录
    triggerTag('restore_market');
  // 摊主生成（2026-08-14 制作人拍板）：每摊 1 个摊主（老张/小梅/夏雅），走近可对话
  this.spawnMarketStallKeepers();
  // 生命化改造·摊位区（2026-08-14）：摊位生活痕迹（投影/磨损 + 货物堆 + 散落货品）
  this.setupMarketStallLife();
  }

  /** 生命化改造·摊位区：摊位地面痕迹 + 摊位旁货物堆 + 摊位间散落货品。
   *  零素材 Graphics（路线 C）；加入 g.debris 随集市重建清理。 */
  private setupMarketStallLife(): void {
    const g = this.marketSquareRestore;
    if (!g) return;
    const T = TILE_SIZE;
    const traces: { type: MarketStallType; sx: number; sy: number; gx: number; gy: number }[] = [
      { type: 'tool',   sx: 19 * T + 8, sy: 4.5 * T + 8, gx: 20.7 * T, gy: 5.9 * T },
      { type: 'food',   sx: 25 * T + 8, sy: 7 * T + 8,   gx: 24.1 * T, gy: 8.2 * T },
      { type: 'flower', sx: 31 * T + 8, sy: 4.5 * T + 8, gx: 32.3 * T, gy: 5.9 * T },
    ];
    for (const st of traces) {
      // 摊位底部：投影 + 磨损地面（"有人长期在这里摆摊"）
      const ground = this.add.graphics().setDepth(2);
      ground.fillStyle(0x000000, 0.12); ground.fillEllipse(st.sx, st.sy + 8, 30, 8);
      ground.fillStyle(0x4a5a30, 0.18); ground.fillEllipse(st.sx, st.sy + 10, 24, 6);
      g.debris.push(ground);
      // 摊位旁货物堆（摊主对面一侧）
      const goods = this.add.graphics().setDepth(3);
      if (st.type === 'tool') {
        goods.fillStyle(0x7a5a33, 1); goods.fillRect(st.gx - 5, st.gy - 12, 3, 16);  // 锄柄
        goods.fillStyle(0x9a7a4a, 1); goods.fillRect(st.gx - 8, st.gy - 14, 9, 3);   // 锄头
        goods.fillStyle(0x8a6a45, 1); goods.fillRect(st.gx + 2, st.gy - 8, 8, 7);    // 木箱
        goods.fillStyle(0x6e5633, 1); goods.fillRect(st.gx + 3, st.gy - 6, 6, 1);
      } else if (st.type === 'food') {
        goods.fillStyle(0x8a5a33, 1); goods.fillRect(st.gx - 4, st.gy - 6, 8, 3);    // 蒸笼底
        goods.fillStyle(0xa8825a, 1); goods.fillRect(st.gx - 4, st.gy - 9, 8, 3);    // 蒸笼上
        goods.fillStyle(0xd8d0c0, 0.9); goods.fillRect(st.gx + 5, st.gy - 5, 5, 3);  // 碗
        goods.fillStyle(0xd8e8e8, 0.5); goods.fillRect(st.gx - 1, st.gy - 12, 3, 2); // 热气
      } else {
        goods.fillStyle(0xb07040, 1); goods.fillRect(st.gx - 4, st.gy - 5, 8, 5);    // 陶盆
        goods.fillStyle(0x4a8a30, 1); goods.fillRect(st.gx - 3, st.gy - 8, 6, 3);    // 花叶
        goods.fillStyle(0xe060a0, 1); goods.fillRect(st.gx - 1, st.gy - 9, 2, 2);    // 花
        goods.fillStyle(0x6a8a9a, 1); goods.fillRect(st.gx + 6, st.gy - 6, 5, 3);    // 水壶身
        goods.fillStyle(0x9ab8c8, 1); goods.fillRect(st.gx + 10, st.gy - 7, 3, 1);   // 壶嘴
      }
      g.debris.push(goods);
    }
    // 摊位间散落货品（克制：两点）
    const scatter = this.add.graphics().setDepth(3);
    scatter.fillStyle(0xd05040, 0.95); scatter.fillCircle(22.5 * T + 8, 6.2 * T, 1.2);
    scatter.fillStyle(0x5a9a4a, 0.9); scatter.fillCircle(29 * T + 8, 5.5 * T, 1.2);
    g.debris.push(scatter);
  }

  /** 集市开张后生成 3 个摊主（2026-08-14 制作人拍板：摊位旁要有老板，增加活人感/真实感）。
   *  每摊 1 个：工具摊→老张(npc_miner) / 小吃摊→小梅(npc_gardener) / 花摊→夏雅(npc_girl)。
   *  复用现有 NPC 贴图（零新素材），独立于 7 主 NPC 日程；带名字标签 + 走近按 E 摊主闲聊。
   *  幂等：marketStallKeepers 非空则跳过（读档重进不重复生成）。不进 phase3Objects（探针约束）。 */
  private spawnMarketStallKeepers(): void {
    if (this.mapKey !== 'town') return;
    if (this.marketStallKeepers.length > 0) return;
    const g = this.marketSquareRestore;
    if (!g) return;
    // 摊主配置：摊位类型 → 贴图 key / 名字 / 名字色 / 摊位旁偏移
    const keepers: { type: MarketStallType; tex: string; name: string; color: string; offX: number }[] = [
      { type: 'tool',   tex: 'npc_miner',    name: '老张', color: '#d8a050', offX: -18 },
      { type: 'food',   tex: 'npc_gardener', name: '小梅', color: '#a0d888', offX: 18 },
      { type: 'flower', tex: 'npc_xiya',    name: '夏雅', color: '#e8a0a0', offX: -18 },
    ];
    for (const k of keepers) {
      const spot = g.arrangeSpots.find((s) => s.type === k.type);
      if (!spot || !spot.placed) continue; // 未摆放的摊位不生成摊主
      if (!this.textures.exists(k.tex)) continue;
      const kx = spot.x + k.offX;
      const ky = spot.y + 6;
      const c = this.add.container(kx, ky).setDepth(5);
      // 2026-08-14 夏雅精灵升级（28×64 全身图）：scale 0.42 ≈ 12×27px（全身角色，视觉与其他 NPC 协调）
      const sc = k.tex === 'npc_xiya' ? 0.5 : 0.5;
      const img = this.add.image(0, 0, k.tex).setScale(sc);
      c.add(img);
      const label = this.add.text(0, -24, k.name, {
        fontFamily: 'Arial', fontSize: '13px', color: k.color,
        stroke: '#000000', strokeThickness: 3,
        backgroundColor: 'rgba(0,0,0,0.4)', padding: { x: 3, y: 1 },
      }).setOrigin(0.5);
      c.add(label);
      // 记录对话 key（用于走近按 E 触发摊主闲聊）
      c.setData('stallKeeper', `${k.type}:${k.name}`);
      c.setData('keeperPos', { x: kx, y: ky });
      this.marketStallKeepers.push(c);
    }
  }

  /** 走近摊主按 E → 摊主闲聊（2026-08-14）。距离 40px 内，靠近最近摊主触发一句生活台词。 */
  private tryStallKeeperInteract(): boolean {
    if (this.mapKey !== 'town') return false;
    if (!this.marketStallKeepers || this.marketStallKeepers.length === 0) return false;
    let nearest: Phaser.GameObjects.Container | null = null;
    let best = 40 * 40;
    for (const c of this.marketStallKeepers) {
      if (!c.visible) continue;
      const pos = c.getData('keeperPos') as { x: number; y: number } | undefined;
      if (!pos) continue;
      const dx = this.player.x - pos.x;
      const dy = this.player.y - pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        nearest = c;
      }
    }
    if (!nearest) return false;
    const key = nearest.getData('stallKeeper') as string;
    const name = key.split(':')[1];
    this.inputManager.clearAction();
    return this.playStory([
      { speaker: name, color: '#d8d2c8', text: MapScene.STALL_KEEPER_LINES[name] ?? '今天生意不错，大家都来赶集了。' },
    ], () => this.updateHUD(), undefined, 'stall_keeper');
  }

  /** 清理后视觉（Phase 2）：空地 + 3 个布置点标记（等待按居民需求放摊位） */
  private buildMarketSquareCleared(): void {
    const g = this.marketSquareRestore;
    if (!g) return;
    // 荒地 → 草地（gid 1）：cols 18-32, rows 2-7
    for (let r = 2; r <= 7; r++) {
      for (let c = 18; c <= 32; c++) {
        this.groundLayer.putTileAt(1, c, r);
      }
    }
    // 交互提示标记（主锚点文字，布置完成后销毁）
    g.mark = this.add.text(g.pos.x, g.pos.y - 12, '集市广场', {
      fontFamily: 'Arial', fontSize: '10px', color: '#e8d8a8',
    }).setOrigin(0.5).setDepth(4);
    // 布置点标记：每个空位画一个外圈虚线点 + "空位"字样（放对摊位后销毁）
    for (const spot of g.arrangeSpots) {
      const m = this.add.graphics();
      m.lineStyle(1.5, 0xd8c890, 0.9);
      m.strokeCircle(spot.x, spot.y, 14);
      m.fillStyle(0xd8c890, 0.12);
      m.fillCircle(spot.x, spot.y, 14);
      m.setDepth(3);
      const label = this.add.text(spot.x, spot.y + 20, '空位', {
        fontFamily: 'Arial', fontSize: '9px', color: '#d8c890',
      }).setOrigin(0.5).setDepth(4);
      m.setData('label', label);
      spot.mark = m;
    }
  }

  /** 在布置点 index 摆放一个摊位（销毁空位标记，绘制摊位视觉；placed 防重复摆放） */
  private placeMarketStall(index: number): void {
    const g = this.marketSquareRestore;
    if (!g) return;
    const spot = g.arrangeSpots[index];
    if (!spot || spot.placed) return;
    spot.placed = true;
    // 销毁空位标记
    if (spot.mark) {
      const label = spot.mark.getData('label') as Phaser.GameObjects.Text | undefined;
      label?.destroy();
      spot.mark.destroy();
      spot.mark = null;
    }
    const s = this.buildMarketStall(spot.x, spot.y, spot.type);
    g.debris.push(s);
    // 若开张态已有灯光，无需重复——灯光只在 buildMarketSquareRestored 里加
  }

  /** 绘制单个摊位（按类型配色：工具=木色 / 小吃=红 / 花=粉） */
  private buildMarketStall(sx: number, sy: number, type: MarketStallType): Phaser.GameObjects.Graphics {
    // 2026-08-14 摊位 sprite 替换：原为纯 Graphics 程序绘制（用户反馈"不够好看"）。
    // 改用 Gemini 生成 + sprite_process.py 入库的摊位 sprite（48×48 级，白底/黑底抠图）。
    // 3 类差异化：tool=红棕 / food=红 / flower=粉（market_stall_{tool,food,flower}.png）
    const key = type === 'tool' ? 'spr_stall_tool' : type === 'food' ? 'spr_stall_food' : 'spr_stall_flower';
    if (this.textures.exists(key)) {
      const img = this.add.image(sx, sy, key);
      // 2026-08-14 缩放微调：原 48px≈3 瓦片宽偏大（用户反馈"稍微缩放一点"）→ scale 0.8 ≈ 38px≈2.4 瓦片宽
      img.setOrigin(0.5, 1).setPosition(sx, sy + 4).setScale(0.8).setDepth(3);
      return img as unknown as Phaser.GameObjects.Graphics;
    }
    const accent = type === 'tool' ? 0x8d6e4a : type === 'food' ? 0xd04030 : 0xd060a0;
    // Graphics fallback（sprite 未加载时兜底）
    const s = this.add.graphics();
    // 地面投影（增强纵深感）
    s.fillStyle(0x000000, 0.12);
    s.fillRoundedRect(sx - 13, sy + 8, 26, 5, 2);
    // 立杆 L / R（加粗）
    s.fillStyle(0x6e5633, 1);
    s.fillRect(sx - 11, sy - 8, 3, 19);
    s.fillRect(sx + 8, sy - 8, 3, 19);
    // 木台面（加宽 + 木纹）
    s.fillStyle(0xa8835a, 1);
    s.fillRect(sx - 13, sy + 7, 26, 5);
    s.lineStyle(1, 0x6e5633, 0.6);
    s.lineBetween(sx - 12, sy + 9, sx + 12, sy + 9);
    // 顶棚：主色 + 条纹布帘（2 条浅色条）
    s.fillStyle(accent, 1);
    s.fillRect(sx - 14, sy - 12, 28, 4);
    s.fillStyle(0xf5eede, 0.85);
    s.fillRect(sx - 14, sy - 11, 9, 2);
    s.fillRect(sx - 2, sy - 11, 9, 2);
    s.fillRect(sx + 10, sy - 11, 9, 2);
    // 台面货物（按摊类差异化：工具=木箱+斧柄 / 小吃=蒸笼 / 花=花束）
    if (type === 'tool') {
      s.fillStyle(0x8a6a45, 1);
      s.fillRect(sx - 6, sy + 2, 6, 5);
      s.lineStyle(1, 0x5b4226, 0.7);
      s.lineBetween(sx - 6, sy + 4, sx, sy + 4);
      s.lineStyle(1.5, 0x6e5633, 0.9);
      s.lineBetween(sx + 3, sy + 7, sx + 5, sy - 1);
    } else if (type === 'food') {
      s.fillStyle(0xf0e0c0, 1);
      s.fillRect(sx - 7, sy + 1, 6, 5);
      s.fillRect(sx + 1, sy + 1, 6, 5);
      s.fillStyle(0xe8a0a0, 0.9);
      s.fillRect(sx - 7, sy + 1, 6, 1.5);
      s.fillRect(sx + 1, sy + 1, 6, 1.5);
    } else {
      s.fillStyle(0xe8b64a, 1);
      s.fillCircle(sx - 4, sy + 3, 2.2);
      s.fillCircle(sx + 2, sy + 4, 2.2);
      s.fillStyle(0xe880b0, 1);
      s.fillCircle(sx - 4, sy + 3, 1.2);
      s.fillCircle(sx + 2, sy + 4, 1.2);
    }
    s.setDepth(3);
    return s;
  }

  /** 集市广场交互（未恢复时靠近按 E：检查资源 → 交付 → 恢复） */
  private tryMarketSquareInteract(): boolean {
    const g = this.marketSquareRestore;
    if (!g || g.restored) return false;
    const dx = this.player.x - g.pos.x;
    const dy = this.player.y - g.pos.y;
    if (dx * dx + dy * dy > 48 * 48) return false;
    this.inputManager.clearAction();

    const missing = getProjectShortfall('marketSquare', {
      wood: getItemCount('wood'),
      stone: getItemCount('stone'),
      gold: getCoins(),
    });
    if (missing.length > 0) {
      const cost = getQuickBuyCost('marketSquare', {
        wood: getItemCount('wood'),
        stone: getItemCount('stone'),
        gold: getCoins(),
      });
      this.offerQuickBuy({
        shortfallText: `集市广场还缺：${missing.join('、')}。`,
        cost,
        onBuy: () => {
          const needWood = 25 - getItemCount('wood');
          if (needWood > 0) addItem('wood', needWood);
          const needStone = 15 - getItemCount('stone');
          if (needStone > 0) addItem('stone', needStone);
          this.tryMarketSquareComplete();
        },
      });
      return true;
    }
    this.tryMarketSquareComplete();
    return true;
  }

  /** 集市清理完成逻辑（Phase 2：资源交付 = 清理场地 → 进入布置态，不直接开张） */
  private tryMarketSquareComplete(): void {
    addItem('wood', -25);
    addItem('stone', -15);
    spendCoins(80);
    const g = this.marketSquareRestore;
    if (g) g.cleared = true;
    // 一次性标记清理完成（随 triggeredEvents 入档，刷新/重进保持布置态）
    triggerOnce('ch1_market_cleared', () => {});
    // 清理反馈：破旧残骸销毁 → 铺空地 + 布置点标记
    if (g) {
      for (const d of g.debris) d.destroy();
      g.debris = [];
      g.mark?.destroy();
      g.mark = null;
      this.buildMarketSquareCleared();
    }
    play('repair_complete');
    // 里程碑入档：完成后立即保存（刷新/重进保持布置态）
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    this.updateHUD();
    // 清理反馈台词（行动型：场地清出来了，等居民来摆摊）

    this.playStory(
      [
        { speaker: '', color: '#aaaaaa', text: '（杂草和残骸清掉了，广场空了出来。老张、小梅、夏雅搬着摊架子走过来。）' },
        { speaker: '老张', color: '#b89878', text: '场地是空了，可摊子摆哪儿，得听各自的。' },
        { speaker: '花匠小梅', color: '#a0d888', text: '来，我们告诉你怎么摆最合适。' },
      ],
      () => this.updateHUD(),
    );
  }

  /** 布置交互（Phase 2：已清理未开张时，靠近某布置点按 E → 居民需求提示 + 选摊位） */
  private tryMarketSquareArrangeInteract(): boolean {
    const g = this.marketSquareRestore;
    if (!g || g.restored || !g.cleared) return false;
    // 找最近一个未摆放的布置点
    let idx = -1;
    let best = 40 * 40;
    g.arrangeSpots.forEach((spot, i) => {
      if (spot.mark === null) return; // 已摆摊位（无标记）
      const dx = this.player.x - spot.x;
      const dy = this.player.y - spot.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; idx = i; }
    });
    if (idx < 0) return false; // 全部已摆 → 走开张逻辑
    this.inputManager.clearAction();
    this.playMarketArrangeChoice(idx);
    return true;
  }

  /** 布置点 idx：播放居民需求提示 + 摊位选项菜单（放对/放错反馈） */
  private playMarketArrangeChoice(idx: number): void {

    this.playStory(MARKET_STALL_HINT_DIALOGUES[idx], () => {
      this.updateHUD();
    }, (choice) => {
      // 选项下标 0/1/2 = 工具摊/小吃摊/花摊（与 MARKET_STALL_OPTIONS 顺序一致）
      const chosen = (['tool', 'food', 'flower'] as MarketStallType[])[choice];
      if (!chosen) return;
      const spot = this.marketSquareRestore?.arrangeSpots[idx];
      if (!spot) return;
      if (chosen === spot.type) {
        // 放对：摆摊 + 一次性标记 + 正面反馈
        triggerOnce(`ch1_market_stall_${idx + 1}`, () => {
          this.placeMarketStall(idx);
          play('repair_complete');

          this.playStory(MARKET_STALL_PLACED_DIALOGUES[idx], () => {
            this.updateHUD();
            this.saveMarketArrangement();
            this.tryMarketSquareOpen();
          });
        });
      } else {
        // 放错：温和纠正，不消耗，可重试

        this.playStory(MARKET_STALL_WRONG_DIALOGUES[idx], () => {
          // 纠正后重新给一次选项（同一点再次进入选择）
          this.playMarketArrangeChoice(idx);
        });
      }
    });
  }

  /** 保存布置进度（每个摆设点入档） */
  private saveMarketArrangement(): void {
    this.saveAtPlayer(); // BUG-FIX（B3/B4）：异步入口（摆摊对白回调）统一走守卫入口
  }

  /** 3 摊齐 → 开张：灯亮 / 人来 / 音乐 + markRestored + 世界状态变化 */
  private tryMarketSquareOpen(): void {
    const g = this.marketSquareRestore;
    if (!g || g.restored) return;
    const allPlaced = g.arrangeSpots.every((s) => s.mark === null);
    if (!allPlaced) return;
    g.restored = true;
    markRestored('marketSquare');
    // 开张视觉：灯光 + 集市空角（摊位已逐摊摆好）
    this.buildMarketSquareRestored();
    play('crowd'); // 人群低语（程序合成）
    triggerTag('restore_market');
    // 开张演出对白 → 记忆时刻

    // P1-02（2026-08-16）：消费 ch1ElderChoice——玩家当初对村长「愿意帮忙/还没想好」的态度，
    // 在集市开张时得到一句回应（不改变剧情树，只让世界记得玩家说过的话）。
    const elderLead: DialogueLine[] =
      this.ch1ElderChoice === 'help'
        ? [
            { speaker: '镇长', color: COLORS.elder, text: '看来你是真准备留下来搭把手。' },
            { speaker: '林澈', color: COLORS.linche, text: '先看看吧，总不能刚回来就闲着。' },
          ]
        : this.ch1ElderChoice === 'unsure'
          ? [
              { speaker: '镇长', color: COLORS.elder, text: '还没想好也没关系，先来看看。' },
            ]
          : [];
    this.playStory([...elderLead, ...MARKET_OPEN_DIALOGUE], () => {
      setTimeout(() => showMemoryMoment('集市重新开起来的那天，青禾镇有了声音。'), 1600);
      this.updateHUD();
    });
    this.updateHUD();
    // ★ 一次性标记已写入（markRestored + triggerTag 已发生）→ 立即存档（EventSystem 时序纪律）
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
  }

  // ============ 第一章 P3 春日集（克制版，Sprint 3 收尾） ============

  /**
   * 春日集触发判定（进 town 场景 create 后延迟 1s 调用）：
   *   门禁：town → 章节≥1 → 集市已恢复（isRestored('marketSquare')）→ 夜晚（hour>=20 或凌晨）
   *   → 一次性（triggerOnce('ch1_spring_fair')，时序纪律：返回后再 save）。
   * 克制版（≤ 观星夜 40%）：灯火呼吸 + 人群剪影 + 人群低语 + 一句独白 + 第2章钩子（远处灯塔一点动静）。
   */
  private trySpringFairSequence(): void {
    if (this.mapKey !== 'town') return;
    if (this.inStargazeCutscene || this.inSpringFairCutscene) return;
    if (this.firstMorningActive) return; // 与其他自动演出互斥（同村长来访范式）
    if (this.storyDialogue?.isOpen()) return; // 对白打开时窗口期不触发（同 startArtShow 范式）
    // BUG-FIX（丢剧情）：标记已打但独白未播（上次被占用/切图打断）→ 本次进 town 优先补播
    if (this.springFairStoryOwed) {
      this.inSpringFairCutscene = true;
      this.springFairFX = this.springFairFX.filter((o) => o.active);
      if (this.springFairFX.length === 0) this.buildSpringFairFX();
      this.queueSpringFairStory();
      return;
    }
    if (!isChapterAtLeast(CHAPTER_1)) return;
    if (!isRestored('marketSquare')) return;
    if (hasTriggered('ch1_spring_fair')) return;
    const t = getTime();
    if (t.hour < 20 && t.hour >= 6) return; // 仅夜晚（"热闹的晚上"）
    this.startSpringFair();
  }

  /** 春日集演出主体：触发记录 + 灯火/剪影/人声 + 独白 + 钩子 */
  private startSpringFair(): void {
    // BUG-FIX（P0）：runner 占用时 playStory 会被 playSequence 静默吞掉——本函数是
    // "标记/存档先行"模式（ch1_spring_fair triggerOnce + save），一旦吞段 = onComplete
    // 永不执行 → inSpringFairCutscene 永久置位 → 交互/出口全锁死。
    // 窗口期直接不触发（triggerOnce 未标记，下次进 town 仍会重试；同 startArtShow 范式）。
    if (this.storySequenceRunner?.isPlaying?.()) return;
    this.inSpringFairCutscene = true;
    const ok = triggerOnce('ch1_spring_fair', () => {
      play('crowd'); // 人群低语（程序合成，零资产）
      this.buildSpringFairFX(); // 灯火呼吸 + 人群剪影
      showMemoryMoment('集市灯火亮起来，老远就能听见有人说话。');
      this.time.delayedCall(1800, () => this.queueSpringFairStory());
    });
    if (!ok) {
      this.inSpringFairCutscene = false;
      return;
    }
    // ★ triggerOnce 已返回：ch1_spring_fair 此刻已标记 → 存档（EventSystem.md 时序纪律）
    this.springFairStoryOwed = true; // 独白播出前视为"欠播"——被占用/切图打断也不许丢剧情
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
  }

  /**
   * 春日集独白入队（延迟 1.8s 后调用）：runner/对白被占用则每秒重试。
   * BUG-FIX（丢剧情）：原实现 10 次耗尽即 endSpringFair 释放旗标——但 ch1_spring_fair
   * 已标记，剧情就此永久丢失（灯火亮了没人说话）。一次性剧情不可丢：改为无限重试
   * （delayedCall 随 shutdown 自动销毁，无泄漏），切图/重启后由 springFairStoryOwed
   * 在下次进 town 时补播（trySpringFairSequence 入口 owed 分支）。
   */
  private queueSpringFairStory(attempts = 0): void {
    if (!this.scene.isActive()) return; // shutdown：owed 保留，重进 town 补播
    if (this.storySequenceRunner?.isPlaying?.() || this.storyDialogue?.isOpen()) {
      this.time.delayedCall(1000, () => this.queueSpringFairStory(attempts + 1));
      return;
    }
    const ok = this.playStory(
      [
        { speaker: '', color: '#aaaaaa', text: '（人群里有笑声，有人在喊价钱，有人蹲在摊子前挑东西。）' },
        { speaker: '镇长', color: '#c8b898', text: '上次这么热闹，还是你爷爷在的时候。……你回来得正是时候。' },
        { speaker: '', color: '#aaaaaa', text: '（远处的灯塔方向，海面上好像亮了一下。……很快又暗下去。）' },
      ],
      () => this.endSpringFair(),
    );
    if (ok) {
      this.springFairStoryOwed = false;
    } else {
      // 理论不可达（已查过占用）；防御：一秒后重试，绝不走 endSpringFair 丢剧情
      this.time.delayedCall(1000, () => this.queueSpringFairStory(attempts + 1));
    }
  }

  /** 春日集视觉：摊位灯火呼吸（3 盏暖黄灯）+ 人群剪影 ×3（头圆+身，轻晃动） */
  private buildSpringFairFX(): void {
    const g = this.marketSquareRestore;
    if (!g) return;
    const T = TILE_SIZE;
    const bx = g.pos.x;
    const by = g.pos.y;
    // 灯火呼吸：3 盏暖黄光点（摊位上方），alpha yoyo——"热闹的晚上"
    const lampSpots: [number, number][] = [
      [bx - 6 * T, by - 3 * T],
      [bx, by - 2 * T],
      [bx + 6 * T, by - 1 * T],
    ];
    for (const [lx, ly] of lampSpots) {
      const lamp = this.add.graphics();
      lamp.fillStyle(0xffd98a, 0.95);
      lamp.fillCircle(lx, ly, 1.5);
      lamp.fillStyle(0xffd98a, 0.25);
      lamp.fillCircle(lx, ly, 5);
      lamp.setDepth(3);
      this.tweens.add({ targets: lamp, alpha: 0.55, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.springFairFX.push(lamp);
    }
    // 人群剪影 ×3：头圆 + 身矩形，站在摊位前空地，轻晃动（人群走动感）
    const spots: [number, number][] = [
      [bx - 4 * T, by + 3.5 * T],
      [bx + 2 * T, by + 4 * T],
      [bx + 5 * T, by + 3 * T],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [px, py] = spots[i];
      const p = this.add.graphics();
      p.fillStyle(0x3a3240, 0.85);
      p.fillCircle(px, py - 5, 3.5);                // 头
      p.fillRoundedRect(px - 3.5, py - 2, 7, 9, 2); // 身
      p.setDepth(3);
      this.tweens.add({
        targets: p, y: py - 1.5, duration: 900 + i * 300,
        yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: i * 250,
      });
      this.springFairFX.push(p);
    }
  }

  /** 春日集收尾：剪影/灯火移除，解除互斥（常驻灯火由恢复态摊位挂灯继续承担） */
  private endSpringFair(): void {
    for (const fx of this.springFairFX) fx.destroy();
    this.springFairFX = [];
    this.inSpringFairCutscene = false;
  }

  // ============ P2 农场复兴视觉化（菜园层次/工具区/树荫/碎石小路） ============

  /**
   * P2 农场复兴视觉化（视觉升级方案 v0.10 §五，制作人 2026-08-07 拍板 P2 先行）。
   * 荒废→复兴两态装饰组，与 FEATURE-037 worldRestore 联动：
   *   菜园层次   → isRestored('garden')
   *   工具区/树荫/碎石小路 → isRestored('oldHouse')
   * 纯视觉叠加：零新素材、不触碰碰撞层/存档/出口/交互点/NPC 站位；
   * 装饰随场景 shutdown 自动销毁（不存引用）；farmLife 统计供验收探针读取。
   * 坐标均经 farm.json 核对（草地 + 无碰撞），避开树位/农田/出口/花园覆盖区/木屋/水池/既有花草。
   */
  private setupFarmDecorations(): void {
    if (this.mapKey !== 'farm') return;
    const gardenRestored = isRestored('garden');
    const homeRestored = isRestored('oldHouse');
    let ruin = 0;
    let revive = 0;

    // 组1 菜园层次（花园恢复区外围，错开 oldRobot(28,3)/夏雅(33,4)/(33,6) 站位）
    if (gardenRestored) {
      revive += this.buildGardenLayersRestored();
    } else {
      ruin += this.buildGardenLayersRuined();
    }
    // 组2 工具区域（老屋周围空地，错开木屋建筑/石墙/门前出口/出生点）
    if (homeRestored) {
      revive += this.buildToolAreaRestored();
    } else {
      ruin += this.buildToolAreaRuined();
    }
    // 组3 树荫区域（开阔树下，错开农田/出口/交互点）
    if (homeRestored) {
      revive += this.buildTreeShadeRestored();
    } else {
      ruin += this.buildTreeShadeRuined();
    }
    // 组4 碎石小路（老屋门前往农田的走廊 row 17）
    if (homeRestored) {
      revive += this.buildGravelPathRestored();
    } else {
      ruin += this.buildGravelPathRuined();
    }
    // 小动物：有人打理后东北角树冠上有小鸟（(37,4)，错开东侧出口 rows 9-11）
    this.farmLife = { ruin, revive, wildlife: homeRestored ? 1 : 0 };
    if (homeRestored) {
      this.createFarmBird();
    }
  }

  /** 菜园层次·荒废态：破木桩/倒伏菜架/破陶罐/乱草堆（花园外围空地，4 组） */
  private buildGardenLayersRuined(): number {
    const T = TILE_SIZE;
    // 破木桩：(26,3)
    const stump = this.add.graphics();
    stump.fillStyle(0x8d6e4a, 1);
    stump.fillCircle(0, 0, 5);
    stump.fillStyle(0x6e5236, 1);
    stump.fillCircle(0, 0, 3);
    stump.fillCircle(-1.5, -1, 1.2);
    stump.fillCircle(1.5, 1, 1);
    stump.setPosition(26 * T + T / 2, 3 * T + T / 2).setDepth(3);
    // 倒伏菜架：(27,6) 歪斜木架
    const frame = this.add.graphics();
    frame.fillStyle(0x9c7b52, 1);
    frame.fillRect(-6, 0, 12, 1.5);
    frame.fillRect(-5, 1.5, 1.5, 6);
    frame.setRotation(0.4);
    frame.setPosition(27 * T + T / 2, 6 * T + T / 2).setDepth(3);
    // 破陶罐：(32,8) 灰陶残片
    const pot = this.add.graphics();
    pot.fillStyle(0x9a8a76, 1);
    pot.fillRoundedRect(-3, -4, 6, 7, 2);
    pot.fillStyle(0x6e6250, 1);
    pot.fillRect(-2, -6, 4, 2);
    pot.setPosition(32 * T + T / 2, 8 * T + T / 2).setDepth(3);
    // 乱草堆：(34,8) 枯黄乱草
    const weeds = this.add.graphics();
    weeds.fillStyle(0xb8a060, 1);
    for (let i = 0; i < 5; i++) {
      weeds.fillRect(-8 + i * 4, 0, 1, 3 + (i % 3) * 2);
    }
    weeds.setPosition(34 * T + T / 2, 8 * T + T / 2).setDepth(3);
    return 4;
  }

  /** 菜园层次·复兴态：菜畦色块×2 / 篱笆×2 / 花簇×1（5 组） */
  private buildGardenLayersRestored(): number {
    const T = TILE_SIZE;
    // 菜畦层次：(30,8)/(31,8) 深浅绿菜畦条（半透明地面色块，模拟蔬菜层次）
    const bedA = this.add.graphics();
    bedA.fillStyle(0x4a9e3f, 0.55);
    bedA.fillRect(-7, -5, 13, 9);
    bedA.fillStyle(0x3c8a33, 0.5);
    bedA.fillRect(-5, -2, 9, 3);
    bedA.setPosition(30 * T + T / 2, 8 * T + T / 2).setDepth(2);
    const bedB = this.add.graphics();
    bedB.fillStyle(0x5cb850, 0.5);
    bedB.fillRect(-6, -4, 12, 8);
    bedB.fillStyle(0x9dd46a, 0.5);
    bedB.fillRect(-4, -1, 8, 2);
    bedB.setPosition(31 * T + T / 2, 8 * T + T / 2).setDepth(2);
    // 篱笆：(26,4)/(27,7) 两段小篱笆（竖栏）
    const fence = (cx: number, cy: number): void => {
      const f = this.add.graphics();
      f.fillStyle(0x9c7b52, 1);
      f.fillRect(-5, -7, 1, 14);
      f.fillRect(5, -7, 1, 14);
      f.fillRect(-5, -3, 11, 1.5);
      f.fillRect(-5, 2, 11, 1.5);
      f.setPosition(cx, cy).setDepth(3);
    };
    fence(26 * T + T / 2, 4 * T + T / 2);
    fence(27 * T + T / 2, 7 * T + T / 2);
    // 花簇：(31,3) 红花绿叶
    const flower = this.add.graphics();
    flower.fillStyle(0xe74c3c, 1);
    flower.fillCircle(-3, 0, 2);
    flower.fillCircle(3, 0, 2);
    flower.fillCircle(0, -3, 2);
    flower.fillStyle(0xffd166, 1);
    flower.fillCircle(0, 0, 1.6);
    flower.fillStyle(0x3c8a33, 1);
    flower.fillRect(-1, 2, 2, 4);
    flower.setPosition(31 * T + T / 2, 3 * T + T / 2).setDepth(3);
    return 5;
  }

  /** 工具区域·荒废态：断柄锄/锈镰刀/破木箱/干裂木桶（老屋周围空地，4 组） */
  private buildToolAreaRuined(): number {
    const T = TILE_SIZE;
    // 断柄锄头：(1,17) 斜躺（木柄 + 铁头）
    const hoe = this.add.graphics();
    hoe.fillStyle(0x8d6e4a, 1);
    hoe.fillRect(-5, -2, 10, 2);
    hoe.fillStyle(0x6e6a62, 1);
    hoe.fillRect(3, -5, 2, 8);
    hoe.setRotation(0.5);
    hoe.setPosition(1 * T + T / 2, 17 * T + T / 2).setDepth(3);
    // 锈镰刀：(1,19) 弧线锈刀
    const sickle = this.add.graphics();
    sickle.fillStyle(0x7a7268, 1);
    sickle.fillRect(-4, -1, 8, 2);
    sickle.fillStyle(0x8a7a5a, 1);
    sickle.fillCircle(4, -2, 2);
    sickle.setRotation(-0.3);
    sickle.setPosition(1 * T + T / 2, 19 * T + T / 2).setDepth(3);
    // 破木箱：(9,17) 歪斜箱体
    const crate = this.add.graphics();
    crate.fillStyle(0x9c7b52, 1);
    crate.fillRect(-5, -4, 10, 8);
    crate.fillStyle(0x6e5236, 1);
    crate.fillRect(-5, -1, 10, 1.5);
    crate.setRotation(-0.12);
    crate.setPosition(9 * T + T / 2, 17 * T + T / 2).setDepth(3);
    // 干裂木桶：(12,18) 桶身 + 裂纹
    const barrel = this.add.graphics();
    barrel.fillStyle(0x8d6e4a, 1);
    barrel.fillRect(-4, -5, 8, 10);
    barrel.fillStyle(0x6e5236, 1);
    barrel.fillRect(-4, -5, 8, 2);
    barrel.fillRect(-4, 3, 8, 2);
    barrel.lineStyle(1, 0x4a3826, 1);
    barrel.lineBetween(-2, -4, 2, 0);
    barrel.setPosition(12 * T + T / 2, 18 * T + T / 2).setDepth(3);
    return 4;
  }

  /** 工具区域·复兴态：工具架/木桶/柴堆/水桶/磨刀石（5 组） */
  private buildToolAreaRestored(): number {
    const T = TILE_SIZE;
    // 工具架：(1,17) 靠左墙竖排木架 + 三件工具
    const rack = this.add.graphics();
    rack.fillStyle(0x9c7b52, 1);
    rack.fillRect(-1, -8, 2, 16);
    rack.fillRect(-6, -5, 12, 1.5);
    rack.fillRect(-6, 2, 12, 1.5);
    rack.fillStyle(0x6e5236, 1);
    rack.fillRect(-4, 4, 1.5, 4);
    rack.fillRect(0, 4, 1.5, 4);
    rack.fillRect(3, 4, 1.5, 4);
    rack.setPosition(1 * T + T / 2, 17 * T + T / 2).setDepth(3);
    // 木桶：(1,19) 整齐木桶（带桶箍）
    const barrel = this.add.graphics();
    barrel.fillStyle(0x8d6e4a, 1);
    barrel.fillRect(-4, -5, 8, 10);
    barrel.fillStyle(0x6e5236, 1);
    barrel.fillRect(-4, -5, 8, 2);
    barrel.fillRect(-4, 3, 8, 2);
    barrel.fillStyle(0xd8b060, 1);
    barrel.fillRect(-1, -7, 2, 1.5);
    barrel.setPosition(1 * T + T / 2, 19 * T + T / 2).setDepth(3);
    // 柴堆：(9,17) 木柴横竖叠放
    const wood = this.add.graphics();
    wood.fillStyle(0x8d6e4a, 1);
    wood.fillRect(-6, -1, 12, 3);
    wood.fillRect(-5, 2, 10, 3);
    wood.fillStyle(0x6e5236, 1);
    wood.fillRect(-6, -1, 12, 1);
    wood.setPosition(9 * T + T / 2, 17 * T + T / 2).setDepth(3);
    // 水桶：(3,17) 桶 + 提手
    const pail = this.add.graphics();
    pail.fillStyle(0x6e8290, 1);
    pail.fillRect(-3, -4, 6, 8);
    pail.fillStyle(0x8d9aa5, 1);
    pail.fillRect(-3, -4, 6, 1.5);
    pail.lineStyle(1, 0x8d6e4a, 1);
    pail.strokeRoundedRect(-4, -7, 8, 4, 4);
    pail.setPosition(3 * T + T / 2, 17 * T + T / 2).setDepth(3);
    // 磨刀石：(2,17) 灰石
    const whetstone = this.add.graphics();
    whetstone.fillStyle(0x9a9a92, 1);
    whetstone.fillRoundedRect(-3, -2, 6, 4, 2);
    whetstone.setPosition(2 * T + T / 2, 17 * T + T / 2).setDepth(3);
    return 5;
  }

  /** 树荫区域·荒废态：树下枯草圈 ×2（(14,21)/(37,6)；（3,7）已改为花田支线区域，见 setupGardenerField） */
  private buildTreeShadeRuined(): number {
    const T = TILE_SIZE;
    const spots: Array<[number, number]> = [[14, 21], [37, 6]];
    for (const [c, r] of spots) {
      const g = this.add.graphics();
      g.fillStyle(0xb8a060, 0.7);
      for (let i = 0; i < 6; i++) {
        g.fillRect(-7 + i * 3, -2, 1.5, 4 + (i % 3) * 2);
      }
      g.setPosition(c * T + T / 2, r * T + T / 2).setDepth(2);
    }
    return spots.length;
  }

  /** 树荫区域·复兴态：树下蘑菇圈/花丛/白花丛 ×2（(14,21)/(37,6)；（3,7）已改为花田支线区域） */
  private buildTreeShadeRestored(): number {
    const T = TILE_SIZE;
    const flower = (fx: number, fy: number, color: number): void => {
      const f = this.add.graphics();
      f.fillStyle(color, 1);
      f.fillCircle(0, 0, 2);
      f.fillStyle(0xffd166, 1);
      f.fillCircle(0, 0, 1);
      f.fillStyle(0x3c8a33, 1);
      f.fillRect(-1, 1.5, 2, 3);
      f.setPosition(fx, fy).setDepth(3);
    };
    // 花丛：(14,21) 双花
    flower(14 * T + T / 2 - 4, 21 * T + T / 2, 0xff9e80);
    flower(14 * T + T / 2 + 3, 21 * T + T / 2 + 1, 0xe8b64a);
    // 白花丛：(37,6) 双花
    flower(37 * T + T / 2 - 3, 6 * T + T / 2, 0xf0f0f0);
    flower(37 * T + T / 2 + 3, 6 * T + T / 2 - 1, 0xe8b64a);
    return 2;
  }

  /** 碎石小路·荒废态：门前往农田的土路裂缝 ×4 */
  private buildGravelPathRuined(): number {
    const T = TILE_SIZE;
    const cracks: Array<[number, number]> = [[6, 17], [8, 17], [11, 17], [12, 17]];
    for (const [c, r] of cracks) {
      const g = this.add.graphics();
      g.lineStyle(1, 0x6e5a3a, 0.8);
      g.lineBetween(-3, -2, 2, 1);
      g.lineBetween(0, 1, 3, -1);
      g.setPosition(c * T + T / 2, r * T + T / 2).setDepth(2);
    }
    return cracks.length;
  }

  /** 碎石小路·复兴态：门前往农田的碎石点 ×6 */
  private buildGravelPathRestored(): number {
    const T = TILE_SIZE;
    const gravel: Array<[number, number]> = [[6, 17], [7, 17], [8, 17], [10, 17], [11, 17], [12, 17]];
    for (const [c, r] of gravel) {
      const g = this.add.graphics();
      g.fillStyle(0x9a9286, 0.9);
      g.fillCircle(-2, -1, 1.2);
      g.fillCircle(2, 1, 1.4);
      g.fillCircle(0, 1, 1);
      g.setPosition(c * T + T / 2, r * T + T / 2).setDepth(2);
    }
    return gravel.length;
  }

  /** P2 小动物：东北角树 (37,5) 冠上方的小鸟（小范围跳动，复用 gate/town 模式，depth 5 高于树 4） */
  private createFarmBird(): void {
    const T = TILE_SIZE;
    const bird = this.add.container(37 * T + T / 2, 4 * T + T / 2 - 2);
    bird.setDepth(5);
    const g = this.add.graphics();
    g.fillStyle(0x8a6a5a, 1);
    g.fillCircle(-3, 0, 2.2);
    g.fillCircle(3, 0, 2.2);
    g.fillStyle(0x6e4a3a, 1);
    g.fillCircle(-3, 0, 1);
    g.fillCircle(3, 0, 1);
    g.fillStyle(0xd8b060, 1);
    g.fillCircle(0, -3, 1);
    bird.add(g);
    // 原地小跳（模拟啄食）
    this.tweens.add({
      targets: bird,
      y: bird.y - 3,
      angle: { from: -6, to: 6 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  // ============ FEATURE-037 后山道路修复（forest 底部空地通道） ============

  /**
   * 初始化后山道路修复点（forest 底部 farm 入口上方空地通道 cols 13-16 / rows 10-16）。
   * 交互锚点选道路区域中心（col 15, row 13），远离老树 (8,8) 与 mine 出口 (28-29, 9-10)。
   * 恢复前：乱土瓦片（gid 2）+ 碎石/树根/杂草（Graphics）
   * 恢复后：石板小路（gid 7）+ 两侧花丛（gid 8）
   * 状态持久化：FarmRestore.isRestored('forestRoad')。
   */
  private setupForestRoadRestore(): void {
    if (this.mapKey !== 'forest') return;
    const T = TILE_SIZE;
    const restored = isRestored('forestRoad');
    this.forestRoadRestore = {
      restored,
      debris: [],
      mark: null,
      pos: { x: 15 * T + T / 2, y: 13 * T + T / 2 },
    };
    if (restored) {
      this.buildForestRoadRestored();
    } else {
      this.buildForestRoadRuined();
    }
  }

  /** 恢复前视觉：乱土瓦片（gid 2）+ 碎石/树根/杂草 + 交互提示标记 */
  private buildForestRoadRuined(): void {
    const g = this.forestRoadRestore;
    if (!g) return;
    const T = TILE_SIZE;
    // 乱土：cols 13-16, rows 10-16（原草地 gid 1 → 泥土 gid 2）
    for (let r = 10; r <= 16; r++) {
      for (let c = 13; c <= 16; c++) {
        this.groundLayer.putTileAt(2, c, r);
      }
    }
    // 组1 碎石堆：灰色圆石 ×3
    const rocks = this.add.graphics();
    rocks.fillStyle(0x9aa0a8, 1);
    rocks.fillCircle(0, 0, 3);
    rocks.fillCircle(4, 2, 2);
    rocks.fillCircle(-4, 1, 1.5);
    rocks.setPosition(14 * T + T / 2, 11 * T + T / 2);
    rocks.setDepth(3);
    // 组2 树根：棕色横木（断根横在路中）
    const root = this.add.graphics();
    root.fillStyle(0x8d6e4a, 1);
    root.fillRoundedRect(-9, -2, 18, 4, 2);
    root.setPosition(15 * T + T / 2, 13 * T + T / 2);
    root.setRotation(-0.2);
    root.setDepth(3);
    // 组3 杂草：绿色短线 ×5
    const weeds = this.add.graphics();
    weeds.fillStyle(0x7a9a4a, 1);
    for (let i = 0; i < 5; i++) {
      weeds.fillRect(-10 + i * 5, 0, 1, 3 + (i % 3) * 2);
    }
    weeds.setPosition(15 * T + T / 2, 15 * T + T / 2);
    weeds.setDepth(3);
    g.debris = [rocks, root, weeds];
    g.mark = this.add.text(g.pos.x, g.pos.y - 10, '后山道路', {
      fontFamily: 'Arial', fontSize: '10px', color: '#e8d8a8',
    }).setOrigin(0.5).setDepth(4);
  }

  /** 恢复后视觉：乱土 → 石板小路（gid 7）+ 两侧花丛（gid 8） */
  private buildForestRoadRestored(): void {
    const g = this.forestRoadRestore;
    if (!g) return;
    // 清除乱石/树根/杂草与提示标记
    for (const d of g.debris) d.destroy();
    g.debris = [];
    if (g.mark) { g.mark.destroy(); g.mark = null; }
    // 石板小路：cols 13-16, rows 10-16（gid 2 → gid 7）
    for (let r = 10; r <= 16; r++) {
      for (let c = 13; c <= 16; c++) {
        this.groundLayer.putTileAt(7, c, r);
      }
    }
    // 两侧花丛（gid 8）：Walls 层交错点缀（无碰撞）
    const flowerSpots: [number, number][] = [
      [12, 11], [17, 11], [12, 13], [17, 13], [12, 15], [17, 15],
    ];
    for (const [c, r] of flowerSpots) {
      this.wallsLayer.putTileAt(8, c, r);
    }
  }

  /**
   * 与后山道路交互：未恢复时靠近按 E → 检查资源（石头×50 金币×200）→
   * 资源不足提示缺什么；足够则扣除 → markRestored('forestRoad') → 铺路 → 存档。
   */
  private tryForestRoadRestoreInteract(): boolean {
    const g = this.forestRoadRestore;
    if (!g || g.restored) return false;
    const dx = this.player.x - g.pos.x;
    const dy = this.player.y - g.pos.y;
    if (dx * dx + dy * dy > 34 * 34) return false;

    const missing = getProjectShortfall('forestRoad', {
      wood: getItemCount('wood'),
      stone: getItemCount('stone'),
      gold: getCoins(),
    });
    if (missing.length > 0) {
      const cost = getQuickBuyCost('forestRoad', {
        wood: getItemCount('wood'),
        stone: getItemCount('stone'),
        gold: getCoins(),
      });
      this.offerQuickBuy({
        shortfallText: `后山道路还未修整，还缺：${missing.join('、')}。`,
        cost,
        onBuy: () => {
          const needStone = 50 - getItemCount('stone');
          if (needStone > 0) addItem('stone', needStone);
          this.tryForestRoadRestoreComplete();
        },
      });
      return true;
    }
    this.tryForestRoadRestoreComplete();
    return true;
  }

  /** 后山道路修复完成逻辑（资源已足够/一键补齐后） */
  private tryForestRoadRestoreComplete(): void {
    addItem('stone', -50);
    spendCoins(200);
    markRestored('forestRoad');
    const g = this.forestRoadRestore;
    if (g) g.restored = true;
    this.buildForestRoadRestored();
    // 声音补全 v1.0（2026-08-09）：修复成功——后山道路恢复的成就感
    play('repair_complete');
    // 里程碑入档：完成后立即保存（刷新/重进保持恢复态）
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    this.updateHUD();
    // FEATURE-037 统一对白批次 environment_restore_v010：道路完成 → 老张（单次触发）

    this.playStory(FOREST_ROAD_RESTORED_DIALOGUE, () => {
      setTimeout(() => showMemoryMoment('这条路重新连通了——后山不再是孤岛。'), 1600);
    });
  }

  /**
   * M1-3 夏雅见证：花园恢复完成后，夏雅在花园旁出现（col 33, row 6 右侧空地），
   * 玩家靠近按 E 播放 GARDEN_RESTORED_XIYA_DIALOGUE（生活记忆对白，A/B 类，无任务/存档字段）。
   * 一次性：触发后销毁，跨天/重进不重复（依赖 isRestored('garden') 已在存档）。
   */
  private spawnGardenXiya(): void {
    if (this.mapKey !== 'farm' || this.gardenXiya) return;
    // BUG-043 + BUG-071：先隐藏其他夏雅实例（含 D-011 剧情夏雅 letterXiya），避免同时出现两个夏雅
    if (this.dawnXiya) { this.dawnXiya.setVisible(false); }
    if (this.dawnXiyaLabel) { this.dawnXiyaLabel.setVisible(false); }
    if (this.eveningXiya) { this.eveningXiya.setVisible(false); }
    if (this.eveningXiyaLabel) { this.eveningXiyaLabel.setVisible(false); }
    if (this.xiyaSprite) { this.xiyaSprite.setVisible(false); }
    if (this.letterXiya) { this.letterXiya.setVisible(false); }
    if (this.letterXiyaLabel) { this.letterXiyaLabel.setVisible(false); }
    const T = TILE_SIZE;
    const dx = 33 * T + T / 2;
    const dy = 6 * T + T / 2;
    this.gardenXiya = this.add.sprite(dx, dy, 'npc_xiya');
    this.gardenXiya.setScale(0.5).setDepth(5);
    this.gardenXiya.setFlipX(true);
    this.gardenXiyaLabel = this.add.text(dx, dy - 24, '夏雅', {
      fontSize: '13px', color: '#f0a050',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 3, y: 2 },
    }).setShadow(0, 1, '#000000', 2).setOrigin(0.5).setDepth(6);
  }

  /** 与花园旁夏雅交互（靠近按 E → 播放见证对白，一次性销毁） */
  private tryGardenXiyaInteract(): boolean {
    if (!this.gardenXiya || !this.gardenXiya.visible) return false;
    const dx = this.player.x - this.gardenXiya.x;
    const dy = this.player.y - this.gardenXiya.y;
    if (dx * dx + dy * dy > R2(28)) return false;

    this.gardenXiya.destroy();
    this.gardenXiya = null;
    if (this.gardenXiyaLabel) { this.gardenXiyaLabel.destroy(); this.gardenXiyaLabel = null; }
    // BUG-043 + BUG-071：花园见证完成后恢复其他夏雅实例可见性（含 D-011 剧情夏雅）
    if (this.dawnXiya) { this.dawnXiya.setVisible(true); }
    if (this.dawnXiyaLabel) { this.dawnXiyaLabel.setVisible(true); }
    if (this.eveningXiya) { this.eveningXiya.setVisible(true); }
    if (this.eveningXiyaLabel) { this.eveningXiyaLabel.setVisible(true); }
    if (this.xiyaSprite) { this.xiyaSprite.setVisible(true); }
    if (this.letterXiya) { this.letterXiya.setVisible(true); }
    if (this.letterXiyaLabel) { this.letterXiyaLabel.setVisible(true); }

    this.playStory(GARDEN_RESTORED_XIYA_DIALOGUE, () => {
      // T2 改动 2：花园见证后连播夏雅「为什么小事会改变这里」（制作人 2026-08-06 定稿）
      this.storyDialogue!.play(XIYA_SMALL_THINGS_DIALOGUE, () => {
        this.updateHUD();
      });
    });
    return true;
  }

  /** 清除花园旁夏雅精灵（场景切换/跨天时调用） */
  private clearGardenXiya(): void {
    if (this.gardenXiya) { this.gardenXiya.destroy(); this.gardenXiya = null; }
    if (this.gardenXiyaLabel) { this.gardenXiyaLabel.destroy(); this.gardenXiyaLabel = null; }
    // BUG-043 + BUG-071：清除花园夏雅后恢复其他夏雅实例可见性（含 D-011 剧情夏雅）
    if (this.dawnXiya) { this.dawnXiya.setVisible(true); }
    if (this.dawnXiyaLabel) { this.dawnXiyaLabel.setVisible(true); }
    if (this.eveningXiya) { this.eveningXiya.setVisible(true); }
    if (this.eveningXiyaLabel) { this.eveningXiyaLabel.setVisible(true); }
    if (this.xiyaSprite) { this.xiyaSprite.setVisible(true); }
    if (this.letterXiya) { this.letterXiya.setVisible(true); }
    if (this.letterXiyaLabel) { this.letterXiyaLabel.setVisible(true); }
  }

  // ============ 支线试点（2026-08-06 制作人拍板方案 A） ============

  /**
   * 夏雅「院子有人照顾」：花园恢复后，花田旧藤架事件。
   * 流程：靠近花田按 E → 入口对白（asked）→ 再次靠近交付木材×3 → 完成（记忆卡 + 回响，一次性入档）。
   * 锚点：恢复后花园区域（farm cols 28-32, rows 4-7，中心 30,5）。
   * 纯生活事件：不触碰碰撞/主线/世界观；木材不足可重复触发提示。
   */
  private trySideXiyaGarden(): boolean {
    if (this.sideXiyaGardenDone) return false;
    const T = TILE_SIZE;
    const gx = 30 * T + T / 2;
    const gy = 5 * T + T / 2;
    const dx = this.player.x - gx;
    const dy = this.player.y - gy;
    if (dx * dx + dy * dy > 44 * 44) return false;


    if (!this.sideXiyaGardenAsked) {
      this.sideXiyaGardenAsked = true;
      this.playStory(XIYA_GARDEN_TRELLIS_DIALOGUE, () => this.updateHUD(), undefined, "")
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      } as any);
      return true;
    }

    const wood = getItemCount('wood');
    if (wood < 3) {
      // 资源快速置换：木材×3 按商店价补齐（8G/根），金币不足补齐全部 → 维持原提示
      const needWood = 3 - wood;
      const cost = needWood * WOOD_BUY_PRICE;
      this.offerQuickBuy({
        shortfallText: '藤架还差几根木材。你要是有空，从庄园里砍几根来？',
        cost: getCoins() >= cost ? cost : null,
        onBuy: () => {
          addItem('wood', needWood);
          this.trySideXiyaGardenComplete();
        },
      });
      return true;
    }
    this.trySideXiyaGardenComplete();
    return true;
  }

  /** 花田藤架交付完成逻辑（木材已足够/一键补齐后） */
  private trySideXiyaGardenComplete(): void {
    addItem('wood', -3);
    this.sideXiyaGardenDone = true;

    if (!isPhotoUnlocked('xiya_garden')) {
      unlockPhoto('xiya_garden');
      this.notifyPhotoUnlocked('xiya_garden');
    }
    this.playStory(XIYA_GARDEN_TRELLIS_DONE_DIALOGUE, () => {
      playMemoryFlashback(XIYA_GARDEN_FLASHBACK, () => {
        showMemoryMoment('花田那边，一直有人打理着。');
        this.updateHUD();
        this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
      });
    });
  }

  /**
   * 镇长「看星星的地方」：镇长委托后，夜晚到农田边空地（观星点旁）。
   * 流程：镇长委托（sideElderTeaAsked）→ 夜晚靠近观星点按 E → 记忆卡 + 回响（一次性入档）。
   * 白天靠近仅提示；复用 STARGAZE_POS 作为空地锚点。
   */
  private trySideElderStar(): boolean {
    if (this.mapKey !== 'farm') return false;
    if (!this.sideElderTeaAsked || this.sideElderStarDone) return false;
    const dx = this.player.x - this.STARGAZE_POS.x;
    const dy = this.player.y - this.STARGAZE_POS.y;
    if (dx * dx + dy * dy > 48 * 48) return false;

    if (getTime().hour < 20) {
      this.showDialogueText('空地还亮着——镇长说，晚上来坐坐。');
      return true;
    }

    this.sideElderStarDone = true;
    if (!isPhotoUnlocked('elder_star')) {
      unlockPhoto('elder_star');
      this.notifyPhotoUnlocked('elder_star');
    }

    this.playStory(ELDER_STAR_SITE_DIALOGUE, () => {
      playMemoryFlashback(ELDER_STAR_FLASHBACK, () => {
        showMemoryMoment('第二天，镇长听说了，只是点点头。「你爷爷要是知道你还记得那块空地，会高兴的。」');
        this.updateHUD();
        this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
      });
    });
    return true;
  }

  // ============ T3 NPC 生活事件（2026-08-07 制作人定稿） ============
  // 三条：夏雅「整理旧照片」/ 老张「矿灯」/ 小梅「小梅花」。
  // 复用支线试点模式：MapSceneFlags 一次性标记 + StoryDialogue + flashback/moment + save。
  // 锚点：夏雅=老屋 pos(11,20)；老张=矿洞老张位置(12,10)；小梅=小镇(14,12)。

  /**
   * 夏雅「整理旧照片」：老屋修复完成后，老屋门口互动。
   * 流程：靠近按 E → 入口对白（sideXiyaPhotoAsked）→ 再次靠近 → 整理完成（相簿照片 + 记忆卡，一次性入档）。
   * 无实物交付（记忆/相簿为奖励，制作人拍板）；锚点复用老屋 pos (11,20)。
   */
  private trySideXiyaPhoto(): boolean {
    if (this.mapKey !== 'farm') return false;
    if (this.sideXiyaPhotoDone) return false;
    if (!isRestored('oldHouse')) return false;
    const g = this.oldHouseRestore;
    if (!g) return false;
    const dx = this.player.x - g.pos.x;
    const dy = this.player.y - g.pos.y;
    if (dx * dx + dy * dy > 48 * 48) return false;


    if (!this.sideXiyaPhotoAsked) {
      this.sideXiyaPhotoAsked = true;
      this.playStory(XIYA_PHOTO_ENTRY_DIALOGUE, () => this.updateHUD(), undefined, "")
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      } as any);
      return true;
    }

    this.sideXiyaPhotoDone = true;
    if (this.xiyaPhotoMark) { this.xiyaPhotoMark.destroy(); this.xiyaPhotoMark = null; }
    if (!isPhotoUnlocked('xiya_old_photo')) {
      unlockPhoto('xiya_old_photo');
      this.notifyPhotoUnlocked('xiya_old_photo');
    }
    this.playStory(XIYA_PHOTO_DONE_DIALOGUE, () => {
      playMemoryFlashback(XIYA_PHOTO_FLASHBACK, () => {
        showMemoryMoment('那张泛黄的照片，一直有人收着。');
        this.updateHUD();
        this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
      });
    });
    return true;
  }

  // ============ P1-3 夏雅《旧日留影》（第一章性格铺垫，剧情大纲 v0.3 §八） ============
  // 老屋整理完成后 house 翻柜子 → 翻出旧相框 → farm 老屋门口找夏雅 → 她擦干净
  // 复用 trySideXiyaPhoto 范式：实例字段 sideXiyaOldShadowAsked/Done + StoryDialogue + save。
  // 目标：引出夏雅"保存小镇记忆"性格（她在保存可能性，不是等待），不展开《春深有信》。

  /**
   * 翻柜子标记（house 场景）：老屋整理 4 点全完成后，柜子位置出现交互标记。
   * 柜子坐标：书桌左侧 (10*T, 5*T)，避开 4 个整理点（bed/lamp/desk/radio）。
   */
  private setupXiyaOldShadow(): void {
    if (this.mapKey !== 'house') return;
    if (this.sideXiyaOldShadowDone) return;
    if (this.sideXiyaOldShadowAsked) return; // 已翻出，等交付（标记移到 farm 老屋门口）
    if (!isHouseTidyComplete()) return;
    const T = TILE_SIZE;
    const mark = this.add.text(10 * T, 5 * T, '？', {
      fontFamily: 'Arial', fontSize: '10px', color: '#c8d8a8',
    }).setOrigin(0.5).setDepth(4);
    this.xiyaOldShadowMark = mark;
  }

  /**
   * 翻柜子交互（house）：靠近按 E → 翻出旧相框 → 入口对白 → Asked=true → 存档。
   * 完成后标记消失，玩家去 farm 老屋门口找夏雅交付（tryXiyaOldShadowDeliver）。
   */
  private trySideXiyaOldShadow(): boolean {
    if (this.mapKey !== 'house') return false;
    if (this.sideXiyaOldShadowDone) return false;
    if (this.sideXiyaOldShadowAsked) return false;
    if (!isHouseTidyComplete()) return false;
    if (!this.xiyaOldShadowMark) return false;
    const dx = this.player.x - this.xiyaOldShadowMark.x;
    const dy = this.player.y - this.xiyaOldShadowMark.y;
    if (dx * dx + dy * dy > 48 * 48) return false;

    this.inputManager.clearAction();
    this.sideXiyaOldShadowAsked = true;
    if (this.xiyaOldShadowMark) { this.xiyaOldShadowMark.destroy(); this.xiyaOldShadowMark = null; }

    this.playStory(XIYA_OLD_SHADOW_ENTRY_DIALOGUE, () => {
      showMemoryMoment('也许夏雅认识这个。');
      this.updateHUD();
      this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
    });
    return true;
  }

  /**
   * 交付旧物件（farm 老屋门口）：翻出旧相框后，靠近老屋门口按 E → 夏雅接过擦干净 → §八 对白。
   * 调度在 trySideXiyaPhoto 之前（条件更严格：需 sideXiyaOldShadowAsked），不与 T3 冲突：
   *   未翻柜子 → 本函数条件不满足 → T3 触发；翻过柜子未交付 → 本函数触发；已交付 → T3 触发。
   */
  private tryXiyaOldShadowDeliver(): boolean {
    if (this.mapKey !== 'farm') return false;
    if (this.sideXiyaOldShadowDone) return false;
    if (!this.sideXiyaOldShadowAsked) return false;
    if (!isRestored('oldHouse')) return false; // 夏雅在老屋修复后才在老屋门口
    const g = this.oldHouseRestore;
    if (!g) return false;
    const dx = this.player.x - g.pos.x;
    const dy = this.player.y - g.pos.y;
    if (dx * dx + dy * dy > 48 * 48) return false;

    this.inputManager.clearAction();
    this.sideXiyaOldShadowDone = true;

    this.playStory(XIYA_OLD_SHADOW_DELIVER_DIALOGUE, () => {
      showMemoryMoment('她留着的不是旧物，是它们还可能被用上的那天。');
      this.updateHUD();
      this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
    });
    return true;
  }

  // ============ D-011 夏雅《春深有信·一》剧情专线（2026-08-08 制作人拍板） ============
  // 剧情专线 Demo Cut：只做第一章核心体验 5 步（首次见面 → 整理花苗 → 旧花种记录 → 态度变化 → 春祭/烟花埋伏笔）。
  // 不做好感系统 / 章节系统 / 通用传说任务框架（P2 Beta 角色篇章系统）。
  // 载体：独立剧情夏雅（花田边，参照 E9 创建模式），不碰 E9 日常闲聊；4 段逐步交互（stage 驱动）。
  // 触发条件：farm + 教程完成 + 12:00<=hour<20:00 + xiyaLetterDone!==true。
  // 存档：xiyaLetterAsked/Done/Stage（均 optional，旧档兼容）。

  /** 花田（旧花园）区域中心像素坐标：col 30, row 5（可走格，无碰撞） */
  private readonly LETTER_POS = { x: 30 * TILE_SIZE + TILE_SIZE / 2, y: 5 * TILE_SIZE + TILE_SIZE / 2 };
  /** 花期未至统一交互锚点（需求板 (32,16) 左侧 2 格；距需求板/公告栏 ≈64px，无冲突） */
  private readonly BLOOM_POS = { x: 30 * TILE_SIZE + TILE_SIZE / 2, y: 16 * TILE_SIZE + TILE_SIZE / 2 };

  /** 剧情时段窗口（下午/傍晚；与设计「夕阳落在田埂上」的傍晚氛围一致） */
  private letterTimeOk(): boolean {
    const t = getTime();
    return t.hour >= 12 && t.hour < 20;
  }

  /** 清理剧情专线全部场景级对象（夏雅精灵 + label + 交互点标记） */
  private clearLetterXiya(): void {
    if (this.letterXiya) { this.letterXiya.destroy(); this.letterXiya = null; }
    if (this.letterXiyaLabel) { this.letterXiyaLabel.destroy(); this.letterXiyaLabel = null; }
    if (this.letterFlowerMark) { this.letterFlowerMark.destroy(); this.letterFlowerMark = null; }
    if (this.letterRecordMark) { this.letterRecordMark.destroy(); this.letterRecordMark = null; }
  }

  /**
   * P1 世界反馈（制作人 2026-08-13 拍板纳入）：春深有信·一 完成后，
   * 花田旁出现几株新花苗视觉——「玩家行为 → 世界变化」，玩家再经过时能看到"这里真的改变了"。
   * 复用 Phase3 资产 spr_flowerbed（61×32），锚点=花田中心 LETTER_POS 右下一格（(30,5)→(31,6)）。
   * 由 xiyaLetterDone 隐式控制（完成后生成，读档/跨天恢复），无独立存档字段。
   */
  private spawnLetterFlowerbed(): void {
    if (this.letterFlowerSprite) return;
    if (!this.textures.exists('spr_flowerbed')) return;
    const T = TILE_SIZE;
    const [fx, fy] = [31 * T + T / 2, 6 * T + T / 2];
    this.letterFlowerSprite = this.add.image(fx, fy, 'spr_flowerbed')
      .setOrigin(0.5, 0.5)
      .setDepth(3);
  }

  /** 剧情专线存档（x/y/scene/facing + dailyQuest 与既有支线一致） */
  private saveLetterFlags(): void {
    this.saveAtPlayer(); // BUG-FIX（B3/B4）：异步入口统一走守卫入口
  }

  /** 生成花田边剧情夏雅（A 段开场 / D 段收尾共用） */
  private spawnLetterXiya(): void {
    if (this.letterXiya) return;
    const dx = this.LETTER_POS.x - 32;
    const dy = this.LETTER_POS.y;
    this.letterXiya = this.add.sprite(dx, dy, 'npc_xiya');
    this.letterXiya.setScale(0.5).setDepth(5);
    this.letterXiya.setFlipX(true);
    this.letterXiyaLabel = this.add.text(dx, dy - 24, '夏雅', {
      fontSize: '13px', color: '#f0a050',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 3, y: 2 },
    }).setShadow(0, 1, '#000000', 2).setOrigin(0.5).setDepth(6);
  }

  /** 生成「花苗」交互点（B 段；花田中心） */
  private spawnLetterFlowerMark(): void {
    if (this.letterFlowerMark) return;
    this.letterFlowerMark = this.add.text(this.LETTER_POS.x, this.LETTER_POS.y - 14, '花苗', {
      fontFamily: 'Arial', fontSize: '10px', color: '#c8d8a8',
    }).setOrigin(0.5).setDepth(4);
  }

  /** 生成「旧花种记录」交互点（C 段；花田中心右上） */
  private spawnLetterRecordMark(): void {
    if (this.letterRecordMark) return;
    this.letterRecordMark = this.add.text(this.LETTER_POS.x - 16, this.LETTER_POS.y - 30, '旧册子', {
      fontFamily: 'Arial', fontSize: '10px', color: '#e8d8a8',
    }).setOrigin(0.5).setDepth(4);
  }

  /**
   * 剧情专线生成入口（create / 跨天时调用）：
   * 按 stage 恢复现场：0=初始夏雅 / 1=花苗标记 / 2=记录标记 / 3=收尾夏雅。
   * 花园见证夏雅在场时（gardenXiya 未触发）让位，避免同时出现两个夏雅。
   */
  private setupLetterXiya(): void {
    if (this.mapKey !== 'farm') return;
    // P1 世界反馈：·一 完成后花苗常驻（跨天/读档恢复现场）
    if (this.xiyaLetterDone) {
      this.spawnLetterFlowerbed();
      return;
    }
    if (this.xiyaLetterDone) return;
    if (!isTutorialDone()) return;
    if (!this.letterTimeOk()) return;
    // 需要夏雅精灵的阶段（A/D）：花园见证在场时让位，等见证完成后自然恢复
    const needXiya = this.xiyaLetterStage === 0 || this.xiyaLetterStage >= 3;
    if (needXiya && this.gardenXiya) return;
    if (!this.xiyaLetterAsked) {
      this.spawnLetterXiya();
    } else if (this.xiyaLetterStage === 1) {
      this.spawnLetterFlowerMark();
    } else if (this.xiyaLetterStage === 2) {
      this.spawnLetterRecordMark();
    } else {
      this.spawnLetterXiya();
    }
  }

  /**
   * 剧情专线交互入口（按 E 时调用）：
   * 4 段逐步交互：A 开场（夏雅）→ B 花苗 → C 旧花种记录（记忆 moment）→ D 收尾埋伏笔（完成）。
   */
  private tryXiyaLetterInteract(): boolean {
    if (this.mapKey !== 'farm') return false;
    if (this.xiyaLetterDone) return false;
    if (!isTutorialDone()) return false;
    if (!this.letterTimeOk()) return false;

    const R = 32 * 32;

    // A 段：初始夏雅（开场对白 + 演出「夕阳落在田埂上」）——visible 检查与 E1/E9/见证一致（BUG-071）
    if (!this.xiyaLetterAsked && this.letterXiya?.visible) {
      const dx = this.player.x - this.letterXiya.x;
      const dy = this.player.y - this.letterXiya.y;
      if (dx * dx + dy * dy > R) return false;
      // 声音补全 v1.0（2026-08-09）：《春深有信》专属音乐随剧情开场起播，D 段收尾恢复地图 BGM
      // v0.11（P0.5）：剧情覆盖走 playStory
      MusicSystem.playStory('spring_letter');
      this.xiyaLetterAsked = true;
      this.xiyaLetterStage = 1;
      this.saveLetterFlags();
      this.playStory(XIYA_LETTER_OPEN_DIALOGUE, () => {
        this.clearLetterXiya();
        this.spawnLetterFlowerMark();
        this.updateHUD();
        this.saveLetterFlags();
      });
      return true;
    }

    // B 段：「花苗」交互点（整理花苗）
    if (this.letterFlowerMark) {
      const dx = this.player.x - this.letterFlowerMark.x;
      const dy = this.player.y - this.letterFlowerMark.y;
      if (dx * dx + dy * dy > R) return false;
      // 声音补全 v1.0：剧情中途回归场景时补播专属音乐（A 段已起播/场景切换已 stop）
      if (MusicSystem.current() !== 'spring_letter') MusicSystem.playStory('spring_letter');
      this.xiyaLetterStage = 2;
      this.saveLetterFlags();
      this.playStory(XIYA_LETTER_FLOWER_DIALOGUE, () => {
        this.letterFlowerMark?.destroy();
        this.letterFlowerMark = null;
        this.spawnLetterRecordMark();
        this.saveLetterFlags();
      });
      return true;
    }

    // C 段：「旧花种记录」交互点（翻旧册子 + 记忆 moment）
    if (this.letterRecordMark) {
      const dx = this.player.x - this.letterRecordMark.x;
      const dy = this.player.y - this.letterRecordMark.y;
      if (dx * dx + dy * dy > R) return false;
      // 声音补全 v1.0：剧情中途回归场景时补播专属音乐
      if (MusicSystem.current() !== 'spring_letter') MusicSystem.playStory('spring_letter');
      this.xiyaLetterStage = 3;
      this.saveLetterFlags();
      this.playStory(XIYA_LETTER_RECORD_DIALOGUE, () => {
        this.letterRecordMark?.destroy();
        this.letterRecordMark = null;
        showMemoryMoment('获得「旧花种记录」');
        // 花园见证夏雅在场时让位（避免双夏雅）；见证触发后重进场景恢复收尾夏雅
        if (!this.gardenXiya) this.spawnLetterXiya();
        this.saveLetterFlags();
      });
      return true;
    }

    // D 段：收尾夏雅（态度变化 + 春祭/烟花伏笔）——visible 检查与 E1/E9/见证一致（BUG-071）
    if (this.xiyaLetterAsked && this.xiyaLetterStage >= 3 && this.letterXiya?.visible) {
      const dx = this.player.x - this.letterXiya.x;
      const dy = this.player.y - this.letterXiya.y;
      if (dx * dx + dy * dy > R) return false;
      this.xiyaLetterDone = true;
      this.xiyaLetterStage = 4;
      this.saveLetterFlags();
      this.playStory(XIYA_LETTER_FINAL_DIALOGUE, () => {
        this.clearLetterXiya();
        // P1 世界反馈（制作人 2026-08-13 拍板）：完成后花田旁出现新花苗——玩家行为 → 世界变化
        this.spawnLetterFlowerbed();
        // L3 重要事件记忆卡（反馈层级 L3）：心语·一 完成——告诉玩家"你改变了什么"（不写"任务完成"）
        showStoryComplete('春深有信·一', '沉睡的花种，又在青禾镇的一角发芽');
        this.updateHUD();
        this.saveLetterFlags();
        // 声音补全 v1.0（2026-08-09）：剧情收尾恢复农场地图 BGM（白天 farm_day / 夜晚 stargaze_night）
        // v0.11（P0.5）：先清除剧情覆盖再恢复，若玩家选了"我的歌"则回到我的歌
        const t = getTime().hour;
        MusicSystem.endStory();
        MusicSystem.playSceneBgm('farm', t);
      });
      return true;
    }

    return false;
  }

  // ========== D-011 夏雅《春深有信·二 花期未至》剧情专线 ==========

  /** 花期未至前置门禁（CURRENT_TASK §衔接设计 v1.1 拍板）：·一 完成 + 集市恢复（marketSquare） */
  private bloomPrereqOk(): boolean {
    return !!this.xiyaLetterDone && isRestored('marketSquare');
  }

  /** 花期未至默认时段窗口：白天 8~20（与 S1「午后公告栏」一致，读档跨日保持） */
  private bloomTimeOk(): boolean {
    const t = getTime();
    return t.hour >= 8 && t.hour < 20;
  }

  /** 清花期未至场景级对象（剧情精灵 + 交互点 + 永久视觉；destroy/清场跨天调用） */
  private clearBloomXiya(): void {
    if (this.bloomXiya) { this.bloomXiya.destroy(); this.bloomXiya = null; }
    if (this.bloomXiyaLabel) { this.bloomXiyaLabel.destroy(); this.bloomXiyaLabel = null; }
    if (this.bloomMark) { this.bloomMark.destroy(); this.bloomMark = null; }
    if (this.bloomPermSprite) { this.bloomPermSprite.destroy(); this.bloomPermSprite = null; }
  }

  /** 存档：花期未至标记（复用 ·一 save 契约：x/y/scene/facing/dailyQuest） */
  private saveBloomFlags(): void {
    this.saveAtPlayer(); // BUG-FIX（B3/B4）：异步入口统一走守卫入口
  }

  /** 花期未至剧情夏雅生成（公告板旁：BLOOM_POS 左上偏移，面朝玩家来向） */
  private spawnBloomXiya(facingRight = true): void {
    if (this.bloomXiya) return;
    const px = this.BLOOM_POS.x - 24;
    const py = this.BLOOM_POS.y;
    this.bloomXiya = this.add.sprite(px, py, 'npc_xiya')
      .setScale(0.5).setDepth(5).setFlipX(!facingRight);
    this.bloomXiyaLabel = this.add.text(px, py - 24, '夏雅', {
      fontSize: '13px', color: '#f0a050',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 3, y: 2 },
    }).setShadow(0, 1, '#000000', 2).setOrigin(0.5).setDepth(6);
  }

  /** 花期未至当前段对应的"交互点标签"（S1/S8/E 生成夏雅；其余段生成标记）
   *  （2026-08-29 口径：晒场系；常量名保留旧命名，仅文本与语义同步） */
  private bloomMarkTextForStage(): { text: string } | null {
    switch (this.xiyaBloomStage) {
      case 1: return { text: '旧布匹' };      // S2 仓库整理
      case 2: return { text: '晒架木料' };    // S3 修晒架
      case 3: return { text: '邻居婆婆' };    // S4 误会解释
      case 4: return { text: '日记纸页' };    // S5 老裁缝铺前
      case 5: return { text: '邻居们' };      // S6 广场四处走动
      case 6: return { text: '收成摆设' };    // S7 晒场日傍晚
      case 7: return { text: '灯笼' };        // S8 夜晚挂灯
      default: return null;
    }
  }

  private spawnBloomMark(text: string): void {
    if (this.bloomMark) return;
    this.bloomMark = this.add.text(this.BLOOM_POS.x, this.BLOOM_POS.y - 14, text, {
      fontFamily: 'Arial', fontSize: '10px', color: '#f0e0b0',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(4);
  }

  /** 花期未至完成后：公告板右下出现「晒场生活痕迹」小景（2026-08-29 制作人拍板）
   *  ——主视觉：竹席 / 晒架 + 少量干菜粮食 + 一盏暖灯（晒场之后留下来的生活痕迹）；
   *    保留一朵纸花＝"花期未至"的人物记忆物（花退到生活痕迹旁边，不喧宾夺主）。
   *  放在公告板 (32,16) 右下 (34,17)，不挡需求板与任何 NPC。
   */
  private spawnBloomPermVignette(): void {
    if (this.bloomPermSprite) return;
    const T = TILE_SIZE;
    const px = 34 * T + T / 2;
    const py = 17 * T + T / 2;
    const c = this.add.container(px, py).setDepth(3);
    // 竹席（晒场主视觉：淡黄席面 + 席纹）
    const mat = this.add.graphics();
    mat.fillStyle(0xd8c078, 0.9).fillRoundedRect(-11, -3, 22, 10, 2);
    mat.lineStyle(1, 0xb89a52, 0.6).lineBetween(-11, 0, 11, 0);
    mat.lineStyle(1, 0xb89a52, 0.5).lineBetween(-11, 3, 11, 3);
    // 晒架（立柱 + 横杆，斜靠）
    const rack = this.add.graphics();
    rack.lineStyle(2, 0x6e4a24, 1).lineBetween(-9, 8, 9, -6);
    rack.lineStyle(1.5, 0x8a5a2a, 1).lineBetween(-7, 8, 11, -6);
    // 干菜 / 粮食（几串小点，晒在架下）
    const crop = this.add.graphics();
    crop.fillStyle(0xe0b040, 1).fillCircle(-2, 4, 1.5);  // 玉米
    crop.fillStyle(0xe0b040, 1).fillCircle(1, 4, 1.5);
    crop.fillStyle(0x7a9a4a, 1).fillCircle(6, 1, 1.5);   // 干菜
    crop.fillStyle(0xd8a050, 1).fillCircle(-6, 5, 1.2);  // 萝卜干
    // 暖灯（小圆 + 光晕）
    const lamp = this.add.graphics();
    lamp.fillStyle(0x5c3a20, 1).fillCircle(0, -12, 4);
    lamp.fillStyle(0xffd080, 1).fillCircle(0, -12, 2);
    const glow = this.add.graphics();
    glow.fillStyle(0xffdd99, 0.18).fillCircle(0, -12, 14);
    // 一朵纸花（花期未至的人物记忆物，留在生活痕迹旁）
    const f1 = this.add.graphics();
    f1.fillStyle(0xf0a0a0, 1).fillCircle(-8, -8, 3);
    f1.fillStyle(0xffffff, 1).fillCircle(-8, -8, 1);
    c.add([glow, lamp, mat, rack, crop, f1]);
    this.bloomPermSprite = c;
  }

  /** 花期未至入口（create / 跨天）：按前置 + stage 恢复现场 */
  private setupBloomXiya(): void {
    if (this.mapKey !== 'town') return;
    if (!isTutorialDone()) return;
    // P1 世界反馈：完成后永久挂饰（跨天/读档恢复）
    if (this.xiyaBloomDone) {
      this.spawnBloomPermVignette();
      return;
    }
    if (!this.bloomPrereqOk()) return;
    if (!this.bloomTimeOk()) return;
    // 0=S1 夏雅；8=S8 挂灯后收尾夏雅；其余 stage 生成对应交互点标记
    if (this.xiyaBloomStage === 0 && !this.xiyaBloomAsked) {
      this.spawnBloomXiya(true);
    } else if (this.xiyaBloomStage === 8) {
      this.spawnBloomXiya(false);
    } else {
      const m = this.bloomMarkTextForStage();
      if (m) this.spawnBloomMark(m.text);
    }
  }

  /** 花期未至交互路由（按 E 调用）：9 段 stage 驱动，依次推进 S1→S8→尾声 */
  private tryBloomXiyaInteract(): boolean {
    if (this.mapKey !== 'town') return false;
    if (this.xiyaBloomDone) return false;
    if (!isTutorialDone()) return false;
    if (!this.bloomPrereqOk()) return false;
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    const R = 32 * 32;
    // 复用 ·一 专属音乐：spring_letter 仍契合本篇章"花期未至"主题
    const ensureMusic = () => {
      if (MusicSystem.current() !== 'spring_letter') MusicSystem.playStory('spring_letter');
    };
    const restoreBgm = () => {
      const t = getTime().hour;
      MusicSystem.endStory();
      MusicSystem.playSceneBgm('town', t);
    };
    const advanceStage = (next: number, dialogue: DialogueLine[], after?: () => void) => {
      ensureMusic();
      this.xiyaBloomAsked = true;
      this.xiyaBloomStage = next;
      this.saveBloomFlags();
      this.storyDialogue!.play(dialogue, () => {
        // 清理当前交互对象
        if (this.bloomMark) { this.bloomMark.destroy(); this.bloomMark = null; }
        if (this.bloomXiya) { this.bloomXiya.destroy(); this.bloomXiya = null; }
        if (this.bloomXiyaLabel) { this.bloomXiyaLabel.destroy(); this.bloomXiyaLabel = null; }
        this.saveBloomFlags();
        after?.();
        // 下一段按 stage 生成对应对象
        const m = this.bloomMarkTextForStage();
        if (m) this.spawnBloomMark(m.text);
        else if (this.xiyaBloomStage === 8) this.spawnBloomXiya(false);
        this.updateHUD();
      });
    };

    // S1 开场：公告栏旁剧情夏雅（stage=0 → 1）
    if (!this.xiyaBloomAsked && this.bloomXiya?.visible) {
      const dx = this.player.x - this.bloomXiya.x;
      const dy = this.player.y - this.bloomXiya.y;
      if (dx * dx + dy * dy > R) return false;
      advanceStage(1, XIYA_BLOOM_S1_OPEN_DIALOGUE);
      return true;
    }
    // S2 仓库整理（stage=1 → 2）
    if (this.xiyaBloomStage === 1 && this.bloomMark) {
      const dx = this.player.x - this.bloomMark.x;
      const dy = this.player.y - this.bloomMark.y;
      if (dx * dx + dy * dy > R) return false;
      advanceStage(2, XIYA_BLOOM_S2_STORAGE_DIALOGUE);
      return true;
    }
    // S3 花台搭起（stage=2 → 3）
    if (this.xiyaBloomStage === 2 && this.bloomMark) {
      const dx = this.player.x - this.bloomMark.x;
      const dy = this.player.y - this.bloomMark.y;
      if (dx * dx + dy * dy > R) return false;
      advanceStage(3, XIYA_BLOOM_S3_FLOWERSTAND_DIALOGUE);
      return true;
    }
    // S4 邻居误会（stage=3 → 4）
    if (this.xiyaBloomStage === 3 && this.bloomMark) {
      const dx = this.player.x - this.bloomMark.x;
      const dy = this.player.y - this.bloomMark.y;
      if (dx * dx + dy * dy > R) return false;
      advanceStage(4, XIYA_BLOOM_S4_MISUNDERSTAND_DIALOGUE);
      return true;
    }
    // S5 日记本（stage=4 → 5）
    if (this.xiyaBloomStage === 4 && this.bloomMark) {
      const dx = this.player.x - this.bloomMark.x;
      const dy = this.player.y - this.bloomMark.y;
      if (dx * dx + dy * dy > R) return false;
      advanceStage(5, XIYA_BLOOM_S5_TURNING_DIALOGUE);
      return true;
    }
    // S6 邻居们（stage=5 → 6）
    if (this.xiyaBloomStage === 5 && this.bloomMark) {
      const dx = this.player.x - this.bloomMark.x;
      const dy = this.player.y - this.bloomMark.y;
      if (dx * dx + dy * dy > R) return false;
      advanceStage(6, XIYA_BLOOM_S6_VILLAGERS_DIALOGUE);
      return true;
    }
    // S7 春祭当天（stage=6 → 7）
    if (this.xiyaBloomStage === 6 && this.bloomMark) {
      const dx = this.player.x - this.bloomMark.x;
      const dy = this.player.y - this.bloomMark.y;
      if (dx * dx + dy * dy > R) return false;
      advanceStage(7, XIYA_BLOOM_S7_FESTIVAL_DIALOGUE);
      return true;
    }
    // S8 烟花前挂灯（stage=7 → 8）
    if (this.xiyaBloomStage === 7 && this.bloomMark) {
      const dx = this.player.x - this.bloomMark.x;
      const dy = this.player.y - this.bloomMark.y;
      if (dx * dx + dy * dy > R) return false;
      advanceStage(8, XIYA_BLOOM_S8_FIREWORKS_DIALOGUE);
      return true;
    }
    // 尾声（stage=8 → done）：收尾夏雅
    if (this.xiyaBloomStage === 8 && this.bloomXiya?.visible) {
      const dx = this.player.x - this.bloomXiya.x;
      const dy = this.player.y - this.bloomXiya.y;
      if (dx * dx + dy * dy > R) return false;
      ensureMusic();
      this.xiyaBloomDone = true;
      this.xiyaBloomStage = 9;
      this.saveBloomFlags();
      this.playStory(XIYA_BLOOM_EPILOGUE_DIALOGUE, () => {
        this.clearBloomXiya();
        // P1 世界反馈：完成后春祭记忆小景常驻
        this.spawnBloomPermVignette();
        // L3 事件记忆卡
        showStoryComplete('春深有信·二 花期未至', '明年这时候，地上还会有花。');
        this.updateHUD();
        this.saveBloomFlags();
        restoreBgm();
      });
      return true;
    }
    return false;
  }

  // ========== D-011 花期未至 END ==========

  /**
   * 老张「矿灯」：矿洞独立点灯点。
   * 流程：靠近按 E → 入口对白（sideMinerLampAsked）→ 交付铜矿×2 → 点亮矿灯（视觉变化）+ 完成对白。
   * 无记忆卡（制作人拍板：避免记忆卡变成任务奖励）；铜矿不足可重复触发提示。
   * 锚点：矿洞老张位置 (12,10) 旁的墙边。
   */
  private trySideMinerLamp(): boolean {
    if (this.mapKey !== 'mine') return false;
    if (this.sideMinerLampDone) return false;
    const T = TILE_SIZE;
    const lx = 12 * T + T / 2;
    const ly = 8 * T + T / 2;
    const dx = this.player.x - lx;
    const dy = this.player.y - ly;
    if (dx * dx + dy * dy > 44 * 44) return false;


    if (!this.sideMinerLampAsked) {
      this.sideMinerLampAsked = true;
      this.playStory(MINER_LAMP_ENTRY_DIALOGUE, () => this.updateHUD(), undefined, "")
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      } as any);
      return true;
    }

    const copper = getItemCount('copper');
    if (copper < 2) {
      this.playStory(MINER_LAMP_NEED_DIALOGUE, () => this.updateHUD(), undefined, "")
      return true;
    }

    addItem('copper', -2);
    this.sideMinerLampDone = true;
    this.buildMinerLampLit();
    this.playStory(MINER_LAMP_DONE_DIALOGUE, () => {
      this.updateHUD();
      this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
    });
    return true;
  }

  /**
   * 小梅「小梅花」：小镇花圃种花。
   * 流程：靠近按 E → 入口对白（sideGardenerPlumAsked）→ 再次靠近 → 种下梅花（花圃长花视觉变化）+ 完成对白 + 记忆卡。
   * 无实物交付（环境变化为奖励，制作人拍板）；锚点：小镇 (17,9) 小梅旁花圃。
   */
  private trySideGardenerPlum(): boolean {
    if (this.mapKey !== 'town') return false;
    if (this.sideGardenerPlumDone) return false;
    // 2026-08-14 让位修复：小梅花支线锚点 (27,17) 与商店老板 NPC (26,18) 仅距 22.6px。
    // 玩家在商店老板旁按 E 会被小梅花事件（48px 半径，优先级在前）抢先命中，弹小梅对话而非商店对话。
    // 对齐花田支线（trySideGardenerField）范式：玩家贴近任何可见 NPC（<24px）时，小梅花让位给 NPC 对话。
    for (const n of this.npcList) {
      if (!n.sprite || n.vanished) continue;
      const ndx = this.player.x - n.sprite.x;
      const ndy = this.player.y - n.sprite.y;
      if (ndx * ndx + ndy * ndy < R2(24)) return false;
    }
    const T = TILE_SIZE;
    // 2026-08-14 花圃锚点移位 (27,17)→(28,16)：原 (27,17) 是马路(gid7)且紧贴商店老板(26,18)，
    // 玩家在商店旁按 E 会误触发小梅对话；(28,16) 为石板空地且距商店老板 48px、神秘女 36px，
    // 与 NPC 判定半径(24px)拉开，玩家可正常触发且不误伤。
    const px = 28 * T + T / 2;
    const py = 16 * T + T / 2;
    const dx = this.player.x - px;
    const dy = this.player.y - py;
    if (dx * dx + dy * dy > 44 * 44) return false;


    if (!this.sideGardenerPlumAsked) {
      this.sideGardenerPlumAsked = true;
      this.playStory(GARDENER_PLUM_ENTRY_DIALOGUE, () => this.updateHUD(), undefined, "")
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      } as any);
      return true;
    }

    this.sideGardenerPlumDone = true;
    if (this.plumMark) { this.plumMark.destroy(); this.plumMark = null; }
    this.buildPlumBlossom();
    this.playStory(GARDENER_PLUM_DONE_DIALOGUE, () => {
      playMemoryFlashback(PLUM_BLOOM_FLASHBACK, () => {
        showMemoryMoment('花圃边上，多了一株小梅花。');
        this.updateHUD();
        this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
      });
    });
    return true;
  }

  /**
   * 花田支线：帮小梅开垦花田视觉。
   * 未开垦：荒废花田（干土 + 枯草圈）+ 提示标记；已开垦：盛开花田（多色花簇）。
   * 读档恢复：sideGardenerFieldDone 为 true 时直接显示盛开态。
   * 位置：farm 左上角花田 (3,7)（原树荫装饰区，2026-08-11 制作人拍板改为花田）。
   */
  private setupGardenerField(): void {
    if (this.mapKey !== 'farm') return;
    this.buildInsectWall();
    if (this.sideGardenerFieldDone) {
      this.buildGardenerFieldBlooming();
      return;
    }
    this.buildGardenerFieldRuined();
    const T = TILE_SIZE;
    const px = 3 * T + T / 2;
    const py = 7 * T + T / 2;
    const mark = this.add.text(px, py - 16, this.sideGardenerFieldAsked ? '花田' : '？', {
      fontFamily: 'Arial', fontSize: '10px', color: this.sideGardenerFieldAsked ? '#e8d8a8' : '#c8d8a8',
    }).setOrigin(0.5).setDepth(4);
    this.gardenerFieldMark = mark;
  }

  /** 第一章 v0.11 图鉴墙（制作人 2026-08-14 拍板）：花田旁的昆虫标本墙。
   *  玩家每完成一条自然记录（小梅观察收束），墙上就多一张小梅画的卡片——玩家路过看到自己的收藏。
   *  位置：farm 花田 (3,7) 西南侧 (4,10)；纯装饰零资源 Graphics，无碰撞；按 ch1_natural_record_1/2/3 幂等挂卡（重进/读档自动恢复）。
   *  幂等刷新：finishXiaomeiObserve 完成后调用重建，当场挂上新卡。
   *  美术优化 2026-08-15：① 由"悬浮长木板"改为"双立柱展示架"——木柱扎进草地 + 木框展示板 + 地面投影；
   *  ② 原位置 (6,6) 与小梅站位 (5,7) 及其头顶名牌重叠，导致前两张标本卡被名牌盖住，整体挪到花田西南侧空地 (4,10)；
   *  ③ 尺寸收敛（板 58×24 / 卡 11×16 / 蝴蝶 r2）——去掉大片浅木与"麻黄纸"大色块，改用暗木面板 + 空卡位占位线，
   *     三张标本卡紧凑排布，视觉上更像"小花田边的标本架"而非大展示板。
   */
  private buildInsectWall(): void {
    if (this.mapKey !== 'farm') return;
    if (this.insectWall) { this.insectWall.destroy(); this.insectWall = null; }
    const T = TILE_SIZE;
    const c = 4 * T + T / 2;
    const r = 10 * T + T / 2;
    const wall = this.add.container(c, r).setDepth(2);
    // 整架地面投影（贴合小架子）
    const ground = this.add.graphics();
    ground.fillStyle(0x2e2e34, 0.18);
    ground.fillEllipse(0, 24, 76, 8);
    ground.setDepth(2);
    wall.add(ground);
    // 左右立柱：细木柱扎进草地，柱脚带小投影
    const post = (px: number): void => {
      const p = this.add.graphics();
      p.fillStyle(0x6e4a24, 1);
      p.fillRect(px - 2, 2, 4, 22);
      p.fillStyle(0x8a5a30, 1);
      p.fillRect(px - 2, 2, 1.5, 22);
      p.fillStyle(0x2e2e34, 0.28);
      p.fillEllipse(px, 26, 9, 3);
      p.setDepth(2);
      wall.add(p);
    };
    post(-30);
    post(30);
    // 展示板：58×24，深木外框 + 暗木面板（不再是大片浅木/纸色块）+ 板角钉子 + 空卡位占位线
    const board = this.add.graphics();
    board.fillStyle(0x5e3e20, 1);
    board.fillRect(-29, -12, 58, 24);
    board.fillStyle(0x7c5c34, 1);
    board.fillRect(-27, -10, 54, 20);
    board.lineStyle(1, 0x6e5436, 0.7);
    board.lineBetween(-27, -10, -27, 10);
    board.lineBetween(27, -10, 27, 10);
    board.fillStyle(0x3c2a16, 1);
    board.fillCircle(-25, -9, 1);
    board.fillCircle(25, -9, 1);
    board.fillCircle(-25, 9, 1);
    board.fillCircle(25, 9, 1);
    // 空卡位占位（低透明度奶油描边：未解锁时也能看出"这里挂卡片"）
    for (const px of [-15, 0, 15]) {
      board.lineStyle(1, 0xe8dcbf, 0.35);
      board.strokeRect(px - 5.5, -6, 11, 16);
    }
    board.setDepth(2);
    wall.add(board);
    // 挂卡（仅已解锁的自然记录；11×16 小卡 + 小蝴蝶，三张紧凑排布）
    const cards: Array<{ key: string; color: number }> = [
      { key: 'ch1_natural_record_1', color: 0x7fc8d8 }, // 青禾凤蝶 · 淡青
      { key: 'ch1_natural_record_2', color: 0xa5d6a7 }, // 柳叶蝶 · 嫩绿
      { key: 'ch1_natural_record_3', color: 0xb0a8d0 }, // 夜光蛾 · 灰紫
    ];
    cards.forEach((card, i) => {
      if (!hasTriggered(card.key)) return;
      const x = -15 + i * 15;
      const rope = this.add.graphics();
      rope.lineStyle(1, 0x8a6a42, 0.9);
      rope.lineBetween(x, -10, x, -6);
      rope.setDepth(3);
      wall.add(rope);
      const cardG = this.add.graphics();
      cardG.fillStyle(0xf2e8cf, 1);
      cardG.fillRect(x - 5.5, -6, 11, 16);
      cardG.lineStyle(1, 0xc9b391, 0.9);
      cardG.strokeRect(x - 5.5, -6, 11, 16);
      // 卡片上的小蝴蝶（左右两翅 + 身体，比原版小一圈）
      cardG.fillStyle(card.color, 1);
      cardG.fillCircle(x - 2, 0.5, 2);
      cardG.fillCircle(x + 2, 0.5, 2);
      cardG.fillStyle(0x6e5436, 1);
      cardG.fillRect(x - 0.5, -0.5, 1, 4);
      cardG.setDepth(3);
      wall.add(cardG);
    });
    this.insectWall = wall;
  }

  /** 花田·荒废态：干裂土块 + 枯草圈（零资源 Graphics） */
  private buildGardenerFieldRuined(): void {
    const T = TILE_SIZE;
    const c = 3 * T + T / 2;
    const r = 7 * T + T / 2;
    const g = this.add.container(c, r).setDepth(2);
    // 干土：暗褐圆形土块
    const soil = this.add.graphics();
    soil.fillStyle(0x8a7a5a, 1);
    soil.fillCircle(0, 0, 9);
    soil.fillStyle(0x6e5a3a, 1);
    soil.fillCircle(-3, -2, 4);
    soil.fillCircle(3, 2, 3);
    // 干裂纹
    soil.lineStyle(1, 0x5a4a30, 0.9);
    soil.lineBetween(-5, 0, -1, 2);
    soil.lineBetween(1, -2, 4, 1);
    soil.setDepth(2);
    g.add(soil);
    // 枯草圈（沿用原树荫枯草样式）
    const grass = this.add.graphics();
    grass.fillStyle(0xb8a060, 0.7);
    for (let i = 0; i < 6; i++) {
      grass.fillRect(-7 + i * 3, -2, 1.5, 4 + (i % 3) * 2);
    }
    grass.setDepth(3);
    g.add(grass);
    this.gardenerFieldRuin = g;
  }

  /** 花田·盛开态：多色花簇（花瓣 + 花心 + 绿叶，零资源 Graphics） */
  private buildGardenerFieldBlooming(): void {
    const T = TILE_SIZE;
    const c = 3 * T + T / 2;
    const r = 7 * T + T / 2;
    const flower = (fx: number, fy: number, color: number): void => {
      const f = this.add.graphics();
      f.fillStyle(color, 1);
      f.fillCircle(0, 0, 2);
      f.fillStyle(0xffd166, 1);
      f.fillCircle(0, 0, 1);
      f.fillStyle(0x3c8a33, 1);
      f.fillRect(-1, 1.5, 2, 3);
      f.setPosition(fx, fy).setDepth(3);
    };
    // 主花丛（中心）
    flower(c, r, 0xff9e80);
    flower(c - 6, r - 4, 0xe8b64a);
    flower(c + 6, r - 3, 0xf0f0f0);
    flower(c - 4, r + 5, 0xffb3a0);
    flower(c + 4, r + 5, 0xe8b64a);
    flower(c, r - 9, 0xff9e80);
    // 边缘小花
    flower(c - 11, r + 1, 0xf0f0f0);
    flower(c + 11, r + 2, 0xff9e80);
    flower(c - 9, r - 8, 0xffb3a0);
    flower(c + 9, r - 7, 0xe8b64a);
  }

  /**
   * 花田支线：帮小梅开垦花田（farm 左上角花田 (3,7)）。
   * 流程：靠近花田按 E → 入口对白（asked）→ 再次靠近交付木材×3 → 完成（花田盛开 + 完成对白 + 记忆卡，一次性入档）。
   * 锚点：(3,7) 花田中心；纯生活事件，不触碰碰撞/主线；木材不足可重复触发提示（复用 offerQuickBuy 一键补齐）。
   */
  private trySideGardenerField(): boolean {
    if (this.mapKey !== 'farm') return false;
    if (this.sideGardenerFieldDone) return false;
    // 让位：小梅在花田旁（07:00-14:00），玩家贴近小梅时优先触发 NPC 对话（每日「花匠私语」不被花田事件抢走）
    const gardener = this.npcList.find((n) => n.id === 'gardener' && n.sprite && n.sprite.visible);
    if (gardener && gardener.sprite) {
      const ndx = this.player.x - gardener.sprite.x;
      const ndy = this.player.y - gardener.sprite.y;
      if (ndx * ndx + ndy * ndy < R2(24)) return false;
    }
    const T = TILE_SIZE;
    const gx = 3 * T + T / 2;
    const gy = 7 * T + T / 2;
    const dx = this.player.x - gx;
    const dy = this.player.y - gy;
    if (dx * dx + dy * dy > 44 * 44) return false;


    if (!this.sideGardenerFieldAsked) {
      this.sideGardenerFieldAsked = true;
      this.playStory(GARDENER_FIELD_ENTRY_DIALOGUE, () => this.updateHUD(), undefined, "")
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      } as any);
      return true;
    }

    const wood = getItemCount('wood');
    if (wood < 3) {
      // 资源快速置换：木材×3 按商店价补齐（8G/根），金币不足补齐全部 → 维持原提示
      const needWood = 3 - wood;
      const cost = needWood * WOOD_BUY_PRICE;
      this.offerQuickBuy({
        shortfallText: '花田还差几根木材，得先立一圈篱笆。你要是有空，从庄园里砍几根来？',
        cost: getCoins() >= cost ? cost : null,
        onBuy: () => {
          addItem('wood', needWood);
          this.trySideGardenerFieldComplete();
        },
      });
      return true;
    }
    this.trySideGardenerFieldComplete();
    return true;
  }

  /** 花田交付完成逻辑（木材已足够/一键补齐后） */
  private trySideGardenerFieldComplete(): void {
    addItem('wood', -3);
    this.sideGardenerFieldDone = true;
    if (this.gardenerFieldRuin) { this.gardenerFieldRuin.destroy(); this.gardenerFieldRuin = null; }
    if (this.gardenerFieldMark) { this.gardenerFieldMark.destroy(); this.gardenerFieldMark = null; }
    this.buildGardenerFieldBlooming();

    this.playStory(GARDENER_FIELD_DONE_DIALOGUE, () => {
      playMemoryFlashback(GARDENER_FIELD_FLASHBACK, () => {
        showMemoryMoment('花田里，开出了第一片花。');
        this.updateHUD();
        this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
      });
    });
  }

  /**
   * 夏雅「整理旧照片」：老屋修复后，老屋门口出现互动提示标记。
   * 读档恢复：已完成则不显示标记；未完成且已 asked 显示"再靠近整理"。
   */
  private setupXiyaPhoto(): void {
    if (this.mapKey !== 'farm') return;
    if (this.sideXiyaPhotoDone) return;
    if (!isRestored('oldHouse')) return;
    const g = this.oldHouseRestore;
    if (!g) return;
    const mark = this.add.text(g.pos.x, g.pos.y - 14, this.sideXiyaPhotoAsked ? '木盒' : '？', {
      fontFamily: 'Arial', fontSize: '10px', color: this.sideXiyaPhotoAsked ? '#e8d8a8' : '#c8d8a8',
    }).setOrigin(0.5).setDepth(4);
    this.xiyaPhotoMark = mark;
  }

  /**
   * 老张「矿灯」：矿洞点灯点视觉。
   * 未点亮：墙面一盏暗灯（Graphics）；已点亮：暖光 + 光晕。
   * 读档恢复：sideMinerLampDone 为 true 时直接显示点亮态。
   */
  private setupMinerLamp(): void {
    if (this.mapKey !== 'mine') return;
    const T = TILE_SIZE;
    const lx = 12 * T + T / 2;
    const ly = 8 * T + T / 2;
    this.minerLampGroup = this.add.container(lx, ly).setDepth(3);
    if (this.sideMinerLampDone) {
      this.buildMinerLampLit();
    } else {
      this.buildMinerLampDark();
    }
  }

  /** 矿灯未点亮态：墙面一盏灰暗旧灯（灯体 + 灯罩，无光） */
  private buildMinerLampDark(): void {
    const g = this.minerLampGroup;
    if (!g) return;
    const lamp = this.add.graphics();
    lamp.fillStyle(0x5a4a3a, 1);
    lamp.fillRoundedRect(-3, -6, 6, 12, 2);
    lamp.fillStyle(0x7a6a4a, 1);
    lamp.fillRect(-5, -4, 10, 3);
    lamp.fillStyle(0x8a7a5a, 1);
    lamp.fillRect(-4, 4, 8, 3);
    lamp.setDepth(3);
    g.add(lamp);
  }

  /** 矿灯点亮态：暖光灯芯 + 光晕（替换暗灯视觉） */
  private buildMinerLampLit(): void {
    const g = this.minerLampGroup;
    if (!g) return;
    g.removeAll(true);
    const glow = this.add.circle(0, 0, 14, 0xffd166, 0.35);
    glow.setDepth(2);
    g.add(glow);
    const lamp = this.add.graphics();
    lamp.fillStyle(0x5a4a3a, 1);
    lamp.fillRoundedRect(-3, -6, 6, 12, 2);
    lamp.fillStyle(0xffd166, 1);
    lamp.fillRect(-5, -4, 10, 3);
    lamp.fillStyle(0x8a7a5a, 1);
    lamp.fillRect(-4, 4, 8, 3);
    lamp.setDepth(3);
    g.add(lamp);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.35, to: 0.15 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * 小梅「小梅花」：小镇花圃种花点视觉。
   * 未种：花圃空地 + 提示标记；已种：一株小梅花（枝干 + 粉白花）。
   * 读档恢复：sideGardenerPlumDone 为 true 时直接显示花开态。
   */
  private setupGardenerPlum(): void {
    if (this.mapKey !== 'town') return;
    if (this.sideGardenerPlumDone) {
      this.buildPlumBlossom();
    } else {
      const T = TILE_SIZE;
      // 2026-08-14 花圃锚点移位 (27,17)→(28,16)（与 trySideGardenerPlum 交互锚点一致，见该函数注释）
      const px = 28 * T + T / 2;
      const py = 16 * T + T / 2;
      const mark = this.add.text(px, py - 14, this.sideGardenerPlumAsked ? '花种' : '？', {
        fontFamily: 'Arial', fontSize: '10px', color: this.sideGardenerPlumAsked ? '#e8d8a8' : '#c8d8a8',
      }).setOrigin(0.5).setDepth(4);
      this.plumMark = mark;
    }
  }

  /** 小梅花视觉：枝干 + 粉白花瓣（零资源 Graphics） */
  private buildPlumBlossom(): void {
    const T = TILE_SIZE;
    // 2026-08-14 花圃锚点移位 (27,17)→(28,16)（与 trySideGardenerPlum 交互锚点一致）
    const px = 28 * T + T / 2;
    const py = 16 * T + T / 2;
    const plum = this.add.container(px, py + 6).setDepth(3);
    const branch = this.add.graphics();
    branch.lineStyle(1.5, 0x7a5a3a, 1);
    branch.lineBetween(-4, 0, 0, -8);
    branch.lineBetween(0, -8, 4, -2);
    branch.setDepth(3);
    plum.add(branch);
    const bloom = (x: number, y: number) => {
      const flower = this.add.graphics();
      flower.fillStyle(0xf5c6d0, 1);
      flower.fillCircle(0, 0, 2);
      flower.fillStyle(0xffe9ef, 1);
      flower.fillCircle(0, 0, 1);
      flower.setPosition(x, y);
      flower.setDepth(3);
      return flower;
    };
    plum.add(bloom(-3, -4));
    plum.add(bloom(2, -7));
    plum.add(bloom(4, -1));
    plum.add(bloom(0, 0));
  }

  // ============ FEATURE-036 旧农业机器人（修复获得） ============

  /**
   * 初始化旧农业机器人（花园恢复后，花园旁空地出现锈迹机器人）。
   * 触发条件：restore.garden 已恢复 且 尚未修复获得（内存 flag，不落存档）。
   * 复用 deployRobot 的机器人视觉（锈色 + 天线，倾斜放置模拟损坏）。
   */
  private setupOldRobot(): void {
    if (this.oldRobotFixed) return;
    if (!isRestored('garden')) return;
    // 刷新后内存 flag 会重置：若背包已持有机器人，不再出现（避免重复领取，无新存档字段）
    if (getItemCount('auto_farmer_robot') > 0) return;
    const T = TILE_SIZE;
    // 花园左上角旁 (col 28, row 3)：可走草地，距夏雅见证位 (33,6) 5 格，交互不冲突
    const ox = 28 * T + T / 2;
    const oy = 3 * T + T / 2;
    this.oldRobotPos = { x: ox, y: oy };

    // 机身（锈色）：圆身 + 天线 + 眼睛，整体倾斜模拟废弃
    const g = this.add.graphics();
    g.fillStyle(0x8a6a4a, 1);
    g.fillCircle(0, 0, 6);
    g.fillStyle(0x6b5238, 1);
    g.fillCircle(0, 3, 4);
    g.fillStyle(0xb8a080, 1);
    g.fillCircle(-2, -2, 1.5);
    g.fillStyle(0x3a2e20, 1);
    g.fillCircle(2, -1, 1.2);
    g.lineStyle(1, 0x6b5238, 1);
    g.lineBetween(4, -5, 6, -9);
    g.fillStyle(0x8a6a4a, 1);
    g.fillCircle(6, -9, 1.5);
    g.fillStyle(0x4a3a28, 1);
    g.fillCircle(-3, 6, 2);
    g.fillCircle(3, 6, 2);
    // 锈斑
    g.fillStyle(0x8a5a3a, 1);
    g.fillCircle(-4, -1, 1.2);
    g.fillCircle(3, 2, 1);
    g.fillRect(-6, -3, 1.5, 3);
    g.fillRect(4, 0, 1.5, 2.5);

    const container = this.add.container(ox, oy, [g]);
    container.setDepth(4);
    container.setRotation(-0.12);
    this.oldRobot = container;

    this.oldRobotLabel = this.add.text(ox, oy + 14, '旧机器人', {
      fontFamily: 'Arial', fontSize: '10px', color: '#c8a878',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 3, y: 1 },
    }).setShadow(0, 1, '#000000', 2).setOrigin(0.5).setDepth(6);
  }

  /** 与旧机器人交互：靠近按 E → 播放修复对白 → 获得 auto_farmer_robot */
  private tryOldRobotInteract(): boolean {
    if (!this.oldRobot || !this.oldRobot.visible) return false;
    const dx = this.player.x - this.oldRobotPos.x;
    const dy = this.player.y - this.oldRobotPos.y;
    if (dx * dx + dy * dy > R2(30)) return false;

    this.oldRobotFixed = true;
    this.oldRobot.destroy();
    this.oldRobot = null;
    if (this.oldRobotLabel) { this.oldRobotLabel.destroy(); this.oldRobotLabel = null; }


    this.playStory(OLD_ROBOT_DIALOGUE, () => {
      addItem('auto_farmer_robot', 1);
      triggerTag('has_robot');
      play('levelup');
      this.showDialogueText('获得物品：【自动农业机器人】\n打开背包即可部署到农田旁。');
      // 里程碑入档（与花园恢复一致：修复获得后立即保存，防刷新丢失）
      this.saveAtPlayer(); // BUG-FIX（B3/B4）：延迟回调统一走守卫入口
      this.updateHUD();
    });
    return true;
  }

  /** 清除旧机器人精灵（场景切换/跨天时调用） */
  private clearOldRobot(): void {
    if (this.oldRobot) { this.oldRobot.destroy(); this.oldRobot = null; }
    if (this.oldRobotLabel) { this.oldRobotLabel.destroy(); this.oldRobotLabel = null; }
  }

  // ============ 镇子商店门面 ============

  /**
   * 创建镇子商店门面（2026-08-11 制作人拍板：商人回镇 + 商店剧情化）
   * 位置：中央广场 shopkeeper 站位 (col16.5, row10.5) 上方 (row 8.25)，避开 NPC 区/行道树/出口。
   * 纯视觉（Graphics 门面 + 招牌），不参与交互——入口 = 对话 shopkeeper（营业时间 08-18 老板在店）。
   * 两态：'closed' 门板关 + 招牌灰 / 'opened' 门开 + 招牌亮 + 柜台有货。
   */
  private setupTownShop(): void {
    const T = TILE_SIZE;
    // 2026-08-11 挡路修复：门面从中央大道（16.5,8.25）搬到广场东侧空地
    // 2026-08-12 Chapter1 P0-0：town 30x20 → 50x35，坐标随内容平移 dx=10T dy=8T（24.5→34.5, 9.5→17.5）
    // 位置 (col34.5, row17.5)：(552,280)；交互安全：与花匠小梅 town 站位 (456,296) 相距 97px
    const x = 34.5 * T;        // 552，广场东端
    const y = 17.5 * T;        // 280
    const g = this.add.graphics();
    g.setDepth(3);
    const mark = this.add.text(x, y + 1, '星辰杂货店', {
      fontFamily: 'Arial',
      fontSize: '8px',
      color: '#ffe082',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
    }).setOrigin(0.5).setDepth(4);
    this.townShop = { mark, stall: g, pos: { x, y } };
    this.updateTownShopVisual();
    // 自动售货机（2026-08-11 制作人拍板）：门面左侧并排（不再占用任何道路），独立交互（全天基础补给）
    // 位置 (col32, row17.75)：(512,284)，行17-18 广场无碰撞
    const mx = x - 40;         // 512
    const my = y + 4;          // 284
    const mg = this.add.graphics();
    mg.setDepth(3);
    // 机身（旧金属灰蓝，暗示"镇上残存的旧物"）
    mg.fillStyle(0x5a6b7a, 1);
    mg.fillRect(mx - 9, my - 12, 18, 24);
    mg.fillStyle(0x6e8294, 1);
    mg.fillRect(mx - 7, my - 10, 14, 20);
    // 玻璃窗（暗色，关闭期未点亮）
    mg.fillStyle(0x2e4059, 1);
    mg.fillRect(mx - 5, my - 8, 10, 9);
    // 出货口
    mg.fillStyle(0x3a2e22, 1);
    mg.fillRect(mx - 6, my + 6, 12, 5);
    // 待机指示灯（呼吸动画：暗示"机器还活着，镇上还有一点生活痕迹"）
    const lamp = this.add.text(mx + 8, my - 11, '●', {
      fontSize: '8px',
      color: '#ffd97a',
    }).setOrigin(0.5).setDepth(4);
    this.tweens.add({
      targets: lamp,
      alpha: { from: 0.3, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
    this.add.text(mx, my + 17, '自动售货机', {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: '#b8c4ce',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
    }).setOrigin(0.5).setDepth(4);
    this.shopMachine = { g: mg, lamp, pos: { x: mx, y: my } };
  }

  /** 商店门面两态刷新：'opened' 营业 / 其余关闭（读档与开店完成时调用） */
  private updateTownShopVisual(): void {
    if (!this.townShop) return;
    const { stall: g, mark, pos } = this.townShop;
    const x = pos.x;
    const y = pos.y;
    const open = this.shopState === 'opened';
    g.clear();
    // 屋顶（暖红三角 + 屋檐）
    g.fillStyle(0x8a3b2e, 1);
    g.fillTriangle(x - 24, y - 10, x + 24, y - 10, x, y - 22);
    g.fillStyle(0xa04a36, 1);
    g.fillRect(x - 26, y - 10, 52, 4);
    // 墙面（暖木色）
    g.fillStyle(0x8a5a33, 1);
    g.fillRect(x - 22, y - 6, 44, 22);
    // 招牌横板
    g.fillStyle(0x6b4423, 1);
    g.fillRect(x - 20, y - 4, 40, 10);
    mark.setColor(open ? '#ffe082' : '#9a9a9a');
    mark.setVisible(true);
    if (open) {
      // 营业：暖光门洞 + 柜台货品（萝卜红 / 叶绿 / 玉米黄）
      g.fillStyle(0x2b1d12, 1);
      g.fillRect(x - 6, y + 6, 12, 12);
      g.fillStyle(0xffcc88, 0.45);
      g.fillRect(x - 6, y + 6, 12, 12);
      g.fillStyle(0xe74c3c, 1);
      g.fillCircle(x - 13, y + 16, 2.5);
      g.fillStyle(0x2ecc71, 1);
      g.fillCircle(x, y + 17, 2.5);
      g.fillStyle(0xf1c40f, 1);
      g.fillCircle(x + 13, y + 16, 2.5);
    } else {
      // 关闭：木板门 + 门缝 + 门前灰土（萧条感）
      g.fillStyle(0x6b4423, 1);
      g.fillRect(x - 6, y + 6, 12, 12);
      g.fillStyle(0x5a3a1e, 1);
      g.fillRect(x - 2, y + 6, 2, 12);
      g.fillStyle(0x555555, 0.35);
      g.fillRect(x - 16, y + 18, 32, 4);
    }
  }

  // ============ 自动农业机器人（v0.6 庄园自动化 MVP） ============

  /** 从存档恢复机器人视觉（场景 create 时调用） */
  private setupRobots(): void {
    for (const robot of getRobots()) {
      this.createRobotVisual(robot);
    }
  }

  /** 创建一个机器人的视觉（Graphics 圆身 + 天线 + 眼睛，部署时播放弹入动画） */
  private createRobotVisual(robot: RobotData, deploy = false): void {
    const T = TILE_SIZE;
    const x = robot.col * T + T / 2;
    const y = robot.row * T + T / 2;
    // 机身：金属圆身 + 天线 + 眼睛
    const g = this.add.graphics();
    g.fillStyle(0x9db2c8, 1);
    g.fillCircle(0, 0, 6);                       // 机身
    g.fillStyle(0x7d93ab, 1);
    g.fillCircle(0, 3, 4);                       // 机身下半
    g.fillStyle(0xd5e2f0, 1);
    g.fillCircle(-2, -2, 1.5);                   // 眼睛高光
    g.fillStyle(0x2e4059, 1);
    g.fillCircle(2, -1, 1.2);                    // 眼睛
    g.lineStyle(1, 0x5c718a, 1);
    g.lineBetween(4, -5, 6, -9);                 // 天线杆
    g.fillStyle(0xff5252, 1);
    g.fillCircle(6, -9, 1.5);                    // 天线灯
    // 底盘：两轮
    g.fillStyle(0x4a5a6e, 1);
    g.fillCircle(-3, 6, 2);
    g.fillCircle(3, 6, 2);

    const container = this.add.container(x, y, [g]);
    container.setDepth(4);
    if (deploy) {
      container.setScale(0.1);
      container.setAlpha(0);
      this.tweens.add({
        targets: container,
        scale: 1, alpha: 1,
        duration: 380, ease: 'Back.easeOut',
      });
    }
    this.robotVisuals.set(robot.id, container);
    // 天线灯呼吸
    this.tweens.add({
      targets: container,
      alpha: { from: 1, to: 0.85 },
      duration: 700, yoyo: true, repeat: -1,
    });
  }

  /** 清理机器人视觉（场景 shutdown 时） */
  private clearRobots(): void {
    for (const [, c] of this.robotVisuals) c.destroy();
    this.robotVisuals.clear();
  }

  /**
   * 部署机器人：使用背包里的 auto_farmer_robot
   * 仅农场可部署，且目标格必须在农田可耕区域附近（FARM_AREA 内）且非碰撞格
   * @returns 是否部署成功（成功则背包面板关闭）
   */
  private deployRobot(): boolean {
    if (this.mapKey !== 'farm') {
      this.showDialogueText('只能把机器人放在农场里。');
      return false;
    }
    const pc = Math.floor(this.player.x / TILE_SIZE);
    const pr = Math.floor(this.player.y / TILE_SIZE);
    if (!isInFarmArea(pc, pr)) {
      this.showDialogueText('把机器人放在农田边上吧。');
      return false;
    }
    // BUG-046 修复（2026-08-09）：已开垦（tilled）的空地应允许部署——机器人是"放在田边照顾整片田"，
    // 玩家先开垦再放机器人的自然流程必须成立；仅拒绝"格子上已有作物"（planted/watered，机器人不能压作物）。
    const st = getTileState(pc, pr);
    if (st === 'planted' || st === 'watered') {
      this.showDialogueText('这里种了东西，换个位置。');
      return false;
    }
    if (getRobotAt(pc, pr)) {
      this.showDialogueText('这里已经有机器人了。');
      return false;
    }
    addItem('auto_farmer_robot', -1);
    triggerTag('has_robot');
    const robot = addRobot(pc, pr, DEFAULT_ROBOT_RANGE);
    this.createRobotVisual(robot, true);
    play('levelup');
    this.showDialogueText('自动农业机器人已部署 🤖');
    // 轻提示：让玩家明确机器人何时工作（制作人验收建议，防"不知何时工作"）
    this.time.delayedCall(800, () => {
      this.showDialogueText('它会每天清晨自动照料农田：浇水 + 收获。');
    });
    save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing });
    this.updateHUD();
    return true;
  }

  /**
   * 每日清晨自动化：扫描机器人范围内农田 → 浇水 / 收获 / 补种
   * 由 trySleep（timeNextDay 之后）调用；仅在有机器人时生效
   */
  private runRobotsDaily(): void {
    if (this.mapKey !== 'farm' || getRobotCount() === 0) return;
    const report = runDailyAutomation();
    const totalHarvest = report.harvested.reduce((s, h) => s + h.count, 0);
    if (report.watered === 0 && totalHarvest === 0 && report.seeded === 0) return;
    // 工作反馈：机器人闪一下 + 浮字报告
    for (const [, c] of this.robotVisuals) {
      this.tweens.add({ targets: c, angle: { from: -8, to: 8 }, duration: 120, yoyo: true, repeat: 1 });
    }
    const harvestDesc = report.harvested
      .map(h => `${CROP_DEFS[h.cropType].name}×${h.count}`)
      .join('、');
    const parts: string[] = [];
    if (report.watered > 0) parts.push(`浇水 ${report.watered} 块`);
    if (totalHarvest > 0) parts.push(`收获 ${harvestDesc || totalHarvest + ' 个作物'}`);
    if (report.seeded > 0) parts.push(`补种 ${report.seeded} 块`);
    const msg = `🤖 今日农业任务完成：${parts.join('，')}。`;
    this.showDialogueText(msg);
    // 刷新农田视觉（浇水/收获/播种改变了格子状态）
    this.refreshFarmVisual();
    // 每日任务面板同步（收获进背包不影响面板，仅刷新 HUD）
    this.updateHUD();
  }

  /**
   * 更新农田选中高亮（每帧跟随玩家面向的目标）
   * 教程内（未 done）→ 单格高亮（Rectangle）
   * 教程后 → Plot 区域高亮（Graphics：半透明填充 + 描边 + 四角装饰）
   */
  private updateTargetHighlight(): void {
    if (this.mapKey !== 'farm') return;
    if (!isTutorialDone()) {
      // 教程内保持单格高亮（保证教程体验稳定）
      if (this.plotHighlight) this.plotHighlight.setVisible(false);
      this.updateTileTargetHighlight();
      return;
    }
    // 教程后：Plot 区域高亮
    if (this.targetHighlight) this.targetHighlight.setVisible(false);
    this.updatePlotTargetHighlight();
  }

  /**
   * 单格高亮（教程期使用，原逻辑）
   * 仅农场场景生效，且仅在目标格可执行操作时显示（锄地/播种/浇水/收获）
   * 移动端：让玩家明确"当前操作会影响哪一格"
   */
  private updateTileTargetHighlight(): void {
    if (!this.targetHighlight) return;
    // 点击种田后的短暂反馈高亮（不被每帧面向高亮覆盖）
    if (this.tapFlashUntil > this.time.now && this.tapFlashKey) {
      const [fc, fr] = this.tapFlashKey.split(',').map(Number);
      if (this.targetHighlight.active) {
        this.targetHighlight.setVisible(true);
        this.targetHighlight.setPosition(fc * TILE_SIZE + TILE_SIZE / 2, fr * TILE_SIZE + TILE_SIZE / 2);
        const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 150);
        this.targetHighlight.setAlpha(0.45 + 0.25 * pulse);
      }
      return;
    }
    const pc = Math.floor(this.player.x / TILE_SIZE);
    const pr = Math.floor(this.player.y / TILE_SIZE);
    let tc = pc;
    let tr = pr;
    switch (this.player.facing) {
      case 'up': tr = pr - 1; break;
      case 'down': tr = pr + 1; break;
      case 'left': tc = pc - 1; break;
      case 'right': tc = pc + 1; break;
    }
    // 不在耕地区或该格当前无操作可执行 → 隐藏高亮
    if (!isInFarmArea(tc, tr) || !this.isTileActionable(tc, tr)) {
      this.targetHighlight.setVisible(false);
      return;
    }
    this.targetHighlight.setVisible(true);
    this.targetHighlight.setPosition(tc * TILE_SIZE + TILE_SIZE / 2, tr * TILE_SIZE + TILE_SIZE / 2);
    // 呼吸脉动：让目标框更醒目（玩家注意力集中在目标格）
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 220);
    this.targetHighlight.setAlpha(0.35 + 0.2 * pulse);
  }

  /**
   * Plot 区域高亮（教程后）：面向格所属 Plot + 上下文配色 + 点击闪亮
   * 手机端自动吸附：玩家面向/点击任意农田格 → 高亮整块田
   */
  private updatePlotTargetHighlight(): void {
    if (!this.plotHighlight) return;
    // Plot 点击后的短暂反馈高亮（500ms 白闪）
    if (this.plotFlashId && this.plotFlashUntil > this.time.now) {
      const flashPulse = 0.5 + 0.5 * Math.sin(this.time.now / 120);
      this.drawPlotHighlight(this.plotFlashId, 0xffffff, 0.38, 0.9);
      this.plotHighlight.setAlpha(0.75 + 0.25 * flashPulse);
      this.plotHighlight.setVisible(true);
      return;
    }
    this.plotFlashId = null;
    // 面向格所属 Plot
    const pc = Math.floor(this.player.x / TILE_SIZE);
    const pr = Math.floor(this.player.y / TILE_SIZE);
    let tc = pc;
    let tr = pr;
    switch (this.player.facing) {
      case 'up': tr = pr - 1; break;
      case 'down': tr = pr + 1; break;
      case 'left': tc = pc - 1; break;
      case 'right': tc = pc + 1; break;
    }
    const plotId = getPlotAt(tc, tr);
    if (!plotId) {
      this.plotHighlight.setVisible(false);
      return;
    }
    const { color, actionable } = this.getPlotColor(plotId);
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 220);
    this.drawPlotHighlight(plotId, color, actionable ? 0.1 + 0.06 * pulse : 0.04, actionable ? 0.8 : 0.35);
    this.plotHighlight.setAlpha(1);
    this.plotHighlight.setVisible(true);
  }

  /**
   * 绘制 Plot 区域高亮：半透明覆盖层 + 外框描边 + 四角白色 L 形装饰
   * 颜色由上下文自动决定（锄绿/水蓝/收黄/灰=成长中）
   */
  private drawPlotHighlight(plotId: FarmPlotId, color: number, fillAlpha: number, lineAlpha: number): void {
    const g = this.plotHighlight;
    g.clear();
    const r = getPlotRect(plotId);
    // 半透明覆盖层
    g.fillStyle(color, fillAlpha);
    g.fillRect(r.x, r.y, r.width, r.height);
    // 外框描边（向外扩 1.5px 更醒目）
    g.lineStyle(3, color, lineAlpha);
    g.strokeRect(r.x - 1.5, r.y - 1.5, r.width + 3, r.height + 3);
    // 四角白色 L 形装饰
    g.lineStyle(2, 0xffffff, lineAlpha);
    const L = 6;
    const inset = 3;
    const x0 = r.x - 1.5 + inset;
    const x1 = r.x + r.width + 1.5 - inset;
    const y0 = r.y - 1.5 + inset;
    const y1 = r.y + r.height + 1.5 - inset;
    g.beginPath();
    g.moveTo(x0, y0); g.lineTo(x0 + L, y0); g.lineTo(x0, y0); g.lineTo(x0, y0 + L);
    g.moveTo(x1, y0); g.lineTo(x1 - L, y0); g.lineTo(x1, y0); g.lineTo(x1, y0 + L);
    g.moveTo(x0, y1); g.lineTo(x0 + L, y1); g.lineTo(x0, y1); g.lineTo(x0, y1 - L);
    g.moveTo(x1, y1); g.lineTo(x1 - L, y1); g.lineTo(x1, y1); g.lineTo(x1, y1 - L);
    g.strokePath();
  }

  /**
   * Plot 上下文配色（与 interactPlot 优先级一致）：
   *   有成熟 → 收获黄；有已种 → 浇水蓝；有已锄 → 播种绿；有空地 → 锄地绿；全成长中 → 灰
   */
  private getPlotColor(plotId: FarmPlotId): { color: number; actionable: boolean } {
    const s = getPlotSummary(plotId);
    if (s.grown > 0) return { color: 0xffd54f, actionable: true };
    if (s.planted > 0) return { color: 0x64b5f6, actionable: true };
    if (s.tilled > 0) return { color: 0x6fdc8c, actionable: true };
    if (s.empty > 0) return { color: 0x6fdc8c, actionable: true };
    return { color: 0x9e9e9e, actionable: false };
  }

  /**
   * 目标格当前是否可执行操作（与 tryFarmInteract 的判定一致）：
   *   empty   → 可锄地
   *   tilled  → 有种子才可播种
   *   planted → 可浇水
   *   grown   → 可收获
   *   watered → 等待次日成长，不可操作
   */
  private isTileActionable(col: number, row: number): boolean {
    const state = getTileState(col, row);
    if (state === 'empty') return true;
    if (state === 'tilled') {
      // 播种需要至少一种种子库存（与 tryFarmInteract 的播种分支一致）
      for (const ct of CROP_TYPES) {
        if (getItemCount(CROP_DEFS[ct].seedItem as any) > 0) return true;
      }
      return false;
    }
    if (state === 'planted') return true;
    if (state === 'grown') return true;
    return false;
  }

  /**
   * 挖矿：靠近矿脉按 E 开采（v1.1 采集体验升级：每处矿脉 3 击击破）
   * 体力总消耗不变、分摊三击（铜矿 10 → 4/4/2）；第 1/2 击石屑飞溅+岩石震动，
   * 第 2 击起裂纹，最后一击矿石破碎 + 矿物掉落 + 闪光效果。
   */
  private tryMine(): void {
    // 找最近的矿脉（24px 范围内）
    let target: { deposit: OreDeposit; sprite: Phaser.GameObjects.Image } | null = null;
    let minDist = 24 * 24;
    for (const entry of this.oreSprites) {
      if (!entry.sprite.visible) continue;
      const dx = this.player.x - entry.sprite.x;
      const dy = this.player.y - entry.sprite.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDist) {
        minDist = d2;
        target = entry;
      }
    }
    if (!target) return;

    const deposit = target.deposit;
    const hitsBefore = getOreHits(deposit.id);
    const hit = hitsBefore + 1;

    // 体力检查（按第 hit 击的分摊消耗）
    const cost = getOreHitCost(deposit, hit);
    if (!consumeStamina(cost)) {
      this.showDialogueText('体力不足，无法开采！');
      return;
    }

    const broken = hitOre(deposit.id);
    const sx = target.sprite.x;
    const sy = target.sprite.y;

    if (broken) {
      // ③ 最后一击：矿石破碎 + 矿物掉落 + 闪光效果
      for (const drop of deposit.drops) {
        addItem(drop.item, drop.count);
      }
      addXp(5, 'harvest');
      play('rock_break');
      // 石屑 + 白色闪光粒子（矿物亮起的瞬间）
      this.burstParticles(sx, sy, { count: 12, tint: 0x9e9e9e, speed: 100, gravityY: 240 });
      this.burstParticles(sx, sy, { count: 8, tint: 0xffffff, speed: 70, gravityY: 20 });
      this.cameras.main.shake(160, 0.004);
      // 清理裂纹图形
      const crack = this.oreCracks.get(deposit.id);
      if (crack) {
        crack.destroy();
        this.oreCracks.delete(deposit.id);
      }
      // 矿脉消失 + 已开采 + 从待开采列表移除（防止重复开采/重复销毁）
      this.tweens.killTweensOf(target.sprite);
      target.sprite.destroy();
      const minedId = deposit.id;
      this.oreSprites = this.oreSprites.filter((e) => e.deposit.id !== minedId);
      // 归星录·相簿：完成「矿洞探险」→ 解锁《旧矿灯》（幂等）
      if (!isPhotoUnlocked('old_mine')) {
        unlockPhoto('old_mine');
        this.notifyPhotoUnlocked('old_mine');
      }
      const dropsText: string[] = [];
      for (const drop of deposit.drops) {
        dropsText.push(`${drop.count}个${drop.item === 'stone' ? '石头' : drop.item === 'copper' ? '铜矿' : '铁矿'}`);
      }
      this.showFloatText(sx, sy - 8, dropsText.join('、'), '#ffe082');
      this.showDialogueText(`开采成功！获得 ${dropsText.join('、')}  体力 -${cost}`);
      // v1.1 第一次挖矿短提示（一次性，mapFlags 入档；读档不重复）
      if (!this.firstMineHint) {
        this.firstMineHint = true;
        showMemoryMoment('归星岛的地下，似乎还藏着过去的痕迹。');
      }
      // 挖矿引导任务进度（每处矿脉开采成功计 1 次）
      onDQMine();
      this.updateDailyQuestPanel();
    } else {
      // 未击破：岩石震动 + 石屑飞溅（第 2 击起裂纹增加、幅度加大）
      play('rock_hit');
      this.tweens.killTweensOf(target.sprite);
      // 先杀旧 tween 再取基准坐标（防止连击中断残留偏移）
      const bx = target.sprite.x;
      const by = target.sprite.y;
      this.tweens.add({
        targets: target.sprite,
        x: bx + (hitsBefore >= 1 ? 4 : 3),
        y: by - (hitsBefore >= 1 ? 3 : 2),
        duration: 55,
        yoyo: true,
        repeat: hitsBefore >= 1 ? 2 : 1,
        onComplete: () => target.sprite.setPosition(bx, by),
      });
      this.burstParticles(sx, sy, { count: hitsBefore >= 1 ? 9 : 5, tint: 0x9e9e9e, speed: 70, gravityY: 230 });
      // 第 2 击：裂纹增加（石块变化）
      if (hitsBefore >= 1) {
        const old = this.oreCracks.get(deposit.id);
        if (old) old.destroy();
        this.oreCracks.set(deposit.id, this.drawCrack(sx, sy, 0x141414));
      }
      this.showDialogueText(`挖矿中… (${hit}/${ORE_MAX_HITS})  体力 -${cost}`);
    }
    this.updateHUD();
  }

  /**
   * 砍树：靠近树按 E 砍伐
   * 需要背包内有「旧斧头」；每砍一次扣 1 血，3 次砍倒 → 掉落木材 + 变树桩
   * @returns true 表示消费了本次动作（树在范围内）；false 表示附近没有可砍的树
   */
  private tryChopTree(): boolean {
    // 找最近的可砍树木（24px 范围内，树桩跳过）
    let targetPos: { col: number; row: number } | null = null;
    let minDist = 24 * 24;
    for (const pos of FARM_TREE_POSITIONS) {
      const tree = getTree(pos.col, pos.row);
      if (!tree || tree.isStump) continue;
      const cx = pos.col * TILE_SIZE + TILE_SIZE / 2;
      const cy = pos.row * TILE_SIZE + TILE_SIZE / 2;
      const dx = this.player.x - cx;
      const dy = this.player.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDist) {
        minDist = d2;
        targetPos = pos;
      }
    }
    if (!targetPos) return false; // 附近没有可砍的树

    // 斧头检查：无斧头时明确提示（制作人反馈：功能未解锁应提示，不能无反馈）
    // 注：旧逻辑 return false 不吞交互（BUG-010），但树木均沿地图边缘、远离农田，
    // 玩家在树旁按 E 意图即砍树，明确提示 + 消费交互比静默更符合体验。
    if (getItemCount('old_axe') <= 0) {
      const cx = targetPos.col * TILE_SIZE + TILE_SIZE / 2;
      const cy = targetPos.row * TILE_SIZE + TILE_SIZE / 2;
      this.flashTileError(targetPos.col, targetPos.row);
      this.showFloatText(cx, cy, '没有斧头，不能砍树', '#ff8a80');
      this.showDialogueText('还没有斧头，先完成今天的教程任务吧。');
      return true;
    }

    // 砍树引导（仅第一次触发）
    if (!this.woodcutTipShown) {
      this.woodcutTipShown = true;

      this.playStory(WOODCUT_TIP_DIALOGUE, undefined, undefined, "")
      return true;
    }

    // 体力检查（每次砍击扣 5 点，一棵树 3 次 = 15 点）
    if (!consumeStamina(5)) {
      this.showDialogueText('体力不足，砍不动树！');
      return true;
    }

    // 砍伐：扣血，满 3 次砍倒（v1.1 采集体验升级：三阶段反馈）
    const chopped = chopTree(targetPos.col, targetPos.row);
    const key = `${targetPos.col},${targetPos.row}`;
    const sprite = this.treeSprites.get(key);
    const cx = targetPos.col * TILE_SIZE + TILE_SIZE / 2;
    const cy = targetPos.row * TILE_SIZE + TILE_SIZE / 2;

    if (chopped) {
      // ③ 最后一击：树倒了。掉落 2 个木材 + 变树桩（树桩无碰撞、只保留几秒后淡出消失——制作人需求 2026-08-07）
      addItem('wood', 2);
      addXp(5, 'harvest');
      // 断裂 + 倒树音（tree_fall 含嘎吱/坠地）；延迟 0.36s 补"获得资源"提示音（设计稿：成功 = 资源提示音）
      play('tree_fall');
      this.time.delayedCall(360, () => play('harvest'));
      if (sprite) {
        // 树桩不挡路：禁用碰撞（立即，倒树动画期间玩家可通行）
        (sprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        // 清理此前击打留下的裂纹图形
        const oldCrack = this.treeCracks.get(key);
        if (oldCrack) {
          oldCrack.destroy();
          this.treeCracks.delete(key);
        }
        // 倒下动画 + 大量木屑/树叶 + 轻微震屏，完成后变树桩
        this.playTreeFall(sprite, targetPos.col, targetPos.row, cx, cy);
      }
      this.showFloatText(cx, cy - 12, '木材 +2', '#ffe082');
      this.showDialogueText('砍倒了树！获得木材 ×2');
      // v1.1 第一次砍树短提示（一次性，mapFlags 入档；读档不重复）
      if (!this.firstChopHint) {
        this.firstChopHint = true;
        showMemoryMoment('这里曾经很久没有人打理了。');
      }
      // 砍树引导任务进度
      onDQWoodcut();
      this.updateDailyQuestPanel();
    } else {
      // 还没倒：三阶段反馈（第 1 击轻微晃动/少量木屑，第 2 击裂纹 + 更大幅度晃动/更多木屑）
      play('chop');
      const remaining = getTree(targetPos.col, targetPos.row)?.health ?? TREE_MAX_HEALTH;
      if (sprite) {
        const heavy = remaining <= 1;
        this.tweens.killTweensOf(sprite);
        this.tweens.add({
          targets: sprite,
          x: cx + (heavy ? 5 : 3),
          y: cy - (heavy ? 3 : 2),
          duration: 60,
          yoyo: true,
          repeat: heavy ? 2 : 1,
          onComplete: () => sprite.setPosition(cx, cy),
        });
      }
      // 木屑 + 树叶粒子（第 2 击更多）
      this.burstParticles(cx, cy - 4, { count: remaining <= 1 ? 10 : 6, tint: 0x8a5a2b, speed: 60, gravityY: 220 });
      this.burstParticles(cx, cy - 10, { count: remaining <= 1 ? 6 : 3, tint: 0x6da544, speed: 40, gravityY: 30 });
      // 第 2 击：树干出现裂纹
      if (remaining <= 1) {
        const old = this.treeCracks.get(key);
        if (old) old.destroy();
        this.treeCracks.set(key, this.drawCrack(cx, cy - 2, 0x3a2a14));
      }
      const tree = getTree(targetPos.col, targetPos.row)!;
      this.showDialogueText(`砍树中… (剩余 ${tree.health}/${TREE_MAX_HEALTH})`);
    }
    this.updateHUD();
    return true;
  }

  /**
   * 农田交互（按 Player.facing 决定面前格子）
   * P6b: 路由委托给 FarmController，决策层（interactPlot/tryFarmInteractAt）保留在 MapScene
   */
  private tryFarmInteract(): void {
    this.farmController.handleFarmInteract(this.player.x, this.player.y, this.player.facing);
  }

  /**
   * 移动端点击种田
   * P6b: 路由委托给 FarmController，决策层（isTileActionable/tryFarmInteractAt）保留在 MapScene
   */
  private handleFarmTap(pointer: Phaser.Input.Pointer): void {
    this.farmController.handleFarmTap(pointer);
  }

  /**
   * 调试接口：获取指定格的土地状态（用于探针验证）
   * 使用 MapScene.debugTiles，避免 Vite HMR 模块分裂问题
   */
  public getTileStateForDebug(col: number, row: number): TileState {
    const key = `${col},${row}`;
    // 优先使用 MapScene 内部的 debugTiles（同步自 setTileState 调用）
    // 如果没有，回退到 FarmState 的 getTileState
    const state = MapScene.debugTiles.get(key);
    if (state) return state;
    return getTileState(col, row);
  }

  /** 调试接口：获取 debugTiles Map 大小（用于探针验证） */
  public getDebugTilesSize(): number {
    return MapScene.debugTiles.size;
  }

  /**
   * 对指定农田格执行操作（锄地/播种/浇水/收获）
   * 教程内由 tryFarmInteract（面前一格）与 handleFarmTap（点击格）复用
   * 实际逻辑委托给单格 helper（tillTileAt/plantTileAt/waterTileAt/harvestTileAt），
   * 本方法只负责单格模式的反饋（音效/飘字/水花/闪红）
   */
  private tryFarmInteractAt(col: number, row: number): void {
    // 必须在农田可耕区域内
    if (!isInFarmArea(col, row)) return;

    const state = getTileState(col, row);
    const tileCenterX = col * TILE_SIZE + TILE_SIZE / 2;
    const tileCenterY = row * TILE_SIZE + TILE_SIZE / 2;
    if (state === 'empty') {
      // 锄地：空地 → 耕地
      // 制作人反馈：任务未解锁锄地前应提示没有锄头（教程期玩家尚未获得锄头）
      if (getItemCount('old_hoe') <= 0) {
        this.flashTileError(col, row);
        this.showFloatText(tileCenterX, tileCenterY, '没有锄头，不能锄地', '#ff8a80');
        this.showDialogueText('还没有锄头，先打开庄园大门吧。');
        return;
      }
      if (this.tillTileAt(col, row)) {
        play('hoe');
        this.soilDust(tileCenterX, tileCenterY); // v1.0 土屑粒子（普通锄地即时反馈）
        this.showFloatText(tileCenterX, tileCenterY, '锄地');
      }
    } else if (state === 'tilled') {
      // 播种：优先使用 R 键选中的种子，不足时才走单种/引导分支（与原逻辑一致）
      const selectedSeedItem = CROP_DEFS[this.selectedCropType].seedItem as any;
      const selectedCount = getItemCount(selectedSeedItem);
      if (selectedCount > 0) {
        // 选中的种子有库存，直接种
        if (this.plantTileAt(col, row, this.selectedCropType)) {
          play('plant');
          this.seedDrop(tileCenterX, tileCenterY); // v1.0 落种反馈（每次播种）
          this.showFloatText(tileCenterX, tileCenterY, `${CROP_DEFS[this.selectedCropType].icon} ${CROP_DEFS[this.selectedCropType].name} · 🌱种子-1`, '#ffe082');
          this.updateDailyQuestPanel();
        }
      } else {
        // 选中的种子没了，检查其他种子
        const availableSeeds: { cropType: CropType; count: number }[] = [];
        for (const ct of CROP_TYPES) {
          const seedItem = CROP_DEFS[ct].seedItem as any;
          const count = getItemCount(seedItem);
          if (count > 0) availableSeeds.push({ cropType: ct, count });
        }
        if (availableSeeds.length === 0) {
          // Commit 3：无任何种子 → 明确引导（不弹选择器，不打断节奏）
          this.flashTileError(col, row);
          this.showFloatText(tileCenterX, tileCenterY, '没有种子，去镇上商店看看吧', '#ff8a80');
          this.showDialogueText('没有种子了……去镇上的商店买一些吧！');
          return;
        }
        if (availableSeeds.length === 1) {
          // 只有一种可用种子 → 直接种（不打断）
          if (this.plantTileAt(col, row, availableSeeds[0].cropType)) {
            play('plant');
            this.seedDrop(tileCenterX, tileCenterY); // v1.0 落种反馈
            this.showFloatText(tileCenterX, tileCenterY, `${CROP_DEFS[availableSeeds[0].cropType].icon} ${CROP_DEFS[availableSeeds[0].cropType].name} · 🌱种子-1`, '#ffe082');
            this.updateDailyQuestPanel();
          }
        } else {
          // 多种可用种子 → 不弹全屏选择器，飘字提示可用种子 + 引导切换
          const names = availableSeeds.map(s => CROP_DEFS[s.cropType].name).join('、');
          this.flashTileError(col, row);
          this.showFloatText(tileCenterX, tileCenterY, `可用种子：${names}`, '#ffe082');
          this.showDialogueText(this.hintText(`按 [R] 切换种子后播种（可用：${names}）`, `点左上角「种子」按钮切换后播种（可用：${names}）`));
          return;
        }
      }
    } else if (state === 'planted') {
      // 浇水：已种 → 已浇水（成长前置条件）
      // 制作人反馈：任务未解锁浇水前应提示没有水壶（教程期玩家尚未获得水壶）
      if (getItemCount('old_watering_can') <= 0) {
        this.flashTileError(col, row);
        this.showFloatText(tileCenterX, tileCenterY, '没有水壶，不能浇水', '#ff8a80');
        this.showDialogueText('还没有水壶，完成播种任务后才能浇水。');
        return;
      }
      if (this.waterTileAt(col, row)) {
        play('water');
        this.waterSplash(tileCenterX, tileCenterY); // 制作人反馈：手机端浇水特效不明显 → 水花粒子增强
        this.moistDarken(tileCenterX, tileCenterY); // v1.0 土壤湿润色变反馈
        this.waterCareFeedback(col, row, tileCenterX, tileCenterY); // v1.1 水光微闪 + 作物轻摆
        this.showFloatText(tileCenterX, tileCenterY, '浇水');
        this.updateDailyQuestPanel();
      }
    } else if (state === 'grown') {
      // 收获：成熟 → 耕地，获得作物
      const cropType = this.harvestTileAt(col, row);
      if (cropType) {
        play('harvest');
        // v1.1 收获仪式感：每次收获都有作物上浮动画 + 作物专属描述（首次收获的"情绪瞬间"保留）
        this.harvestPop(tileCenterX, tileCenterY, CROP_DEFS[cropType].icon);
        this.showFloatText(tileCenterX, tileCenterY, `收获 ${CROP_DEFS[cropType].icon} ${MapScene.HARVEST_DESC[cropType]}`, '#7ef0a0');
        this.updateDailyQuestPanel();
      }
    } else {
      // watered 已浇水成长中 → 点格反馈"还需要一点时间"（P2-1：区分"时间未到"与"缺浇水/坏档"）
      this.flashTileError(col, row);
      this.showFloatText(tileCenterX, tileCenterY, '还需要一点时间', '#ff8a80');
      return;
    }

    // 刷新该格视觉 + HUD
    const visual = this.tileRects.get(`${col},${row}`);
    if (visual) this.updateTileVisual(col, row, visual);
    this.updateHUD();
  }

  // ================= 单格核心操作 helper（数据层，无反馈，单格/批量共用） =================

  /** 单格锄地：empty → tilled。返回是否成功（非空地/无锄头返回 false）
 * P6c: 核心逻辑已委托给 FarmController.executeTill，MapScene 保留方法签名供调用方复用 */
  private tillTileAt(col: number, row: number): boolean {
    return this.farmController.executeTill(col, row);
  }

  /** 单格播种：tilled → planted。返回是否成功（非已锄/无该种子库存返回 false）
   * P6c: 核心逻辑已委托给 FarmController.executePlant，MapScene 保留方法签名供调用方复用 */
  private plantTileAt(col: number, row: number, cropType: CropType): boolean {
    return this.farmController.executePlant(col, row, cropType);
  }

  /** 单格浇水：planted → watered。返回是否成功（非已种/无水壶返回 false）
   * P6c: 核心逻辑已委托给 FarmController.executeWater，MapScene 保留方法签名供调用方复用 */
  private waterTileAt(col: number, row: number): boolean {
    return this.farmController.executeWater(col, row);
  }

  /** 单格收获：grown → tilled，作物入包。返回作物类型；非成熟返回 null
   * P6c: 核心逻辑已委托给 FarmController.executeHarvest，MapScene 保留方法签名供调用方复用 */
  private harvestTileAt(col: number, row: number): CropType | null {
    return this.farmController.executeHarvest(col, row);
  }

  /** v1.1 收获仪式感：作物上浮渐隐（每次收获都有，区别于首次收获的长镜头） */
  private harvestPop(x: number, y: number, icon: string): void {
    const pop = this.add.text(x, y - 6, icon, { fontSize: '18px' }).setOrigin(0.5).setDepth(8);
    this.tweens.add({
      targets: pop,
      scale: 1.8, y: y - 18, alpha: 0,
      duration: 650, ease: 'Sine.out',
      onComplete: () => pop.destroy(),
    });
  }

  /** v1.1 轻量照料反馈：浇水后水光微闪 + 作物轻摆（"水浇下去，植物回应了一下"；不新增数值/系统） */
  private waterCareFeedback(col: number, row: number, x: number, y: number): void {
    const glint = this.add.ellipse(x, y - 7, 10, 6, 0xd8f0ff, 0.5).setDepth(5);
    glint.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: glint, alpha: 0, scale: 1.7,
      duration: 700, ease: 'Sine.out',
      onComplete: () => glint.destroy(),
    });
    const cropImg = this.tileRects.get(`${col},${row}`)?.crop;
    if (cropImg?.visible) {
      const bs = cropImg.scaleX;
      this.tweens.add({
        targets: cropImg, scaleX: bs * 1.08, scaleY: bs * 1.08,
        duration: 180, yoyo: true, ease: 'Sine.out',
        onComplete: () => cropImg.setScale(bs, bs),
      });
    }
  }

  /** 首次收获「情绪瞬间」对白（含 T2-1 引导提示条）。抽出供正常路径与清晨演出后补播共用 */
  private playFirstHarvestDialogue(): void {

    this.playStory(FIRST_HARVEST_DIALOGUE, () => {
      // T2-1 Day1 引导链：收获 → 出售 → 修复（底部提示条，3 秒自动消失，不打断）
      this.showDialogueText(this.hintText(
        '收获的作物可以拿到青禾镇的商店卖掉换金币！这些收成，是镇上老房子的建材费。',
        '收获的作物可以拿到青禾镇的商店卖掉换金币！这些收成，是镇上老房子的建材费。'));
      this.updateHUD();
    });
  }

  // ================= Plot 批量操作（种植区域交互优化 v0.1） =================

  /**
   * Plot 批量交互入口：按优先级 收获 > 浇水 > 播种 > 锄地，整块田一次执行。
   * 每 Plot 取最高优先级统一执行，避免混合田内各自为政。
   * E-11（2026-08-10）：演出活跃时先完成剩余揭示（再次交互 = 跳过演出），再路由新操作。
   */
  private interactPlot(plotId: FarmPlotId): void {
    this.finishBatchReveal();
    const summary = getPlotSummary(plotId);
    const center = getPlotCenter(plotId);
    if (summary.grown > 0) { this.startBatch(plotId, 'harvest'); return; }
    if (summary.planted > 0) { this.startBatch(plotId, 'water'); return; }
    if (summary.tilled > 0) { this.startBatch(plotId, 'plant'); return; }
    if (summary.empty > 0) { this.startBatch(plotId, 'till'); return; }
    // 全为 watered（成长中）：明确反馈，避免"点了没反应"
    this.flashPlotError(plotId);
    this.showFloatText(center.x, center.y, '作物还在成长，明天再来看看', '#ff8a80');
  }

  /**
   * E-11 批量操作统一执行器（2026-08-10 制作人拍板：方案 A+成长感）：
   * 数据层瞬间完成（与旧批量逻辑完全一致，零存档/平衡风险），视觉分批渐进揭示——
   * "林澈正在整理这一片田"被看见，而不是瞬间完成。
   * 时长分级（按实际操作格数）：≤5 立即；6-15 → 1.5s；16-30 → 2.5s；31+ → 3.5s。
   * 会话内同类操作第 2 次起时长减半（第 3 次再减半，不无限拖）。
   * 跳过：演出期间再次交互（interactPlot 入口 finishBatchReveal）。
   */
  private startBatch(plotId: FarmPlotId, type: 'till' | 'plant' | 'water' | 'harvest'): void {
    const center = getPlotCenter(plotId);
    // 工具前置校验（保持原 tillPlot/waterPlot 反馈）
    if (type === 'till' && getItemCount('old_hoe') <= 0) {
      this.flashPlotError(plotId);
      this.showFloatText(center.x, center.y, '没有锄头，不能锄地', '#ff8a80');
      this.showDialogueText('还没有锄头，先打开庄园大门吧。');
      return;
    }
    if (type === 'water' && getItemCount('old_watering_can') <= 0) {
      this.flashPlotError(plotId);
      this.showFloatText(center.x, center.y, '没有水壶，不能浇水', '#ff8a80');
      this.showDialogueText('还没有水壶，完成播种任务后才能浇水。');
      return;
    }
    // ===== 数据层瞬间完成（收集实际操作格） =====
    const tiles = getPlotTiles(plotId);
    const affected: { col: number; row: number }[] = [];
    let parts = '';
    if (type === 'till') {
      for (const { col, row } of tiles) if (this.tillTileAt(col, row)) affected.push({ col, row });
      parts = `锄地 ×${affected.length}`;
    } else if (type === 'plant') {
      const tilledTotal = getPlotSummary(plotId).tilled;
      if (tilledTotal === 0) return;
      // 第一轮：当前选中的种子；第二轮：其他可用种子补齐（原 plantPlot 逻辑）
      let count = getItemCount(CROP_DEFS[this.selectedCropType].seedItem as any);
      for (const { col, row } of tiles) {
        if (getTileState(col, row) !== 'tilled') continue;
        if (count <= 0) break;
        if (this.plantTileAt(col, row, this.selectedCropType)) { affected.push({ col, row }); count--; }
      }
      if (affected.length < tilledTotal) {
        for (const ct of CROP_TYPES) {
          if (ct === this.selectedCropType) continue;
          let c2 = getItemCount(CROP_DEFS[ct].seedItem as any);
          for (const { col, row } of tiles) {
            if (getTileState(col, row) !== 'tilled') continue;
            if (c2 <= 0) break;
            if (this.plantTileAt(col, row, ct)) { affected.push({ col, row }); c2--; }
          }
        }
      }
      parts = `播种 ×${affected.length}`;
      if (affected.length > 0) this.updateDailyQuestPanel();
    } else if (type === 'water') {
      for (const { col, row } of tiles) if (this.waterTileAt(col, row)) affected.push({ col, row });
      parts = `浇水 ×${affected.length}`;
      if (affected.length > 0) this.updateDailyQuestPanel();
    } else {
      // harvest：byType 汇总（未成熟保留，原 harvestPlot 逻辑）
      const byType = new Map<CropType, number>();
      for (const { col, row } of tiles) {
        const ct = this.harvestTileAt(col, row);
        if (ct) { affected.push({ col, row }); byType.set(ct, (byType.get(ct) ?? 0) + 1); }
      }
      parts = [...byType.entries()].map(([ct, c]) => `${CROP_DEFS[ct].icon}×${c}`).join(' ');
      if (affected.length > 0) this.updateDailyQuestPanel();
    }

    const n = affected.length;
    if (n <= 0) {
      // 无实际操作成功（如播种时无种子）→ 原 plantPlot 错误反馈
      if (type === 'plant') {
        this.flashPlotError(plotId);
        this.showFloatText(center.x, center.y, '没有种子，去镇上商店看看吧', '#ff8a80');
        this.showDialogueText('没有种子了……去镇上的商店买一些吧！');
      }
      this.refreshPlotVisual(plotId);
      return;
    }

    // 音效（批量只播一次，不逐格）
    play(type === 'till' ? 'hoe' : type === 'plant' ? 'plant' : type === 'water' ? 'water' : 'harvest');

    // ===== 小批量（≤5 格）：立即揭示，保持现状手感 =====
    if (n <= 5) {
      this.refreshPlotVisual(plotId);
      const color = type === 'water' ? '#64b5f6' : type === 'harvest' ? '#7ef0a0' : '#ffe082';
      this.showFloatText(center.x, center.y, type === 'harvest' ? `收获 ${parts}` : parts, color);
      return;
    }

    // ===== 大批量：视觉分批揭示（数据已瞬间完成，演出只做"被看见"） =====
    this.showDialogueText(type === 'harvest' ? '正在收获作物……' : '正在整理田地……');
    const session = this.batchSessionCount[type] ?? 0;
    this.batchSessionCount[type] = session + 1;
    let dur = n <= 15 ? 1500 : n <= 30 ? 2500 : 3500;
    if (session >= 1) dur = Math.round(dur * 0.5); // 第 2 次起加速
    if (session >= 2) dur = Math.round(dur * 0.5); // 第 3 次起再加速
    if (dur < 400) dur = 400;
    const step = Math.max(4, Math.ceil(n / Math.max(1, Math.round(dur / 200))));
    this.batchReveal = { plotId, type, tiles: affected, idx: 0, step, total: n, parts, timer: null };
    this.batchReveal.timer = this.time.addEvent({
      delay: 200,
      repeat: -1,
      callback: () => this.tickBatchReveal(),
    });
    // 开场中心特效（整片田"开始动了"）
    if (type === 'till') this.soilDust(center.x, center.y);
    else if (type === 'plant') this.seedDrop(center.x, center.y);
    else if (type === 'water') { this.plotWaterRipple(plotId); this.moistDarken(center.x, center.y); }
  }

  /** E-11 演出推进：每 200ms 揭示一批格子（视觉刷新为结果态 + 逐格轻反馈） */
  private tickBatchReveal(): void {
    const job = this.batchReveal;
    if (!job) return;
    const to = Math.min(job.total, job.idx + job.step);
    for (let i = job.idx; i < to; i++) {
      const { col, row } = job.tiles[i];
      const visual = this.tileRects.get(`${col},${row}`);
      if (visual) {
        this.updateTileVisual(col, row, visual);
      }
      const cx = col * TILE_SIZE + TILE_SIZE / 2;
      const cy = row * TILE_SIZE + TILE_SIZE / 2;
      if (job.type === 'harvest') this.harvestPuff(cx, cy);
      else if (job.type === 'till') this.soilDust(cx, cy);
      else if (job.type === 'plant') this.seedDrop(cx, cy);
      else this.moistDarken(cx, cy);
    }
    job.idx = to;
    this.updateHUD();
    if (to >= job.total) this.finishBatchReveal();
  }

  /** E-11 演出收尾：立即揭示剩余格 + 揭晓飘字（自然结束 / 再次交互跳过共用） */
  private finishBatchReveal(): void {
    const job = this.batchReveal;
    if (!job) return;
    if (job.timer) job.timer.remove();
    this.batchReveal = null;
    for (let i = job.idx; i < job.total; i++) {
      const { col, row } = job.tiles[i];
      const visual = this.tileRects.get(`${col},${row}`);
      if (visual) this.updateTileVisual(col, row, visual);
    }
    this.updateHUD();
    const center = getPlotCenter(job.plotId);
    if (job.type === 'harvest') {
      this.showFloatText(center.x, center.y, job.parts ? `收获 ${job.parts}` : '收获完成', '#7ef0a0');
    } else {
      this.showFloatText(center.x, center.y, job.parts, job.type === 'water' ? '#64b5f6' : '#ffe082');
    }
  }

  /** E-11 收获揭示粒子：单格轻上浮星点（连续出现 = "一整片田在收获"） */
  private harvestPuff(worldX: number, worldY: number): void {
    const p = this.add
      .text(worldX + Phaser.Math.Between(-4, 4), worldY - 6, '✦', { fontSize: '11px', color: '#a8f0c0' })
      .setOrigin(0.5)
      .setDepth(7);
    this.tweens.add({
      targets: p, y: worldY - 18, alpha: 0,
      duration: Phaser.Math.Between(350, 550), ease: 'Quad.Out',
      onComplete: () => p.destroy(),
    });
  }

  /** 刷新某 Plot 全部格子的视觉 + HUD（批量操作后调用一次） */
  private refreshPlotVisual(plotId: FarmPlotId): void {
    for (const { col, row } of getPlotTiles(plotId)) {
      const visual = this.tileRects.get(`${col},${row}`);
      if (visual) this.updateTileVisual(col, row, visual);
    }
    this.updateHUD();
  }

  /** 关闭种子选择器 */
  private closeSeedSelector(): void {
    this.seedSelectorEl?.remove();
    this.seedSelectorEl = null;
  }

  /**
   * 声音总开关切换（2026-08-13 制作人：游戏音乐暂时屏蔽 + 重新打开开关）
   * 关闭：立即停止正在播放的 BGM / 环境音（操作音效与配音由 AudioSystem/VoiceBank 入口拦截）；
   * 打开：按当前地图恢复环境音 + BGM（剧情 > 音乐盒"我的歌" > 地图默认），并播一声确认音。
   */
  private toggleSound(): void {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    if (!next) {
      AmbienceSystem.stop();
      MusicSystem.stop();
      // BUG-FIX（P2）：关声音不停当前句配音——配音只在播放入口被拦截，进行中的
      // AudioBufferSourceNode 会继续播完（与 AudioSystem「覆盖四条链路」的宣称不符）
      VoiceBank.stop();
    } else {
      const hour = getTime().hour;
      AmbienceSystem.start(this.mapKey, hour);
      MusicSystem.playSceneBgm(this.mapKey, hour);
      play('ui_confirm');
    }
  }

  /** 打开归星录·相簿（只读收藏面板） */
  private openPhotoAlbum(): void {
    if (this.photoAlbumPanel?.isOpen()) return;
    if (!this.photoAlbumPanel) {
      this.uiBus.registerPhotoAlbumPanel(new PhotoAlbumPanel());
    }
    this.inputManager.clearAction();
    this.hideShortcutHint();
    this.photoAlbumPanel?.open();
  }

  /** 打开自然记录图鉴（只读信息展示层） */
  private openDiscoveryPanel(): void {
    if (isDiscoveryPanelOpen()) return;
    this.inputManager.clearAction();
    this.hideShortcutHint();
    openDiscoveryPanel();
  }

  /** 开关 HUD 功能菜单 */
  private toggleHudMenu(): void {
    if (isHudMenuOpen()) {
      hudMenuHandleEscape();
      return;
    }
    this.inputManager.clearAction();
    openHudMenu();
  }

  /**
   * 归星录·相簿解锁反馈（v0.10 记忆卡→相簿闭环）：
   * 新照片解锁后待展示；等对话/闪回/相簿都关闭时弹出 toast + 【查看】按钮。
   */
  private notifyPhotoUnlocked(id: string): void {
    this.pendingPhotoUnlock = id;
    this.maybeShowPhotoUnlockToast();
  }

  private maybeShowPhotoUnlockToast(): void {
    if (!this.pendingPhotoUnlock) return;
    const fb = document.getElementById('memory-flashback-overlay');
    const fbActive = !!fb && fb.style.display !== 'none' && fb.innerText.length > 0;
    if (this.storyDialogue?.isOpen() || fbActive || this.photoAlbumPanel?.isOpen()) return;
    this.showPhotoUnlockToast(this.pendingPhotoUnlock);
    this.pendingPhotoUnlock = null;
  }

  private showPhotoUnlockToast(id: string): void {
    this.hidePhotoUnlockToast();
    const photo = PHOTO_DATABASE.find((p) => p.id === id);
    const title = photo ? photo.title : id;
    const toast = document.createElement('div');
    Object.assign(toast.style, {
      position: 'fixed', bottom: '120px', left: '50%', transform: 'translateX(-50%)',
      zIndex: '560', display: 'flex', alignItems: 'center', gap: '10px',
      background: 'radial-gradient(1px 1px at 25% 25%,rgba(216,196,154,0.4) 50%,transparent 51%),rgba(36,41,54,0.95)',
      border: '1px solid rgba(216,196,154,0.5)', borderLeft: '3px solid #d8c49a', borderRadius: '10px',
      padding: '10px 16px', color: '#e8d8c0', fontSize: '14px',
      fontFamily: "'Noto Sans SC','Source Han Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)', pointerEvents: 'auto',
      maxWidth: '90vw', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    });
    const label = document.createElement('span');
    label.textContent = `📖 归星录新增照片《${title}》`;
    const btn = document.createElement('button');
    Object.assign(btn.style, {
      fontSize: '13px', padding: '5px 12px', background: 'linear-gradient(180deg,#6b8fb3,#3e5f82)',
      color: '#f5efdd', border: '1px solid rgba(216,196,154,0.4)', borderRadius: '8px', cursor: 'pointer', flexShrink: '0',
      fontFamily: "'Noto Sans SC','Source Han Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
    });
    btn.textContent = '查看';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hidePhotoUnlockToast();
      this.openPhotoAlbum();
    });
    toast.appendChild(label);
    toast.appendChild(btn);
    document.body.appendChild(toast);
    this.photoUnlockToast = toast;
    window.setTimeout(() => this.hidePhotoUnlockToast(), 6000);
  }

  private hidePhotoUnlockToast(): void {
    if (this.photoUnlockToast) {
      this.photoUnlockToast.remove();
      this.photoUnlockToast = null;
    }
  }

  /**
   * Android 物理返回键处理：按"最上层 UI"优先级逐个关闭。
   * 安全规则：剧情对话打开时只消费返回键、不做任何事——防止误触跳过关键剧情
   * （真机反馈：返回键曾直接跳过夏雅对话/传送到农场导致教程卡死）。
   * @returns true=已消费返回键；false=无 UI 可关（应退场景或退出 App）
   */
  public handleBackButton(): boolean {
    // 剧情对话中：跳过整段（剧情状态正常推进，与 AndroidBackHandler 层级注释一致）；
    // 选项行必须做出选择，不允许跳过（仅消费）
    if (this.storyDialogue && this.storyDialogue.isOpen()) {
      if (!this.storyDialogue.isOptionLine()) this.storyDialogue.skip();
      return true;
    }
    if (this.seedSelectorEl) {
      this.closeSeedSelector();
      return true;
    }
    if (this.endingPanel?.isOpen()) { this.endingPanel.close(); return true; }
    if (this.photoAlbumPanel?.isOpen()) { this.photoAlbumPanel.close(); return true; }
    // BUG-FIX（P1）：以下四个面板此前不在返回键覆盖范围——面板开着按返回键会直接切场景，
    // 且音乐盒/邮箱 DOM 不在 cleanupSceneDom 内 → 残留到新地图
    if (this.musicBoxPanel?.isOpen()) { this.musicBoxPanel.close(); return true; }
    if (this.residentBoardPanel?.isOpen()) { this.residentBoardPanel.close(); return true; }
    if (isMailboxPanelOpen()) { closeMailbox(); return true; }
    if (isWaitPanelOpen()) { closeWaitPanel(); return true; }
    if (discoveryPanelHandleEscape()) return true;
    if (hudMenuHandleEscape()) return true;
    if (this.shopPanel?.isOpen()) { this.shopPanel.close(); return true; }
    if (this.questPanel?.isOpen()) { this.questPanel.close(); return true; }
    if (this.backpackPanel?.isOpen()) { this.backpackPanel.close(); return true; }
    return false;
  }

  /** 农场触屏：作物选择器（预选播种作物，仅切换 selectedCropType，不播种） */
  private showCropPicker(): void {
    this.closeCropPicker();

    const el = document.createElement('div');
    el.id = 'crop-picker';
    el.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.5);z-index:225;user-select:none;';

    const cardStyle =
      'width:min(300px,85vw);background:#3d3226;border:3px solid #8a6a45;border-radius:10px;' +
      'padding:16px;color:#fff;font-family:Arial;box-shadow:0 4px 20px rgba(0,0,0,0.6);';

    let itemsHtml = '';
    for (const ct of CROP_TYPES) {
      const def = CROP_DEFS[ct];
      const count = getItemCount(def.seedItem as any);
      const sel = ct === this.selectedCropType;
      const border = sel ? '2px solid #ffd700' : '2px solid rgba(255,255,255,0.15)';
      const countColor = count > 0 ? '#ffe082' : '#888';
      itemsHtml += `<div class="crop-pick-opt" data-crop="${ct}" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin-bottom:6px;border:${border};border-radius:6px;cursor:pointer;background:rgba(255,255,255,0.06);">
        <span style="font-size:15px;">${itemIconHtml(ct, 18)} ${def.name}</span>
        <span style="font-size:13px;color:${countColor};">×${count}${sel ? ' ✓' : ''}</span>
      </div>`;
    }

    el.innerHTML = `<div style="${cardStyle}">
      <div style="text-align:center;font-size:16px;font-weight:bold;margin-bottom:10px;">选择播种作物</div>
      ${itemsHtml}
      <div style="text-align:center;margin-top:10px;">
        <button id="crop-pick-close" style="font-size:13px;padding:5px 20px;background:#8a6a45;border:none;border-radius:4px;color:#fff;cursor:pointer;">取消 (Esc)</button>
      </div>
    </div>`;
    document.body.appendChild(el);
    this.cropPickerEl = el;

    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'crop-pick-close') { this.closeCropPicker(); return; }
      const opt = target.closest('.crop-pick-opt') as HTMLElement | null;
      if (opt?.dataset.crop) {
        this.selectedCropType = opt.dataset.crop as CropType;
        this.closeCropPicker();
        this.updateHUD();
      }
    });

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); this.closeCropPicker(); window.removeEventListener('keydown', escHandler); }
    };
    // 重开前先清旧的（防御），再挂新引用
    if (this.cropPickerEscHandler) window.removeEventListener('keydown', this.cropPickerEscHandler);
    this.cropPickerEscHandler = escHandler;
    window.addEventListener('keydown', escHandler);
  }

  /** 关闭作物选择器 */
  private closeCropPicker(): void {
    this.cropPickerEl?.remove();
    this.cropPickerEl = null;
    // BUG-FIX（P2 泄漏）：ESC 处理器原本只在按 ESC 时移除——点关闭按钮/选种子/切场景
    // （cleanupSceneDom→closeCropPicker）路径全部泄漏，积累后一次 ESC 连环触发并吞掉其他场景语义
    if (this.cropPickerEscHandler) {
      window.removeEventListener('keydown', this.cropPickerEscHandler);
      this.cropPickerEscHandler = null;
    }
  }

  /** 创建/刷新每日任务面板（public：debug API 调用） */
  createDailyQuestPanel(): void {
    const old = document.getElementById('daily-quest-panel');
    if (old) old.remove();

    const quests = getDailyQuests();
    if (quests.length === 0) return;

    const el = document.createElement('div');
    el.id = 'daily-quest-panel';
    // 触屏设备：左上（避开右侧背包/交互按钮区）；桌面：右上
    // BUG-031：触屏端 top 下移避开状态栏/挖孔屏（env safe-area-inset-top，桌面环境恒为 0 无副作用）
    const panelPos = isTouchDevice()
      ? 'position:fixed;left:8px;top:calc(90px + env(safe-area-inset-top, 0px));'
      : 'position:fixed;right:4px;top:70px;';
    el.style.cssText =
      panelPos + 'width:min(190px,38vw);background:rgba(25,20,15,0.92);' +
      'border:1px solid rgba(138,106,69,0.6);border-radius:10px;padding:6px 8px;color:#fff;font-size:11px;' +
      'font-family:Arial;z-index:10;user-select:none;pointer-events:auto;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);' +
      'display:none;';

    // 分离：可领奖 / 进行中 / 已领奖
    const canClaim = quests.filter(q => q.completed && !q.claimed);
    const active = quests.filter(q => !q.completed && !q.claimed);
    const claimed = quests.filter(q => q.claimed);

    let html = '<div style="text-align:center;font-weight:bold;font-size:12px;margin-bottom:5px;color:#ffd700;letter-spacing:1px;">💠 每日任务</div>';

    // 可领奖（高亮）
    for (const q of canClaim) {
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 4px;margin-bottom:2px;background:rgba(255,215,0,0.12);border-radius:5px;">
        <span style="color:#ffd700;">🎁 ${q.desc}</span>
        <button class="dq-claim" data-id="${q.id}" style="font-size:10px;padding:2px 6px;background:#ffd700;color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">领奖</button>
      </div>`;
    }

    // 进行中
    for (const q of active) {
      const progress = q.target > 1 ? ` <span style="color:#aaa;">${q.progress}/${q.target}</span>` : '';
      html += `<div style="display:flex;align-items:center;padding:3px 4px;margin-bottom:2px;color:#ccc;">
        <span style="margin-right:4px;">⬜</span><span>${q.desc}${progress}</span>
      </div>`;
    }

    // 已领奖（折叠）
    if (claimed.length > 0) {
      html += `<div style="margin-top:3px;padding-top:3px;border-top:1px solid rgba(255,255,255,0.08);color:#555;font-size:10px;text-align:center;">已完成 ${claimed.length}/${quests.length}</div>`;
    }

    el.innerHTML = html;
    document.body.appendChild(el);

    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('dq-claim')) {
        const id = target.dataset.id!;
        if (claimReward(id)) {
          this.updateDailyQuestPanel();
          this.updateHUD();
          this.showDialogueText('💠 奖励已领取！');
        }
      }
    });
  }

  /** 刷新每日任务面板 */
  private updateDailyQuestPanel(): void {
    this.createDailyQuestPanel();
    if (this.questPanel) this.questPanel.refresh();
  }
}
