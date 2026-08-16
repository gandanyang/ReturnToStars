/**
 * 自然记录图鉴目录（P1 Discovery 图鉴展示 · 信息展示层）
 *
 * 定位（2026-08-16 制作人拍板）：图鉴不是"收集百分比/成就"，而是"玩家认识这片土地"的
 * 信息展示层——已发现条目显示第一次发现的地点与特殊条件；未发现条目只给轻提示（去哪找、
 * 什么条件下可能遇到），不弹任务、不给奖励。
 *
 * 数据源：DiscoveryManager（玩家记忆入档），本表只提供"展示元数据"（名字/图标/提示文案），
 * 两者分离——玩家记忆进存档，目录可随时增补。
 */

/** 特殊发现 id → 一句话说明（图鉴展示用，与 DiscoveryManager.specialDiscoveries 对齐） */
export const SPECIAL_DISCOVERY_NOTES: Record<string, string> = {
  rain_forest: '下雨的时候，森林里总会冒出一些平时不容易发现的蘑菇。',
  rain_river: '下雨的时候，河边的浅滩会爬上一些小螺。',
  night_firefly: '天黑以后，森林的角落会亮起一点点光。',
};

/** 图鉴条目（一种自然物） */
export interface DiscoveryCatalogEntry {
  /** 资源 id（对应 DiscoveryManager records key / Inventory item id） */
  id: string;
  /** 名字 */
  name: string;
  /** 一句话描述（图鉴正文） */
  desc: string;
  /** 发现提示（未发现时展示；只提示去哪/什么条件，不剧透具体产出） */
  hint: string;
}

/** 自然记录图鉴目录（第一版：现有采集物 5 种 + 特殊发现 2 条） */
export const DISCOVERY_CATALOG: DiscoveryCatalogEntry[] = [
  {
    id: 'dandelion',
    name: '蒲公英',
    desc: '路边常见的小花。风一吹，种子就散了。',
    hint: '镇上的草地、河边，常常能看见。',
  },
  {
    id: 'wild_berry',
    name: '野莓',
    desc: '河边灌木丛里摘的。酸甜，手指会染红。',
    hint: '河岸边的灌木丛里能找到。',
  },
  {
    id: 'wild_mushroom',
    name: '野蘑菇',
    desc: '林子里背阴处长的小蘑菇。颜色朴素，应该没问题。',
    hint: '后山的林子里，下雨天会特别多。',
  },
  {
    id: 'small_flower',
    name: '小野花',
    desc: '不知名的小花一株。开得不大，但颜色好看。',
    hint: '镇上的草地、林间空地，星星点点地开着。',
  },
  {
    id: 'twig',
    name: '小树枝',
    desc: '地上捡的枯枝。修东西的时候总用得上。',
    hint: '森林的树底下，总能捡到一些。',
  },
  {
    id: 'river_snail',
    name: '河螺',
    desc: '雨天才爬上浅滩的小螺。壳上还沾着水珠。',
    hint: '河边的浅滩，下雨天会爬上一些。',
  },
  {
    id: 'river_grass',
    name: '河草',
    desc: '河边湿地上长的水草。叶子细长，摸起来凉凉的。',
    hint: '河岸边的湿草地上，常年长着一些。',
  },
  {
    id: 'firefly',
    name: '萤火虫',
    desc: '天黑以后才出来的小光点。',
    hint: '夜晚的森林里，好像能看见。',
  },
];
