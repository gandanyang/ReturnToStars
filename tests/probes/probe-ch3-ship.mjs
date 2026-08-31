/**
 * probe-ch3-ship.mjs — 第三章幕三「来船靠岸 + 商业化冲突开局」验收探针
 *
 * 验收目标（方向稿 幕三；来船性质留白不解答——B 不是反派，冲突=被看见 vs 被记住）：
 *   S1 触发：ch2_black_dot + ch3_lighthouse_arrival + 夜 19-23 + 码头一带 → 靠岸演出打开
 *   S2 台词：旅人登场（相机/「值得被外面的人看见」）+ 老船长注脚（不解释船的性质）
 *   S3 常驻：演出完成后外来船视觉 + 旅人 NPC 在场
 *   S4 交互：旅人日常轮换（候选 ch3_stranger）
 *   S5 一次性：triggerOnce 幂等（重进不重播靠岸）
 * 附加  无页面错误
 *
 * 前置：ch2 全节拍 + ch3_lighthouse_arrival 已标记
 * 运行：node tests/probes/probe-ch3-ship.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.PROBE_BASE || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: 'new',
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0, fail = 0;
function result(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}
const warns = [];
page.on('pageerror', (e) => warns.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') warns.push('console: ' + m.text()); });

function seed() {
  const save = {
    version: '0.5', savedAt: 'ch3-ship', timestamp: Date.now(),
    player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: {} },
    world: { day: 9, hour: 20, minute: 0, coins: 500, level: 2, xp: 180, stamina: 100, minedOres: [] },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
    chapter: 1,
    worldRestore: { oldHouse: true, marketSquare: true },
    gameState: { triggeredEvents: {
      ch1_awakening: true, ch1_elder_visit: true, ch1_spring_fair: true,
      lighthouse_lit_seen: true, ch2_lighthouse_talked: true, ch2_clock_fixed: true,
      ch2_pier_repaired: true, ch2_night_talk: true, ch2_xiya_secret: true,
      ch2_black_dot: true, ch3_lighthouse_arrival: true,
    } },
  };
  return page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
}

async function waitScene(key, timeout = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate((k) => {
      const s = window.__game?.scene?.getScene?.(k);
      return !!s && !!s.player && s.scene.isActive();
    }, key);
    if (ok) return true;
    await sleep(300);
  }
  return false;
}

async function sceneText() {
  return page.evaluate(() => window.__game.scene.getScene('qinghe_river')?.dialogueText?.text ?? '');
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await seed();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2200);
  await page.keyboard.press('Enter'); // 检测到存档 → 自动继续
  await waitScene('farm');

  // ============ S1 触发：夜 + 码头一带 → 靠岸演出 ============
  await page.evaluate(() => { window.__game.scene.start('qinghe_river', { spawn: { x: 120, y: 300 } }); });
  await waitScene('qinghe_river');
  await sleep(1200);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('qinghe_river');
    s.player.x = 100; s.player.y = 320; // 码头一带（captain 220px 内）
    if (s.player.body) s.player.body.reset(100, 320);
  });
  let opened = false;
  for (let i = 0; i < 12 && !opened; i++) {
    await sleep(900);
    opened = await page.evaluate(() => window.__game.scene.getScene('qinghe_river').storyDialogue?.isOpen?.() ?? false);
  }
  result('S1 靠岸演出打开（黑点+灯塔开放+夜+码头）', opened === true, `opened=${opened}`);

  // ============ S2 台词：旅人登场 + 老船长注脚 ============
  let full = '';
  for (let i = 0; i < 10; i++) {
    full += '\n' + await page.evaluate(() => document.body.innerText);
    await page.evaluate(() => window.__game.scene.getScene('qinghe_river').storyDialogue?.advance());
    await sleep(450);
  }
  result('S2a 旅人登场台词（相机/值得被看见）', full.includes('带着相机') && full.includes('值得被外面的人看见'),
    full.slice(-70));
  result('S2b 老船长注脚（不解释船的性质）', full.includes('别踩坏栈板') && !full.includes('船是'), '');
  await page.evaluate(() => window.__game.scene.getScene('qinghe_river').storyDialogue?.skip());
  await sleep(800);

  // ============ S3 常驻：船 + 旅人 NPC ============
  const s3 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('qinghe_river');
    return { ship: s.ch3ShipGfx.length > 0, npc: s.ch3StrangerNpcGfx.length > 0 };
  });
  result('S3 常驻：外来船视觉 + 旅人 NPC 在场', s3.ship && s3.npc, JSON.stringify(s3));

  // ============ S4 旅人日常交互 ============
  // 扫描偏移：既要 canTryCh3Stranger 为真，又不能落进采集点/钓鱼点半径（采到了野莓=撞采集）
  await page.evaluate(async () => {
    const ts = await import('/src/data/TimeSystem.ts');
    ts.setTimeFull(9, 20, 0); // 避开 21:00 夜晚疲劳提示拦截（Action Time）
  });
  await sleep(300);
  const sPos = { x: 120, y: 332 };
  let t4 = '';
  let s4ok = false;
  for (const [dx, dy] of [[24, -8], [-24, -8], [0, 20], [20, 12], [-20, 12], [32, 0], [-32, 0], [0, -20]]) {
    await page.evaluate(([px, py, ddx, ddy]) => {
      const s = window.__game.scene.getScene('qinghe_river');
      s.player.x = px + ddx; s.player.y = py + ddy;
      if (s.player.body) s.player.body.reset(s.player.x, s.player.y);
    }, [sPos.x, sPos.y, dx, dy]);
    const reach = await page.evaluate(() => {
      const s = window.__game.scene.getScene('qinghe_river');
      return !!s.canTryCh3Stranger();
    });
    if (!reach) continue;
    for (let attempt = 0; attempt < 3 && !s4ok; attempt++) {
      await page.evaluate(() => {
        const b = document.querySelector('#touch-controls [data-action="interact"]');
        if (b) b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      });
      await sleep(700);
      t4 = await sceneText();
      if (t4.includes('拍')) { s4ok = true; break; }
      // 抢占兜底：整点日常事件随机对白（30%）/ 疲劳提示 → 跳过后拨回时间重试
      await page.evaluate(() => {
        const s = window.__game.scene.getScene('qinghe_river');
        s.storyDialogue?.skip();
        import('/src/data/TimeSystem.ts').then((ts) => ts.setTimeFull(9, 20, 0));
      });
      await sleep(600);
    }
    if (s4ok) break;
  }
  result('S4 旅人日常：轮换短句（候选拍钉子）', s4ok, t4.slice(-70));

  // ============ S6-S8 幕三后半：岛屿记录计划（B 提案→拍照→照片钉柱） ============
  // 旅人第 2/3 次日常（推进轮换到第 4 次提案）
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.__game.scene.getScene('qinghe_river').storyDialogue?.skip());
    await sleep(400);
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('qinghe_river');
      s.player.x = 120; s.player.y = 344; s.player.body && s.player.body.reset(120, 344);
    });
    await sleep(300);
    await page.evaluate(() => {
      const b = document.querySelector('#touch-controls [data-action="interact"]');
      if (b) b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    await sleep(800);
    await page.evaluate(() => window.__game.scene.getScene('qinghe_river').storyDialogue?.skip());
    await sleep(400);
  }
  // 第 4 次：提案演出（拍一张"有人在生活"的照片）
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('qinghe_river');
    s.player.x = 120; s.player.y = 344; s.player.body && s.player.body.reset(120, 344);
  });
  await sleep(300);
  await page.evaluate(() => {
    const b = document.querySelector('#touch-controls [data-action="interact"]');
    if (b) b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  });
  await sleep(900);
  let s6full = '';
  for (let i = 0; i < 6; i++) {
    s6full += '\n' + await page.evaluate(() => document.body.innerText);
    await page.evaluate(() => window.__game.scene.getScene('qinghe_river').storyDialogue?.advance());
    await sleep(450);
  }
  result('S6 B 提案：岛屿记录计划（有人在生活的照片）', s6full.includes('有人在生活的那种'), s6full.slice(-70));
  // 第 5 次：拍照完成 → 照片钉柱
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('qinghe_river');
    s.player.x = 120; s.player.y = 344; s.player.body && s.player.body.reset(120, 344);
  });
  await sleep(300);
  await page.evaluate(() => {
    const b = document.querySelector('#touch-controls [data-action="interact"]');
    if (b) b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  });
  await sleep(900);
  let s7full = '';
  for (let i = 0; i < 8; i++) {
    s7full += '\n' + await page.evaluate(() => document.body.innerText);
    await page.evaluate(() => window.__game.scene.getScene('qinghe_river').storyDialogue?.advance());
    await sleep(450);
  }
  const s7 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('qinghe_river');
    return {
      photo: !!s.ch3PhotoPinnedGfx,
      marked: window.debug.events.hasTriggered('ch3_b_photo'),
    };
  });
  result('S7 拍照完成：照片钉柱（D-012 痕迹）+ 入档', s7.photo && s7.marked, JSON.stringify(s7));
  result('S8 B 冲突留白句（不急。听听大家的想法）', s7full.includes('听听大家的想法'), s7full.slice(-70));

  // ============ S5 一次性：切走再回来不重播靠岸 ============
  await page.evaluate(() => { window.__game.scene.start('farm', { spawn: { x: 240, y: 96 } }); });
  await waitScene('farm');
  await page.evaluate(() => { window.__game.scene.start('qinghe_river', { spawn: { x: 120, y: 300 } }); });
  await waitScene('qinghe_river');
  await sleep(3500); // 超过触发+1.2s 延迟窗口：已标记 → 不重播
  const s5 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('qinghe_river');
    return { open: s.storyDialogue?.isOpen?.() ?? false, queued: s.ch3ShipQueued };
  });
  result('S5 一次性：重进 qinghe_river 不重播靠岸', s5.open === false && s5.queued === false, JSON.stringify(s5));

  // ============ S9-S10 幕三后半：照片传到镇上（注脚级，走向不决定） ============
  await page.evaluate(() => { window.__game.scene.start('town', { spawn: { x: 32 * 16 + 8, y: 17 * 16 } }); });
  await waitScene('town');
  await sleep(2600); // 触发 1.1s 延迟 + 演出打开
  const s9 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    return { open: s.storyDialogue?.isOpen?.() ?? false, photo: !!s.ch3BoardPhotoGfx };
  });
  result('S9 镇民注脚演出打开 + 板旁小照片常驻', s9.open === true && s9.photo === true, JSON.stringify(s9));
  let s10full = '';
  for (let i = 0; i < 8; i++) {
    s10full += '\n' + await page.evaluate(() => document.body.innerText);
    await page.evaluate(() => window.__game.scene.getScene('town').storyDialogue?.advance());
    await sleep(450);
  }
  result('S10 注脚台词：镇长收束 + 夏雅立场（不决定走向）',
    s10full.includes('急不得') && s10full.includes('不是拍给人看的') && s10full.includes('没打算催'),
    s10full.slice(-70));
  await page.evaluate(() => window.__game.scene.getScene('town').storyDialogue?.skip());
  await sleep(400);
  const s10b = await page.evaluate(() => window.debug.events.hasTriggered('ch3_town_react'));
  result('S10b ch3_town_react 入档', s10b === true, `marked=${s10b}`);

  // ============ 附加 ============
  result('附加 无页面错误', warns.length === 0, warns.join('; ').slice(0, 160));
} catch (e) {
  console.log('\n❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-ch3-ship 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
