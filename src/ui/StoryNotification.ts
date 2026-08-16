/**
 * StoryNotification — 重要事件记忆卡（反馈层级 L3 / L4）
 *
 * 定位：世界主动告诉玩家"重要事件发生了"（主线目标 / 心语任务 / 复兴事件）。
 * 与 QuestPanel（玩家主动查看任务）、MemoryMoment（L2 事件反馈）职责不同，独立新建、不污染。
 *
 * 视觉（制作人 2026-08-15 拍板）：旧纸张 + 星光 + 呼吸感，克制。
 *   节奏：淡入 → 标题慢慢出现 → 背景星尘漂浮 → 停留 → 淡出。
 *   感觉："记忆被翻开了一页。" 不是 "恭喜完成任务！"
 *   不做：金色粗边框 / 大量粒子 / 类原神任务完成。
 *
 * 接口：
 *   showStart(title, subtitle?)      —— 重要事件开始
 *   showComplete(title, subtitle?)   —— 重要事件完成
 *   showChapter(title, subtitle?)    —— 章节节点（L4，全屏感更强）
 *   hide()                           —— 场景切换/演出互斥时强制隐藏
 *
 * 不变式：
 *   - 单例 DOM（全屏一个卡片容器，幂等创建）
 *   - 不冻结玩家操作（pointer-events:none）
 *   - 同事件只弹一次由调用侧事件标记保证（本组件自身不判重）
 */

interface StoryCardOpts {
  /** 是否章节级（L4，更强底色/更久停留） */
  chapter?: boolean;
}

/** 单个卡片运行时状态（用于清理） */
let cardEl: HTMLDivElement | null = null;
let titleEl: HTMLDivElement | null = null;
let subEl: HTMLDivElement | null = null;
let dustEl: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let dustTimer: ReturnType<typeof setInterval> | null = null;
/** 副标题当前是否可见（hide 恢复用） */
let subVisible = false;

const Z_INDEX = 330; // 高于 MemoryMoment(300) 与普通浮层；低于 rotate-hint(9999)

/** 幂等创建卡片 DOM（每次显示复用同一个，避免频繁创建/销毁） */
function ensureDom(): void {
  if (cardEl) return;

  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:fixed;top:0;right:0;bottom:0;left:0;display:none;' +
    'align-items:center;justify-content:center;' +
    `z-index:${Z_INDEX};pointer-events:none;user-select:none;-webkit-user-select:none;`;

  // 旧纸质感卡（暖米棕 + 细木边 + 微微泛旧的底色）
  const card = document.createElement('div');
  card.style.cssText =
    'position:relative;max-width:min(360px,80vw);text-align:center;' +
    'background:linear-gradient(165deg,#efdfc2 0%,#e6d2ae 55%,#d8c093 100%);' +
    'border:1px solid rgba(120,90,50,0.5);border-radius:10px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,0.35), inset 0 0 30px rgba(120,90,40,0.18);' +
    'padding:22px 30px 20px;color:#4a3722;' +
    'transform:translateY(12px);opacity:0;' +
    'transition:transform 0.5s ease,opacity 0.5s ease;';

  // 顶部小点缀（一行细星，营造"星辰记忆"）
  const starLine = document.createElement('div');
  starLine.style.cssText = 'font-size:14px;color:#8a6a2a;letter-spacing:8px;opacity:0.85;margin-bottom:8px;';
  starLine.textContent = '✦  ✧  ✦';

  // 标题（主事件名）
  titleEl = document.createElement('div');
  titleEl.style.cssText =
    'font-size:22px;font-weight:bold;letter-spacing:2px;color:#3f2d16;' +
    'opacity:0;transform:translateY(6px);transition:opacity 0.7s ease,transform 0.7s ease;';

  // 副标题（"你改变了什么"）
  subEl = document.createElement('div');
  subEl.style.cssText =
    'margin-top:8px;font-size:13px;line-height:1.7;color:#6b4f2c;' +
    'opacity:0;transition:opacity 0.9s ease;';

  // 星尘漂浮层（CSS 动画营造"记忆被翻开"的氛围；极轻，克制）
  dustEl = document.createElement('div');
  dustEl.style.cssText =
    'position:absolute;inset:0;pointer-events:none;overflow:hidden;' +
    'background-image:radial-gradient(1.5px 1.5px at 20% 30%,rgba(255,236,180,0.6) 50%,transparent 50%),' +
    'radial-gradient(1px 1px at 70% 60%,rgba(255,230,200,0.5) 50%,transparent 50%),' +
    'radial-gradient(1.5px 1.5px at 40% 75%,rgba(255,236,190,0.4) 50%,transparent 50%),' +
    'radial-gradient(1px 1px at 85% 20%,rgba(255,240,210,0.45) 50%,transparent 50%),' +
    'radial-gradient(1px 1px at 55% 15%,rgba(255,230,170,0.35) 50%,transparent 50%);' +
    'opacity:0;transition:opacity 1s ease;';

  card.appendChild(starLine);
  card.appendChild(titleEl!);
  card.appendChild(subEl!);
  card.appendChild(dustEl);
  // 卡片本体再加一个柔光图层（呼吸）
  const breath = document.createElement('div');
  breath.style.cssText =
    'position:absolute;inset:0;border-radius:10px;pointer-events:none;' +
    'box-shadow:0 0 0 rgba(255,230,170,0);transition:box-shadow 1.6s ease;';
  card.appendChild(breath);

  wrap.appendChild(card);
  document.body.appendChild(wrap);

  cardEl = wrap;
  // 触碰不可交互（不影响玩家操作）
  cardEl.addEventListener('pointerdown', (e) => e.stopPropagation());
}

/** 清理上一个卡片的定时器与动效状态 */
function clearState(): void {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  if (dustTimer) { clearInterval(dustTimer); dustTimer = null; }
}

function buildDustTween(): void {
  if (!dustEl) return;
  // 星尘缓慢上下漂浮（呼吸感），不做大位移、不刺眼
  let frames = 0;
  dustTimer = setInterval(() => {
    frames++;
    const dy = Math.sin(frames / 12) * 3;
    if (dustEl) dustEl.style.transform = `translateY(${dy.toFixed(1)}px)`;
    if (frames > 160) { // ~ 8 秒封顶，避免残留
      if (dustTimer) { clearInterval(dustTimer); dustTimer = null; }
    }
  }, 100);
}

/**
 * 显示一张重要事件记忆卡。
 * @param opts.chapter true = L4 章节卡（底色更深、停留更久）
 */
export function showStoryCard(title: string, subtitle?: string, opts: StoryCardOpts = {}): void {
  ensureDom();
  if (!cardEl || !titleEl || !subEl || !dustEl) return;
  clearState();

  titleEl.textContent = title;
  subEl.textContent = subtitle ?? '';
  subEl.style.display = subtitle ? 'block' : 'none';
  subVisible = !!subtitle;

  const holdMs = opts.chapter ? 3200 : 2200; // 章节卡停留更久，普通重要事件 ~2.2s
  const isChapter = !!opts.chapter;

  // 章节卡底色更深——"翻开一章"
  cardEl.style.filter = '';
  const inner = cardEl.firstElementChild as HTMLDivElement | null;
  if (inner) {
    inner.style.background = isChapter
      ? 'linear-gradient(165deg,#e7d6b6 0%,#d9c49c 55%,#c8ad80 100%)'
      : 'linear-gradient(165deg,#efdfc2 0%,#e6d2ae 55%,#d8c093 100%)';
  }

  // 显示
  cardEl.style.display = 'flex';
  void cardEl.offsetHeight; // reflow 触发 transition
  if (inner) inner.style.transform = 'translateY(0)';
  if (inner) inner.style.opacity = '1';
  if (dustEl) {
    dustEl.style.opacity = '0.9';
    buildDustTween();
  }

  // 标题先淡入，稍后副标题再淡入——"记忆逐渐被翻开"
  setTimeout(() => { if (titleEl) { titleEl.style.opacity = '1'; titleEl.style.transform = 'translateY(0)'; } }, 250);
  setTimeout(() => { if (subEl) subEl.style.opacity = '1'; }, 650);

  // 停留后淡出
  hideTimer = setTimeout(() => {
    if (inner) { inner.style.transform = 'translateY(8px)'; inner.style.opacity = '0'; }
    if (dustEl) dustEl.style.opacity = '0';
    setTimeout(() => {
      if (cardEl) cardEl.style.display = 'none';
      clearState();
    }, 600);
  }, holdMs);
}

/** 友好别名：重要事件开始 */
export function showStoryStart(title: string, subtitle?: string): void {
  showStoryCard(title, subtitle);
}

/** 友好别名：重要事件完成 */
export function showStoryComplete(title: string, subtitle?: string): void {
  showStoryCard(title, subtitle);
}

/** 友好别名：章节节点（L4） */
export function showStoryChapter(title: string, subtitle?: string): void {
  showStoryCard(title, subtitle, { chapter: true });
}

/** 强制隐藏（场景切换 / 演出互斥时调用） */
export function hideStoryCard(): void {
  clearState();
  if (cardEl) cardEl.style.display = 'none';
  if (titleEl) titleEl.style.opacity = '0';
  if (subEl) {
    subEl.style.opacity = '0';
    subEl.style.display = subVisible ? 'block' : 'none';
  }
  if (dustEl) dustEl.style.opacity = '0';
}
