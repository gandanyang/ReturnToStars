/**
 * HUD 功能菜单面板（移动端优先，2026-08-16）
 *
 * 目标：把散在 HUD 左上角的多个功能按钮（归星录 / 自然记录 / 小镇计划 / 声音设置…）
 * 收纳进一个抽屉菜单，避免小屏被按钮堆满、遮挡地图视野。
 *
 * 设计：
 *   - 入口：一个 ☰ 按钮（移动端更大触区）
 *   - 展开：半透明下拉面板，条目大图标 + 文字，触屏友好（≥44px 触区）
 *   - 动态条目：MapScene 注册（如小镇计划仅解锁后出现）
 *   - 关闭：再点入口 / 点空白 / Esc
 */

import { panelFadeIn, panelFadeOut } from './dom-anim';
import { isMobileLayout } from '../config';

/** 菜单条目 */
export interface HudMenuItem {
  id: string;
  label: string;
  icon: string;
  /** 点击回调 */
  onClick: () => void;
}

// ===== 模块级状态 =====
let panelEl: HTMLDivElement | null = null;
let domCreated = false;
let open = false;
let items: HudMenuItem[] = [];
let onCloseCb: (() => void) | null = null;

/** 关闭菜单 */
function closePanel(): void {
  if (!open) return;
  open = false;
  if (panelEl) panelFadeOut(panelEl, 140);
  onCloseCb?.();
}

/** 创建 DOM（只创建一次） */
function createDom(): void {
  if (domCreated) return;
  if (document.getElementById('hud-menu-panel')) {
    domCreated = true;
    return;
  }
  domCreated = true;

  panelEl = document.createElement('div');
  panelEl.id = 'hud-menu-panel';
  panelEl.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;display:none;align-items:flex-start;justify-content:flex-start;' +
    'background:rgba(8,12,20,0.55);z-index:219;user-select:none;-webkit-user-select:none;';

  // 面板内容：左上角抽屉（避开状态栏/刘海）
  const drawer = document.createElement('div');
  drawer.style.cssText =
    'margin-top:calc(58px + env(safe-area-inset-top, 0px));margin-left:8px;' +
    'min-width:190px;max-width:min(240px,80vw);' +
    'background:rgba(20,26,38,0.96);border:1px solid rgba(122,138,208,0.45);border-radius:12px;' +
    'padding:8px;box-shadow:0 4px 24px rgba(0,0,0,0.5);display:flex;flex-direction:column;gap:4px;';
  drawer.id = 'hud-menu-drawer';
  panelEl.appendChild(drawer);

  // 标题
  const title = document.createElement('div');
  title.textContent = '菜单';
  title.style.cssText =
    'font-size:12px;letter-spacing:3px;color:#8aa0c8;padding:4px 8px 6px;border-bottom:1px solid rgba(122,138,208,0.25);margin-bottom:4px;';
  drawer.appendChild(title);

  // 条目容器
  const list = document.createElement('div');
  list.id = 'hud-menu-list';
  list.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
  drawer.appendChild(list);

  // 点空白关闭
  panelEl.addEventListener('click', (e) => {
    if (e.target === panelEl) closePanel();
  });
  // Esc 关闭（必须用捕获阶段，否则 main.ts 的 initPcEscapeHandler（冒泡阶段）会抢先）
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!open) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    closePanel();
  }, true);
  document.body.appendChild(panelEl);
}

/** 渲染条目（打开时重绘，反映最新注册项） */
function render(): void {
  const list = panelEl?.querySelector('#hud-menu-list');
  if (!list) return;
  list.innerHTML = '';
  for (const item of items) {
    const row = document.createElement('div');
    row.dataset.menuItem = item.id;
    row.style.cssText =
      'display:flex;align-items:center;gap:10px;padding:10px 12px;min-height:44px;cursor:pointer;' +
      'border-radius:8px;color:#e0e8f8;font-size:14px;' +
      'background:rgba(255,255,255,0.04);transition:background 0.12s;';
    row.innerHTML = `<span style="font-size:17px;width:24px;text-align:center;">${item.icon}</span><span>${item.label}</span>`;
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      closePanel();
      item.onClick();
    });
    list.appendChild(row);
  }
}

/** 打开菜单 */
export function openHudMenu(): void {
  createDom();
  if (open || !panelEl) return;
  open = true;
  render();
  panelEl.style.display = 'flex';
  panelFadeIn(panelEl, 140);
}

/** 菜单是否打开 */
export function isHudMenuOpen(): boolean {
  return open;
}

/** 注册条目（MapScene 每次 create 时调用；打开时重绘） */
export function setHudMenuItems(newItems: HudMenuItem[], onClose?: () => void): void {
  items = newItems;
  onCloseCb = onClose ?? null;
  if (open) render();
}

/** Esc 关闭（MapScene 键盘处理接入） */
export function hudMenuHandleEscape(): boolean {
  if (!open) return false;
  closePanel();
  return true;
}

/** 判断移动端（供 MapScene 决定入口按钮大小） */
export function menuIsMobile(): boolean {
  return isMobileLayout();
}
