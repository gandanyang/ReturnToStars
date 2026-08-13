/**
 * probe-ch1-experience-walkthrough.mjs — 第一章完整体验走查（观感优先，非断言）
 *
 * 目标（制作人 2026-08-13 拍板）：
 *   验证"一个第一次玩的人，从观星夜结束 → 回青禾镇 → 整理老屋 → 进小镇 → 看到复苏，
 *   到底有没有感觉"。探针证明"不坏"，本走查观察"有没有感觉"。
 *
 * 三个观察点：
 *   A. 观星夜 → 第一章切换：玩家感觉"新生活开始"还是"突然接任务"？
 *   B. 老屋整理 4 点节奏：床/灯/书桌/收音机是否有节奏问题（装修清单感？）
 *   C. 第一次进新 Town：看到"有人生活过、正在修回来"还是"新地图欢迎"？
 *
 * 输出：逐节点截图 + 观感数据（对白/画面/时间），不设断言（例外：崩溃/黑屏视为失败）。
 * 运行：node tests/probes/probe-ch1-experience-walkthrough.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOT = 'tests/probes/test-screenshots/exp-ch1';
const fs = await import('fs');
fs.mkdirSync(SHOT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'error') warns.push(m.text()); });
page.on('pageerror', (e) => warns.push('pageerror: ' + e.message));

let shotN = 0;
async function snap(label) {
  shotN++;
  const p = `${SHOT}/${String(shotN).padStart(2, '0')}-${label}.png`;
  await page.screenshot({ path: p });
  console.log(`📸 ${label}`);
}

/** 切场景（先 stop 当前，再 start 目标；走真实载入路径） */
async function gotoScene(key, spawn) {
  await page.evaluate(([k, sp]) => {
    const g = window.__game;
    const active = g.scene.getScenes(true)[0];
    if (active && active.scene.key !== k) g.scene.stop(active.scene.key);
    g.scene.start(k, sp ? { spawn: sp } : undefined);
  }, [key, spawn ?? null]);
  await sleep(2600);
}

/** 当前对白文本/场景/玩家位置 */
async function observe(label) {
  const info = await page.evaluate(() => {
    const scenes = window.__game?.scene?.getScenes(true) ?? [];
    const sc = scenes.find((x) => x.scene?.key !== 'title') ?? scenes[0];
    const s = sc?.scene?.key;
    const dlg = sc?.storyDialogue;
    const txt = dlg?.textEl?.textContent ?? '';
    const name = dlg?.nameEl?.textContent ?? '';
    const p = sc?.player;
    return {
      scene: s, dialog: txt.slice(0, 60), name,
      player: p ? { x: Math.round(p.x), y: Math.round(p.y) } : null,
      chapter: window.debug?.getChapter?.(),
    };
  });
  console.log(`[${label}] scene=${info.scene} chapter=${info.chapter} player=${JSON.stringify(info.player)}`);
  if (info.dialog) console.log(`  对白[${info.name}]: ${info.dialog}`);
  return info;
}

// ===== 种子存档：观星夜刚完成（chapter 即将切换），玩家在 farm =====
const save = {
  version: '0.5', savedAt: 'exp-ch1', timestamp: Date.now(),
  player: { x: 480, y: 300, scene: 'farm', facing: 'down', inventory: {} },
  world: { day: 1, hour: 7, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'done' },
  chapter: 0,
  gameState: { triggeredEvents: {} },
};

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(800);
await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(2200);
await page.keyboard.press('Enter');
await sleep(600);
for (let i = 0; i < 25; i++) {
  await sleep(300);
  const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
  if (sc === 'farm') break;
}
await sleep(1500);
console.log('\n========== 走查开始（玩家视角） ==========\n');

// ===== A. 观星夜 → 第一章切换 =====
console.log('--- 观察点 A：观星夜 → 第一章切换 ---');
// 模拟观星夜完成：推进 chapter 0→1（真实路径是观星夜演出结束时 setChapter(1)）
await page.evaluate(() => {
  window.debug.setChapter(1);
  window.debug.setTime(7, 0);
});
await sleep(300);
await observe('A1 chapter已切换');
await snap('a-chapter-switch');

// 观星夜结束后玩家从 farm 走到老屋（house）——走真实路径：进老屋
await gotoScene('house', { x: 160, y: 192 });
await observe('A2 进入老屋');
await snap('a-enter-house');
await sleep(800);

// ===== B. 老屋整理 4 点节奏 =====
console.log('\n--- 观察点 B：老屋整理 4 点节奏 ---');
const tidyPts = [
  { key: 'bed', x: 2.5 * 16, y: 2.5 * 16 },
  { key: 'lamp', x: 5.5 * 16, y: 3.5 * 16 },
  { key: 'desk', x: 13.5 * 16, y: 4.5 * 16 },
  { key: 'radio', x: 16.5 * 16, y: 54 },
];
for (let i = 0; i < tidyPts.length; i++) {
  const pt = tidyPts[i];
  const t0 = Date.now();
  await page.evaluate(([x, y]) => {
    const s = window.__game.scene.getScene('house');
    if (s?.player) { s.player.setPosition(x, y); s.player.facing = 'down'; }
  }, [pt.x, pt.y]);
  await sleep(250);
  await page.keyboard.press('KeyE');
  await sleep(700);
  const t1 = Date.now();
  const r = await page.evaluate(() => {
    const s = window.__game.scene.getScene('house');
    const dlg = s?.storyDialogue;
    return { txt: dlg?.textEl?.textContent ?? '', name: dlg?.nameEl?.textContent ?? '' };
  });
  console.log(`[B${i + 1}] ${pt.key} 反馈(${t1 - t0}ms): ${r.name ? '[' + r.name + '] ' : ''}${r.txt.slice(0, 40)}`);
  await snap(`b-tidy-${pt.key}`);
  await sleep(300);
}
await observe('B5 四件全部整理完');
await snap('b-tidy-complete');

// ===== C. 第一次进新 Town =====
console.log('\n--- 观察点 C：第一次进新 Town ---');
await gotoScene('town', { x: 208, y: 296 }); // farm→town 出生点
await observe('C1 首见 town（出生点横路）');
await snap('c-town-first-seen');
// 转身看北（老街+广场）
await page.evaluate(() => {
  const s = window.__game.scene.getScene('town');
  if (s?.player) { s.player.setPosition(208, 296); s.player.facing = 'up'; }
});
await sleep(1500);
await observe('C2 面向北（老街+集市广场）');
await snap('c-town-facing-north');
// 走到广场看
await page.evaluate(() => {
  const s = window.__game.scene.getScene('town');
  if (s?.player) { s.player.setPosition(408, 130); }
});
await sleep(1500);
await observe('C3 站在集市广场');
await snap('c-town-plaza');

console.log('\n========== 走查完成 ==========');
console.log('运行时错误:', warns.length === 0 ? '0 条 ✅' : warns.slice(0, 3).join(' | '));
await browser.close();
