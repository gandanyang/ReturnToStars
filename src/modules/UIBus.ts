/**
 * UIBus — UI 面板生命周期管理器（P2）
 *
 * 从 MapScene 抽离的面板实例管理模块。
 *
 * 架构定位（制作人 2026-08-26 拍板）：
 *   - UIBus 只拥有面板生命周期相关状态
 *   - UIBus 是查询聚合器，不是新的调度器
 *   - 守卫链 20 步原封不动保留在 MapScene.update() 中
 *   - UIBus 不得拥有时间/天气/演出/地图/交互/玩法状态
 *
 * 提供能力：
 *   1. 面板实例存储与 getter 代理（供 MapScene 通过 `this.uiBus.panelName` 访问）
 *   2. isAnyBlocking() 阻塞查询聚合器（按原始守卫链顺序判断）
 *   3. openBackpack/openQuest/openWait 快捷键路由委托
 *
 * 禁止：
 *   - 不得拥有 MapScene 的任何游戏状态
 *   - 不得提供 update() 或任何调度逻辑
 *   - 不得修改守卫链的执行顺序
 */

import { ShopPanel } from '../ui/ShopPanel';
import { BackpackPanel } from '../ui/BackpackPanel';
import { QuestPanel } from '../ui/QuestPanel';
import { ResidentBoardPanel } from '../ui/ResidentBoardPanel';
import { MusicBoxPanel } from '../ui/MusicBoxPanel';
import { GiftPanel } from '../ui/GiftPanel';
import { EndingPanel } from '../ui/EndingPanel';
import { PhotoAlbumPanel } from '../ui/PhotoAlbumPanel';
// 已模块化的面板（函数式 API，非实例存储）
import { isWaitPanelOpen, closeWaitPanel } from '../ui/WaitPanel';
import { isDiscoveryPanelOpen } from '../ui/DiscoveryPanel';
import { isHudMenuOpen } from '../ui/HudMenuPanel';

export class UIBus {
  // === 面板实例存储（全部 nullable，按需创建）===
  private _shopPanel: ShopPanel | null = null;
  private _backpackPanel: BackpackPanel | null = null;
  private _questPanel: QuestPanel | null = null;
  private _residentBoardPanel: ResidentBoardPanel | null = null;
  private _musicBoxPanel: MusicBoxPanel | null = null;
  private _grandpaGiftPanel: GiftPanel | null = null;
  private _endingPanel: EndingPanel | null = null;
  private _photoAlbumPanel: PhotoAlbumPanel | null = null;

  // === 快捷键路由委托 ===
  private _openBackpack: (() => void) | null = null;
  private _openQuest: (() => void) | null = null;
  private _openWait: (() => void) | null = null;

  // === 面板注册（由 MapScene 在创建面板后调用）===

  public registerShopPanel(p: ShopPanel): void { this._shopPanel = p; }
  public registerBackpackPanel(p: BackpackPanel): void { this._backpackPanel = p; }
  public registerQuestPanel(p: QuestPanel): void { this._questPanel = p; }
  public registerResidentBoardPanel(p: ResidentBoardPanel): void { this._residentBoardPanel = p; }
  public registerMusicBoxPanel(p: MusicBoxPanel): void { this._musicBoxPanel = p; }
  public registerGrandpaGiftPanel(p: GiftPanel): void { this._grandpaGiftPanel = p; }
  public registerEndingPanel(p: EndingPanel): void { this._endingPanel = p; }
  public registerPhotoAlbumPanel(p: PhotoAlbumPanel): void { this._photoAlbumPanel = p; }

  public setOpenHandlers(handlers: {
    openBackpack?: () => void;
    openQuest?: () => void;
    openWait?: () => void;
  }): void {
    this._openBackpack = handlers.openBackpack ?? null;
    this._openQuest = handlers.openQuest ?? null;
    this._openWait = handlers.openWait ?? null;
  }

  // === Readonly Getters（供 MapScene 委托访问）===

  public get shopPanel(): ShopPanel | null { return this._shopPanel; }
  public get backpackPanel(): BackpackPanel | null { return this._backpackPanel; }
  public get questPanel(): QuestPanel | null { return this._questPanel; }
  public get residentBoardPanel(): ResidentBoardPanel | null { return this._residentBoardPanel; }
  public get musicBoxPanel(): MusicBoxPanel | null { return this._musicBoxPanel; }
  public get grandpaGiftPanel(): GiftPanel | null { return this._grandpaGiftPanel; }
  public get endingPanel(): EndingPanel | null { return this._endingPanel; }
  public get photoAlbumPanel(): PhotoAlbumPanel | null { return this._photoAlbumPanel; }

  // === 阻塞查询聚合器 ===
  //
  // 查询顺序严格与 MapScene.update 守卫链一致（仅覆盖 UI 面板，不含 game state）：
  //   L1997 ① endingPanel
  //   L2036 ④ photoAlbumPanel
  //   L2043 ⑤ isDiscoveryPanelOpen
  //   L2050 ⑥ isHudMenuOpen
  //   L2057 ⑦ residentBoardPanel
  //   L2067 ⑧ shopPanel
  //   L2077 ⑨ backpackPanel
  //   L2087 ⑩ questPanel
  //   L2097 ⑪ isWaitPanelOpen
  //
  // 注意：② inStargazeCutscene / ③ inArtShowCutscene / ⑱ storyDialogue 是 game state，
  //       由 MapScene 自身检查，不纳入 UIBus。
  /**
   * 查询是否有任何 UI 面板阻塞输入。
   * 本方法仅为查询聚合器，不做任何调度决策。
   * @returns true 表示当前有面板打开并阻塞输入
   */
  public isAnyBlocking(): boolean {
    if (this._endingPanel?.isOpen()) return true;
    if (this._photoAlbumPanel?.isOpen()) return true;
    if (isDiscoveryPanelOpen()) return true;
    if (isHudMenuOpen()) return true;
    if (this._residentBoardPanel?.isOpen()) return true;
    if (this._shopPanel?.isOpen()) return true;
    if (this._backpackPanel?.isOpen()) return true;
    if (this._questPanel?.isOpen()) return true;
    if (isWaitPanelOpen()) return true;
    return false;
  }

  // === 面板开放便捷方法（快捷键路由用）===

  public openBackpack(): void { this._openBackpack?.(); }
  public openQuest(): void { this._openQuest?.(); }
  public openWait(): void { this._openWait?.(); }
  public closeWait(): void { closeWaitPanel(); }

  // === 单面板查询便捷方法（供 MapScene 守卫链调用）===

  public isEndingOpen(): boolean { return this._endingPanel?.isOpen() ?? false; }
  public isPhotoAlbumOpen(): boolean { return this._photoAlbumPanel?.isOpen() ?? false; }
  public isResidentBoardOpen(): boolean { return this._residentBoardPanel?.isOpen() ?? false; }
  public isShopOpen(): boolean { return this._shopPanel?.isOpen() ?? false; }
  public isBackpackOpen(): boolean { return this._backpackPanel?.isOpen() ?? false; }
  public isQuestOpen(): boolean { return this._questPanel?.isOpen() ?? false; }

  // === 面板关闭便捷方法（守卫链放行按键用）===

  public closeResidentBoard(): void { this._residentBoardPanel?.close(); }
  public closeShop(): void { this._shopPanel?.close(); }
  public closeBackpack(): void { this._backpackPanel?.close(); }
  public closeQuest(): void { this._questPanel?.close(); }
}
