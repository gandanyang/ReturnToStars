/**
 * FishingController — 钓鱼视觉控制器（P5a + P5b + P5c）
 *
 * 从 MapScene 抽离的钓鱼相关视觉/DOM/状态机方法集合。
 * 采用"物理搬迁 + 委托模式"：实现代码原封不动搬迁，外部依赖通过 Hooks 接口注入。
 *
 * 架构定位：
 *   - P5a：纯视觉装饰（Graphics / Container / Tween 创建）
 *   - P5b：DOM 提示管理（show/hide HTMLDivElement）
 *   - P5c：状态机核心（状态转移 + 视觉反馈 + 定时器）
 *   - 不持有：Inventory / Save / StoryDialogue / mapKey / 时间系统（通过 Hooks 注入）
 *
 * 状态机（P5c）：
 *   idle → casting → waiting → fakeBite(30%)/realBite(70%) → success/fail → idle
 *
 * 外部依赖注入：
 *   通过 FishingHooks 接口，MapScene 实现后在构造时传入。
 *   包含：时间读取、场景信息、输入清理、音效、背包、对话、鱼苗流程委托。
 *
 * 后续批次（P5d）：
 *   - NPC 交换 + 放生剧情（presentFryReleaseChoice / releaseCurrentFish / keepCurrentFry）
 *   - 老姜交互（tryLaoJiangInteract / checkLaoJiangInteract）
 */

import type { ItemType } from '../data/Inventory';
import type { SfxName } from '../systems/AudioSystem';

const TILE_SIZE = 32;

// ═══════════════════════════════════════════════════════════════
// P5c: 类型定义
// ═══════════════════════════════════════════════════════════════

/** 钓鱼状态机状态 */
export type FishingState = 'idle' | 'casting' | 'waiting' | 'fakeBite' | 'realBite' | 'success' | 'fail';

/** 鱼种配置（对齐 MapScene.FISH_KINDS） */
export interface FishKindConfig {
  name: string;
  fakeBiteProbability: number;
  biteDelayMin: number;
  biteDelayMax: number;
}

/** 钓鱼配置（对齐 MapScene.FISHING_CONFIG） */
export interface FishingConfig {
  biteDelayMin: number;
  biteDelayMax: number;
  fakeBiteProbability: number;
  realBiteWindow: number;
  successFeedbackDuration: number;
  castDuration: number;
  fakeBiteDuration: number;
  fakeBiteRecoverDuration: number;
  failFeedbackDuration: number;
  interactRange: number;
  fryChance: number;
}

/** 钓点数据（对齐 MapScene.FISHING_SPOTS） */
export interface FishingSpotData {
  pos: { x: number; y: number };
  floatPos: { x: number; y: number };
  tier: 'common' | 'rare';
}

/** 外部依赖回调接口（MapScene 实现） */
export interface FishingHooks {
  // 时间
  getTimeHour(): number;
  getTimeDay(): number;
  // 场景
  getMapKey(): string;
  // 输入
  clearAction(): void;
  // 音效
  playSfx(name: SfxName): void;
  // 背包操作
  addItem(id: ItemType, count: number): void;
  setItemCount(id: ItemType, count: number): void;
  getItemCount(id: ItemType): number;
  // 对话
  showDialogueText(text: string): void;
  playDialogue(lines: Array<{ speaker: string; color: string; text: string; options?: string[] }>, onComplete: () => void, onChoice?: (index: number) => void): void;
  // HUD
  updateHUD(): void;
  // 存档
  save(playerX: number, playerY: number, scene: string, facing: number): void;
  // 玩家位置
  getPlayerPos(): { x: number; y: number; facing: any };
  // 鱼苗放生日期
  getFishReleaseDay(): number;
  setFishReleaseDay(day: number): void;
  // 鱼苗彩蛋（放生 2 天后鱼影出现）
  isFishShadowsActive(): boolean;
  // 鱼苗事件处理（P5d 实现）
  presentFryReleaseChoice(): void;
  releaseCurrentFish(): void;
  keepCurrentFry(): void;
  // 钓鱼自然结束（success/fail → idle）：MapScene 用于恢复水面标识
  onFishingEnded(): void;
}

/** 鱼种视觉配色（onFishingSuccess 鱼跳出水使用） */
const FISH_BODY: Record<string, { body: number; stripe?: number }> = {
  qinghe_crucian: { body: 0xc8c8d0 },
  river_shrimp: { body: 0xe08a50 },
  dusk_fish: { body: 0xf0a030 },
  moon_bass: { body: 0xd8e8f0, stripe: 0x88c8e8 },
  river_eel: { body: 0x4a5a3a },
  common_carp: { body: 0xe0a030, stripe: 0xc87820 },
  big_blue_fish: { body: 0x4a6a8a },
  qinghe_fry: { body: 0xbfe0e0 },
};

export class FishingController {
  private scene: Phaser.Scene;

  // ═══════════════ P5c 状态变量 ═══════════════
  /** 当前钓鱼状态 */
  private state: FishingState = 'idle';
  /** 本次钓到的鱼种（pickCurrentFish 设定） */
  private currentFish: string = 'qinghe_crucian';
  /** 钓鱼视觉容器（浮漂+鱼线+水花+鱼跳出） */
  private fishingVisuals: Phaser.GameObjects.Container | null = null;

  // ═══════════════ P5b DOM 变量 ═══════════════
  /** 钓鱼靠近提示（DOM） */
  private fishingInteractHint: HTMLDivElement | null = null;
  /** 钓鱼中收竿窗口提示（DOM） */
  private fishingReelHint: HTMLDivElement | null = null;
  /** 老姜靠近提示（DOM） */
  private laoJiangHint: HTMLDivElement | null = null;

  // ═══════════════ P5c 配置 + 钩子 ═══════════════
  private config: FishingConfig;
  private fishKinds: Record<string, FishKindConfig>;
  private spots: Record<string, FishingSpotData>;
  private hooks: FishingHooks;
  private isMobile: boolean;

  // ═══════════════ 实机试玩埋点（会话级，不入档；window.debug.fishingStats 读取） ═══════════════
  /** 甩竿次数 */
  private statCasts = 0;
  /** 成功收获次数 */
  private statSuccesses = 0;
  /** 过早收竿失败次数 */
  private statFailsEarly = 0;
  /** 咬钩窗口超时失败次数 */
  private statFailsTimeout = 0;
  /** 主动取消次数 */
  private statCancels = 0;
  /** 最近一次咬钩→收竿反应时长 ms（成功口径） */
  private statReactionMsLast = 0;
  /** 反应时长累计/计数（求平均） */
  private statReactionMsSum = 0;
  private statReactionCount = 0;
  /** 进入 realBite 的时间戳（算反应时长用） */
  private realBiteAt = 0;

  constructor(
    scene: Phaser.Scene,
    config: FishingConfig,
    fishKinds: Record<string, FishKindConfig>,
    spots: Record<string, FishingSpotData>,
    hooks: FishingHooks,
    isMobile: boolean,
  ) {
    this.scene = scene;
    this.config = config;
    this.fishKinds = fishKinds;
    this.spots = spots;
    this.hooks = hooks;
    this.isMobile = isMobile;
  }

  // ═══════════════════════════════════════════════════════════════
  // P5c: 状态机公开接口
  // ═══════════════════════════════════════════════════════════════

  /** 获取当前钓鱼状态（供 MapScene 门控使用） */
  public getState(): FishingState {
    return this.state;
  }

  /** 获取当前选中的鱼种（供 MapScene 使用） */
  public getCurrentFish(): string {
    return this.currentFish;
  }

  /**
   * 实机试玩会话统计（不入档，window.debug.fishingStats 读取）。
   * 服务于手感验收 4 问的客观数据面：连钓节奏（casts vs successes）、
   * 失败构成（过早/超时）、取消率、咬钩反应时长（判断 0.8s 窗口松紧）。
   */
  public getStats(): {
    casts: number; successes: number; failsEarly: number; failsTimeout: number;
    cancels: number; reactionMsLast: number; reactionMsAvg: number; state: FishingState;
  } {
    return {
      casts: this.statCasts,
      successes: this.statSuccesses,
      failsEarly: this.statFailsEarly,
      failsTimeout: this.statFailsTimeout,
      cancels: this.statCancels,
      reactionMsLast: this.statReactionMsLast,
      reactionMsAvg: this.statReactionCount > 0 ? Math.round(this.statReactionMsSum / this.statReactionCount) : 0,
      state: this.state,
    };
  }

  /**
   * 启动钓鱼：idle → casting
   * 原 MapScene.startFishing() 物理搬迁
   * 时序锁定：state→hideHint→pickFish→视觉隐藏→音效→视觉创建→delayedCall
   */
  public startFishing(): void {
    this.state = 'casting';
    this.statCasts++;
    this.hideFishingInteractHint();
    this.pickCurrentFish();
    // 通知 MapScene 隐藏钓点常驻水面标识（通过外部接口或事件）
    // 为保持 P5c 零配置，钓点水面标识隐藏由 MapScene 在外部完成
    this.hooks.playSfx('fish_cast');

    // 创建钓鱼视觉容器（浮漂 + 鱼线）
    const spot = this.spots[this.hooks.getMapKey()];
    if (!spot) {
      // 防死态：无钓点数据立即回 idle，不留无退出路径的 casting
      this.state = 'idle';
      return;
    }
    const container = this.scene.add.container(spot.floatPos.x, spot.floatPos.y).setDepth(5);
    // 浮漂（红白色小圆点）
    const float = this.scene.add.ellipse(0, 0, 6, 6, 0xffffff, 1);
    const floatTop = this.scene.add.ellipse(0, -3, 4, 3, 0xd03020, 1);
    // 浮漂轻微上下浮动
    this.scene.tweens.add({
      targets: float,
      y: { from: 0, to: -1 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    container.add([float, floatTop]);

    // 鱼线（从钓点到浮漂的细线）
    const line = this.scene.add.graphics();
    line.lineStyle(1, 0xffffff, 0.3);
    line.lineBetween(
      spot.pos.x - spot.floatPos.x,
      spot.pos.y - spot.floatPos.y,
      0, 0,
    );
    container.add(line);

    // 水面波纹（浮漂周围，钓鱼中常驻）
    const ripple = this.scene.add.ellipse(0, 0, 14, 5, 0x88c8e0, 0.15);
    this.scene.tweens.add({
      targets: ripple,
      scaleX: { from: 0.8, to: 1.4 },
      scaleY: { from: 0.5, to: 0.8 },
      alpha: { from: 0.15, to: 0.02 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });
    container.add(ripple);

    this.fishingVisuals = container;

    // 0.8s 后进入等待
    this.scene.time.delayedCall(this.config.castDuration * 1000, () => {
      if (this.state === 'casting') this.enterWaiting();
    });
  }

  /**
   * 钓鱼交互（tryFishingInteract 委托）。
   * idle→启动；realBite→收竿成功；fakeBite→过早失败；
   * casting/waiting→主动取消；success/fail 过渡期忽略。
   * @returns 是否消耗了交互输入
   */
  public tryFishingInteract(): boolean {
    if (this.state === 'idle') return false;

    // 非 idle 状态下的收竿判定
    if (this.state === 'realBite') {
      this.hooks.clearAction();
      this.onFishingSuccess();
      return true;
    }
    if (this.state === 'fakeBite') {
      this.hooks.clearAction();
      this.onFishingFail('early');
      return true;
    }
    // casting / waiting：主动取消（BUG-FIX：此前被忽略，玩家误触钓鱼只能干等 2~5s
    // 咬钩流程走完；enterWaiting 的 delayedCall 自带 state!=='waiting' 守卫，取消安全）
    if (this.state === 'casting' || this.state === 'waiting') {
      this.hooks.clearAction();
      this.statCancels++;
      this.forceCancelFishing();
      return true;
    }
    // success / fail 过渡期按 E 忽略（各自 delayedCall 很快回 idle）
    return false;
  }

  /**
   * 结束钓鱼循环（场景切换时强制清理）。
   * 原 cleanupFishing() + endFishing() 合并入口。
   */
  public forceCancelFishing(): void {
    this.state = 'idle';
    if (this.fishingVisuals) {
      this.fishingVisuals.destroy();
      this.fishingVisuals = null;
    }
    this.cleanupAllHints();
    // 恢复钓点水面标识
    this.hooks.onFishingEnded();
  }

  /**
   * P5c 内部：钓点水面标识可见性控制（startFishing 调用）。
   * MapScene 外部持有 fishingSpotWaterMark 引用，通过此方法控制。
   * 为保持 P5c 独立性，返回"应该隐藏"信号，由 MapScene 执行。
   */
  /** 钓点水面标识隐藏判定（startFishing 由 MapScene 外部执行） */
  public shouldHideWaterMark(): boolean {
    return this.state === 'casting' || this.state === 'waiting' ||
      this.state === 'fakeBite' || this.state === 'realBite';
  }

  /**
   * P5c 内部：钓点水面标识应恢复可见（endFishing 调用后）。
   */
  public shouldShowWaterMark(): boolean {
    return this.state === 'idle';
  }

  // ═══════════════════════════════════════════════════════════════
  // P5c: 状态机内部方法
  // ═══════════════════════════════════════════════════════════════

  /**
   * 挑选本次鱼种（时段+概率）。
   * 原 MapScene.pickCurrentFish() 物理搬迁
   */
  private pickCurrentFish(): void {
    const spot = this.spots[this.hooks.getMapKey()];
    const h = this.hooks.getTimeHour();
    if (!spot) return;

    if (spot.tier === 'rare') {
      const r = Math.random();
      if (r < 0.65) {
        this.currentFish = 'moon_bass';
      } else if (h >= 8 && h < 17 && r < 0.90) {
        this.currentFish = 'river_shrimp';
      } else {
        this.currentFish = 'qinghe_crucian';
      }
      return;
    }
    // 生态分层 v1.3：普通钓点 15% 小鱼苗特殊事件
    if (Math.random() < this.config.fryChance) {
      this.currentFish = 'qinghe_fry';
      return;
    }
    const r = Math.random();
    if (r < 0.08) {
      this.currentFish = 'common_carp';
      return;
    }
    if (h >= 19 && h < 23) {
      this.currentFish = r < 0.55 ? 'river_eel' : 'qinghe_crucian';
      return;
    }
    if (h >= 17 && h < 19) {
      if (r < 0.35) this.currentFish = 'big_blue_fish';
      else if (r < 0.50) this.currentFish = 'dusk_fish';
      else if (r < 0.65) this.currentFish = 'river_shrimp';
      else this.currentFish = 'qinghe_crucian';
      return;
    }
    if (h >= 17 && h < 20 && r < 0.15) {
      this.currentFish = 'dusk_fish';
    } else if (h >= 8 && h < 17 && r < 0.30) {
      this.currentFish = 'river_shrimp';
    } else {
      this.currentFish = 'qinghe_crucian';
    }
  }

  /**
   * 进入等待状态：随机 2~5s 后决定 fakeBite(30%) 或 realBite(70%)
   * 原 MapScene.enterWaiting() 物理搬迁
   */
  private enterWaiting(): void {
    this.state = 'waiting';
    const kind = this.fishKinds[this.currentFish];
    const delayMs = (kind.biteDelayMin + Math.random() * (kind.biteDelayMax - kind.biteDelayMin)) * 1000;
    this.scene.time.delayedCall(delayMs, () => {
      if (this.state !== 'waiting') return; // 状态已被打断（切场景等）
      if (Math.random() < kind.fakeBiteProbability) {
        this.enterFakeBite();
      } else {
        this.enterRealBite();
      }
    });
  }

  /**
   * 试探假动作（行为 B）：浮漂轻下沉 0.4s → 恢复 → 真咬钩。
   * 原 MapScene.enterFakeBite() 物理搬迁
   */
  private enterFakeBite(): void {
    this.state = 'fakeBite';
    this.hooks.playSfx('fish_fake_bite');
    // 浮漂轻下沉（动画）
    const float = this.fishingVisuals?.getAt(0) as Phaser.GameObjects.Ellipse | null;
    if (float) {
      this.scene.tweens.add({
        targets: float,
        y: 4,
        duration: this.config.fakeBiteDuration * 1000,
        ease: 'Sine.easeIn',
      });
    }
    // 下沉 + 恢复 → 转真咬钩
    this.scene.time.delayedCall(
      (this.config.fakeBiteDuration + this.config.fakeBiteRecoverDuration) * 1000,
      () => {
        if (this.state !== 'fakeBite') return;
        // 浮漂恢复原位
        if (float) {
          this.scene.tweens.add({
            targets: float,
            y: 0,
            duration: this.config.fakeBiteRecoverDuration * 1000,
            ease: 'Sine.easeOut',
          });
        }
        this.enterRealBite();
      },
    );
  }

  /**
   * 真咬钩：浮漂明显下沉 + 显示收竿提示 + 0.8s 收竿窗口。
   * 原 MapScene.enterRealBite() 物理搬迁
   */
  private enterRealBite(): void {
    this.state = 'realBite';
    this.realBiteAt = Date.now();
    this.hooks.playSfx('fish_real_bite');
    // 浮漂明显下沉
    const float = this.fishingVisuals?.getAt(0) as Phaser.GameObjects.Ellipse | null;
    if (float) {
      this.scene.tweens.add({
        targets: float,
        y: 8,
        duration: 200,
        ease: 'Sine.easeIn',
      });
    }
    // 显示收竿提示
    this.showFishingReelHint(this.isMobile);
    // 收竿窗口超时 = 失败
    this.scene.time.delayedCall(this.config.realBiteWindow * 1000, () => {
      if (this.state === 'realBite') {
        this.onFishingFail('timeout');
      }
    });
  }

  /**
   * 钓鱼成功：Inventory + 视觉反馈 → idle。
   * 原 MapScene.onFishingSuccess() 物理搬迁
   * 鱼苗分流：非鱼苗→addItem+对话；鱼苗→presentFryReleaseChoice 直接处理
   */
  private onFishingSuccess(): void {
    this.state = 'success';
    // 试玩埋点：反应时长（咬钩→收竿）
    if (this.realBiteAt > 0) {
      this.statReactionMsLast = Date.now() - this.realBiteAt;
      this.statReactionMsSum += this.statReactionMsLast;
      this.statReactionCount++;
      this.realBiteAt = 0;
    }
    this.statSuccesses++;
    this.hideFishingReelHint();
    this.hooks.playSfx('fish_success');

    const isFry = this.currentFish === 'qinghe_fry';
    if (!isFry) {
      this.hooks.addItem(this.currentFish as ItemType, 1);
    }

    // 视觉反馈：浮漂快速下沉 + 水花扩散 + 鱼跳出
    const container = this.fishingVisuals;
    if (container) {
      const float = container.getAt(0) as Phaser.GameObjects.Ellipse | null;
      if (float) {
        this.scene.tweens.add({
          targets: float,
          y: 14,
          duration: 150,
          ease: 'Sine.easeIn',
        });
      }
      // 水花扩散（两个圆环先后扩散消失）
      const splash1 = this.scene.add.ellipse(0, 0, 10, 4, 0xa8d8e8, 0.7);
      container.add(splash1);
      this.scene.tweens.add({
        targets: splash1,
        scaleX: 3, scaleY: 2,
        alpha: 0,
        duration: 400,
        ease: 'Sine.easeOut',
      });
      const splash2 = this.scene.add.ellipse(0, 0, 8, 3, 0x88c8e0, 0.5);
      container.add(splash2);
      this.scene.tweens.add({
        targets: splash2,
        scaleX: 4, scaleY: 2.5,
        alpha: 0,
        duration: 500,
        delay: 100,
        ease: 'Sine.easeOut',
      });
      // 鱼跳出水面
      const fc = FISH_BODY[this.currentFish] ?? { body: 0xc0c0c0 };
      const fish = this.scene.add.graphics();
      fish.fillStyle(fc.body, 1);
      fish.fillEllipse(0, 0, 9, 4);
      fish.fillTriangle(-5, -1, -8, 0, -5, 1);
      fish.fillStyle(0x202020, 0.9);
      fish.fillCircle(3.5, -0.5, 0.7);
      if (fc.stripe) {
        fish.fillStyle(fc.stripe, 0.7);
        fish.fillRect(-3, -1.5, 1.5, 3);
      }
      container.add(fish);
      this.scene.tweens.add({
        targets: fish,
        y: -20,
        duration: 300,
        yoyo: true,
        ease: 'Sine.easeOut',
        onComplete: () => {
          fish.destroy();
        },
      });
    }

    if (isFry) {
      // 小鱼苗：延迟 320ms 后直接调用 presentFryReleaseChoice
      this.scene.time.delayedCall(320, () => {
        if (this.state !== 'success') return;
        this.presentFryReleaseChoice();
      });
    } else {
      // 普通鱼：显示获得提示
      const kind = this.fishKinds[this.currentFish];
      if (kind) {
        this.hooks.showDialogueText(`钓到一条${kind.name}。`);
      }
    }

    // successFeedbackDuration 后回到 idle
    this.scene.time.delayedCall(this.config.successFeedbackDuration * 1000, () => {
      this.endFishing();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // P5d: 鱼苗事件处理
  // ═══════════════════════════════════════════════════════════════

  /**
   * 鱼苗选择对话框：放回河里 / 带回去
   * 原 MapScene.presentFryReleaseChoice() 物理搬迁
   */
  private presentFryReleaseChoice(): void {
    this.hooks.presentFryReleaseChoice();
    // MapScene 需要实现此方法，内部调用 playDialogue 并处理选择
  }

  /**
   * 放生当前鱼
   * 原 MapScene.releaseCurrentFish() 物理搬迁
   * 公开方法供 hooks 回调
   */
  public releaseCurrentFish(): void {
    const fishId = this.currentFish as ItemType;
    const kind = this.fishKinds[this.currentFish];
    
    // 减少背包数量
    this.hooks.setItemCount(fishId, Math.max(0, this.hooks.getItemCount(fishId) - 1));
    
    // 首次放生记天
    if (this.hooks.getFishReleaseDay() < 0) {
      this.hooks.setFishReleaseDay(this.hooks.getTimeDay());
    }
    
    // 存档
    const pos = this.hooks.getPlayerPos();
    this.hooks.save(pos.x, pos.y, this.hooks.getMapKey(), pos.facing);
    
    // 放生水花动画
    if (this.fishingVisuals) {
      const ripple = this.scene.add.ellipse(0, 0, 10, 4, 0xa8d8e8, 0.5);
      this.fishingVisuals.add(ripple);
      this.scene.tweens.add({
        targets: ripple,
        scaleX: 3, scaleY: 2,
        alpha: 0,
        duration: 500,
        ease: 'Sine.easeOut',
      });
    }
    
    // 显示放生对话
    if (kind) {
      this.hooks.showDialogueText(`（你把${kind.name}放回河里。它摆了一下尾巴，游走了。）`);
    }
  }

  /**
   * 带回去（鱼苗进背包）
   * 原 MapScene.keepCurrentFry() 物理搬迁
   * 公开方法供 hooks 回调
   */
  public keepCurrentFry(): void {
    this.hooks.addItem('qinghe_fry', 1);
    
    // 存档
    const pos = this.hooks.getPlayerPos();
    this.hooks.save(pos.x, pos.y, this.hooks.getMapKey(), pos.facing);
    
    // 显示对话
    this.hooks.showDialogueText('（你小心地把小鱼苗放进水罐。它的尾巴轻轻晃了晃。）');
  }

  /**
   * 放生彩蛋判定：已放生且满 2 天
   * 公开方法供 MapScene 调用
   */
  public isFishShadowsActive(): boolean {
    return this.hooks.getFishReleaseDay() >= 0 && 
           this.hooks.getTimeDay() - this.hooks.getFishReleaseDay() >= 2;
  }

  /**
   * 钓鱼失败：reason='early'/'timeout' → idle。
   * 原 MapScene.onFishingFail() 物理搬迁
   */
  private onFishingFail(reason: 'early' | 'timeout'): void {
    this.state = 'fail';
    if (reason === 'early') this.statFailsEarly++; else this.statFailsTimeout++;
    this.hideFishingReelHint();

    // 失败反馈：视觉差异化
    const container = this.fishingVisuals;
    if (container) {
      const float = container.getAt(0) as Phaser.GameObjects.Ellipse | null;
      if (float) {
        if (reason === 'early') {
          this.scene.tweens.add({
            targets: float,
            y: -3,
            duration: 80,
            yoyo: true,
            repeat: 1,
            ease: 'Sine.easeOut',
            onComplete: () => { float.y = 0; },
          });
        } else {
          this.scene.tweens.add({
            targets: float,
            y: 0,
            duration: 200,
            ease: 'Sine.easeOut',
          });
        }
      }
      const splash = this.scene.add.ellipse(0, 0, 6, 2, 0x88c8e0, 0.4);
      container.add(splash);
      this.scene.tweens.add({
        targets: splash,
        scaleX: 2, scaleY: 1.5,
        alpha: 0,
        duration: 300,
        ease: 'Sine.easeOut',
      });
    }

    // failFeedbackDuration 后回到 idle
    this.scene.time.delayedCall(this.config.failFeedbackDuration * 1000, () => {
      this.endFishing();
    });
  }

  /**
   * 结束钓鱼循环：清理视觉 + 复位状态机。
   * 原 MapScene.endFishing() 物理搬迁
   */
  private endFishing(): void {
    if (this.fishingVisuals) {
      const v = this.fishingVisuals;
      this.scene.tweens.add({
        targets: v,
        alpha: 0,
        duration: 200,
        onComplete: () => v.destroy(),
      });
      this.fishingVisuals = null;
    }
    this.state = 'idle';
    // 通知 MapScene 恢复钓点水面标识等
    this.hooks.onFishingEnded();
  }

  // ═══════════════════════════════════════════════════════════════
  // P5a: 纯视觉方法（物理搬迁自 MapScene）
  // ═══════════════════════════════════════════════════════════════

  public createFishingSpotVisual(
    spotPos: { x: number; y: number },
    floatPos: { x: number; y: number },
    hideWaterMark: boolean,
  ): { waterMark: Phaser.GameObjects.Container | null } {
    // ═══════════ 钓点视觉（2026-08-14 美术增强：水岸一体）═══════════
    const bank = this.scene.add.container(spotPos.x, spotPos.y).setDepth(4);
    const marker = this.scene.add.graphics();
    marker.fillStyle(0x5b4226, 1); marker.fillRect(-8, -13, 4, 15);
    marker.fillStyle(0x6e4a2c, 1); marker.fillRect(-7, -13, 3, 2);
    marker.fillStyle(0x3a2a18, 0.55); marker.fillRect(-7, 0, 3, 3);
    marker.fillStyle(0x8a6a45, 1); marker.fillRect(-2, -15, 2, 12);
    marker.fillStyle(0xa8825a, 1); marker.fillRect(0, -16, 2, 2);
    marker.lineStyle(1, 0xe8e8e8, 0.55); marker.lineBetween(1, -16, 9, -7);
    marker.fillStyle(0xc8c8c8, 0.95); marker.fillTriangle(8, -6, 6, -8, 10, -8);
    bank.add(marker);
    const bankGrass = this.scene.add.graphics();
    bankGrass.fillStyle(0x5a8a4a, 1); bankGrass.fillRect(-13, 3, 2, 5);
    bankGrass.fillRect(-15, 2, 2, 4); bankGrass.fillRect(-10, 4, 2, 4);
    bankGrass.fillStyle(0x6a9a56, 0.8); bankGrass.fillRect(-14, 3, 1, 3);
    bank.add(bankGrass);

    let waterMark: Phaser.GameObjects.Container | null = null;
    if (!hideWaterMark) {
      const water = this.scene.add.container(floatPos.x, floatPos.y).setDepth(5);
      const bob = this.scene.add.container(0, 0);
      bob.add(this.scene.add.ellipse(0, 0, 6, 6, 0xffffff, 1));
      bob.add(this.scene.add.ellipse(0, -3, 4, 3, 0xd03020, 1));
      water.add(bob);
      this.scene.tweens.add({
        targets: bob, y: { from: -1, to: 1 }, duration: 1100,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      const ripple = this.scene.add.ellipse(0, 1, 12, 4, 0x88c8e0, 0.16);
      water.add(ripple);
      this.scene.tweens.add({
        targets: ripple,
        scaleX: { from: 0.8, to: 1.4 }, scaleY: { from: 0.7, to: 1.1 },
        alpha: { from: 0.16, to: 0.02 },
        duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeOut',
      });
      const pulse = this.scene.add.ellipse(0, 0, 8, 3, 0xa8d8e8, 0.35);
      pulse.setVisible(false);
      water.add(pulse);
      this.scene.time.addEvent({
        delay: 2600, loop: true, callback: () => {
          pulse.setVisible(true).setAlpha(0.35).setScale(0.6, 0.6);
          this.scene.tweens.add({
            targets: pulse, scaleX: 3, scaleY: 2.2, alpha: 0,
            duration: 1200, ease: 'Sine.easeOut', onComplete: () => pulse.setVisible(false),
          });
        },
      });
      const glints = this.scene.add.graphics();
      glints.fillStyle(0xfff4d8, 0.8);
      glints.fillRect(-7, -5, 1, 1); glints.fillRect(6, 5, 1, 1);
      glints.fillRect(3, -8, 1, 1); glints.fillRect(-4, 7, 1, 1);
      water.add(glints);
      this.scene.tweens.add({
        targets: glints, alpha: { from: 0.12, to: 0.85 },
        duration: 900, yoyo: true, repeat: -1, delay: 400,
      });
      waterMark = water;
    }

    return { waterMark };
  }

  public createReleasedFishShadows(
    spots: Array<{ x: number; y: number; speed: number; phase: number }>,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0).setDepth(4);
    for (const s of spots) {
      const fish = this.scene.add.graphics();
      fish.fillStyle(0x2a4a5a, 0.35);
      fish.fillEllipse(0, 0, 8, 3);
      fish.fillTriangle(-4, -1, -7, 0, -4, 1);
      fish.setPosition(s.x, s.y);
      container.add(fish);
      this.scene.tweens.add({
        targets: fish,
        x: { from: s.x - 5, to: s.x + 5 },
        y: { from: s.y - 1, to: s.y + 1 },
        duration: s.speed,
        yoyo: true,
        repeat: -1,
        delay: s.phase * 800,
        ease: 'Sine.easeInOut',
      });
    }
    return container;
  }

  public createFishTable(): void {
    const T = TILE_SIZE;
    const x = 31 * T + T / 2, y = 10 * T + T / 2;
    const g = this.scene.add.graphics().setDepth(3);
    g.fillStyle(0x8a5a30, 1); g.fillRect(x - 12, y - 2, 24, 3);
    g.fillStyle(0x6e4624, 1); g.fillRect(x - 11, y - 5, 2, 3); g.fillRect(x + 9, y - 5, 2, 3);
    g.fillStyle(0xe08040, 1); g.fillRect(x - 8, y - 5, 3, 3); g.fillRect(x - 2, y - 6, 3, 3); g.fillRect(x + 4, y - 5, 3, 3);
    g.fillStyle(0x9a6a3a, 1); g.fillRect(x + 17, y - 1, 8, 2);
  }

  public createFishDoorHinge(): void {
    const T = TILE_SIZE;
    const x = 10 * T + T / 2, y = 13.5 * T;
    const g = this.scene.add.graphics().setDepth(4);
    g.fillStyle(0xc8a060, 1); g.fillCircle(x, y, 3);
    g.fillStyle(0xffe0a0, 0.45); g.fillCircle(x, y, 5);
  }

  public createAdventurerCampfire(): void {
    const T = TILE_SIZE;
    const x = 7 * T + T / 2, y = 16 * T + T / 2;
    const g = this.scene.add.graphics().setDepth(3);
    g.fillStyle(0x4a3626, 1); g.fillRect(x - 7, y + 1, 14, 3);
    g.fillStyle(0x6e4624, 1); g.fillRect(x - 4, y - 2, 2, 4); g.fillRect(x + 2, y - 2, 2, 4);
    g.fillStyle(0xe07030, 1); g.fillCircle(x, y - 3, 3);
    g.fillStyle(0xffa040, 1); g.fillCircle(x, y - 4, 2);
    g.fillStyle(0xffe080, 1); g.fillCircle(x, y - 5, 1);
    const glow = this.scene.add.ellipse(x, y - 2, 44, 30, 0xffa050, 0.18).setDepth(2);
    this.scene.tweens.add({
      targets: glow, alpha: { from: 0.10, to: 0.24 },
      duration: 800, yoyo: true, repeat: -1,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // P5b: DOM 提示管理
  // ═══════════════════════════════════════════════════════════════

  public showFishingInteractHint(isMobile: boolean): void {
    if (this.fishingInteractHint) return;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '180px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffffff', fontSize: '13px',
      background: 'rgba(0,0,0,0.65)', padding: '6px 16px', borderRadius: '6px',
      zIndex: '400', pointerEvents: 'none',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    hint.textContent = isMobile ? '点击「交互」钓鱼' : '按 [E] 钓鱼';
    hint.classList.add('hint-interact');
    document.body.appendChild(hint);
    this.fishingInteractHint = hint;
  }

  public hideFishingInteractHint(): void {
    if (this.fishingInteractHint) {
      this.fishingInteractHint.remove();
      this.fishingInteractHint = null;
    }
  }

  public showFishingReelHint(isMobile: boolean): void {
    if (this.fishingReelHint) return;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '180px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffd98a', fontSize: '15px',
      background: 'rgba(0,0,0,0.75)', padding: '8px 20px', borderRadius: '6px',
      zIndex: '401', pointerEvents: 'none',
      textShadow: '0 0 6px rgba(255,180,80,0.6)',
      fontWeight: 'bold',
    });
    hint.textContent = isMobile ? '快点击「交互」收竿！' : '快按 [E] 收竿！';
    hint.classList.add('hint-interact');
    document.body.appendChild(hint);
    this.fishingReelHint = hint;
  }

  public hideFishingReelHint(): void {
    if (this.fishingReelHint) {
      this.fishingReelHint.remove();
      this.fishingReelHint = null;
    }
  }

  public showLaoJiangHint(isMobile: boolean): void {
    if (this.laoJiangHint) return;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '180px', left: '50%',
      transform: 'translateX(-50%)', color: '#ffd98a', fontSize: '13px',
      background: 'rgba(0,0,0,0.65)', padding: '6px 16px', borderRadius: '6px',
      zIndex: '400', pointerEvents: 'none',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    });
    hint.textContent = isMobile ? '点击「交互」和老姜聊聊' : '按 [E] 和老姜聊聊';
    hint.classList.add('hint-interact');
    document.body.appendChild(hint);
    this.laoJiangHint = hint;
  }

  public hideLaoJiangHint(): void {
    if (this.laoJiangHint) {
      this.laoJiangHint.remove();
      this.laoJiangHint = null;
    }
  }

  public cleanupAllHints(): void {
    this.hideFishingInteractHint();
    this.hideFishingReelHint();
    this.hideLaoJiangHint();
  }
}
