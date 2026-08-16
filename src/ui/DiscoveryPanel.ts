/**
 * 自然记录图鉴面板（DOM 覆盖层）
 *
 * P1 Discovery 图鉴展示 · 信息展示层（2026-08-16 制作人拍板）。
 * 展示玩家"认识这片土地"的记录：
 *   - 已发现条目：名字 / 描述 / 第一次发现的地点与天数 / 特殊发现备注
 *   - 未发现条目：剪影占位 + 轻提示（去哪找、什么条件），不弹任务、不给奖励
 *
 * 数据源：
 *   - DiscoveryManager（玩家记忆，随存档持久化）
 *   - DiscoveryCatalog（展示元数据：名字/描述/提示）
 *
 * 交互：Esc / 关闭按钮 / 点空白关闭（与归星录·相簿同范式）。
 */

import { getAllDiscoveries, type DiscoveryRecord } from '../systems/DiscoveryManager';
import { DISCOVERY_CATALOG, SPECIAL_DISCOVERY_NOTES } from '../data/DiscoveryCatalog';
import { panelFadeIn, panelFadeOut } from './dom-anim';

// ===== 模块级单例 =====
let panelEl: HTMLDivElement | null = null;
let domCreated = false;
let open = false;

/** 关闭面板 */
function closePanel(): void {
  if (!open) return;
  open = false;
  if (panelEl) panelFadeOut(panelEl, 150);
}

/** 创建 DOM（只创建一次） */
function createDom(): void {
  if (domCreated) return;
  if (document.getElementById('discovery-panel')) {
    domCreated = true;
    return;
  }
  domCreated = true;

  panelEl = document.createElement('div');
  panelEl.id = 'discovery-panel';
  panelEl.style.cssText =
    'position:fixed;top:0;right:0;bottom:0;left:0;display:none;align-items:center;justify-content:center;' +
    'background:rgba(8,14,22,0.86);z-index:221;user-select:none;-webkit-user-select:none;';

  panelEl.innerHTML = `
    <div style="width:min(540px,94vw);max-height:86vh;background:rgba(22,30,26,0.97);border:2px solid #5a7a52;border-radius:12px;padding:16px;color:#e8f0e0;font-family:Arial;box-shadow:0 4px 30px rgba(0,0,0,0.6);display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-shrink:0;">
        <span style="font-size:12px;letter-spacing:3px;color:#8aaa78;">📗 青禾镇自然记录</span>
        <button data-action="close" style="width:30px;height:30px;border-radius:50%;background:#3a4e3a;border:none;color:#fff;font-size:16px;cursor:pointer;line-height:1;">×</button>
      </div>
      <div style="font-size:20px;font-weight:bold;color:#fff;margin-bottom:2px;flex-shrink:0;">图鉴</div>
      <div style="font-size:12px;color:#8aa88a;margin-bottom:14px;flex-shrink:0;">看见过的东西，会一直记得。</div>
      <div id="discovery-list" style="overflow-y:auto;flex:1;min-height:0;display:flex;flex-direction:column;gap:10px;"></div>
    </div>
  `;
  document.body.appendChild(panelEl);

  // 点空白关闭
  panelEl.addEventListener('click', (e) => {
    if (e.target === panelEl) closePanel();
  });
  const closeBtn = panelEl.querySelector('[data-action="close"]') as HTMLElement | null;
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    closePanel();
  });
}

/** 已发现条目的展示卡 */
function entryCard(entry: { id: string; name: string; desc: string; hint: string }, rec: DiscoveryRecord | undefined): string {
  if (rec) {
    const specials = (rec.specialDiscoveries ?? [])
      .map((s) => SPECIAL_DISCOVERY_NOTES[s])
      .filter(Boolean)
      .map((n) => `<div style="font-size:12px;color:#b8d8a8;margin-top:4px;">✦ ${n}</div>`)
      .join('');
    return `
      <div style="background:rgba(60,80,52,0.5);border:1px solid #6a8a5e;border-radius:8px;padding:10px 12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:16px;">${entry.name}</span>
          <span style="font-size:11px;color:#9ab88a;">第 ${rec.firstDiscoverDay} 天 · ${rec.firstDiscoverLocation ?? '某处'}</span>
        </div>
        <div style="font-size:12px;color:#c8d8c0;margin-top:4px;">${entry.desc}</div>
        ${specials}
      </div>
    `;
  }
  return `
    <div style="background:rgba(40,48,40,0.5);border:1px dashed #5a6a52;border-radius:8px;padding:10px 12px;opacity:0.75;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:16px;color:#788a70;">？？？</span>
      </div>
      <div style="font-size:12px;color:#7a8a72;margin-top:4px;">${entry.hint}</div>
    </div>
  `;
}

/** 渲染列表（每次打开重绘，反映最新发现） */
function render(): void {
  const list = panelEl?.querySelector('#discovery-list');
  if (!list) return;
  const records = getAllDiscoveries();
  list.innerHTML = DISCOVERY_CATALOG.map((e) => entryCard(e, records[e.id])).join('');
}

/** 打开面板 */
export function openDiscoveryPanel(): void {
  createDom();
  if (open || !panelEl) return;
  open = true;
  render();
  panelEl.style.display = 'flex';
  panelFadeIn(panelEl, 160);
}

/** 面板是否打开 */
export function isDiscoveryPanelOpen(): boolean {
  return open;
}

/** 关闭面板（MapScene 冻结交互时调用） */
export function closeDiscoveryPanel(): void {
  closePanel();
}

/** Esc 关闭（MapScene 键盘处理接入） */
export function discoveryPanelHandleEscape(): boolean {
  if (!open) return false;
  closePanel();
  return true;
}
