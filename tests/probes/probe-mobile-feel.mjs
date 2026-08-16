/**
 * P0-4 移动端手感专项验收（制作人拍板 2026-08-14）
 * 覆盖：小幅/大幅拖动 → 速度层次、斜向移动、连续转向、移动后交互、UI 不遮挡。
 * 横屏纪律：844×390 + Android UA（TestSystem §6.2）。
 */
import puppeteer from 'puppeteer-core';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 844, height: 390, isMobile: true, hasTouch: true },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, 'userAgent', {
    get: () => 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
    configurable: true,
  });
  Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5, configurable: true });
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
};

const save = {
  version: '0.5', savedAt: 'mobile-feel', timestamp: Date.now(),
  player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: {} },
  world: { day: 1, hour: 12, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
  chapter: 1, worldRestore: {}, gameState: { triggeredEvents: {} },
};

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(1500);
await page.evaluate(() => { try { localStorage.removeItem('return_star_save'); } catch (e) {} });
await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(1800);
await page.evaluate((s) => { try { localStorage.setItem('return_star_save', JSON.stringify(s)); } catch (e) {} }, save);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(2500);
await page.keyboard.press('Enter');
await sleep(600);
for (let i = 0; i < 30; i++) {
  await sleep(300);
  const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
  if (sc === 'farm') break;
}
await sleep(2500);

// 跳过残留对话（farm 开场/教程对话会阻塞 update 的 touchControls 调用）
for (let i = 0; i < 20; i++) {
  const open = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('farm');
    return !!(s?.storyDialogue && s.storyDialogue.isOpen && s.storyDialogue.isOpen());
  });
  if (!open) break;
  await page.keyboard.press('KeyE');
  await sleep(250);
}
await sleep(500);

// 摇杆 DOM 元素
const joy = await page.evaluate(() => {
  const el = document.querySelector('.tc-joystick');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
});
console.log('joystick:', JSON.stringify(joy));
if (!joy) {
  console.log('❌ 摇杆未找到（非移动端？）');
  await browser.close();
  process.exit(1);
}

// 模拟拖动：touchstart → touchmove（距中心 offset）→ touchend
async function drag(offsetX, offsetY, holdMs = 400) {
  await page.evaluate(({ cx, cy, ox, oy }) => {
    const el = document.querySelector('.tc-joystick');
    const t0 = new Touch({ identifier: 1, target: el, clientX: cx + ox, clientY: cy + oy });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [t0], changedTouches: [t0], bubbles: true, cancelable: true }));
    window.__lastT = t0;
    // 诊断：startDrag 后立即读状态
    const s = window.__game.scene.getScene('farm');
    window.__diagStart = { mx: s.inputManager.moveX, my: s.inputManager.moveY, mag: s.inputManager.moveMagnitude };
  }, { cx: joy.x, cy: joy.y, ox: offsetX, oy: offsetY });
  await sleep(80);
  await page.evaluate(({ cx, cy, ox, oy }) => {
    const el = document.querySelector('.tc-joystick');
    const t = new Touch({ identifier: 1, target: el, clientX: cx + ox, clientY: cy + oy });
    el.dispatchEvent(new TouchEvent('touchmove', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
    const s = window.__game.scene.getScene('farm');
    window.__diagMove = { mx: s.inputManager.moveX, my: s.inputManager.moveY, mag: s.inputManager.moveMagnitude };
  }, { cx: joy.x, cy: joy.y, ox: offsetX, oy: offsetY });
  await sleep(holdMs);
  const state = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    const im = s.inputManager;
    return { mag: im.moveMagnitude, mx: im.moveX, my: im.moveY, vx: Math.round(s.player.currentVx), vy: Math.round(s.player.currentVy), facing: s.player.facing, diagStart: window.__diagStart, diagMove: window.__diagMove };
  });
  // 结束拖动
  await page.evaluate(() => {
    const el = document.querySelector('.tc-joystick');
    const t = window.__lastT;
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], bubbles: true, cancelable: true }));
  });
  return state;
}

// 1. 小幅拖动（20px）→ 低幅度
const low = await drag(20, 0, 100);
console.log('low drag(100ms):', JSON.stringify(low));
check('小幅拖动 → 低幅度（<0.5）', low.mag < 0.5, `mag=${low.mag}`);
check('小幅拖动 → 低速移动', Math.abs(low.vx) < 100, `vx=${low.vx}`);
check('小幅拖动方向向右', low.mx === 1, `mx=${low.mx}`);
await sleep(300);

// 2. 大幅拖动（55px，接近摇杆半径）→ 高幅度
const high = await drag(55, 0);
console.log('high drag:', JSON.stringify(high));
check('大幅拖动 → 高幅度（>0.8）', high.mag > 0.8, `mag=${high.mag}`);
check('大幅拖动 → 快速移动', Math.abs(high.vx) > 150, `vx=${high.vx}`);
await sleep(300);

// 3. 斜向移动（右 + 下）
const diag = await drag(40, 30);
console.log('diag drag:', JSON.stringify(diag));
check('斜向拖动 → x/y 均有速度', Math.abs(diag.vx) > 50 && Math.abs(diag.vy) > 50, `vx=${diag.vx} vy=${diag.vy}`);
await sleep(300);

// 4. 连续转向（右 → 上）
const turn1 = await drag(40, 0, 200);
const turn2 = await drag(0, -40, 200);
console.log('turn:', JSON.stringify(turn1), '→', JSON.stringify(turn2));
check('连续转向 → 朝向变化 right→up', turn1.facing === 'right' && turn2.facing === 'up', `f=${turn1.facing}→${turn2.facing}`);
await sleep(300);

// 5. 松手减速（拖动后 touchend → 速度归零平滑）
const decel = await page.evaluate(() => {
  const s = window.__game.scene.getScene('farm');
  const im = s.inputManager;
  return { mag: im.moveMagnitude, mx: im.moveX, vx: Math.round(s.player.currentVx) };
});
check('松手 → 方向归零', decel.mx === 0 && decel.mag === 0, `mx=${decel.mx} mag=${decel.mag}`);
check('松手 → 速度趋零（平滑减速）', Math.abs(decel.vx) < 60, `vx=${decel.vx}`);
await sleep(500);
const decel2 = await page.evaluate(() => Math.round(window.__game.scene.getScene('farm').player.currentVx));
check('减速收敛（后续帧趋零）', Math.abs(decel2) < 20, `vx=${decel2}`);

// 6. 移动后立即交互（按交互按钮）
const interactOk = await page.evaluate(() => {
  const btn = document.querySelector('[data-action="interact"]');
  return !!btn;
});
check('移动端交互按钮存在', interactOk === true);

// 7. 摇杆/按钮不遮挡关键 UI（移动端 FIT 后画布满宽无黑边，摇杆放画面左下角为手游惯例；
//    检查摇杆不与 HUD 时间条/按钮区重叠）
const layout = await page.evaluate(() => {
  const joyR = document.querySelector('.tc-joystick')?.getBoundingClientRect();
  const btnR = document.querySelector('[data-action="interact"]')?.getBoundingClientRect();
  const half = innerWidth * 0.5;
  return {
    joyLeft: joyR ? Math.round(joyR.left) : null,
    joyRight: joyR ? Math.round(joyR.right) : null,
    joyTop: joyR ? Math.round(joyR.top) : null,
    btnLeft: btnR ? Math.round(btnR.left) : null,
    btnRight: btnR ? Math.round(btnR.right) : null,
    innerW: innerWidth,
    half,
  };
});
// 摇杆在左半屏（不压中央/右侧交互区）+ 不与右侧交互按钮重叠
check('摇杆在左半屏（不遮挡中央/右侧）', layout.joyLeft !== null && layout.joyRight < layout.half, JSON.stringify(layout));
check('交互按钮在右半屏（不与摇杆重叠）', layout.btnLeft !== null && layout.btnLeft > layout.half, JSON.stringify(layout));

console.log(`\n=== P0-4 移动手感专项: ${pass} 通过 / ${fail} 失败 ===`);
await browser.close();
process.exit(fail > 0 ? 1 : 0);
