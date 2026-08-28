/**
 * 物品库存（Phase 0.25 背包系统）
 *
 * 模块级单例：物品数量跨场景保留。
 */

/** 物品类型 */
export type ItemType = 'radish' | 'tomato' | 'corn' | 'strawberry' | 'radish_seed' | 'tomato_seed' | 'corn_seed' | 'strawberry_seed' | 'star_shard' | 'diamond' | 'stone' | 'copper' | 'iron' | 'manor_key' | 'old_hoe' | 'old_watering_can' | 'old_axe' | 'wood' | 'auto_farmer_robot'
  // SHOP-01 青禾镇商店复兴（2026-08-09）：岛屿修复类 + 生活装饰类商品
  | 'flower_seedling' | 'lantern' | 'wood_sign'
  // 爷爷的归星包裹 v0.1（2026-08-11，制作人拍板 P0 序章体验补强）：纪念物，不参与售卖
  | 'dried_fish' | 'grandpa_letter'
  // 第一章 P2 捕虫玩法 V0.1（2026-08-13）：farm/town 蝴蝶捕捉纪念物，不可售，与 dried_fish 同类
  | 'butterfly_specimen'
  // 第一章 v0.11 图鉴墙（2026-08-14，制作人拍板）：小梅观察记录的新虫标本，不可售
  | 'willow_specimen' | 'moth_specimen'
  // 第一章 P2 钓鱼 Phase 1（2026-08-14，制作人 Decision Override 启动）：S6 老河堤钓到的纯手感测试鱼
  | 'qinghe_crucian'
  // 第一章 P2 钓鱼 Phase 3（2026-08-14 制作人拍板）：河虾 / 黄昏鱼
  | 'river_shrimp' | 'dusk_fish'
  // 第一章 P2 钓鱼扩展（2026-08-14 制作人拍板）：月光鲈——farm 稀有钓点的高级鱼
  | 'moon_bass'
  // 钓鱼生态化 v1.3（2026-08-15 制作人拍板）：普通特殊鱼（生态可重复）——河鳗/鲤鱼/大青鱼
  | 'river_eel' | 'common_carp' | 'big_blue_fish'
  // 钓鱼生态化 v1.3（2026-08-15 制作人拍板方向）：低概率小鱼苗事件——带走=收藏，不可售
  | 'qinghe_fry'
  // 第一章 P2 生活采集 Phase 1（2026-08-14，制作人设计稿 v0.1）：5 种自然采集物，可售
  | 'dandelion' | 'wild_berry' | 'wild_mushroom' | 'small_flower' | 'twig'
  // 天气扩面（2026-08-16 制作人拍板）：雨天河边河螺（水边资源第二种落地，water 标签首个消费者）
  | 'river_snail'
  // 天气扩面三刀收口（2026-08-16 制作人拍板）：河草（普通水边资源，water 标签第二个消费者）
  | 'river_grass'
  // 钓鱼老人老姜《钓鱼修行》v0.1（2026-08-14 制作人拍板）：老姜送出的旧鱼竿，纪念物，不可售
  | 'old_fishing_rod';

/** 出售优先级标签（FEATURE-039 智能出售） */
export type SellPriority = 'normal' | 'reserve' | 'forbidden';

/** 资源标签（自然资源与生活制作 P0-4，2026-08-15）：未来所有系统（堆肥/料理/制作/发现）的接口。
 *   P0 只打标签不消费；后续 堆肥=plant+organic / 料理=food / 制作=wood 不再改资源定义。 */
export type ResourceTag = 'wood' | 'plant' | 'flower' | 'food' | 'insect' | 'mineral' | 'water' | 'special';

/** 物品定义 */
export interface ItemDef {
  id: ItemType;
  name: string;
  /** 描述（背包悬浮提示用，暂不显示） */
  desc: string;
  /** 物品图标 emoji（后续替换为像素图） */
  icon: string;
  /** 出售优先级：normal=正常出售 / reserve=保留（不自动卖，可手动卖）/ forbidden=不可售 */
  sellPriority: SellPriority;
  /** 资源标签（可选；P0 为采集物/自然资源打标，供未来制作/图鉴系统查询） */
  resourceTags?: ResourceTag[];
}

/** 物品定义表 */
export const ITEM_DEFS: Record<ItemType, ItemDef> = {
  radish: { id: 'radish', name: '萝卜', desc: '农场种植的普通萝卜，可出售换取金币。', icon: '🥕', sellPriority: 'normal' },
  tomato: { id: 'tomato', name: '番茄', desc: '红润饱满的番茄，比萝卜更值钱。', icon: '🍅', sellPriority: 'normal' },
  corn: { id: 'corn', name: '玉米', desc: '金黄饱满的玉米，生长周期较长。', icon: '🌽', sellPriority: 'normal' },
  strawberry: { id: 'strawberry', name: '草莓', desc: '鲜红香甜的草莓，稀有作物价值很高。', icon: '🍓', sellPriority: 'normal' },
  radish_seed: { id: 'radish_seed', name: '萝卜种子', desc: '种在锄过的土地上，浇水后3天成熟。', icon: '🌱', sellPriority: 'forbidden' },
  tomato_seed: { id: 'tomato_seed', name: '番茄种子', desc: '种在锄过的土地上，浇水后4天成熟。', icon: '🌱', sellPriority: 'forbidden' },
  corn_seed: { id: 'corn_seed', name: '玉米种子', desc: '种在锄过的土地上，浇水后5天成熟。', icon: '🌱', sellPriority: 'forbidden' },
  strawberry_seed: { id: 'strawberry_seed', name: '草莓种子', desc: '稀有种子，浇水后6天成熟，价值极高。', icon: '🌱', sellPriority: 'forbidden' },
  star_shard: { id: 'star_shard', name: '星之碎片', desc: '星辰岛心脏的碎片，散发着微光。', icon: '💎', sellPriority: 'forbidden' },
  diamond: { id: 'diamond', name: '钻石', desc: '完成每日任务获得的稀有货币，可在特殊商店兑换稀有物品。', icon: '💠', sellPriority: 'forbidden' },
  stone: { id: 'stone', name: '石头', desc: '矿洞中开采的普通石材，可用于建筑或出售。', icon: '🪨', sellPriority: 'reserve' },
  copper: { id: 'copper', name: '铜矿', desc: '铜色矿石，可用于工具升级或出售。', icon: '🟤', sellPriority: 'normal' },
  iron: { id: 'iron', name: '铁矿', desc: '稀有的铁矿石，价值较高。', icon: '⚪', sellPriority: 'reserve' },
  manor_key: { id: 'manor_key', name: '庄园钥匙', desc: '打开星黎庄园大门的钥匙。', icon: '🗝️', sellPriority: 'forbidden' },
  old_hoe: { id: 'old_hoe', name: '旧锄头', desc: '一把老旧的锄头，用来翻地足够了。', icon: '⚒️', sellPriority: 'forbidden' },
  old_watering_can: { id: 'old_watering_can', name: '旧水壶', desc: '给作物浇水用的旧水壶。', icon: '🚿', sellPriority: 'forbidden' },
  old_axe: { id: 'old_axe', name: '旧斧头', desc: '一把生锈的斧头，砍几棵树应该没问题。', icon: '🪓', sellPriority: 'forbidden' },
  wood: { id: 'wood', name: '木材', desc: '砍树获得的木材，可用于建筑或出售。', icon: '🪵', sellPriority: 'reserve' },
  auto_farmer_robot: { id: 'auto_farmer_robot', name: '自动农业机器人', desc: '放置在农田附近，每天清晨自动浇水、自动收获成熟作物。', icon: '🤖', sellPriority: 'forbidden' },
  // SHOP-01 商店复兴商品（2026-08-09，制作人拍板）
  flower_seedling: { id: 'flower_seedling', name: '旧花苗', desc: '有人曾经精心照料过它。', icon: '🌷', sellPriority: 'forbidden' },
  lantern: { id: 'lantern', name: '小灯笼', desc: '暖黄色的光，照亮回家的路。', icon: '🏮', sellPriority: 'forbidden' },
  wood_sign: { id: 'wood_sign', name: '木牌', desc: '可以写上字，也可以什么都不写。', icon: '🪧', sellPriority: 'forbidden' },
  // 爷爷的归星包裹 v0.1（2026-08-11）：爷爷留下的纪念物，不可售
  dried_fish: { id: 'dried_fish', name: '小鱼干', desc: '晒干的小鱼。爷爷的习惯——岛上的日子，得有点咸味。', icon: '🐟', sellPriority: 'forbidden' },
  grandpa_letter: { id: 'grandpa_letter', name: '爷爷的信', desc: '爷爷留在包裹里的信。字迹很稳，落笔很慢。', icon: '✉️', sellPriority: 'forbidden' },
  // 第一章 P2 捕虫玩法 V0.1（2026-08-13）：花丛里轻轻捉到的一只，纪念物
  butterfly_specimen: { id: 'butterfly_specimen', name: '蝴蝶标本', desc: '在花丛里轻轻捉到的一只。翅膀薄得能透光。', icon: '🦋', sellPriority: 'forbidden' },
  // 第一章 v0.11 图鉴墙（2026-08-14，制作人拍板）：柳叶蝶标本，河边柳树下，不可售
  willow_specimen: { id: 'willow_specimen', name: '柳叶蝶标本', desc: '在河边柳树下捉到的。翅膀细长，绿得像一片嫩叶。', icon: '🦋', sellPriority: 'forbidden' },
  // 第一章 v0.11 图鉴墙（2026-08-14，制作人拍板）：夜光蛾标本，老树旁夜里，不可售
  moth_specimen: { id: 'moth_specimen', name: '夜光蛾标本', desc: '夜里在老树旁捉到的。翅膀在暗处会泛一点微光。', icon: '✨', sellPriority: 'forbidden' },
  // 第一章 P2 钓鱼 Phase 1（2026-08-14）：S6 老河堤钓到的青禾鲫，纯手感测试鱼，可售（Phase 3 接入鱼价）
  qinghe_crucian: { id: 'qinghe_crucian', name: '青禾鲫', desc: '青禾镇河里常见的小鱼。银色的鳞，腮边一点红。', icon: '🐟', sellPriority: 'normal' },
  // 第一章 P2 钓鱼 Phase 3（2026-08-14）：河虾，白天石头缝里的小东西，更容易试探，可售
  river_shrimp: { id: 'river_shrimp', name: '河虾', desc: '浅水石头缝里的小东西，一有动静就弹开。', icon: '🦐', sellPriority: 'normal' },
  // 第一章 P2 钓鱼 Phase 3（2026-08-14）：黄昏鱼，只在黄昏浮上水面，等待更久，可售
  dusk_fish: { id: 'dusk_fish', name: '黄昏鱼', desc: '只在黄昏浮上水面。鳞片映着最后一缕光。', icon: '🐠', sellPriority: 'normal' },
  // 第一章 P2 钓鱼扩展（2026-08-14）：月光鲈，只在农场池塘的月下浮起，稀有高级鱼，可售
  moon_bass: { id: 'moon_bass', name: '月光鲈', desc: '只在月光照到池塘时浮起。银白鳞片上有一圈淡淡的月晕。', icon: '🐟', sellPriority: 'normal' },
  // 钓鱼生态化 v1.3（2026-08-15）：普通特殊鱼（生态可重复）——夜里钻出来的河鳗
  river_eel: { id: 'river_eel', name: '河鳗', desc: '夜里才从石头底下钻出来。滑溜溜的，很难握稳。', icon: '🐟', sellPriority: 'normal' },
  // 钓鱼生态化 v1.3（2026-08-15）：普通特殊鱼（生态可重复）——老河常客鲤鱼
  common_carp: { id: 'common_carp', name: '鲤鱼', desc: '老河里的常客。红鳞，个头不小。', icon: '🐟', sellPriority: 'normal' },
  // 钓鱼生态化 v1.3（2026-08-15）：普通特殊鱼（生态可重复）——咬了就跑的大青鱼
  big_blue_fish: { id: 'big_blue_fish', name: '大青鱼', desc: '青灰色的大鱼。咬了就跑，收竿要更稳。', icon: '🐠', sellPriority: 'normal' },
  // 钓鱼生态化 v1.3（2026-08-15）：低概率小鱼苗——"带回去"是收藏/研究，不设价格（不是正确答案，只是参与了世界）
  qinghe_fry: { id: 'qinghe_fry', name: '青禾鱼苗', desc: '还没长大的小鱼。鳞片透明，能看见小小的心跳。', icon: '🐟', sellPriority: 'forbidden' },
  // 第一章 P2 生活采集 Phase 1（2026-08-14，制作人设计稿 v0.1）：5 种自然采集物，可售
  // 设计原则：采集是"顺手发现"，不是刷取；售价低，主要价值是"世界有生命"
  dandelion: { id: 'dandelion', name: '蒲公英', desc: '路边常见的小花。风一吹，种子就散了。', icon: '🌼', sellPriority: 'normal', resourceTags: ['plant', 'flower'] },
  wild_berry: { id: 'wild_berry', name: '野莓', desc: '河边灌木丛里摘的。酸甜，手指会染红。', icon: '🫐', sellPriority: 'normal', resourceTags: ['plant', 'food'] },
  wild_mushroom: { id: 'wild_mushroom', name: '野蘑菇', desc: '林子里背阴处长的小蘑菇。颜色朴素，应该没问题。', icon: '🍄', sellPriority: 'normal', resourceTags: ['plant', 'food'] },
  small_flower: { id: 'small_flower', name: '小野花', desc: '不知名的小花一株。开得不大，但颜色好看。', icon: '🌸', sellPriority: 'normal', resourceTags: ['plant', 'flower'] },
  twig: { id: 'twig', name: '小树枝', desc: '地上捡的枯枝。修东西的时候总用得上。', icon: '🥢', sellPriority: 'normal', resourceTags: ['wood'] },
  // 天气扩面（2026-08-16 制作人拍板）：雨天河螺——雨天才爬上浅滩的小螺，河畔限定。
  // water 标签首个消费者（为未来制作/料理/发现系统铺路）；"雨天去河边"的第二个记忆锚点（与蘑菇并列）。
  river_snail: { id: 'river_snail', name: '河螺', desc: '雨天才爬上浅滩的小螺。壳上还沾着水珠。', icon: '🐚', sellPriority: 'normal', resourceTags: ['water'] },
  // 天气扩面三刀收口（2026-08-16 制作人拍板）：河草——岸边常年见的水草，普通采集物。
  // water 标签第二个消费者；"河畔水边的东西"与河螺（雨天）、芦苇（视觉）共同构成河岸采集带。
  river_grass: { id: 'river_grass', name: '河草', desc: '河边湿地上长的水草。叶子细长，摸起来凉凉的。', icon: '🌿', sellPriority: 'normal', resourceTags: ['water'] },
  // 钓鱼老人老姜《钓鱼修行》v0.1（2026-08-14 制作人拍板）：老姜送出的旧鱼竿，纪念物，不可售
  old_fishing_rod: { id: 'old_fishing_rod', name: '老姜的旧鱼竿', desc: '竹竿磨得发亮，握把缠着旧布。老姜说，以后河边修行，就咱俩了。', icon: '🎣', sellPriority: 'forbidden' },
};

/** 库存数据：物品类型 → 数量 */
const inventory: Record<ItemType, number> = {
  radish: 0,
  tomato: 0,
  corn: 0,
  strawberry: 0,
  radish_seed: 5,
  tomato_seed: 0,
  corn_seed: 0,
  strawberry_seed: 0,
  star_shard: 0,
  diamond: 0,
  stone: 0,
  copper: 0,
  iron: 0,
  manor_key: 0,
  old_hoe: 0,
  old_watering_can: 0,
  old_axe: 0,
  wood: 0,
  auto_farmer_robot: 0,
  flower_seedling: 0,
  lantern: 0,
  wood_sign: 0,
  dried_fish: 0,
  grandpa_letter: 0,
  butterfly_specimen: 0,
  willow_specimen: 0,
  moth_specimen: 0,
  qinghe_crucian: 0,
  river_shrimp: 0,
  dusk_fish: 0,
  moon_bass: 0,
  river_eel: 0,
  common_carp: 0,
  big_blue_fish: 0,
  qinghe_fry: 0,
  dandelion: 0,
  wild_berry: 0,
  wild_mushroom: 0,
  small_flower: 0,
  twig: 0,
  river_snail: 0,
  river_grass: 0,
  old_fishing_rod: 0,
};

/** 读取某物品数量 */
export function getItemCount(item: ItemType): number {
  return inventory[item] ?? 0;
}

/** 增加物品数量（默认 +1，支持负数减少） */
export function addItem(item: ItemType, count = 1): void {
  inventory[item] = (inventory[item] ?? 0) + count;
  if (inventory[item] < 0) inventory[item] = 0;
}

/** 直接设置物品数量（存档恢复用） */
export function setItemCount(item: ItemType, count: number): void {
  inventory[item] = Math.max(0, Math.floor(count));
}

/** 获取物品定义 */
export function getItemDef(item: ItemType): ItemDef {
  return ITEM_DEFS[item];
}

/** 获取所有非零库存物品（背包显示用） */
export function getNonEmptyItems(): { item: ItemType; count: number; def: ItemDef }[] {
  return (Object.keys(ITEM_DEFS) as ItemType[])
    .filter((id) => inventory[id] > 0)
    .map((id) => ({ item: id, count: inventory[id], def: ITEM_DEFS[id] }));
}

/** 获取所有物品条目（存档序列化用） */
export function getAllInventoryEntries(): [ItemType, number][] {
  return (Object.keys(ITEM_DEFS) as ItemType[]).map((id) => [id, inventory[id]]);
}

/** 恢复所有物品数量（存档恢复用） */
export function restoreAllInventory(data: Partial<Record<ItemType, number>>): void {
  // BUG-FIX（A6）：坏档判型——data 缺失/非对象/数组时按空背包收敛（仍先清零防旧值残留），
  // 防 data[id] 对非法容器取下标崩溃（apply 侧 ?? {} 只挡 null/undefined，挡不住错误类型）
  const src: Partial<Record<ItemType, number>> =
    data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  // 先清零所有物品（避免旧默认值残留，如 radish_seed: 5）
  for (const id of Object.keys(ITEM_DEFS) as ItemType[]) {
    inventory[id] = 0;
  }
  // 再从存档覆盖
  for (const id of Object.keys(ITEM_DEFS) as ItemType[]) {
    if (src[id] !== undefined) {
      inventory[id] = Math.max(0, Math.floor(src[id]));
    }
  }
}

/**
 * 物品图标 HTML（16×16 像素图标替换 emoji 渲染）
 * @param id     物品 ID（对应 public/assets/icons/{id}.png）
 * @param size   显示尺寸（px，默认 18）
 * 注：部分物品尚无 png 图标（如 dried_fish / grandpa_letter），缺失时 onerror 回退为 emoji，避免坏图。
 */
export function itemIconHtml(id: string, size = 18): string {
  const fallback = (ITEM_DEFS[id as ItemType]?.icon ?? '📦').replace(/'/g, '');
  return `<img src="assets/icons/${id}.png" alt="" onerror="this.style.display='none';this.insertAdjacentText('afterend','${fallback}');" style="width:${size}px;height:${size}px;vertical-align:middle;image-rendering:pixelated;">`;
}

// ── FEATURE-039：物品锁定（防止一键出售卖掉关键资源） ──
const lockedItems = new Set<ItemType>();

/** 切换物品锁定状态 */
export function toggleItemLock(item: ItemType): boolean {
  if (lockedItems.has(item)) {
    lockedItems.delete(item);
    return false;
  }
  lockedItems.add(item);
  return true;
}

/** 查询物品是否已锁定 */
export function isItemLocked(item: ItemType): boolean {
  return lockedItems.has(item);
}

/** 获取所有已锁定物品 ID（存档序列化用） */
export function getLockedItems(): ItemType[] {
  return Array.from(lockedItems);
}

/** 恢复锁定状态（存档恢复用） */
export function restoreLockedItems(items: string[]): void {
  lockedItems.clear();
  for (const id of items) {
    if (id in ITEM_DEFS) {
      lockedItems.add(id as ItemType);
    }
  }
}
