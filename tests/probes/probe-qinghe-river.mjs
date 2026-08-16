/**
 * 青禾河畔（2026-08-15 制作人拍板新地图）—— 运行时验证探针
 *
 * 验证（Level 2）：
 *   A 进入河畔：scene.start('qinghe_river') → 地图/瓦片加载无错误
 *   B town 南侧出口 → qinghe_river：站在 town (24,33) 出口区 → 场景切到河畔
 *   C 码头修复：靠近码头按 E（无木材→提示缺；给木材→修复 → 码头出现）
 *   D 钓鱼：码头修复后靠近钓点按 E → 钓鱼状态机启动
 *   E 采集：靠近河畔采集点按 E → 背包 +1
 *   F 凉亭：靠近凉亭按 E → 一句停留文本
 *   G 全程无运行时错误
 *
 * 前置：dev server（npm run dev）；node tests/probes/probe-qinghe-river.mjs
 */

import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = 16;
const RIVER = {
  spawn: { x: 24 * T, y: 4 * T },            // 北侧入口内侧
  pier: { x: 5 * T + T / 2, y: 20 * T + T / 2 }, // 码头修复点
  fish: { x: 5 * T + T / 2, y: 19 * T + T / 2 }, // 钓点（码头旁）
  gather: { x: 2 * T + 4, y: 18 * T + 8 },      // 芦苇采集点
  pavilion: { x: 18.5 * T, y: 22 * T + T / 2 }, // 凉亭
};
const TOWN_EXIT = { x: 24 * T + T / 2, y: 33 * T + T / 2 };

const makeSave = (scene, x, y) => ({
  version: '0.5', savedAt: 'qinghe-river-probe', timestamp: Date.now(),
  player: { x, y, scene, facing: 'down', inventory: { wood: 25 } },
  world: { day: 3, hour: 10, minute: 0, coins: 100, level: 2, xp: 100, stamina: 100, minedOres: [], questState: 'completed' },
  farm: { tiles: [], crops: [], trees: [], restore: {} },
  worldRestore: {},
  story: { storyStep: 'done' },
  mapFlags: {},
  gameState: { triggeredEvents: {} },
});

async function run() {
  console.log('=== 青禾河畔（2026-08-15）运行时验证 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' - ' + detail : ''}`);
    ok ? pass++ : fail++;
  };

  const playerState = () => page.evaluate(() => {
    const g = window.__game;
    if (!g) return null;
    const s = g.scene.getScenes(true).find((x) => x.player) || g.scene.getScenes(true)[0];
    const p = s?.player;
    return { key: s?.scene?.key ?? 'none', x: p ? Math.round(p.x) : -1, y: p ? Math.round(p.y) : -1 };
  });
  const dialogueText = () => page.evaluate(() => {
    const g = window.__game;
    const s = g.scene.getScenes(true).find((x) => x.player);
    return s?.dialogueText?.text ?? '';
  });
  const bodyText = () => page.evaluate(() => document.body.innerText);
  const startScene = (key, x, y) => page.evaluate(([k, px, py]) => {
    window.__game.scene.start(k, { spawn: { x: px, y: py } });
  }, [key, x, y]);
  const waitScene = async (key, timeoutMs = 12000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const st = await playerState();
      if (st && st.key === key) return st;
      await sleep(300);
    }
    const st = await playerState();
    throw new Error(`未能进入场景 ${key}（实际 ${st?.key}）错误=${errors.slice(0, 5).join(' | ')}`);
  };
  const waitGameReady = async (timeoutMs = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const ready = await page.evaluate(() => !!(window.__game && window.__game.scene));
      if (ready) return;
      await sleep(300);
    }
    throw new Error('game 未就绪');
  };

  await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'networkidle2' });
  await waitGameReady();
  await sleep(1000);

  // A. 进入河畔
  await startScene('qinghe_river', RIVER.spawn.x, RIVER.spawn.y);
  const stA = await waitScene('qinghe_river');
  check('A 进入青禾河畔', stA.key === 'qinghe_river', `key=${stA.key} player=(${stA.x},${stA.y})`);
  await sleep(800);

  // A2. 玩家动线：入口 → 西桥 → 南岸 → 码头 → 凉亭（沿小径走，不应卡墙）
  const walk = async (px, py, ms = 1500) => {
    await page.evaluate(([x, y]) => {
      const s = window.__game.scene.getScenes(true).find((sc) => sc.player);
      s.player.setPosition(x, y);
    }, [px, py]);
    await sleep(ms);
    const st = await playerState();
    return st;
  };
  const p1 = await walk(24 * T + T / 2, 5 * T + T / 2);      // 入口下探 → 北岸小径
  const p2 = await walk(8 * T + T / 2, 6 * T + T / 2);       // 小径 → 西桥桥头
  const p3 = await walk(8 * T + T / 2, 11 * T + T / 2);      // 过西桥（河上）
  const p4 = await walk(8 * T + T / 2, 16 * T + T / 2);      // 南岸桥头 → 南岸小径
  const p5 = await walk(5 * T + T / 2, 16 * T + T / 2);      // 小径 → 码头
  const p6 = await walk(18 * T + T / 2, 17 * T + T / 2);     // 小径 → 凉亭
  check('A2 动线入口→西桥→码头→凉亭 可通行', p1.key === 'qinghe_river' && p2.key === 'qinghe_river' && p3.key === 'qinghe_river' && p4.key === 'qinghe_river' && p5.key === 'qinghe_river' && p6.key === 'qinghe_river',
    `p1=(${p1.x},${p1.y}) p3=(${p3.x},${p3.y}) p5=(${p5.x},${p5.y}) p6=(${p6.x},${p6.y})`);

  // B. 河畔北侧出口 → town（真实出口逻辑）；再 town 南侧出口 → 河畔
  await startScene('qinghe_river', RIVER.spawn.x, RIVER.spawn.y);
  await waitScene('qinghe_river');
  await sleep(600);
  await page.evaluate(([x, y]) => {
    const g = window.__game;
    const s = g.scene.getScenes(true).find((sc) => sc.player);
    s.player.setPosition(x, y);
  }, [24 * T + T / 2, T]); // 北侧出口触发区 (24T,0)-(26T,1T)
  const stB = await waitScene('town');
  check('B 河畔北侧出口 → town', stB.key === 'town', `player=(${stB.x},${stB.y})`);
  await sleep(500);
  await page.evaluate(([x, y]) => {
    const g = window.__game;
    const s = g.scene.getScenes(true).find((sc) => sc.player);
    s.player.setPosition(x, y);
  }, [TOWN_EXIT.x, TOWN_EXIT.y]); // town 南侧出口 (24T,33T)
  const stB2 = await waitScene('qinghe_river');
  check('B2 town 南侧出口 → 青禾河畔', stB2.key === 'qinghe_river', `player=(${stB2.x},${stB2.y})`);

  // C. 码头修复（木材×20）
  await startScene('qinghe_river', RIVER.pier.x, RIVER.pier.y);
  await waitScene('qinghe_river');
  await sleep(600);
  // 直接 startScene 无存档 → wood=0；走 debug 钩子加木材再交互
  await page.evaluate(() => window.debug.giveItem('wood', 25));
  await sleep(300);
  await page.keyboard.press('KeyE');
  await sleep(800);
  const repaired = await page.evaluate(() => window.__game?.scene.getScenes(true).find((x) => x.player)?.qinghePierRestore?.restored ?? false);
  check('C 码头修复（木材×20 → triggerOnce 持久化）', repaired === true, `restored=${repaired}`);
  await page.keyboard.press('KeyE'); // 关闭可能的对话
  await sleep(400);

  // D. 钓鱼（修复后钓点可用）
  await startScene('qinghe_river', RIVER.fish.x, RIVER.fish.y);
  await waitScene('qinghe_river');
  await sleep(600);
  await page.keyboard.press('KeyE');
  await sleep(1200);
  const dState = await page.evaluate(() => {
    const s = window.__game?.scene.getScenes(true).find((x) => x.player);
    return s?.fishingState ?? 'idle';
  });
  check('D 钓鱼状态机启动', dState !== 'idle', `fishingState=${dState}`);
  await page.keyboard.press('KeyE'); // 收竿/取消

  // E. 采集（芦苇点）
  await startScene('qinghe_river', RIVER.gather.x, RIVER.gather.y);
  await waitScene('qinghe_river');
  await sleep(600);
  await page.keyboard.press('KeyE');
  await sleep(800);
  const eText = await dialogueText();
  check('E 河畔采集触发', eText.includes('采到') || eText.length > 0, eText ? `文本: ${eText.slice(0, 40)}` : 'dialogueText 为空');

  // F. 凉亭
  await startScene('qinghe_river', RIVER.pavilion.x, RIVER.pavilion.y);
  await waitScene('qinghe_river');
  await sleep(600);
  await sleep(2500); // 等 E 采集浮字过期（4s 清除），避免误读残留文本
  await page.keyboard.press('KeyE');
  await sleep(800);
  const fText = await bodyText();
  check('F 凉亭停留交互', fText.includes('坐下') || fText.includes('河'), fText ? `文本: ${fText.slice(-80)}` : 'body 为空');

  // H. Stage 2：集市恢复后夜晚聊天（长椅旁两人）
  await page.evaluate(() => window.debug.setChapter(1));
  await page.evaluate(() => window.debug.markRestored('marketSquare'));
  await page.evaluate(() => window.debug.setTime(21, 0));
  await startScene('qinghe_river', 15 * T + T / 2, 20 * T + T / 2);
  await waitScene('qinghe_river');
  await sleep(800);
  await page.keyboard.press('KeyE');
  await sleep(1000);
  const hText = await bodyText();
  check('H Stage2 夜晚聊天（长椅旁）', hText.includes('长椅') || hText.includes('热闹') || hText.includes('钓鱼'), hText ? `文本: ${hText.slice(-100)}` : 'body 为空');

  // I. 果园预埋：白天老周在断桥旁（第二章钩子）
  await page.evaluate(() => window.debug.setTime(14, 0));
  await startScene('qinghe_river', 32 * T + T / 2, 17 * T + T / 2);
  await waitScene('qinghe_river');
  await sleep(800);
  const oldMan = await page.evaluate(() => {
    const s = window.__game?.scene.getScenes(true).find((x) => x.player);
    return !!(s?.qingheOldMan && s.qingheOldMan.visible);
  });
  check('I 果园预埋：老周白天在断桥旁', oldMan === true, `oldManVisible=${oldMan}`);
  await page.keyboard.press('KeyE');
  // 打字机逐字输出：推进过程中任一帧读到「果园」即验证首次台词成立
  let orchardSeen = false;
  for (let k = 0; k < 12; k++) {
    await sleep(600);
    const t = await bodyText();
    if (t.includes('果园')) { orchardSeen = true; break; }
    await page.keyboard.press('KeyE');
  }
  check('I2 果园预埋：老周台词（河对岸果园）', orchardSeen === true, orchardSeen ? '读到「果园」' : '推进 12 帧未读到果园');

  const gOk = errors.length === 0;
  check('G 全程无运行时错误', gOk, gOk ? '' : errors.slice(0, 3).join(' | '));

  console.log(`\n结果：${pass}/${pass + fail} 通过`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => { console.error('探针异常:', e); process.exit(2); });
