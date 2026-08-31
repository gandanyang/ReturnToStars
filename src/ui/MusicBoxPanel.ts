/**
 * 家的音乐盒面板（P1 OST 收藏系统 · v0.11 · 轻量 DOM 覆盖层）
 *
 * - 老屋音乐盒交互 → 打开曲目列表（"收藏唱片"感：中文名 + 英文名 + 一句话描述）
 * - 点击曲目立即切换播放（MusicSystem.play），关闭面板音乐继续
 * - 「停止播放」→ 回调 MapScene 恢复该场景日常 BGM
 * - 复用 panelFadeIn/panelFadeOut；Esc / 关闭按钮 / 点空白关闭
 *
 * 数据源：src/audio/MusicSystem.ts 的 MUSIC_CATALOG（仅收录已接入曲目）
 */

import { MUSIC_CATALOG, MusicSystem, type MusicTrackMeta } from '../audio/MusicSystem';
import { panelFadeIn, panelFadeOut } from './dom-anim';

// ===== 模块级单例 =====
let panelEl: HTMLDivElement | null = null;
let domCreated = false;
let open = false;
let onStopCb: (() => void) | null = null;
let subscribed = false;

/** 关闭面板 */
function closePanel(): void {
  if (!open) return;
  open = false;
  if (panelEl) panelFadeOut(panelEl, 150);
}

/** 简易 HTML 转义（与相簿/需求板面板一致，防文案破坏结构） */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 创建 DOM（只创建一次） */
function createDom(): void {
  if (domCreated) return;
  if (document.getElementById('music-box-panel')) {
    domCreated = true;
    return;
  }
  domCreated = true;

  panelEl = document.createElement('div');
  panelEl.id = 'music-box-panel';
  panelEl.style.cssText =
    'position:fixed;top:0;right:0;bottom:0;left:0;display:none;align-items:center;justify-content:center;' +
    'background:rgba(5,8,28,0.82);z-index:220;user-select:none;-webkit-user-select:none;';

  panelEl.innerHTML = `
    <div style="width:min(430px,94vw);max-height:86vh;background:rgba(24,20,40,0.97);border:2px solid #8a6a45;border-radius:12px;padding:16px;color:#f0e8dc;font-family:Arial;box-shadow:0 4px 30px rgba(0,0,0,0.6);display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;flex-shrink:0;">
        <span style="font-size:14px;letter-spacing:2px;color:#e8c070;">🎵 家的音乐盒</span>
        <button data-action="close" style="width:30px;height:30px;border-radius:50%;background:#4a3d28;border:none;color:#e8c070;font-size:16px;cursor:pointer;line-height:1;">×</button>
      </div>
      <div style="font-size:12px;color:#a8987c;margin-bottom:14px;flex-shrink:0;">爷爷留下的音乐盒，装着这座岛的旋律。选一首，坐下来慢慢听。</div>
      <div id="mb-list" style="overflow-y:auto;flex:1;min-height:0;display:flex;flex-direction:column;gap:10px;padding-right:2px;"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;flex-shrink:0;">
        <span style="font-size:11px;color:#8a7a5c;">森林 · 矿洞的新旋律，会在声音补全后收录进来。</span>
        <button data-action="stop" style="padding:6px 14px;border-radius:6px;border:1px solid #6a5a3c;background:#3d3226;color:#c8b898;font-size:12px;cursor:pointer;">⏹ 停止播放</button>
      </div>
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
  // Esc 关闭
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      closePanel();
    }
  });
  // 事件委托：曲目播放 + 停止
  panelEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-action="play"]') as HTMLElement | null;
    if (btn) {
      e.stopPropagation();
      const key = btn.getAttribute('data-key');
      if (!key) return;
      // v0.11（P0.5）：选曲即设为"我的歌"（本次游玩有效），此后切图/剧情恢复都回到这首
      MusicSystem.setMusicBoxTrack(key);
      void MusicSystem.play(key);
      refresh();
      return;
    }
    const stopBtn = (e.target as HTMLElement).closest('[data-action="stop"]') as HTMLElement | null;
    if (stopBtn) {
      e.stopPropagation();
      onStopCb?.();
      refresh();
    }
  });
}

/** 单张曲目卡片 */
function renderTrack(t: MusicTrackMeta): string {
  const playing = MusicSystem.current() === t.key;
  const border = playing ? '2px solid #e8c070' : '1px solid #4a3d28';
  const badge = playing
    ? '<span style="color:#e8c070;font-size:11px;">♪ 正在播放</span>'
    : '<span style="color:#7a6a4c;font-size:11px;">▶</span>';
  return `
    <div data-action="play" data-key="${t.key}" style="cursor:pointer;background:rgba(255,255,255,0.04);border:${border};border-radius:10px;padding:11px 14px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:15px;font-weight:bold;color:${playing ? '#f0d488' : '#efe4d0'};">🎵 ${escapeHtml(t.title)}</div>
        <div style="font-size:12px;font-style:italic;color:#a8987c;">${escapeHtml(t.en)}</div>
        <div style="font-size:11px;color:#8a7a5c;margin-top:2px;">「${escapeHtml(t.desc)}」</div>
      </div>
      ${badge}
    </div>
  `;
}

/** 刷新面板内容（打开/切歌时调用） */
function refresh(): void {
  if (!panelEl) return;
  const list = panelEl.querySelector('#mb-list');
  if (list) {
    list.innerHTML = MUSIC_CATALOG.map(renderTrack).join('');
  }
}

export class MusicBoxPanel {
  constructor(onStop?: () => void) {
    if (onStop) onStopCb = onStop;
    if (!domCreated) createDom();
    // 播放状态变更（解码完成后）实时刷新「正在播放」徽标
    if (!subscribed) {
      subscribed = true;
      MusicSystem.onPlaybackChange(() => { if (open) refresh(); });
    }
  }

  /** 打开音乐盒 */
  open(): void {
    open = true;
    if (panelEl) {
      refresh();
      panelFadeIn(panelEl, 180);
    }
  }

  /** 关闭 */
  close(): void {
    closePanel();
  }

  /** 是否打开 */
  isOpen(): boolean {
    return open;
  }
}
