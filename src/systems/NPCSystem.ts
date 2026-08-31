/**
 * NPC 系统（Phase 5）
 *
 * 职责：
 *   - 持有三个 NPC 的固定数据
 *   - 根据 TimeSystem 当前时间，判定每个 NPC 应在哪个场景的哪个位置
 *   - 提供按场景查询 NPC 的接口（供 MapScene create 时创建 sprite）
 *   - 每帧 update 推进 NPC 插值移动
 *
 * 日程（三 NPC 共用结构，名字/颜色/对话不同）：
 *   06:00-08:00  farm   （出生/家）
 *   08:00-12:00  town   （上午在小镇）
 *   12:00-18:00  forest （下午在森林）
 *   18:00-22:00  farm   （回家）
 *
 * 目标坐标（在各场景中的固定点，像素）：
 *   farm:   (3*16+8, 11*16+8)  木屋旁
 *   town:   (15*16+8, 10*16+8) 小镇中央
 *   forest: (15*16+8, 10*16+8) 森林中央
 */

import { NPC, ScheduleEntry } from '../entities/NPC';
import { getTime } from '../data/TimeSystem';
import { getWeather, isCurrentlyRaining } from './WeatherSystem';
import { getRevivalLevel, isRestored } from '../data/FarmRestore';
import { countGrownTiles } from '../data/FarmState';
import { hasTriggered } from './EventManager';
import { getChapter } from './ChapterSystem';
import { COLORS, type DialogueLine } from './StorySystem';
import { isMobileLayout } from '../config';

/** 操作提示文案：移动端（触屏）与桌面端（键盘）差异 */
function hint(pc: string, mob: string): string {
  return isMobileLayout() ? mob : pc;
}

/** 瓦片尺寸 */
const T = 16;

/**
 * 场景内固定目标点（像素），每个 NPC 在场景内错开站位。
 * 原因：若三个 NPC 站同一格，交互检测按数组顺序遍历（elder 排第一），
 *       会导致靠近时永远触发镇长任务对话，商店/少女无法交互。
 * 各点均避开碰撞区（farm 木屋上墙 row12、town 石屋、forest 四角石簇）。
 */
type Spot = { x: number; y: number };
type NpcId = 'elder' | 'shopkeeper' | 'mystery' | 'miner' | 'gardener' | 'adventurer' | 'carpenter';
type SpotMap = Record<NpcId, Spot>;
const SPOTS: { farm: SpotMap; town: SpotMap; forest: SpotMap; mine: SpotMap; elder_house: SpotMap } = {
  farm: {
    elder: { x: 14 * T + 8, y: 3 * T + 8 },
    shopkeeper: { x: 35 * T + 8, y: 3 * T + 8 },
    mystery: { x: 34 * T + 8, y: 16 * T + 8 },
    miner: { x: 18 * T + 8, y: 18 * T + 8 },
    gardener: { x: 5 * T + 8, y: 7 * T + 8 },
    adventurer: { x: 30 * T + 8, y: 7 * T + 8 },
    carpenter: { x: 12 * T + 8, y: 23 * T + 8 },
  },
  town: {
    // 2026-08-12 Chapter1 P0-0：town 30x20 → 50x35，站位随内容平移 dx=10T dy=8T
    elder: { x: 23 * T + 8, y: 18 * T + 8 },
    shopkeeper: { x: 26 * T + 8, y: 18 * T + 8 },
    mystery: { x: 25 * T + 8, y: 16 * T + 8 },
    miner: { x: 24 * T + 8, y: 20 * T + 8 },
    gardener: { x: 28 * T + 8, y: 18 * T + 8 },
    adventurer: { x: 22 * T + 8, y: 20 * T + 8 },
    carpenter: { x: 20 * T + 8, y: 17 * T + 8 },
  },
  forest: {
    elder: { x: 13 * T + 8, y: 10 * T + 8 },
    shopkeeper: { x: 17 * T + 8, y: 10 * T + 8 },
    mystery: { x: 15 * T + 8, y: 8 * T + 8 },
    miner: { x: 14 * T + 8, y: 12 * T + 8 },
    gardener: { x: 18 * T + 8, y: 8 * T + 8 },
    adventurer: { x: 12 * T + 8, y: 10 * T + 8 },
    carpenter: { x: 9 * T + 8, y: 11 * T + 8 },
  },
  mine: {
    elder: { x: 8 * T + 8, y: 10 * T + 8 },
    shopkeeper: { x: 10 * T + 8, y: 10 * T + 8 },
    mystery: { x: 8 * T + 8, y: 8 * T + 8 },
    miner: { x: 12 * T + 8, y: 10 * T + 8 },
    gardener: { x: 10 * T + 8, y: 8 * T + 8 },
    adventurer: { x: 6 * T + 8, y: 10 * T + 8 },
    carpenter: { x: 7 * T + 8, y: 12 * T + 8 },
  },
  elder_house: {
    elder: { x: 5 * T + 8, y: 5 * T + 8 },
    shopkeeper: { x: 5 * T + 8, y: 5 * T + 8 },
    mystery: { x: 5 * T + 8, y: 5 * T + 8 },
    miner: { x: 5 * T + 8, y: 5 * T + 8 },
    gardener: { x: 5 * T + 8, y: 5 * T + 8 },
    adventurer: { x: 5 * T + 8, y: 5 * T + 8 },
    carpenter: { x: 5 * T + 8, y: 5 * T + 8 },
  },
};

/**
 * 虚拟隐藏位置：NPC 在自己家（不在林澈家），不匹配任何 sceneKey。
 * getNPCsForScene() 按 sceneKey 过滤，'home' 自然被排除 → NPC 此时不渲染。
 * NPC.update() 首行 `if (!this.sprite) return;` → 无 sprite 时安全跳过。
 */
const VIRTUAL_HOME_POSITION = { x: 0, y: 0 };

/**
 * 构建日程（按 NPC id 查专属站位）。
 * v0.5.4 错峰重构：NPC 不再"跟团旅游"，每个 NPC 有独立作息。
 * 设计原则：
 *   - 06:00-08:00 NPC 在自己家（'home' 虚拟位置，不渲染）
 *   - 08:00-18:00 按职业分流到不同场景（避免全员挤同一地图）
 *   - 18:00 后陆续回家（夜晚村庄安静）
 *   - 神秘少女保留森林出现 + 增加隐藏时段（避免全天固定遇见）
 */
function buildSchedule(npcId: NpcId): ScheduleEntry[] {
  // 镇长：晨起在家 → 上午下午镇上办公 → 晚归（18:00 后归村巡查）
  if (npcId === 'elder') {
    return [
      { time: '06:00', location: 'elder_house', ...SPOTS.elder_house.elder },
      { time: '08:00', location: 'town', ...SPOTS.town.elder, action: 'patrol' },
      { time: '18:00', location: 'elder_house', ...SPOTS.elder_house.elder },
    ];
  }
  // 商店老板：晨起在家 → 全天镇上开店 → 晚归
  if (npcId === 'shopkeeper') {
    return [
      { time: '06:00', location: 'home', ...VIRTUAL_HOME_POSITION },
      { time: '08:00', location: 'town', ...SPOTS.town.shopkeeper, action: 'open_shop' },
      { time: '18:00', location: 'home', ...VIRTUAL_HOME_POSITION },
    ];
  }
  // 神秘少女：只在特定时段出现森林，其余时段隐身（神秘感）
  //   清晨 06:00-08:00 森林晨雾 → 隐藏 → 傍晚 16:00-20:00 森林暮色 → 隐藏
  //   玩家不会全天固定遇见她，符合"行踪不定"的人设
  if (npcId === 'mystery') {
    return [
      { time: '06:00', location: 'forest', ...SPOTS.forest.mystery },
      { time: '08:00', location: 'home', ...VIRTUAL_HOME_POSITION },
      { time: '16:00', location: 'forest', ...SPOTS.forest.mystery },
      { time: '20:00', location: 'home', ...VIRTUAL_HOME_POSITION },
    ];
  }
  // 矿工老张：晨起在家 → 上午矿洞 → 下午矿洞外整理木材 → 傍晚镇上 → 晚归
  if (npcId === 'miner') {
    return [
      { time: '06:00', location: 'home', ...VIRTUAL_HOME_POSITION },
      { time: '08:00', location: 'mine', ...SPOTS.mine.miner, action: 'sort_wood' },
      { time: '14:00', location: 'mine', ...SPOTS.mine.miner, action: 'sort_wood' },
      { time: '18:00', location: 'town', ...SPOTS.town.miner },
      { time: '20:00', location: 'home', ...VIRTUAL_HOME_POSITION },
    ];
  }
  // 花匠小梅：晨起在家 → 上午农场照料花圃（garden）→ 下午森林采撷 → 晚归
  if (npcId === 'gardener') {
    return [
      { time: '06:00', location: 'home', ...VIRTUAL_HOME_POSITION },
      { time: '07:00', location: 'farm', ...SPOTS.farm.gardener, action: 'garden' },
      { time: '14:00', location: 'forest', ...SPOTS.forest.gardener },
      { time: '18:00', location: 'home', ...VIRTUAL_HOME_POSITION },
    ];
  }
  // 阿风：晨起在家 → 早起森林探险 → 下午镇上讲见闻 → 晚归
  if (npcId === 'adventurer') {
    return [
      { time: '06:00', location: 'home', ...VIRTUAL_HOME_POSITION },
      { time: '08:00', location: 'forest', ...SPOTS.forest.adventurer },
      { time: '14:00', location: 'town', ...SPOTS.town.adventurer },
      { time: '18:00', location: 'home', ...VIRTUAL_HOME_POSITION },
    ];
  }
  // 木匠老周（FEATURE-041，Alpha 简化日程，制作人拍板）：
  //   晨起在家 → 白天在老屋附近干木工活（sort_wood 复用整理动作）→ 晚归
  //   不做复杂多时段作息，避免为"完整 NPC 系统"提前扩大范围
  if (npcId === 'carpenter') {
    return [
      { time: '06:00', location: 'home', ...VIRTUAL_HOME_POSITION },
      { time: '08:00', location: 'farm', ...SPOTS.farm.carpenter, action: 'sort_wood' },
      { time: '18:00', location: 'home', ...VIRTUAL_HOME_POSITION },
    ];
  }
  // 兜底（所有分支已覆盖，不会到达）
  return [
    { time: '06:00', location: 'home', ...VIRTUAL_HOME_POSITION },
  ];
}

// ============ NPC 对话剧本（新版 StoryDialogue 全屏播放） ============

/** 镇长：主线对话由 QuestSystem 驱动，此处为兜底台词 */
const ELDER_DIALOGUES: DialogueLine[] = [
  { speaker: '镇长', color: COLORS.elder, text: '青禾镇是个好地方。多和镇上的人聊聊吧。' },
];

/** 商店老板：欢迎 + 买卖引导 */
const SHOPKEEPER_DIALOGUES: DialogueLine[] = [
  { speaker: '商店老板', color: '#8ac8a0', text: '欢迎光临星辰杂货店！' },
  { speaker: '商店老板', color: '#8ac8a0', text: '收获的作物、挖到的矿石都可以卖给我换金币。种子和工具也有卖。' },
  { speaker: '', color: COLORS.system, text: hint('（按 [E] 键打开商店。）', '（点「交互」打开商店。）') },
  { speaker: '商店老板', color: '#8ac8a0', text: '需要什么随便看。钱货两清，童叟无欺。' },
];

/** 神秘少女：神秘感对话，暗示岛屿与星辰的关联 */
const MYSTERY_DIALOGUES: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（一个少女站在树影下，她似乎一直在等着林澈。少女抬起头。）' },
  { speaker: '神秘少女', color: '#b8a0e8', text: '……你来了。' },
  { speaker: '林澈', color: COLORS.linche, text: '你认识我？' },
  { speaker: '神秘少女', color: '#b8a0e8', text: '不认识。……只是觉得，你应该会来。' },
  { speaker: '神秘少女', color: '#b8a0e8', text: '你身上……有那颗星的味道。' },
  { speaker: '神秘少女', color: '#b8a0e8', text: '你捡起的那块碎片……我也捡到过。' },
  { speaker: '', color: COLORS.system, text: '（林澈想追问，但少女已经转身消失在林间。）' },
];

/** v0.5.3 剧情密度 E6：观星夜后少女追加一句（仅观星完成后，接到固定对话末尾） */
const MYSTERY_AFTER_OBSERVATORY_DIALOGUE: DialogueLine[] = [
  { speaker: '神秘少女', color: '#b8a0e8', text: '你捡到的那片……它也认识你了。' },
  { speaker: '林澈', color: COLORS.linche, text: '你也捡到过？' },
  { speaker: '神秘少女', color: '#b8a0e8', text: '（没有回答，只是看着天空）……快归位了。' },
  { speaker: '神秘少女', color: '#b8a0e8', text: '原来……它真的回来了。' },
];

/** 矿工老张：挖矿引导 */
const MINER_DIALOGUES: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（老张看到林澈，咧嘴一笑，露出一口白牙。）' },
  { speaker: '矿工老张', color: '#d8a050', text: '哟，新来的小伙子！我是老张，矿洞这片归我管。' },
  { speaker: '', color: COLORS.system, text: '（老张掏出一块泛着微光的石头，递给林澈。）' },
  { speaker: '矿工老张', color: '#d8a050', text: '这矿里挖出来的东西，比你见过的所有代码都老。' },
  { speaker: '矿工老张', color: '#d8a050', text: '矿洞里能挖到石头、铜矿、铁矿。拿到镇上卖了能换钱。' },
  { speaker: '矿工老张', color: '#d8a050', text: '不过挖矿费体力，别把自个儿累趴下咯。' },
  { speaker: '', color: COLORS.system, text: hint('（靠近发光的矿脉，按 [E] 键开采。矿洞可从小镇进入。）', '（靠近发光的矿脉，点「交互」开采。矿洞可从小镇进入。）') },
  { speaker: '矿工老张', color: '#d8a050', text: '年轻的时候，我也想离开这里。' },
  { speaker: '林澈', color: COLORS.linche, text: '那为什么没走？' },
  { speaker: '矿工老张', color: '#d8a050', text: '（笑）……走不动了。路太长。' },
  { speaker: '林澈', color: COLORS.linche, text: '有时候，路长不是坏事。至少路上还能想清楚一些事。' },
  { speaker: '矿工老张', color: '#d8a050', text: '……说起来，这矿里有些老旧的机器，镇上没人会弄。' },
  { speaker: '林澈', color: COLORS.linche, text: '以前工作的时候，经常处理这些。' },
  { speaker: '矿工老张', color: '#d8a050', text: '哦？那你可帮大忙了。' },
  { speaker: '林澈', color: COLORS.linche, text: '（笑了笑，没接话）' },
];

/** 花匠小梅：种植话题 */
const GARDENER_DIALOGUES: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（小梅蹲在花圃边，正给一株花松土。她抬头看见林澈，笑了。）' },
  { speaker: '花匠小梅', color: '#a0d888', text: '你好呀，我叫小梅。这些花都是我亲手种的，漂亮吧？' },
  { speaker: '', color: COLORS.system, text: '（小梅指了指身旁的一株花。）' },
  { speaker: '花匠小梅', color: '#a0d888', text: '你爷爷以前每天下午都会来闻这株花的味道。他说这和城市的空气不一样。' },
  { speaker: '花匠小梅', color: '#a0d888', text: '种东西啊……说不上来为什么。浇水、除草、看它们一天一个样，心里就踏实。' },
  { speaker: '花匠小梅', color: '#a0d888', text: '你那边的地，我刚去看过，荒是荒了点。你种上东西，它就活过来了。' },
  { speaker: '花匠小梅', color: '#a0d888', text: '这花不是卖的，是有人托我种的。' },
  { speaker: '林澈', color: COLORS.linche, text: '托给谁？' },
  { speaker: '花匠小梅', color: '#a0d888', text: '不知道。但那个人说，总有一天会有人来收。' },
  { speaker: '林澈', color: COLORS.linche, text: '……这座岛上的事情，好像都是"总有一天"。' },
  { speaker: '花匠小梅', color: '#a0d888', text: '（笑）你也感觉到了？' },
];

/** 阿风：冒险与森林提示 */
// 2026-08-12 修复关系穿帮（制作人拍板方向 B 微调版）：阿风是林澈童年旧友（人物圣经 v1.0 §四），
// 原第 1 行「你就是新搬来的林澈吧？我叫阿风」为陌生人自我介绍模板残留（2026-08-06 本地化仅改称呼未改关系框架），
// 与 #28 欢迎剧情「嘿！你回来了！」状态冲突。替换为童年旧友重逢句，同步重录 adv_01.wav。
const ADVENTURER_DIALOGUES: DialogueLine[] = [
  { speaker: '阿风', color: '#88b8e8', text: '嘿！还记得我不？小时候后山那一圈，就是我带你跑熟的。' },
  { speaker: '阿风', color: '#88b8e8', text: '告诉你个秘密——后山深处有东西在发光，镇长神神秘秘的不肯说。' },
  { speaker: '阿风', color: '#88b8e8', text: '想去探险的话，记得备足体力。后山可比看上去大得多！' },
  // 2026-08-11 按制作人拍板（剧情对白压缩评估报告 E1）删除第 4 行：与第 2 行「后山有东西」重复，
  // voicebank adv_04 条目同步删除（8→7 行，林澈「你越这么说」接第 2 行依然通顺）。
  { speaker: '林澈', color: COLORS.linche, text: '（笑）你越这么说，我越想去看。' },
  { speaker: '阿风', color: '#88b8e8', text: '嘿！你这小子，胆子不小啊！' },
  { speaker: '林澈', color: COLORS.linche, text: '不是胆子大。只是觉得，既然来了这座岛，就该看看它藏着什么。' },
  { speaker: '阿风', color: '#88b8e8', text: '说得对。有空来后山，我带你转转。' },
];

/**
 * 阿风·后山场景固定对白（forest=后山，阿风清晨/上午在此，NPCSystem.ts 日程 08:00-14:00）。
 * 2026-08-16 逻辑修复：默认对白 tail 行「有空来后山，我带你转转」是人已经站在后山却说"改天带你来看"的自相矛盾。
 * 后山变体把「不在场、改天再去」的口吻改为「当下就在此地」的口吻；其余行与默认一致（后山深处/比看上去大在后山读得通），保住可复用的配音。
 */
const ADVENTURER_MOUNTAIN_DIALOGUES: DialogueLine[] = [
  { speaker: '阿风', color: '#88b8e8', text: '嘿！还记得我不？小时候后山那一圈，就是我带你跑熟的。' },
  { speaker: '阿风', color: '#88b8e8', text: '告诉你个秘密——后山深处有东西在发光，镇长神神秘秘的不肯说。' },
  { speaker: '阿风', color: '#88b8e8', text: '想去探险的话，记得备足体力。后山可比看上去大得多！' },
  { speaker: '林澈', color: COLORS.linche, text: '（笑）你越这么说，我越想去看。' },
  { speaker: '阿风', color: '#88b8e8', text: '嘿！你这小子，胆子不小啊！' },
  { speaker: '林澈', color: COLORS.linche, text: '不是胆子大。只是觉得，既然来了这座岛，就该看看它藏着什么。' },
  { speaker: '阿风', color: '#88b8e8', text: '说得对。那就从这儿开始，往深里走。' }, // T-voice：adv_mountain_06（后山尾句，暂静音，待配音后接 voicebank）
];

/** 按当前所在场景取阿风固定对白（forest=后山时无法复用 he 默认 tail） */
export function getAdventurerDialogue(location: string): DialogueLine[] {
  return location === 'forest' ? ADVENTURER_MOUNTAIN_DIALOGUES : ADVENTURER_DIALOGUES;
}

/** 木匠老周：常驻对白（FEATURE-041，方向稿待制作人定稿） */
const CARPENTER_DIALOGUES: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（老周蹲在木料堆旁，用刨子一遍遍推平木板。他抬头看见林澈，点了下头，没说话。）' },
  { speaker: '木匠老周', color: '#c89860', text: '……这屋子的木料，是你张罗来的？' },
  { speaker: '林澈', color: COLORS.linche, text: '嗯。爷爷说，东西坏了就要修。' },
  { speaker: '木匠老周', color: '#c89860', text: '（低头继续刨板，声音很轻）……这岛上，修东西的人，快绝了。' },
  { speaker: '林澈', color: COLORS.linche, text: '所以，你回来就是为了修这些东西？' },
  { speaker: '木匠老周', color: '#c89860', text: '（停了一下）嗯。' },
  { speaker: '木匠老周', color: '#c89860', text: '屋瓦、门槛、窗框……有需要修的地方，喊我一声。' },
];

// ============ v0.5.3 剧情密度：NPC 每日随机一句 ============
// 设计：让 NPC 像真实居民——不每句都服务剧情。
// 选句规则：seed = 当天天数 + NPC id hash，取模选 1 句。
// 同一天同 NPC 固定同一句（读档回来不跳变，因 seed 只依赖天数，不依赖存档）。
// 状态：由 MapScene 持有"当天已说过"的内存标记（Map<npcId, day>），不进入存档。

const NPC_DAILY_LINES: Record<string, DialogueLine[]> = {
  elder: [
    { speaker: '镇长', color: '#c8b898', text: '你爷爷以前每天傍晚都会来我这儿坐坐。' },
    { speaker: '镇长', color: '#c8b898', text: '这座岛啊，安静太久了。有人回来，挺好的。' },
    { speaker: '镇长', color: '#c8b898', text: '星星的事……你慢慢来，别着急。' },
    { speaker: '镇长', color: '#c8b898', text: '今天的天气，适合看星星。' },
    { speaker: '镇长', color: '#c8b898', text: '你爷爷走的时候，留下一句话：会有人回来的。' },
    { speaker: '镇长', color: '#c8b898', text: '年轻人，别老闷在庄园里，多出来走走。' },
    // 岛屿边界扩展方案 v1.0 P0（2026-08-09）：码头暗示（岛曾经连接外界，个人记忆）
    { speaker: '镇长', color: '#c8b898', text: '以前码头每天都有船来，现在啊，只剩下浪声了。' },
  ],
  shopkeeper: [
    { speaker: '商店老板', color: '#8ac8a0', text: '今天有批新货到了，来看看？' },
    { speaker: '商店老板', color: '#8ac8a0', text: '最近买种子的人多了，看来大家都开始种地了。' },
    { speaker: '商店老板', color: '#8ac8a0', text: '镇上好久没这么热闹了。你来了之后，感觉不一样了。' },
    { speaker: '商店老板', color: '#8ac8a0', text: '我年轻的时候也种过地，后来……算了，不提了。' },
    { speaker: '商店老板', color: '#8ac8a0', text: '你庄园里种的东西，品质都不错。' },
    { speaker: '商店老板', color: '#8ac8a0', text: '钱嘛，够用就行。重要的是日子过得舒坦。' },
  ],
  miner: [
    { speaker: '矿工老张', color: '#d8a050', text: '今天风不错，适合晒木材。' },
    { speaker: '矿工老张', color: '#d8a050', text: '今年雨水比去年多，地倒是好挖了。' },
    { speaker: '矿工老张', color: '#d8a050', text: '昨晚听见林子里有动静，估计又是野猪。' },
    { speaker: '矿工老张', color: '#d8a050', text: '矿洞里头凉快，来坐坐？' },
    { speaker: '矿工老张', color: '#d8a050', text: '挖矿这活儿，年轻时觉得苦，现在倒觉得踏实。' },
    { speaker: '矿工老张', color: '#d8a050', text: '你要是缺石头，矿里多的是。' },
    { speaker: '矿工老张', color: '#d8a050', text: '年轻人，晚上别老盯手机，有时候抬头看看天。' },
  ],
  gardener: [
    { speaker: '花匠小梅', color: '#a0d888', text: '今天这花开得比昨天好。' },
    { speaker: '花匠小梅', color: '#a0d888', text: '听说庄园里种出了新作物？' },
    { speaker: '花匠小梅', color: '#a0d888', text: '我的水壶漏了，正愁呢。' },
    { speaker: '花匠小梅', color: '#a0d888', text: '这株花啊，是我爷爷种的。' },
    { speaker: '花匠小梅', color: '#a0d888', text: '你庄园里的土地，养得越来越好了。' },
    { speaker: '花匠小梅', color: '#a0d888', text: '昨天下过雨，今早的花瓣都是水珠。' },
    { speaker: '花匠小梅', color: '#a0d888', text: '以前爷爷经常带我们去看星星。' },
  ],
  adventurer: [
    { speaker: '阿风', color: '#88b8e8', text: '后山最近有奇怪的声音，我可没说谎。' },
    { speaker: '阿风', color: '#88b8e8', text: '我今天又发现一个没人去过的地方。' },
    { speaker: '阿风', color: '#88b8e8', text: '明天想去北边看看，你去不？' },
    { speaker: '阿风', color: '#88b8e8', text: '听说老张昨晚又喝多了，哈哈。' },
    { speaker: '阿风', color: '#88b8e8', text: '这座岛比我想象的大，还有好多地方没去过。' },
    { speaker: '阿风', color: '#88b8e8', text: '你要是去后山，记得带够体力。' },
    { speaker: '阿风', color: '#88b8e8', text: '城里的星星是不是很少？' },
    // L4 风/灯/星三角彩蛋（灯意象，制作人拍板 2026-08-05；每日随机池一条，不强推，无配音）
    { speaker: '阿风', color: '#88b8e8', text: '岛上的人说我闲不住，跟阵风似的。夏雅那丫头不一样——她像盏灯，走到哪儿，哪儿就亮堂。' },
    // NPC-01 生活化补强（2026-08-06）：冒险日志意象 + 自嘲式幽默（生活观察 > 网络梗）
    { speaker: '阿风', color: '#88b8e8', text: '我有个习惯——走到哪儿记到哪儿。这本子都磨破边了，上面全是这座岛的角角落落。' },
    { speaker: '阿风', color: '#88b8e8', text: '以前觉得跑得远才算冒险。后来发现，能把一个地方慢慢看明白，也挺了不起。' },
    { speaker: '阿风', color: '#88b8e8', text: '走丢过吗？当然走过。地图画错了半边，在林子转了一下午——不过你别说，错路也能撞见好东西。' },
    // 《追风的人》种子伏笔（制作人 2026-08-08 拍板：Alpha 埋种子，Beta 开传说任务；不解释、不任务、不回忆，无配音）
    { speaker: '阿风', color: '#88b8e8', text: '这里的风，比消息快。' },
    { speaker: '阿风', color: '#88b8e8', text: '以前我总觉得，远方一定有什么答案。现在倒觉得，路上的风景也挺重要。' },
    // 岛屿边界扩展方案 v1.0 P0（2026-08-09）：灯塔暗示（冒险家"想去"的心理，个人观察）
    { speaker: '阿风', color: '#88b8e8', text: '西边那座灯塔，门锈住了。我试了几次都没上去，改天你也去试试？' },
  ],
  carpenter: [
    { speaker: '木匠老周', color: '#c89860', text: '这些木料不错，能用很久。' },
    { speaker: '木匠老周', color: '#c89860', text: '以前村里修东西，都找我。' },
    { speaker: '木匠老周', color: '#c89860', text: '（抬头看了看天）今天风大，木头干得快。' },
    { speaker: '木匠老周', color: '#c89860', text: '你爷爷在的时候，木工房每天都有响动。' },
    { speaker: '木匠老周', color: '#c89860', text: '别小看一把刨子，够用一辈子。' },
    { speaker: '木匠老周', color: '#c89860', text: '（沉默了一会儿）……有人回来，就还有救。' },
  ],
};

// ============ 第一章 P2-2：集市恢复后 NPC 生活台词分支 ============
// 设计（Sprint 3，2026-08-12 制作人拍板）：marketSquare 是玩家第一次亲手修复的公共区域，
// 恢复后让 NPC 对"集市重新有了生活"做出可感知的反馈（P2-2：同一 NPC 恢复前后台词不同）。
// 触发：isRestored('marketSquare')（仅 chapter>=1 解锁后可达，故无需重复判 chapter）。
// 用法：getDailyNpcLine 在恢复后用本池替换日常池，seed 规则不变（当天固定一句，读档不跳变）。
const MARKET_RESTORED_LINES: Record<string, DialogueLine[]> = {
  elder: [
    { speaker: '镇长', color: '#c8b898', text: '集市重新开起来，我远远看着，心里踏实多了。' },
    { speaker: '镇长', color: '#c8b898', text: '以前我就想，要是哪天镇上能再热闹一次就好了。' },
  ],
  shopkeeper: [
    { speaker: '商店老板', color: '#8ac8a0', text: '集市那边搭起来了？好家伙，我这小店总算有了伴。' },
    { speaker: '商店老板', color: '#8ac8a0', text: '摊子支起来了，往后镇上的人有地方逛了。' },
  ],
  miner: [
    { speaker: '矿工老张', color: '#d8a050', text: '广场上那些破摊子，是你收拾的？干得利索。' },
    { speaker: '矿工老张', color: '#d8a050', text: '有了集市，挖回来的石头也有人要了。' },
  ],
  gardener: [
    { speaker: '花匠小梅', color: '#a0d888', text: '集市的花，我摆了几盆过去。你整理的那片地，正好放得下。' },
    { speaker: '花匠小梅', color: '#a0d888', text: '集市活过来了，我那些花也总算有人看了。' },
  ],
  adventurer: [
    { speaker: '阿风', color: '#88b8e8', text: '集市一开张，镇上的人一下子多了。这才像个镇子嘛！' },
    { speaker: '阿风', color: '#88b8e8', text: '以前路过广场全是破布烂木头，现在可亮堂了。' },
  ],
  carpenter: [
    { speaker: '木匠老周', color: '#c89860', text: '集市的摊子，木料结实。往后要修，喊我。' },
    { speaker: '木匠老周', color: '#c89860', text: '有人愿意把地方收拾起来，就有活干。' },
  ],
};

// ============ 第一章 P1：夜晚灯光回忆点 — NPC 生活感反馈分支 ============
// 设计（实习 Agent，2026-08-14 制作人确认选项 A）：
//   夜晚 + 第一章时，NPC 对"镇子的灯亮起来 / 夜晚不再冷清"做生活感反馈，
//   呼应 Phase3 "灯亮=从冷清到有温度"的核心意象（老屋灯=有人住）。
//   纯氛围台词，不推进剧情、不改状态、零存档字段；复用 getDailyNpcLine 的 seed 规则。
//   触发：isNight()（hour >= 18 || hour < 6，与 Phase3 S6 夜灯 / AmbienceSystem 夜晚窗口一致）
//         && getChapter() >= 1（第一章「复苏」才亮灯）。
//   优先级：夜晚&章节1 → NIGHT_LINES；否则 集市恢复 → MARKET_RESTORED_LINES；否则 NPC_DAILY_LINES。
//   新增台词遵守 D-017 文风护栏（具体情境 + 说话缺陷 + 不连续漂亮 + 遮名可辨认），待制作人文风把关。
const NIGHT_LINES: Record<string, DialogueLine[]> = {
  elder: [
    { speaker: '镇长', color: '#c8b898', text: '晚上没事，我在桥头站一会儿。看见老屋那扇窗亮着灯，就知道有人住。' },
  ],
  shopkeeper: [
    { speaker: '商店老板', color: '#8ac8a0', text: '打烊收拾柜台的时候，外面灯影一晃一晃的。镇上总算有点活气了。' },
  ],
  miner: [
    { speaker: '矿工老张', color: '#d8a050', text: '收工晚了，路过镇上。看见亮着灯的窗户，就想起以前下工回家的那段路。' },
  ],
  gardener: [
    { speaker: '花匠小梅', color: '#a0d888', text: '夜里我去给花浇水，月亮照着，花瓣上全是光。这花啊，晚上也有人看它。' },
  ],
  adventurer: [
    { speaker: '阿风', color: '#88b8e8', text: '晚上出来看星星，走到有灯的地方就歇个脚。镇子亮堂了，走夜路心里有底。' },
  ],
  carpenter: [
    { speaker: '木匠老周', color: '#c89860', text: '木头收了工。回头一看，老屋那边还亮着——这活没白修。' },
  ],
  mystery: [
    { speaker: '神秘少女', color: '#b8a0e8', text: '夜里灯多起来……能照着路。' },
  ],
};

/** 简单字符串 hash（用于 seed，避免依赖天数之外的状态） */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * 夜晚判定（hour >= 18 || hour < 6）
 * 与 Phase3 S6 夜灯触发窗口、AmbienceSystem 夜晚窗口一致（第一章「夜晚灯光」语境）。
 */
function isNight(): boolean {
  const h = getTime().hour;
  return h >= 18 || h < 6;
}

// ============ 第一章 P1：时段对白切片 — 花匠小梅「世界在回应时间」示例 ============
// 设计（2026-08-16，最小垂直切片）：小梅的口袋生活句按她当前日程所在场景对口吻不同的说法，
// 让玩家感受"世界在回应时间"——上午她在农场照料、下午她去森林采撷（与 buildSchedule 同步，
// 不会自相矛盾）；夜晚她回家则有 NIGHT_LINES 覆盖，白天不在场由 schedule 把她移走自然呈现。
// 复用 getDailyNpcLine 的 seed 机制（当天随机一句，读档不跳变）。无配音（走 VoiceBank 静音跳过）。
// 新台词遵守 D-017 文风护栏（具体情境 + 说话缺陷 + 不连续漂亮 + 遮名可辨认）。
const GARDENER_PERIOD_LINES: Record<string, DialogueLine[]> = {
  // farm：上午/中午（07:00–14:00），照料花圃
  farm: [
    { speaker: '花匠小梅', color: '#a0d888', text: '清早的露水重，我先把花圃浇一遍。这时候的花，精神头最好。' },
    { speaker: '花匠小梅', color: '#a0d888', text: '这片地归我照看，天一亮我就得来看看。说不上累，就是惦记。' },
  ],
  // forest：下午（14:00–18:00），去森林采撷
  forest: [
    { speaker: '花匠小梅', color: '#a0d888', text: '下午去林子里摘了几把野花，回来手上扎了几个口子。不过值。' },
    { speaker: '花匠小梅', color: '#a0d888', text: '林子里的那几株，比园子里开得野。我采几支回去，看能不能养活。' },
  ],
};

// ============ 天气扩面第二刀（2026-08-16 制作人拍板）：雨天 NPC 生活台词 ============
// 设计：雨日（getWeather(day)==='rain'，WeatherSystem 事件表同源）NPC 对"下雨"做生活感反馈，
// 与雨天河螺/雨天蘑菇同一世界规律（"雨天是青禾镇的自然日"），强化天气参与规划的可感知。
// 复用 getDailyNpcLine 的 seed 机制（当天固定一句，读档不跳变）；零新系统/零新存档字段。
// 优先级：雨天 > 夜晚 > 集市恢复 > 时段场景生活句 > 默认生活句
// （雨窗 10-16 与夜晚 18+ 不重叠，雨天池与夜晚池天然互斥；雨日 10-16 外 NPC 若无夜晚池走其余池，避免"雨停了还说下雨"的别扭——由 getWeather 判定整日雨，但仅雨窗内 isCurrentlyRaining 才真正下雨，故雨天池只在雨窗内命中）。
// 新台词遵守 D-017 文风护栏（具体情境 + 说话缺陷 + 不连续漂亮 + 遮名可辨认），制作人已审。
const RAIN_LINES: Record<string, DialogueLine[]> = {
  elder: [
    { speaker: '镇长', color: '#c8b898', text: '下着雨，路上的泥都软了。你爷爷以前下雨天也爱在桥头站着。' },
  ],
  shopkeeper: [
    { speaker: '商店老板', color: '#8ac8a0', text: '雨一落，柜台前就没人了。正好，把旧账本翻出来擦擦灰。' },
  ],
  miner: [
    { speaker: '矿工老张', color: '#d8a050', text: '下雨天矿洞里潮气重，我正好歇一天。你倒是有闲跑来镇上。' },
  ],
  gardener: [
    { speaker: '花匠小梅', color: '#a0d888', text: '雨下得正好，花池子不用我浇了。就是一会儿风大，得把花盆往檐下挪挪。' },
  ],
  adventurer: [
    { speaker: '阿风', color: '#88b8e8', text: '下雨天跑不了远路，憋得慌。要不……你陪我在镇口站会儿，看雨？' },
  ],
  carpenter: [
    { speaker: '木匠老周', color: '#c89860', text: '雨天木料不能动，一动全翘。我就在棚里坐着，听雨打棚顶。' },
  ],
  mystery: [
    { speaker: '神秘少女', color: '#b8a0e8', text: '下雨……灯影会碎在水里。' },
  ],
};

// ============ 第一章 S6：秋日晒场完成后的「全镇生活回应」 ============
// 施工（2026-08-29，S6 批次；制作人：晒场收尾后"活动结束，生活没有恢复原样"）：
//   晒场当天演出完成（dryyard_held）后，NPC 日常台词切到"晒场/过日子"分支——
//   让玩家回镇时直接听见"这里真的开始有人过日子了"，而非赛事总结/世界观说明。
//   门禁：hasTriggered('dryyard_held')（与 mapFlags.dryyardPerm 同步，EventManager 跨系统共享）。
//   优先级：雨天 > 夜晚 > 晒场完成 > 集市恢复 > 时段生活句 > 默认（晒场是比集市更新的终态生活状态；
//   雨日/夜晚保留原当日氛围）。老张有晒场专属交互台词（放一放/晒个三五天），不入本池；
//   神秘少女无第一章生活戏份，不入本池。台词遵守 D-017（具体情境 + 说话缺陷 + 不连续漂亮）。
const DRYYARD_RESTORED_LINES: Record<string, DialogueLine[]> = {
  elder: [
    { speaker: '镇长', color: '#c8b898', text: '晒场又晒起来了。风吹过来，都是干菜和粮食的味道。' },
  ],
  shopkeeper: [
    { speaker: '商店老板', color: '#8ac8a0', text: '东头晒场上晒满了东西，路过的都要停一步看看。' },
  ],
  gardener: [
    { speaker: '花匠小梅', color: '#a0d888', text: '晒场那边晒的都是今年的新收成，看着就心里踏实。' },
  ],
  adventurer: [
    { speaker: '阿风', color: '#88b8e8', text: '晒场摆了满满一地收成，这才是过日子该有的样。' },
  ],
  carpenter: [
    { speaker: '木匠老周', color: '#c89860', text: '晒架立起来的时候我在场。有人接着用，就没白修。' },
  ],
};

/**
 * 获取某 NPC 当天的一句随机生活台词（无状态，seed = day + npcId hash）
 * @param npcId NPC id（miner/gardener/adventurer）
 * @param day 当天天数
 * @param location 该 NPC 当前所在场景（基建于 schedule；仅小梅用于时段对白切片，其余忽略）
 * @returns 台词数组（1 条）；该 NPC 没有随机池时返回 null
 */
export function getDailyNpcLine(npcId: string, day: number, location?: string): DialogueLine[] | null {
  // 第一章 P2-2：集市恢复后，NPC 生活台词切到"集市热闹"分支（恢复前/后可感知不同）
  // 第一章 P1：夜晚 + 章节≥1 时优先切到「夜晚灯光回忆点」生活感分支（氛围层，不覆盖集市语义）
  // 第一章 P1 时段切片：小梅按当前所在场景对口吻不同的生活句（farm=上午照料 / forest=下午采撷）
  // 天气扩面第二刀：雨日（当前正在下雨，WeatherSystem 同源）切「雨天生活台词」分支
  // 第一章 S6（2026-08-29）：晒场完成（dryyard_held）后切「全镇生活回应」分支
  //   优先级：雨天 > 夜晚 > 晒场完成 > 集市恢复 > 时段场景生活句 > 默认生活句
  const isRaining = getWeather(day) === 'rain' && isCurrentlyRaining();
  const rainPool = isRaining ? RAIN_LINES[npcId] : null;
  const nightPool = isNight() && getChapter() >= 1 ? NIGHT_LINES[npcId] : null;
  const dryyardPool = hasTriggered('dryyard_held') ? DRYYARD_RESTORED_LINES[npcId] : null;
  const periodPool = npcId === 'gardener' && location ? GARDENER_PERIOD_LINES[location] : null;
  let pool = rainPool ??
    nightPool ??
    dryyardPool ??
    (isRestored('marketSquare')
      ? MARKET_RESTORED_LINES[npcId]
      : periodPool && periodPool.length > 0
        ? periodPool
        : NPC_DAILY_LINES[npcId]);
  if (!pool || pool.length === 0) return null;
  // 土地回应系统 v1.4（B 菜园回应）：农田有成熟作物时，小梅偶尔一句"最近菜园看起来不错"
  // （世界状态判定，不做成就计数；seed 轮换自然形成"偶尔"）
  if (npcId === 'gardener' && countGrownTiles() > 0) {
    pool = [...pool, { speaker: '花匠小梅', color: '#a0d888', text: '最近菜园看起来不错。' }];
  }
  const idx = (hashCode(npcId) + day) % pool.length;
  return [pool[idx]];
}

/** 七个 NPC（木匠为 FEATURE-041 条件性角色，回归前不渲染） */
const npcs: NPC[] = [
  new NPC('elder', '镇长', '#d9c8a0', 'npc_elder', ELDER_DIALOGUES, buildSchedule('elder')),
  new NPC('shopkeeper', '商店老板', '#e0b060', 'npc_merchant', SHOPKEEPER_DIALOGUES, buildSchedule('shopkeeper')),
  new NPC('mystery', '神秘少女', '#c8a0e8', 'npc_girl', MYSTERY_DIALOGUES, buildSchedule('mystery')),
  new NPC('miner', '矿工老张', '#d8a050', 'npc_miner', MINER_DIALOGUES, buildSchedule('miner')),
  new NPC('gardener', '花匠小梅', '#a0d888', 'npc_gardener', GARDENER_DIALOGUES, buildSchedule('gardener')),
  new NPC('adventurer', '阿风', '#88b8e8', 'npc_adventurer', ADVENTURER_DIALOGUES, buildSchedule('adventurer')),
  new NPC('carpenter', '木匠老周', '#c89860', 'npc_carpenter', CARPENTER_DIALOGUES, buildSchedule('carpenter')),
];

/** 读取全部 NPC（只读列表） */
export function getAllNPCs(): readonly NPC[] {
  return npcs;
}

/**
 * FEATURE-041：木匠是否已回归（条件 = 复兴度 ≥ Lv1 且回归事件已触发）
 * 回归前：不参与场景渲染 / 不可被找到；回归后：按日程常驻。
 */
export function isCarpenterReturned(): boolean {
  return getRevivalLevel() >= 1 && hasTriggered('carpenter_returned');
}

/** v0.5.3 剧情密度 E6：观星夜后少女追加台词（只读） */
export function getMysteryAfterObservatory(): DialogueLine[] {
  return MYSTERY_AFTER_OBSERVATORY_DIALOGUE;
}

/**
 * 把 "HH:MM" 转成当日分钟数（0-1439）
 */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * 根据 TimeSystem 当前时间，刷新所有 NPC 的 currentLocation / targetX / targetY
 * 规则：取 schedule 中 time <= 当前时间 的最后一条
 * 应在场景 create 时、以及 TimeSystem.nextDay 之后调用
 */
export function refreshSchedule(): void {
  const now = getTime();
  const nowMin = now.hour * 60 + now.minute;
  for (const npc of npcs) {
    let active = npc.schedule[0];
    for (const entry of npc.schedule) {
      if (timeToMinutes(entry.time) <= nowMin) {
        active = entry;
      } else {
        break;
      }
    }
    npc.currentLocation = active.location;
    npc.targetX = active.x;
    npc.targetY = active.y;
    // v0.6 NPC 生活化 P0：写入当前时段动作（仅渲染用，不存档）
    npc.dailyAction = active.action ?? '';
    // BUG-041：演出消失标记随作息刷新清除（重新进场景 / 跨天 / 下一时段恢复出现）
    npc.vanished = false;
  }
}

/**
 * 获取当前应出现在指定场景的 NPC 列表
 * （供 MapScene create 时创建 sprite）
 * FEATURE-041：木匠未回归时不参与渲染（回归后才按日程常驻）。
 */
export function getNPCsForScene(sceneKey: string): NPC[] {
  return npcs.filter((n) => {
    if (n.id === 'carpenter' && !isCarpenterReturned()) return false;
    return n.currentLocation === sceneKey;
  });
}

/** 查询 NPC 当前是否可被玩家找到（B-1，制作人拍板 2026-08-03）
 * 不可找 = 在家（home 虚拟位置，不渲染）或隐藏时段。
 * 供 QuestPanel 对 talk 任务显示"已回家，明日再找"提示。
 */
export function isNpcFindable(npcId: string): boolean {
  const npc = npcs.find((n) => n.id === npcId);
  if (!npc) return false;
  if (npc.id === 'carpenter' && !isCarpenterReturned()) return false;
  return npc.currentLocation !== 'home';
}

/**
 * 每帧推进所有 NPC 的插值移动
 * （仅对有 sprite 的 NPC 生效，sprite 由 MapScene 创建/销毁）
 */
export function updateNPCs(dtMs: number): void {
  for (const npc of npcs) {
    npc.update(dtMs);
  }
}

/**
 * TimeSystem.nextDay 之后调用：重置 NPC 日程
 * （NPC 仍按时间判定位置，这里只需 refreshSchedule）
 */
export function onDayChange(): void {
  refreshSchedule();
}
