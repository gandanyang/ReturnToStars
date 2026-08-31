// 第二章《故人远来》探针 v1.0（2026-08-28）
// 护栏4：从第一天参与开发，每个子任务对应断言先绿。
// 对白检测：扫描所有活跃场景的 storyDialogue（DOM 单例可能被多场景共享）。

import puppeteer from 'puppeteer-core';

const BASE = process.env.PROBE_BASE || 'http://localhost:5199';
const URL = `${BASE}/?devHub=1`;

const checks = [];
function check(name, cond, extra = '') {
  checks.push({ name, ok: !!cond, extra });
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` (${extra})` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gotoTitle(page) {
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__game, { timeout: 5000 });
  await sleep(800);
}

async function markEvents(page, events) {
  return page.evaluate(async (evs) => {
    const mod = await import('/src/systems/EventManager.ts');
    for (const e of evs) mod.markTriggered(e);
  }, events);
}

async function enterScene(page, scene, x, y) {
  await page.evaluate(async ({ sk, x, y }) => {
    const g = window.__game;
    if (!g) return;
    const alive = g.scene.getScenes(true).some((s) => s.sys.settings.key === sk);
    if (!alive) g.scene.start(sk, { spawn: { x, y } });
    else {
      const s = g.scene.getScene(sk);
      s?.player?.setPosition?.(x, y);
    }
  }, { sk: scene, x, y });
  await sleep(1200);
}

/** 全局对白状态（扫描所有场景的 storyDialogue） */
async function dialogOpen(page) {
  return page.evaluate(() => {
    const scenes = window.__game?.scene?.getScenes(true) || [];
    for (const s of scenes) {
      if (s.storyDialogue?.isOpen?.()) return { open: true, scene: s.sys.settings.key };
    }
    return { open: false, scene: null };
  });
}

/** 推进对白直到关闭 + 静默等 400ms 让 callback 落地 */
async function advanceUntilClose(page, maxSteps = 30) {
  let steps = 0;
  for (let i = 0; i < maxSteps; i++) {
    const d = await dialogOpen(page);
    if (!d.open) { steps = i; break; }
    await page.keyboard.press('e');
    await sleep(300);
    steps = i + 1;
  }
  await sleep(400);
  return steps;
}

async function snap(page, scene) {
  return page.evaluate(async (sk) => {
    const s = window.__game?.scene?.getScenes(true)?.find((x) => x.sys.settings.key === sk);
    if (!s) return null;
    const ts = await import('/src/data/TimeSystem.ts');
    const t = ts.getTime();
    return {
      key: s.sys.settings.key,
      player: s.player ? { x: s.player.x, y: s.player.y } : null,
      time: { day: t.day, hour: t.hour, minute: t.minute },
      ch2LighthouseTalked: s.ch2LighthouseTalked,
      ch2ClockFixed: s.ch2ClockFixed,
      ch2PierRepaired: s.ch2PierRepaired,
      ch2CaptainGfx: !!s.ch2CaptainGfx,
      ch2StrangerSeen: s.ch2StrangerSeen,
      ch2StrangerAlive: s.ch2StrangerAlive,
      ch2NightTalkDone: s.ch2NightTalkDone,
      ch2XiyaSecretDone: s.ch2XiyaSecretDone,
      ch2BlackDotSeen: s.ch2BlackDotSeen,
    };
  }, scene);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1024,768'],
  });
  try {
    const page = await browser.newPage();
    await gotoTitle(page);

    // ---- P1 · 村民注意灯塔 ----
    await markEvents(page, ['lighthouseLit']);
    await page.evaluate(async () => { const ts = await import('/src/data/TimeSystem.ts'); ts.setTimeFull(1, 10, 0); });
    await enterScene(page, 'town', 408, 80);
    await sleep(1200);
    let s = await snap(page, 'town');
    check('P1: ch2LighthouseTalked=true', s?.ch2LighthouseTalked === true);
    await advanceUntilClose(page, 12); // 关闭 P1 的 3 行闲聊

    // ---- P2 · 修钟 ----
    await enterScene(page, 'town', 330, 150);
    await page.keyboard.press('e');
    await sleep(500);
    const p2steps = await advanceUntilClose(page, 30);
    s = await snap(page, 'town');
    console.log('  [P2] steps=' + p2steps);
    check('P2: ch2ClockFixed=true', s?.ch2ClockFixed === true);

    // ---- P3 · 老船长（跨场景：模块内存已含 ch2_clock_fixed）----
    // 先标记码头已修复（第一章 qinghe_pier_repaired），否则码头交互点（距船长 14px）抢先拦截
    await markEvents(page, ['qinghe_pier_repaired']);
    await enterScene(page, 'qinghe_river', 74, 330);
    await sleep(1500);
    s = await snap(page, 'qinghe_river');
    console.log('  [P3a]', JSON.stringify(s));
    check('P3a: ch2CaptainGfx 已生成（跨场景 hasTriggered 门控）', s?.ch2CaptainGfx === true);
    // 诊断：E 前后对白状态
    await page.keyboard.press('e');
    await sleep(500);
    const dbg = await dialogOpen(page);
    console.log('  [P3b] after E dialog=', JSON.stringify(dbg));
    const p3steps = await advanceUntilClose(page, 20);
    s = await snap(page, 'qinghe_river');
    console.log('  [P3b] steps=' + p3steps, JSON.stringify(s));
    check('P3b: ch2PierRepaired=true', s?.ch2PierRepaired === true);

    // ---- P4 · 旅人首刷（傍晚 town）----
    await markEvents(page, ['ch2_lighthouse_talked']);
    await page.evaluate(async () => { const ts = await import('/src/data/TimeSystem.ts'); ts.setTimeFull(1, 18, 0); });
    await enterScene(page, 'town', 344, 184);
    await sleep(1500);
    s = await snap(page, 'town');
    console.log('  [P4]', JSON.stringify(s));
    // 旅人靠近即自动触发对白 → ch2StrangerAlive 转 false、对白打开 → 推进后 seen=1
    const p4steps = await advanceUntilClose(page, 12);
    s = await snap(page, 'town');
    console.log('  [P4 after advance] steps=' + p4steps, JSON.stringify(s));
    check('P4: 旅人首遇完成 ch2StrangerSeen=1', s?.ch2StrangerSeen === 1);

    // ---- P5 · 夜谈 ----
    await markEvents(page, ['ch2_pier_repaired']);
    await page.evaluate(async () => { const ts = await import('/src/data/TimeSystem.ts'); ts.setTimeFull(1, 20, 0); });
    await enterScene(page, 'qinghe_river', 74, 330);
    await sleep(2000);
    s = await snap(page, 'qinghe_river');
    console.log('  [P5] pre-advance', JSON.stringify(s));
    const p5steps = await advanceUntilClose(page, 45);
    s = await snap(page, 'qinghe_river');
    console.log('  [P5] steps=' + p5steps, JSON.stringify(s));
    check('P5: ch2NightTalkDone=true', s?.ch2NightTalkDone === true);
    check('P6: ch2XiyaSecretDone=true', s?.ch2XiyaSecretDone === true);

    // ---- P7 · 海平线黑点（会话内直切 farm；出生点 (100,200)：x≤140 满足黑点判定，
    //       避开 house 门出口区 x80-128,y288-336，且避开 ch3 已开放的灯塔出口区 x36-64,y160-208）----
    await page.evaluate(async () => {
      const ts = await import('/src/data/TimeSystem.ts');
      ts.setTimeFull(1, 21, 0);
    });
    await enterScene(page, 'farm', 100, 200);
    await sleep(1800); // 黑点 2.6s 淡入
    s = await snap(page, 'farm');
    console.log('  [P7]', JSON.stringify(s));
    check('P7: ch2BlackDotSeen=true', s?.ch2BlackDotSeen === true);

    const passed = checks.filter((c) => c.ok).length;
    console.log(`\n=== ${passed}/${checks.length} passed ===`);
    if (passed < checks.length) process.exit(1);
  } finally {
    await browser.close();
  }
})();
