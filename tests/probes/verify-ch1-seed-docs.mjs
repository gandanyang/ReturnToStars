/**
 * verify-ch1-seed-docs.mjs — 验证《第一章手动测试指引》文档内 5 个种子档真实可用
 *
 * 断言目标（与 docs/reports/第一章手动测试指引-最快进入第一章-2026-08-12.md 逐字一致）：
 *   V1 种子① farm day2 清晨 → first_morning_response 触发（第一章开场演出）
 *   V2 种子② house → 4 个老屋整理交互点出现（houseTidy.length=4）
 *   V3 种子③ house 夜晚 → 村长来访触发（elderVisitSprite / ch1_elder_visit）
 *   V4 种子④ town 白天 → 集市恢复点出现（荒地+标记，未恢复）
 *   V5 种子⑤ town 夜晚 → 春日集演出触发（inSpringFairCutscene + FX>=6）
 *
 * 依赖：dev server (localhost:5173) + window.debug / window.__game
 * 视口：横屏 1024x768（项目红线）
 * 运行：node tests/probes/verify-ch1-seed-docs.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: false,
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0;
let fail = 0;
function result(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  <- ' + detail}`);
  ok ? pass++ : fail++;
}

// ============ 种子档（与文档逐字一致） ============
// 注意：SaveSystem.load 结构校验要求 farm 字段必须存在（SaveSystem.ts:233），
// 缺失 → 存档被忽略 → 走新游戏流程。所有种子档必须带 farm:{tiles:[],crops:[],trees:[]}。
const SEEDS = {
  V1: {
    version: '0.5',
    player: { x: 400, y: 300, scene: 'farm', facing: 'down', inventory: { wood: 40, stone: 30 } },
    world: { day: 2, hour: 7, minute: 0, coins: 300, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'done' },
    chapter: 1,
  },
  V2: {
    version: '0.5',
    player: { x: 160, y: 240, scene: 'house', facing: 'down', inventory: { wood: 40, stone: 30 } },
    world: { day: 2, hour: 10, minute: 0, coins: 300, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'done' },
    chapter: 1,
  },
  V3: {
    version: '0.5',
    player: { x: 160, y: 240, scene: 'house', facing: 'down', inventory: { wood: 40, stone: 30 } },
    world: { day: 2, hour: 21, minute: 0, coins: 300, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'done', ch1TownIntroDone: true },
    chapter: 1,
    mapFlags: { ch1ElderVisitDay: 1 },
    gameState: { triggeredEvents: { ch1_bed_done: true, ch1_lamp_done: true, ch1_desk_done: true, ch1_radio_done: true, ch1_house_tidy_done: true } },
  },
  V4: {
    version: '0.5',
    player: { x: 400, y: 300, scene: 'town', facing: 'down', inventory: { wood: 40, stone: 30 } },
    world: { day: 2, hour: 10, minute: 0, coins: 300, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'done', ch1TownIntroDone: true },
    chapter: 1,
    gameState: { triggeredEvents: { ch1_elder_visit: true } },
  },
  V5: {
    version: '0.5',
    player: { x: 400, y: 300, scene: 'town', facing: 'down', inventory: { wood: 40, stone: 30 } },
    world: { day: 2, hour: 21, minute: 0, coins: 300, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'done', ch1TownIntroDone: true },
    chapter: 1,
    worldRestore: { marketSquare: true },
    gameState: { triggeredEvents: { ch1_elder_visit: true } },
  },
};

/** 写入种子档 → 刷新 → 等待目标场景就绪 */
async function loadSeed(save, targetScene) {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(800);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2200);
  await page.keyboard.press('Enter'); // 标题画面开始
  await sleep(600);
  for (let i = 0; i < 25; i++) {
    await sleep(300);
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === targetScene) break;
  }
  await sleep(900);
}

// ============ V1 种子① farm 清晨 → first_morning_response ============
{
  await loadSeed(SEEDS.V1, 'farm');
  await sleep(3500); // 900ms delayedCall + 2600ms 对白延迟
  const st = await page.evaluate(() => ({
    triggered: window.debug.events.hasTriggered('first_morning_response'),
    scene: window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none',
  }));
  result('V1 种子① farm 清晨：first_morning_response 已触发', st.triggered, `triggered=${st.triggered} scene=${st.scene}`);
}

// ============ V2 种子② house → 4 整理点 ============
{
  await loadSeed(SEEDS.V2, 'house');
  await sleep(1200);
  const st = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('house');
    return { tidy: s?.houseTidy?.length ?? -1, marks: s?.houseTidy?.filter((t) => t.mark)?.length ?? -1 };
  });
  result('V2 种子② house：4 个整理交互点出现', st.tidy === 4 && st.marks === 4, `tidy=${st.tidy} marks=${st.marks}`);
}

// ============ V3 种子③ house 夜晚 → 村长来访 ============
{
  await loadSeed(SEEDS.V3, 'house');
  await sleep(2500); // 敲门 1.2s + 缓冲
  const st = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('house');
    return {
      sprite: !!s?.elderVisitSprite,
      triggered: window.debug.events.hasTriggered('ch1_elder_visit'),
    };
  });
  result('V3 种子③ house 夜晚：村长来访触发', st.sprite || st.triggered, `sprite=${st.sprite} triggered=${st.triggered}`);
}

// ============ V4 种子④ town 白天 → 集市恢复点 ============
{
  await loadSeed(SEEDS.V4, 'town');
  await sleep(1200);
  const st = await page.evaluate(() => {
    const g = window.__game?.scene?.getScene?.('town')?.marketSquareRestore;
    return { exists: !!g, restored: g ? g.restored : undefined, mark: g ? !!g.mark : false };
  });
  result('V4 种子④ town：集市恢复点出现（荒地+标记）', st.exists && !st.restored && st.mark, `exists=${st.exists} restored=${st.restored} mark=${st.mark}`);
}

// ============ V5 种子⑤ town 夜晚 → 春日集 ============
{
  await loadSeed(SEEDS.V5, 'town');
  await sleep(2200); // 1s delayedCall + 演出
  const st = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('town');
    return { cut: s?.inSpringFairCutscene, fx: s?.springFairFX?.length ?? -1 };
  });
  result('V5 种子⑤ town 夜晚：春日集演出触发（FX>=6）', !!st.cut && st.fx >= 6, `cut=${st.cut} fx=${st.fx}`);
}

await browser.close();
console.log(`\n===== verify-ch1-seed-docs 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
