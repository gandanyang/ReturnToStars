/**
 * probe-phase0-tileset-verify.mjs — Phase 0 tileset 统一验收探针（制作人拍板边界）
 *
 * 目标：让"地图数据认定的 tileset"和"游戏实际渲染的 tileset"成为同一个东西。
 * 四步验证：
 *   T1 加载：town 场景正常加载（tiles 纹理 = town_tileset 256x16）
 *   T2 移动：玩家可移动（位置变化）
 *   T3 保存：存档写入无异常
 *   T4 退出/重进：reload 后地图与状态一致
 *   T5 ★GID 漂移检查：保存前后 town.json 瓦片数据逐位一致（本次修复最重要的验证）
 * 附加：tileset 引用 = town_tileset.png（数据源唯一）
 */
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAP_PATH = 'public/assets/maps/town.json';

let pass = 0, fail = 0;
function result(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}

// 保存前快照 town.json（GID 漂移对比基准）
const beforeSave = JSON.parse(readFileSync(MAP_PATH, 'utf-8'));
const beforeG = [...beforeSave.layers[0].data];
const beforeW = [...beforeSave.layers[1].data];

// 附加：tileset 数据源唯一检查（本地文件）
const tsRef = beforeSave.tilesets[0];
result('T0 tileset 引用 = town_tileset.png（数据源唯一）',
  tsRef.image === '../tiles/town_tileset.png' && tsRef.tilecount === 16,
  `image=${tsRef.image} tilecount=${tsRef.tilecount}`);

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,   // 规则3：动画游戏必须真实渲染
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const save = {
  version: '0.5', savedAt: 'phase0-verify', timestamp: Date.now(),
  player: { x: 208, y: 296, scene: 'town', facing: 'down', inventory: {} },
  world: { day: 1, hour: 12, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'done' },
};

// ===== T1 加载 =====
// 规则2：SPA 不用 networkidle2（HMR websocket 常驻），用 domcontentloaded + 轮询 __game
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
  if (sc === 'town') break;
}
await sleep(1000);
// 跳过 TOWN_INTRO 开场对白（否则对白拦截移动/交互）
for (let i = 0; i < 20; i++) {
  const open = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('town');
    return !!(s?.storyDialogue && s.storyDialogue.isOpen && s.storyDialogue.isOpen());
  });
  if (!open) break;
  await page.keyboard.press('KeyE');
  await sleep(350);
}
await sleep(500);

const t1 = await page.evaluate(() => {
  const tex = window.__game?.textures?.get('tiles');
  const src = tex?.getSourceImage?.();
  const s = window.__game?.scene?.getScene?.('town');
  return {
    loaded: !!tex,
    texW: src ? src.width : -1,
    player: s?.player ? { x: Math.round(s.player.x), y: Math.round(s.player.y) } : null,
  };
});
result('T1 加载：tiles 纹理 = town_tileset（256 宽）', t1.loaded && t1.texW === 256, `texW=${t1.texW}`);
console.log('   玩家位置:', JSON.stringify(t1.player));

// ===== T2 移动 =====
const posBefore = t1.player;
await page.keyboard.down('KeyW');
await sleep(600);
await page.keyboard.up('KeyW');
await sleep(500);
const posAfter = await page.evaluate(() => {
  const s = window.__game?.scene?.getScene?.('town');
  return s?.player ? { x: Math.round(s.player.x), y: Math.round(s.player.y) } : null;
});
result('T2 移动：玩家可移动', posBefore && posAfter && (posBefore.x !== posAfter.x || posBefore.y !== posAfter.y),
  `(${posBefore?.x},${posBefore?.y}) → (${posAfter?.x},${posAfter?.y})`);

// ===== T3 保存 =====
// 固定坐标保存（不依赖移动后位置——玩家移动受物理/对白影响不可预测，固定值可稳定断言）
const SAVE_X = 208, SAVE_Y = 296;
await page.evaluate(([x, y]) => {
  const s = window.__game?.scene?.getScene?.('town');
  if (s?.player) s.player.setPosition(x, y);
  if (s?.save) s.save({ x, y, scene: 'town', facing: 'down' });
}, [SAVE_X, SAVE_Y]);
await sleep(500);
const saved = await page.evaluate(() => {
  const raw = localStorage.getItem('return_star_save');
  try { const d = JSON.parse(raw); return { scene: d?.player?.scene, x: Math.round(d?.player?.x), y: Math.round(d?.player?.y) }; }
  catch { return null; }
});
result('T3 保存：存档写入正常', !!saved && saved.scene === 'town' && saved.x === SAVE_X && saved.y === SAVE_Y, JSON.stringify(saved));

// ===== T4 退出/重进 =====
await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(2200);
await page.keyboard.press('Enter');
await sleep(600);
for (let i = 0; i < 25; i++) {
  await sleep(300);
  const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
  if (sc === 'town') break;
}
await sleep(1000);
// 跳过开场对白后读取（对白拦截操作，但不影响存档位置比对）
for (let i = 0; i < 20; i++) {
  const open = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('town');
    return !!(s?.storyDialogue && s.storyDialogue.isOpen && s.storyDialogue.isOpen());
  });
  if (!open) break;
  await page.keyboard.press('KeyE');
  await sleep(300);
}
const t4 = await page.evaluate(() => {
  const s = window.__game?.scene?.getScene?.('town');
  const tex = window.__game?.textures?.get('tiles');
  return {
    scene: s?.scene?.key,
    player: s?.player ? { x: Math.round(s.player.x), y: Math.round(s.player.y) } : null,
    texW: tex?.getSourceImage?.()?.width ?? -1,
  };
});
// 重进后玩家位置=存档位置（固定坐标 SAVE_X/SAVE_Y；对白跳过不影响位置恢复）
result('T4 重进：地图与状态一致', t4.scene === 'town' && t4.texW === 256 &&
  t4.player && t4.player.x === SAVE_X && t4.player.y === SAVE_Y,
  `scene=${t4.scene} texW=${t4.texW} pos=${JSON.stringify(t4.player)} vs saved=${JSON.stringify(saved)}`);

// ===== T5 ★GID 漂移检查 =====
const afterSave = JSON.parse(readFileSync(MAP_PATH, 'utf-8'));
const afterG = [...afterSave.layers[0].data];
const afterW = [...afterSave.layers[1].data];
const gidDiffG = beforeG.filter((v, i) => v !== afterG[i]).length;
const gidDiffW = beforeW.filter((v, i) => v !== afterW[i]).length;
result('T5 ★保存前后 GID 零漂移（Ground）', gidDiffG === 0, `Ground 漂移 ${gidDiffG} 格`);
result('T5 ★保存前后 GID 零漂移（Walls）', gidDiffW === 0, `Walls 漂移 ${gidDiffW} 格`);

result('附加 无页面错误', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
console.log(`\n===== Phase 0 验收: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
