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
} from '../data/FarmState';
import type { TreeState } from '../data/FarmState';
import {
  getPlotAt,
  getPlotTiles,
  getPlotSummary,
  getPlotRect,
  getPlotCenter,
  type FarmPlotId,
} from '../data/FarmPlot';
import { getProjectShortfall, getQuickBuyCost, isRestored, markRestored, getRevivalLevel } from '../data/FarmRestore';
import { addItem, getItemCount, itemIconHtml } from '../data/Inventory';
import { formatTime, getTime, nextDay as timeNextDay, setTime, setTimeFull, tick as timeTick } from '../data/TimeSystem';
import { getCoins, spendCoins, addCoins, WOOD_BUY_PRICE } from '../data/Economy';
import { addXp, getLevel, getXp, getXpToNext, setOnLevelUp } from '../data/FarmProgress';
import { getStamina, consumeStamina, resetStamina, MAX_STAMINA } from '../data/Stamina';
import { ORE_DEPOSITS, OreDeposit, isOreMined, resetOres, hitOre, getOreHits, getOreHitCost, ORE_MAX_HITS } from '../data/MineState';
import { NPC } from '../entities/NPC';
import { getNPCsForScene, refreshSchedule, updateNPCs, getDailyNpcLine, getMysteryAfterObservatory } from '../systems/NPCSystem';
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
import { triggerOnce, hasTriggered } from '../systems/EventManager';
import { unlockPhoto, isPhotoUnlocked, PHOTO_DATABASE } from '../data/PhotoAlbum';
import { MusicBoxPanel } from '../ui/MusicBoxPanel';
import { showChapterBanner } from '../ui/ChapterBanner';
import { TouchControls, setActionButtonLabel, setWaitHandler } from '../systems/TouchControls';
import { showMemoryMoment } from '../ui/MemoryMoment';
import { playMemoryFlashback } from '../ui/MemoryFlashback';
import { getShardFlashback, SHARD_PROGRESS_LINES, XIYA_LAMP_FLASHBACK, XIYA_GARDEN_FLASHBACK, ELDER_STAR_FLASHBACK, XIYA_PHOTO_FLASHBACK, PLUM_BLOOM_FLASHBACK, SHOP_CROP_ENTRY_DIALOGUE, SHOP_CROP_NEED_DIALOGUE, SHOP_CROP_DONE_DIALOGUE, SHOP_CROP_FLASHBACK } from '../data/MemoryFlashbacks';
import { ShopPanel } from '../ui/ShopPanel';
import { BackpackPanel } from '../ui/BackpackPanel';
import { GiftPanel } from '../ui/GiftPanel';
import { QuestPanel } from '../ui/QuestPanel';
import { openWaitPanel, closeWaitPanel, isWaitPanelOpen } from '../ui/WaitPanel';
import { StoryDialogue } from '../ui/StoryDialogue';
import { EndingPanel } from '../ui/EndingPanel';
import { PhotoAlbumPanel } from '../ui/PhotoAlbumPanel';
import { ResidentBoardPanel } from '../ui/ResidentBoardPanel';
import { getRequestById } from '../systems/ResidentRequestSystem';
import {
  getStoryStep, setStoryStep, advanceStory, isTutorialDone,
  isCh1TownIntroDone, markCh1TownIntroDone,
  isObservatoryComplete, markObservatoryComplete,
  getEndingChoice, setEndingChoice, type EndingChoice, type DialogueLine,
  COLORS,
  XIYA_DIALOGUE, GATE_OPENED_DIALOGUE, SOW_SEEDS_DIALOGUE,
  WATER_CROPS_DIALOGUE, EVENING_DIALOGUE, TOWN_INTRO_DIALOGUE,
  FOREST_SHARD_DIALOGUE, FOREST_LOOKOUT_DIALOGUE, DEMO_ENDING_DIALOGUE, DEMO_ENDING_BRANCHES, DEMO_ENDING_FINALE,
  WOODCUT_TIP_DIALOGUE, MINE_TIP_DIALOGUE, XIYA_DAWN_DIALOGUE, XIYA_EVENING_DIALOGUE, XIYA_EVENING_OBS_DIALOGUE, getGrandpaNote,
  FIRST_MORNING_RESPONSE_DIALOGUE,
  GARDEN_RESTORED_XIYA_DIALOGUE, XIYA_SMALL_THINGS_DIALOGUE,
  OLD_HOUSE_RESTORED_DIALOGUE, FOREST_ROAD_RESTORED_DIALOGUE,
  CARPENTER_RETURN_DIALOGUE,
  ADVENTURER_WELCOME_BACK_DIALOGUE,
  XIYA_GARDEN_TRELLIS_DIALOGUE, XIYA_GARDEN_TRELLIS_DONE_DIALOGUE,
  ELDER_TEA_QUEST_DIALOGUE, ELDER_STAR_SITE_DIALOGUE,
  XIYA_PHOTO_ENTRY_DIALOGUE, XIYA_PHOTO_DONE_DIALOGUE,
  MINER_LAMP_ENTRY_DIALOGUE, MINER_LAMP_NEED_DIALOGUE, MINER_LAMP_DONE_DIALOGUE,
  GARDENER_PLUM_ENTRY_DIALOGUE, GARDENER_PLUM_DONE_DIALOGUE,
  FIRST_HARVEST_DIALOGUE,
  OLD_ROBOT_DIALOGUE,
  XIYA_LETTER_OPEN_DIALOGUE, XIYA_LETTER_FLOWER_DIALOGUE, XIYA_LETTER_RECORD_DIALOGUE, XIYA_LETTER_FINAL_DIALOGUE,
} from '../systems/StorySystem';
import { hasSave, load, apply, save, getLastIncompatibleVersion, clearIncompatibleVersion, SAVE_VERSION, isAutoSaveSuppressed } from '../systems/SaveSystem';
import { play } from '../systems/AudioSystem';
import { MusicSystem } from '../audio/MusicSystem';
import {
  getRobots,
  getRobotAt,
  getRobotCount,
  addRobot,
  runDailyAutomation,
  DEFAULT_ROBOT_RANGE,
  type RobotData,
} from '../systems/AutomationSystem';

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
  /** T3 夏雅「整理旧照片」：老屋修复后，老屋门口事件（一次性入档） */
  sideXiyaPhotoAsked?: boolean;
  sideXiyaPhotoDone?: boolean;
  /** T3 老张「矿灯」：矿洞独立点灯点（铜矿×2，一次性入档） */
  sideMinerLampAsked?: boolean;
  sideMinerLampDone?: boolean;
  /** T3 小梅「小梅花」：小镇花圃种花（环境变化，一次性入档） */
  sideGardenerPlumAsked?: boolean;
  sideGardenerPlumDone?: boolean;
  /** T3.5 商店老板「镇子热闹了」：首次卖出作物后，白天对话触发（一次性入档） */
  sideShopCropAsked?: boolean;
  sideShopCropDone?: boolean;
  /** D-011 夏雅《春深有信·一》：剧情专线 Demo Cut（花田边剧情夏雅，4 段逐步交互，一次性入档） */
  xiyaLetterAsked?: boolean;
  xiyaLetterDone?: boolean;
  /** D-011 剧情阶段（0=未开始 / 1=开场完成 / 2=整理花苗完成 / 3=旧花种记录完成；读档恢复现场用） */
  xiyaLetterStage?: number;
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

  private readonly mapKey: string;
  private player!: Player;
  private wallsLayer!: Phaser.Tilemaps.TilemapLayer;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private spawn: { x: number; y: number } | undefined;
  // 切换中标记，防止同一帧重复触发
  private transitioning = false;
  // create 阶段是否抛错（抛错时显示错误遮罩并停止更新，避免黑屏）
  private createFailed = false;
  // 农田格子视觉对象（仅 farm 场景使用），key = "col,row"
  private tileRects = new Map<string, TileVisual>();
  // 输入管理器（统一键盘/触屏输入，Player 和交互共用）
  private inputManager!: InputManager;
  // 触屏控件（摇杆+交互按钮，DOM 单例，PC 和手机都显示）
  private touchControls!: TouchControls;
  // 商店面板（Phase 0.2，DOM 覆盖层，非独立场景）
  private shopPanel!: ShopPanel;
  // 背包面板（Phase 0.25，DOM 覆盖层，B 键开启）
  private backpackPanel!: BackpackPanel;
  private questPanel!: QuestPanel;
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
  // 移动端点击种田：点击操作后的短暂反馈高亮（key = "col,row"，至 tapFlashUntil 过期）
  private tapFlashKey = '';
  private tapFlashUntil = 0;
  // 剧情对话 UI
  private storyDialogue: StoryDialogue | null = null;
  // FEATURE-038 居民需求板（小镇广场右侧信息板交互物 + DOM 面板）
  private residentBoardMark: Phaser.GameObjects.Container | null = null;
  private residentBoardPanel: ResidentBoardPanel | null = null;
  // P1 家的音乐盒（老屋音乐盒交互物 + DOM 曲目面板，OST 收藏系统）
  private musicBoxMark: Phaser.GameObjects.Container | null = null;
  private musicBoxPanel: MusicBoxPanel | null = null;
  /** 音乐盒首次打开的仪式感（会话级，不入档）：第一次先浮字台词再弹面板 */
  private musicBoxIntroduced = false;
  // P0 爷爷的归星包裹（2026-08-11）：老屋（house）旧木箱交互物 + 包裹面板；一次性 triggerOnce('grandpa_gift_opened')
  private grandpaGiftMark: Phaser.GameObjects.Container | null = null;
  private grandpaGiftPanel: GiftPanel | null = null;
  /** 爷爷包裹交互基准坐标（house 木箱 L1-4 装饰位置中心） */
  private grandpaGiftPos: { x: number; y: number } = { x: 0, y: 0 };
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
  // 视觉 = 全屏暖橙 ADD overlay（提亮整体 + 暗部回暖）+ 暖金光尘粒子（光照感）；
  // 状态持久化 = FarmRestore.isRestored('farmWarm')（随 worldRestore 入档）；
  // 过渡只播一次 = EventManager.triggerOnce('farm_warm_intro')（随 gameState 入档）。
  private farmWarmOverlay: Phaser.GameObjects.Rectangle | null = null;
  private farmWarmParticles: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  // v2 三幕式：第一幕光晕扩散只播一次（本场景实例内）
  private farmWarmPulsePlayed = false;
  // v2.1 夕阳感（2026-08-09 制作人拍板）：世界坐标暖橙垂直渐变天光（顶部亮→底部弱），
  // 模拟"太阳低垂从地图上方斜射"，与全屏罩色叠加出方向层次；depth 4.4 盖地面、不罩 NPC/玩家
  private farmWarmSkyGlow: Phaser.GameObjects.Graphics | null = null;
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
  private sideMinerLampAsked = false;
  private sideMinerLampDone = false;
  private sideGardenerPlumAsked = false;
  private sideGardenerPlumDone = false;
  // T3.5 商店老板「镇子热闹了」flags（随 mapFlags 存档，读档不重复触发）
  private sideShopCropAsked = false;
  private sideShopCropDone = false;
  // D-011 夏雅《春深有信·一》剧情专线 flags（随 mapFlags 存档，读档不重复触发）
  private xiyaLetterAsked = false;
  private xiyaLetterDone = false;
  private xiyaLetterStage = 0;
  /** T3.5 前置：本会话是否卖出过作物（会话级，不入档；读档后需重新卖出才可触发） */
  private shopSoldOnce = false;
  // T3 互动点视觉（场景级，destroy 时清理）
  private xiyaPhotoMark: Phaser.GameObjects.Text | null = null;
  private minerLampGroup: Phaser.GameObjects.Container | null = null;
  private plumMark: Phaser.GameObjects.Text | null = null;
  // D-011 夏雅《春深有信·一》剧情专线场景级对象（花田边剧情夏雅 + 花苗/记录交互点；destroy 时清理）
  private letterXiya: Phaser.GameObjects.Sprite | null = null;
  private letterXiyaLabel: Phaser.GameObjects.Text | null = null;
  private letterFlowerMark: Phaser.GameObjects.Text | null = null;
  private letterRecordMark: Phaser.GameObjects.Text | null = null;
  // 教程进度计数（锄地/播种/浇水各需3次）
  private tutorialProgress = 0;
  private readonly TUTORIAL_TARGET = 3;
  // Demo 结尾：结算界面
  private endingPanel: EndingPanel | null = null;
  /** 归星录·相簿面板（FEATURE-040 后新增，v0.1） */
  private photoAlbumPanel: PhotoAlbumPanel | null = null;
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
  private inStargazeCutscene = false;
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
  private rainOverlay: Phaser.GameObjects.Rectangle | null = null;
  private rainEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private rainActive = false;
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
      sideMinerLampAsked: inst.sideMinerLampAsked,
      sideMinerLampDone: inst.sideMinerLampDone,
      sideGardenerPlumAsked: inst.sideGardenerPlumAsked,
      sideGardenerPlumDone: inst.sideGardenerPlumDone,
      sideShopCropAsked: inst.sideShopCropAsked,
      sideShopCropDone: inst.sideShopCropDone,
      xiyaLetterAsked: inst.xiyaLetterAsked,
      xiyaLetterDone: inst.xiyaLetterDone,
      xiyaLetterStage: inst.xiyaLetterStage,
      dawnXiyaDay: inst.dawnXiyaDay,
      eveningXiyaDay: inst.eveningXiyaDay,
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
      this.sideMinerLampAsked = saved.sideMinerLampAsked ?? false;
      this.sideMinerLampDone = saved.sideMinerLampDone ?? false;
      this.sideGardenerPlumAsked = saved.sideGardenerPlumAsked ?? false;
      this.sideGardenerPlumDone = saved.sideGardenerPlumDone ?? false;
      this.sideShopCropAsked = saved.sideShopCropAsked ?? false;
      this.sideShopCropDone = saved.sideShopCropDone ?? false;
      this.xiyaLetterAsked = saved.xiyaLetterAsked ?? false;
      this.xiyaLetterDone = saved.xiyaLetterDone ?? false;
      this.xiyaLetterStage = saved.xiyaLetterStage ?? 0;
      this.dawnXiyaDay = saved.dawnXiyaDay ?? 0;
      this.eveningXiyaDay = saved.eveningXiyaDay ?? 0;
    }
  }

  /** 场景停止/切换时清理挂载在 document.body 上的 DOM 残留（提示条/种子选择器等） */
  private cleanupSceneDom(): void {
    this.removeTutorialHint();
    this.removeShortcutHint();
    this.closeSeedSelector();
    this.closeCropPicker();
    // 背包/任务面板跨场景清理（防止残留打开态）
    this.backpackPanel?.close();
    this.questPanel?.close();
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
    // E1/E9 夏雅精灵清理（场景切换时销毁，防止残留）
    this.clearDawnXiya();
    this.clearEveningXiya();
    // day2 清晨演出夏雅清理（场景切换时销毁，防止残留；BUG-071）
    this.clearMorningXiya();
    // D-011 《春深有信·一》剧情专线精灵/交互点清理（场景切换时销毁，防止残留）
    this.clearLetterXiya();
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
    const tilesetName = this.mapKey === 'elder_house' ? 'house' : this.mapKey;
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
    // 砍树贴图：树1（阔叶）/树2（松树）/大树（2 格）/树桩（农场场景）
    if (this.mapKey === 'farm') {
      if (!this.textures.exists('tree1')) this.load.image('tree1', 'assets/sprites/tree1.png');
      if (!this.textures.exists('tree2')) this.load.image('tree2', 'assets/sprites/tree2.png');
      if (!this.textures.exists('tree_big')) this.load.image('tree_big', 'assets/sprites/tree_big.png');
      if (!this.textures.exists('stump')) this.load.image('stump', 'assets/sprites/stump.png');
    }
  }

  create(): void {
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
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.stopRain(), this);
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
        if (saveData.player.scene !== 'farm') {
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
    }

    // 出口指示箭头（所有地图场景，帮助玩家找到出口）
    this.setupExitIndicators();

    // 创建当前场景的 NPC（根据 TimeSystem 时间判定 location）
    this.setupNPCs();

    // 镇长不在镇上时，显示提示物品（指引玩家去镇长家）
    if (this.mapKey === 'town') {
      this.setupElderHouseHint();
    }

    // M1-2 农场动态氛围（方案 B：水塘涟漪 / 花草摆动 / 暖色光斑，零资源纯代码）
    if (this.mapKey === 'farm') {
      this.setupFarmAmbience();
      // 西侧海湾（2026-08-10 制作人方案：灯塔岛在农场西边，右上角海角远景撤除）
      this.setupFarmWestCoast();
    }

    // 镇长家室内氛围（暖炉辉光/浮尘/门口柔光，零资源纯代码）
    if (this.mapKey === 'elder_house') {
      this.setupElderHouseAmbience();
    }

    // 灯塔轻量版（2026-08-10 制作人解冻）：探索交互点（航海日志/铭牌/望远镜）
    if (this.mapKey === 'lighthouse') {
      this.setupLighthouseExploration();
      // 视觉打磨（2026-08-10 制作人"功能可用→展示级"）：塔身层次/灯室强化/海岸环境/故事感/光影
      this.setupLighthouseVisuals();
    }

    // 青禾镇氛围（炊烟/窗灯/落叶，零资源纯代码）
    if (this.mapKey === 'town') {
      this.setupTownAmbience();
      // T3 小梅「小梅花」：小镇花圃种花互动点（一次性，读档恢复已开花视觉）
      this.setupGardenerPlum();
      // FEATURE-038 居民需求板（小镇广场右侧信息板交互物）
      this.setupResidentBoard();
      // 镇子商店门面（老板搬回镇上：关闭/营业两态视觉，入口=对话 shopkeeper）
      this.setupTownShop();
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

    // M1-3 爷爷旧花园恢复点（玩家清理荒废角落 → 环境变化 + 存档持久化）
    if (this.mapKey === 'farm') {
      this.setupGardenRestore();
    }

    // FEATURE-037 老屋修复（farm 左下角木屋，资源交付 → 外观替换 + 存档持久化）
    if (this.mapKey === 'farm') {
      this.setupOldHouseRestore();
      // T3 夏雅「整理旧照片」：老屋门口互动点（一次性，读档恢复已完成态）
      this.setupXiyaPhoto();
    }

    // P2 农场复兴视觉化（菜园层次/工具区/树荫/碎石小路，荒废→复兴两态，与 FEATURE-037 联动）
    if (this.mapKey === 'farm') {
      this.setupFarmDecorations();
    }

    // day2 清晨「岛屿的第一声回应」：睡醒后切场景/重进 farm 时尝试触发（trySleep 挂钩点在睡觉时）
    if (this.mapKey === 'farm') {
      // 第0章「回到归星岛」（制作人 2026-08-10 拍板：章节仪式感）：首次踏入归星岛弹 Banner
      // D-025 时序红线（2026-08-11）：当前 Demo 全为第0章《归星》，观星夜之后才进第1章 → 显示 CHAPTER 0
      // 一次性：triggerOnce('chapter1_arrival') 持久化判重（key 保留避免旧档重复触发）；文案制作人定稿，不扩写。
      this.time.delayedCall(450, () => {
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
    this.shopPanel = new ShopPanel(
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
    );

    // 背包面板（DOM 覆盖层；关包时清理 B 键残留；使用钥匙回调）
    this.backpackPanel = new BackpackPanel(
      () => {
        this.inputManager.clearAction();
        this.lastFrameTime = performance.now();
      },
      () => this.useManorKey(),
      () => this.updateHUD(),
      () => this.deployRobot(),
    );
    // 任务面板（v0.5.3-B 任务入口化；关面板清理 J 键残留）
    this.questPanel = new QuestPanel(
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
        sideMinerLampAsked: this.sideMinerLampAsked,
        sideMinerLampDone: this.sideMinerLampDone,
        sideGardenerPlumAsked: this.sideGardenerPlumAsked,
        sideGardenerPlumDone: this.sideGardenerPlumDone,
        sideShopCropAsked: this.sideShopCropAsked,
        sideShopCropDone: this.sideShopCropDone,
        xiyaLetterAsked: this.xiyaLetterAsked,
        xiyaLetterDone: this.xiyaLetterDone,
      }),
    );
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
   * 将相机中心对准世界坐标 (wx, wy)（zoom 内化）。
   * Phaser 3.80 的 centerOn 未缩放：scroll = 目标 - 视口宽/2，
   * zoom=2 下会整体偏移 (宽/4, 高/4)，导致室内小地图贴角（f1 假修复根因）。
   * 这里按世界坐标手算：scroll = wx - (width/2) / zoom。
   */
  private centerCameraOn(wx: number, wy: number): void {
    const cam = this.cameras.main;
    // Phaser preRender: 相机中心世界坐标 midPoint = scroll + width/2（width 为逻辑宽，不除 zoom）。
    // 要让世界点 (wx,wy) 位于屏幕中心 → scroll = wx - width/2。
    // 旧公式 wx - width/2/zoom 会多减一个 zoom 因子，相机中心偏到 wx+width/2*(1-1/zoom)，
    // 室内画面整体偏左上（2026-08-07 修复）。
    cam.scrollX = wx - cam.width / 2;
    cam.scrollY = wy - cam.height / 2;
  }

  /**
   * 镜头缓推：把相机视口中心对准世界坐标 (wx, wy)。
   * Phaser 3.80 pan 语义 = 视口中心（midPoint = scroll + width/2）最终落在 (x, y)，
   * 动画中与结束时均不除 zoom（Pan.js: getScroll/centerOn 均 scroll = 目标 - width/2）。
   * 无需任何 zoom 补偿——旧补偿公式 px = wx - width/2/zoom + width/2 会把中心
   * 额外偏移 width/2*(1-1/zoom)（zoom=2, width=1299 时偏 324.75px），
   * 观星夜演出画面整体偏向右下（#29 反推时的错误前提，2026-08-08 修复）。
   */
  /**
   * 相机平滑移动到世界坐标 (wx, wy)（相机中心）。
   * v0.10.4 重写：改用 tween + 手动 zoom 补偿——原实现 cam.pan 有两个缺陷：
   * ① Phaser Pan 的 destScroll 换算不含 zoom（zoom2 时 pan(504,232) 实际中心只有 304，#29 说的
   *    "zoom 补偿"其实从未实现 → 观星点从未真正居中，画面偏左）；
   * ② 链式 pan（回调里再发新 pan）会被 force=false 吞掉（旧 pan 尚 isRunning 时新 pan 直接 return）
   *    → 观星夜镜头三段回调链断裂，后段不执行。
   * 现实现：tween cam.scrollX/Y，目标 = wx - width/(2*zoom)，链式靠 tween onComplete，无 force 问题。
   */
  private panCameraTo(wx: number, wy: number, duration: number, onComplete?: () => void): void {
    const cam = this.cameras.main;
    const destX = wx - cam.width / (2 * cam.zoom);
    const destY = wy - cam.height / (2 * cam.zoom);
    this.tweens.add({
      targets: cam,
      scrollX: destX,
      scrollY: destY,
      duration,
      ease: 'Power2',
      onComplete: () => onComplete?.(),
    });
  }

  /**
   * v2 观星夜分支独白"拉近"：围绕世界点 (wx,wy) 缩放，保持该点始终在镜头中心。
   * 不用 Phaser zoomTo（其只改 zoom 不改 scroll，放大围绕左上角，角色会偏出画面）：
   * tween 一个线性 progress，每帧按 zoom 反算 scroll（scroll = center - size/(2*zoom)），
   * 保证"世界点钉在屏幕中心"，与 panCameraTo 的 zoom 补偿同一套公式（#29 同源）。
   */
  private zoomCameraAt(wx: number, wy: number, toZoom: number, duration: number, onComplete?: () => void): void {
    const cam = this.cameras.main;
    const from = cam.zoom;
    this.stargazeDriftTween?.stop(); // 先停对话慢横移，避免 scrollX 双写冲突
    this.stargazeDriftTween = null;
    this.tweens.add({
      targets: { p: 0 },
      p: 1,
      duration,
      ease: 'Sine.out',
      onUpdate: (_t, target: { p: number }) => {
        const zoom = from + (toZoom - from) * target.p;
        cam.zoom = zoom;
        cam.scrollX = wx - cam.width / (2 * zoom);
        cam.scrollY = wy - cam.height / (2 * zoom);
      },
      onComplete: () => onComplete?.(),
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

    // Demo 结算界面打开：冻结移动/交互，等待「继续自由游玩」
    if (this.endingPanel?.isOpen()) {
      this.player.setVelocity(0, 0);
      this.inputManager.clearAction();
      return;
    }

    // v0.10.4 观星夜演出期间：冻结玩家移动/交互，避免演出中可移动触发
    // 场景切换/其他交互把 pan 链打断（段3 onComplete=对话播放 会随场景 tween 销毁
    // 而永不执行 → 真机表现为"特效出现了、剧情没触发、人物还能动"）。
    // 只放行观星对白推进（观星对话由段3 onComplete 在 8s 后打开，此期间玩家应不可动）。
    if (this.inStargazeCutscene) {
      this.player.setVelocity(0, 0);
      this.inputManager.clearAction();
      // 演出期间保留星空闪烁/观星点视觉（观星点此时已 markObservatoryComplete 自动隐藏）
      this.updateStarField();
      this.updateStargaze();
      if (this.storyDialogue?.isOpen()) {
        this.inputManager.update();
        if (this.inputManager.consumeAction()) {
          this.storyDialogue.advance();
        }
      }
      return;
    }

    // 归星录·相簿打开：冻结玩家移动/交互，只响应关闭（Esc 或按钮）
    if (this.photoAlbumPanel?.isOpen()) {
      this.player.setVelocity(0, 0);
      this.inputManager.clearAction();
      return;
    }

    // FEATURE-038 需求板打开：冻结玩家移动/交互，只响应关闭（E 或 Esc）
    if (this.residentBoardPanel?.isOpen()) {
      this.player.setVelocity(0, 0);
      if (this.inputManager.consumeAction()) {
        this.residentBoardPanel.close();
      }
      return;
    }

    // 商店打开：冻结时间/玩家移动/NPC/交互，只响应关闭
    // 关闭方式：E/空格/回车（consumeAction）或 Esc（ShopPanel DOM 监听）
    if (this.shopPanel.isOpen()) {
      // 冻结玩家物理：防止开店前残留的速度让角色在商店界面背后滑动
      this.player.setVelocity(0, 0);
      if (this.inputManager.consumeAction()) {
        this.shopPanel.close();
      }
      return;
    }

    // 背包打开：冻结时间/玩家移动/NPC/交互，只响应关闭
    if (this.backpackPanel.isOpen()) {
      this.player.setVelocity(0, 0);
      // B 键关闭
      if (Phaser.Input.Keyboard.JustDown(this.inputManager.keyB)) {
        this.backpackPanel.close();
      }
      return;
    }

    // 任务面板打开：冻结时间/玩家移动/NPC/交互，只响应关闭
    if (this.questPanel.isOpen()) {
      this.player.setVelocity(0, 0);
      // J 键关闭
      if (Phaser.Input.Keyboard.JustDown(this.inputManager.keyJ)) {
        this.questPanel.close();
      }
      return;
    }

    // 等待面板打开（E-09）：冻结时间/玩家移动/NPC/交互，只响应关闭
    if (isWaitPanelOpen()) {
      this.player.setVelocity(0, 0);
      // T 键关闭
      if (Phaser.Input.Keyboard.JustDown(this.inputManager.keyT)) {
        closeWaitPanel();
      }
      return;
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
    // 种子切换冷却递减
    if (this.seedSwitchCooldown > 0) this.seedSwitchCooldown -= dtMs;

    // 观星点显隐 + 呼吸动画（主线完成 + 夜晚时显示）
    this.updateStargaze();
    // 星空闪烁动画
    this.updateStarField();
    // P0-5 农场回暖 v2：暖度随时辰平滑趋近（第二幕时间感）+ 光尘密度微调
    this.updateFarmWarm();

    // 剧情对话打开时：禁止移动，E/空格推进对话
    if (this.storyDialogue) {
      if (this.storyDialogue.isOpen()) {
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

    // P3-01 灯塔"黑"阶段：靠近西侧海湾（locked 出口）一次性提示——"海那边有一座熄灭的灯塔"
    this.checkLighthouseSeaHint();

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

    // 后山观景台：靠近一次性触发环境铺垫对白
    this.checkForestLookout();

    this.player.update();

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
      if (ex.locked) continue;
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
    const elderSpot = { x: 13 * TILE_SIZE + TILE_SIZE / 2, y: 10 * TILE_SIZE + TILE_SIZE / 2 };
    
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
    if (dx * dx + dy * dy > 28 * 28) return false;
    
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
   * 位置 (22,8)：已验证 Walls 层 gid=0 可走，距所有 NPC 站位 >48px，无交互冲突。
   * 视觉：木牌 + 📌 顶钉 + 下方「需求板」标签 + 呼吸动画（参照 setupElderHouseHint 模式）。
   */
  private setupResidentBoard(): void {
    if (this.mapKey !== 'town') return;
    const T = TILE_SIZE;
    const bx = 22 * T + T / 2;
    const by = 8 * T + T / 2;
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
      this.musicBoxPanel = new MusicBoxPanel(() => this.resumeHouseBgm());
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

    if (!this.grandpaGiftPanel) this.grandpaGiftPanel = new GiftPanel();
    this.inputManager.clearAction();
    this.grandpaGiftPanel.open(() => this.grantGrandpaGift());
    return true;
  }

  /** 发放爷爷的归星包裹（纪念物 + 启动资源；一次性 triggerOnce 入档，防重复领取） */
  private grantGrandpaGift(): void {
    triggerOnce('grandpa_gift_opened', () => {
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
      save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing });
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
      this.residentBoardPanel = new ResidentBoardPanel((reqId) => this.onResidentDeliver(reqId));
    }
    this.inputManager.clearAction();
    // 需求板引导任务：打开一次即完成；首次打开标记 board_quest_done（防后续重复投放）
    onDQOpenBoard();
    triggerOnce('board_quest_done', () => {
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      });
    });
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
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    this.storyDialogue.play(
      [{ speaker: req.npcName, color: req.npcColor, text: req.rewardDialogue }],
      () => {
        save({
          x: this.player.x, y: this.player.y,
          scene: this.mapKey, facing: this.player.facing,
          dailyQuest: getDailyQuestSaveData(),
        });
      },
    );
  }

  /**
   * 天气系统 v0.10-lite：设置雨天覆盖层+雨粒子
   * 仅在雨天时创建，非雨天不创建任何对象（零开销）
   */
  private setupWeather(): void {
    if (isCurrentlyRaining()) {
      this.startRain();
    }
  }

  /**
   * 更新天气状态（每小时调用一次）
   * 检查天气变化并相应地启动/停止雨天效果
   */
  private updateWeatherState(): void {
    const isRaining = isCurrentlyRaining();
    if (isRaining && !this.rainActive) {
      this.startRain();
    } else if (!isRaining && this.rainActive) {
      this.stopRain();
    }
  }

  /**
   * 开始下雨效果：半透明覆盖层 + 雨粒子
   */
  private startRain(): void {
    // 仅室外地图下雨（与 AmbienceSystem.RAIN_MAPS 一致：矿洞/屋内/车站有顶不下雨）
    if (!AmbienceSystem.RAIN_MAPS.includes(this.mapKey)) return;
    if (this.rainActive) return;
    this.rainActive = true;

    const map = this.make.tilemap({ key: this.mapKey });

    // 雨天覆盖层：半透明蓝色矩形，覆盖整个屏幕（setScrollFactor(0) 为屏幕空间，
    // 用相机视口尺寸而非地图尺寸，否则小地图四周会露出蓝色矩形边框，BUG-050）
    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;
    this.rainOverlay = this.add.rectangle(
      camW / 2, camH / 2,
      camW, camH,
      0x334466, 0.2
    );
    this.rainOverlay.setDepth(100);
    this.rainOverlay.setScrollFactor(0);

    // 创建白色像素纹理用于雨粒子（如果不存在）
    if (!this.textures.exists('__WHITE')) {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 8;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 2, 8);
      this.textures.addCanvas('__WHITE', canvas);
    }

    // 雨粒子：从天空飘落的白色短线条
    const particles = this.add.particles(0, 0, '__WHITE', {
      x: { min: 0, max: map.widthInPixels },
      y: -10,
      lifespan: 2000,
      speedY: { min: 200, max: 350 },
      speedX: { min: -30, max: -10 },
      quantity: 2,
      frequency: 50,
      blendMode: 'ADD',
      alpha: { start: 0.4, end: 0.1 },
      scale: { start: 0.5, end: 0.3 },
      tint: 0xaaaacc,
    });
    particles.setDepth(101);
    particles.setScrollFactor(0);
    this.rainEmitter = particles;

    // 雨天环境音：交给 AmbienceSystem 统一叠加（共享已 resume 的 AudioContext，
    // 受 MAX_SOURCES/MAX_VOL 约束；切场景由 start/stop 可靠清理，不重复造 AudioContext）
    AmbienceSystem.setRain(true);
  }

  /**
   * 停止雨天效果
   */
  private stopRain(): void {
    if (!this.rainActive) return;
    this.rainActive = false;

    // 雨天环境音：交给 AmbienceSystem 统一停止（rainActive 意图按天气重新派生）
    AmbienceSystem.setRain(false);

    if (this.rainOverlay) {
      this.rainOverlay.destroy();
      this.rainOverlay = null;
    }

    if (this.rainEmitter) {
      this.rainEmitter.destroy();
      this.rainEmitter = null;
    }
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
    this.dawnXiya.setScale(0.5).setDepth(5);
    this.dawnXiyaLabel = this.add.text(dx, dy - 14, '夏雅', {
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
    if (dx * dx + dy * dy > 28 * 28) return false;

    this.dawnXiyaDay = getTime().day;
    this.dawnXiya.destroy();
    this.dawnXiya = null;
    if (this.dawnXiyaLabel) { this.dawnXiyaLabel.destroy(); this.dawnXiyaLabel = null; }
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    // E1/E9 修复（2026-08-06）：当天已触发标记立即入档，刷新后同一天不再重复触发
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    this.storyDialogue.play(XIYA_DAWN_DIALOGUE, () => {
      this.updateHUD();
    });
    return true;
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
    if (this.inStargazeCutscene) return; // v0.10.4 观星夜演出中不触发
    if (!isTutorialDone()) return;
    if (getTime().day < 2) return;
    if (hasTriggered('first_morning_response')) return;
    if (this.firstMorningDone) return;
    this.firstMorningDone = true;
    triggerOnce('first_morning_response', () => {
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
      this.morningXiyaLabel = this.add.text(mx, my - 14, '夏雅', {
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
        this.storyDialogue.play(FIRST_MORNING_RESPONSE_DIALOGUE, () => {
          // ④ 对白结束：注入复兴引导任务（收获/种植/清理）→ 刷新面板/HUD → 存档（含 triggerOnce 状态）
          injectRevivalQuests();
          this.createDailyQuestPanel();
          this.updateQuestHUD();
          // 演出精灵生命周期闭合（BUG-071：对白结束夏雅离开，防止僵尸夏雅与后续时段实例同场）
          this.clearMorningXiya();
          save({
            x: this.player.x, y: this.player.y,
            scene: this.mapKey, facing: this.player.facing,
            dailyQuest: getDailyQuestSaveData(),
          } as any);
        });
      });
    });
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
        if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
        this.storyDialogue.play(CARPENTER_RETURN_DIALOGUE, () => {
          // ④ 对白结束：木匠成为常驻 NPC → 刷新 HUD → 存档（含 triggerOnce 状态）
          this.updateHUD();
          save({
            x: this.player.x, y: this.player.y,
            scene: this.mapKey, facing: this.player.facing,
            dailyQuest: getDailyQuestSaveData(),
          } as any);
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
        if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
        this.storyDialogue.play(ADVENTURER_WELCOME_BACK_DIALOGUE, () => {
          // 对白结束：阿风离开（移除演出精灵）→ 刷新 HUD → 存档（含 triggerOnce 状态）
          this.adventurerWelcomeSprite?.destroy();
          this.adventurerWelcomeSprite = null;
          this.adventurerWelcomeLabel?.destroy();
          this.adventurerWelcomeLabel = null;
          this.updateHUD();
          save({
            x: this.player.x, y: this.player.y,
            scene: this.mapKey, facing: this.player.facing,
            dailyQuest: getDailyQuestSaveData(),
          } as any);
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
    this.eveningXiyaLabel = this.add.text(dx, dy - 14, '夏雅', {
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
    if (dx * dx + dy * dy > 28 * 28) return false;

    this.eveningXiyaDay = getTime().day;
    this.eveningXiya.destroy();
    this.eveningXiya = null;
    if (this.eveningXiyaLabel) { this.eveningXiyaLabel.destroy(); this.eveningXiyaLabel = null; }
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    // E1/E9 修复（2026-08-06）：当天已触发标记立即入档，刷新后同一天不再重复触发
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
    this.storyDialogue.play(XIYA_EVENING_DIALOGUE, () => {
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
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    this.storyDialogue.play(XIYA_EVENING_OBS_DIALOGUE, () => {
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
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    this.storyDialogue.play(lines);
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
  private setupFarmAmbience(): void {
    const T = TILE_SIZE; // 16

    // 1) 水塘涟漪：Walls 层水塘区 (cols 31-33, rows 19-22)，3 个错落扩散光斑
    const pond: Array<{ c: number; r: number }> = [
      { c: 31, r: 20 }, { c: 32, r: 21 }, { c: 33, r: 19 },
    ];
    pond.forEach((p, i) => {
      const ring = this.add.graphics();
      ring.fillStyle(0x9fd8f5, 0.32);
      ring.fillCircle(0, 0, 4);
      ring.setPosition(p.c * T + T / 2, p.r * T + T / 2);
      ring.setDepth(2);
      this.tweens.add({
        targets: ring,
        scale: { from: 0.3, to: 1.15 },
        alpha: { from: 0.55, to: 0 },
        duration: 2200,
        delay: i * 700,
        repeat: -1,
        ease: 'Quad.Out',
      });
    });

    // 2) 花草摆动已删除（2026-08-07 制作人反馈：花精灵左右摆动动效违和，
    //    静态花丛瓦片 gid 8 保留，花园区域不再叠动态花精灵）

    // 3) 暖色光斑：农田上空缓慢漂移（低透明度大圆，模拟日光斑驳）
    const glow = this.add.graphics();
    glow.fillStyle(0xffeec8, 0.13);
    glow.fillCircle(0, 0, 34);
    glow.setPosition(20 * T, 12 * T);
    glow.setDepth(2);
    this.tweens.add({
      targets: glow,
      x: { from: 20 * T - 26, to: 20 * T + 26 },
      y: { from: 12 * T - 14, to: 12 * T + 14 },
      duration: 6000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  /**
   * 农场西侧海湾（2026-08-10 制作人方案：灯塔岛在农场西边，右上角海角远景撤除）
   * 农场左侧中部（cols 0-2, rows 10-13）石墙打通为海湾缺口：玩家看到西边是海，
   * 但出口 locked（未来内容预埋）不可进入——灯塔内容统一在 lighthouse 场景呈现。
   * 纯 Graphics 零资源；不触碰碰撞/存档/出口玩法（出口锁定由 exits.ts locked 控制）。
   * 未来：城市复兴 → 执灯人归来 → 灯塔重新点灯 → 移除 locked，玩家从海湾走向灯塔岛。
   */
  private setupFarmWestCoast(): void {
    const night = getTime().hour >= 18 || getTime().hour < 6;

    // 1) 海面：西侧海湾（x 0-40, y 144-224），覆盖缺口 + 向左延伸（海从岛西边来）
    const sea = this.add.graphics();
    const deep = night ? 0x0a1a2a : 0x2a5a7a;
    const shore = night ? 0x12283c : 0x3a6a8c;
    sea.fillStyle(deep, night ? 0.95 : 0.92);
    sea.fillRect(0, 144, 40, 80);
    sea.fillStyle(shore, night ? 0.55 : 0.5);
    sea.fillRect(0, 144, 10, 80);
    // 波光（白天白点闪烁）
    if (!night) {
      sea.fillStyle(0x9ec8e8, 0.55);
      for (const [bx, by] of [[8, 156], [20, 170], [30, 150], [6, 190], [26, 205], [14, 216]]) sea.fillRect(bx, by, 2, 2);
    }
    sea.setDepth(2);

    // 2) 浪花（海陆交界白沫，潮汐呼吸）
    const surf = this.add.graphics();
    surf.fillStyle(0xcfeeff, 0.6);
    for (const [sx, sy, sw] of [[36, 150, 7], [34, 170, 6], [37, 192, 8], [34, 210, 6], [37, 218, 5]]) {
      surf.fillRect(sx, sy, sw, 3);
    }
    surf.setDepth(2.4);
    this.tweens.add({ targets: surf, alpha: { from: 0.35, to: 0.85 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // 3) 沙滩过渡（缺口边缘草地→沙色，营造"海边"感；不覆盖草地可通行）
    const sand = this.add.graphics();
    sand.fillStyle(0xd8c9a0, 0.4);
    for (const [dx, dy, dw, dh] of [[40, 150, 26, 8], [36, 166, 32, 6], [42, 184, 24, 7], [38, 202, 30, 6], [44, 216, 22, 6]]) {
      sand.fillRect(dx, dy, dw, dh);
    }
    sand.fillStyle(0x9a8a6a, 0.3);
    for (const [px, py] of [[46, 160], [56, 176], [50, 196], [60, 210]]) sand.fillRect(px, py, 3, 2);
    sand.setDepth(2);

    // 3.5) 灯塔远景剪影（2026-08-10 制作人反馈"去灯塔早期被堵住、没有提示"）：
    //      P3-01 灯塔"黑"阶段：海湾深处立一座熄灭的灯塔——玩家"看得见"海那边有座塔（制造牵挂），
    //      而不是面对一片空海。纯 Graphics 零资源；不触碰碰撞/存档/出口玩法（出口锁定仍由 exits.ts 控制）。
    const lh = this.add.graphics();
    const lhCol = night ? 0x0c141e : 0x2e3c4e; // 塔身：夜晚近黑剪影 / 白天深蓝灰
    // 礁石基座（塔基下两侧，模拟海上礁石岛）
    lh.fillStyle(night ? 0x0a111a : 0x26313e, 0.9);
    lh.fillRect(2, 198, 10, 14);
    lh.fillRect(26, 196, 10, 16);
    // 塔身
    lh.fillStyle(lhCol, 0.92);
    lh.fillRect(11, 152, 14, 48);
    // 塔身横纹（风化层次）
    lh.lineStyle(1, night ? 0x000000 : 0x1c2632, 0.5);
    for (const yy of [160, 168, 176, 184, 192]) {
      lh.beginPath(); lh.moveTo(11, yy); lh.lineTo(25, yy); lh.strokePath();
    }
    // 塔基台阶线
    lh.lineStyle(1, night ? 0x000000 : 0x1c2632, 0.6);
    lh.beginPath(); lh.moveTo(9, 198); lh.lineTo(27, 198); lh.strokePath();
    // 灯室（熄灭：全黑剪影 + 窗棂，无光——灯塔"黑"阶段，不画任何光）
    lh.fillStyle(night ? 0x060a10 : 0x1a2430, 0.95);
    lh.fillRect(13, 140, 10, 12);
    lh.lineStyle(1, night ? 0x000000 : 0x10161e, 0.6);
    lh.beginPath(); lh.moveTo(18, 140); lh.lineTo(18, 152); lh.strokePath(); // 窗棂
    lh.beginPath(); lh.moveTo(13, 146); lh.lineTo(23, 146); lh.strokePath();
    // 塔顶护栏（灯室上方细横条）
    lh.fillStyle(lhCol, 0.95);
    lh.fillRect(10, 136, 16, 4);
    lh.setDepth(2.2);
    // 海雾呼吸（远景若有若无，营造"海那边"的牵挂感）
    lh.setAlpha(0.55);
    this.tweens.add({ targets: lh, alpha: { from: 0.4, to: 0.7 }, duration: 3400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // 4) 海面碰撞墙（挡玩家进入海区 x<40；玩家贴海边站立看海）
    const wall = this.add.rectangle(20, 184, 40, 80, 0x000000, 0);
    wall.setDepth(4);
    this.physics.add.existing(wall, true);
    this.physics.add.collider(this.player, wall);

    // 5) 夜晚氛围：星点（海湾上空）+ 月光银带（海面反光）
    if (night) {
      const stars = this.add.graphics();
      stars.fillStyle(0xffffff, 0.7);
      let seed = 13;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 14; i++) stars.fillRect(rnd() * 40, 120 + rnd() * 24, 1, 1);
      stars.setDepth(2.8);
      this.tweens.add({ targets: stars, alpha: { from: 0.4, to: 1 }, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const moon = this.add.graphics();
      moon.fillStyle(0xa9c4ff, 0.25);
      moon.fillRect(6, 150, 4, 70);
      moon.setDepth(2.8);
      this.tweens.add({ targets: moon, alpha: { from: 0.1, to: 0.35 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
  }

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
    const chimneys: Array<[number, number]> = [
      [6 * T, 2.5 * T],   // 左上屋
      [22 * T, 2.5 * T],  // 右上屋
      [6 * T, 11.5 * T],  // 左下屋
      [22 * T, 11.5 * T], // 右下屋
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
        [5 * T + 8, 6 * T + 8],  [8 * T + 8, 6 * T + 8],   // 左上屋
        [21 * T + 8, 6 * T + 8], [24 * T + 8, 6 * T + 8],  // 右上屋
        [5 * T + 8, 15 * T + 8], [8 * T + 8, 15 * T + 8],  // 左下屋
        [21 * T + 8, 15 * T + 8], [24 * T + 8, 15 * T + 8], // 右下屋
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
    const trees: Array<[number, number]> = [
      [11 * T + 8, 3 * T + 8],
      [18 * T + 8, 3 * T + 8],
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

    woodpile(2, 4); woodpile(26, 4);          // 木柴堆：左上屋左侧 / 右上屋右侧
    pot(10, 7, 0xf0d080); pot(26, 7, 0xe8a0a0); pot(3, 13, 0xc0a0e8); // 花盆 ×3
    bucket(2, 5); bucket(27, 5);              // 水桶
    crate(11, 4); crate(27, 13);              // 木箱
    cart(28, 4);                              // 小推车
    clothesline(3, 8);                        // 晾衣架
    stool(23, 8);                             // 石凳（右上屋南侧广场边）
    broom(26, 14);                            // 扫帚（右下屋旁）
    stone(5, 9, 2.5); stone(22, 9, 2); stone(29, 6, 2.5); stone(4, 17, 2); // 路边石 ×4
    grass(1, 10, 0x4a8a30); grass(11, 9, 0x5a9a3a); grass(17, 9, 0x4a8a30);
    grass(7, 18, 0x5a9a3a); grass(13, 19, 0x4a8a30); grass(25, 18, 0x5a9a3a); // 草丛 ×6

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
    // 顶部树 → 左上屋顶；广场南树 → 左下屋顶
    birdFly(12 * T + 8, 3 * T + 8, 6 * T + 8, 2.5 * T + 8, 0);
    birdFly(16 * T + 8, 3 * T + 8, 22 * T + 8, 2.5 * T + 8, 900);

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
    cat(7, 6, 'c1');   // 左上屋墙角
    cat(25, 14, 'c2'); // 右下屋墙角

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
    // 放置：道路两侧 + 出口附近的遮挡（避开 NPC 站位与交互点）
    fgGrass(3, 12, 0x3a7a28); fgGrass(20, 12, 0x4a8a30);
    fgGrass(10, 13, 0x3a7a28); fgGrass(24, 6, 0x4a8a30);
    fgGrass(1, 11, 0x3a7a28); fgGrass(27, 15, 0x4a8a30); // 出口附近
    fgRock(4, 11, 2.5); fgRock(25, 12, 2);

    // ---- 3) 晨雾（06-09 时）：低透明度雾带缓慢横移，白天零创建 ----
    if (t.hour >= 6 && t.hour < 9) {
      const fogSpots: Array<[number, number]> = [[6, 3], [15, 3], [24, 3]];
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
      const glowSpots: Array<[number, number]> = [[12, 4], [17, 4], [7, 10]];
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
      if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
      this.storyDialogue.play(FOREST_LOOKOUT_DIALOGUE, () => {
        this.updateHUD();
        save({
          x: this.player.x, y: this.player.y,
          scene: this.mapKey, facing: this.player.facing,
          dailyQuest: getDailyQuestSaveData(),
        } as any);
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
      if (ex.locked) continue;
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
      this.add.text(xiyaX, xiyaY - 14, '夏雅', {
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

    pot(10, 10, 0xf0d080); pot(18, 10, 0xe8a0a0);   // 花盆 ×2（大门两侧前院）
    woodpile(20, 12);                                // 木柴堆（右侧空地）
    stool(3, 12);                                    // 石凳（左侧树荫下）
    bucket(25, 9);                                   // 水桶（右院墙脚）
    crate(20, 10);                                   // 木箱（右院）
    stone(2, 12, 2.5); stone(23, 9, 2); stone(27, 12, 2.5); // 路边石 ×3
    grass(9, 13, 0x4a8a30); grass(19, 13, 0x5a9a3a);
    grass(18, 14, 0x4a8a30); grass(5, 10, 0x5a9a3a); // 草丛 ×4

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
    if (dx * dx + dy * dy > 28 * 28) return false;

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
   * 灯塔海角提示（2026-08-10 制作人反馈"去灯塔早期直接被堵住、没有提示"）：
   * 玩家走到农场西侧海湾（灯塔 locked 出口触发区）时，一次性轻提示——
   * 让玩家知道海那边立着一座熄灭的灯塔（制造牵挂，不破坏神秘感），而不是"莫名其妙被堵住"。
   * 触发区：exits.ts farm 西侧海湾 locked 出口 (36,160,28,48)；海面碰撞墙挡 x<40，
   * 玩家贴海站立中心必落在区内。一次性入档（lighthouseSeaHintShown），读档不重复。
   * 教程未完成不提示（与 updateBoundaryTip 一致，避免抢占教程引导注意力）。
   */
  private checkLighthouseSeaHint(): void {
    if (this.mapKey !== 'farm') return;
    if (this.lighthouseSeaHintShown) return;
    if (!isTutorialDone()) return;
    const x = this.player.x;
    const y = this.player.y;
    // locked 出口触发区外扩 8px（玩家贴海站立 x≈46-64，保证命中）
    if (x >= 36 - 8 && x <= 64 + 8 && y >= 160 - 8 && y <= 208 + 8) {
      this.lighthouseSeaHintShown = true;
      this.showDialogueText('西边的海雾里立着一座灯塔。塔灯灭了很多年——也许有一天，会有人重新把它点亮。');
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
    window.setTimeout(() => {
      setTime(destHour, 0);
      refreshSchedule(); // NPC 位置按新时间刷新
      this.updateHUD();
      if (fade) fade.style.opacity = '0';
    }, 420);
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
    const event = triggerRandomEvent();
    if (!event) return;
    
    // 使用 StoryDialogue 播放事件对话
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    this.storyDialogue.play(event.dialogue);
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
    let lines = npc.dialogues;
    const today = getTime().day;
    if (this.npcDailySaid.get(npc.id) !== today) {
      const daily = getDailyNpcLine(npc.id, today);
      if (daily) {
        lines = [...npc.dialogues, ...daily];
        this.npcDailySaid.set(npc.id, today);
      }
    }
    // v0.5.3 剧情密度 E6：观星夜后少女追加一句（仅观星完成，追加到固定对话末尾）
    if (npc.id === 'mystery' && isObservatoryComplete()) {
      lines = [...lines, ...getMysteryAfterObservatory()];
    }
    // 2026-08-11 制作人拍板（商人回镇 + 商店剧情化）：镇子商店状态剧情（关闭 → 带作物开店 → 营业）
    // 优先级最高：触发时完全替代默认欢迎词（避免「店门关着还欢迎光临」的矛盾）
    const stateLines = this.buildShopStateDialogue();
    // T3.5 商店老板「镇子热闹了」：首次卖出作物后，白天对话触发（一次性）
    // 在欢迎剧本前注入入口对白（asked）或交付链（done），不抢走 shopkeeper 打开商店流程
    const shopSide = this.buildShopSideDialogue();
    // SHOP-01 商店复兴：老板「复兴度观察者」三阶段台词（档位推进才播，优先级低于 T3.5 事件链）
    const revivalLines = this.buildShopRevivalDialogue();
    const finalLines = stateLines
      ? stateLines
      : shopSide
        ? [...shopSide, ...(revivalLines ?? []), ...lines]
        : revivalLines
          ? [...revivalLines, ...lines]
          : lines;
    this.storyDialogue.play(finalLines, () => {
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
    });
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
          save({
            x: this.player.x, y: this.player.y,
            scene: this.mapKey, facing: this.player.facing,
            dailyQuest: getDailyQuestSaveData(),
          } as any);
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
   * 渲染农田可耕区域的格子覆盖层
   * 状态非 empty 的格子显示深棕色方块（覆盖在 soil 瓦片之上）
   * 场景切换回来时，从全局 FarmState 恢复已锄地块的显示
   */
  private setupFarmTiles(): void {
    for (let r = FARM_AREA.row0; r <= FARM_AREA.row1; r++) {
      for (let c = FARM_AREA.col0; c <= FARM_AREA.col1; c++) {
        const cx = c * TILE_SIZE + TILE_SIZE / 2;
        const cy = r * TILE_SIZE + TILE_SIZE / 2;
        // 可种植土地地块贴图（16×16 五态：耕地/播种/浇水/生长/成熟，覆盖在 soil 瓦片上）
        const plot = this.add.image(cx, cy, 'farm_plot', 0);
        plot.setDepth(2);
        // 作物标记（绿色小椭圆，planted/watered/grown 时显示）
        const crop = this.add.image(cx, cy, 'crops', 0);
        crop.setScale(0.5);
        crop.setDepth(3);
        crop.setVisible(false);
        const visual: TileVisual = { plot, crop };
        // 从全局状态恢复显示（场景切换回来时保留已锄/已种地块）
        this.updateTileVisual(c, r, visual);
        this.tileRects.set(`${c},${r}`, visual);
      }
    }
  }

  /**
   * 根据土地状态刷新单格视觉
   * empty: 全部隐藏
   * tilled: 深棕土地，无作物
   * watered: 湿润深棕土地 + 作物（若已种）
   * planted/grown: 土地 + 作物标记（grown 更大更深）
   */
  private updateTileVisual(col: number, row: number, visual: TileVisual): void {
    const state = getTileState(col, row);
    if (state === 'empty') {
      visual.plot.setVisible(false);
      visual.crop.setVisible(false);
      return;
    }
    visual.plot.setVisible(true);
    // 五态地块贴图帧：tilled=0 / planted=1 / watered=2 / growing=3 / grown=4
    visual.plot.setFrame(state === 'tilled' ? 0 : state === 'planted' ? 1 : state === 'watered' ? 2 : 4);
    // 作物标记：planted/watered/grown 显示对应阶段帧（发芽/生长/成熟），成熟态不再统一萝卜
    const hasCrop = state === 'planted' || state === 'watered' || state === 'grown';
    visual.crop.setVisible(hasCrop);
    if (hasCrop) {
      const cropData = getCrop(col, row);
      const cropType = cropData?.cropType ?? 'radish';
      const cropIdx = CROP_TYPES.indexOf(cropType);
      if (state === 'grown') {
        visual.crop.setFrame(cropIdx * 3 + 2);
      } else if (state === 'watered') {
        visual.crop.setFrame(cropIdx * 3 + 1);
      } else {
        visual.crop.setFrame(cropIdx * 3 + 0);
      }
    }
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
        this.hudAreaDom.innerHTML = `${name} ${day} ${lv} | ${seedInfo} ${coins} ${diamonds}`;
      } else {
        this.hudAreaDom.innerHTML = `${name} ${day} ${lv} | ${stamina} ${coins} ${diamonds}`;
      }
    } else {
      if (this.mapKey === 'farm') {
        this.hudAreaDom.innerHTML =
          `${name} | ${day} | ${lv} | WASD/E交互 | R切换:${seedInfo} | ${coins} | ${diamonds} | 出口切换`;
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
  }

  /**
   * 交互入口（动作键触发，consumeAction 消费一次）：
   *   0. 若玩家靠近 NPC（所有场景）→ 显示对话
   *   0.5 森林靠近星之碎片（accepted 状态）→ 采集
   *   1. 若玩家在农场睡觉区域内 → 尝试睡觉（任何时间都可以，不强制到 22:00）
   *   2. 否则 → 农田交互（锄地/播种/浇水/收获）
   */
  private tryInteract(): void {
    // 1. 睡觉点检测：
    //    house → 真实床铺（Ground gid 9）；farm → 木屋地板（Walls gid 6）
    //    判定：站在床格上，或站在床格相邻 1 格内即可（触屏操作精度宽容，无需精确面向）
    if (this.mapKey === 'house' || this.mapKey === 'farm') {
      const pc = Math.floor(this.player.x / TILE_SIZE);
      const pr = Math.floor(this.player.y / TILE_SIZE);
      const onBed = this.bedTiles.has(`${pc},${pr}`);
      // BUG-032 修复：farm 木屋地板整体即睡觉区（6×5=30 格，触屏精度足够），必须站在地板上（onBed）
      // 才能睡；"相邻 1 格"放宽仅保留给 house 真实床铺（2×2 小区域，且 house 为封闭场景无外扩风险），
      // 避免判定外扩到石墙外——玩家站在木屋旁（row 18 屋外 / 门口外侧）误触睡觉跨天。
      const nearBed = this.mapKey === 'house' && this.isNearBedTile(pc, pr);
      if (onBed || nearBed) {
        console.log(`[MapScene] 床交互触发 player=(${this.player.x},${this.player.y}) tile=(${pc},${pr}) onBed=${onBed} nearBed=${nearBed} step=${getStoryStep()} sleeping=${this.sleeping}`);
        // 防重复睡觉（移动端触屏双击发防护）
        if (this.sleeping) {
          console.log('[MapScene] 睡觉中，忽略重复触发');
          return;
        }
        // 教程中：只有 evening_talk 允许睡觉；提前睡觉不跨天（防止存档卡死：
        // 播种后未浇水就睡 → 次日作物已熟/无种子，教程永久无法完成）
        if (!isTutorialDone() && getStoryStep() !== 'evening_talk') {
          this.showDialogueText('还不到睡觉的时候……先把今天的农活做完吧。');
          return;
        }
        // 教程：晚间睡觉 → 结束教程
        if (!isTutorialDone() && this.tryTutorialSleep()) return;
        // 自由模式白天：弹睡觉选项（睡到天亮 / 休息到傍晚）。
        // 避免"睡觉跨天 → 回到清晨"导致永远等不到 20:00 观星夜。
        if (getTime().hour < 20 && !isObservatoryComplete()) {
          this.promptSleepChoice();
          return;
        }
        this.trySleep();
        return;
      }
    }

    // P1 家的音乐盒（老屋，靠近按 E 打开曲目列表）
    if (this.mapKey === 'house' && this.musicBoxMark) {
      if (this.tryMusicBoxInteract()) return;
    }

    // P0 爷爷的归星包裹（老屋旧木箱，第一次进屋可领取，一次性）
    if (this.mapKey === 'house' && this.grandpaGiftMark) {
      if (this.tryGrandpaGiftInteract()) return;
    }

    // 1.5 Demo 结尾：观星点（主线完成 + 夜晚 + 靠近观星点按 E）
    if (this.tryStargaze()) return;

    // 灯塔轻量版（2026-08-10）：探索交互（靠近旧物件按 E 读文本，一次性记录足迹）
    if (this.mapKey === 'lighthouse') {
      if (this.tryLighthouseInteract()) return;
    }

    // 支线试点：镇长「看星星的地方」（委托后，夜晚到空地触发）
    if (this.trySideElderStar()) return;

    // 0.3 教程：夏雅交互（大门地图优先于普通 NPC）
    if ((this.mapKey === 'gate' || this.mapKey === 'farm') && this.xiyaSprite) {
      if (this.tryXiyaInteract()) return;
    }

    // 0.35 大门交互：锁着时按 E 明确提示（制作人反馈：功能未解锁应提示，不能无反馈）
    // 大门未打开时 gateWall 存在（使用钥匙后销毁置 null）；玩家靠近大门按 E 给出引导
    if (this.mapKey === 'gate' && this.gateWall) {
      const dx = this.player.x - 15 * TILE_SIZE;
      const dy = this.player.y - 9 * TILE_SIZE;
      if (dx * dx + dy * dy < 30 * 30) {
        this.showDialogueText(getItemCount('manor_key') > 0
          ? '大门锁着，打开背包选择庄园钥匙使用吧。'
          : '大门锁着，好像需要一把钥匙……');
        return;
      }
    }

    // v0.5.3 剧情密度 E1：清晨偶遇夏雅（教程完成后，仅清晨 06-08 时）
    if (this.mapKey === 'farm' && this.dawnXiya) {
      if (this.tryDawnXiyaInteract()) return;
    }

    // 镇长家提示物品（镇长不在镇上时显示）
    if (this.mapKey === 'town' && this.elderHouseHint) {
      if (this.tryElderHouseHintInteract()) return;
    }

    // T3 小梅「小梅花」：小镇花圃种花（一次性事件）
    if (this.mapKey === 'town') {
      if (this.trySideGardenerPlum()) return;
    }

    // 2026-08-11 镇子商店门口自动售货机（制作人拍板：衰落中维持最低限度运转）
    // 独立交互锚点：全天可用、只卖基础补给；老板在场也不受影响（机器不抢老板存在感）
    // 必须优先于需求板：售货机实际位置 (352,156)（mx=x-40=352）距需求板 (360,136) 仅 ~21.5px，
    // 需求板 48px 半径会抢先命中。售货机交互半径取 20px（< 21.5px）：
    //   玩家站需求板中心 (360,136) 距售货机 21.5px > 20px → 正常打开需求板；
    //   玩家贴近售货机（<20px）→ 打开售货机（优先级正确，机器不吞需求板）。
    if (this.mapKey === 'town' && this.shopMachine) {
      const dx = this.player.x - this.shopMachine.pos.x;
      const dy = this.player.y - this.shopMachine.pos.y;
      if (dx * dx + dy * dy < 20 * 20) {
        this.inputManager.clearAction();
        this.shopPanel.open('machine');
        return;
      }
    }

    // FEATURE-038 居民需求板（小镇广场右侧信息板，靠近按 E 打开面板）
    if (this.mapKey === 'town' && this.residentBoardMark) {
      if (this.tryResidentBoardInteract()) return;
    }

    // v0.5.3 剧情密度 E9：傍晚关心夏雅（教程完成后，仅傍晚 18-20 时）
    if (this.mapKey === 'farm' && this.eveningXiya) {
      if (this.tryEveningXiyaInteract()) return;
    }

    // v0.5.3 剧情密度 E5：爷爷的笔记（庄园角落可读物件）
    if (this.mapKey === 'farm' && this.grandpaNote) {
      if (this.tryGrandpaNoteInteract()) return;
    }

    // M1-3 爷爷旧花园恢复点（未恢复时靠近按 E 三阶段清理）
    if (this.mapKey === 'farm' && this.gardenRestore && this.gardenRestore.stage < 3) {
      if (this.tryGardenRestoreInteract()) return;
    }

    // 支线试点：夏雅「院子有人照顾」（花园恢复后，花田旧藤架事件；花园见证夏雅在场时让位）
    if (this.mapKey === 'farm' && isRestored('garden') && !this.gardenXiya) {
      if (this.trySideXiyaGarden()) return;
    }

    // FEATURE-037 老屋修复（未恢复时靠近按 E：资源交付一次完成）
    if (this.mapKey === 'farm' && this.oldHouseRestore && !this.oldHouseRestore.restored) {
      if (this.tryOldHouseRestoreInteract()) return;
    }

    // T3 夏雅「整理旧照片」（老屋修复后，老屋门口事件）
    if (this.mapKey === 'farm' && isRestored('oldHouse')) {
      if (this.trySideXiyaPhoto()) return;
    }

    // D-011 夏雅《春深有信·一》：剧情专线（花田边，下午/傍晚时段；独立于 E9 傍晚闲聊）
    if (this.mapKey === 'farm' && isTutorialDone()) {
      if (this.tryXiyaLetterInteract()) return;
    }

    // FEATURE-037 后山道路修复（未恢复时靠近按 E：资源交付一次完成）
    if (this.mapKey === 'forest' && this.forestRoadRestore && !this.forestRoadRestore.restored) {
      if (this.tryForestRoadRestoreInteract()) return;
    }

    // M1-3 夏雅见证（花园恢复后，夏雅在花园旁，靠近按 E 播放生活记忆对白）
    if (this.mapKey === 'farm' && this.gardenXiya) {
      if (this.tryGardenXiyaInteract()) return;
    }

    // FEATURE-036 旧农业机器人（花园恢复后出现，靠近按 E 修复获得，一次性）
    if (this.mapKey === 'farm' && this.oldRobot) {
      if (this.tryOldRobotInteract()) return;
    }

    // 2. 优先检测靠近 NPC（所有场景）：取交互范围内最近的一个
    // 注意：不能用数组顺序取第一个，否则多个 NPC 靠近时 elder 永远先被触发
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
    if (nearest) {
      console.log(`[DEBUG] tryInteract NPC: ${nearest.id} at (${nearest.sprite?.x},${nearest.sprite?.y})`);
      // 通知每日任务：与 NPC 对话 + 刷新面板
      onDQTAlkNpc(nearest.id);
      this.updateDailyQuestPanel();
      // 镇长对话：根据任务状态播放完整剧情剧本（StoryDialogue 全屏）
      if (nearest.id === 'elder') {
        if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
        // f7：第一天镇长「暂时有事」对话 → 结束后发放启动资源大礼包（一次性，随 triggeredEvents 入档）
        const elderBusy = isElderBusyDay();
        this.storyDialogue.play(getElderDialogue(), () => {
          this.updateQuestHUD();
          this.updateHUD();
          if (elderBusy) {
            triggerOnce('elder_starter_gift', () => this.grantElderStarterGift());
          }
          // 支线试点：观星夜完成后，镇长追加「看星星的地方」委托（一次性，随 mapFlags 入档）
          if (!this.sideElderTeaAsked && !this.sideElderStarDone && isObservatoryComplete()) {
            this.sideElderTeaAsked = true;
            this.storyDialogue!.play(ELDER_TEA_QUEST_DIALOGUE, () => this.updateHUD());
          }
          // P0-5 农场回暖 v2：交付在 farm 场景内完成时的兜底（镇长实际白天在 town，
          // 该路径通常走不到；首次回 farm 的光晕由 create 时 farm_warm_intro 首播负责）
          if (this.mapKey === 'farm' && isRestored('farmWarm') && !this.farmWarmOverlay) {
            this.setupFarmWarm();
          }
          // 里程碑保存（v0.5.2 P0）：主线交付后立即入档
          save({
            x: this.player.x, y: this.player.y,
            scene: this.mapKey, facing: this.player.facing,
            dailyQuest: getDailyQuestSaveData(),
          });
        });
      } else if (nearest.id === 'shopkeeper') {
        // 商人：先播放欢迎剧本，对话结束后自动打开商店
        this.showDialogue(nearest);
      } else {
        this.showDialogue(nearest);
      }
      return;
    }

    // 2026-08-11 镇子商店门面（商人回镇）交互锚点：靠近店门按 E
    // - 老板在场 → 对话老板（完整商店：收购/稀有商品/复兴任务）
    // - 老板不在场 → 打开自动售货机面板（基础补给，消除"老板下班买不到种子"的挫败）
    if (this.mapKey === 'town' && this.townShop) {
      const dx = this.player.x - this.townShop.pos.x;
      const dy = this.player.y - this.townShop.pos.y;
      if (dx * dx + dy * dy < 30 * 30) {
        const boss = this.npcList.find((n) => n.id === 'shopkeeper');
        if (boss && boss.sprite && !boss.vanished) {
          this.showDialogue(boss);
        } else {
          this.inputManager.clearAction();
          this.shopPanel.open('machine');
        }
        return;
      }
    }

    // 0.45 后山老树：靠近按 E 查看
    if (this.mapKey === 'forest' && this.oldTree) {
      const dx = this.player.x - this.oldTreePos.x;
      const dy = this.player.y - this.oldTreePos.y;
      if (dx * dx + dy * dy < 60 * 60) {
        this.triggerOldTreeInteract();
        return;
      }
    }

    // 0.5 森林采集点：accepted 状态靠近星之碎片 E 键采集
    if (this.mapKey === 'forest' && this.shardSprite && this.shardSprite.visible) {
      const dx = this.player.x - this.shardSprite.x;
      const dy = this.player.y - this.shardSprite.y;
      if (dx * dx + dy * dy < 24 * 24) {
        // 首次交互先播"程序员能力展示"对话，结束后自动采集（无需二次按键）
        if (!this.shardDialoguePlayed) {
          this.shardDialoguePlayed = true;
          if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
          this.storyDialogue.play(FOREST_SHARD_DIALOGUE, () => {
            this.doCollectShard();
          });
        }
        return;
      }
    }

    // T3 老张「矿灯」：矿洞独立点灯点（优先于挖矿，靠近旧矿灯时触发）
    if (this.mapKey === 'mine') {
      if (this.trySideMinerLamp()) return;
    }

    // 0.6 矿洞挖矿：靠近矿脉 E 键开采
    if (this.mapKey === 'mine') {
      // 挖矿引导（仅第一次在矿脉旁交互时触发，对话结束后本次不开采，需再按一次）
      const nearOre = this.oreSprites.some((e) => {
        if (!e.sprite.visible) return false;
        const dx = this.player.x - e.sprite.x;
        const dy = this.player.y - e.sprite.y;
        return dx * dx + dy * dy < 24 * 24;
      });
      if (nearOre && !this.mineTipShown) {
        this.mineTipShown = true;
        if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
        this.storyDialogue.play(MINE_TIP_DIALOGUE);
        return;
      }
      this.tryMine();
      return;
    }

    if (this.mapKey !== 'farm') return;

    // 砍树检测（农场树木，靠近按 E 砍伐，优先于农田交互）
    if (this.tryChopTree()) return;

    // 农田交互：根据面前格子状态自动判断锄地/播种/浇水/收获
    this.tryFarmInteract();
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
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    this.storyDialogue.play(
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
      // P2：检查是否有成熟作物可收获
      if (this.mapKey === 'farm') {
        const readyCrops = getAllCropEntries().filter(([, c]) => {
          const def = CROP_DEFS[c.cropType];
          return def && getTime().day >= c.plantDay + def.growthDays;
        });
        if (readyCrops.length > 0) {
          setTimeout(() => this.showDialogueText(`🌱 有 ${readyCrops.length} 块作物成熟了，快去收获吧！`), 1200);
        }
        // P2-1 认知补强：已播种未浇水（planted，机器人已先执行浇水）→ 提醒玩家缺水，区分"时间未到"与"缺浇水"
        const dryCrops = getAllCropEntries().filter(([key]) => {
          const [c, r] = key.split(',').map(Number);
          return getTileState(c, r) === 'planted';
        });
        if (dryCrops.length > 0) {
          setTimeout(() => this.showDialogueText(`💧 有 ${dryCrops.length} 块作物土壤发干，记得浇水！`), 1400);
        }

        // 碎片收集进度：睡前内心独白（根据碎片数量显示不同台词）
        const shardCount = getItemCount('star_shard');
        const progressLines = SHARD_PROGRESS_LINES[shardCount] ?? [];
        if (progressLines.length > 0) {
          const randomLine = progressLines[Math.floor(Math.random() * progressLines.length)];
          setTimeout(() => showMemoryMoment(randomLine), 2000);
        }
      }
      // day2 清晨「岛屿的第一声回应」：睡醒（次日 06:00）仍留在 farm 时立即尝试触发
      this.time.delayedCall(1800, () => this.tryFirstMorningSequence());
      // FEATURE-041 木匠回归演出：睡醒后仍留在 farm 时立即尝试触发（老屋已完成且未回归过）
      this.time.delayedCall(2000, () => this.tryCarpenterReturn());
      // 反馈 #28 阿风欢迎「你回来了！」：睡醒后仍留在 farm 时尝试触发
      this.time.delayedCall(2200, () => this.tryAdventurerWelcome());
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
    const wb = this.physics.world.bounds;
    const W = wb.width;
    const H = wb.height;
    // 观星夜居中修复（2026-08-11）：星空底/星点需覆盖观星夜相机最大视野，否则宽屏下
    // 视野右侧露出地图外的深灰背景（GAME_CONFIG.backgroundColor=#2d2d2d），观感为
    // "星空特效不在屏幕正中间"。观星点(504,232) 居中时：
    //   mobile 844x390 → logical 1298x600 → 视野 649x300，scroll=(179.5,82) → 右边界 828.5
    //   desktop 1280x720 → logical 1067x600 → 视野 533.5x300 → 右边界 770.8
    // 实际演出段 zoomCameraAt 后 zoom≈2.15（比上面推导的 2.0 视野更小），
    // starW/starH 按最坏（最大）视野覆盖并留余量；星星/银河铺满扩展区（观感统一），小镇灯光仍在地图内。
    const starW = 920;
    const starH = 460;
    // 静态星野底（深蓝渐变 + 散布星点）
    this.starField = this.add.graphics();
    this.starField.setDepth(15); // 高于玩家(10)和作物(2-3)，盖住农田
    this.starField.setScrollFactor(1);
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
    this.stargazeTownLights = this.add.graphics();
    this.stargazeTownLights.fillStyle(0xffddaa, 0.85);
    const townY = H * 0.62;
    for (let i = 0; i < 9; i++) {
      const lx = W * (0.30 + 0.44 * (i / 8)) + (rand() - 0.5) * 6;
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
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    this.storyDialogue.play(
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
            DEMO_ENDING_DIALOGUE,
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

  /** v0.10.4 流星：头亮尾淡的短尾迹，斜向划过 1.2s，一次性销毁（纯 Graphics + tween） */
  private spawnShootingStar(): void {
    if (!this.starFieldVisible) return;
    const W = 640, H = 400; // farm 世界尺寸（与 createStarField 一致）
    const sx = W * (0.25 + Math.random() * 0.45);
    const sy = H * (0.12 + Math.random() * 0.18);
    const angle = Math.PI / 4 + Math.random() * Math.PI / 8; // 斜向（右上→左下）
    const vx = Math.cos(angle), vy = Math.sin(angle);
    const c = this.add.container(sx, sy).setDepth(16);
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
    this.storyDialogue.play(branch, () => {
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
                  if (!this.endingPanel) this.endingPanel = new EndingPanel();
                  save({ x: this.player.x, y: this.player.y, scene: this.mapKey, facing: this.player.facing } as any);
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
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    });
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
      if (dx * dx + dy * dy > 32 * 32) continue;
      console.log(`[Lighthouse] 交互: ${s.label} at (${s.x},${s.y})`);
      // 探索足迹入档（一次性；轻量版无新系统，供未来 P2 剧情/相簿判断）
      triggerOnce(s.key, () => {});
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
    this.lhRoomGlow.setAlpha(0); // 恒熄灭（预埋状态）

    // ===== 3. 光束扫海面（预埋：当前恒不亮；未来灯塔点亮后恢复"夜晚光束"） =====
    // 2026-08-10 制作人方向对齐：现在灯塔=黑，光束属于"未来灯塔亮起"的视觉，
    // 现阶段不创建（lhBeam 恒为 null）。恢复时：night 分支创建此图形 + 呼吸 tween。

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
   * P0-5 农场回暖 v2（2026-08-08 制作人拍板；2026-08-09 升级三幕式叙事）
   * 触发：QuestSystem.deliverQuest() 标记 FarmRestore 'farmWarm'（随 worldRestore 入档），
   *       本方法在 create 时检测到该标记后调用；交付发生在 farm 场景时由对话结束回调调用。
   *
   * 视觉（复用既有能力，零新资源）：三幕式"回暖"叙事——
   *   第一幕「事件感」：交付瞬间，从交付点（或屏幕中心）一轮暖金光晕扩散，
   *                     overlay 2s 内快速上冲（不再是"悄悄蒙层"，而是"发生了"）。
   *   第二幕「苏醒·时间感」：此后 overlay alpha 随时辰缓慢起伏（白天 0.07~0.12 呼吸），
   *                    "回暖是活的"；光尘粒子密度随时辰微调（正午最密）。
   *   第三幕「记忆色·黄昏」：18:00-20:00 时段 alpha 加深至 0.22（v2.1 拍板 0.16→0.22），
   *                    叠加暖橙垂直渐变天光（farmWarmSkyGlow，顶部 0.8 亮→底部弱），
   *                    呼应"爷爷记忆里的暖光"，给一天的情绪落点。
   * 首屏（本次会话首次进农场）播 3 秒渐变过渡；此后按当前时辰直接应用。
   *
   * @param originX / originY 第一幕光晕扩散中心（世界坐标）；缺省 = 玩家当前位置
   */
  private setupFarmWarm(originX?: number, originY?: number): void {
    if (this.mapKey !== 'farm' || !this.groundLayer) return;
    if (this.farmWarmOverlay) return; // 幂等：同一场景实例内不重复创建
    // 全屏暖橙 ADD overlay（覆盖地图整体，depth 4.5：盖过地面/装饰(≤4)，NPC(5)/玩家(10) 不被盖）
    // 注意1：TilemapLayer.width/height 是瓦片数而非像素；必须用 displayWidth/displayHeight 才是实际覆盖尺寸。
    // 注意2：add.rectangle 的第 6 参是 Shape 的 fillAlpha 而非 GameObject alpha——传 0 会导致填充永不绘制
    //       （tween/setAlpha 改的是 GameObject alpha，渲染时两者相乘仍为 0）。必须 fillAlpha=1 + setAlpha 控制。
    const w = this.groundLayer.displayWidth;
    const h = this.groundLayer.displayHeight;
    const overlay = this.add.rectangle(0, 0, w, h, 0xffc98a, 1)
      .setOrigin(0).setDepth(4.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.farmWarmOverlay = overlay;

    // 夕阳感 v2.1：世界坐标暖橙垂直渐变天光（顶部亮→底部弱，模拟太阳低垂从画面上方斜射）。
    // depth 4.4：盖过地面/装饰(≤4)，低于全屏罩色(4.5)、NPC(5)/玩家(10)；ADD 混合 → 越靠上越"浸入夕照"。
    // 渐变 alpha 烘焙在 fillGradientStyle 的四角（顶部 0.5 → 底部 0.02），整体随 updateFarmWarm 调 setAlpha。
    // 注意：fillGradientStyle 是 WebGL 专属，canvas 回退时渐变不绘制（仅少一层光，不影响功能）。
    const skyGlow = this.add.graphics();
    skyGlow.setDepth(4.4);
    skyGlow.fillGradientStyle(0xffa050, 0xffa050, 0xffa050, 0xffa050, 0.5, 0.5, 0.02, 0.02);
    skyGlow.fillRect(0, 0, w, h);
    skyGlow.setBlendMode(Phaser.BlendModes.ADD);
    skyGlow.setAlpha(0);
    this.farmWarmSkyGlow = skyGlow;

    // 暖金光尘粒子：稀疏慢漂（分布农场中部几处，视觉"光照粒子增加"）
    const spots: Array<[number, number]> = [
      [8 * TILE_SIZE + 8, 8 * TILE_SIZE + 8],
      [20 * TILE_SIZE + 8, 12 * TILE_SIZE + 8],
      [30 * TILE_SIZE + 8, 8 * TILE_SIZE + 8],
    ];
    spots.forEach(([x, y]) => {
      const p = this.add.particles(x, y, '__WHITE', {
        lifespan: 3000,
        speedX: { min: -20, max: 20 },
        speedY: { min: -10, max: 10 },
        quantity: 1,
        frequency: 1200,
        alpha: { start: 0.5, end: 0 },
        scale: { start: 0.18, end: 0.05 },
        tint: 0xffd98a,
        blendMode: 'ADD',
      });
      p.setDepth(4.6);
      this.farmWarmParticles.push(p);
    });

    // 首屏（交付后首次进 farm）播 3 秒渐变过渡 + 第一幕光晕；此后（重进/读档）按时辰直接应用
    const baseAlpha = this.farmWarmAlphaForHour(getTime().hour);
    if (!hasTriggered('farm_warm_intro')) {
      triggerOnce('farm_warm_intro', () => {
        this.tweens.add({
          targets: overlay,
          alpha: { from: 0, to: baseAlpha },
          duration: 3000,
          ease: 'Sine.easeOut',
        });
        // 第一幕「事件感」：交付后首次回 farm，暖光从玩家位置扩散（"回暖发生了"）
        if (originX !== undefined && originY !== undefined) {
          this.playFarmWarmPulse(originX, originY);
        }
      });
    } else {
      overlay.setAlpha(baseAlpha);
    }
  }

  /**
   * 第一幕「事件感」：一轮暖金光晕从交付点扩散 + overlay 短暂上冲（"回暖发生了"）。
   * 只播一次（本场景实例内），2.2s 演出，零资源（Graphics 圆环扩散 + 亮度脉冲）。
   */
  private playFarmWarmPulse(originX: number, originY: number): void {
    if (!this.farmWarmOverlay || this.farmWarmPulsePlayed) return;
    this.farmWarmPulsePlayed = true;
    const overlay = this.farmWarmOverlay;
    const g = this.add.graphics();
    g.setDepth(4.6);
    // 扩散圆环（世界坐标，随场景滚动）
    const ring = this.add.graphics();
    ring.setDepth(4.6);
    const maxR = Math.max(this.groundLayer?.displayWidth ?? 400, 300);
    this.tweens.add({
      targets: { r: 24 },
      r: maxR,
      duration: 1800,
      ease: 'Sine.out',
      onUpdate: (_t, target: { r: number }) => {
        ring.clear();
        ring.lineStyle(6, 0xffe9b8, 0.55);
        ring.strokeCircle(originX, originY, target.r);
      },
      onComplete: () => ring.destroy(),
    });
    // 亮度脉冲：overlay 快速冲到 0.28 再回落（"暖色亮起"，必须高于全天最高暖度 0.22 才有上冲感）
    this.tweens.add({
      targets: overlay,
      alpha: { from: overlay.alpha, to: 0.28 },
      duration: 500,
      yoyo: true,
      hold: 300,
      ease: 'Sine.out',
      onComplete: () => {
        // 回落回当前时辰应有的暖度
        overlay.setAlpha(this.farmWarmAlphaForHour(getTime().hour));
      },
    });
    void g;
  }

  /**
   * 第二幕/第三幕：随时辰计算 overlay 目标暖度。
   *   - 夜晚/清晨（<6 或 >=21）：0.07（微暖底）
   *   - 白天（6-17）：0.08~0.12 缓呼吸（正午最暖）
   *   - 黄昏（18-20）：0.22（"记忆色"，全天最暖；v2.1 制作人拍板 0.16→0.22 强化夕阳感）
   * 每帧由 updateFarmWarm 调用（平滑趋近，避免跳变）。
   */
  private farmWarmAlphaForHour(hour: number): number {
    if (hour >= 18 && hour < 21) return 0.22;
    if (hour >= 6 && hour < 18) {
      // 正午（12-14）最暖 0.12，早/晚 0.08 —— 一条倒 V
      const noon = Math.max(0, 1 - Math.abs(hour - 13) / 6);
      return 0.08 + 0.04 * noon;
    }
    return 0.07;
  }

  /** 每帧：回暖暖度随时辰平滑趋近（第二幕时间感）+ 夕阳天光同步 */
  private updateFarmWarm(): void {
    if (!this.farmWarmOverlay) return;
    const hour = getTime().hour;
    // 全屏罩色：每帧最多走 1/3 差距，避免跨小时跳变
    const target = this.farmWarmAlphaForHour(hour);
    const cur = this.farmWarmOverlay.alpha;
    this.farmWarmOverlay.setAlpha(cur + (target - cur) * 0.33);
    // 夕阳天光：同样平滑趋近，让"夕照强度"随时辰增减（黄昏最浓）
    if (this.farmWarmSkyGlow) {
      const skyTarget = this.farmWarmSkyAlphaForHour(hour);
      const skyCur = this.farmWarmSkyGlow.alpha;
      this.farmWarmSkyGlow.setAlpha(skyCur + (skyTarget - skyCur) * 0.33);
    }
  }

  /** v2.1 夕阳天光强度（叠加在罩色之上）：黄昏(18-20)最浓，白天微暖，夜晚回落 */
  private farmWarmSkyAlphaForHour(hour: number): number {
    if (hour >= 18 && hour < 21) return 0.8;
    if (hour >= 6 && hour < 18) return 0.35;
    return 0.12;
  }

  /** 与爷爷笔记交互（靠近按 E → 播放当天一条笔记） */
  private tryGrandpaNoteInteract(): boolean {
    if (!this.grandpaNote || !this.grandpaNote.visible) return false;
    const p = this.grandpaNotePos;
    const dx = this.player.x - p.x;
    const dy = this.player.y - p.y;
    if (dx * dx + dy * dy > 28 * 28) return false;
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    const note = getGrandpaNote(getTime().day);
    this.storyDialogue.play([note], () => {
      this.updateHUD();
    });
    return true;
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
    // 蝴蝶 ×2（花丛间飞）
    this.createButterfly(29 * T + T / 2, 4 * T + T / 2);
    this.createButterfly(31 * T + T / 2, 6 * T + T / 2);

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

  /** 创建一只蝴蝶（Graphics 双翼 + 扇动/绕飞 tween，随场景 shutdown 自动销毁） */
  private createButterfly(x: number, y: number): void {
    const wings = this.add.graphics();
    wings.fillStyle(0xffd6a5, 1);
    wings.fillEllipse(-3, 0, 6, 4);
    wings.fillEllipse(3, 0, 6, 4);
    wings.fillStyle(0xff9e80, 1);
    wings.fillCircle(0, 0, 1);
    const c = this.add.container(x, y, [wings]);
    c.setDepth(4);
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

  /** 恢复前视觉：屋顶破洞 + 外墙裂缝 + 门前杂草 + 交互提示标记 */
  private buildOldHouseRuined(): void {
    const g = this.oldHouseRestore;
    if (!g) return;
    const T = TILE_SIZE;
    // 组1 屋顶破洞：灰色缺瓦块 + 内黑影（木屋北侧 row 18 屋顶线）
    const hole = this.add.graphics();
    hole.fillStyle(0x6a5a48, 1);
    hole.fillRoundedRect(-8, -4, 16, 7, 2);
    hole.fillStyle(0x3a3228, 1);
    hole.fillRect(-4, -2, 8, 3);
    hole.setPosition(4 * T + T / 2, 18 * T + T / 2);
    hole.setRotation(-0.15);
    hole.setDepth(3);
    // 组2 外墙裂缝：深色斜线（木屋右墙）
    const crack = this.add.graphics();
    crack.lineStyle(1, 0x2e2820, 1);
    crack.lineBetween(-5, -7, 4, 5);
    crack.lineBetween(-2, -7, 5, 0);
    crack.setPosition(8 * T + T / 2, 21 * T + T / 2);
    crack.setDepth(3);
    // 组3 门前杂草：绿色短线（门垫前）
    const weeds = this.add.graphics();
    weeds.fillStyle(0x7a9a4a, 1);
    for (let i = 0; i < 5; i++) {
      weeds.fillRect(-10 + i * 5, 0, 1, 3 + (i % 3) * 2);
    }
    weeds.setPosition(6 * T + T / 2, 18 * T + T / 2);
    weeds.setDepth(3);
    g.debris = [hole, crack, weeds];
    g.mark = this.add.text(g.pos.x, g.pos.y - 10, '老屋', {
      fontFamily: 'Arial', fontSize: '10px', color: '#e8d8a8',
    }).setOrigin(0.5).setDepth(4);
  }

  /** 恢复后视觉：清除破旧 → 红灯笼 ×2 / 炊烟 / 门牌 / 门前花（装饰不换 Tilemap） */
  private buildOldHouseRestored(): void {
    const g = this.oldHouseRestore;
    if (!g) return;
    const T = TILE_SIZE;
    // 清除破旧装饰与提示标记
    for (const d of g.debris) d.destroy();
    g.debris = [];
    if (g.mark) { g.mark.destroy(); g.mark = null; }
    // 灯笼 ×2：门两侧屋顶下沿（红灯笼 + 暖色灯芯 + 挂绳）
    const lantern = (x: number, y: number) => {
      const l = this.add.graphics();
      l.fillStyle(0xcf3a2a, 1);
      l.fillRoundedRect(-2, -4, 4, 8, 2);
      l.fillStyle(0xffd166, 1);
      l.fillCircle(0, 0, 1.2);
      l.fillRect(-1, -6, 2, 2);
      l.setPosition(x, y);
      l.setDepth(3);
      return l;
    };
    lantern(5 * T + T / 2, 19 * T - 2);
    lantern(8 * T + T / 2, 19 * T - 2);
    // 炊烟：烟囱上方飘升的灰白圆点（循环 tween）
    const smoke = this.add.graphics();
    smoke.fillStyle(0xcfcbc4, 0.85);
    smoke.fillCircle(0, -14, 3);
    smoke.fillCircle(4, -8, 2.5);
    smoke.fillCircle(-3, -3, 2);
    smoke.setPosition(7 * T + T / 2, 18 * T + T / 2);
    smoke.setDepth(3);
    this.tweens.add({
      targets: smoke,
      y: smoke.y - 10,
      alpha: { from: 0.9, to: 0 },
      duration: 2200,
      repeat: -1,
      ease: 'Sine.Out',
    });
    // 门牌（木屋北侧空地 row 17）
    this.add.text(6 * T + T / 2, 17 * T + T / 2, '归星小屋', {
      fontFamily: 'Arial', fontSize: '10px', color: '#f4e3c1',
      backgroundColor: '#6a4a2a', padding: { x: 4, y: 1 },
    }).setOrigin(0.5).setDepth(4);
    // 门前花：门垫右侧
    const flower = this.add.graphics();
    flower.fillStyle(0xff9e80, 1);
    flower.fillCircle(0, 0, 2);
    flower.fillStyle(0xffd166, 1);
    flower.fillCircle(0, 0, 1);
    flower.setPosition(8 * T + T / 2, 18 * T + T / 2 + 4);
    flower.setDepth(3);
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
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    this.storyDialogue.play(
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
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    this.storyDialogue.play(OLD_HOUSE_RESTORED_DIALOGUE, () => {
      setTimeout(() => showMemoryMoment('风吹过修补好的屋瓦——这座岛，开始像家了。'), 1600);
    });
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

  /** 树荫区域·荒废态：树下枯草圈 ×3（(3,7)/(14,21)/(37,6)） */
  private buildTreeShadeRuined(): number {
    const T = TILE_SIZE;
    const spots: Array<[number, number]> = [[3, 7], [14, 21], [37, 6]];
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

  /** 树荫区域·复兴态：树下蘑菇圈/花丛/白花丛 ×3 */
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
    // 蘑菇圈：(3,7) 双蘑菇
    const mushroom = (mx: number, my: number, color: number): void => {
      const m = this.add.graphics();
      m.fillStyle(0xe8d8c8, 1);
      m.fillRect(-1.5, 0, 3, 4);
      m.fillStyle(color, 1);
      m.fillCircle(0, -1, 3);
      m.fillStyle(0xffffff, 0.9);
      m.fillCircle(-1, -2, 0.8);
      m.setPosition(mx, my).setDepth(3);
    };
    mushroom(3 * T + T / 2 - 4, 7 * T + T / 2, 0xd46a3c);
    mushroom(3 * T + T / 2 + 3, 7 * T + T / 2 - 1, 0xc0392b);
    // 花丛：(14,21) 双花
    flower(14 * T + T / 2 - 4, 21 * T + T / 2, 0xff9e80);
    flower(14 * T + T / 2 + 3, 21 * T + T / 2 + 1, 0xe8b64a);
    // 白花丛：(37,6) 双花
    flower(37 * T + T / 2 - 3, 6 * T + T / 2, 0xf0f0f0);
    flower(37 * T + T / 2 + 3, 6 * T + T / 2 - 1, 0xe8b64a);
    return 3;
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
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    this.storyDialogue.play(FOREST_ROAD_RESTORED_DIALOGUE, () => {
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
    this.gardenXiyaLabel = this.add.text(dx, dy - 14, '夏雅', {
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
    if (dx * dx + dy * dy > 28 * 28) return false;

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
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    this.storyDialogue.play(GARDEN_RESTORED_XIYA_DIALOGUE, () => {
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

    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    if (!this.sideXiyaGardenAsked) {
      this.sideXiyaGardenAsked = true;
      this.storyDialogue.play(XIYA_GARDEN_TRELLIS_DIALOGUE, () => this.updateHUD());
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
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    if (!isPhotoUnlocked('xiya_garden')) {
      unlockPhoto('xiya_garden');
      this.notifyPhotoUnlocked('xiya_garden');
    }
    this.storyDialogue.play(XIYA_GARDEN_TRELLIS_DONE_DIALOGUE, () => {
      playMemoryFlashback(XIYA_GARDEN_FLASHBACK, () => {
        showMemoryMoment('花田那边，一直有人打理着。');
        this.updateHUD();
        save({
          x: this.player.x, y: this.player.y,
          scene: this.mapKey, facing: this.player.facing,
          dailyQuest: getDailyQuestSaveData(),
        } as any);
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
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    this.storyDialogue.play(ELDER_STAR_SITE_DIALOGUE, () => {
      playMemoryFlashback(ELDER_STAR_FLASHBACK, () => {
        showMemoryMoment('第二天，镇长听说了，只是点点头。「你爷爷要是知道你还记得那块空地，会高兴的。」');
        this.updateHUD();
        save({
          x: this.player.x, y: this.player.y,
          scene: this.mapKey, facing: this.player.facing,
          dailyQuest: getDailyQuestSaveData(),
        } as any);
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

    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    if (!this.sideXiyaPhotoAsked) {
      this.sideXiyaPhotoAsked = true;
      this.storyDialogue.play(XIYA_PHOTO_ENTRY_DIALOGUE, () => this.updateHUD());
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
    this.storyDialogue.play(XIYA_PHOTO_DONE_DIALOGUE, () => {
      playMemoryFlashback(XIYA_PHOTO_FLASHBACK, () => {
        showMemoryMoment('那张泛黄的照片，一直有人收着。');
        this.updateHUD();
        save({
          x: this.player.x, y: this.player.y,
          scene: this.mapKey, facing: this.player.facing,
          dailyQuest: getDailyQuestSaveData(),
        } as any);
      });
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

  /** 剧情专线存档（x/y/scene/facing + dailyQuest 与既有支线一致） */
  private saveLetterFlags(): void {
    save({
      x: this.player.x, y: this.player.y,
      scene: this.mapKey, facing: this.player.facing,
      dailyQuest: getDailyQuestSaveData(),
    } as any);
  }

  /** 生成花田边剧情夏雅（A 段开场 / D 段收尾共用） */
  private spawnLetterXiya(): void {
    if (this.letterXiya) return;
    const dx = this.LETTER_POS.x - 32;
    const dy = this.LETTER_POS.y;
    this.letterXiya = this.add.sprite(dx, dy, 'npc_xiya');
    this.letterXiya.setScale(0.5).setDepth(5);
    this.letterXiya.setFlipX(true);
    this.letterXiyaLabel = this.add.text(dx, dy - 14, '夏雅', {
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
    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
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
      this.storyDialogue.play(XIYA_LETTER_OPEN_DIALOGUE, () => {
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
      this.storyDialogue.play(XIYA_LETTER_FLOWER_DIALOGUE, () => {
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
      this.storyDialogue.play(XIYA_LETTER_RECORD_DIALOGUE, () => {
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
      this.storyDialogue.play(XIYA_LETTER_FINAL_DIALOGUE, () => {
        this.clearLetterXiya();
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

    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    if (!this.sideMinerLampAsked) {
      this.sideMinerLampAsked = true;
      this.storyDialogue.play(MINER_LAMP_ENTRY_DIALOGUE, () => this.updateHUD());
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      } as any);
      return true;
    }

    const copper = getItemCount('copper');
    if (copper < 2) {
      this.storyDialogue.play(MINER_LAMP_NEED_DIALOGUE, () => this.updateHUD());
      return true;
    }

    addItem('copper', -2);
    this.sideMinerLampDone = true;
    this.buildMinerLampLit();
    this.storyDialogue.play(MINER_LAMP_DONE_DIALOGUE, () => {
      this.updateHUD();
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      } as any);
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
    const T = TILE_SIZE;
    const px = 17 * T + T / 2;
    const py = 9 * T + T / 2;
    const dx = this.player.x - px;
    const dy = this.player.y - py;
    if (dx * dx + dy * dy > 48 * 48) return false;

    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    if (!this.sideGardenerPlumAsked) {
      this.sideGardenerPlumAsked = true;
      this.storyDialogue.play(GARDENER_PLUM_ENTRY_DIALOGUE, () => this.updateHUD());
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
    this.storyDialogue.play(GARDENER_PLUM_DONE_DIALOGUE, () => {
      playMemoryFlashback(PLUM_BLOOM_FLASHBACK, () => {
        showMemoryMoment('花圃边上，多了一株小梅花。');
        this.updateHUD();
        save({
          x: this.player.x, y: this.player.y,
          scene: this.mapKey, facing: this.player.facing,
          dailyQuest: getDailyQuestSaveData(),
        } as any);
      });
    });
    return true;
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
      const px = 17 * T + T / 2;
      const py = 9 * T + T / 2;
      const mark = this.add.text(px, py - 14, this.sideGardenerPlumAsked ? '花种' : '？', {
        fontFamily: 'Arial', fontSize: '10px', color: this.sideGardenerPlumAsked ? '#e8d8a8' : '#c8d8a8',
      }).setOrigin(0.5).setDepth(4);
      this.plumMark = mark;
    }
  }

  /** 小梅花视觉：枝干 + 粉白花瓣（零资源 Graphics） */
  private buildPlumBlossom(): void {
    const T = TILE_SIZE;
    const px = 17 * T + T / 2;
    const py = 9 * T + T / 2;
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
    if (dx * dx + dy * dy > 30 * 30) return false;

    this.oldRobotFixed = true;
    this.oldRobot.destroy();
    this.oldRobot = null;
    if (this.oldRobotLabel) { this.oldRobotLabel.destroy(); this.oldRobotLabel = null; }

    if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
    this.storyDialogue.play(OLD_ROBOT_DIALOGUE, () => {
      addItem('auto_farmer_robot', 1);
      triggerTag('has_robot');
      play('levelup');
      this.showDialogueText('获得物品：【自动农业机器人】\n打开背包即可部署到农田旁。');
      // 里程碑入档（与花园恢复一致：修复获得后立即保存，防刷新丢失）
      save({
        x: this.player.x, y: this.player.y,
        scene: this.mapKey, facing: this.player.facing,
        dailyQuest: getDailyQuestSaveData(),
      } as any);
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
    // 位置 (col24.5, row9.5)：(392,152)；行8 c24-25 为草地、行9-10 c24-25 为广场，
    // 顶部 y-22=130 不压上右屋（行3-7）、底部 y+22=174 < 中央大道行11 上沿 176，不压路。
    // 交互安全：与花匠小梅 town 站位 (296,168) 相距 97px（30px 门面圆与 24px NPC 圆不重叠）。
    const x = 24.5 * T;        // 392，广场东端（避开纵向主路 col14-15、行11 大道与小梅站位）
    const y = 9.5 * T;         // 152
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
    // 位置 (col22, row9.75)：(352,156)，行9-10 广场无碰撞；距小梅站位 57px > 24px，交互不冲突
    const mx = x - 40;         // 352
    const my = y + 4;          // 156
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
      if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
      this.storyDialogue.play(WOODCUT_TIP_DIALOGUE);
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
   * 农田交互（按 Player.facing 决定面前格子）：
   *   教程内（未 done）→ 单格路径（tryFarmInteractAt），保证教程稳定
   *   教程后 → Plot 批量路径（interactPlot），整块田一次操作
   * 单格状态流转：
   *   empty   → tilled   （锄地）
   *   tilled  → planted  （播种，消耗一颗萝卜种子，记录 CropData）
   *   planted → watered  （浇水，标记 watered=true）
   *   grown   → tilled   （收获，土地保留可重新播种，清除作物，获得萝卜 +1）
   *   watered → 暂不处理（等待次日成长判定）
   */
  private tryFarmInteract(): void {
    // 玩家所在瓦片坐标
    const pc = Math.floor(this.player.x / TILE_SIZE);
    const pr = Math.floor(this.player.y / TILE_SIZE);
    // 面前一格坐标
    let tc = pc;
    let tr = pr;
    switch (this.player.facing) {
      case 'up':
        tr = pr - 1;
        break;
      case 'down':
        tr = pr + 1;
        break;
      case 'left':
        tc = pc - 1;
        break;
      case 'right':
        tc = pc + 1;
        break;
    }
    // 整个 Plot 批量操作（从教程第一天起即可用）
    const plotId = getPlotAt(tc, tr);
    if (plotId) {
      this.interactPlot(plotId);
      return;
    }
    this.tryFarmInteractAt(tc, tr);
  }

  /**
   * 移动端点击种田：触屏设备在农场点击可操作的农田格子 → 直接执行操作
   * 面板/对话打开时忽略；非触屏设备忽略（桌面保留 WASD + E 交互）
   */
  private handleFarmTap(pointer: Phaser.Input.Pointer): void {
    if (!isTouchDevice()) return;
    if (this.mapKey !== 'farm') return;
    if (this.transitioning) return;
    // 面板/对话/种子选择器打开时忽略点击
    if (this.storyDialogue?.isOpen()) return;
    if (this.shopPanel.isOpen()) return;
    if (this.backpackPanel.isOpen()) return;
    if (this.endingPanel?.isOpen()) return;
    if (this.photoAlbumPanel?.isOpen()) return;
    if (this.seedSelectorEl) return;
    if (this.cropPickerEl) return;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const col = Math.floor(world.x / TILE_SIZE);
    const row = Math.floor(world.y / TILE_SIZE);
    if (!isInFarmArea(col, row)) {
      this.flashTileError(col, row);
      this.showFloatText(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2, '不能在这里', '#ff8a80');
      return;
    }
    // 教程完成后 → 点击农田任意位置自动吸附最近 Plot，整个区域批量操作
    const plotId = getPlotAt(col, row);
    if (plotId) {
      this.interactPlot(plotId);
      this.plotFlashId = plotId;
      this.plotFlashUntil = this.time.now + 500;
      if (isTouchDevice()) {
        try { navigator.vibrate(15); } catch {}
      }
      return;
    }
    if (!this.isTileActionable(col, row)) {
      this.flashTileError(col, row);
      const state = getTileState(col, row);
      // P2-1 认知区分：已浇水成长中 → "还需要一点时间"；无种子 → "没有种子"
      const msg = state === 'watered' ? '还需要一点时间' : '没有种子';
      this.showFloatText(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2, msg, '#ff8a80');
      return;
    }
    this.tryFarmInteractAt(col, row);
    // 点击反馈：目标格短暂高亮 + 触屏振动
    this.tapFlashKey = `${col},${row}`;
    this.tapFlashUntil = this.time.now + 500;
    if (isTouchDevice()) {
      try { navigator.vibrate(15); } catch {}
    }
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
        this.showFloatText(tileCenterX, tileCenterY, '浇水');
        this.updateDailyQuestPanel();
      }
    } else if (state === 'grown') {
      // 收获：成熟 → 耕地，获得作物
      const cropType = this.harvestTileAt(col, row);
      if (cropType) {
        play('harvest');
        this.showFloatText(tileCenterX, tileCenterY, `+1 ${CROP_DEFS[cropType].icon}`, '#7ef0a0');
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

  /** 单格锄地：empty → tilled。返回是否成功（非空地/无锄头返回 false） */
  private tillTileAt(col: number, row: number): boolean {
    if (getTileState(col, row) !== 'empty') return false;
    if (getItemCount('old_hoe') <= 0) return false;
    setTileState(col, row, 'tilled');
    this.checkTutorialProgress('till');
    // v1.0 生活仪式感：第一次锄地（一次性，mapFlags 入档；地块柔和高亮 + 极短 inner ≤1s）
    if (!this.firstHoe) {
      this.firstHoe = true;
      triggerTag('first_hoe');
      this.tileGlowHighlight(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2);
      showMemoryMoment('原来土地是这样的感觉。');
    }
    return true;
  }

  /** 单格播种：tilled → planted。返回是否成功（非已锄/无该种子库存返回 false） */
  private plantTileAt(col: number, row: number, cropType: CropType): boolean {
    if (getTileState(col, row) !== 'tilled') return false;
    const seedItem = CROP_DEFS[cropType].seedItem as any;
    if (getItemCount(seedItem) <= 0) return false;
    addItem(seedItem, -1);
    setTileState(col, row, 'planted');
    setCrop(col, row, { cropType, plantDay: getTime().day, watered: false });
    addXp(3, 'plant');
    if (!this.firstPlant) {
      this.firstPlant = true;
      triggerTag('first_plant');
      // v1.0 生活仪式感：第一次播种——地块柔和高亮（memoryMoment/提示沿用已有，不新增台词）
      this.tileGlowHighlight(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2, 0xa8e6a0);
      showMemoryMoment('城市里的人已经很久没有亲手种下一颗种子了。');
      // T2-1 Day1 引导链：播种 → 成长 → 出售 → 修复（底部提示条，4 秒自动消失，不打断）
      this.showDialogueText('种下了……等它长大，收成能换钱修镇上的旧东西。');
      // 80分灵感① 第一株作物纪念：归星录·相簿解锁《第一株新生命》（幂等，随 album 入档）
      if (!isPhotoUnlocked('first_crop')) {
        unlockPhoto('first_crop');
        this.notifyPhotoUnlocked('first_crop');
        // 纪念解锁立即入档（日常播种不保存，但"第一次"值得立即持久化，防播种后立刻刷新丢失）
        save({
          x: this.player.x, y: this.player.y,
          scene: this.mapKey, facing: this.player.facing,
          dailyQuest: getDailyQuestSaveData(),
        } as any);
      }
    }
    onDQPlant();
    this.checkTutorialProgress('sow');
    return true;
  }

  /** 单格浇水：planted → watered。返回是否成功（非已种/无水壶返回 false） */
  private waterTileAt(col: number, row: number): boolean {
    if (getTileState(col, row) !== 'planted') return false;
    if (getItemCount('old_watering_can') <= 0) return false;
    setTileState(col, row, 'watered');
    const crop = getCrop(col, row);
    if (crop) setCrop(col, row, { ...crop, watered: true });
    addXp(1, 'water');
    onDQWater();
    this.checkTutorialProgress('water');
    // v1.0 生活仪式感：第一次浇水（一次性，mapFlags 入档；复用已有台词，不新增文本）
    if (!this.firstWater) {
      this.firstWater = true;
      triggerTag('first_water');
      showMemoryMoment('水浇下去，能不能活，明天才知道。');
    }
    return true;
  }

  /** 单格收获：grown → tilled，作物入包。返回作物类型；非成熟返回 null */
  private harvestTileAt(col: number, row: number): CropType | null {
    if (getTileState(col, row) !== 'grown') return null;
    const crop = getCrop(col, row);
    const cropType = crop?.cropType ?? 'radish';
    setTileState(col, row, 'tilled');
    setCrop(col, row, undefined);
    addItem(cropType, 1);
    addXp(10, 'harvest');
    onDQHarvest(cropType);
    // v0.5.3 剧情密度 E2：第一次收获反馈（一次性，夏雅口头肯定，不影响收获本身）
    // v0.10.3：首次收获升级为"情绪瞬间"——轻音效 + 角色停顿表现 + 对白延迟（复用 firstHarvestShown，不新增存档/系统/剧情）
    // v1.0：+作物镜头（0.9s）——收获物放大→上浮→渐隐，"作物本身成为记忆镜头"（不破坏移动流畅）
    if (!this.firstHarvestShown) {
      this.firstHarvestShown = true;
      triggerTag('first_harvest');
      // ① 风铃/木叶轻响（区别于普通 harvest 三连音，低音量一次性）
      play('harvest_first');
      // ② 作物镜头（0.9s）：收获物在格子上放大上浮渐隐，随后进入背包——"作物本身成为记忆镜头"
      const cropShotIcon = CROP_DEFS[cropType]?.icon ?? '🥕';
      const cx = col * TILE_SIZE + TILE_SIZE / 2;
      const cy = row * TILE_SIZE + TILE_SIZE / 2;
      const cropShot = this.add.text(cx, cy, cropShotIcon, { fontSize: '22px' }).setOrigin(0.5).setDepth(8);
      this.tweens.add({
        targets: cropShot,
        scale: 1.9, y: cy - 16, alpha: 0,
        duration: 900, ease: 'Sine.out',
        onComplete: () => cropShot.destroy(),
      });
      // ③ 角色停顿表现（短促 scale 脉冲，body 为固定 24×24 不受影响；不阻塞输入/update）
      // 注意：玩家原始 scale=0.5，必须基于当前 scale 做相对脉冲，不能写死 1
      const baseScale = this.player.scaleX;
      this.tweens.add({
        targets: this.player,
        scaleX: baseScale * 1.08, scaleY: baseScale * 0.92,
        duration: 130, yoyo: true, ease: 'Sine.out',
        onComplete: () => this.player.setScale(baseScale, baseScale),
      });
      showMemoryMoment('小时候爷爷告诉我，土地不会辜负认真照料它的人。');
      // ④ 320ms 轻停顿后再弹夏雅对白（"角色看了看手里的东西"的节奏，不打断玩家操作）
      this.time.delayedCall(320, () => {
        if (!this.storyDialogue) this.storyDialogue = new StoryDialogue();
        this.storyDialogue.play(FIRST_HARVEST_DIALOGUE, () => {
          // T2-1 Day1 引导链：收获 → 出售 → 修复（底部提示条，3 秒自动消失，不打断）
          this.showDialogueText(this.hintText(
            '收获的作物可以拿到青禾镇的商店卖掉换金币！这些收成，是镇上老房子的建材费。',
            '收获的作物可以拿到青禾镇的商店卖掉换金币！这些收成，是镇上老房子的建材费。'));
          this.updateHUD();
        });
      });
    }
    return cropType;
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
      if (visual) this.updateTileVisual(col, row, visual);
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

  /** 打开归星录·相簿（只读收藏面板） */
  private openPhotoAlbum(): void {
    if (this.photoAlbumPanel?.isOpen()) return;
    if (!this.photoAlbumPanel) {
      this.photoAlbumPanel = new PhotoAlbumPanel();
    }
    this.inputManager.clearAction();
    this.hideShortcutHint();
    this.photoAlbumPanel.open();
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
    window.addEventListener('keydown', escHandler);
  }

  /** 关闭作物选择器 */
  private closeCropPicker(): void {
    this.cropPickerEl?.remove();
    this.cropPickerEl = null;
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
