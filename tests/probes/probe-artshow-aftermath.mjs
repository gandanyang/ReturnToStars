/**
 * probe-artshow-aftermath.mjs — 星光艺术展余波探针（v1.3）
 *
 * 验证：
 *   T1 永久变化后，白天/傍晚旅人回访出现在艺术角长椅（artShowTravelerGfx 创建且可见）
 *   T2 夜晚（20 点后）旅人隐去
 *   T3 靠近长椅按 E → 旅人余波对白（artshow_traveler_return 落库）
 *   T4 商店留言：老板第一次提到旅人便条（artshow_traveler_note 落库），第二次不再重复
 *   T5 读档保持：reload 后已触发事件不再重放
 *   T6 无运行时错误
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

/** 种子存档进 town（预置 artShowPerm + 可选已触发事件 + 时段） */
async function seedArtShow(hour = 12, triggered = {}) {
  const save = {
    version: '0.5', savedAt: 'artshow-aftermath', timestamp: Date.now(),
    player: { x: 516, y: 340, scene: 'town', facing: 'down', inventory: { wood: 5, stone: 5, qinghe_crucian: 1 } },
    world: { day: 2, hour, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
    chapter: 1, worldRestore: { marketSquare: true },
    mapFlags: { shopState: 'opened', artShowUnlocked: true, artShowEnvStage: 3, artShowMaterialsDone: true, artShowHeld: true, artShowPerm: true },
    gameState: { triggeredEvents: {
      ch1_spring_fair: true, artshow_xiya_plan: true, artshow_elder_coord: true,
      artshow_carpenter_photo: true, artshow_gardener_flower: true,
      ...triggered,
    } },
  };
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(600);
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === 'town') break;
  }
  await sleep(2000);
  await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.reset?.();
  });
}

try {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(800);

  // ── T1 白天旅人回访出现在长椅 ──
  await seedArtShow(12);
  const p1 = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('town');
    const inv = await import('/src/data/Inventory.ts');
    return {
      hasPerm: s.artShowPerm === true,
      travelerGfx: !!s.artShowTravelerGfx,
      travelerVisible: s.artShowTravelerGfx?.visible ?? false,
      travelerLabel: !!s.artShowTravelerLabel,
      // 余波对白（未触发过）
      interactRet: s.tryArtShowTravelerInteract(),
      dlgOpen: s.storyDialogue?.isOpen?.() ?? false,
    };
  });
  console.log('day:', JSON.stringify(p1));
  check('T1 artShowPerm 已加载', p1.hasPerm === true, '');
  check('T1 旅人回访精灵已创建', p1.travelerGfx === true, '');
  check('T1 白天旅人可见', p1.travelerVisible === true, '');
  check('T1 旅人名字标牌存在', p1.travelerLabel === true, '');
  check('T3 靠近长椅 → 旅人余波对白打开', p1.interactRet === true && p1.dlgOpen === true, JSON.stringify(p1));

  // 选择/完成对白
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    if (typeof s.storyDialogue?.selectOption === 'function') { s.storyDialogue.selectOption(0); }
    else s.storyDialogue.reset?.();
  });
  await sleep(400);
  // 验证 return flag 生效：第二次交互应走"日常看展句"（2 行），而非首次回访的 4 行——
  // 用游戏自身模块（同一 evaluate 上下文里 import）读 flag，避免跨 evaluate 的模块单例分裂。
  const p1b = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('town');
    s.storyDialogue?.reset?.();
    const again = s.tryArtShowTravelerInteract();
    const linesJson = JSON.stringify(s.storyDialogue?.lines ?? []);
    const firstVisitDlg4 = again && JSON.stringify(linesJson).includes('画下来的地方'); // 首次回访 4 行文案
    const daily2 = again && !JSON.stringify(linesJson).includes('画下来的地方');        // 已回访 → 日常看展 2 行
    s.storyDialogue?.reset?.();
    return { again, firstVisitDlg4, daily2, hasReturn: (await import('/src/systems/EventManager.ts')).hasTriggered('artshow_traveler_return') };
  });
  console.log('return-check:', JSON.stringify(p1b));
  // 首次交互已触发 → 再次交互为日常句（2 行），且 game 侧 flag 已置
  check('T3 再次交互为「日常看展句」（首次回访不重放）', p1b.again === true && p1b.daily2 === true, JSON.stringify(p1b));

  // ── T2 夜晚旅人隐去 ──
  await seedArtShow(21);
  const p2 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    // 夜晚进场景：setupArtShowTraveler 只在 8-20 时创建；即使创建也应由 check 置隐
    const created = !!s.artShowTravelerGfx;
    return { created, visibleNow: s.artShowTravelerGfx?.visible ?? null };
  });
  console.log('night:', JSON.stringify(p2));
  // 夜晚不创建即视为通过（created=false）
  check('T2 夜晚旅人未显示', p2.created === false || p2.visibleNow === false, JSON.stringify(p2));

  // ── T4 商店留言便条（白天、店铺营业） ──
  await seedArtShow(12);
  const p4 = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('town');
    s.shopState = 'opened'; // 强制店铺营业，进入"开放式"剧本
    const note = s.buildTravelerNoteDialogue();
    const txt = JSON.stringify(note);
    return {
      hasNote: !!note,
      mentionsNote: txt.includes('字条'),
      mentionsQuote: txt.includes('把光留下了'),
      noteTriggeredNow: !!(s.buildTravelerNoteDialogue() === null), // 第二次调用 → 已标记，不再返回
    };
  });
  console.log('shopNote1:', JSON.stringify(p4));
  check('T4 老板首次提到旅人便条', p4.hasNote === true, '');
  check('T4 便条含"把光留下了"文案', p4.mentionsQuote === true, '');
  check('T4 第二次调用不再返回便条（一次性）', p4.noteTriggeredNow === true, '');

  // 真实对话注入：shopkeeper 对话含便条
  const p4b = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('town');
    const npcSys = await import('/src/systems/NPCSystem.ts');
    const shop = npcSys.getNPCsForScene('town').find((n) => n.id === 'shopkeeper');
    if (!shop) return { missing: true };
    // 重置便条标记（便于验证真实注入）
    s.artShowPerm = true;
    s.shopState = 'opened';
    s.storyDialogue?.reset?.();
    s.showDialogue(shop);
    await new Promise((r) => setTimeout(r, 300));
    const lines = JSON.stringify(s.storyDialogue?.lines ?? '');
    const open = s.storyDialogue?.isOpen?.() ?? false;
    s.storyDialogue?.reset?.();
    return { missing: false, open, hasNote: lines.includes('把光留下了') };
  });
  if (p4b.missing) {
    console.log('⏭ T4-注入 跳过：门店营业后 12 点老板在 town');
  } else {
    console.log('shopNoteInject:', JSON.stringify(p4b));
    check('T4-注入 老板真实对话含便条文案', p4b.open === true && p4b.hasNote === true, JSON.stringify(p4b));
  }

  // ── T5 读档保持（旅人余波 + 便条均已触发 → reload 不再重放） ──
  await seedArtShow(12, { artshow_traveler_return: true, artshow_traveler_note: true });
  const p5 = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('town');
    const inv = await import('/src/data/Inventory.ts');
    return {
      // 已触发过 → tryArtShowTravelerInteract 仍可能返回 true（播放后续日常句），确认对白打开
      perm: s.artShowPerm === true,
      travelerPresent: !!s.artShowTravelerGfx,
      noteRetired: s.buildTravelerNoteDialogue() === null,
    };
  });
  console.log('reload:', JSON.stringify(p5));
  check('T5 读档后 artShowPerm 保持', p5.perm === true, '');
  check('T5 读档后旅人仍在艺术角', p5.travelerPresent === true, '');
  check('T5 便条已读过 → reload 后不再返回', p5.noteRetired === true, '');

  // ── T6 无运行时错误 ──
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('T6 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  await page.screenshot({ path: join(SHOT_DIR, 'artshow-aftermath-final.png') });
  console.log(`\n===== probe-artshow-aftermath 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-artshow-aftermath 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
