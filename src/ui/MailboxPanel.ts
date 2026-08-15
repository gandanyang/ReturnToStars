/**
 * 邮箱面板（2026-08-15 制作人拍板）
 * 参照 GiftPanel 范式：模块级单例、DOM 只创建一次、open/close 切显隐。
 * 定位：邮箱不是消息中心——只读信，不做任务/奖励。
 * 视图：列表（未读高亮 + 已读归档可回看）→ 信件（信纸样式，未读点「收好」回列表）。
 * 首次打开走 showFirstMailLetter（爷爷首封，唯一演出），不走列表。
 */
import type { MailLetter } from '../data/MailLetters';

// ===== 模块级单例状态 =====
let panelEl: HTMLDivElement | null = null;
let domCreated = false;
let open = false;
let unreadList: MailLetter[] = [];
let readList: MailLetter[] = [];
let onRead: ((id: string) => void) | null = null;
let onClose: (() => void) | null = null;

function closePanel(): void {
  if (!open) return;
  open = false;
  if (panelEl) panelEl.style.display = 'none';
  const cb = onClose;
  onClose = null;
  cb?.();
}

function letterRowHtml(l: MailLetter, unread: boolean): string {
  return `
    <div data-mail-id="${l.id}" style="display:flex;align-items:center;gap:8px;padding:9px 12px;margin-bottom:6px;border-radius:8px;cursor:pointer;border:1px solid ${unread ? 'rgba(216,196,154,0.45)' : 'rgba(138,106,69,0.35)'};background:${unread ? 'rgba(216,196,154,0.10)' : 'rgba(255,255,255,0.03)'};">
      <span style="width:7px;height:7px;border-radius:50%;background:${unread ? '#ffd166' : 'rgba(255,255,255,0.18)'};flex:none;"></span>
      <span style="font-size:13px;color:${l.color};flex:none;">${l.sender}</span>
      <span style="font-size:13px;color:${unread ? '#F5EFDD' : '#9a8a70'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.title}</span>
    </div>`;
}

function renderList(): void {
  if (!panelEl) return;
  const paper = panelEl.querySelector('#mail-paper') as HTMLDivElement | null;
  if (!paper) return;
  let html = '';
  if (unreadList.length === 0 && readList.length === 0) {
    html = '<div style="padding:28px 12px;text-align:center;color:#8a7a60;font-size:13px;">信箱空着。等风把信吹来。</div>';
  } else {
    if (unreadList.length > 0) {
      html += '<div style="font-size:11px;letter-spacing:2px;color:#d8c49a;margin-bottom:6px;">未读</div>';
      for (const l of unreadList) html += letterRowHtml(l, true);
    }
    if (readList.length > 0) {
      html += '<div style="font-size:11px;letter-spacing:2px;color:#8a7a60;margin:12px 0 6px;">已读</div>';
      for (const l of readList) html += letterRowHtml(l, false);
    }
  }
  paper.innerHTML = html;
  paper.querySelectorAll<HTMLElement>('[data-mail-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.mailId as string;
      const letter = [...unreadList, ...readList].find((l) => l.id === id);
      if (letter) renderLetter(letter, false);
    });
  });
}

/** 信件视图：信纸样式；未读点「收好」→ onRead + 回列表；已读/首封点「返回」→ 关闭或回列表 */
function renderLetter(letter: MailLetter, fromFirst: boolean): void {
  if (!panelEl) return;
  const paper = panelEl.querySelector('#mail-paper') as HTMLDivElement | null;
  if (!paper) return;
  const alreadyRead = readList.some((l) => l.id === letter.id);
  paper.innerHTML = `
    <div style="background:#e8dcc8;color:#4a3a28;border-radius:8px;padding:16px 18px;font-size:13px;line-height:1.9;white-space:pre-line;box-shadow:inset 0 1px 3px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.25);border:1px solid #c8b898;">
      <div style="text-align:center;font-size:12px;letter-spacing:3px;color:#8a6a45;margin-bottom:10px;">${letter.title}</div>
      ${letter.text}
    </div>
    <div style="text-align:center;margin-top:14px;">
      <button data-action="mail-done" style="font-size:14px;font-weight:bold;padding:9px 28px;background-image:linear-gradient(180deg,rgba(140,168,124,0.95) 0%,rgba(86,114,72,0.96) 100%);border:1px solid rgba(216,196,154,0.55);border-radius:10px;color:#F5EFDD;cursor:pointer;box-shadow:inset 0 2px 3px rgba(255,255,255,0.18),inset 0 -3px 6px rgba(0,0,0,0.3);">${fromFirst ? '收好' : alreadyRead ? '返回' : '收好'}</button>
    </div>`;
  const btn = paper.querySelector('[data-action="mail-done"]') as HTMLElement | null;
  btn?.addEventListener('click', () => {
    if (fromFirst) {
      closePanel();
    } else if (!alreadyRead) {
      onRead?.(letter.id);
      renderList();
    } else {
      renderList();
    }
  });
}

function createDom(): void {
  if (domCreated) return;
  if (document.getElementById('mailbox-panel')) { domCreated = true; return; }
  domCreated = true;
  panelEl = document.createElement('div');
  panelEl.id = 'mailbox-panel';
  panelEl.style.cssText =
    'position:fixed;top:0;right:0;bottom:0;left:0;display:none;align-items:center;justify-content:center;' +
    'background:rgba(10,12,16,0.72);z-index:240;user-select:none;-webkit-user-select:none;';
  panelEl.innerHTML = `
    <div style="width:min(430px,94vw);max-height:92vh;overflow-y:auto;padding:18px 20px;color:#F5EFDD;font-family:'Noto Sans SC','Source Han Sans SC','PingFang SC','Microsoft YaHei',sans-serif;border:2px solid #8a6a45;outline:1px solid rgba(216,196,154,0.35);outline-offset:4px;border-radius:12px;background-image:linear-gradient(180deg,rgba(46,36,26,0.97) 0%,rgba(34,26,19,0.98) 100%);box-shadow:inset 0 2px 4px rgba(255,255,255,0.05),0 0 46px rgba(138,106,69,0.35);">
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:11px;letter-spacing:4px;color:#d8c49a;margin-bottom:4px;">邮箱 · 归星小屋</div>
        <div style="font-size:12px;color:#8a97b0;">老屋门口的木信箱。有信的时候，小旗会立起来。</div>
      </div>
      <div id="mail-paper" style="min-height:80px;"></div>
    </div>`;
  document.body.appendChild(panelEl);
  panelEl.addEventListener('click', (e) => {
    if ((e.target as HTMLElement) === panelEl) closePanel();
  });
}

/** 打开邮箱列表（未读在前，已读归档可回看） */
export function openMailbox(opts: { unread: MailLetter[]; read: MailLetter[]; onRead: (id: string) => void; onClose: () => void }): void {
  createDom();
  open = true;
  unreadList = opts.unread;
  readList = opts.read;
  onRead = opts.onRead;
  onClose = opts.onClose;
  if (panelEl) {
    renderList();
    panelEl.style.display = 'flex';
  }
}

/** 首次打开：爷爷首封信（唯一演出），收好后 onDone */
export function showFirstMailLetter(letter: MailLetter, onDone: () => void): void {
  createDom();
  open = true;
  unreadList = [];
  readList = [];
  onRead = null;
  onClose = () => onDone();
  if (panelEl) {
    renderLetter(letter, true);
    panelEl.style.display = 'flex';
  }
}

/** 关闭 */
export function closeMailbox(): void {
  closePanel();
}

/** 是否打开 */
export function isMailboxOpen(): boolean {
  return open;
}
