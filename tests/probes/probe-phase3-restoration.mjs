/**
 * probe-phase3-restoration.mjs — Phase 3 修复态 GameObjects 验证
 *
 * 验证青禾镇Phase3美术升级-拍板基线-v1.0.md §六 施工清单（路线 C：GameObject sprite）：
 *   - 未触发（无 ch1_elder_visit / marketSquare 未恢复）：仅 S6 长椅常驻
 *   - 触发白天（村长来访 + 集市恢复）：S1 路灯+光晕 / S2 招牌+窗灯+花坛 / S6 长椅 = 6
 *   - 触发夜晚（同上 + hour>=18）：S6 加路灯+光晕 = 8
 *   - 纹理全部加载、对象可见、位置在 town 范围内（无穿模/浮空）
 *   - 截图三档供制作人目测
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, 'test-screenshots');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}

/** 进入 town 场景（设存档 → reload）。
 * 注意：游戏实例在 reload 卸载时会自动保存当前档 → 直接 setItem 新档会被旧实例卸载时的
 * 自动保存覆盖。必须先 removeItem + reload 让旧实例完全卸载，再写新档 + reload。 */
async function enterTown(save) {
  // 1) 清空存档 + reload：让上一档的游戏实例完全卸载（其卸载前自动保存不会再覆盖新档）
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1600);
  // 2) 写入目标档 + reload → 读档进入
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(() => {
    if ('caches' in window) caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
  });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(600);
  for (let i = 0; i < 25; i++) {
    await sleep(300);
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === 'town') break;
  }
  await sleep(1500);
}

const baseSave = (patch) => ({
  version: '0.5', savedAt: 'phase3', timestamp: Date.now(),
  player: { x: 360, y: 440, scene: 'town', facing: 'up', inventory: {} },
  world: { day: 1, hour: patch.hour ?? 12, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'done' }, chapter: patch.chapter ?? 0,
  worldRestore: patch.worldRestore ?? {},
  gameState: { triggeredEvents: patch.triggeredEvents ?? {} },
});

await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(800);

// ========== 档 A：未触发（chapter 0，无事件无恢复），白天 ==========
await enterTown(baseSave({ chapter: 0 }));
const a = await page.evaluate(() => {
  const s = window.__game.scene.getScene('town');
  return {
    objs: (s?.phase3Objects ?? []).map(o => ({
      type: o.type, key: o.texture?.key ?? null, x: Math.round(o.x), y: Math.round(o.y), visible: o.visible,
    })),
    tex: {
      spr_lamp: s?.textures?.exists('spr_lamp'), spr_sign: s?.textures?.exists('spr_sign'),
      spr_bench: s?.textures?.exists('spr_bench'), spr_window: s?.textures?.exists('spr_window'),
      spr_flowerbed: s?.textures?.exists('spr_flowerbed'),
    },
  };
});
console.log('档A(未触发白天) objects:', JSON.stringify(a.objs, null, 1));
check('A: 未触发仅 S6 长椅常驻(1 个)', a.objs.length === 1, `实际 ${a.objs.length}`);
check('A: 对象是 bench 且可见', a.objs[0]?.key === 'spr_bench' && a.objs[0]?.visible === true, JSON.stringify(a.objs[0]));
check('A: 5 纹理全部加载', Object.values(a.tex).every(Boolean), JSON.stringify(a.tex));
await page.screenshot({ path: join(SHOT_DIR, 'phase3-01-notrigger-day.png') });
console.log('📸 phase3-01-notrigger-day.png');

// ========== 档 B：触发（村长来访 + 集市恢复），白天 ==========
await enterTown(baseSave({ chapter: 1, worldRestore: { marketSquare: true }, triggeredEvents: { ch1_elder_visit: true } }));
const b = await page.evaluate(() => {
  const s = window.__game.scene.getScene('town');
  return (s?.phase3Objects ?? []).map(o => ({
    type: o.type, key: o.texture?.key ?? null, x: Math.round(o.x), y: Math.round(o.y), visible: o.visible,
  }));
});
console.log('档B(触发白天) objects:', JSON.stringify(b, null, 1));
const bKeys = b.map(o => o.key).sort();
check('B: 触发后白天 6 个对象', b.length === 6, `实际 ${b.length}`);
check('B: S1 路灯+光晕 / S2 招牌+窗灯+花坛 / S6 长椅', JSON.stringify(bKeys) === JSON.stringify(['spr_bench', 'spr_lamp', 'spr_sign', 'spr_window', 'spr_flowerbed', null].sort()), `keys=${bKeys}`);
check('B: 全部可见', b.every(o => o.visible === true), JSON.stringify(b.filter(o => !o.visible)));
check('B: 位置均在 town 内(0-800, 0-560)', b.every(o => o.x > 0 && o.x < 800 && o.y > 0 && o.y < 560), JSON.stringify(b));
// 光晕 ellipse 无 texture key（type=ellipse），单独验证存在
check('B: 含 1 个光晕(ellipse)', b.some(o => o.type === 'Ellipse'), '无 ellipse');
await page.screenshot({ path: join(SHOT_DIR, 'phase3-02-trigger-day.png') });
console.log('📸 phase3-02-trigger-day.png');

// ========== 档 C：触发 + 夜晚（hour=20）==========
await enterTown(baseSave({ chapter: 1, hour: 20, worldRestore: { marketSquare: true }, triggeredEvents: { ch1_elder_visit: true } }));
const c = await page.evaluate(() => {
  const s = window.__game.scene.getScene('town');
  const raw = localStorage.getItem('return_star_save');
  const sv = raw ? JSON.parse(raw) : null;
  return {
    hudTime: s?.hudTimeDom?.textContent ?? 'none',
    saveHour: sv?.world?.hour,
    objs: (s?.phase3Objects ?? []).map(o => ({
      type: o.type, key: o.texture?.key ?? null, x: Math.round(o.x), y: Math.round(o.y), visible: o.visible,
    })),
  };
});
console.log('档C(触发夜晚) objects:', JSON.stringify(c, null, 1));
check('C: 触发后夜晚 8 个对象（S6 加灯）', c.objs.length === 8, `实际 ${c.objs.length}`);
check('C: 含 2 个光晕(ellipse)', c.objs.filter(o => o.type === 'Ellipse').length === 2, `实际 ${c.objs.filter(o => o.type === 'Ellipse').length}`);
await page.screenshot({ path: join(SHOT_DIR, 'phase3-03-trigger-night.png') });
console.log('📸 phase3-03-trigger-night.png');

await browser.close();
console.log(`\n===== probe-phase3-restoration 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
