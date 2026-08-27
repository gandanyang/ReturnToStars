/**
 * WeatherDirector — 天气系统视觉效果控制器（P3）
 *
 * 从 MapScene 抽离的天气视觉效果管理模块。
 *
 * 架构定位：
 *   - 只负责天气视觉效果（雨覆盖层、雨粒子）
 *   - 不拥有天气数据（WeatherSystem 负责数据查询）
 *   - 通过 onRainStart 回调通知 MapScene 做跨域联动（采集点同步等）
 *
 * 提供能力：
 *   1. setupIfRaining(isRaining) — 初始化时根据当前天气启动雨效果
 *   2. updateWeatherState(isRaining) — 每小时天气变化检查
 *   3. startRain() — 创建雨覆盖层 + 粒子 + AmbienceSystem 叠加
 *   4. stopRain() — 销毁雨覆盖层 + 粒子 + AmbienceSystem 停止
 *   5. cleanup() — 场景销毁时清理
 */

import * as AmbienceSystem from '../systems/AmbienceSystem';

export class WeatherDirector {
  private scene: Phaser.Scene;
  private rainMaps: readonly string[];
  private onRainStart: (() => void) | null = null;

  private rainActive = false;
  private rainOverlay: Phaser.GameObjects.Rectangle | null = null;
  private rainEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor(scene: Phaser.Scene, rainMaps: readonly string[]) {
    this.scene = scene;
    this.rainMaps = rainMaps;
  }

  /** 当前是否正在下雨 */
  public get isRaining(): boolean { return this.rainActive; }

  /** 设置雨天开始回调（用于 syncWeatherGatherPoints 等跨域联动） */
  public setOnRainStart(cb: () => void): void {
    this.onRainStart = cb;
  }

  /**
   * 初始化：根据当前天气判断是否需要启动雨效果
   */
  public setupIfRaining(isRaining: boolean): void {
    if (isRaining) this.startRain();
  }

  /**
   * 每小时天气状态检查
   */
  public updateWeatherState(isRaining: boolean): void {
    if (isRaining && !this.rainActive) {
      this.startRain();
    } else if (!isRaining && this.rainActive) {
      this.stopRain();
    }
  }

  /**
   * 开始下雨效果：半透明覆盖层 + 雨粒子
   * 仅室外地图下雨（矿洞/屋内/车站有顶不下雨）
   */
  public startRain(): void {
    if (!this.rainMaps.includes(this.scene.scene.key)) return;
    if (this.rainActive) return;
    this.rainActive = true;

    const camW = this.scene.cameras.main.width;
    const camH = this.scene.cameras.main.height;
    const map = this.scene.make.tilemap({ key: this.scene.scene.key });

    // 雨天覆盖层：半透明蓝色矩形，覆盖整个屏幕
    const overlay = this.scene.add.rectangle(
      camW / 2, camH / 2,
      camW, camH,
      0x334466, 0.2
    );
    overlay.setDepth(100);
    overlay.setScrollFactor(0);
    this.rainOverlay = overlay;

    // 创建白色像素纹理用于雨粒子（如果不存在）
    if (!this.scene.textures.exists('__WHITE')) {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 8;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 2, 8);
      this.scene.textures.addCanvas('__WHITE', canvas);
    }

    // 雨粒子：从天空飘落的白色短线条
    const particles = this.scene.add.particles(0, 0, '__WHITE', {
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

    // 雨天环境音：交给 AmbienceSystem 统一叠加
    AmbienceSystem.setRain(true);

    // 触发跨域回调
    this.onRainStart?.();
  }

  /**
   * 停止雨天效果
   */
  public stopRain(): void {
    if (!this.rainActive) return;
    this.rainActive = false;

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
   * 场景销毁时清理所有资源
   */
  public cleanup(): void {
    if (this.rainActive) {
      this.stopRain();
    }
    this.onRainStart = null;
  }
}
