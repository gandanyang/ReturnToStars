/**
 * CutsceneGuard — 场景演出状态守卫
 *
 * 统一管理 5 个 cutscene 旗标：
 *   - inStargazeCutscene  观星夜演出（scene cutscene）
 *   - inArtShowCutscene   星光艺术展（scene cutscene）
 *   - inSpringFairCutscene 春日集（scene cutscene）
 *   - inDryyardCutscene   秋日晒场（scene cutscene）
 *   - firstMorningActive  清晨演出窗口（window lock，非 scene cutscene）
 *
 * 语义模式：
 *   场景 cutscene（前 4 个）：互斥 — 任一激活时阻止其他自动演出和交互
 *   窗口锁（firstMorningActive）：抑制窗口 — 演出期间抑制其他自动对白
 *
 * 使用：
 *   guard.begin('stargaze');  // 设置旗标
 *   guard.isAnyActive();       // 任意 cutscene 激活？
 *   guard.isBlocked();         // 是否应阻止自动演出（含 window lock）
 *   guard.end('stargaze');     // 清除旗标
 */

export type CutsceneId =
  | 'stargaze'
  | 'art_show'
  | 'spring_fair'
  | 'dryyard';

export class CutsceneGuard {
  /** 场景 cutscene 旗标（互斥） */
  private active = new Set<CutsceneId>();

  /** 窗口锁旗标（firstMorningActive 语义） */
  private windowLock = false;

  /** 进入场景 cutscene（设置旗标） */
  public begin(id: CutsceneId): void {
    this.active.add(id);
  }

  /** 退出场景 cutscene（清除旗标） */
  public end(id: CutsceneId): void {
    this.active.delete(id);
  }

  /** 进入窗口锁（非 scene cutscene，仅抑制自动对白） */
  public beginWindow(): void {
    this.windowLock = true;
  }

  /** 退出窗口锁 */
  public endWindow(): void {
    this.windowLock = false;
  }

  /** 任意场景 cutscene 激活？ */
  public isAnyActive(): boolean {
    return this.active.size > 0;
  }

  /** 指定 cutscene 激活？ */
  public isActive(id: CutsceneId): boolean {
    return this.active.has(id);
  }

  /** 窗口锁激活？ */
  public isWindowLocked(): boolean {
    return this.windowLock;
  }

  /**
   * 自动演出是否应被阻止？
   * 任意场景 cutscene 激活 或 窗口锁激活 → 返回 true
   */
  public isBlocked(): boolean {
    return this.active.size > 0 || this.windowLock;
  }

  /** 当前激活的 cutscene ID 列表 */
  public getActiveIds(): CutsceneId[] {
    return Array.from(this.active);
  }

  /**
   * 构建 GateSnapshot 数据（供 InteractionRouter 消费）
   * 替换 MapScene 中散落的 cutscene 字段
   */
  public getSnapshot(): {
    inStargazeCutscene: boolean;
    inArtShowCutscene: boolean;
    inSpringFairCutscene: boolean;
    inDryyardCutscene: boolean;
    firstMorningActive: boolean;
  } {
    return {
      inStargazeCutscene: this.active.has('stargaze'),
      inArtShowCutscene: this.active.has('art_show'),
      inSpringFairCutscene: this.active.has('spring_fair'),
      inDryyardCutscene: this.active.has('dryyard'),
      firstMorningActive: this.windowLock,
    };
  }
}
