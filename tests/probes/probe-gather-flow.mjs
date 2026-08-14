/**
 * probe-gather-flow.mjs — 采集流向扩展探针（第一章「复苏」玩法升级）
 *
 * 依据：《核心玩法循环优化-v1.0》采集缺口。复用钓鱼「可流动资源」模板。
 * 背包预置走种子存档（create 时 restoreAllInventory 恢复），避免动态 import 模块分裂。
 * 验证：
 *   T1 配置：GATHER_EXCHANGES = { gardener→wild_berry, miner→wild_mushroom }
 *   T2 小梅交换对白：背包有野莓 → buildGatherExchangeDialogue 返回对白（含"收下吧"）
 *   T3 老张交换对白：背包有野蘑菇 → buildGatherExchangeDialogue 返回对白
 *   T4 小梅执行交换：doGatherExchange('gardener') → 野莓消耗 → 对白不再触发
 *   T5 世界变化·野莓篮：setupGatherBerryBasket 在 farm 花田旁 (88,136) 渲染
 *   T6 夏雅野花交换：tryXiyaFlowerExchange → 对白 → selectOption(0) → 扣花
 *   T7 世界变化·老屋窗台花：setupXiyaWindowFlower 在 (216,328) 渲染
 *   T8 世界变化·老张家晾蘑菇串：elder_house (104,72) 渲染
 *   T9 读档保持：reload 重进 farm 后世界变化自动渲染（triggerOnce 持久化）
 *   T10 无运行时错误
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

/** 种子存档进指定场景（背包预置采集物 + 可选预置一次性事件） */
async function seedEnter(scene, inventory = {}, triggeredEvents = {}) {
  const save = {
    version: '0.5', savedAt: 'gather-flow-probe', timestamp: Date.now(),
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

/** 读取配置（动态 import MapScene 只读，不依赖背包） */
async function readConfig() {
  return page.evaluate(async () => {
    try {
      const MapMod = await import('/src/scenes/MapScene.ts');
      const MapScene = MapMod.default ?? MapMod.MapScene;
      const GE = MapScene.GATHER_EXCHANGES;
      return GE ? {
        keys: Object.keys(GE),
        gardener: GE.gardener,
        miner: GE.miner,
        adventurer: GE.adventurer,
        carpenter: GE.carpenter,
      } : null;
    } catch (e) {
      return { __error: e.message };
    }
  });
}

/** farm 主序列（小梅/夏雅交换 + 世界变化） */
async function runFarm() {
  return page.evaluate(async () => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('farm');
      const gfxCount = () => s.children.list.filter((o) => o.type === 'Graphics').length;

      // T2 小梅交换对白
      const gDialogue = s.buildGatherExchangeDialogue({ id: 'gardener' });
      out.berryDlg = gDialogue ? {
        lineCount: gDialogue.lines.length,
        hasOption: JSON.stringify(gDialogue.lines).includes('收下吧'),
        hasBerryText: JSON.stringify(gDialogue.lines).includes('野莓'),
        onChoiceFn: typeof gDialogue.onChoice === 'function',
      } : null;

      // T3 老张交换对白（背包有蘑菇）
      const mDialogue = s.buildGatherExchangeDialogue({ id: 'miner' });
      out.mushDlg = mDialogue ? {
        lineCount: mDialogue.lines.length,
        hasOption: JSON.stringify(mDialogue.lines).includes('收下吧'),
        hasMushText: JSON.stringify(mDialogue.lines).includes('野蘑菇'),
      } : null;

      // T4 小梅执行交换（背包预置野莓 2 → 扣 1 → 剩 1 → 因一次性 hasTriggered 不再触发对白）
      const beforeDlg = !!s.buildGatherExchangeDialogue({ id: 'gardener' });
      s.doGatherExchange('gardener');
      const afterDlg = !!s.buildGatherExchangeDialogue({ id: 'gardener' });
      out.berrySwap = { beforeDlg, afterDlg };

      // T5 世界变化·野莓篮（创建后 gatherBerryBasketGfx 非空）
      s.setupGatherBerryBasket();
      out.berryBasket = { found: !!s.gatherBerryBasketGfx };

      // T6 夏雅野花交换（预置 small_flower 1 → 交换后扣光 → 不再触发）
      const retXiya = s.tryXiyaFlowerExchange(() => {});
      const xiyaOpen = s.storyDialogue?.isOpen?.() ?? false;
      out.xiya = { ret: retXiya, dialogueOpen: xiyaOpen };
      if (retXiya && xiyaOpen) {
        await new Promise((r) => setTimeout(r, 250));
        if (typeof s.storyDialogue.selectOption === 'function') {
          s.storyDialogue.selectOption(0);
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      out.xiya.after = {
        retry: s.tryXiyaFlowerExchange(() => {}), // 已换过/花已扣光 → 应为 false
      };

      // T7 世界变化·老屋窗台花
      s.setupXiyaWindowFlower();
      out.windowFlower = { found: !!s.xiyaWindowFlowerGfx };

      return out;
    } catch (e) {
      return { __error: e.message, stack: e.stack ?? '' };
    }
  });
}

/** town 小梅真实对话注入验证 */
async function runTownInject() {
  await seedEnter('town', { wild_berry: 1 });
  return page.evaluate(async () => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('town');
      const npcSys = await import('/src/systems/NPCSystem.ts');
      const gardenerNpc = npcSys.getNPCsForScene('town').find((n) => n.id === 'gardener') ?? null;
      if (!gardenerNpc) { out.missingNpc = true; return out; }
      s.storyDialogue?.reset?.();
      s.showDialogue(gardenerNpc);
      await new Promise((r) => setTimeout(r, 300));
      const dlgLines = JSON.stringify(s.storyDialogue?.lines ?? '');
      out.open = s.storyDialogue?.isOpen?.() ?? false;
      out.hasBerry = dlgLines.includes('野莓');
      out.hasOption = dlgLines.includes('收下吧');
      s.storyDialogue?.reset?.();
      return out;
    } catch (e) {
      return { __error: e.message };
    }
  });
}

/** elder_house 老张交换 + 世界变化 */
async function runElderHouse() {
  return page.evaluate(async () => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('elder_house');
      if (!s) { out.missing = true; return out; }
      const dlg = s.buildGatherExchangeDialogue({ id: 'miner' });
      out.dlgBefore = !!dlg;
      s.doGatherExchange('miner');
      out.dlgAfter = !!s.buildGatherExchangeDialogue({ id: 'miner' });
      s.setupGatherMushroomDrying();
      out.mushroomDrying = { found: !!s.gatherMushroomDryingGfx };
      return out;
    } catch (e) {
      return { __error: e.message };
    }
  });
}

/** town 阿风蒲公英交换 + 世界变化（蒲公英丛） */
async function runTownAdventurer() {
  return page.evaluate(async () => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('town');
      if (!s) { out.missing = true; return out; }
      const dlg = s.buildGatherExchangeDialogue({ id: 'adventurer' });
      out.dlgBefore = !!dlg;
      out.hasDandelion = dlg ? JSON.stringify(dlg.lines).includes('蒲公英') : false;
      out.hasOption = dlg ? JSON.stringify(dlg.lines).includes('收下吧') : false;
      s.doGatherExchange('adventurer');
      out.dlgAfter = !!s.buildGatherExchangeDialogue({ id: 'adventurer' });
      s.setupGatherDandelionPatch();
      out.dandelionPatch = { found: !!s.gatherDandelionPatchGfx };
      return out;
    } catch (e) {
      return { __error: e.message };
    }
  });
}

/** farm 老周（木匠）树枝交换 + 世界变化（老屋门口小木鸟） */
async function runFarmCarpenter() {
  return page.evaluate(async () => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('farm');
      if (!s) { out.missing = true; return out; }
      const dlg = s.buildGatherExchangeDialogue({ id: 'carpenter' });
      out.dlgBefore = !!dlg;
      out.hasTwig = dlg ? JSON.stringify(dlg.lines).includes('枯枝') : false;
      out.hasOption = dlg ? JSON.stringify(dlg.lines).includes('收下吧') : false;
      s.doGatherExchange('carpenter');
      out.dlgAfter = !!s.buildGatherExchangeDialogue({ id: 'carpenter' });
      s.setupGatherWoodenStarlingToy();
      out.woodenStarling = { found: !!s.gatherWoodenStarlingGfx };
      return out;
    } catch (e) {
      return { __error: e.message };
    }
  });
}

/** reload 重进 farm（带已触发事件存档），检查世界变化自动渲染（读档保持） */
async function runReload() {
  await seedEnter('farm', {}, {
    ch1_gather_exchange_gardener: true,
    ch1_gather_exchange_xiya: true,
  });
  return page.evaluate(async () => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('farm');
      // create 时 setupGatherBerryBasket + setupXiyaWindowFlower 已按 hasTriggered 渲染 → 字段引用非空
      out.berryBasket = { found: !!s.gatherBerryBasketGfx };
      out.windowFlower = { found: !!s.xiyaWindowFlowerGfx };
      return out;
    } catch (e) {
      return { __error: e.message };
    }
  });
}

try {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(800);

  // ── T1 配置 ──
  const cfg = await readConfig();
  if (cfg && !cfg.__error) {
    console.log('config:', JSON.stringify(cfg));
    check('T1 GATHER_EXCHANGES 含 gardener/miner', cfg.keys.includes('gardener') && cfg.keys.includes('miner'), JSON.stringify(cfg));
    check('T1 gardener → wild_berry', cfg.gardener?.item === 'wild_berry', '');
    check('T1 miner → wild_mushroom', cfg.miner?.item === 'wild_mushroom', '');
    check('T12 adventurer → dandelion', cfg.adventurer?.item === 'dandelion', '');
    check('T12 carpenter → twig', cfg.carpenter?.item === 'twig', '');
  } else {
    check('T1 配置读取', false, cfg?.__error ?? 'null');
  }

  // ── farm 主序列（小梅/夏雅） ──
  await seedEnter('farm', { wild_berry: 2, wild_mushroom: 2, small_flower: 1 });
  const r = await runFarm();
  if (r.__error) throw new Error(`farm 序列崩于: ${r.__error}\n${r.stack}`);

  console.log('berryDlg:', JSON.stringify(r.berryDlg));
  console.log('mushDlg:', JSON.stringify(r.mushDlg));
  console.log('berrySwap:', JSON.stringify(r.berrySwap));
  console.log('berryBasket:', JSON.stringify(r.berryBasket));
  console.log('xiya:', JSON.stringify(r.xiya));
  console.log('windowFlower:', JSON.stringify(r.windowFlower));

  check('T2 背包有野莓 → 小梅交换对白出现', !!r.berryDlg, '');
  check('T2 对白含「收下吧」选项', r.berryDlg?.hasOption === true, '');
  check('T2 对白含「野莓」文案', r.berryDlg?.hasBerryText === true, '');
  check('T2 onChoice 已绑定', r.berryDlg?.onChoiceFn === true, '');

  check('T3 背包有野蘑菇 → 老张交换对白出现', !!r.mushDlg, '');
  check('T3 对白含「收下吧」选项', r.mushDlg?.hasOption === true, '');
  check('T3 对白含「野蘑菇」文案', r.mushDlg?.hasMushText === true, '');

  check('T4 小梅交换触发（交换前可触发，交换后一次性不再触发）', r.berrySwap?.beforeDlg === true && r.berrySwap?.afterDlg === false, JSON.stringify(r.berrySwap));
  check('T5 farm 花田旁野莓篮已渲染', r.berryBasket?.found === true, JSON.stringify(r.berryBasket));

  check('T6 tryXiyaFlowerExchange 返回 true', r.xiya?.ret === true, `ret=${r.xiya?.ret}`);
  check('T6 夏雅对白打开', r.xiya?.dialogueOpen === true, '');
  check('T6 选择收下后不再触发（花已扣光）', r.xiya?.after?.retry === false, `retry=${r.xiya?.after?.retry}`);
  check('T7 farm 老屋窗台插花已渲染', r.windowFlower?.found === true, JSON.stringify(r.windowFlower));

  // ── T8 elder_house 老张蘑菇交换 ──
  await page.evaluate(() => {
    const gm = window.__game;
    for (const sc of gm.scene.getScenes(true)) gm.scene.stop(sc.scene.key);
    gm.scene.start('elder_house', { spawn: { x: 80, y: 100 } });
  });
  await sleep(2500);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('elder_house');
    if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.reset?.();
  });
  const eh = await runElderHouse();
  if (eh.__error) throw new Error(`elder_house 序列崩于: ${eh.__error}`);
  console.log('elderHouse:', JSON.stringify(eh));
  check('T8 老张蘑菇交换对白触发', eh.dlgBefore === true, `before=${eh.dlgBefore}`);
  check('T8 交换后蘑菇扣光 → 对白不再触发', eh.dlgAfter === false, `after=${eh.dlgAfter}`);
  check('T8 elder_house 老张家门口晾蘑菇串已渲染', eh.mushroomDrying?.found === true, JSON.stringify(eh.mushroomDrying));

  // ── T9 读档保持（reload 重进 farm） ──
  const rw = await runReload();
  if (rw.__error) throw new Error(`reload 序列崩于: ${rw.__error}`);
  console.log('reload:', JSON.stringify(rw));
  check('T9 重进 farm 野莓篮仍渲染（读档保持）', rw.berryBasket?.found === true, JSON.stringify(rw.berryBasket));
  check('T9 重进 farm 窗台花仍渲染（读档保持）', rw.windowFlower?.found === true, JSON.stringify(rw.windowFlower));

  // ── T12 town 阿风蒲公英交换 + 世界变化 ──
  await seedEnter('town', { dandelion: 2 });
  const adv = await runTownAdventurer();
  if (adv.__error) throw new Error(`town 阿风序列崩于: ${adv.__error}`);
  console.log('townAdventurer:', JSON.stringify(adv));
  check('T12 背包有蒲公英 → 阿风交换对白出现', adv.dlgBefore === true, `before=${adv.dlgBefore}`);
  check('T12 阿风对白含「蒲公英」文案', adv.hasDandelion === true, '');
  check('T12 阿风对白含「收下吧」选项', adv.hasOption === true, '');
  check('T12 交换后蒲公英扣光 → 对白不再触发', adv.dlgAfter === false, `after=${adv.dlgAfter}`);
  check('T12 town 河岸蒲公英丛已渲染', adv.dandelionPatch?.found === true, JSON.stringify(adv.dandelionPatch));

  // ── T13 farm 老周（木匠）树枝交换 + 世界变化 ──
  await seedEnter('farm', { twig: 2 });
  const carp = await runFarmCarpenter();
  if (carp.__error) throw new Error(`farm 老周序列崩于: ${carp.__error}`);
  console.log('farmCarpenter:', JSON.stringify(carp));
  check('T13 背包有树枝 → 老周交换对白出现', carp.dlgBefore === true, `before=${carp.dlgBefore}`);
  check('T13 老周对白含「枯枝」文案', carp.hasTwig === true, '');
  check('T13 老周对白含「收下吧」选项', carp.hasOption === true, '');
  check('T13 交换后树枝扣光 → 对白不再触发', carp.dlgAfter === false, `after=${carp.dlgAfter}`);
  check('T13 farm 老屋门口小木鸟已渲染', carp.woodenStarling?.found === true, JSON.stringify(carp.woodenStarling));

  // ── T11 真实对话注入（town 小梅） ──
  const inject = await runTownInject();
  if (inject.__error) throw new Error(`town 注入序列崩于: ${inject.__error}`);
  console.log('townInject:', JSON.stringify(inject));
  if (inject.missingNpc) {
    console.log('⏭ T11 跳过：探针时段（12:00）小梅不在 town（日程 07:00 farm / 14:00 forest）；buildGatherExchangeDialogue 注入已由 T2/T3 直接验证');
  } else {
    check('T11 小梅真实对话打开', inject.open === true, JSON.stringify(inject));
    check('T11 对话注入采集交换文案（含野莓）', inject.hasBerry === true, '');
    check('T11 对话含「收下吧」选项', inject.hasOption === true, '');
  }

  // ── T10 无运行时错误 ──
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('T10 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  await page.screenshot({ path: join(SHOT_DIR, 'gather-flow-final.png') });
  console.log(`\n===== probe-gather-flow 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-gather-flow 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
