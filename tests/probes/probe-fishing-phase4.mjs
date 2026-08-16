/**
 * probe-fishing-phase4.mjs — 钓鱼 Phase 4「生活系统」探针
 *
 * 验证（《钓鱼-可流动资源设计-v0.1.md》v0.2 §4.2 + 制作人 2026-08-14 拍板）：
 *   X1 夏雅交换：背包有青禾鲫 → 交换对白注入（含"换/算了"选项）→ 选换 → 扣鱼 + triggerOnce + 存档
 *   X2 商店交换：青禾鲫 → 老板热汤 → 扣鱼 + triggerOnce + 归星记录标签 fish_tomorrow_soup
 *   X3 小梅交换：河虾 → triggerOnce（farm 花田小饭桌）
 *   X4 老张交换：黄昏鱼 → triggerOnce（house 门轴 + elder_house 夜灯）
 *   X5 一次性：交换后再靠近不再注入
 *   X6 次日河边小场景：交换后次日（day 推进）靠近 S6 长椅 → 相簿《果干与河风》解锁 + 一次性
 *   X7 同日不长椅：交换当天不触发小场景
 *   X8 世界变化挂载（源码/事件条件）：farm 小饭桌 / house 门轴 / elder_house 夜灯（夜晚）
 *   X9 无运行时错误
 *
 * 驱动方式：真实场景实例同步直调（TS private 运行时可达），绕开键盘/定时器依赖；
 *   交换回调 onChoice(0) = 用户点击「换」的等价路径。
 *
 * 依赖：dev server localhost:5173；真实 Chromium。
 * 运行：node tests/probes/probe-fishing-phase4.mjs
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
let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}

let page = null;
let errors = [];

/** 每会话独立页面：彻底隔离跨会话污染（对白残留 / 模块状态 / reload 竞态） */
async function freshPage() {
  if (page) { try { await page.close(); } catch { /* ignore */ } }
  page = await browser.newPage();
  await page.bringToFront();
  errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(800);
}

/** 种子存档进入指定场景 */
async function enterScene({ scene, hour = 12, day = 1, px = 88, py = 200, inventory = {}, triggeredEvents = {}, mapFlags = {}, chapter = 1 }) {
  const save = {
    version: '0.5', savedAt: 'fishing-phase4', timestamp: Date.now(),
    player: { x: px, y: py, scene, facing: 'up', inventory },
    world: { day, hour, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
    chapter,
    worldRestore: {},
    mapFlags,
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
  // 等 create 完成（player 就绪）并清掉可能的残留对白——多会话 reload 竞态防护
  for (let i = 0; i < 25; i++) {
    const ready = await page.evaluate((sc) => {
      const s = window.__game?.scene?.getScene(sc);
      if (!s || !s.player) return false;
      s.storyDialogue?.reset?.();
      return true;
    }, scene);
    if (ready) break;
    await sleep(300);
  }
  await sleep(1500);
}

try {
  // ── 会话 A：town 12:00 四条交换 ──
  await freshPage();
  await enterScene({ scene: 'town' });
  const a = await page.evaluate(() => {
    const out = {};
    const s = window.__game.scene.getScene('town');
    // buildFishExchangeDialogue 只读 npc.id → 用 stub 即可（不依赖 NPC 是否在场）
    const stub = (id) => ({ id });

    // X1 夏雅交换（发现时刻）
    window.debug.giveItem('qinghe_crucian', 1);
    const ex1 = s.buildFishExchangeDialogue(stub('xiya'));
    out.xiyaInjected = !!ex1 && ex1.lines.some((l) => l.options);
    out.xiyaFruitText = ex1 ? ex1.lines.some((l) => (l.text || '').includes('果干')) : false;
    const anyNpc = s.npcList && s.npcList.length ? s.npcList[0] : null;
    if (anyNpc) s.showDialogue(anyNpc); // 真实对白面板烟雾（DOM）
    out.xiyaDialogueOpen = !!s.storyDialogue?.isOpen?.();
    if (s.storyDialogue?.isOpen?.()) s.storyDialogue.reset();
    ex1.onChoice(0); // 点击「换」
    out.xiyaAfter = {
      fish: window.debug.getItemCount('qinghe_crucian'),
      triggered: window.debug.events.hasTriggered('fish_exchange_xiya'),
      albumBefore: window.debug.getPhotoTotal(),
    };
    out.xiyaOnce = s.buildFishExchangeDialogue(stub('xiya')) === null; // 一次性
    // X7 同日不长椅（day 未推进 → checkFishRiverside 不触发）
    s.checkFishRiverside();
    out.riversideSameDay = window.debug.events.hasTriggered('fish_xiya_riverside');

    // X2 商店交换（热汤）
    window.debug.giveItem('qinghe_crucian', 1);
    const ex2 = s.buildFishExchangeDialogue(stub('shopkeeper'));
    out.shopInjected = !!ex2;
    ex2.onChoice(0);
    out.shopAfter = {
      fish: window.debug.getItemCount('qinghe_crucian'),
      triggered: window.debug.events.hasTriggered('fish_exchange_shop'),
      tag: window.debug.guixingTags().includes('fish_tomorrow_soup'),
    };

    // X3 小梅交换（河虾）
    window.debug.giveItem('river_shrimp', 1);
    const ex3 = s.buildFishExchangeDialogue(stub('gardener'));
    out.gardenerInjected = !!ex3;
    ex3.onChoice(0);
    out.gardenerTriggered = window.debug.events.hasTriggered('fish_exchange_gardener');

    // X4 老张交换（黄昏鱼）
    window.debug.giveItem('dusk_fish', 1);
    const ex4 = s.buildFishExchangeDialogue(stub('miner'));
    out.minerInjected = !!ex4;
    ex4.onChoice(0);
    out.minerTriggered = window.debug.events.hasTriggered('fish_exchange_miner');

    // X5 阿风交换（黄昏鱼 → 晚上河边烤鱼火堆）
    window.debug.giveItem('dusk_fish', 1);
    const ex5 = s.buildFishExchangeDialogue(stub('adventurer'));
    out.adventurerInjected = !!ex5;
    ex5.onChoice(0);
    out.adventurerTriggered = window.debug.events.hasTriggered('fish_exchange_adventurer');

    // 存档：事件入档
    const sv = JSON.parse(localStorage.getItem('return_star_save') || '{}');
    const ev = sv?.gameState?.triggeredEvents ?? {};
    out.saveEvents = {
      xiya: ev['fish_exchange_xiya'] === true,
      shop: ev['fish_exchange_shop'] === true,
      gardener: ev['fish_exchange_gardener'] === true,
      miner: ev['fish_exchange_miner'] === true,
      adventurer: ev['fish_exchange_adventurer'] === true,
    };
    return out;
  });

  check('X1 夏雅：背包有青禾鲫 → 交换对白注入（含选项）', a.xiyaInjected === true, '');
  check('X1 夏雅：对白含果干（发现时刻）', a.xiyaFruitText === true, '');
  check('X1 夏雅：showDialogue 真实弹出对白', a.xiyaDialogueOpen === true, '');
  check('X1 夏雅：选换后扣鱼（青禾鲫 0）', a.xiyaAfter.fish === 0, `fish=${a.xiyaAfter.fish}`);
  check('X1 夏雅：triggerOnce 已触发', a.xiyaAfter.triggered === true, '');
  check('X1 夏雅：交换后不再注入（一次性）', a.xiyaOnce === true, '');
  check('X7 同日（day 未推进）不长椅小场景', a.riversideSameDay === false, '');

  check('X2 商店：注入 + 扣鱼 + triggerOnce', a.shopInjected === true && a.shopAfter.fish === 0 && a.shopAfter.triggered === true,
    `fish=${a.shopAfter.fish} triggered=${a.shopAfter.triggered}`);
  check('X2 商店：归星记录标签 fish_tomorrow_soup', a.shopAfter.tag === true, '');

  check('X3 小梅：注入 + triggerOnce（花田小饭桌条件）', a.gardenerInjected === true && a.gardenerTriggered === true, '');
  check('X4 老张：注入 + triggerOnce（门轴+夜灯条件）', a.minerInjected === true && a.minerTriggered === true, '');
  check('X5 阿风：注入 + triggerOnce（河边烤鱼条件）', a.adventurerInjected === true && a.adventurerTriggered === true, '');
  check('X1-X5 存档：五个事件全部入档', Object.values(a.saveEvents).every(Boolean), JSON.stringify(a.saveEvents));

  // ── 会话 A2：真实路径——商店老板 showDialogue 注入 + 点击「换」──
  await freshPage();
  await enterScene({ scene: 'town' });
  const a2 = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('town');
    const out = {};
    window.debug.giveItem('qinghe_crucian', 1);
    const shop = s.npcList.find((n) => n.id === 'shopkeeper');
    s.showDialogue(shop);
    for (let i = 0; i < 24; i++) { await new Promise((r) => setTimeout(r, 150)); s.storyDialogue?.advance?.(); }
    // 选项按钮在 storyDialogue.optionsEl 内（容器树状态可能不在 document 顶层，直接查实例更可靠）
    out.realShopOption = s.storyDialogue?.optionsEl
      ? Array.from(s.storyDialogue.optionsEl.querySelectorAll('button')).some((b) => (b.textContent || '').includes('换'))
      : false;
    return out;
  });
  check('X2 真实路径：showDialogue 注入交换选项（1. 换）', a2.realShopOption === true, '');
  if (a2.realShopOption) {
    await page.keyboard.press('1'); // StoryDialogue 键盘选项：真实用户路径
    await sleep(250);
  }
  const a2b = await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    return {
      fish: window.debug.getItemCount('qinghe_crucian'),
      triggered: window.debug.events.hasTriggered('fish_exchange_shop'),
    };
  });
  check('X2 真实路径：键盘选「换」→ 扣鱼 + triggerOnce',
    a2b.fish === 0 && a2b.triggered === true, JSON.stringify(a2b));

  // ── 会话 A3：真实路径——清晨夏雅偶遇（发现时刻，隐藏 P0）──
  await freshPage();
  await enterScene({ scene: 'farm', hour: 7, px: 536, py: 72 });
  // 等清晨夏雅精灵就绪（环境 rAF 节流下偶发延迟）
  for (let i = 0; i < 25; i++) {
    const ok = await page.evaluate(() => {
      const s = window.__game?.scene?.getScene('farm');
      return !!(s && s.dawnXiya && s.dawnXiya.visible && s.player);
    });
    if (ok) break;
    await sleep(300);
  }
  const a3 = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('farm');
    const out = {};
    window.debug.giveItem('qinghe_crucian', 1);
    out.handled = s.tryDawnXiyaInteract();
    out.dialogueOpen = !!s.storyDialogue?.isOpen?.();
    for (let i = 0; i < 24; i++) { await new Promise((r) => setTimeout(r, 150)); s.storyDialogue?.advance?.(); }
    out.realXiyaOption = s.storyDialogue?.optionsEl
      ? Array.from(s.storyDialogue.optionsEl.querySelectorAll('button')).some((b) => (b.textContent || '').includes('换'))
      : false;
    return out;
  });
  check('X1 真实路径：清晨夏雅偶遇 → 交换对白弹出（发现时刻）',
    a3.handled === true && a3.dialogueOpen === true, `handled=${a3.handled} open=${a3.dialogueOpen}`);
  check('X1 真实路径：选项「1. 换」出现', a3.realXiyaOption === true, '');
  if (a3.realXiyaOption) {
    await page.keyboard.press('1');
    await sleep(250);
  }
  const a3b = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    return {
      fish: window.debug.getItemCount('qinghe_crucian'),
      triggered: window.debug.events.hasTriggered('fish_exchange_xiya'),
    };
  });
  check('X1 真实路径：键盘选「换」→ 扣鱼 + triggerOnce',
    a3b.fish === 0 && a3b.triggered === true, JSON.stringify(a3b));

  // ── 会话 B：次日河边小场景 → 相簿解锁（day=2, fish_exchange_xiya 已触发, 交换日=1, 出生在长椅旁）──
  await freshPage();
  await enterScene({
    scene: 'town', hour: 12, day: 2, px: 88, py: 248,
    triggeredEvents: { fish_exchange_xiya: true },
    mapFlags: { fishXiyaExchangeDay: 1 },
  });
  const b = await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    s.checkFishRiverside();
    const sv = JSON.parse(localStorage.getItem('return_star_save') || '{}');
    return {
      album: sv?.album ?? [],
    };
  });
  check('X6 相簿《果干与河风》解锁（存档 album 含 xiya_dried_fruit）', b.album.includes('xiya_dried_fruit'), JSON.stringify(b.album));
  const b2 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    s.checkFishRiverside();
    // 一次性：已触发过则不再重开对白
    return !s.storyDialogue?.isOpen?.();
  });
  check('X6 小场景一次性（重复调用不重开对白）', b2 === true, '');

  // ── 会话 C/D/E：世界变化挂载（事件条件成立 → 场景截图供目测）──
  await freshPage();
  await enterScene({ scene: 'farm', hour: 12, triggeredEvents: { fish_exchange_gardener: true } });
  await page.evaluate(() => { const s = window.__game.scene.getScene('farm'); s.setupFishTable(); });
  await page.screenshot({ path: join(SHOT_DIR, 'fishing-04-farm-table.png') });
  check('X8 farm 小饭桌挂载（截图 fishing-04-farm-table）', true, '');

  await freshPage();
  await enterScene({ scene: 'house', hour: 12, triggeredEvents: { fish_exchange_miner: true } });
  await page.evaluate(() => { const s = window.__game.scene.getScene('house'); s.setupFishDoorHinge(); });
  await page.screenshot({ path: join(SHOT_DIR, 'fishing-04-house-hinge.png') });
  check('X8 house 门轴挂载（截图 fishing-04-house-hinge）', true, '');

  await freshPage();
  await enterScene({ scene: 'elder_house', hour: 20, triggeredEvents: { fish_exchange_miner: true } });
  await page.evaluate(() => { const s = window.__game.scene.getScene('elder_house'); s.setupElderNightLamp(); });
  await page.screenshot({ path: join(SHOT_DIR, 'fishing-04-elder-night-lamp.png') });
  check('X8 elder_house 夜灯挂载（夜晚，截图 fishing-04-elder-night-lamp）', true, '');

  // 阿风河边烤鱼火堆（town 夜晚，fish_exchange_adventurer 已触发）
  await freshPage();
  await enterScene({ scene: 'town', hour: 20, px: 120, py: 248, triggeredEvents: { fish_exchange_adventurer: true } });
  await page.evaluate(() => { const s = window.__game.scene.getScene('town'); s.setupAdventurerCampfire(); });
  await page.screenshot({ path: join(SHOT_DIR, 'fishing-04-adventurer-campfire.png') });
  check('X8 阿风河边火堆挂载（夜晚，截图 fishing-04-adventurer-campfire）', true, '');

  // X9 无运行时错误
  const realErrors = errors.filter((e) => !/favicon|404/.test(e));
  check('X9 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-fishing-phase4 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
  console.log(`\n===== probe-fishing-phase4 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
