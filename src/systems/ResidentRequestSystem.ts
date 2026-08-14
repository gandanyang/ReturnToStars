/**
 * 居民需求板系统（FEATURE-038 · v0.10 · 林澈=连接者）
 *
 * 定位：信息连接者的玩法化——需求板展示村民需要什么，玩家交付后岛屿生活感增强。
 * 设计约束（任务卡红线）：
 *   - 固定脚本需求，不做动态生成 / 经济模拟
 *   - 独立于 QuestSystem 主线状态机
 *   - 不新建「归星助手」大系统（归星记录 GuiXingRecordSystem 已存在，复用）
 *
 * 数据流：
 *   - 需求数据为静态表（本模块）
 *   - 完成状态经 EventManager（gameState.triggeredEvents）持久化，旧档默认空 → 兼容
 *   - 交付 = 面板内一键交付：扣资源 → markTriggered → 反馈对白（StoryDialogue）→ triggerTag('help_resident')
 *
 * 食物聚合规则：food 类需求用 萝卜/番茄/玉米/草莓 任一组合扣除（按固定顺序先扣存量多的）。
 */

import { getItemCount, addItem, type ItemType } from '../data/Inventory';
import { getCoins, spendCoins, WOOD_BUY_PRICE, STONE_BUY_PRICE } from '../data/Economy';
import { markTriggered, hasTriggered } from './EventManager';

/** 需求物品类别：wood=木材 / stone=石头 / lantern=灯笼 / food=食物聚合 / fish=鱼聚合 / gather=采集物聚合 */
export type RequestItemKind = 'wood' | 'food' | 'stone' | 'lantern' | 'fish' | 'gather';

/** 一条居民需求（静态数据 + 完成态经 EventManager 查询，不入本模块） */
export interface ResidentRequest {
  /** 一次性事件 id（EventManager 持久化键，同时是需求唯一 id） */
  id: string;
  npcId: string;
  npcName: string;
  /** NPC 对白颜色（反馈对白 speaker 用，与 NPCSystem 一致） */
  npcColor: string;
  itemKind: RequestItemKind;
  count: number;
  /** 交付后 NPC 反馈（制作人定稿，Agent 不得扩写） */
  rewardDialogue: string;
}

/** 食物聚合物品池（扣除顺序：萝卜 → 番茄 → 玉米 → 草莓） */
const FOOD_ITEMS: ItemType[] = ['radish', 'tomato', 'corn', 'strawberry'];

/** 鱼聚合物品池（扣除顺序：青禾鲫 → 河虾 → 黄昏鱼 → 月光鲈） */
const FISH_ITEMS: ItemType[] = ['qinghe_crucian', 'river_shrimp', 'dusk_fish', 'moon_bass'];

/** 采集物聚合物品池（扣除顺序：蒲公英 → 野莓 → 野蘑菇 → 小野花 → 小树枝） */
const GATHER_ITEMS: ItemType[] = ['dandelion', 'wild_berry', 'wild_mushroom', 'small_flower', 'twig'];

/** 食物聚合显示名（不足提示用） */
const FOOD_LABEL = '食物（萝卜/番茄/玉米/草莓）';
const FISH_LABEL = '鱼（青禾鲫/河虾/黄昏鱼/月光鲈）';
const GATHER_LABEL = '采集物（蒲公英/野莓/野蘑菇/小野花/小树枝）';

// ============ 需求数据（任务卡定稿，制作人拍板数值与文案） ============

const REQUESTS: ResidentRequest[] = [
  {
    id: 'resident_req_gardener_wood',
    npcId: 'gardener',
    npcName: '花匠小梅',
    npcColor: '#a0d888',
    itemKind: 'wood',
    count: 10,
    rewardDialogue: '谢谢！有了这些木头，花架终于能搭起来了。',
  },
  {
    id: 'resident_req_miner_food',
    npcId: 'miner',
    npcName: '矿工老张',
    npcColor: '#d8a050',
    itemKind: 'food',
    count: 5,
    rewardDialogue: '正好下矿前垫垫肚子。谢了，小子。',
  },
  // ── 居民需求系统升级（2026-08 制作人拍板：结合 NPC 人设 + 世界观「复苏」意象） ──
  // 意象映射：镇长灯笼=老宅归属「灯亮=有人住」；阿风=童年秘密基地「河边煮锅」；
  //          老周=手艺传承「修东西的人不能绝」；老姜=河边生活「河虾配酒」。
  {
    id: 'resident_req_elder_lantern',
    npcId: 'elder',
    npcName: '镇长',
    npcColor: '#c8b898',
    itemKind: 'lantern',
    count: 2,
    rewardDialogue: '码头那盏灯，黑了好些年了。\n挂上它吧。\n以后夜里回来的人，也能远远看见这里还有灯亮着。',
  },
  {
    id: 'resident_req_adventurer_food',
    npcId: 'adventurer',
    npcName: '阿风',
    npcColor: '#88b8e8',
    itemKind: 'food',
    count: 3,
    rewardDialogue: '还是热乎的好。\n小时候咱们在河边煮东西，糊了好几次。\n你还记得不？',
  },
  {
    id: 'resident_req_carpenter_wood',
    npcId: 'carpenter',
    npcName: '木匠老周',
    npcColor: '#d8b878',
    itemKind: 'wood',
    count: 8,
    rewardDialogue: '好料子。\n门框窗框都能修。\n旧东西啊，就得有人愿意慢慢修。',
  },
  {
    id: 'resident_req_laojiang_fish',
    npcId: 'laojiang',
    npcName: '老姜',
    npcColor: '#d8b878',
    itemKind: 'fish',
    count: 2,
    rewardDialogue: '河里的鱼啊，配点酒，坐河边慢慢吃。',
  },
];

// ============ 查询 ============

/** 读取全部需求（只读；done 状态动态查询，不入静态数据） */
export function getResidentRequests(): readonly ResidentRequest[] {
  return REQUESTS;
}

/** 按 id 查需求 */
export function getRequestById(id: string): ResidentRequest | undefined {
  return REQUESTS.find((r) => r.id === id);
}

/** 需求是否已完成（经 EventManager 持久化） */
export function isRequestDone(id: string): boolean {
  return hasTriggered(id);
}

// ============ 交付判定 ============

/** 聚合池（按类别取） */
function aggregateItems(kind: RequestItemKind): ItemType[] {
  if (kind === 'food') return FOOD_ITEMS;
  if (kind === 'fish') return FISH_ITEMS;
  if (kind === 'gather') return GATHER_ITEMS;
  return [];
}

/** 聚合持有总量 */
function aggregateCount(kind: RequestItemKind): number {
  return aggregateItems(kind).reduce((sum, it) => sum + getItemCount(it), 0);
}

/** 背包是否足够交付该需求 */
export function canFulfillRequest(req: ResidentRequest): boolean {
  switch (req.itemKind) {
    case 'wood': return getItemCount('wood') >= req.count;
    case 'stone': return getItemCount('stone') >= req.count;
    case 'lantern': return getItemCount('lantern') >= req.count;
    case 'food':
    case 'fish':
    case 'gather': return aggregateCount(req.itemKind) >= req.count;
    default: return false;
  }
}

/** 资源不足提示文案（明确缺什么） */
export function getRequestShortageText(req: ResidentRequest): string {
  switch (req.itemKind) {
    case 'wood': return `木材不足，还差 ${req.count - getItemCount('wood')} 个`;
    case 'stone': return `石头不足，还差 ${req.count - getItemCount('stone')} 个`;
    case 'lantern': return `灯笼不足，还差 ${req.count - getItemCount('lantern')} 个`;
    case 'food': return `${FOOD_LABEL}不足，还差 ${req.count - aggregateCount('food')} 份`;
    case 'fish': return `${FISH_LABEL}不足，还差 ${req.count - aggregateCount('fish')} 条`;
    case 'gather': return `${GATHER_LABEL}不足，还差 ${req.count - aggregateCount('gather')} 个`;
    default: return '资源不足';
  }
}

/**
 * 资源快速置换：木材/石头类需求「用金币一键补齐」所需花费（按商店买入价）。
 * 木材 8G/根；石头按商店买入价。食物/鱼/采集物/灯笼不支持金币购买（聚合复杂，返回 null）。
 */
export function getRequestQuickBuyCost(req: ResidentRequest): number | null {
  if (req.itemKind !== 'wood' && req.itemKind !== 'stone') return null;
  if (isRequestDone(req.id)) return null;
  const have = req.itemKind === 'wood' ? getItemCount('wood') : getItemCount('stone');
  const need = req.count - have;
  if (need <= 0) return null;
  const price = req.itemKind === 'wood' ? WOOD_BUY_PRICE : STONE_BUY_PRICE;
  const cost = need * price;
  if (cost > getCoins()) return null;
  return cost;
}

/**
 * 资源快速置换：用金币补齐木材/石头缺口后立即交付。
 * 返回 FulfillResult（success / insufficient / done_already）。调用方负责反馈对白 + save。
 */
export function fulfillRequestWithGold(id: string): FulfillResult {
  const req = getRequestById(id);
  if (!req) return 'not_found';
  if (isRequestDone(id)) return 'done_already';
  if (req.itemKind !== 'wood' && req.itemKind !== 'stone') return 'insufficient';
  const have = req.itemKind === 'wood' ? getItemCount('wood') : getItemCount('stone');
  const need = req.count - have;
  if (need <= 0) return 'insufficient';
  const price = req.itemKind === 'wood' ? WOOD_BUY_PRICE : STONE_BUY_PRICE;
  const cost = need * price;
  if (!spendCoins(cost)) return 'insufficient';
  const item = req.itemKind === 'wood' ? 'wood' : 'stone';
  addItem(item, need);
  addItem(item, -req.count);
  markTriggered(id);
  return 'success';
}

// ============ 交付 ============

/** 交付结果 */
export type FulfillResult = 'success' | 'insufficient' | 'done_already' | 'not_found';

/**
 * 一键交付：扣资源 → 标记完成（EventManager）。
 * 调用方负责：成功后播放反馈对白 + triggerTag('help_resident') + save()。
 */
export function fulfillRequest(id: string): FulfillResult {
  const req = getRequestById(id);
  if (!req) return 'not_found';
  if (isRequestDone(id)) return 'done_already';
  if (!canFulfillRequest(req)) return 'insufficient';

  switch (req.itemKind) {
    case 'wood': addItem('wood', -req.count); break;
    case 'stone': addItem('stone', -req.count); break;
    case 'lantern': addItem('lantern', -req.count); break;
    case 'food':
    case 'fish':
    case 'gather': deductAggregate(req.itemKind, req.count); break;
  }
  markTriggered(id);
  return 'success';
}

/** 聚合扣除：按固定顺序从各物品里取够 count（调用前已校验总量足够） */
function deductAggregate(kind: RequestItemKind, count: number): void {
  for (const item of aggregateItems(kind)) {
    if (count <= 0) break;
    const have = getItemCount(item);
    const take = Math.min(have, count);
    if (take > 0) {
      addItem(item, -take);
      count -= take;
    }
  }
}
