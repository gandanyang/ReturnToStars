/**
 * CameraDirector — 相机三件套抽离模块（P1）
 *
 * 从 MapScene 抽离的纯相机逻辑封装：
 *   - centerOn: 立即将相机中心对准世界坐标
 *   - panTo:    平滑缓推相机至世界坐标（含 zoom 补偿）
 *   - zoomAt:   围绕世界坐标缩放（保持该点始终在屏幕中心）
 *
 * 设计约束：
 *   1. 仅持有 Camera + TweenManager 引用，不持有任何 MapScene 状态
 *   2. zoomAt 的 preZoomStart 回调用于 stargaze 等跨域清理（如停止慢横移 tween）
 *   3. 不改 GID / 不改碰撞编号 / 不改 TileMap 数据 — 本模块纯操作 Phaser 相机
 */

export class CameraDirector {
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  private readonly tweens: Phaser.Tweens.TweenManager;

  constructor(
    cam: Phaser.Cameras.Scene2D.Camera,
    tweens: Phaser.Tweens.TweenManager,
  ) {
    this.cam = cam;
    this.tweens = tweens;
  }

  /**
   * 立即将相机中心对准世界坐标 (wx, wy)。
   *
   * Phaser 3.80 的 centerOn 未缩放：scroll = 目标 - 视口宽/2，
   * zoom=2 下会整体偏移 (宽/4, 高/4)，导致室内小地图贴角（f1 假修复根因）。
   * 这里按世界坐标手算：scroll = wx - (width/2) / zoom。
   *
   * 注意：经 2026-08-07 修复后公式简化为 wx - width/2（不再除 zoom），
   * 因 Phaser preRender 的 midPoint = scroll + width/2 已为逻辑宽，不除 zoom。
   */
  public centerOn(wx: number, wy: number): void {
    this.cam.scrollX = wx - this.cam.width / 2;
    this.cam.scrollY = wy - this.cam.height / 2;
  }

  /**
   * 相机平滑移动到世界坐标 (wx, wy)（相机中心）。
   *
   * Phaser 3.80 pan 语义 = 视口中心（midPoint = scroll + width/2）最终落在 (x, y)，
   * 动画中与结束时均不除 zoom。这里用 tween + 手动 zoom 补偿实现，
   * 避免 Phaser Pan 的两个缺陷：
   *   ① destScroll 换算不含 zoom（zoom2 时 pan(504,232) 实际中心只有 304）
   *   ② 链式 pan（回调里再发新 pan）会被 force=false 吞掉
   *
   * @param wx 目标世界 X 坐标
   * @param wy 目标世界 Y 坐标
   * @param duration 动画时长（毫秒）
   * @param onComplete 完成回调（可选）
   */
  public panTo(wx: number, wy: number, duration: number, onComplete?: () => void): void {
    const destX = wx - this.cam.width / (2 * this.cam.zoom);
    const destY = wy - this.cam.height / (2 * this.cam.zoom);
    this.tweens.add({
      targets: this.cam,
      scrollX: destX,
      scrollY: destY,
      duration,
      ease: 'Power2',
      onComplete: () => onComplete?.(),
    });
  }

  /**
   * 围绕世界点 (wx, wy) 缩放，保持该点始终在镜头中心。
   *
   * 不用 Phaser zoomTo（其只改 zoom 不改 scroll，放大围绕左上角，角色会偏出画面）：
   * tween 一个线性 progress，每帧按 zoom 反算 scroll（scroll = center - size/(2*zoom)），
   * 保证"世界点钉在屏幕中心"，与 panTo 的 zoom 补偿同一套公式。
   *
   * @param wx 目标世界 X 坐标
   * @param wy 目标世界 Y 坐标
   * @param toZoom 目标 zoom 值
   * @param duration 动画时长（毫秒）
   * @param onComplete 完成回调（可选）
   * @param preZoomStart 缩放开始前的清理回调（用于停止 stargaze 等跨域 tween）
   */
  public zoomAt(
    wx: number,
    wy: number,
    toZoom: number,
    duration: number,
    onComplete?: () => void,
    preZoomStart?: () => void,
  ): void {
    preZoomStart?.();
    const from = this.cam.zoom;
    this.tweens.add({
      targets: { p: 0 },
      p: 1,
      duration,
      ease: 'Sine.out',
      onUpdate: (_t, target: { p: number }) => {
        const zoom = from + (toZoom - from) * target.p;
        this.cam.zoom = zoom;
        this.cam.scrollX = wx - this.cam.width / (2 * zoom);
        this.cam.scrollY = wy - this.cam.height / (2 * zoom);
      },
      onComplete: () => onComplete?.(),
    });
  }
}
