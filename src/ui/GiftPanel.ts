/**
 * 爷爷的归星包裹 v0.1（2026-08-11 制作人拍板：P0 序章体验补强）
 *
 * 触发：玩家第一次进入老屋（house 场景），靠近旧木箱按 E 打开。
 * 内容：爷爷的信（核心）+ 纪念物（小鱼干/旧花苗）+ 少量启动资源（木材/石头/金币）。
 *       ——与镇长开局礼包差异化：镇长礼包管生存，爷爷包裹管情感。
 * 一次性：triggerOnce('grandpa_gift_opened')，状态随存档 gameState 持久化。
 *
 * 设计：与 ShopPanel/EndingPanel 相同模式——模块级单例、DOM 只创建一次、open/close 切显隐。
 */

import { itemIconHtml, ITEM_DEFS, type ItemType } from '../data/Inventory';

// ===== 模块级单例状态 =====
let panelEl: HTMLDivElement | null = null;
let domCreated = false;
let open = false;
let onGift: (() => void) | null = null;

/** 爷爷的信（制作人原文定稿，不得扩写/改写） */
const LETTER_TEXT = `林澈：

如果你看到这封信，
说明你终于回来了。

岛上的东西可能旧了，
房子可能没人住了。

但是不用急着把它变回以前。

慢慢来。

种下一颗种子，
修好一块木板，
和这里的人重新打个招呼。

有些地方，
不是靠一次改变变好的。

是有人愿意留下。

——爷爷`;

/** 包裹物品清单（v0.1 定稿：纪念物 + 启动资源，与镇长礼包差异化） */
const GIFT_ITEMS: { id: ItemType; count: number }[] = [
  { id: 'grandpa_letter', count: 1 },
  { id: 'dried_fish', count: 1 },
  { id: 'flower_seedling', count: 1 },
  { id: 'wood', count: 5 },
  { id: 'stone', count: 5 },
];

/** 附赠金币（制作人 2026-08-11："多给点金币之类的资源，不用那么抠门"） */
const GIFT_COINS = 200;

/** 关闭面板 */
function closePanel(): void {
  if (!open) return;
  open = false;
  if (panelEl) panelEl.style.display = 'none';
}

/** 创建面板 DOM（模块级，只创建一次） */
function createDom(): void {
  if (domCreated) return;
  if (document.getElementById('gift-panel')) {
    domCreated = true;
    return;
  }
  domCreated = true;

  panelEl = document.createElement('div');
  panelEl.id = 'gift-panel';
  panelEl.style.cssText =
    'position:fixed;top:0;right:0;bottom:0;left:0;display:none;align-items:center;justify-content:center;' +
    'background:rgba(10,12,16,0.72);z-index:240;user-select:none;-webkit-user-select:none;';

  panelEl.innerHTML = `
    <div style="width:min(430px,94vw);max-height:92vh;overflow-y:auto;padding:18px 20px;color:#F5EFDD;font-family:'Noto Sans SC','Source Han Sans SC','PingFang SC','Microsoft YaHei',sans-serif;border:2px solid #8a6a45;outline:1px solid rgba(216,196,154,0.35);outline-offset:4px;border-radius:12px;background-image:linear-gradient(180deg,rgba(46,36,26,0.97) 0%,rgba(34,26,19,0.98) 100%);box-shadow:inset 0 2px 4px rgba(255,255,255,0.05),0 0 46px rgba(138,106,69,0.35);">
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:11px;letter-spacing:4px;color:#d8c49a;margin-bottom:4px;">爷爷的归星包裹</div>
        <div style="font-size:12px;color:#8a97b0;">老屋角落的旧木箱，落了灰，但锁没有锈死。</div>
      </div>

      <div id="gift-letter" style="background:#e8dcc8;color:#4a3a28;border-radius:8px;padding:14px 16px;margin-bottom:12px;font-size:13px;line-height:1.85;white-space:pre-line;box-shadow:inset 0 1px 3px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.25);border:1px solid #c8b898;"></div>

      <div style="font-size:11px;letter-spacing:2px;color:#d8c49a;margin-bottom:8px;">木箱里还有：</div>
      <div id="gift-items" style="margin-bottom:12px;"></div>

      <div style="text-align:center;">
        <button data-action="gift" style="font-size:14px;font-weight:bold;padding:10px 30px;background-image:linear-gradient(180deg,rgba(140,168,124,0.95) 0%,rgba(86,114,72,0.96) 100%);border:1px solid rgba(216,196,154,0.55);border-radius:10px;color:#F5EFDD;cursor:pointer;box-shadow:inset 0 2px 3px rgba(255,255,255,0.18),inset 0 -3px 6px rgba(0,0,0,0.3),0 4px 12px rgba(60,84,50,0.45);text-shadow:0 1px 2px rgba(0,0,0,0.6);">收下并合上</button>
      </div>
    </div>
  `;
  document.body.appendChild(panelEl);

  panelEl.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset?.action === 'gift') {
      closePanel();
      const cb = onGift;
      onGift = null;
      cb?.();
    }
  });
}

/** 刷新内容（每次 open 时调用，物品数量从当前库存动态读取——首次打开均为 0，展示包裹清单） */
function refresh(): void {
  if (!panelEl) return;
  const letterEl = panelEl.querySelector('#gift-letter');
  if (letterEl) letterEl.textContent = LETTER_TEXT;

  const itemsEl = panelEl.querySelector('#gift-items');
  if (itemsEl) {
    itemsEl.innerHTML = GIFT_ITEMS.map((g) => `
      <div style="display:flex;align-items:center;gap:8px;padding:5px 10px;margin-bottom:5px;background:rgba(255,255,255,0.045);border:1px solid rgba(216,196,154,0.18);border-radius:7px;">
        <span style="font-size:16px;width:22px;text-align:center;">${itemIconHtml(g.id, 20)}</span>
        <span style="font-size:13px;color:#e8dcc8;">${ITEM_DEFS[g.id].name} ×${g.count}</span>
      </div>`).join('')
      + `<div style="display:flex;align-items:center;gap:8px;padding:5px 10px;background:rgba(255,255,255,0.045);border:1px solid rgba(216,196,154,0.18);border-radius:7px;">
          <span style="font-size:16px;width:22px;text-align:center;">${itemIconHtml('coin', 20)}</span>
          <span style="font-size:13px;color:#e8dcc8;">金币 ${GIFT_COINS}</span>
        </div>`;
  }
}

export class GiftPanel {
  constructor() {
    if (!domCreated) createDom();
  }

  /** 打开爷爷的归星包裹；onGiftCb 在玩家点「收下」后回调（由调用方发放物品 + triggerOnce + save） */
  open(onGiftCb: () => void): void {
    open = true;
    onGift = onGiftCb;
    if (panelEl) {
      refresh();
      panelEl.style.display = 'flex';
    }
  }

  /** 关闭面板 */
  close(): void {
    closePanel();
  }

  /** 面板是否打开 */
  isOpen(): boolean {
    return open;
  }
}
