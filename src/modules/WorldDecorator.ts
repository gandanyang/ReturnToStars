/**
 * WorldDecorator — 世界装饰管理器（P4）
 *
 * 从 MapScene 抽离的纯视觉装饰方法集合。
 * 采用"物理搬迁 + 委托模式"：实现代码原封不动搬迁，MapScene 仅做委托。
 *
 * 架构定位：
 *   - 只负责视觉装饰（Graphics 绘制 + Tween 动画）
 *   - 不拥有 MapScene 的游戏状态（时间/天气/剧情/交互等）
 *   - 通过 Phaser Scene 引用创建视觉对象
 *   - 条件判断（如 mapKey 检查）保留在 MapScene 调用方
 *
 * 第一批方法（3 个，零 flags 依赖）：
 *   1. decorateTownDensityClusters — 小镇草簇/花/灌木/石头
 *   2. decorateCentralPlaza — 中央广场石井/石凳/灯柱
 *   3. decorateTownSouthLife — 小镇南部树/花/草/石
 *
 * 后续批次（待实现）：
 *   - decorateTownBottomLife / decorateTownNorthFacade 等
 */

const TILE_SIZE = 32;

export class WorldDecorator {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * 小镇密度装饰簇（草簇 + 花 + 灌木 + 石头）
   * 原 MapScene.setupTownDensityClusters() 物理搬迁
   */
  public decorateTownDensityClusters(): void {
    const T = TILE_SIZE;
    const clusters: [number, number][] = [
      [12, 9], [22, 9], [28, 9], [37, 9], [43, 10], [45, 8],
      [8, 22], [9, 21], [10, 20], [16, 19], [30, 19], [28, 13],
      [43, 19], [12, 21], [18, 23], [26, 24],
    ];
    for (const [cx, cy] of clusters) {
      const x = cx * T + T / 2, y = cy * T + T / 2;
      const g = this.scene.add.graphics().setDepth(3);
      // 草簇（2-3 株，竖线）
      g.fillStyle(0x5a8a4a, 1);
      for (let i = 0; i < 3; i++) g.fillRect(x - 6 + i * 4, y - 1, 1, 5 + (i % 2) * 2);
      const kind = (cx + cy) % 4;
      if (kind === 0) {
        // 黄花
        g.fillStyle(0xe8b040, 1); g.fillRect(x + 3, y - 2, 1, 1); g.fillRect(x + 6, y - 1, 1, 1);
      } else if (kind === 1) {
        // 粉花
        g.fillStyle(0xd860a0, 1); g.fillRect(x - 8, y - 2, 1, 1); g.fillRect(x + 4, y - 3, 1, 1);
      } else if (kind === 2) {
        // 小灌木
        g.fillStyle(0x4a7a38, 1); g.fillCircle(x + 5, y, 3);
        g.fillStyle(0x639922, 0.9); g.fillCircle(x + 6, y - 1, 2);
      } else {
        // 石头
        g.fillStyle(0x9a9aa2, 1); g.fillCircle(x - 5, y, 2);
        g.fillStyle(0xb8b8c0, 0.7); g.fillCircle(x - 6, y - 1, 1);
      }
    }
  }

  /**
   * 中央广场装饰（石井 + 石凳 + 灯柱）
   * 原 MapScene.setupCentralPlaza() 物理搬迁
   * 注意：mapKey 检查已在 MapScene 调用方完成
   */
  public decorateCentralPlaza(): void {
    const T = TILE_SIZE;
    const px = (c: number, r: number): [number, number] => [c * T + T / 2, r * T + T / 2];

    // ① 西北角石井
    {
      const [x, y] = px(21, 15.5);
      const g = this.scene.add.graphics().setDepth(3);
      g.fillStyle(0x8a8a92, 1); g.fillEllipse(x, y, 20, 13);
      g.fillStyle(0x6a6a72, 1); g.fillEllipse(x, y + 1, 16, 10);
      g.fillStyle(0x26262c, 1); g.fillEllipse(x, y + 1, 10, 6);
      g.fillStyle(0xa8a8b0, 0.8); g.fillEllipse(x - 4, y - 3, 6, 3);
      g.fillStyle(0x6e4a24, 1); g.fillRect(x - 8, y - 11, 2, 12); g.fillRect(x + 6, y - 11, 2, 12);
      g.fillStyle(0x7a5a33, 1); g.fillRect(x - 8, y - 13, 16, 3);
      g.lineStyle(0.8, 0x9a8a6a, 0.9); g.lineBetween(x + 6, y - 12, x + 4, y - 2);
      g.fillStyle(0x8a6a45, 1); g.fillRect(x + 3, y - 2, 3, 2);
      g.fillStyle(0x5a8a4a, 1); g.fillRect(x - 12, y + 5, 1, 3); g.fillRect(x + 11, y + 6, 1, 2);
    }

    // ② 石凳 ×2
    for (const [cx, cy] of [[28, 20.5], [20, 20.5]] as Array<[number, number]>) {
      const [x, y] = px(cx, cy);
      const g = this.scene.add.graphics().setDepth(3);
      g.fillStyle(0x4a4a52, 1); g.fillRect(x - 7, y - 3, 14, 3);
      g.fillStyle(0x5a5a64, 1); g.fillRect(x - 7, y - 4, 14, 1);
      g.fillStyle(0x3a3a42, 1); g.fillRect(x - 6, y, 2, 3); g.fillRect(x + 4, y, 2, 3);
      g.fillStyle(0x2e2e34, 0.28); g.fillEllipse(x, y + 3, 18, 4);
    }

    // ③ 石板踩踏斑驳 + 落叶
    {
      const g = this.scene.add.graphics().setDepth(2);
      g.fillStyle(0x3a3a30, 0.08);
      g.fillEllipse(px(22, 15.8)[0], px(22, 15.8)[1], 14, 6);
      g.fillEllipse(px(27.2, 16.5)[0], px(27.2, 16.5)[1], 12, 5);
      g.fillStyle(0xd8a858, 0.8);
      g.fillRect(px(26.6, 15.4)[0], px(26.6, 15.4)[1], 2, 1);
      g.fillRect(px(29.3, 15.8)[0], px(29.3, 15.8)[1], 2, 1);
      g.fillStyle(0x8a9a3a, 0.7);
      g.fillRect(px(20.4, 16.6)[0], px(20.4, 16.6)[1], 1, 2);
    }

    // ④ 东北角灯柱
    {
      const [x, y] = px(28.5, 15.5);
      const g = this.scene.add.graphics().setDepth(3);
      g.fillStyle(0x3a3a44, 1); g.fillRect(x - 1, y - 14, 2, 15);
      g.fillStyle(0x4a4a56, 1); g.fillRect(x - 2, y - 15, 4, 2);
      g.fillStyle(0xffd98a, 1); g.fillRect(x - 2, y - 18, 4, 4);
      g.fillStyle(0x2e2e34, 0.3); g.fillEllipse(x, y + 2, 10, 3);
      // 灯柱夜晚暖光（由调用方判断时间后调用 startLampGlow）
    }
  }

  /**
   * 启动灯柱暖光动画（中央广场灯柱，夜晚显示）
   * 原 MapScene.setupCentralPlaza() 内的灯柱发光逻辑
   */
  public startLampGlow(): void {
    const T = TILE_SIZE;
    const [x, y] = [28.5 * T + T / 2, 15.5 * T + T / 2];
    const glow = this.scene.add.ellipse(x, y - 16, 46, 32, 0xffc878, 0.18).setDepth(3);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: glow, alpha: { from: 0.10, to: 0.24 }, duration: 1600, yoyo: true, repeat: -1 });
  }

  /**
   * 小镇南部装饰（树 + 花 + 草 + 石）
   * 原 MapScene.setupTownSouthLife() 物理搬迁
   */
  public decorateTownSouthLife(): void {
    const T = TILE_SIZE;
    const px = (c: number, r: number): [number, number] => [c * T + T / 2, r * T + T / 2];

    // ① 树木（2 棵）
    const tree = (c: number, r: number, s = 1): void => {
      const [x, y] = px(c, r);
      const g = this.scene.add.graphics().setDepth(3).setScale(s);
      g.fillStyle(0x5a3f22, 1); g.fillRect(x - 2, y - 10, 4, 10);
      g.fillStyle(0x3f6d2a, 1); g.fillCircle(x, y - 16, 7);
      g.fillStyle(0x528a38, 1); g.fillCircle(x - 3, y - 18, 4);
      g.fillStyle(0x3f6d2a, 1); g.fillCircle(x + 2, y - 13, 3);
      g.fillStyle(0x6da544, 0.8); g.fillCircle(x - 1, y - 17, 2);
      g.fillStyle(0x2e2e34, 0.18); g.fillEllipse(x, y + 2, 16, 3);
    };
    tree(4, 30, 1);
    tree(12, 32, 0.95);

    // ② 花丛（3 处）
    const flower = (c: number, r: number): void => {
      const [x, y] = px(c, r);
      const g = this.scene.add.graphics().setDepth(3);
      g.fillStyle(0x5a8a3a, 1); g.fillRect(x - 5, y, 1, 4);
      g.fillRect(x, y + 1, 1, 3);
      g.fillRect(x + 5, y, 1, 4);
      g.fillStyle(0x8abc5a, 1); g.fillRect(x - 3, y, 1, 2);
      g.fillRect(x + 3, y, 1, 2);
      g.fillStyle(0xff9e80, 1); g.fillCircle(x - 5, y - 2, 1.6);
      g.fillStyle(0xf4b8d8, 1); g.fillCircle(x, y - 1, 1.4);
      g.fillStyle(0xffd166, 1); g.fillCircle(x + 5, y - 2, 1.5);
    };
    flower(3, 32); flower(8, 30); flower(14, 31);

    // ③ 草簇（3 处）
    const grass = (c: number, r: number): void => {
      const [x, y] = px(c, r);
      const g = this.scene.add.graphics().setDepth(3);
      g.fillStyle(0x5a8a4a, 1);
      for (let i = 0; i < 3; i++) g.fillRect(x - 6 + i * 4, y - 1, 1, 5 + (i % 2) * 2);
    };
    grass(6, 33); grass(10, 31); grass(13, 34);

    // ④ 石头（2 处，圆石 + 高光）
    const rock = (c: number, r: number): void => {
      const [x, y] = px(c, r);
      const g = this.scene.add.graphics().setDepth(3);
      g.fillStyle(0x9a9aa2, 1); g.fillCircle(x, y, 2.5);
      g.fillStyle(0xb8b8c0, 0.8); g.fillCircle(x - 1, y - 1, 1.2);
    };
    rock(7, 33); rock(11, 33);

    // ⑤ 踩踏小路（从 row 28 石板路向南延伸的草地踏痕）
    {
      const g = this.scene.add.graphics().setDepth(2);
      for (const [c, r] of [[3, 29], [3, 30], [3, 31], [3, 32], [3, 33], [3, 34]] as Array<[number, number]>) {
        const [x, y] = px(c, r);
        g.fillStyle(0x3a5a30, 0.16);
        g.fillEllipse(x, y, 11, 4);
      }
    }
  }
}
