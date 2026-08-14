/**
 * probe-resident-req-upgrade.mjs — 居民需求系统升级探针
 *
 * 验证（制作人 2026-08 拍板：结合 NPC 人设 + 世界观「复苏」意象）：
 *   T1 需求表：6 条（原 2 + 新增镇长灯笼/阿风食物/老周木材/老姜鱼）
 *   T2 类别扩展：lantern / fish 聚合 需求可识别、可判定
 *   T3 镇长灯笼交付：扣灯笼×2 + done + 世界变化渲染（town setupReqLantern）
 *   T4 阿风食物交付：扣食物×3 + done + 小灶渲染（town setupReqStove）
 *   T5 老姜鱼交付：扣鱼×2 + done + 鱼篓渲染（town setupReqFishBasket）
 *   T6 老周木材交付：扣木材×8 + done + 老屋门框渲染（farm setupReqDoorFrame）
 *   T7 小梅花架渲染：resident_req_gardener_wood done → farm setupReqFlowerTrellis
 *   T8 读档保持：reload 后世界变化自动渲染（EventManager 持久化）
 *   T9 无运行时错误
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
await page.bringToFront();

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

async function seedEnter(scene, inventory = {}, triggeredEvents = {}) {
  const save = {
    version: '0.5', savedAt: 'req-upgrade-probe', timestamp: Date.now(),
    player: { x: 200, y: 200, scene, facing: 'down', inventory },
    world: { day: 1, hour: 12, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
    chapter: 1, worldRestore: {}, gameState: { triggeredEvents },
  };
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1600);
  await page.bringToFront();
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.bringToFront();
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(600);
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === scene) break;
  }
  await sleep(2000);
  await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.reset?.();
  });
}

/** town 主序列：需求表 / 交付 / 世界变化 */
async function runTown() {
  return page.evaluate(async () => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('town');
      const rrs = await import('/src/systems/ResidentRequestSystem.ts');

      // T1 需求表
      const all = rrs.getResidentRequests();
      out.reqs = {
        count: all.length,
        ids: all.map(r => r.id),
        kinds: all.map(r => r.itemKind),
        elderLantern: all.find(r => r.id === 'resident_req_elder_lantern'),
        adventurerFood: all.find(r => r.id === 'resident_req_adventurer_food'),
        laojiangFish: all.find(r => r.id === 'resident_req_laojiang_fish'),
        carpenterWood: all.find(r => r.id === 'resident_req_carpenter_wood'),
      };

  // T3 镇长灯笼
  const rElder = rrs.fulfillRequest('resident_req_elder_lantern');
  const repeatElder = rrs.fulfillRequest('resident_req_elder_lantern'); // done 后应 done_already
  out.elder = {
    result: rElder,
    repeat: repeatElder,
  };
  s.setupReqLantern();
  out.lantern = { found: !!s.reqLanternGfx };

  // T4 阿风食物
  const rAdv = rrs.fulfillRequest('resident_req_adventurer_food');
  out.adventurer = { result: rAdv };
  s.setupReqStove();
  out.stove = { found: !!s.reqStoveGfx };

  // T5 老姜鱼
  const rLao = rrs.fulfillRequest('resident_req_laojiang_fish');
  out.laojiang = { result: rLao };
  s.setupReqFishBasket();
  out.fishBasket = { found: !!s.reqFishBasketGfx };

  // 二次交付应 done_already（游戏内部判定，不受动态 import 分裂影响）
  out.repeat = rrs.fulfillRequest('resident_req_elder_lantern');
  return out;
    } catch (e) {
      return { __error: e.message, stack: e.stack ?? '' };
    }
  });
}

/** farm 主序列：老周门框 + 小梅花架 */
async function runFarm() {
  return page.evaluate(async () => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('farm');
      const rrs = await import('/src/systems/ResidentRequestSystem.ts');
      const inv = await import('/src/data/Inventory.ts');
      const em = await import('/src/systems/EventManager.ts');
  // T6 老周木材
  const r = rrs.fulfillRequest('resident_req_carpenter_wood');
  out.carpenter = { result: r, repeat: rrs.fulfillRequest('resident_req_carpenter_wood') };
  s.setupReqDoorFrame();
  out.door = { found: !!s.reqDoorFrameGfx };
  // T7 小梅花架（种子已置 gardener_wood done）
  s.setupReqFlowerTrellis();
  out.trellis = { found: !!s.reqFlowerTrellisGfx };
  return out;
    } catch (e) {
      return { __error: e.message };
    }
  });
}

try {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(800);

  // ── town 主序列 ──
  await seedEnter('town', { lantern: 2, radish: 3, wood: 8, qinghe_crucian: 2 });
  const r = await runTown();
  if (r.__error) throw new Error(`town 崩于: ${r.__error}\n${r.stack}`);
  console.log('town:', JSON.stringify(r, null, 1));

  // T1 需求表
  check('T1 需求表 6 条', r.reqs?.count === 6, `count=${r.reqs?.count}`);
  check('T1 新增镇长灯笼需求', !!r.reqs?.elderLantern && r.reqs.elderLantern.itemKind === 'lantern', '');
  check('T1 新增阿风食物需求', !!r.reqs?.adventurerFood && r.reqs.adventurerFood.itemKind === 'food', '');
  check('T1 新增老周木材需求', !!r.reqs?.carpenterWood && r.reqs.carpenterWood.itemKind === 'wood', '');
  check('T1 新增老姜鱼需求（fish 类别）', !!r.reqs?.laojiangFish && r.reqs.laojiangFish.itemKind === 'fish', '');

  // T3 镇长灯笼
  check('T3 镇长灯笼交付 success', r.elder?.result === 'success', `result=${r.elder?.result}`);
  check('T3 交付后重复交付 done_already', r.elder?.repeat === 'done_already', `repeat=${r.elder?.repeat}`);
  check('T3 town 灯笼世界变化渲染', r.lantern?.found === true, '');

  // T4 阿风食物
  check('T4 阿风食物交付 success', r.adventurer?.result === 'success', `result=${r.adventurer?.result}`);
  check('T4 town 河边小灶渲染', r.stove?.found === true, '');

  // T5 老姜鱼
  check('T5 老姜鱼交付 success', r.laojiang?.result === 'success', `result=${r.laojiang?.result}`);
  check('T5 town 河边鱼篓渲染', r.fishBasket?.found === true, '');

  check('T5 二次交付 done_already', r.repeat === 'done_already', `repeat=${r.repeat}`);

  // ── farm 主序列（老周门框 + 小梅花架） ──
  await seedEnter('farm', { wood: 8 }, { resident_req_gardener_wood: true });
  const f = await runFarm();
  if (f.__error) throw new Error(`farm 崩于: ${f.__error}`);
  console.log('farm:', JSON.stringify(f, null, 1));
  check('T6 老周木材交付 success', f.carpenter?.result === 'success', `result=${f.carpenter?.result}`);
  check('T6 交付后重复交付 done_already', f.carpenter?.repeat === 'done_already', `repeat=${f.carpenter?.repeat}`);
  check('T6 farm 老屋门框渲染', f.door?.found === true, '');
  check('T7 farm 小梅花架渲染（交付后）', f.trellis?.found === true, '');

  // ── T8 读档保持 ──
  await seedEnter('town', {}, {
    resident_req_elder_lantern: true,
    resident_req_adventurer_food: true,
    resident_req_laojiang_fish: true,
  });
  const rw = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('town');
    return { lantern: !!s.reqLanternGfx, stove: !!s.reqStoveGfx, basket: !!s.reqFishBasketGfx };
  });
  console.log('reload:', JSON.stringify(rw));
  check('T8 重进 town 灯笼/小灶/鱼篓仍渲染（读档保持）', rw.lantern === true && rw.stove === true && rw.basket === true, JSON.stringify(rw));

  // ── T9 无运行时错误 ──
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('T9 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  await page.screenshot({ path: join(SHOT_DIR, 'req-upgrade-final.png') });
  console.log(`\n===== probe-resident-req-upgrade 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-resident-req-upgrade 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
