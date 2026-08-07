/**
 * 通用确认弹窗（一键出售防误触二次确认用）
 *
 * 与 AndroidBackHandler 退出确认框同风格；模块级单例、DOM 随用随建随销毁。
 * 仅做「确认 / 取消」二次确认，确认后执行回调。
 */

let el: HTMLDivElement | null = null;

/** 关闭并清理确认框 */
function closeConfirm(): void {
  if (el) {
    el.remove();
    el = null;
  }
}

/**
 * 弹出确认框
 * @param message 确认文案
 * @param onOk    确认后的回调
 */
export function showConfirmDialog(message: string, onOk: () => void): void {
  if (el) return; // 防重复弹出
  const d = document.createElement('div');
  el = d;
  Object.assign(d.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(10,12,20,0.6)',
    zIndex: '980',
    userSelect: 'none',
    pointerEvents: 'auto',
  });

  // UI 升级 v1.0：归星记录页形式（深夜灰纸页 × 旧纸黄描边 × 星点）
  const card =
    'width:min(300px,85vw);background:' +
    'radial-gradient(1px 1px at 25% 20%,rgba(216,196,154,0.5) 50%,transparent 51%),' +
    'radial-gradient(1px 1px at 75% 65%,rgba(216,196,154,0.35) 50%,transparent 51%),' +
    'repeating-linear-gradient(0deg,rgba(255,255,255,0.015) 0 2px,transparent 2px 4px),' +
    '#242936;' +
    'border:1px solid rgba(216,196,154,0.55);border-top:2px solid rgba(216,196,154,0.75);' +
    'border-radius:12px;padding:16px 16px 14px;color:#f0e8d8;' +
    "font-family:'Noto Sans SC','Source Han Sans SC','PingFang SC','Microsoft YaHei',sans-serif;" +
    'text-align:center;box-shadow:inset 0 2px 8px rgba(0,0,0,0.35),0 6px 24px rgba(0,0,0,0.55);';
  const seal =
    "font-size:12px;color:#d8c49a;letter-spacing:4px;margin-bottom:8px;" +
    "font-family:'Noto Serif SC','Source Han Serif SC','Songti SC','STSong','SimSun',serif;";
  const btnBase =
    'display:block;width:100%;margin-top:10px;padding:12px 0;font-size:16px;' +
    'border:1px solid rgba(216,196,154,0.35);border-radius:10px;cursor:pointer;color:#f5efdd;' +
    "font-family:'Noto Sans SC','Source Han Sans SC','PingFang SC','Microsoft YaHei',sans-serif;";

  d.innerHTML = `
    <div style="${card}">
      <div style="${seal}">✦ 归星记录 ✦</div>
      <div style="font-size:16px;font-weight:bold;margin-bottom:6px;">${message}</div>
      <button data-act="ok" style="${btnBase}background:linear-gradient(180deg,#7d9b6a,#5e7c50);border-color:rgba(216,196,154,0.5);">确认</button>
      <button data-act="cancel" style="${btnBase}background:rgba(52,58,72,0.9);">取消</button>
    </div>`;
  document.body.appendChild(d);

  // 触屏：pointerup 主处理，click 兜底去重（同 AndroidBackHandler / TitleScene 按钮模式）
  let pointerHandled = false;
  const doAction = (act: string | undefined): void => {
    if (act === 'ok') {
      closeConfirm();
      onOk();
    } else {
      closeConfirm(); // cancel / 空白遮罩 → 取消
    }
  };
  d.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
  });
  d.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    e.preventDefault();
    pointerHandled = true;
    const btn = (e.target as HTMLElement).closest?.('button[data-act]') as HTMLElement | null;
    doAction(btn?.dataset.act);
  });
  d.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (pointerHandled) { pointerHandled = false; return; }
    const btn = (e.target as HTMLElement).closest?.('button[data-act]') as HTMLElement | null;
    doAction(btn?.dataset.act);
  });
}
