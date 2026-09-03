/**
 * 任务面板（v0.5.3-B，DOM 覆盖层）
 *
 * 制作人 P0「任务入口化」：像背包一样，点任务图标打开任务面板。
 * 面板拿到任务按钮点击 → open() 冻结玩家；关闭恢复。
 *
 * 分类：主线 / 支线 / 日常 / 好感
 *   - 主线：读取 QuestSystem.getQuestState()/getQuestObjective()
 *   - 支线：读取支线任务 + 居民需求（按进度解锁；flags 由 MapScene 构造时注入，避免循环依赖）
 *   - 日常：读取 DailyQuestSystem.getDailyQuests()
 *   - 好感：当前无数据源，灰色占位（"敬请期待"）
 *
 * 红点：日常有 completed && !claimed 任务 → 入口按钮角标显示数量
 * 不改变存档结构：只读渲染，领奖走 claimReward()
 */

import { getQuestState, getQuestObjective } from '../systems/QuestSystem';
import { getDailyQuests, claimReward, getTalkNpcHomeHint, type DailyQuestInstance } from '../systems/DailyQuestSystem';
import { getResidentRequests, isRequestDone, canFulfillRequest } from '../systems/ResidentRequestSystem';
import { getChapter, CHAPTER_1 } from '../systems/ChapterSystem';
import { hasTriggered } from '../systems/EventManager';
import { isRestored } from '../data/FarmRestore';
import { getHouseTidyLevel, isHouseTidyComplete } from '../data/HouseTidy';
import { getItemCount } from '../data/Inventory';
import { play } from '../systems/AudioSystem';
import { triggerTag } from '../systems/GuiXingRecordSystem';
import { showMemoryMoment } from './MemoryMoment';
import { panelFadeIn, panelFadeOut } from './dom-anim';

type OnClose = () => void;
type OnClaim = () => void;

/** 支线任务状态（MapScene 构造时注入；结构化类型避免 import MapScene 造成循环依赖） */
export interface QuestFlags {
  sideXiyaGardenAsked?: boolean;
  sideXiyaGardenDone?: boolean;
  sideElderTeaAsked?: boolean;
  sideElderStarDone?: boolean;
  sideXiyaPhotoAsked?: boolean;
  sideXiyaPhotoDone?: boolean;
  sideMinerLampAsked?: boolean;
  sideMinerLampDone?: boolean;
  sideGardenerPlumAsked?: boolean;
  sideGardenerPlumDone?: boolean;
  sideGardenerFieldAsked?: boolean;
  sideGardenerFieldDone?: boolean;
  sideShopCropAsked?: boolean;
  sideShopCropDone?: boolean;
  xiyaLetterAsked?: boolean;
  xiyaLetterDone?: boolean;
  xiyaBloomAsked?: boolean;
  xiyaBloomDone?: boolean;
}

/** 支线任务定义（解锁/进行中/完成判定基于注入 flags） */
interface SideQuestDef {
  id: string;
  title: string;
  /** 未解锁时提示 */
  lockHint: string;
  /** 进行中目标文案 */
  objective: string;
  isUnlocked: (f: QuestFlags) => boolean;
  isAsked: (f: QuestFlags) => boolean;
  isDone: (f: QuestFlags) => boolean;
}

/** 支线任务清单（2026-08-07 加入任务面板；解锁条件与 MapScene 触发一致） */
const SIDE_QUESTS: SideQuestDef[] = [
  {
    id: 'xiya_garden',
    title: '院子有人照顾',
    lockHint: '完成「整理旧花园」后解锁',
    objective: '帮夏雅修复花田边的旧藤架（交付木材×3）',
    isUnlocked: (f) => f.sideXiyaGardenAsked === true,
    isAsked: (f) => f.sideXiyaGardenAsked === true,
    isDone: (f) => f.sideXiyaGardenDone === true,
  },
  {
    id: 'elder_star',
    title: '看星星的地方',
    lockHint: '完成观星夜后解锁',
    objective: '夜晚带壶茶，去农田边坐坐（替爷爷看看星星）',
    isUnlocked: (f) => f.sideElderTeaAsked === true,
    isAsked: (f) => f.sideElderTeaAsked === true,
    isDone: (f) => f.sideElderStarDone === true,
  },
  {
    id: 'xiya_photo',
    title: '整理旧照片',
    lockHint: '完成「老屋修复」后解锁',
    objective: '在老屋门口，帮夏雅整理旧照片',
    isUnlocked: (f) => f.sideXiyaPhotoAsked === true,
    isAsked: (f) => f.sideXiyaPhotoAsked === true,
    isDone: (f) => f.sideXiyaPhotoDone === true,
  },
  {
    id: 'miner_lamp',
    title: '矿洞里的灯',
    lockHint: '进入矿洞后解锁',
    objective: '为矿洞点亮旧矿灯（交付铜矿×2）',
    isUnlocked: (f) => f.sideMinerLampAsked === true,
    isAsked: (f) => f.sideMinerLampAsked === true,
    isDone: (f) => f.sideMinerLampDone === true,
  },
  {
    id: 'gardener_plum',
    title: '一株小梅花',
    lockHint: '抵达小镇花圃后解锁',
    objective: '在小梅的花圃旁种下一株小梅花',
    isUnlocked: (f) => f.sideGardenerPlumAsked === true,
    isAsked: (f) => f.sideGardenerPlumAsked === true,
    isDone: (f) => f.sideGardenerPlumDone === true,
  },
  {
    id: 'gardener_field',
    title: '开垦花田',
    lockHint: '在农场花田遇见小梅后解锁',
    objective: '帮小梅开垦农场角落的花田（交付木材×3）',
    isUnlocked: (f) => f.sideGardenerFieldAsked === true,
    isAsked: (f) => f.sideGardenerFieldAsked === true,
    isDone: (f) => f.sideGardenerFieldDone === true,
  },
  {
    id: 'xiya_letter',
    title: '春深有信·一',
    lockHint: '下午/傍晚在农场花田边遇到夏雅后解锁',
    objective: '和夏雅一起整理花田，看看那本旧花种记录',
    isUnlocked: (f) => f.xiyaLetterAsked === true,
    isAsked: (f) => f.xiyaLetterAsked === true,
    isDone: (f) => f.xiyaLetterDone === true,
  },
  {
    id: 'xiya_bloom',
    title: '春深有信·二 花期未至',
    lockHint: '完成「春深有信·一」且集市恢复后，白天在旧广场会遇见夏雅',
    objective: '陪夏雅一步一步收拾一场秋日晒场',
    isUnlocked: (f) => f.xiyaBloomAsked === true,
    isAsked: (f) => f.xiyaBloomAsked === true,
    isDone: (f) => f.xiyaBloomDone === true,
  },
];

// ===== 模块级单例 =====
let panelEl: HTMLDivElement | null = null;
let domCreated = false;
let open = false;
let onClose: OnClose | null = null;
let onClaim: OnClaim | null = null;
let badgeEl: HTMLDivElement | null = null;
/** 支线任务 flags provider（MapScene 构造时注入；null 时支线页签显示加载提示） */
let flagsProvider: (() => QuestFlags | null) | null = null;

type Tab = 'main' | 'side' | 'daily' | 'affinity';
const TABS: { key: Tab; label: string }[] = [
  { key: 'main', label: '主线' },
  { key: 'side', label: '支线' },
  { key: 'daily', label: '日常' },
  { key: 'affinity', label: '好感' },
];

/** 简易 HTML 转义（防止任务名/提示文案破坏面板结构） */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 章节任务链定义（2026-08-14 加入面板主线页签；状态从事件/恢复点/派生接口只读渲染，零新增存档字段）
 *  v1.1（2026-09-02）：原 Ch1QuestDef 泛化为 ChapterQuestDef，第二/三章链复用同一结构 */
interface ChapterQuestDef {
  id: string;
  title: string;
  /** 未解锁时提示 */
  lockHint: string;
  /** 进行中目标文案（每次渲染实时计算，可带进度） */
  objective: () => string;
  isUnlocked: () => boolean;
  isDone: () => boolean;
}

/** 第一章任务链（chapter>=1 显示）：捉蝶 → 自然记录 → 老屋整理 → 镇长来访 → 集市恢复 → 春日集 */
const CH1_QUESTS: ChapterQuestDef[] = [
  {
    id: 'ch1_house_tidy',
    title: '整理老屋',
    lockHint: '完成观星夜后解锁',
    objective: () => `整理老屋（床 / 灯 / 书桌 / 收音机） ${getHouseTidyLevel()}/4`,
    isUnlocked: () => getChapter() >= CHAPTER_1,
    isDone: () => isHouseTidyComplete(),
  },
  {
    id: 'ch1_elder_visit',
    title: '镇长来访',
    lockHint: '整理完老屋，下一晚镇长会来',
    objective: () => '整理完老屋，等镇长夜晚来访',
    isUnlocked: () => isHouseTidyComplete(),
    isDone: () => hasTriggered('ch1_elder_visit'),
  },
  {
    id: 'ch1_market',
    title: '集市重新开张',
    lockHint: '镇长来访后解锁',
    objective: () => '清理集市场地 → 布置 3 个摊位（按居民需求）',
    isUnlocked: () => hasTriggered('ch1_elder_visit'),
    isDone: () => isRestored('marketSquare'),
  },
  {
    id: 'ch1_spring_fair',
    title: '春日集',
    lockHint: '集市开张后，夜晚去镇上',
    objective: () => '夜晚去青禾镇，参加春日集',
    isUnlocked: () => isRestored('marketSquare'),
    isDone: () => hasTriggered('ch1_spring_fair'),
  },
  {
    id: 'ch1_butterfly_catch',
    title: '捉蝴蝶',
    lockHint: '完成观星夜后解锁',
    objective: () => '白天（06-18时）去青禾镇或花田，捉一只蝴蝶获得标本',
    isUnlocked: () => getChapter() >= CHAPTER_1,
    isDone: () => hasTriggered('ch1_qinghe_butterfly_guide') || hasTriggered('ch1_natural_record_1'),
  },
  {
    id: 'ch1_natural_record',
    title: '自然记录',
    lockHint: '捉到蝴蝶后解锁',
    objective: () => {
      // 第一章 v0.11（制作人 2026-08-14 拍板）：计数动态化 1/10→2/10→3/10，随虫种记录推进
      const rec = (hasTriggered('ch1_natural_record_1') ? 1 : 0)
        + (hasTriggered('ch1_natural_record_2') ? 1 : 0)
        + (hasTriggered('ch1_natural_record_3') ? 1 : 0);
      const bag = getItemCount('butterfly_specimen') + getItemCount('willow_specimen') + getItemCount('moth_specimen');
      const tip = rec === 0
        ? (bag > 0 ? `带标本去农场花田找小梅（背包 ${bag} 只）` : '背包里没有标本，先去捉一只蝴蝶')
        : rec === 1
          ? '还可以去河边（白天）捉柳叶蝶，或老树旁（夜晚）捉夜光蛾'
          : rec === 2
            ? '还差一只：夜晚去森林老树旁捉夜光蛾'
            : '青禾凤蝶、柳叶蝶、夜光蛾都记下了';
      return `记录 ${rec}/10 · ${tip}`;
    },
    isUnlocked: () => getItemCount('butterfly_specimen') > 0
      || getItemCount('willow_specimen') > 0
      || getItemCount('moth_specimen') > 0
      || hasTriggered('ch1_natural_record_1')
      || hasTriggered('ch1_natural_record_2')
      || hasTriggered('ch1_natural_record_3'),
    isDone: () => hasTriggered('ch1_natural_record_1') && hasTriggered('ch1_natural_record_2') && hasTriggered('ch1_natural_record_3'),
  },
];

/** 第二章任一 flag 已触发（章节分段显示用；与 MapScene hasTriggered 同源，只读推导） */
const CH2_ANY = (): boolean =>
  ['ch2_clock_fixed', 'ch2_pier_repaired', 'ch2_pier_lit', 'ch2_night_talk', 'ch2_black_dot', 'ch2_lighthouse_talked']
    .some((f) => hasTriggered(f));

/** 第三章任一 flag 已触发（灯塔解锁 = 第三章开幕） */
const CH3_ANY = (): boolean =>
  ['ch2_black_dot', 'ch3_lighthouse_arrival', 'ch3_ship_arrived', 'ch3_b_photo', 'ch3_town_react', 'ch3_diary_finale', 'ch3_finale_open']
    .some((f) => hasTriggered(f));

/**
 * 第二章任务链（春日集后显示）：修钟 → 码头旧船 → 夜谈 → 灯塔黑点。
 * 节拍顺序对齐《任务-第二章故人远来-节拍表拆解-v1.0》；文案只复述已实装节拍，未新增剧情。
 */
const CH2_QUESTS: ChapterQuestDef[] = [
  {
    id: 'ch2_clock_fixed',
    title: '广场老钟',
    lockHint: '第一章春日集后，去青禾镇广场看看',
    objective: () => '和夏雅一起修好青禾镇广场的老钟',
    isUnlocked: () => true,
    isDone: () => hasTriggered('ch2_clock_fixed'),
  },
  {
    id: 'ch2_captain',
    title: '码头的老船长',
    lockHint: '老钟修好后，某天码头会靠岸一条旧船',
    objective: () => '码头边有人在修一条旧船，去搭把手',
    isUnlocked: () => hasTriggered('ch2_clock_fixed'),
    isDone: () => hasTriggered('ch2_pier_repaired'),
  },
  {
    id: 'ch2_night_talk',
    title: '码头的夜',
    lockHint: '旧船靠岸后，傍晚去码头',
    objective: () => '傍晚去码头，听大家聊聊过去的事',
    isUnlocked: () => hasTriggered('ch2_pier_repaired'),
    isDone: () => hasTriggered('ch2_night_talk'),
  },
  {
    id: 'ch2_black_dot',
    title: '灯塔的黑点',
    lockHint: '夜谈之后的某天，留意灯塔方向',
    objective: () => '灯塔方向似乎有什么一闪而过',
    isUnlocked: () => hasTriggered('ch2_night_talk'),
    isDone: () => hasTriggered('ch2_black_dot'),
  },
];

/**
 * 第三章任务链（灯塔解锁后显示，对应五幕）：
 * 灯塔开门 → 守灯人 → 来船与旅人 → 镇民讨论 → 碎片×3 → 日记终章 → 归位。
 */
const CH3_QUESTS: ChapterQuestDef[] = [
  {
    id: 'ch3_arrival',
    title: '灯塔开门',
    lockHint: '第二章结束后，灯塔半岛可以登上了',
    objective: () => '登上灯塔半岛，见一见守灯人',
    isUnlocked: () => true,
    isDone: () => hasTriggered('ch3_lighthouse_arrival'),
  },
  {
    id: 'ch3_keeper_dusk',
    title: '守灯人陈叔',
    lockHint: '抵达灯塔后解锁',
    objective: () => '跟着陈叔，看看一天里灯是怎么点起来的',
    isUnlocked: () => hasTriggered('ch3_lighthouse_arrival'),
    isDone: () => hasTriggered('ch3_keeper_dusk'),
  },
  {
    id: 'ch3_ship',
    title: '码头的船',
    lockHint: '灯塔的故事展开后，留意码头',
    objective: () => '这天之后，码头好像来了条船',
    isUnlocked: () => hasTriggered('ch3_lighthouse_arrival'),
    isDone: () => hasTriggered('ch3_ship_arrived'),
  },
  {
    id: 'ch3_stranger',
    title: '旅人张先生',
    lockHint: '船靠岸后解锁',
    objective: () => '和旅人张先生聊聊他的打算',
    isUnlocked: () => hasTriggered('ch3_ship_arrived'),
    isDone: () => hasTriggered('ch3_b_photo'),
  },
  {
    id: 'ch3_town_react',
    title: '镇上的讨论',
    lockHint: '旅人的提案落地后解锁',
    objective: () => '听听镇民们对那场市集的说法',
    isUnlocked: () => hasTriggered('ch3_b_photo'),
    isDone: () => hasTriggered('ch3_town_react'),
  },
  {
    id: 'ch3_shards',
    title: '三块碎片',
    lockHint: '留意散落在各处的旧物',
    objective: () => {
      const n = ['ch3_shard_fm', 'ch3_shard_qh', 'ch3_shard_lh'].filter((f) => hasTriggered(f)).length;
      return `找回爷爷留下的碎片（${n}/3）`;
    },
    isUnlocked: () =>
      hasTriggered('ch3_town_react')
      || hasTriggered('ch3_shard_fm') || hasTriggered('ch3_shard_qh') || hasTriggered('ch3_shard_lh'),
    isDone: () => hasTriggered('ch3_shard_fm') && hasTriggered('ch3_shard_qh') && hasTriggered('ch3_shard_lh'),
  },
  {
    id: 'ch3_diary_finale',
    title: '爷爷的日记',
    lockHint: '集齐碎片后解锁',
    objective: () => '碎片指向爷爷留下的一页日记',
    isUnlocked: () => hasTriggered('ch3_shard_fm') && hasTriggered('ch3_shard_qh') && hasTriggered('ch3_shard_lh'),
    isDone: () => hasTriggered('ch3_diary_finale'),
  },
  {
    id: 'ch3_end',
    title: '归位',
    lockHint: '日记终章后解锁',
    objective: () => '灯亮起来了——是留下，还是出发？',
    isUnlocked: () => hasTriggered('ch3_finale_open'),
    isDone: () => hasTriggered('ch3_end_stay') || hasTriggered('ch3_end_leave') || hasTriggered('ch3_end_bridge'),
  },
];

/** 章节任务行渲染：未解锁 / 进行中 / 已完成 */
function chainQuestRowHtml(q: ChapterQuestDef): string {
  if (!q.isUnlocked()) {
    return `<div style="padding:6px 10px;margin-bottom:6px;color:#7a7262;background:rgba(255,255,255,0.02);border-radius:6px;opacity:0.85;">
      <div style="font-size:13px;color:#a09880;">🔒 ${escapeHtml(q.title)}</div>
      <div style="font-size:11px;color:#6a6355;margin-top:2px;">${escapeHtml(q.lockHint)}</div>
    </div>`;
  }
  if (q.isDone()) {
    return `<div style="padding:6px 10px;margin-bottom:6px;color:#6a8a6a;background:rgba(126,220,126,0.10);border-radius:6px;">
      <div style="font-size:13px;color:#7ec87e;">✅ ${escapeHtml(q.title)}</div>
      <div style="font-size:12px;color:#8aa88a;margin-top:2px;">已完成</div>
    </div>`;
  }
  return `<div style="padding:8px 10px;margin-bottom:6px;background:rgba(126,184,218,0.12);border-radius:6px;border-left:3px solid #7eb8da;">
    <div style="font-size:13px;font-weight:bold;color:#cdeafa;">${escapeHtml(q.title)} <span style="font-size:11px;color:#8fd6ff;">进行中</span></div>
    <div style="font-size:12px;color:#cbd2d6;margin-top:2px;">${escapeHtml(q.objective())}</div>
  </div>`;
}

/** 第0章「星之碎片」行（chapter<1 时为进行中主线；chapter>=1 时为已完成历史行） */
function demoQuestRowHtml(): string {
  const state = getQuestState();
  const objective = getQuestObjective();
  const stateLabel: Record<string, string> = {
    accepted: '进行中',
    collected: '前往交付',
    completed: '已完成 👑',
    not_started: '可接取',
  };
  return `<div style="padding:8px 10px;margin-bottom:6px;background:rgba(126,184,218,0.12);border-radius:6px;border-left:3px solid #7eb8da;">
    <div style="font-size:13px;font-weight:bold;color:#cdeafa;">星之碎片 <span style="font-size:11px;color:#8fd6ff;">${stateLabel[state] ?? ''}</span></div>
    <div style="font-size:12px;color:#cbd2d6;margin-top:2px;">${objective}</div>
  </div>`;
}

/**
 * 主线页签渲染：按章节分段（v1.1，2026-09-02）
 * 原版无论进度都渲染「星之碎片」Demo 行 → 一/二/三章存档看到的任务列表永远停在 Demo 阶段。
 * 改为：第0章（chapter<1 进行中主线 / chapter>=1 已完成历史行）→ 第一/二/三章任务链分段；
 * 分段可见性由 flag 只读推导（第二章=春日集后或任一 ch2 flag；第三章=灯塔解锁即 ch2_black_dot）。
 */
function mainRowHtml(): string {
  const chapter = getChapter();
  if (chapter < CHAPTER_1) {
    // 第0章进行中：Demo 主线（体验已冻结 D-021，保持原样）
    return demoQuestRowHtml();
  }
  let html = `<div style="margin:2px 0 4px;font-size:12px;color:#8a7a62;">—— 第0章 · 归星 ——</div>`;
  html += demoQuestRowHtml();
  html += `<div style="margin:10px 0 4px;font-size:12px;color:#8a7a62;">—— 第一章 · 复苏 ——</div>`;
  html += CH1_QUESTS.map((q) => chainQuestRowHtml(q)).join('');
  if (hasTriggered('ch1_spring_fair') || CH2_ANY()) {
    html += `<div style="margin:10px 0 4px;font-size:12px;color:#8a7a62;">—— 第二章 · 春信 ——</div>`;
    html += CH2_QUESTS.map((q) => chainQuestRowHtml(q)).join('');
  }
  if (CH3_ANY()) {
    html += `<div style="margin:10px 0 4px;font-size:12px;color:#8a7a62;">—— 第三章 · 归位 ——</div>`;
    html += CH3_QUESTS.map((q) => chainQuestRowHtml(q)).join('');
  }
  return html;
}

/** 每日任务行渲染（含进度 + 领奖 + 已领） */function dailyRowHtml(q: DailyQuestInstance): string {
  const progress = q.progress >= q.target ? '' : ` <span style="color:#aaa;">${q.progress}/${q.target}</span>`;
  if (q.claimed) {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;margin-bottom:4px;color:#777;background:rgba(255,255,255,0.03);border-radius:6px;">
      <span>✅ ${q.desc}</span><span style="font-size:10px;">已领奖</span>
    </div>`;
  }
  if (q.completed) {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;margin-bottom:4px;color:#ffd700;background:rgba(255,215,0,0.14);border-radius:6px;">
      <span>🎁 ${q.desc}${progress}</span>
      <button data-claim="${q.id}" style="font-size:11px;padding:3px 10px;background:#ffd700;color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">领奖</button>
    </div>`;
  }
  // B-1（制作人拍板 2026-08-03）：NPC 已回家（不渲染）时，对未完成对话任务追加友好提示
  if (!q.claimed && !q.completed && q.objective.type === 'talk_npc') {
    const home = getTalkNpcHomeHint(q.objective.npcId, q.objective.npcName);
    if (home) {
      return `<div style="display:flex;align-items:center;padding:4px 10px;margin-bottom:4px;color:#d8d2c8;background:rgba(255,255,255,0.04);border-radius:6px;">
        <span>⬜ ${q.desc}${progress}</span>
      </div>
      <div style="padding:2px 10px 6px 10px;margin-top:-4px;color:#8a7a62;font-size:12px;">🌙 ${home.hint}</div>`;
    }
  }
  return `<div style="display:flex;align-items:center;padding:4px 10px;margin-bottom:4px;color:#d8d2c8;background:rgba(255,255,255,0.04);border-radius:6px;">
    <span>⬜ ${q.desc}${progress}</span>
  </div>`;
}

/** 支线任务行渲染：未解锁 / 进行中 / 已完成 */
function sideQuestRowHtml(q: SideQuestDef, f: QuestFlags): string {
  if (!q.isUnlocked(f)) {
    return `<div style="padding:6px 10px;margin-bottom:6px;color:#7a7262;background:rgba(255,255,255,0.02);border-radius:6px;opacity:0.85;">
      <div style="font-size:13px;color:#a09880;">🔒 ${escapeHtml(q.title)}</div>
      <div style="font-size:11px;color:#6a6355;margin-top:2px;">${escapeHtml(q.lockHint)}</div>
    </div>`;
  }
  if (q.isDone(f)) {
    return `<div style="padding:6px 10px;margin-bottom:6px;color:#6a8a6a;background:rgba(126,220,126,0.10);border-radius:6px;">
      <div style="font-size:13px;color:#7ec87e;">✅ ${escapeHtml(q.title)}</div>
      <div style="font-size:12px;color:#8aa88a;margin-top:2px;">已完成</div>
    </div>`;
  }
  return `<div style="padding:8px 10px;margin-bottom:6px;background:rgba(126,184,218,0.12);border-radius:6px;border-left:3px solid #7eb8da;">
    <div style="font-size:13px;font-weight:bold;color:#cdeafa;">${escapeHtml(q.title)} <span style="font-size:11px;color:#8fd6ff;">进行中</span></div>
    <div style="font-size:12px;color:#cbd2d6;margin-top:2px;">${escapeHtml(q.objective)}</div>
  </div>`;
}

/** 居民需求行渲染（复用 ResidentRequestSystem；完成态经 EventManager） */
function residentRequestRowHtml(): string {
  const reqs = getResidentRequests();
  if (reqs.length === 0) return '';
  return reqs.map((r) => {
    const done = isRequestDone(r.id);
    const enough = canFulfillRequest(r);
    if (done) {
      return `<div style="padding:6px 10px;margin-bottom:6px;color:#6a8a6a;background:rgba(126,220,126,0.10);border-radius:6px;">
        <div style="font-size:13px;color:#7ec87e;">✅ ${escapeHtml(r.npcName)}的请求</div>
        <div style="font-size:12px;color:#8aa88a;margin-top:2px;">已完成 · 需求已送达</div>
      </div>`;
    }
    return `<div style="padding:8px 10px;margin-bottom:6px;background:rgba(255,215,0,0.08);border-radius:6px;border-left:3px solid #c8a83a;">
      <div style="font-size:13px;font-weight:bold;color:#e8d8a0;">📌 ${escapeHtml(r.npcName)}的请求 <span style="font-size:11px;color:#d0b860;">待交付</span></div>
      <div style="font-size:12px;color:#cbd2d6;margin-top:2px;">${r.itemKind === 'wood' ? `交付木材 ×${r.count}` : '交付食物（萝卜/番茄/玉米/草莓）'}${enough ? '' : '<span style="color:#ff9a6a;">（资源不足）</span>'}</div>
      <div style="font-size:11px;color:#8a7a62;margin-top:2px;">可在小镇需求板交付</div>
    </div>`;
  }).join('');
}

/** 刷新面板内容（按当前激活分类） */
function refresh(active: Tab = 'daily'): void {
  if (!panelEl) return;
  const body = panelEl.querySelector('#qp-body');
  if (!body) return;

  // 页签
  const tabsHtml = TABS.map(t => {
    const disabled = (t.key === 'affinity') ? 'opacity:0.35;pointer-events:none;' : '';
    const activeStyle = t.key === active
      ? 'background:#8a6a45;color:#fff;'
      : 'background:rgba(138,106,69,0.25);color:#d8c2a0;';
    return `<button data-tab="${t.key}" style="flex:1;padding:6px 0;border:none;border-radius:5px;cursor:pointer;font-size:12px;${activeStyle}${disabled}">${t.label}</button>`;
  }).join('');
  panelEl.querySelector('#qp-tabs')!.innerHTML = tabsHtml;

  let html = '';
  if (active === 'main') {
    html = mainRowHtml();
  } else if (active === 'side') {
    const flags = flagsProvider?.() ?? null;
    const sideHtml = flags
      ? SIDE_QUESTS.map((q) => sideQuestRowHtml(q, flags)).join('')
      : '<div style="text-align:center;color:#8a7a62;padding:12px 10px;font-size:12px;">任务数据加载中…</div>';
    const residentHtml = residentRequestRowHtml();
    if (sideHtml && residentHtml) {
      html = sideHtml + '<div style="margin:6px 0 4px;font-size:12px;color:#8a7a62;">—— 居民需求 ——</div>' + residentHtml;
    } else {
      html = sideHtml + residentHtml;
    }
  } else if (active === 'daily') {
    const quests = getDailyQuests();
    if (quests.length === 0) {
      html = '<div style="text-align:center;color:#8a7a62;padding:30px 10px;font-size:13px;">今日任务已完成</div>';
    } else {
      html = quests.map(dailyRowHtml).join('');
    }
  } else {
    html = '<div style="text-align:center;color:#8a7a62;padding:30px 10px;font-size:13px;">敬请期待 · 好感系统</div>';
  }
  body.innerHTML = html;
  syncBadge();
}

/** 同步任务按钮红点（日常有可领奖） */
function syncBadge(): void {
  // 若角标未挂载（早期场景未建 quest-btn），尝试重挂
  const btn = document.getElementById('quest-btn');
  if (!badgeEl && btn) refreshBadgeElement();
  if (!badgeEl) return;
  const claimable = getDailyQuests().filter(q => q.completed && !q.claimed).length;
  badgeEl.textContent = claimable > 0 ? String(claimable) : '';
  badgeEl.style.display = claimable > 0 ? 'flex' : 'none';
}

function closePanel(): void {
  if (!open) return;
  open = false;
  // A4 动效：面板 fadeOut
  if (panelEl) panelFadeOut(panelEl, 150);
  onClose?.();
}

function createDom(): void {
  if (domCreated) return;
  if (document.getElementById('quest-panel')) { domCreated = true; return; }
  domCreated = true;

  panelEl = document.createElement('div');
  panelEl.id = 'quest-panel';
  panelEl.style.cssText =
    'position:fixed;top:0;right:0;bottom:0;left:0;display:none;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,0.55);z-index:215;user-select:none;-webkit-user-select:none';
  panelEl.innerHTML = `
    <div style="width:min(380px,90vw);max-height:85vh;overflow-y:auto;background:#3d3226;border:3px solid #8a6a45;border-radius:10px;padding:16px;color:#fff;font-family:Arial;box-shadow:0 4px 20px rgba(0,0,0,0.6)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-size:18px;font-weight:bold;color:#ffd700;letter-spacing:1px;">任务</span>
        <div style="position:relative;">
          <button data-action="close" style="width:30px;height:30px;border-radius:50%;background:#8a6a45;border:none;color:#fff;font-size:16px;cursor:pointer;line-height:1;">×</button>
        </div>
      </div>
      <div id="qp-tabs" style="display:flex;background:rgba(0,0,0,0.25);border-radius:6px;padding:3px;margin-bottom:10px;"></div>
      <div id="qp-body" style="max-height:50vh;overflow-y:auto;"></div>
    </div>
  `;
  // 红点（任务按钮角标，由 TouchControls 查询挂载）
  document.body.appendChild(panelEl);

  panelEl.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset?.action === 'close') { closePanel(); return; }
    const tab = target.dataset?.tab as Tab | undefined;
    if (tab) refresh(tab);
    const claim = target.dataset?.claim;
    if (claim) {
      if (claimReward(claim)) {
        // 声音补全 v1.0（2026-08-09）：任务完成专属成就感音效（区别于 XP 升级 levelup）
        play('quest_complete');
        // 小结算：帮助居民时触发事件标签
        const quest = getDailyQuests().find((q) => q.id === claim);
        if (quest && quest.objective.type === 'talk_npc') {
          triggerTag('help_resident');
          showMemoryMoment('有些门，不是打不开，只是需要一个人先敲响。');
        }
        refresh('daily');
        onClaim?.();
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); closePanel(); }
  });
  // 更新任务按钮红点角标
  refreshBadgeElement();
}

/** 创建/更新任务按钮角标（触摸右侧操作区新增"任务"按钮） */
export function refreshBadgeElement(): void {
  const btn = document.getElementById('quest-btn');
  if (!btn) return;
  let badge = btn.querySelector<HTMLDivElement>('.q-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'q-badge';
    badge.style.cssText =
      'position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;' +
      'background:#e04444;color:#fff;font:bold 11px Arial;display:none;align-items:center;justify-content:center;' +
      'border:2px solid #fff;box-sizing:border-box;';
    btn.appendChild(badge);
  }
  badgeEl = badge as HTMLDivElement;
  syncBadge();
}

export class QuestPanel {
  constructor(onCloseCb?: OnClose, onClaimCb?: OnClaim, flagsCb?: () => QuestFlags | null) {
    if (onCloseCb) onClose = onCloseCb;
    if (onClaimCb) onClaim = onClaimCb;
    if (flagsCb) flagsProvider = flagsCb;
    if (!domCreated) createDom();
  }

  open(): void {
    open = true;
    // 声音补全 v1.0（2026-08-09）：面板打开轻确认音
    play('ui_confirm');
    if (panelEl) {
      refresh('daily');
      // A4 动效：面板 fadeIn
      panelFadeIn(panelEl, 180);
    }
  }

  close(): void { closePanel(); }
  isOpen(): boolean { return open; }
  /** 刷新红点（每次调用先确保角标挂载，避免早期场景未建 quest-btn 导致 badge 丢失） */
  refresh(): void {
    refreshBadgeElement();
    syncBadge();
  }
  /** 可领奖任务数（供探针/调试验证红点生命周期） */
  claimableCount(): number {
    return getDailyQuests().filter(q => q.completed && !q.claimed).length;
  }
}