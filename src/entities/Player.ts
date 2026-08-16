import Phaser from 'phaser';
import { InputManager } from '../systems/InputManager';

/**
 * 玩家实体
 * Phase 1：WASD 移动 + 朝向记录
 * Phase M1：输入解耦，从 InputManager 读 moveX/moveY，不再直接引用键盘
 * 美术升级 v2：32x32 程序化像素角色，4方向×4帧 run 动画
 * 显示时 setScale(0.5) 缩放到 16x16 与瓦片协调
 *
 * spritesheet 布局（player.png 128x128，4行×4列，每帧 32x32）：
 *   row 0 (frames 0-3):  walk down
 *   row 1 (frames 4-7):  walk left
 *   row 2 (frames 8-11): walk right
 *   row 3 (frames 12-15): walk up
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  // 移动基础速度（像素/秒）。P0-1 手感专项：实际速度 = 方向 × baseSpeed × moveMagnitude（0~1）
  private readonly speed = 200;
  // 加减速平滑参数（P0-1 手感专项，制作人拍板：避免轻轻一划窜出去 / 大幅拖动跟不上）
  private static readonly ACCEL_RATE = 12;    // 加速系数（越大越快达到目标速度）
  private static readonly DECEL_RATE = 8;     // 减速系数（松手平滑减速，略小于加速避免急停）
  // 当前实际速度（内部状态，加减速平滑用）
  private currentVx = 0;
  private currentVy = 0;

  // 玩家朝向（交互作用方向判定用）
  public facing: 'up' | 'down' | 'left' | 'right' = 'down';

  // 输入管理器引用
  private inputMgr: InputManager;

  constructor(scene: Phaser.Scene, x: number, y: number, inputMgr: InputManager) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 32x32 角色缩放到 16x16 与 16x16 瓦片协调
    this.setScale(0.5);
    // 碰到物理世界边界停下
    this.setCollideWorldBounds(true);
    // 碰撞盒基于原始 32x32 设置：24x24 大小（缩放后=12x12），偏移 (4,6) 让碰撞盒靠下对齐脚部
    this.body!.setSize(24, 24).setOffset(4, 6);

    this.inputMgr = inputMgr;

    this.createAnimations();
  }

  /** 创建行走动画（全局只创建一次，跨场景复用） */
  private createAnimations(): void {
    const anims = this.scene.anims;
    if (anims.exists('player-walk-down')) return;

    anims.create({
      key: 'player-walk-down',
      frames: anims.generateFrameNumbers('player', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: -1,
    });
    anims.create({
      key: 'player-walk-left',
      frames: anims.generateFrameNumbers('player', { start: 4, end: 7 }),
      frameRate: 10,
      repeat: -1,
    });
    anims.create({
      key: 'player-walk-right',
      frames: anims.generateFrameNumbers('player', { start: 8, end: 11 }),
      frameRate: 10,
      repeat: -1,
    });
    anims.create({
      key: 'player-walk-up',
      frames: anims.generateFrameNumbers('player', { start: 12, end: 15 }),
      frameRate: 10,
      repeat: -1,
    });
  }

  /**
   * 每帧调用：从 InputManager 读取移动向量，设置速度与朝向，播放行走动画
   * 由 MapScene.update() 调用
   *
   * P0-1 手感专项（2026-08-14 制作人拍板）：
   *   目标速度 = 方向 × baseSpeed × moveMagnitude（键盘 magnitude=1 → 满速；摇杆 0~1 连续）
   *   加减速平滑：加速快（起步跟手）、减速平滑（松手不窜、不急停）
   *   连续转向：目标方向随时更新，速度平滑过渡，斜向移动自然
   */
  update(): void {
    const mx = this.inputMgr.moveX;
    const my = this.inputMgr.moveY;
    const mag = this.inputMgr.moveMagnitude;

    // 目标方向（水平优先，垂直覆盖朝向；与键盘逻辑一致）
    let targetVx = 0;
    let targetVy = 0;
    if (mx < 0) {
      targetVx = -this.speed * mag;
      this.facing = 'left';
    } else if (mx > 0) {
      targetVx = this.speed * mag;
      this.facing = 'right';
    }
    if (my < 0) {
      targetVy = -this.speed * mag;
      this.facing = 'up';
    } else if (my > 0) {
      targetVy = this.speed * mag;
      this.facing = 'down';
    }

    // 加减速平滑（指数逼近目标速度）：松手（目标为 0）用减速系数，否则加速系数
    const r = (targetVx === 0 && targetVy === 0) ? Player.DECEL_RATE : Player.ACCEL_RATE;
    this.currentVx += (targetVx - this.currentVx) * Math.min(1, r / 60);
    this.currentVy += (targetVy - this.currentVy) * Math.min(1, r / 60);
    // 减速到接近 0 时归零（避免无穷逼近的浮点残留）
    if (targetVx === 0 && Math.abs(this.currentVx) < 1) this.currentVx = 0;
    if (targetVy === 0 && Math.abs(this.currentVy) < 1) this.currentVy = 0;

    this.setVelocity(this.currentVx, this.currentVy);

    // 行走动画：移动时按朝向播放，停止时回到站立帧（run 第一帧）
    const moving = this.currentVx !== 0 || this.currentVy !== 0;
    if (moving) {
      const animKey = `player-walk-${this.facing}`;
      if (this.anims.currentAnim?.key !== animKey) {
        this.anims.play(animKey, true);
      }
    } else if (this.anims.isPlaying) {
      // 只在从移动变停止时执行一次（避免每帧重复 stop 导致闪烁）
      this.anims.stop();
      const idleFrame = this.facing === 'down' ? 0
        : this.facing === 'left' ? 4
        : this.facing === 'right' ? 8
        : 12;
      this.setFrame(idleFrame);
    }
  }
}
