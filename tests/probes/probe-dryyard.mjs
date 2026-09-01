/**
 * probe-dryyard.mjs — 秋日晒场（EventPlan 第二实例）完整闭环探针 v1.1
 *
 * 依据：docs/tasks/任务-秋日晒场-EventPlan第二实例-v1.0.md §五 验收标准
 * 验证：
 *   T0 前置门禁：无玉米首收事件 → tryDryyardIntro 不触发（软触发保护）
 *   T1 开场演出：前置齐（春日集+玉米首收）+ 傍晚进 town → dryyard_intro 落库 + dryyardUnlocked
 *   T2 三类准备：环境交付（木材/鱼/玉米）→ envStage 1-3 递进渲染；人际（老张/夏雅/阿风）→ 落库；收成 → materialsDone
 *   T3 当天演出：dryyardReady + 傍晚 → startDryyard → 三段对白链 → 永久落地（dryyardPerm + 青禾晒场）
 *   T4 永久变化：晒场物件重建 + 老张白天停留 + 收成时令台词（首次/日常两态）
 *   T5 读档保持：reload 后 dryyardPerm 保持、事件不重放（triggerOnce 入档）
 *   T6 全镇回应（S6，2026-08-29）：dryyard_held 后 NPC 日常台词切"晒场/过日子"分支（活着没恢复原样）
 *   T7 无运行时错误
 *
 * v1.1 修正（对照 MapScene.ts / StoryDialogue.ts 源码核对）：
 *   - StoryDialogue.reset() 不触发 onComplete → intro/演出链一律用 skip() 推进（onComplete 才是解锁/落地时机）
 *   - skip() 有 300ms 防抖 → 推进循环间隔 400ms
 *   - 删除 MapScene 全局引用（浏览器无此全局，会 ReferenceError）
 *   - 夏雅/老张 spawn 时段 8-18 → 种档统一 hour=17（T4/T5 白天验证用 12）
 *   - finale onComplete 在 20 点落地，老张按设计当晚不在 → T4 走 reload 后白天断言
 *
 * v1.2 修正（08-28 定性·探针双实例）：事件落库/库存断言改读 localStorage 存档真相源（游戏侧标记/扣库存后均同步 save()），
 *   模块实例取证保留作对照输出——vite HMR 重建模块图时，探针裸 URL import 会拿到与游戏运行时分离的实例。
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

/** 种子存档进 town（预置晒场状态 + 已触发事件 + 时段；注意：不 reset 对白——reset 不走 onComplete）
 *  玩家落在 (400,300) 安全点：距晒场中心/老张/征集筐/夏雅均 > 交互与 190px 触发半径，
 *  防 seedDryyard 的 Enter 键误触发晒场相关交互（08-26 实测：老张半径 42px 内会被提前消耗首次台词）。 */
async function seedDryyard(hour = 17, mapFlags = {}, triggered = {}) {
  const save = {
    version: '0.5', savedAt: 'dryyard-probe', timestamp: Date.now(),
    player: { x: 400, y: 300, scene: 'town', facing: 'up', inventory: { wood: 8, qinghe_crucian: 4, corn: 6, tomato: 3, radish: 2, small_flower: 2 } },
    world: { day: 3, hour, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
    chapter: 1, worldRestore: { marketSquare: true },
    mapFlags: { shopState: 'opened', ...mapFlags },
    gameState: { triggeredEvents: {
      ch1_spring_fair: true, crop_corn_first_harvest: true,
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
  await sleep(2200); // intro 软触发在 create 后 1.6s
}

/** 用 skip() 推进演出三段对白链直到 dryyardPerm 落地（onComplete 同步触发；skip 有 300ms 防抖 → 间隔 400ms） */
async function skipUntilPerm(maxRounds = 15) {
  for (let i = 0; i < maxRounds; i++) {
    const done = await page.evaluate(() => {
      const s = window.__game.scene.getScene('town');
      if (!s) return false;
      if (s.dryyardPerm) return true;
      if (s.storyDialogue?.isOpen?.()) s.storyDialogue.skip();
      return s.dryyardPerm === true;
    }).catch(() => false);
    if (done) return true;
    await sleep(400);
  }
  return false;
}

/** 持久真相源取证：读 localStorage 存档 JSON（v1.2）——不受 vite HMR 模块实例分化影响 */
async function readSave() {
  return await page.evaluate(() => {
    const raw = localStorage.getItem('return_star_save');
    return raw ? JSON.parse(raw) : null;
  });
}

try {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(800);

  // ── T0 前置门禁：无 crop_corn_first_harvest → 不触发 ──
  await seedDryyard(17, {}, {}); // triggeredEvents 基线含玉米首收？——seedDryyard 默认带；T0 用手工档去掉
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);
  await page.evaluate(() => {
    const save = {
      version: '0.5', savedAt: 'dryyard-t0', timestamp: Date.now(),
      player: { x: 656, y: 320, scene: 'town', facing: 'up', inventory: { wood: 8 } },
      world: { day: 3, hour: 17, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
      farm: { tiles: [], crops: [], trees: [] },
      story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
      chapter: 1, worldRestore: { marketSquare: true },
      mapFlags: { shopState: 'opened' },
      gameState: { triggeredEvents: { ch1_spring_fair: true } }, // 缺 crop_corn_first_harvest
    };
    localStorage.setItem('return_star_save', JSON.stringify(save));
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(3000);
  const p0 = await page.evaluate(async () => {
    const ev = await import('/src/systems/EventManager.ts');
    const s = window.__game.scene.getScenes(true).find((x) => x.scene?.key === 'town') ?? window.__game.scene.getScenes(true)[0];
    return { hasIntro: ev.hasTriggered('dryyard_intro'), scene: s?.scene?.key, unlocked: s?.dryyardUnlocked === true };
  });
  console.log('t0:', JSON.stringify(p0));
  check('T0 缺玉米首收 → 开场演出未触发', p0.hasIntro === false && p0.unlocked === false, JSON.stringify(p0));

  // ── T1 开场演出：前置齐 + 傍晚 → dryyard_intro 落库 + 解锁 ──
  await seedDryyard(17);
  // intro 软触发（create 后 1.6s）→ 用 skip() 推进对白链（onComplete 里解锁 + 挂载筐 + spawn 夏雅）
  let t1 = null;
  for (let i = 0; i < 12; i++) {
    t1 = await page.evaluate(async () => {
      const ev = await import('/src/systems/EventManager.ts');
      const s = window.__game.scene.getScene('town');
      if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.skip();
      return {
        hasIntro: ev.hasTriggered('dryyard_intro'),
        unlocked: s?.dryyardUnlocked === true,
        boxBuilt: !!s?.dryyardBox,
        xiyaSpawned: !!s?.dryyardXiya,
        dlgOpen: s?.storyDialogue?.isOpen?.() ?? false,
      };
    });
    if (t1.unlocked && !t1.dlgOpen) break;
    await sleep(400);
  }
  const t1save = await readSave();
  const t1HasIntroSave = t1save?.gameState?.triggeredEvents?.dryyard_intro === true;
  console.log('t1:', JSON.stringify(t1), 't1-save.intro:', t1HasIntroSave);
  check('T1 开场演出触发（dryyard_intro 落库·存档取证）', t1HasIntroSave === true, `存档=${t1HasIntroSave} 模块对照=${t1.hasIntro} ${JSON.stringify(t1)}`);
  check('T1 dryyardUnlocked 已解锁（intro onComplete 走通）', t1.unlocked === true, JSON.stringify(t1));
  check('T1 征集筐已挂载', t1.boxBuilt === true, '');
  check('T1 筹备期夏雅已 spawn（17 点在 8-18 内）', t1.xiyaSpawned === true, JSON.stringify(t1));
  await sleep(500);

  // ── T2 三类准备 ──
  const p2 = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('town');
    const inv = await import('/src/data/Inventory.ts');
    // 环境：三笔交付（木材→晒架 / 鱼→竹席鱼干架 / 玉米→玉米串）
    s.dryyardDeliver('wood', 2, () => { s.dryyardEnvStage = Math.max(s.dryyardEnvStage, 1); });
    const st1 = s.dryyardEnvStage;
    s.dryyardDeliver('qinghe_crucian', 1, () => { s.dryyardEnvStage = Math.max(s.dryyardEnvStage, 2); });
    const st2 = s.dryyardEnvStage;
    s.dryyardDeliver('corn', 2, () => { s.dryyardEnvStage = Math.max(s.dryyardEnvStage, 3); });
    const st3 = s.dryyardEnvStage;
    // 资源：今年的收成
    s.dryyardDeliverCrop();
    const matDone = s.dryyardMaterialsDone;
    // 人际·老张/阿风（NPC 对白注入路径——buildDryyardDialogue 内部 triggerOnce 标记）
    const laozhangLines = s.buildDryyardDialogue({ id: 'miner' });
    const afengLines = s.buildDryyardDialogue({ id: 'adventurer' });
    const ev = await import('/src/systems/EventManager.ts');
    return {
      st1, st2, st3, matDone,
      laozhangLines: laozhangLines?.length ?? 0,
      afengLines: afengLines?.length ?? 0,
      laozhangEvt: ev.hasTriggered('dryyard_laozhang_craft'),
      afengEvt: ev.hasTriggered('dryyard_afeng_help'),
      woodLeft: inv.getItemCount('wood'),
      fishLeft: inv.getItemCount('qinghe_crucian'),
      envBuilt: s.dryyardEnvBuilt,
    };
  });
  console.log('t2:', JSON.stringify(p2));
  const p2save = await readSave();
  const p2Trig = p2save?.gameState?.triggeredEvents ?? {};
  const p2Inv = p2save?.player?.inventory ?? {};
  console.log('t2-save:', JSON.stringify({ laozhang: p2Trig.dryyard_laozhang_craft === true, afeng: p2Trig.dryyard_afeng_help === true, wood: p2Inv.wood }));
  check('T2 环境·晒架（木材×2 → stage1）', p2.st1 === 1, JSON.stringify(p2.st1));
  check('T2 环境·竹席鱼干架（鱼×1 → stage2）', p2.st2 === 2, '');
  check('T2 环境·玉米串辣椒串（玉米×2 → stage3）', p2.st3 === 3, '');
  check('T2 环境物件增量构建到 stage3', p2.envBuilt === 3, JSON.stringify(p2.envBuilt));
  check('T2 交付扣库存（wood 8→6·存档取证）', p2Inv.wood === 6, `存档=${p2Inv.wood} 模块对照=${p2.woodLeft}`);
  check('T2 资源·今年的收成（蔬菜 → materialsDone）', p2.matDone === true, '');
  check('T2 人际·老张对白注入（旧手艺）', p2.laozhangLines >= 2, JSON.stringify(p2.laozhangLines));
  check('T2 人际·老张事件落库（存档取证）', p2Trig.dryyard_laozhang_craft === true, `模块对照=${p2.laozhangEvt}`);
  check('T2 人际·阿风对白注入（搭把手）', p2.afengLines >= 4, JSON.stringify(p2.afengLines));
  check('T2 人际·阿风事件落库（存档取证）', p2Trig.dryyard_afeng_help === true, `模块对照=${p2.afengEvt}`);

  // 人际·夏雅（旧照片）：真实交互路径（玩家贴近夏雅 → tryDryyardXiyaInteract）
  // 注意：交互完玩家仍在晒场触发半径内（三类准备已齐+傍晚 → update 的 checkDryyardAuto 会合法触发当天演出），
  // 故 evaluate 尾部同步 skip 完夏雅对白并立即把玩家挪出 190px 触发半径，把「当天演出」留给 T3 显式触发。
  const p2c = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('town');
    const ev = await import('/src/systems/EventManager.ts');
    const rawSave = localStorage.getItem('return_star_save');
    const saveMarked = rawSave ? JSON.parse(rawSave)?.gameState?.triggeredEvents?.dryyard_xiya_photo === true : false;
    if (saveMarked || ev.hasTriggered('dryyard_xiya_photo')) return { photoEvt: true, already: true };
    if (!s.dryyardXiya) return { photoEvt: false, spawned: false };
    s.player.setPosition(s.dryyardXiya.x, s.dryyardXiya.y);
    const ret = s.tryDryyardXiyaInteract();
    const lines = s.storyDialogue?.lines ?? [];
    const open = s.storyDialogue?.isOpen?.() ?? false;
    const xiyaGone = !s.dryyardXiya;
    if (open) s.storyDialogue.skip(); // 一步推完夏雅对白（onComplete=updateHUD，无后续链）
    s.player.setPosition(400, 300); // 挪出晒场触发半径（距晒场中心 ~256px > 190px）
    return { ret, open, xiyaGone, lines: lines.length, photoEvt: ev.hasTriggered('dryyard_xiya_photo') };
  });
  console.log('t2c:', JSON.stringify(p2c));
  const p2cSave = await readSave();
  const photoEvtSave = p2cSave?.gameState?.triggeredEvents?.dryyard_xiya_photo === true;
  if (p2c.already) {
    check('T2 人际·夏雅照片（已落库）', p2c.photoEvt === true, '');
  } else {
    check('T2 人际·夏雅交互触发', p2c.ret === true, JSON.stringify(p2c));
    check('T2 人际·夏雅旧照片对白打开（7 句）', p2c.open === true && p2c.lines >= 7, JSON.stringify(p2c));
    check('T2 人际·夏雅照片事件落库 + 精灵销毁（存档取证）', photoEvtSave === true && p2c.xiyaGone === true, `存档=${photoEvtSave} 模块对照=${p2c.photoEvt} ${JSON.stringify(p2c)}`);
  }
  await sleep(700); // 等夏雅对白 150ms 淡出（期间 isOpen 保护住 checkDryyardAuto）

  // ── T3 当天演出：ready + 傍晚 → 三段对白链 → 永久落地 ──
  const p3 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    const ready = s.dryyardReady();
    s.player.setPosition(656, 300);
    s.checkDryyardAuto();
    return { ready, held: s.dryyardHeld, inCut: s.inDryyardCutscene, dlgOpen: s.storyDialogue?.isOpen?.() ?? false };
  });
  console.log('t3:', JSON.stringify(p3));
  check('T3 三类准备齐备（dryyardReady）', p3.ready === true, JSON.stringify(p3));
  check('T3 当天演出触发（dryyardHeld）', p3.held === true, '');
  check('T3 演出对白链打开', p3.dlgOpen === true, '');

  // 推进三段对白链（skip×3：傍晚晒场 → 夜晚长桌 → 灯塔回应 → dryyardPerm 落地）
  const permDone = await skipUntilPerm(15);
  await sleep(2200); // finale onComplete 里的 1800ms 延迟飘字
  const p3b = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('town');
    const ev = await import('/src/systems/EventManager.ts');
    return {
      perm: s.dryyardPerm === true,
      heldEvt: ev.hasTriggered('dryyard_held'),
      cutsceneEnded: s.inDryyardCutscene === false,
      envStage: s.dryyardEnvStage,
    };
  });
  const p3bSave = await readSave();
  const heldEvtSave = p3bSave?.gameState?.triggeredEvents?.dryyard_held === true;
  console.log('t3b:', JSON.stringify(p3b), 'skip-until-perm:', permDone, 't3b-save.held:', heldEvtSave);
  check('T3 永久变化落地（dryyardPerm）', p3b.perm === true, JSON.stringify(p3b));
  check('T3 dryyard_held 事件落库（存档取证）', heldEvtSave === true, `存档=${heldEvtSave} 模块对照=${p3b.heldEvt}`);
  check('T3 演出结束（cutscene 复位）', p3b.cutsceneEnded === true, '');

  // ── T4 永久变化：reload 白天 → 晒场重建 + 老张停留 + 收成时令台词 ──
  await seedDryyard(12, { dryyardUnlocked: true, dryyardEnvStage: 3, dryyardMaterialsDone: true, dryyardHeld: true, dryyardPerm: true },
    { dryyard_intro: true, dryyard_laozhang_craft: true, dryyard_xiya_photo: true, dryyard_afeng_help: true, dryyard_held: true });
  const p4 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    return {
      perm: s.dryyardPerm === true,
      envStage: s.dryyardEnvStage,
      laozhang: !!s.dryyardLaozhang,
      laozhangVisible: s.dryyardLaozhang?.visible ?? false,
      envBuilt: s.dryyardEnvBuilt,
    };
  });
  console.log('t4:', JSON.stringify(p4));
  check('T4 读档后 dryyardPerm 保持', p4.perm === true, '');
  check('T4 晒场环境满进度（stage3 全量重建）', p4.envStage === 3 && p4.envBuilt === 3, JSON.stringify(p4));
  check('T4 白天老张停留在晒场', p4.laozhang === true && p4.laozhangVisible === true, JSON.stringify(p4));

  // 老张收成时令台词（首次）
  const p4b = await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    s.player.setPosition(648, 288); // DRYYARD.laozhang
    const ret = s.tryDryyardLaozhangInteract();
    const lines = s.storyDialogue?.lines ?? [];
    const txt = JSON.stringify(lines);
    return { ret, first: txt.includes('放一放，不会坏'), n: lines.length };
  });
  console.log('t4b:', JSON.stringify(p4b));
  check('T4 老张首次收成时令台词', p4b.ret === true && p4b.first === true, JSON.stringify(p4b));
  await sleep(500);
  // 推完首次对白
  for (let i = 0; i < 6; i++) {
    const open = await page.evaluate(() => {
      const s = window.__game.scene.getScene('town');
      if (s?.storyDialogue?.isOpen?.()) { s.storyDialogue.skip(); return true; }
      return false;
    });
    if (!open) break;
    await sleep(400);
  }
  await sleep(500);

  // 日常台词（第二次）
  const p4c = await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    const ret = s.tryDryyardLaozhangInteract();
    const txt = JSON.stringify(s.storyDialogue?.lines ?? []);
    return { ret, daily: txt.includes('晒个三五天'), firstAgain: txt.includes('放一放') };
  });
  console.log('t4c:', JSON.stringify(p4c));
  check('T4 老张日常收成时令台词（首次不重放）', p4c.ret === true && p4c.daily === true && p4c.firstAgain === false, JSON.stringify(p4c));
  // 清对白状态
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.skip();
  });
  await sleep(600);

  // ── T5 读档保持（重放保护）──
  await seedDryyard(12, { dryyardUnlocked: true, dryyardEnvStage: 3, dryyardMaterialsDone: true, dryyardHeld: true, dryyardPerm: true },
    { dryyard_intro: true, dryyard_laozhang_craft: true, dryyard_xiya_photo: true, dryyard_afeng_help: true, dryyard_held: true, dryyard_laozhang_first: true });
  const p5 = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('town');
    const ev = await import('/src/systems/EventManager.ts');
    const laozhangDaily = (() => {
      s.player.setPosition(648, 288);
      const r = s.tryDryyardLaozhangInteract();
      const txt = JSON.stringify(s.storyDialogue?.lines ?? []);
      return r && txt.includes('晒个三五天');
    })();
    return {
      perm: s.dryyardPerm === true,
      held: s.dryyardHeld === true,
      introMarked: ev.hasTriggered('dryyard_intro'),
      boxInteractBlocked: s.dryyardHeld === true,
      laozhangDaily,
      envStage: s.dryyardEnvStage,
    };
  });
  console.log('t5:', JSON.stringify(p5));
  check('T5 reload 后永久状态保持', p5.perm === true && p5.held === true, JSON.stringify(p5));
  check('T5 当天已办后征集筐交互失效', p5.boxInteractBlocked === true, '');
  check('T5 永久期老张仍可交互（日常句）', p5.laozhangDaily === true, '');
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.skip();
  });
  await sleep(600);

  // ── T6 全镇回应（S6）：dryyard_held 后 NPC 日常台词切"晒场/过日子"分支 ──
  // 无 dryyard_held → 走集市热闹池（不含晒场）；有 dryyard_held → 镇长日常句含"晒场"
  await seedDryyard(12, {}, {}); // 基线：集市恢复，未办晒场
  const t6No = await page.evaluate(async () => {
    const npc = await import('/src/systems/NPCSystem.ts');
    const line = npc.getDailyNpcLine('elder', 3);
    return (line?.[0]?.text ?? '');
  });
  console.log('t6-no-held:', JSON.stringify(t6No));
  check('T6 未办晒场 → 镇长日常无"晒场"句', !t6No.includes('晒场'), t6No);

  await seedDryyard(12, { dryyardUnlocked: true, dryyardEnvStage: 3, dryyardMaterialsDone: true, dryyardHeld: true, dryyardPerm: true },
    { dryyard_intro: true, dryyard_laozhang_craft: true, dryyard_xiya_photo: true, dryyard_afeng_help: true, dryyard_held: true });
  const t6Yes = await page.evaluate(async () => {
    const npc = await import('/src/systems/NPCSystem.ts');
    const line = npc.getDailyNpcLine('elder', 3);
    return (line?.[0]?.text ?? '');
  });
  console.log('t6-held:', JSON.stringify(t6Yes));
  check('T6 晒场完成 → 镇长日常切"晒场"回应句', t6Yes.includes('晒场'), t6Yes);

  // 截图验收（永久期白天：晒场 + 木牌 + 老张）──
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    if (s?.cameras?.main) s.cameras.main.centerOn(656, 262);
  });
  await sleep(900);
  await page.screenshot({ path: join(SHOT_DIR, 'dryyard-permanent.png') });
  console.log('📸 永久晒场截图: tests/probes/test-screenshots/dryyard-permanent.png');

  // ── T7 无运行时错误（过滤另一 Agent 的 XIYA_BLOOM 中间态噪音与资源噪音）──
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension|XIYA_BLOOM|xiyaBloom/i.test(e));
  check('T6 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-dryyard 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-dryyard 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
