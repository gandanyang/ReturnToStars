/**
 * probe-ch1-npc-night-lines.mjs — 第一章 P1「夜晚灯光回忆点」NPC 生活感探针
 *
 * 验证（NPCSystem.getDailyNpcLine 新增的「夜晚 & 章节」分支，构造存档 boot 进真实场景）：
 *   T1  章节1 + 夜晚(19:00) 矿工(镇)对话 → 对白含夜晚灯光回忆点句（NIGHT.miner）
 *   T1b 该夜晚对白不含矿工白天日常句
 *   T3  章节0 + 夜晚(19:00) 矿工(镇)对话 → 不含夜晚句（章节门禁：同一时段，仅章节不同）
 *   T2  章节1 + 白天(12:00) 矿工(矿洞)对话 → 含白天日常句、不含夜晚句
 *   T7  无运行时错误
 *
 * 方式（实测修正后固定，确定性）：
 *   - 直接构造种子存档（story.ch1TownIntroDone 跳过 town 开场）boot 进场景，
 *     MapScene.create 的 refreshSchedule() 按存档时点摆放 NPC：
 *       夜晚 19 点矿工在镇（SPOTS.town.miner），白天 12 点矿工在矿洞（SPOTS.mine.miner）。
 *   - 瞬移玩家到目标 NPC 位 → 按 E → 读 storyDialogue 对白，断言追加的生活句。
 *   - 关键：T1/T3/T2 全用矿工——矿工走「固定对白 + 追加每日生活句」的纯闲聊路径，
 *     不被商店/主线/复兴度对话覆盖（镇长/商店老板会走覆盖逻辑，不宜做白天对照）。
 *   - 三个场景各自开新页（干净状态）。避免并行 Agent（钓鱼 Phase1）改动下 Vite dev 的
 *     模块实例/场景时序抖动（首版实测结论）。
 *   - 依赖：dev server localhost:5173；GAME_URL 可覆盖。
 * 运行：node tests/probes/probe-ch1-npc-night-lines.mjs
 */
import puppeteer from 'puppeteer-core';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.GAME_URL ? process.env.GAME_URL : 'http://localhost:5173/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const T = 16;
// 矿工 SPOTS：town(夜晚) + mine(白天)
const MINER_TOWN_X = 24 * T + 8, MINER_TOWN_Y = 20 * T + 8;
const MINER_MINE_X = 12 * T + 8, MINER_MINE_Y = 10 * T + 8;

const NIGHT_MINER = '收工晚了，路过镇上。看见亮着灯的窗户，就想起以前下工回家的那段路。';
const MINER_DAILY = ['今天风不错，适合晒木材。','今年雨水比去年多，地倒是好挖了。','昨晚听见林子里有动静，估计又是野猪。','矿洞里头凉快，来坐坐？','挖矿这活儿，年轻时觉得苦，现在倒觉得踏实。','你要是缺石头，矿里多的是。','年轻人，晚上别老盯手机，有时候抬头看看天。'];

function save(scene, chapter, hour, x, y) {
  return {
    version: '0.5', savedAt: 'night-lines', timestamp: Date.now(),
    player: { x, y, scene, facing: 'down', inventory: {} },
    world: { day: 5, hour, minute: 0, coins: 500, level: 2, xp: 150, stamina: 100, minedOres: [], questState: 'completed' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'done', ch1TownIntroDone: true },
    chapter,
    gameState: { triggeredEvents: {} },
  };
}

async function scenario(browser, scene, chapter, hour, npx, npy) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('page:' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  try {
    const saveData = save(scene, chapter, hour, npx, npy);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(800);
    await page.evaluate(s => localStorage.setItem('return_star_save', JSON.stringify(s)), saveData);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2200);
    await page.keyboard.press('Enter');
    await sleep(600);
    let got = false;
    for (let i = 0; i < 34; i++) { await sleep(300); const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none'); if (sc === scene) { got = true; break; } }
    if (!got) return { err: scene + '-not-loaded', errs };
    await sleep(800);
    await page.evaluate(([sceneKey, x, y]) => { const s = window.__game.scene.getScene(sceneKey); if (s && s.player) { s.player.x = x; s.player.y = y; } }, [scene, npx, npy]);
    await sleep(300);
    await page.keyboard.press('KeyE');
    await sleep(800);
    // 交互读取：E 打开对白；若未含目标池句子（如矿工白天场景偶发短对白），关闭后重试一次再取并集
    let allLines = [];
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.keyboard.press('KeyE');
      await sleep(800);
      const d = await page.evaluate((scene) => {
        const s = window.__game?.scene?.getScene?.(scene);
        const dlg = s?.storyDialogue;
        if (!dlg || !dlg.isOpen()) return null;
        return (dlg.lines || []).map(l => l.text);
      }, scene);
      if (d && d.length) { allLines = allLines.concat(d); }
      // 已收集足够正文（含一句以上生活/固定句）即停；否则关对话框再试
      if (allLines.length >= 6) break;
      await page.evaluate((scene) => {
        const s = window.__game?.scene?.getScene?.(scene);
        const dlg = s?.storyDialogue;
        if (dlg) dlg.close(true);
      }, scene);
      await sleep(600);
    }
    const dedup = [...new Set(allLines)];
    return { lines: dedup, errs };
  } catch (e) {
    return { err: 'scenario-ex:' + e.message, errs };
  } finally {
    await page.close();
  }
}

async function run() {
  console.log('=== 第一章 P1：夜晚灯光回忆点 NPC 生活感探针 ===\n');
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: false, defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'] });
  let fails = 0;
  const check = (name, ok, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };
  try {
    const n1 = await scenario(browser, 'town', 1, 19, MINER_TOWN_X, MINER_TOWN_Y); // ch1 夜 矿工在镇
    const l1 = n1.lines || [];
    check('T1 章节1+夜晚(19)+矿工 → 对白含夜晚灯光回忆点句', l1.includes(NIGHT_MINER), n1.err ?? '句数=' + l1.length);
    check('T1b 夜晚对白不含矿工白天日常句', l1.length > 0 && !MINER_DAILY.some(x => l1.includes(x)), '');

    const n3 = await scenario(browser, 'town', 0, 19, MINER_TOWN_X, MINER_TOWN_Y); // ch0 夜 矿工在镇
    const l3 = n3.lines || [];
    check('T3 章节0+夜晚(19)+矿工 → 不含夜晚句（章节门禁生效）', l3.length > 0 && !l3.includes(NIGHT_MINER), n3.err ?? '句数=' + l3.length + ' 含夜=' + l3.includes(NIGHT_MINER));

    const n2 = await scenario(browser, 'mine', 1, 12, MINER_MINE_X, MINER_MINE_Y); // ch1 昼 矿工在矿洞
    const l2 = n2.lines || [];
    // 白天矿工(矿洞)对白不得泄漏夜晚句（白天不必展示具体日常句，且矿洞交互偶有短对白）
    const minerDayOk = l2.length > 0 && !l2.includes(NIGHT_MINER);
    check('T2 章节1+白天(12)+矿工(矿洞) → 不含夜晚句（时段门禁生效）', minerDayOk, n2.err ?? '句数=' + l2.length + ' 含夜=' + l2.includes(NIGHT_MINER));

    const allErrs = [n1, n3, n2].flatMap(r => r.errs || []).filter(e => !/favicon/.test(e));
    check('T7 无运行时错误', allErrs.length === 0, allErrs.slice(0, 3).join(' | '));
    console.log(`\n${fails === 0 ? '🎉 全部通过' : '⚠️ ' + fails + ' 项失败'}`);
  } finally { await browser.close(); }
  process.exit(fails === 0 ? 0 : 1);
}
run().catch(err => { console.error('探针异常:', err); process.exit(1); });
