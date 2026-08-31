/**
 * probe-ch3-keeper.mjs — 第三章幕二「执灯人三件套深交互」验收探针
 *
 * 验收目标（幕二：D-012 范式——完成→留下痕迹，不解释奖励；谜底留白）：
 *   K1 执灯人日常：靠近按 E → 轮换短句（行动型角色）
 *   K2 铜铃：靠近按 E → 风铃声交互（夜里黑点方向回应文案）
 *   K3 航海日志·续写：三选一写入 → 再次交互读回玩家留下的那行（D-012 痕迹）
 *   K4 望远镜·观察模式：镜头 zoom≈1.9 + 暗角 → 结束后恢复 zoom=1
 *   K5 D-012 半句话：日志续写后执灯人第 4 次交互 →「字不错。」
 * 附加  无页面错误
 *
 * 前置：ch2 全节拍 + ch3_lighthouse_arrival 已标记（跳过幕一演出，直测幕二）
 * 运行：node tests/probes/probe-ch3-keeper.mjs
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
    version: '0.5', savedAt: 'ch3-keeper', timestamp: Date.now(),
    player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: {} },
    world: { day: 9, hour: 12, minute: 0, coins: 500, level: 2, xp: 180, stamina: 100, minedOres: [] },
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

async function gotoLighthouse() {
  await page.evaluate(() => { window.__game.scene.start('farm', { spawn: { x: 240, y: 96 } }); });
  const f = await waitScene('farm');
  await sleep(600);
  const st = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    return {
      unlocked: s.isLighthouseUnlocked ? s.isLighthouseUnlocked() : null,
      blackDot: window.debug.events.hasTriggered('ch2_black_dot'),
      arrival: window.debug.events.hasTriggered('ch3_lighthouse_arrival'),
      active: s.scene.isActive(),
    };
  });
  console.log('  [goto] farm 状态:', JSON.stringify(st));
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    s.player.x = 44; s.player.y = 12 * 16;
    if (s.player.body) s.player.body.reset(44, 192);
  });
  const ok = await waitScene('lighthouse', 12000);
  console.log('  [goto] lighthouse 切换:', ok);
  await sleep(2200); // 幕一已标记 → 不重播；等场景稳定
  return ok && f;
}

async function teleportAndInteract(canTryFn, ox, oy) {
  // 碰撞可能把盲传送的玩家推走——扫描候选偏移直到 canTry 为真再按 E
  const offsets = [[0, 24], [0, 32], [-24, 24], [24, 24], [0, 40], [-32, 32], [32, 32], [0, 16]];
  let reached = false;
  for (const [dx, dy] of offsets) {
    await page.evaluate(([f, x, y, ddx, ddy]) => {
      const s = window.__game.scene.getScene('lighthouse');
      s.player.x = x + ddx; s.player.y = y + ddy;
      if (s.player.body) s.player.body.reset(s.player.x, s.player.y);
    }, [canTryFn, ox, oy, dx, dy]);
    await sleep(300);
    reached = await page.evaluate((f) => {
      const s = window.__game.scene.getScene('lighthouse');
      return typeof s[f] === 'function' ? !!s[f]() : false;
    }, canTryFn);
    if (reached) break;
  }
  if (!reached) return false;
  await page.evaluate(() => {
    const b = document.querySelector('#touch-controls [data-action="interact"]');
    if (b) b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  });
  await sleep(800);
  return true;
}

async function sceneText() {
  // showDialogueText 是 Phaser 世界内文本（4s 自毁），不进 DOM——读场景实例
  return page.evaluate(() => window.__game.scene.getScene('lighthouse')?.dialogueText?.text ?? '');
}

async function clickOption(text) {
  return page.evaluate((t) => {
    const btns = [...document.querySelectorAll('.story-options button, .story-dialogue button, button')];
    const b = btns.find((x) => (x.textContent || '').includes(t));
    if (!b) return false;
    // 只发 pointerdown（生产输入路径）：选中后 optionsEl.innerHTML='' 已移除按钮，
    // 合成 click 落在响应序列上会把它关掉并卡住 runner（探针自身双触发伪失败）
    b.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
    return true;
  }, text);
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await seed();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2200);
  await page.keyboard.press('Enter'); // 标题屏：检测到存档将自动继续（TitleScene keydown-ENTER → startGame）
  await waitScene('farm');
  const g0 = await gotoLighthouse();
  result('G0 进入灯塔（前置链）', g0 === true, '见 [goto] 日');
  // ============ K1 执灯人日常 ============
  await teleportAndInteract('canTryCh3Keeper', 13.4 * 16, 10.2 * 16); // 执灯人
  let t = await sceneText();
  result('K1 执灯人日常：轮换短句第 1 句', t.includes('点了下头') || t.includes('擦灯罩'), t.slice(-80));

  // ============ K2 铜铃（夜里：黑点方向回应文案） ============
  await page.evaluate(async () => {
    const ts = await import('/src/data/TimeSystem.ts');
    ts.setTimeFull(9, 21, 0);
  });
  await sleep(300);
  await teleportAndInteract('canTryCh3Bell', 17.0 * 16, 9.6 * 16); // 铜铃
  t = await sceneText();
  result('K2 铜铃：夜里黑点方向回应文案', t.includes('铃声荡出去') && t.includes('光应了一下'), t.slice(-90));

  // ============ K3 航海日志·续写 ============
  await page.evaluate(async () => {
    const ts = await import('/src/data/TimeSystem.ts');
    ts.setTimeFull(9, 12, 0);
  });
  await teleportAndInteract('canTryLighthouse', 10 * 16 + 8, 12 * 16 + 8); // 日志南侧锚点
  // 前两行需推进才到选项行：轮询选项按钮（storyDialogue.advance() 推进）
  let opt = false;
  for (let i = 0; i < 10 && !opt; i++) {
    opt = await clickOption('今天，灯还亮着');
    if (!opt) {
      await page.evaluate(() => window.__game.scene.getScene('lighthouse').storyDialogue?.advance());
      await sleep(700);
    }
  }
  await sleep(900); // onChoice → 续写演出（StoryDialogue，DOM）
  let domT = '';
  const trace = [];
  for (let i = 0; i < 8; i++) {
    const snap = await page.evaluate(() => {
      const s = window.__game.scene.getScene('lighthouse');
      const d = s.storyDialogue;
      return {
        open: d?.isOpen?.() ?? false,
        text: d ? (d.textEl ? d.textEl.textContent : '') : '',
        runnerPlaying: s.storySequenceRunner?.isPlaying?.() ?? null,
      };
    });
    trace.push(`#${i} open=${snap.open} runner=${snap.runnerPlaying} text=${(snap.text || '').slice(0, 18)}`);
    domT = await page.evaluate(() => document.body.innerText);
    if (domT.includes('墨迹很新')) break;
    await page.evaluate(() => window.__game.scene.getScene('lighthouse').storyDialogue?.advance());
    await sleep(500);
  }
  console.log('  [K3 trace]', trace.join(' | '));
  result('K3a 日志续写：三选一写入', domT.includes('墨迹很新'), `dom=${domT.slice(-60)}`);
  await sleep(600); // 等续写对白关闭
  await page.evaluate(() => window.__game.scene.getScene('lighthouse').storyDialogue?.skip()); // 关闭响应对白（防 open 态挡住下一次交互路由）
  await sleep(400);
  await teleportAndInteract('canTryLighthouse', 10 * 16 + 8, 12 * 16 + 8);
  t = await sceneText();
  result('K3b 日志读回：玩家留下的那行（D-012 痕迹）', t.includes('你写下的那行还在'), t.slice(-80));

  // ============ K4 望远镜·观察模式 ============
  await teleportAndInteract('canTryLighthouse', 24 * 16 + 8, 12 * 16 + 8); // 望远镜南侧
  await sleep(1000); // zoom 900ms
  const k4 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('lighthouse');
    return { zoom: s.cameras.main.zoom, day: true };
  });
  await sleep(3500); // 演出结束 → zoom 恢复
  // 观察对白需玩家推进 → onComplete 才恢复 zoom（正常玩法即如此）
  await page.evaluate(() => window.__game.scene.getScene('lighthouse').storyDialogue?.advance());
  await sleep(1400); // zoomTo(1, 700) + 余量
  const k4b = await page.evaluate(() => window.__game.scene.getScene('lighthouse').cameras.main.zoom);
  result('K4 望远镜：观察模式 zoom≈1.9 → 推进后恢复 1',
    k4.zoom > 1.6 && Math.abs(k4b - 1) < 0.1, `zoom=${k4.zoom}→${k4b}`);

  // ============ K5 D-012 半句话 ============
  await teleportAndInteract('canTryCh3Keeper', 13.4 * 16, 10.2 * 16); // 第 2 次交互 line1
  await teleportAndInteract('canTryCh3Keeper', 13.4 * 16, 10.2 * 16); // 第 3 次 line2
  await teleportAndInteract('canTryCh3Keeper', 13.4 * 16, 10.2 * 16); // 第 4 次：日志已写 → 「字不错。」
  t = await sceneText();
  result('K5 D-012：日志续写后执灯人半句话', t.includes('字不错'), t.slice(-60));

  // ============ 附加 ============
  result('附加 无页面错误', warns.length === 0, warns.join('; ').slice(0, 160));
} catch (e) {
  console.log('\n❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-ch3-keeper 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
