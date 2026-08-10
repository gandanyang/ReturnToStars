/**
 * 章节 Banner（ChapterBanner）— 章节开场的叙事仪式组件
 *
 * 制作人 2026-08-10 拍板（推翻 DESIGN_DECISIONS L90「章节系统推迟 P2 Beta」）：
 *   - 大章节 = 仪式感（Chapter 0/1/2… 用作剧情阶段分隔符）
 *   - 小章节 = 节奏标记（1-1/1-2… 克制使用，本组件 API 预留，P0 不挂）
 *   - 视觉：画面渐暗 → 环境声保留 → 中央像素装饰框 → 字体依次出现 →
 *     停留 1.5~2 秒 → 淡出。不是现代 UI 弹窗，是「叙事标点」。
 *
 * 设计（对齐项目 UI 规范）：
 *   - 模块级单例（与其他面板一致），零新资源（纯 CSS + 字符装饰）
 *   - 色板复用 ui-theme.css：星轨蓝 #5B7FA6 / 旧纸黄 #D8C49A / 深夜灰 #242936
 *   - 动画复用 dom-anim panelFadeIn/panelFadeOut
 *   - 返回 Promise（播完 resolve），支持 cancel()（场景跳过按钮联动）
 *
 * 用法：
 *   import { showChapterBanner } from '../ui/ChapterBanner';
 *   await showChapterBanner({ chapter: 'CHAPTER 0', title: '归途', subtitle: '有些地方，离开很久，也还是会等你回来。' });
 */

import { panelFadeIn, panelFadeOut } from './dom-anim';

export interface ChapterBannerOptions {
  /** 章节号，如 'CHAPTER 0' / 'CHAPTER 1' */
  chapter: string;
  /** 章节名，如 '归途' / '回到归星岛' */
  title: string;
  /** 副句（引文），可选 */
  subtitle?: string;
  /** 停留时长 ms（默认 1800） */
  holdMs?: number;
  /** 装饰图标（默认 ✦） */
  icon?: string;
}

interface ChapterBannerState {
  el: HTMLDivElement;
  canceled: boolean;
}

let _instance: ChapterBannerState | null = null;

/** 取消当前 Banner（立即淡出；若未在播放则 no-op） */
export function cancelChapterBanner(): void {
  if (_instance) _instance.canceled = true;
}

/**
 * 展示章节 Banner，播放完毕后 resolve。
 * @returns Promise<void>（cancel() 或动画正常结束时 resolve）
 */
export function showChapterBanner(opts: ChapterBannerOptions): Promise<void> {
  // 若上一个 Banner 还在播，先取消再开新的（防重叠）
  if (_instance) _instance.canceled = true;

  return new Promise((resolve) => {
    const holdMs = opts.holdMs ?? 1800;
    const icon = opts.icon ?? '✦';
    const state: ChapterBannerState = { el: buildDom(opts, icon), canceled: false };
    _instance = state;
    document.body.appendChild(state.el);

    const done = (skipFade = false) => {
      if (_instance === state) _instance = null;
      const cleanup = () => {
        state.el.remove();
        resolve();
      };
      if (skipFade) { cleanup(); return; }
      panelFadeOut(state.el, 400).then(cleanup);
    };

    const run = async () => {
      try {
        // 1. 遮罩淡入（300ms）
        await panelFadeIn(state.el, 300);
        if (state.canceled) { done(true); return; }
        // 2. 框内元素依次淡入（chapter → title → 分隔线 → subtitle）
        const kids = Array.from(state.el.querySelectorAll<HTMLElement>('.cb-item'));
        for (const k of kids) {
          if (state.canceled) { done(true); return; }
          await panelFadeIn(k, 260);
        }
        if (state.canceled) { done(true); return; }
        // 3. 停留
        await sleep(holdMs);
        if (state.canceled) { done(true); return; }
        // 4. 淡出
        done();
      } catch {
        done(true);
      }
    };
    run();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildDom(opts: ChapterBannerOptions, icon: string): HTMLDivElement {
  const root = document.createElement('div');
  root.className = 'chapter-banner';
  Object.assign(root.style, {
    position: 'fixed', inset: '0', zIndex: '9998',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(10, 12, 18, 0.62)',
    opacity: '0',
    fontFamily: "'Noto Sans SC', 'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    userSelect: 'none', pointerEvents: 'auto', cursor: 'pointer',
  } as Partial<CSSStyleDeclaration>);

  // 中央像素装饰框（双层边框 = 像素感，字符 ✦ 角饰）
  const frame = document.createElement('div');
  frame.style.cssText = [
    'padding: 34px 64px 40px',
    'border: 2px solid #D8C49A',
    'outline: 1px solid rgba(216, 196, 154, 0.35)',
    'outlineOffset: 6px',
    'box-shadow: 0 0 0 2px rgba(10,12,18,0.9), 0 0 60px rgba(216,196,154,0.18)',
    'background: linear-gradient(180deg, rgba(36,41,54,0.92), rgba(24,28,38,0.94))',
    'text-align: center',
    'min-width: 420px',
    'max-width: 72vw',
  ].join(';');

  const chapterEl = el('div', {
    class: 'cb-item',
    color: '#7FB2E5',
    fontSize: '18px',
    letterSpacing: '6px',
    opacity: '0',
    marginBottom: '14px',
  });
  chapterEl.textContent = opts.chapter;

  const titleEl = el('div', {
    class: 'cb-item',
    color: '#F5EFDD',
    fontSize: '44px',
    fontWeight: '700',
    letterSpacing: '10px',
    opacity: '0',
    textShadow: '0 2px 12px rgba(0,0,0,0.6)',
  });
  titleEl.textContent = opts.title;

  const lineEl = el('div', {
    class: 'cb-item',
    color: '#D8C49A',
    fontSize: '16px',
    letterSpacing: '4px',
    opacity: '0',
    margin: '18px 0 16px',
  });
  lineEl.textContent = `─────── ${icon} ───────`;

  frame.appendChild(chapterEl);
  frame.appendChild(titleEl);
  frame.appendChild(lineEl);

  if (opts.subtitle) {
    const subEl = el('div', {
      class: 'cb-item',
      color: '#B9C4D0',
      fontSize: '16px',
      letterSpacing: '2px',
      opacity: '0',
      fontStyle: 'italic',
    });
    subEl.textContent = `「${opts.subtitle}」`;
    frame.appendChild(subEl);
  }

  root.appendChild(frame);
  // 点击可提前结束（保持"叙事标点"不打断手感——立即淡出）
  root.addEventListener('pointerdown', () => { cancelChapterBanner(); });
  return root;
}

function el(tag: string, style: Partial<CSSStyleDeclaration> & { class?: string }): HTMLElement {
  const node = document.createElement(tag);
  const { class: cls, ...rest } = style;
  if (cls) node.className = cls;
  Object.assign(node.style, rest);
  return node;
}
