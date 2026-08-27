/**
 * FarmController — 农场视觉/装饰 + 交互路由 + 生命周期管理
 * P6a: 纯视觉层，管理农场地块视觉、温暖氛围、环境装饰
 * P6b: 输入路由层，将玩家输入（触屏点击/键盘交互）解析为 Plot/Tile 目标
 * P6c: 生命周期操作层，执行单格操作事务（冻结操作顺序）
 *
 * 设计原则：
 *   - 不持有农场数据（状态读写通过 Hooks）
 *   - 不决定剧情逻辑（反馈内容由调用方决定）
 *   - 不持有决策逻辑（门控/状态判断/工具检查全部留在 MapScene）
 *   - 纯路由操作：输入 → 目标 → 分派
 *
 * P6c 核心红线：
 *   - 操作事务顺序不可改变：check → spendStamina → mutate → postProcess → consumeTime
 *   - spendStamina 必须在 mutate 之前（防止体力不足但土地已改变）
 *   - consumeTime 必须在 mutate 之后（防止时间推进触发中间状态）
 */

import type { CropData, CropType, TileState } from '../data/FarmState';
import { CROP_DEFS, CROP_TYPES, FARM_AREA, TILE_SIZE, isInFarmArea } from '../data/FarmState';
import { getPlotAt, type FarmPlotId } from '../data/FarmPlot';
import { isTouchDevice } from '../config';

/** 瓦片视觉数据（地块贴图 + 作物贴图） */
export interface TileVisual {
  plot: Phaser.GameObjects.Image;
  crop: Phaser.GameObjects.Image;
}

/** 农场温暖状态（MapScene 持有引用，FarmController 管理生命周期） */
export interface FarmWarmState {
  overlay: Phaser.GameObjects.Rectangle | null;
  skyGlow: Phaser.GameObjects.Graphics | null;
  particles: Phaser.GameObjects.Particles.ParticleEmitter[];
  pulsePlayed: boolean;
}

/** 外部依赖钩子接口（MapScene 实现） */
export interface FarmHooks {
  // 时间
  getTimeDay(): number;
  getTimeHour(): number;
  // 地块视觉管理
  getTileRect(col: number, row: number): TileVisual | undefined;
  setTileRect(col: number, row: number, visual: TileVisual): void;
  // 状态读写（数据层）
  getTileState(col: number, row: number): TileState;
  getCrop(col: number, row: number): CropData | undefined;
  // 触发系统
  hasTriggered(key: string): boolean;
  triggerOnce(key: string, fn: () => void): void;

  // ═══════════════════════════════════════════════════════════════
  // P6b: 输入路由钩子（决策层全部在 MapScene）
  // ═══════════════════════════════════════════════════════════════
  /** 全部门控检查（对话/面板/观星夜/transitioning 等）——MapScene 实现 */
  canProcessFarmInput(): boolean;
  /** Plot 级交互分派（MapScene 执行 interactPlot 逻辑） */
  onPlotInteract(plotId: FarmPlotId): void;
  /** Tile 级交互分派（MapScene 执行 tryFarmInteractAt 逻辑） */
  onTileInteract(col: number, row: number): void;

  // ═══════════════════════════════════════════════════════════════
  // P6c: 生命周期操作钩子（数据操作 + 事务顺序控制）
  // ═══════════════════════════════════════════════════════════════
  /** 工具/物品检查：返回指定物品数量 */
  getItemCount(itemId: string): number;
  /** 体力闸扣：消耗指定操作的体力（成功才扣，返回 false 表示体力不足） */
  consumeStamina(opType: string): boolean;
  /** 状态突变：设置地块状态（数据层操作） */
  setTileState(col: number, row: number, state: TileState): void;
  /** 作物数据突变：设置/清除作物数据 */
  setCrop(col: number, row: number, crop: CropData | undefined): void;
  /** 物品变动（+/-count） */
  addItem(itemId: string, count: number): void;
  /** 经验值增加 */
  addXp(amount: number, source: string): void;
  /** 消耗 Action Time（最后一步，在所有状态变更之后） */
  consumeMinutes(opType: string): void;
  /** 教程进度检查 */
  checkTutorialProgress(type: string): void;
  /** 调试用：同步 debugTiles Map */
  setDebugTile(col: number, row: number, state: TileState): void;
  /**
   * 操作完成回调（MapScene 实现仪式感/副作用）
   * 调用时机由 FarmController 严格控制（对应每个操作的原始顺序）
   * - till/plant/water: 在 consumeMinutes 之前调用
   * - harvest: 在 consumeMinutes 之后调用
   */
  onFarmOpComplete(opType: string, col: number, row: number, opts?: Record<string, unknown>): void;
}

export class FarmController {
  private scene: Phaser.Scene;
  private hooks: FarmHooks;

  // 温暖状态（FarmController 创建/销毁）
  private warmState: FarmWarmState = {
    overlay: null,
    skyGlow: null,
    particles: [],
    pulsePlayed: false,
  };

  constructor(scene: Phaser.Scene, hooks: FarmHooks) {
    this.scene = scene;
    this.hooks = hooks;
  }

  // ═══════════════════════════════════════════════════════════════
  // P6a: 地块视觉管理
  // ═══════════════════════════════════════════════════════════════

  /**
   * 设置农场地块视觉（场景创建时调用）
   * 为每个可耕格子创建地块贴图和作物贴图
   */
  public setupFarmTiles(): void {
    for (let r = FARM_AREA.row0; r <= FARM_AREA.row1; r++) {
      for (let c = FARM_AREA.col0; c <= FARM_AREA.col1; c++) {
        const cx = c * TILE_SIZE + TILE_SIZE / 2;
        const cy = r * TILE_SIZE + TILE_SIZE / 2;

        // 可种植土地地块贴图（16×16 五态：耕地/播种/浇水/生长/成熟）
        const plot = this.scene.add.image(cx, cy, 'farm_plot', 0);
        plot.setDepth(2);

        // 作物标记（绿色小椭圆，planted/watered/grown 时显示）
        const crop = this.scene.add.image(cx, cy, 'crops', 0);
        crop.setScale(0.5);
        crop.setDepth(3);
        crop.setVisible(false);

        const visual: TileVisual = { plot, crop };
        // 从全局状态恢复显示（场景切换回来时保留已锄/已种地块）
        this.updateTileVisual(c, r, visual);
        this.hooks.setTileRect(c, r, visual);
      }
    }
  }

  /**
   * 根据土地状态刷新单格视觉
   * empty: 全部隐藏
   * tilled: 深棕土地，无作物
   * watered: 湿润深棕土地 + 作物（若已种）
   * planted/grown: 土地 + 作物标记（grown 更大更深）
   *
   * 四阶段视觉：种子(地块帧1，作物隐藏) → 幼苗(crop帧0) → 成长(crop帧1+地块帧3) → 成熟(crop帧2)
   */
  public updateTileVisual(col: number, row: number, visual: TileVisual): void {
    const state = this.hooks.getTileState(col, row);
    if (state === 'empty') {
      visual.plot.setVisible(false);
      visual.crop.setVisible(false);
      return;
    }
    visual.plot.setVisible(true);
    if (state === 'tilled') {
      visual.plot.setFrame(0);
      visual.crop.setVisible(false);
      return;
    }
    // 四阶段视觉：0=种子 / 1=幼苗 / 2=成长 / 3=成熟
    const cropData = this.hooks.getCrop(col, row);
    const stage = this.getCropVisualStage(cropData, state);
    // 地块帧：种子=1(播种土) / 幼苗=2(湿润土) / 成长=3(更湿) / 成熟=4
    visual.plot.setFrame(
      stage >= 3 ? 4 : stage === 2 ? 3 : stage === 1 ? 2 : state === 'watered' ? 2 : 1,
    );
    // 作物帧：幼苗/成长/成熟 = cropIdx*3 + 0/1/2；种子阶段作物隐藏
    if (stage >= 1) {
      const cropType = cropData?.cropType ?? 'radish';
      const cropIdx = CROP_TYPES.indexOf(cropType);
      visual.crop.setFrame(cropIdx * 3 + (stage - 1));
      visual.crop.setVisible(true);
    } else {
      visual.crop.setVisible(false);
    }
  }

  /** 作物视觉阶段：0=种子 / 1=幼苗 / 2=成长 / 3=成熟 */
  public getCropVisualStage(crop: CropData | undefined, state: TileState): 0 | 1 | 2 | 3 {
    if (state === 'grown') return 3;
    if (!crop) return 0;
    const def = CROP_DEFS[crop.cropType];
    const days = crop.grownDays ?? Math.max(0, this.hooks.getTimeDay() - crop.plantDay - 1);
    if (days <= 0) return 0;
    // 每种作物的节奏差异由 growthDays 自然拉开
    return days >= def.growthDays - 1 ? 2 : 1;
  }

  /** 刷新指定 Plot 的所有地块视觉 */
  public refreshPlotVisual(cols: number[], rows: number[]): void {
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const row = rows[i];
      const visual = this.hooks.getTileRect(col, row);
      if (visual) {
        this.updateTileVisual(col, row, visual);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // P6a: 温暖氛围管理
  // ═══════════════════════════════════════════════════════════════

  /**
   * 设置农场温暖氛围（夕阳感 + 暖光粒子 + 首屏过渡）
   * 首屏（本次会话首次进农场）播 3 秒渐变过渡；此后按当前时辰直接应用
   */
  public setupFarmWarm(groundLayer: Phaser.Tilemaps.TilemapLayer, originX?: number, originY?: number): void {
    if (this.warmState.overlay) return; // 幂等

    // 全屏暖橙 ADD overlay
    const w = groundLayer.displayWidth;
    const h = groundLayer.displayHeight;
    const overlay = this.scene.add.rectangle(0, 0, w, h, 0xffc98a, 1)
      .setOrigin(0).setDepth(4.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.warmState.overlay = overlay;

    // 夕阳感垂直渐变天光
    const skyGlow = this.scene.add.graphics();
    skyGlow.setDepth(4.4);
    skyGlow.fillGradientStyle(0xffa050, 0xffa050, 0xffa050, 0xffa050, 0.5, 0.5, 0.02, 0.02);
    skyGlow.fillRect(0, 0, w, h);
    skyGlow.setBlendMode(Phaser.BlendModes.ADD);
    skyGlow.setAlpha(0);
    this.warmState.skyGlow = skyGlow;

    // 暖金光尘粒子
    const spots: Array<[number, number]> = [
      [8 * TILE_SIZE + 8, 8 * TILE_SIZE + 8],
      [20 * TILE_SIZE + 8, 12 * TILE_SIZE + 8],
      [30 * TILE_SIZE + 8, 8 * TILE_SIZE + 8],
    ];
    spots.forEach(([x, y]) => {
      const p = this.scene.add.particles(x, y, '__WHITE', {
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
      this.warmState.particles.push(p);
    });

    // 首屏播 3 秒渐变过渡 + 第一幕光晕
    const baseAlpha = this.farmWarmAlphaForHour(this.hooks.getTimeHour());
    if (!this.hooks.hasTriggered('farm_warm_intro')) {
      this.hooks.triggerOnce('farm_warm_intro', () => {
        this.scene.tweens.add({
          targets: overlay,
          alpha: { from: 0, to: baseAlpha },
          duration: 3000,
          ease: 'Sine.easeOut',
        });
        if (originX !== undefined && originY !== undefined) {
          this.playFarmWarmPulse(originX, originY);
        }
      });
    } else {
      overlay.setAlpha(baseAlpha);
    }
  }

  /**
   * 第一幕「事件感」：暖金光晕从交付点扩散 + overlay 短暂上冲
   */
  public playFarmWarmPulse(originX: number, originY: number): void {
    if (!this.warmState.overlay || this.warmState.pulsePlayed) return;
    this.warmState.pulsePlayed = true;

    const overlay = this.warmState.overlay;
    const ring = this.scene.add.graphics();
    ring.setDepth(4.6);
    const maxR = 300;

    this.scene.tweens.add({
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

    // 亮度脉冲
    const baseAlpha = this.farmWarmAlphaForHour(this.hooks.getTimeHour());
    this.scene.tweens.add({
      targets: overlay,
      alpha: { from: baseAlpha, to: 0.28, yoyo: true },
      duration: 2200,
      ease: 'Sine.inOut',
    });
  }

  /**
   * 更新温暖氛围（每帧调用）
   * 按时间调整 overlay/skyGlow alpha
   */
  public updateFarmWarm(): void {
    if (!this.warmState.overlay) return;
    const alpha = this.farmWarmAlphaForHour(this.hooks.getTimeHour());
    this.warmState.overlay.setAlpha(alpha);
    if (this.warmState.skyGlow) {
      this.warmState.skyGlow.setAlpha(this.farmWarmSkyAlphaForHour(this.hooks.getTimeHour()));
    }
  }

  /** 农场温暖强度（按小时）：清晨/黄昏最高，正午/夜间最低 */
  public farmWarmAlphaForHour(hour: number): number {
    // 晨暖 (6-8): 0.12-0.18
    if (hour >= 6 && hour < 8) return 0.12 + (hour - 6) * 0.03;
    // 正午 (8-14): 0.08-0.12
    if (hour >= 8 && hour < 14) return 0.12 - (hour - 8) * 0.007;
    // 黄昏 (14-18): 0.15-0.22
    if (hour >= 14 && hour < 18) return 0.15 + (hour - 14) * 0.0175;
    // 夜间 (18-6): 0.05-0.08
    return 0.06;
  }

  /** 天空光晕强度（按小时）：黄昏最高 */
  public farmWarmSkyAlphaForHour(hour: number): number {
    if (hour >= 14 && hour < 18) return 0.12 + (hour - 14) * 0.015;
    if (hour >= 6 && hour < 8) return 0.08;
    return 0.04;
  }

  /** 检查温暖氛围是否已激活 */
  public isWarmActive(): boolean {
    return this.warmState.overlay !== null;
  }

  /** 获取温暖氛围调试状态（供探针/外部验证使用） */
  public getWarmDebugState(): {
    active: boolean;
    alpha: number;
    width: number;
    height: number;
    particleCount: number;
  } {
    const ov = this.warmState.overlay;
    return {
      active: ov !== null,
      alpha: ov ? ov.alpha : -1,
      width: ov ? Math.round(ov.displayWidth) : -1,
      height: ov ? Math.round(ov.displayHeight) : -1,
      particleCount: this.warmState.particles.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // P6b: 交互路由层（输入 → 目标 → 分派，决策全部在 MapScene）
  // ═══════════════════════════════════════════════════════════════

  /**
   * 触屏点击农田交互入口
   * 仅路由：将 pointer → col/row → plotId/tile → 分派给 MapScene
   * 门控/决策/数据操作全部通过 hooks 交给 MapScene
   */
  public handleFarmTap(pointer: Phaser.Input.Pointer): void {
    // 平台过滤（非触屏设备静默忽略）
    if (!isTouchDevice()) return;
    // 门控检查（MapScene 实现，包含对话/面板/观星夜/transitioning 等）
    if (!this.hooks.canProcessFarmInput()) return;

    // 坐标转换：屏幕像素 → 世界坐标 → tile 坐标
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const col = Math.floor(world.x / TILE_SIZE);
    const row = Math.floor(world.y / TILE_SIZE);

    // 非农田区域静默忽略
    if (!isInFarmArea(col, row)) return;

    // 路由：Plot 优先 → Tile 兜底
    const plotId = getPlotAt(col, row);
    if (plotId) {
      this.hooks.onPlotInteract(plotId);
    } else {
      this.hooks.onTileInteract(col, row);
    }
  }

  /**
   * 键盘交互入口（按 Player.facing 决定面前格子）
   * 仅路由：将 playerX/Y/facing → 面前 tile → plotId/tile → 分派给 MapScene
   * 门控/决策/数据操作全部通过 hooks 交给 MapScene
   */
  public handleFarmInteract(playerX: number, playerY: number, facing: string): void {
    // 门控检查（MapScene 实现，包含对话/面板/观星夜/transitioning 等）
    const gateOk = this.hooks.canProcessFarmInput();
    if (!gateOk) return;

    // 计算玩家所面向的 tile 坐标
    const pc = Math.floor(playerX / TILE_SIZE);
    const pr = Math.floor(playerY / TILE_SIZE);
    let tc = pc;
    let tr = pr;
    switch (facing) {
      case 'up': tr = pr - 1; break;
      case 'down': tr = pr + 1; break;
      case 'left': tc = pc - 1; break;
      case 'right': tc = pc + 1; break;
    }

    // 路由：Plot 优先 → Tile 兜底
    const plotId = getPlotAt(tc, tr);
    if (plotId) {
      this.hooks.onPlotInteract(plotId);
    } else {
      this.hooks.onTileInteract(tc, tr);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // P6a: 环境氛围
  // ═══════════════════════════════════════════════════════════════

  /**
   * 农场环境氛围：水塘涟漪 + 暖色光斑
   */
  public setupFarmAmbience(): void {
    const T = TILE_SIZE;

    // 水塘涟漪：3 个错落扩散光斑
    const pond: Array<{ c: number; r: number }> = [
      { c: 31, r: 20 }, { c: 32, r: 21 }, { c: 33, r: 19 },
    ];
    pond.forEach((p, i) => {
      const ring = this.scene.add.graphics();
      ring.fillStyle(0x9fd8f5, 0.32);
      ring.fillCircle(0, 0, 4);
      ring.setPosition(p.c * T + T / 2, p.r * T + T / 2);
      ring.setDepth(2);
      this.scene.tweens.add({
        targets: ring,
        scale: { from: 0.3, to: 1.15 },
        alpha: { from: 0.55, to: 0 },
        duration: 2200,
        delay: i * 700,
        repeat: -1,
        ease: 'Quad.Out',
      });
    });

    // 暖色光斑：农田上空缓慢漂移
    const glow = this.scene.add.graphics();
    glow.fillStyle(0xffeec8, 0.13);
    glow.fillCircle(0, 0, 34);
    glow.setPosition(20 * T, 12 * T);
    glow.setDepth(2);
    this.scene.tweens.add({
      targets: glow,
      x: { from: 20 * T - 26, to: 20 * T + 26 },
      y: { from: 12 * T - 14, to: 12 * T + 14 },
      duration: 6000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════════

  /** 场景关闭时清理温暖状态 */
  public cleanup(): void {
    if (this.warmState.overlay) {
      this.warmState.overlay.destroy();
      this.warmState.overlay = null;
    }
    if (this.warmState.skyGlow) {
      this.warmState.skyGlow.destroy();
      this.warmState.skyGlow = null;
    }
    for (const p of this.warmState.particles) {
      p.destroy();
    }
    this.warmState.particles = [];
    this.warmState.pulsePlayed = false;
  }

  // ═══════════════════════════════════════════════════════════════
  // P6c: 生命周期操作层（冻结操作事务顺序）
  //
  // 核心红线：操作事务顺序不可改变
  //   till/plant/water: check → spendStamina → mutate → consumeTime → postProcess(ritual/DQ/tutorial)
  //   harvest:         check → spendStamina → mutate → consumeTime → postProcess(ritual)
  //
  // spendStamina 必须在 mutate 之前（防止体力不足但土地已改变）
  // consumeTime 必须在核心 mutation 之后（防止时间推进触发中间状态）
  // ═══════════════════════════════════════════════════════════════

  /**
   * 单格锄地：empty → tilled
   * 事务顺序：check(state+tool) → spendStamina → mutate(tile+debug) → preTime(tutorial+ritual+DQ) → consumeTime
   * 对应原 tillTileAt 顺序：check → consumeStamina → setTileState+debugTiles → checkTutorialProgress+firstHoe → consumeMinutes
   */
  public executeTill(col: number, row: number): boolean {
    // ① 前置检查
    if (this.hooks.getTileState(col, row) !== 'empty') return false;
    if (this.hooks.getItemCount('old_hoe') <= 0) return false;
    // ② 体力闸扣
    if (!this.hooks.consumeStamina('farm_till')) return false;
    // ③ 状态突变
    this.hooks.setTileState(col, row, 'tilled');
    this.hooks.setDebugTile(col, row, 'tilled');
    // ④ pre-time 回调：教程 + 仪式感（在 consumeTime 之前，对应原 checkTutorialProgress + firstHoe block）
    this.hooks.onFarmOpComplete('till', col, row);
    // ⑤ 消耗 Action Time（最后一步）
    this.hooks.consumeMinutes('farm_till');
    return true;
  }

  /**
   * 单格播种：tilled → planted
   * 事务顺序：check(state+seed) → spendStamina → mutate(item+tile+crop+debug) → preTime(xp+ritual+DQ+tutorial) → consumeTime
   * 对应原 plantTileAt 顺序：check → consumeStamina → addItem+setTileState+debugTiles+setCrop → addXp+firstPlant+onDQPlant+checkTutorialProgress → consumeMinutes
   */
  public executePlant(col: number, row: number, cropType: CropType): boolean {
    // ① 前置检查
    if (this.hooks.getTileState(col, row) !== 'tilled') return false;
    const seedItem = CROP_DEFS[cropType].seedItem as string;
    if (this.hooks.getItemCount(seedItem) <= 0) return false;
    // ② 体力闸扣
    if (!this.hooks.consumeStamina('farm_plant')) return false;
    // ③ 状态突变
    this.hooks.addItem(seedItem, -1);
    this.hooks.setTileState(col, row, 'planted');
    this.hooks.setDebugTile(col, row, 'planted');
    this.hooks.setCrop(col, row, {
      cropType,
      plantDay: this.hooks.getTimeDay(),
      watered: false,
    });
    // ④ pre-time 回调：xp + 仪式感 + DQ + 教程（对应原 addXp+firstPlant+onDQPlant+checkTutorialProgress）
    this.hooks.onFarmOpComplete('plant', col, row, { cropType });
    // ⑤ 消耗 Action Time（最后一步）
    this.hooks.consumeMinutes('farm_plant');
    return true;
  }

  /**
   * 单格浇水：planted → watered
   * 事务顺序：check(state+tool) → spendStamina → mutate(tile+crop+debug) → preTime(xp+DQ+tutorial+ritual) → consumeTime
   * 对应原 waterTileAt 顺序：check → consumeStamina → setTileState+debugTiles+setCrop → addXp+onDQWater+checkTutorialProgress+firstWater → consumeMinutes
   */
  public executeWater(col: number, row: number): boolean {
    // ① 前置检查
    if (this.hooks.getTileState(col, row) !== 'planted') return false;
    if (this.hooks.getItemCount('old_watering_can') <= 0) return false;
    // ② 体力闸扣
    if (!this.hooks.consumeStamina('farm_water')) return false;
    // ③ 状态突变
    this.hooks.setTileState(col, row, 'watered');
    this.hooks.setDebugTile(col, row, 'watered');
    const crop = this.hooks.getCrop(col, row);
    if (crop) this.hooks.setCrop(col, row, { ...crop, watered: true });
    // ④ pre-time 回调：xp + DQ + 教程 + 仪式感（对应原 addXp+onDQWater+checkTutorialProgress+firstWater）
    this.hooks.onFarmOpComplete('water', col, row);
    // ⑤ 消耗 Action Time（最后一步）
    this.hooks.consumeMinutes('farm_water');
    return true;
  }

  /**
   * 单格收获：grown → tilled，作物入包
   * 事务顺序：check(state) → spendStamina → mutate(tile+crop+item+debug) → preTime(xp+DQ+cornCheck) → consumeTime → postTime(ritual/firstHarvest)
   * 对应原 harvestTileAt 顺序：check → consumeStamina → setTileState+debugTiles+setCrop+addItem → addXp+onDQHarvest+cornCheck → consumeMinutes → firstHarvest block
   * 注意：harvest 独有 post-time 回调（仪式感在 consumeTime 之后，叙事节奏：时间先流逝，情绪再反应）
   */
  public executeHarvest(col: number, row: number): CropType | null {
    // ① 前置检查
    if (this.hooks.getTileState(col, row) !== 'grown') return null;
    // ② 体力闸扣
    if (!this.hooks.consumeStamina('farm_harvest')) return null;
    // ③ 状态突变
    const crop = this.hooks.getCrop(col, row);
    const cropType: CropType = crop?.cropType ?? 'radish';
    this.hooks.setTileState(col, row, 'tilled');
    this.hooks.setDebugTile(col, row, 'tilled');
    this.hooks.setCrop(col, row, undefined);
    this.hooks.addItem(cropType, 1);
    // ④ pre-time 回调：xp + DQ + 首次玉米检查（对应原 addXp+onDQHarvest+cornCheck，在 consumeTime 之前）
    this.hooks.onFarmOpComplete('harvest_pre_time', col, row, { cropType });
    // ⑤ 消耗 Action Time
    this.hooks.consumeMinutes('farm_harvest');
    // ⑥ post-time 回调：仪式感（对应原 firstHarvest block，在 consumeTime 之后 — harvest 独有）
    this.hooks.onFarmOpComplete('harvest', col, row, { cropType });
    return cropType;
  }
}
