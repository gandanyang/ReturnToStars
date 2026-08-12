/**
 * 场景出口与出生点配置
 * 区域连通拓扑：
 *   森林 ──── 矿洞
 *     │        │
 *   农场 ──── 小镇
 *
 * 灯塔（2026-08-10 制作人方案：灯塔岛在农场西边；入口 locked=未来内容预埋）：
 *   farm 西侧 → lighthouse（正常游玩不可进入；未来链路：城市复兴 →
 *   执灯人归来 → 灯塔重新点灯 → 开放，届时移除 locked 即可），lighthouse 西侧通道回 farm
 *   2026-08-11 调整（制作人反馈"灯塔影子效果不好"）：farm 西侧缺口已用石墙堵回，
 *   灯塔远景不可见（setupFarmWestCoast 撤除）；开放时除移除 locked 外，还需打通
 *   farm.json Walls 层 rows 10-13/col0 石墙 + 重建海湾视觉（见 docs/design/灯塔未来内容预埋方案-v1.0.md）
 *
 * 每个出口定义：触发区域(像素) + 目标场景 + 在目标场景的出生点(像素)
 * 出生点放在出口内侧 3 格，避免切换后立刻触发反向出口
 * locked: true 的出口不会触发场景切换，也不显示出口指示箭头
 */

export interface ExitZone {
  /** 触发区域左上角 x（像素） */
  x: number;
  /** 触发区域左上角 y（像素） */
  y: number;
  /** 触发区域宽（像素） */
  w: number;
  /** 触发区域高（像素） */
  h: number;
  /** 目标场景 key */
  target: string;
  /** 在目标场景的出生点（像素） */
  spawn: { x: number; y: number };
  /** 锁定出口：不触发切换、不显示箭头（未来内容预埋用） */
  locked?: boolean;
}

/** 瓦片尺寸，用于把瓦片坐标换算成像素 */
const T = 16;

export const MAP_EXITS: Record<string, ExitZone[]> = {
  // 门厅：底→车站，顶→农场
  gate: [
    { x: 14 * T, y: 0,       w: 3 * T, h: 3 * T, target: 'farm',   spawn: { x: 15 * T, y: 6 * T } },
  ],
  // 农场：顶→森林，右→小镇，左下木屋门→室内，西侧海湾→灯塔
  // 出口区域 3x3 格，方便玩家触发
  farm: [
    { x: 14 * T, y: 0,       w: 3 * T, h: 3 * T, target: 'forest', spawn: { x: 15 * T, y: 17 * T } },
    { x: 37 * T, y: 9 * T,   w: 3 * T, h: 3 * T, target: 'town',   spawn: { x: 13 * T, y: 18 * T } },
    { x: 5 * T,  y: 18 * T,  w: 3 * T, h: 3 * T, target: 'house',  spawn: { x: 10 * T, y: 12 * T } },
    // 西侧→灯塔岛（2026-08-10 制作人方案：灯塔地图放农场西边，右上角海角远景撤除）
    // ⚠️ locked（未来内容预埋）：当前不可进入；2026-08-11 起西侧缺口已石墙堵回（灯塔不可见），
    //    玩家被墙挡在 x≥16，走不到触发区——locked 出口仅作未来开放占位。
    //    未来链路：城市复兴 → 执灯人归来 → 灯塔重新点灯 → 移除 locked + 打通石墙开放
    //    （见 docs/design/灯塔未来内容预埋方案-v1.0.md）
    { x: 36,     y: 10 * T,  w: 28,    h: 48, target: 'lighthouse', spawn: { x: 48, y: 11 * T }, locked: true },
  ],
  // 森林：底→农场，右→矿洞
  // 注意：返回农场的出生点 y 必须 > 农场顶部出口区域下边界(48px)，否则一帧内被弹回
  forest: [
    { x: 14 * T, y: 18 * T,  w: 2 * T, h: 2 * T, target: 'farm',   spawn: { x: 15 * T, y: 6 * T } },
    { x: 28 * T, y: 9 * T,   w: 2 * T, h: 2 * T, target: 'mine',   spawn: { x: 3 * T,  y: 10 * T } },
  ],
  // 小镇：左→农场，顶→矿洞，右下→镇长家
  // 2026-08-12 Chapter1 P0-0：town 地图 30x20 → 50x35（内容平移 dx=10T dy=8T），出口随内容平移
  town: [
    { x: 10 * T, y: 17 * T,  w: 2 * T, h: 2 * T, target: 'farm',   spawn: { x: 27 * T, y: 10 * T } },
    { x: 24 * T, y: 8 * T,   w: 2 * T, h: 2 * T, target: 'mine',   spawn: { x: 15 * T, y: 17 * T } },
    { x: 28 * T, y: 20 * T,  w: 2 * T, h: 2 * T, target: 'elder_house', spawn: { x: 5 * T, y: 8 * T } },
  ],
  // 矿洞：底→小镇，左→森林
  mine: [
    { x: 14 * T, y: 18 * T,  w: 2 * T, h: 2 * T, target: 'town',   spawn: { x: 25 * T, y: 11 * T } },
    { x: 0,      y: 9 * T,   w: 2 * T, h: 2 * T, target: 'forest', spawn: { x: 27 * T, y: 10 * T } },
  ],
  // 室内：底部门→农场
  house: [
    { x: 9 * T,  y: 14 * T,  w: 2 * T, h: 1 * T, target: 'farm',   spawn: { x: 7 * T,  y: 10 * T } },
  ],
  // 镇长家：底部门→小镇
  elder_house: [
    { x: 5 * T,  y: 9 * T,   w: 2 * T, h: 1 * T, target: 'town',   spawn: { x: 28 * T, y: 19 * T } },
  ],
  // 灯塔：西侧入口通道（2026-08-10 制作人方案：灯塔岛在 farm 西边）
  // 玩家从 farm 西侧海湾 → lighthouse 左侧通道 → 塔前；出口回 farm 海湾缺口内侧
  // 出生点 (48,176) 在出口触发区 (x 0-16) 右侧；回 farm 出生点 (80,224) 避开 farm 触发区
  lighthouse: [
    { x: 0,      y: 9 * T,   w: 1 * T, h: 5 * T, target: 'farm',   spawn: { x: 5 * T, y: 14 * T } },
  ],
};

/** 场景 key → 中文名称（HUD 显示用） */
export const MAP_NAMES: Record<string, string> = {
  farm: '农场',
  town: '青禾镇',
  forest: '后山',
  mine: '矿洞',
  house: '家中',
  elder_house: '镇长家',
  lighthouse: '灯塔',
};
