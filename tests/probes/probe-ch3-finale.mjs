/**
 * probe-ch3-finale.mjs — 第三章 幕三后半冲突展开 + 幕四（碎片×3/日记）+ 幕五（三结局）验收探针
 *
 * 拍板（2026-08-31）：A1（分化+镇长搁置）/ B1（碎片×3 渐进）/ C1（爷爷不是预言，是相信"总会有人回来"）
 *                    / D2（三结局·行为承载·无选项面板）/ E1（来船=B 的船，不开谜团）
 *
 * 断言：
 *   L0 灯塔链阶段1：亮灯后路过 farm 西侧 → "玻璃被擦过"（真实窗口：亮灯后→节拍1 前）
 *   C1-C3 三机位注脚 + 拍完收摊
 *   M  碰面（qinghe 码头）：保留句「船停着，人住着，慢慢看。」+ 镇长「灯下再议」
 *   D0 碎片①（灯塔内）→ D1 日记段2（栈板尽头）→ D2 碎片②（qinghe）→ D3 日记段3（海湾缺口）
 *   → D4 碎片③（farm）→ D5 灯室结算（C1 正文锚词 + 铭牌回声）
 *   F  归位窗口（夜 21+：「三个方向都在脚边」·无选项面板）
 *   E1 返城（上船）／E2 桥（日志留灯塔）／E3 留岛（睡床）——三分支各自入档
 * 附加  无页面错误
 *
 * 探针避坑（本项目实录）：
 *   ① SceneManager.start 不停旧场景——切换后必须手动 stop 其它场景，并按 mapKey 取场景实例；
 *   ② 写种子前先 stop 全部场景（SHUTDOWN 移除 beforeunload/pagehide 自动存档监听），
 *      否则旧页面卸载时会把内存态写回 localStorage 覆盖种子；
 *   ③ showDialogueText 是场景内 Phaser 文本——断言读 s.dialogueText.text，不读 DOM；
 *   ④ StoryDialogue 文本断言走 DOM innerText + advance() 推进；
 *   ⑤ qinghe 夜里交互先 setTimeFull(9,20,0) 避开 21:00 疲劳提示；随机日常对白用 skip+重试兜底。
 *
 * 运行：node tests/probes/probe-ch3-finale.mjs
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

const CH2_DONE = {
  ch1_awakening: true, ch1_elder_visit: true, ch1_spring_fair: true,
  lighthouse_lit_seen: true, ch2_lighthouse_talked: true, ch2_clock_fixed: true,
  ch2_pier_repaired: true, ch2_night_talk: true, ch2_xiya_secret: true, ch2_black_dot: true,
  ch3_lighthouse_arrival: true, ch3_ship_arrived: true, ch3_b_photo: true, ch3_town_react: true,
};

/** 写种子并重载（先停全部场景：SHUTDOWN 移除自动存档监听，防覆盖） */
async function seedAndReload(flags, hour = 20) {
  await page.evaluate(() => {
    for (const s of window.__game?.scene?.getScenes(true)) window.__game?.scene?.stop(s.scene.key);
  });
  await sleep(400);
  const save = {
    version: '0.5', savedAt: 'ch3-finale', timestamp: Date.now(),
    player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: { wood: 20 } },
    world: { day: 9, hour, minute: 0, coins: 500, level: 2, xp: 180, stamina: 100, minedOres: [] },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
    chapter: 1,
    worldRestore: { oldHouse: true, marketSquare: true },
    gameState: { triggeredEvents: flags },
  };
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2200);
  await page.keyboard.press('Enter'); // 检测到存档 → 自动继续
  await waitScene('farm');
  await page.evaluate(() => {
    for (const s of window.__game?.scene?.getScenes(true)) {
      if (s.scene.key !== 'farm') window.__game?.scene?.stop(s.scene.key);
    }
  });
  await sleep(800);
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

/** 场景切换（start + 停其它场景 + 传送； SceneManager.start 不停旧场景，须手动停） */
async function teleport(mapKey, x, y) {
  await page.evaluate(([mk, px, py]) => {
    const cur = window.__game?.scene?.getScenes(true).find((s) => s.player);
    if (!cur || cur.scene.key !== mk) window.__game?.scene?.start(mk, { spawn: { x: px, y: py } });
    for (const s of window.__game?.scene?.getScenes(true)) {
      if (s.scene.key !== mk) window.__game?.scene?.stop(s.scene.key);
    }
    const s = window.__game?.scene?.getScene(mk);
    if (s?.player) { s.player.x = px; s.player.y = py; if (s.player.body) s.player.body.reset(px, py); }
  }, [mapKey, x, y]);
  await waitScene(mapKey);
  await sleep(600);
}

/** 白盒直调目标场景方法 */
async function callOn(mapKey, fn) {
  return page.evaluate(([mk, f]) => {
    const s = window.__game?.scene?.getScene(mk);
    if (!s || typeof s[f] !== 'function') return 'no_fn';
    return s[f]();
  }, [mapKey, fn]);
}

/** 按 E 交互（真实路由） */
async function interact() {
  await page.evaluate(() => {
    const b = document.querySelector('#touch-controls [data-action="interact"]');
    if (b) b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  });
  await sleep(800);
}

/** 场景内 showDialogueText 文本（Phaser 文本，不进 DOM） */
async function sceneText(mapKey) {
  return page.evaluate((mk) => window.__game?.scene?.getScene(mk)?.dialogueText?.text ?? '', mapKey);
}

/** StoryDialogue DOM 文本累积（advance ×n） */
async function advanceStory(mapKey, n = 8) {
  let full = '';
  for (let i = 0; i < n; i++) {
    full += '\n' + await page.evaluate((mk) => document.body.innerText, mapKey);
    await page.evaluate((mk) => window.__game?.scene?.getScene(mk)?.storyDialogue?.advance(), mapKey);
    await sleep(420);
  }
  return full;
}

async function skipStory(mapKey) {
  await page.evaluate((mk) => window.__game?.scene?.getScene(mk)?.storyDialogue?.skip(), mapKey);
  await sleep(500);
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(1500);
  // ================= Phase L0：灯塔链·阶段1（亮灯后→节拍1 前的真实窗口） =================
  await seedAndReload({
    ch1_awakening: true, lighthouse_lit_seen: true,
    ch2_lighthouse_talked: false, ch2_black_dot: false,
    ch3_lighthouse_arrival: false, ch3_ship_arrived: false,
  }, 12);
  await teleport('farm', 60, 176);
  await interact();
  const lt = await sceneText('farm');
  result('L0 灯塔链阶段1：玻璃被擦过（真实窗口内触发）', lt.includes('被人擦过了'), lt.slice(-60));

  // ================= Phase A：幕三后半（三机位 → 碰面） =================
  await seedAndReload(Object.assign({}, CH2_DONE, {}));
  await teleport('town', 34 * 16, 16.5 * 16);
  await interact();
  let t = await sceneText('town');
  result('C1 集市机位：注脚 + 触发', t.includes('集市，第 3 卷'), t.slice(-60));

  await teleport('farm', 11 * 16, 20.5 * 16);
  await callOn('farm', 'tryCh3ArchiveInteract');
  t = await sceneText('farm');
  result('C2 老屋机位：注脚 + 触发', t.includes('老屋，第 3 卷'), t.slice(-60));

  await teleport('lighthouse', 12 * 16, 10.5 * 16);
  await callOn('lighthouse', 'tryCh3ArchiveInteract');
  t = await sceneText('lighthouse');
  result('C3 灯塔机位：注脚 + 触发', t.includes('灯，第 1 卷'), t.slice(-60));

  // M 碰面：qinghe 码头（夜）
  await page.evaluate(async () => {
    const ts = await import('/src/data/TimeSystem.ts');
    ts.setTimeFull(9, 21, 0);
  });
  await teleport('qinghe_river', 100, 320);
  await sleep(2500); // armed → 码头触发 + 打开
  const meet = await advanceStory('qinghe_river', 14);
  result('M 碰面：保留句 + 镇长灯下再议（幕四钩子）',
    meet.includes('船停着，人住着，慢慢看') && meet.includes('灯下再议'), meet.slice(-80));
  await skipStory('qinghe_river');

  // ================= Phase B：幕四（碎片×3 渐进 + 日记 + 结算） =================
  await teleport('lighthouse', 250, 176); // 碎片①：灯塔内（碰面后可见）
  await callOn('lighthouse', 'tryCh3ShardInteract');
  t = await sceneText('lighthouse');
  result('D0 碎片①（灯塔内）：拾取', t.includes('星屑入手微凉'), t.slice(-60));

  await teleport('lighthouse', 10 * 16 + 8, 13 * 16 + 8); // 日志锚点
  await callOn('lighthouse', 'tryLighthouseInteract'); // → diary 分流（段2）
  const d1 = await advanceStory('lighthouse', 6);
  result('D1 日记段2：指引栈板尽头', d1.includes('栈板尽头'), d1.slice(-60));
  await skipStory('lighthouse');

  await teleport('qinghe_river', 150, 342); // 碎片②：栈板尽头（段2 后可见）
  await callOn('qinghe_river', 'tryCh3ShardInteract');
  t = await sceneText('qinghe_river');
  result('D2 碎片②（qinghe）：拾取', t.includes('星屑入手微凉'), t.slice(-60));

  await teleport('lighthouse', 10 * 16 + 8, 13 * 16 + 8);
  await callOn('lighthouse', 'tryLighthouseInteract'); // → 段3
  const d3 = await advanceStory('lighthouse', 6);
  result('D3 日记段3：指引海湾缺口', d3.includes('海湾缺口'), d3.slice(-60));
  await skipStory('lighthouse');

  await teleport('farm', 60, 202); // 碎片③：海湾缺口（段3 后可见）
  await callOn('farm', 'tryCh3ShardInteract');
  t = await sceneText('farm');
  result('D4 碎片③（farm）：拾取', t.includes('星屑入手微凉'), t.slice(-60));

  // D5 灯室结算（C1 正文）
  await teleport('lighthouse', 15 * 16, 11 * 16);
  await sleep(2200); // 结算入队 1.2s + 打开
  const finale = await advanceStory('lighthouse', 12);
  result('D5 灯室结算：C1 正文锚词（不是在等我 / 等"有人"）',
    finale.includes('不是在等我') && finale.includes('等"有人"'), finale.slice(-80));
  result('D5b 结算呼应铭牌：守则的收口', finale.includes('不是写给船的'), finale.slice(-60));
  await skipStory('lighthouse');

  // ================= Phase C：幕五（归位窗口） =================
  await page.evaluate(async () => {
    const ts = await import('/src/data/TimeSystem.ts');
    ts.setTimeFull(9, 21, 30);
  });
  let fopen = '';
  for (let i = 0; i < 8 && !fopen; i++) {
    await sleep(900);
    const open = await page.evaluate(() => window.__game?.scene?.getScene('lighthouse').storyDialogue?.isOpen?.() ?? false);
    if (open) fopen = await advanceStory('lighthouse', 5);
  }
  result('F 归位窗口：三个方向都在脚边（无选项面板）', fopen.includes('三个方向都在脚边'), fopen.slice(-60));
  await skipStory('lighthouse');

  // ================= Phase D：结局一（返城=上船） =================
  await teleport('qinghe_river', 150, 348);
  await callOn('qinghe_river', 'tryCh3EndShipInteract');
  const endLeave = await advanceStory('qinghe_river', 8);
  result('E1 返城结局（上船）', endLeave.includes('第三章·归位——完') && endLeave.includes('我会知道这里在哪里'),
    endLeave.slice(-70));

  // ================= Phase E：结局二（桥=留日志） =================
  await seedAndReload(Object.assign({}, CH2_DONE, {
    ch3_diary_finale: true, ch3_finale_open: true,
  }), 21);
  await teleport('lighthouse', 10 * 16 + 8, 13 * 16 + 8);
  await callOn('lighthouse', 'tryLighthouseInteract'); // 归位期日志交互 = 桥
  const endBridge = await advanceStory('lighthouse', 8);
  result('E2 桥结局（留日志·连接行为）', endBridge.includes('第三章·归位——完') && endBridge.includes('两边都在'),
    endBridge.slice(-70));

  // ================= Phase F：结局三（留岛=睡床） =================
  await seedAndReload(Object.assign({}, CH2_DONE, {
    ch3_diary_finale: true, ch3_finale_open: true,
  }), 21);
  await teleport('house', 40, 56); // 床南侧（床格 (2,2)-(3,3)）
  await callOn('house', 'trySleep');
  await sleep(2600);
  const endStay = await advanceStory('house', 8);
  result('E3 留岛结局（睡在自家床）', endStay.includes('第三章·归位——完') && endStay.includes('今晚，你留在这里'),
    endStay.slice(-70));

  // ============ 附加 ============
  result('附加 无页面错误', warns.length === 0, warns.join('; ').slice(0, 160));
} catch (e) {
  console.log('\n❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-ch3-finale 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
