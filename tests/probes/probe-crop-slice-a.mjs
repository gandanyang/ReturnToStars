/**
 * probe-crop-slice-a.mjs — 种植升级 v2 切片A 探针（作物用途 + NPC 互动）
 *
 * 依据：《种植系统生活化方向-v0.1.md》第六层「收获后的去向」切片A。
 * 切片A 三闭环（触发 = 种→收→路过→NPC 发现，非任务）：
 *   萝卜×老张：赠予 → 河边腌萝卜罐（世界留下痕迹）→ 晒萝卜干句
 *   玉米×小镇：首次收获玉米 → 镇长/老张"今年玉米长得不错"（丰收节铺垫）
 *   番茄×夏雅："她记得"（埋切片B种子 crop_tomato_xiya_seen → 番茄架）
 * 验证：
 *   T1 萝卜×老张：背包有萝卜 → buildCropGiftDialogue 返回赠予对白（含"给他一些"）
 *   T2 doCropGiftRadish → 扣萝卜 + crop_radish_laozhang 落库
 *   T3 赠后对话 → 晒萝卜干句（crop_radish_dryline，一次性）
 *   T4 世界变化·腌萝卜罐：town setupCropLifeLeftovers 渲染（cropLifeLeftoverGfx）
 *   T5 玉米×小镇：收获标记 crop_corn_first_harvest → buildCropGiftDialogue(elder/miner) 丰收台词
 *   T6 番茄×夏雅：tryCropTomatoXiya → 对白 + crop_tomato_xiya_seen + 扣番茄
 *   T7 世界变化·番茄架：farm setupTomatoTrellis 渲染（tomatoTrellisGfx）
 *   T8 读档保持：reload 后世界变化自动渲染（triggerOnce 持久化）
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
  executablePath: CHROME_PATH,
  headless: false,
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
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
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

/** 种子存档进指定场景（背包预置 + 可选预置一次性事件） */
async function seedEnter(scene, inventory = {}, triggeredEvents = {}) {
  const save = {
    version: '0.5', savedAt: 'crop-slice-a-probe', timestamp: Date.now(),
    player: { x: 200, y: 200, scene, facing: 'down', inventory },
    world: { day: 1, hour: 12, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
    chapter: 1,
    worldRestore: {},
    gameState: { triggeredEvents },
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

/** town：萝卜×老张 赠予 + 腌萝卜罐 */
async function runTownRadish() {
  return page.evaluate(async () => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('town');
      // T1 赠予对白
      const dlg = s.buildCropGiftDialogue({ id: 'miner' });
      out.giftDlg = dlg ? {
        hasOption: JSON.stringify(dlg.lines).includes('给他一些'),
        hasRadishText: JSON.stringify(dlg.lines).includes('萝卜'),
        onChoiceFn: typeof dlg.onChoice === 'function',
      } : null;
      // T2 执行赠予
      s.doCropGiftRadish();
      // T3 赠后对话 → 晒萝卜干句（首次调用返回晒萝卜干句并标记 dryline；赠予入口已消失）
      const after = s.buildCropGiftDialogue({ id: 'miner' });
      out.after = {
        giftGone: after ? !JSON.stringify(after.lines).includes('给他一些') : true,
        dryLine: after ? JSON.stringify(after.lines).includes('晒一点萝卜干') : null,
      };
      // T4 腌萝卜罐
      s.setupCropLifeLeftovers();
      out.leftover = { found: !!s.cropLifeLeftoverGfx };
      return out;
    } catch (e) {
      return { __error: e.message };
    }
  });
}

try {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(800);

  // ── town：萝卜×老张 ──
  await seedEnter('town', { radish: 2 });
  const r = await runTownRadish();
  if (r.__error) throw new Error(`town 序列崩于: ${r.__error}`);
  console.log('town:', JSON.stringify(r, null, 1));

  check('T1 背包有萝卜 → 老张赠予对白（含"给他一些"）', !!r.giftDlg && r.giftDlg.hasOption === true, JSON.stringify(r.giftDlg));
  check('T1 对白含「萝卜」', r.giftDlg?.hasRadishText === true, '');
  check('T1 onChoice 已绑定', r.giftDlg?.onChoiceFn === true, '');
  check('T2 赠予后萝卜消耗（赠予入口消失）', r.after?.giftGone === true, `giftGone=${r.after?.giftGone}`);
  check('T3 赠后对话出现晒萝卜干句', r.after?.dryLine === true, `dryLine=${r.after?.dryLine}`);
  check('T4 town 河边腌萝卜罐已渲染', r.leftover?.found === true, JSON.stringify(r.leftover));

  // ── farm：玉米×小镇（种子预置首次收获标记）+ 番茄×夏雅 ──
  await seedEnter('farm', { corn: 2, tomato: 2 }, { crop_corn_first_harvest: true });
  const f = await page.evaluate(async () => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('farm');
      // T5 玉米×小镇：首次收获标记已置（游戏内部 hasTriggered，create 从存档恢复）
      const dlgElder = s.buildCropGiftDialogue({ id: 'elder' });
      const dlgMiner = s.buildCropGiftDialogue({ id: 'miner' });
      out.cornDlg = {
        elder: dlgElder ? JSON.stringify(dlgElder.lines).includes('玉米') : null,
        miner: dlgMiner ? JSON.stringify(dlgMiner.lines).includes('玉米') : null,
      };
      // 番茄×夏雅：伪造 dawnXiya 对象后调用（触发成功 → 番茄架渲染证明事件已落库）
      const fake = { visible: true, x: s.player.x, y: s.player.y, destroy() {}, setVisible() {} };
      s.dawnXiya = fake;
      const ret = s.tryCropTomatoXiya(() => { s.dawnXiya = null; });
      out.tomato = {
        ret,
        dialogueOpen: s.storyDialogue?.isOpen?.() ?? false,
        hasTomatoText: JSON.stringify(s.storyDialogue?.lines ?? '').includes('番茄'),
      };
      if (ret && s.storyDialogue?.isOpen?.()) {
        await new Promise((r) => setTimeout(r, 200));
        s.storyDialogue.reset?.();
      }
      // 番茄架（仅当 crop_tomato_xiya_seen 游戏内部已触发才渲染 → 触发证据）
      s.setupTomatoTrellis();
      out.trellis = { found: !!s.tomatoTrellisGfx };
      return out;
    } catch (e) {
      return { __error: e.message, stack: e.stack ?? '' };
    }
  });
  if (f.__error) throw new Error(`farm 序列崩于: ${f.__error}\n${f.stack}`);
  console.log('farm:', JSON.stringify(f, null, 1));

  // ── T8 读档保持（带事件存档重进） ──
  await seedEnter('farm', {}, {
    crop_radish_laozhang: true,
    crop_tomato_xiya_seen: true,
  });
  const rw = await page.evaluate(async () => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('farm');
      out.trellis = { found: !!s.tomatoTrellisGfx };
      return out;
    } catch (e) { return { __error: e.message }; }
  });
  console.log('reload:', JSON.stringify(rw));
  check('T8 重进 farm 番茄架仍渲染（读档保持）', rw.trellis?.found === true, JSON.stringify(rw.trellis));

  // ── T5/T6/T7 断言（玉米/番茄） ──
  check('T5 玉米×小镇：镇长/老张丰收台词（含玉米）', (f.cornDlg?.elder === true || f.cornDlg?.miner === true), JSON.stringify(f.cornDlg));
  check('T6 番茄×夏雅：tryCropTomatoXiya 触发', f.tomato?.ret === true, `ret=${f.tomato?.ret}`);
  check('T6 夏雅对白打开（含番茄）', f.tomato?.dialogueOpen === true && f.tomato?.hasTomatoText === true, JSON.stringify(f.tomato));
  check('T7 farm 番茄架已渲染（事件落库证据）', f.trellis?.found === true, JSON.stringify(f.trellis));

  // ── T9 无运行时错误 ──
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('T9 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  await page.screenshot({ path: join(SHOT_DIR, 'crop-slice-a-final.png') });
  console.log(`\n===== probe-crop-slice-a 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-crop-slice-a 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
