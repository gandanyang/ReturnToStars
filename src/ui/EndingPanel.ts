/**
 * 归星记录面板（DOM 覆盖层）
 *
 * 设计：与 ShopPanel 相同模式——模块级单例、DOM 只创建一次、open/close 切显隐。
 * 触发：观星收尾剧情播放完成后由 MapScene 调 open()。
 * 内容：五段归星记录（🌱土地/🌸记忆/🏡庄园/👥羁绊/⭐评价）+ 变化对比 + 极简数据脚注。
 * 关闭后不再重复触发（storyStep = 'observatory_complete' 持久化判重）。
 *
 * 设计原则（制作人寄语）：
 *   核心目标不是评价玩家效率，而是记录玩家对归星岛造成的改变。
 *   不做排行榜/百分比/效率评价。
 */

import { getTime } from '../data/TimeSystem';
import { getLevel } from '../data/FarmProgress';
import { getItemCount, itemIconHtml } from '../data/Inventory';
import { generateGuiXingRecord, type GuiXingSection } from '../systems/GuiXingRecordSystem';

// ===== 模块级单例状态 =====
let panelEl: HTMLDivElement | null = null;
let domCreated = false;
let open = false;
let onClose: (() => void) | null = null;

/** 关闭面板 */
function closePanel(): void {
  if (!open) return;
  open = false;
  if (panelEl) panelEl.style.display = 'none';
  onClose?.();
}

/** 创建面板 DOM（模块级，只创建一次） */
function createDom(): void {
  if (domCreated) return;
  if (document.getElementById('ending-panel')) {
    domCreated = true;
    return;
  }
  domCreated = true;

  panelEl = document.createElement('div');
  panelEl.id = 'ending-panel';
  // 夜空遮罩（观星夜气质）：顶部微光 → 渐入深夜蓝
  panelEl.style.cssText =
    'position:fixed;top:0;right:0;bottom:0;left:0;display:none;align-items:center;justify-content:center;' +
    'background:radial-gradient(ellipse at 50% 15%, rgba(47,66,102,0.85) 0%, rgba(18,22,38,0.96) 55%, rgba(5,8,28,1) 100%);' +
    'z-index:250;user-select:none;-webkit-user-select:none;overflow-y:auto;';

  panelEl.innerHTML = `
    <div style="width:min(480px,94vw);padding:24px 20px;color:#F5EFDD;font-family:'Noto Sans SC','Source Han Sans SC','PingFang SC','Microsoft YaHei',sans-serif;border:2px solid #D8C49A;outline:1px solid rgba(216,196,154,0.35);outline-offset:5px;border-radius:14px;background-image:radial-gradient(1px 1px at 20% 10%,rgba(255,255,255,0.5) 50%,transparent 51%),radial-gradient(1px 1px at 66% 16%,rgba(255,255,255,0.4) 50%,transparent 51%),radial-gradient(1.5px 1.5px at 42% 26%,rgba(255,255,255,0.28) 50%,transparent 51%),radial-gradient(1px 1px at 78% 40%,rgba(255,255,255,0.35) 50%,transparent 51%),repeating-linear-gradient(90deg,rgba(0,0,0,0.05) 0 2px,transparent 2px 4px),linear-gradient(180deg,rgba(36,41,54,0.97) 0%,rgba(24,28,38,0.98) 100%);box-shadow:inset 0 2px 4px rgba(255,255,255,0.06),inset 0 -6px 18px rgba(0,0,0,0.4),0 0 60px rgba(216,196,154,0.16);">
      <div id="gx-header" style="text-align:center;margin-bottom:18px;"></div>
      <div id="gx-change" style="display:none;margin-bottom:16px;"></div>
      <div id="gx-sections" style="margin-bottom:16px;"></div>
      <div id="gx-stats" style="text-align:center;background:rgba(24,28,38,0.9);border:1px solid rgba(216,196,154,0.22);border-radius:10px;padding:10px 14px;font-size:11px;line-height:1.7;margin-bottom:14px;color:#8A97B0;"></div>
      <div style="text-align:center;">
        <button data-action="continue" style="font-size:14px;font-weight:bold;padding:11px 34px;background-image:linear-gradient(180deg,rgba(140,168,124,0.95) 0%,rgba(86,114,72,0.96) 100%);border:1px solid rgba(216,196,154,0.55);border-radius:10px;color:#F5EFDD;cursor:pointer;box-shadow:inset 0 2px 3px rgba(255,255,255,0.18),inset 0 -3px 6px rgba(0,0,0,0.3),0 4px 12px rgba(60,84,50,0.45);text-shadow:0 1px 2px rgba(0,0,0,0.6);transition:transform 0.1s ease,filter 0.1s ease;">继续自由游玩</button>
      </div>
      <div id="gx-hook" style="margin-top:16px;border-top:1px solid rgba(216,196,154,0.25);padding-top:14px;text-align:center;"></div>
    </div>
  `;
  document.body.appendChild(panelEl);

  panelEl.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset?.action === 'continue') {
      closePanel();
    } else if (target.dataset?.action === 'store') {
      handleStoreClick();
    } else if (target.dataset?.action === 'share') {
      handleShareClick();
    }
  });
}

/**
 * Demo 结尾「后续钩子」（制作人 2026-08-11 拍板：指标 3 = 观星夜后玩家主动询问后续，IP 价值出现）
 * 设计：三层出口——①继续自由游玩 ②「给青禾镇留下一封信」（关注引导，世界观化文案，点击后先给解释再跳转）
 *      ③「分享给朋友」（获客）。不强制、不运营感；像"邀请住进青禾镇"而非"请关注"。
 * 顺序：玩家已完整走完第0章（观星夜结束），此时出现引导不割裂。
 */
/** TapTap 商店页（已上线 2026-08-11：https://www.taptap.cn/app/900050?os=android） */
const STORE_URL = 'https://www.taptap.cn/app/900050?os=android';
/** 分享文案（Web Share API；不支持时复制链接） */
const SHARE_TEXT = '我在《归星物语》里给一座荒废的小岛重新种上了田、看了一夜的星星。这座岛在等你回来。';

/** 第二层「留下一封信」：点击后先显示解释（情绪桥梁），再点才跳转 */
function handleStoreClick(): void {
  const btn = document.querySelector<HTMLElement>('[data-action="store"]');
  const hint = document.querySelector<HTMLElement>('#gx-hook-hint');
  if (!btn) return;

  // 首次点击：展开解释（桥接"游戏世界 → 商店"的割裂感）
  if (btn.dataset.stage !== 'confirm') {
    btn.dataset.stage = 'confirm';
    btn.textContent = '前往 TapTap 关注《归星物语》';
    if (hint) {
      hint.style.display = 'block';
      hint.style.opacity = '1';
    }
    return;
  }

  // 二次点击：真正跳转
  if (STORE_URL) {
    window.open(STORE_URL, '_blank');
    return;
  }
  btn.textContent = '商店页即将开放';
  btn.style.opacity = '0.55';
  btn.style.pointerEvents = 'none';
}

/** 第三层「分享给朋友」：Web Share API 优先，降级复制链接 */
function handleShareClick(): void {
  const url = STORE_URL || window.location.href;
  if (navigator.share) {
    navigator.share({ title: '归星物语', text: SHARE_TEXT, url }).catch(() => {});
    return;
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(`${SHARE_TEXT} ${url}`).then(() => {
      const btn = document.querySelector<HTMLElement>('[data-action="share"]');
      if (btn) btn.textContent = '已复制，去分享吧';
    }).catch(() => {});
    return;
  }
  window.open(url, '_blank');
}

/** 渲染后续钩子（refresh 时调用）——三层出口 */
function renderHook(): void {
  const hookEl = panelEl?.querySelector('#gx-hook');
  if (!hookEl) return;
  hookEl.innerHTML = `
    <div style="font-size:13px;color:#C4CDE0;letter-spacing:2px;margin-bottom:6px;">这座岛的故事，还没有讲完。</div>
    <div style="font-size:11px;color:#8FA2C8;line-height:1.8;margin-bottom:14px;">夏雅《春深有信》· 更多居民的故事 · 灯塔亮起</div>
    <button data-action="store" style="font-size:12px;font-weight:bold;padding:8px 22px;background:rgba(24,28,38,0.9);border:1px solid rgba(216,196,154,0.45);border-radius:8px;color:#D8C49A;cursor:pointer;transition:transform 0.1s ease,filter 0.1s ease;margin-right:8px;">给青禾镇留下一封信</button>
    <button data-action="share" style="font-size:12px;font-weight:bold;padding:8px 22px;background:rgba(24,28,38,0.9);border:1px solid rgba(216,196,154,0.45);border-radius:8px;color:#D8C49A;cursor:pointer;transition:transform 0.1s ease,filter 0.1s ease;">分享给朋友</button>
    <div id="gx-hook-hint" style="display:none;margin-top:10px;font-size:11px;color:#8FA2C8;line-height:1.7;opacity:0;transition:opacity 0.3s ease;">青禾镇的消息，会送到愿意回来的人那里。在 TapTap 关注《归星物语》，就能第一时间知道岛上又发生了什么。</div>
  `;
}

/** 渲染单个段落 */
function renderSection(s: GuiXingSection, index: number): string {
  // 项目色板：星轨蓝 / 暖粉 / 青禾绿 / 旧纸黄 / 暮紫
  const borderColors = ['#7FB2E5', '#E8A0C8', '#7D9B6A', '#D8C49A', '#B89BD6'];
  const borderColor = borderColors[index % borderColors.length];

  const entriesHtml = s.entries.length > 0
    ? `<div style="margin-top:6px;font-size:12px;color:#8FA2C8;line-height:1.6;">${s.entries.map((e) => `· ${e}`).join('<br>')}</div>`
    : '';

  // 换行符转 <br>
  const narrativeHtml = s.narrative.replace(/\n/g, '<br>');

  return `
    <div style="border-left:3px solid ${borderColor};padding:12px 14px;margin-bottom:10px;background:rgba(255,255,255,0.04);border-radius:0 8px 8px 0;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:16px;">${s.icon}</span>
        <span style="font-size:14px;font-weight:bold;color:#F5EFDD;">${s.title}</span>
      </div>
      <div style="font-size:13px;color:#C4CDE0;line-height:1.6;white-space:pre-line;">${narrativeHtml}</div>
      ${entriesHtml}
    </div>
  `;
}

/** 刷新报告内容（归星记录五段展示） */
function refresh(): void {
  if (!panelEl) return;
  const record = generateGuiXingRecord();

  // 标题
  const headerEl = panelEl.querySelector('#gx-header');
  if (headerEl) {
    headerEl.innerHTML = `
      <div style="margin-bottom:12px;position:relative;">
        <img src="assets/portraits/linchen_ai_portrait.webp" alt="林澈"
          style="width:100%;max-height:180px;object-fit:cover;object-position:50% 15%;border-radius:10px;display:block;opacity:0.9;">
        <div style="position:absolute;inset:0;border-radius:10px;box-shadow:inset 0 0 0 1px rgba(216,196,154,0.4), inset 0 -30px 40px rgba(10,12,18,0.55);"></div>
      </div>
      <div style="font-size:11px;letter-spacing:4px;color:#D8C49A;margin-bottom:6px;">✦ 归星记录 ✦</div>
      <div style="font-size:19px;font-weight:bold;color:#F5EFDD;letter-spacing:2px;text-shadow:0 2px 10px rgba(0,0,0,0.6);">第一章：重新开始</div>
      <div style="width:56px;height:2px;background:linear-gradient(90deg,transparent,#7FB2E5,transparent);margin:8px auto 0;"></div>
      <div style="font-size:12px;color:#8FA2C8;margin-top:6px;">第 ${record.day} 天</div>
    `;
  }

  // 变化对比（仅在有显著变化时显示）
  const changeEl = panelEl.querySelector('#gx-change') as HTMLElement;
  if (changeEl && record.changeHighlight) {
    const ch = record.changeHighlight;
    changeEl.style.display = 'block';
    changeEl.innerHTML = `
      <div style="background:rgba(10,12,18,0.55);border:1px solid rgba(216,196,154,0.3);border-radius:10px;padding:12px 14px;text-align:center;">
        <div style="font-size:11px;letter-spacing:2px;color:#8FA2C8;margin-bottom:6px;">你做出的改变</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
          <span style="font-size:13px;color:#B8C4E0;">${ch.before}</span>
          <span style="font-size:16px;color:#7FB2E5;">→</span>
          <span style="font-size:13px;color:#F5EFDD;font-weight:bold;">${ch.after}</span>
        </div>
        <div style="font-size:12px;color:#8FA2C8;margin-top:6px;white-space:pre-line;">${ch.summary}</div>
      </div>
    `;
  } else if (changeEl) {
    changeEl.style.display = 'none';
  }

  // 五段内容
  const sectionsEl = panelEl.querySelector('#gx-sections');
  if (sectionsEl) {
    sectionsEl.innerHTML = record.sections
      .map((s, i) => renderSection(s, i))
      .join('');
  }

  // 极简数据脚注
  const statsEl = panelEl.querySelector('#gx-stats');
  if (statsEl) {
    const t = getTime();
    const crops = getItemCount('radish') + getItemCount('tomato') + getItemCount('corn') + getItemCount('strawberry');
    statsEl.innerHTML = `第 ${t.day} 天 · 农业 Lv.${getLevel()} · 收获 ${crops} 个 · ${itemIconHtml('diamond', 12)} ${getItemCount('diamond')}`;
  }

  // Demo 结尾「后续钩子」（指标 3：观星夜后玩家主动询问后续）
  renderHook();
}

export class EndingPanel {
  constructor(onCloseCb?: () => void) {
    if (onCloseCb) onClose = onCloseCb;
    if (!domCreated) createDom();
  }

  /** 打开归星记录 */
  open(): void {
    open = true;
    if (panelEl) {
      refresh();
      panelEl.style.display = 'flex';
    }
  }

  /** 关闭归星记录 */
  close(): void {
    closePanel();
  }

  /** 归星记录是否打开 */
  isOpen(): boolean {
    return open;
  }
}
