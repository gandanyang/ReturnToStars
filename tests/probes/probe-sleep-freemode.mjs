/**
 * 自由模式睡觉探针（"床睡不了觉"bug 回归）
 *
 * 覆盖历史探针（probe-sleep / probe-sleep-realpath / probe-mobile-sleep 均为教程期直睡路径）的盲区：
 *   A. chapter1 床点未整理 → 第一次按 E 被叠被子拦截（设计内）→ 整理后床交互恢复
 *   B. 自由模式白天（step=done, hour<20）→ 弹「睡到天亮/休息到傍晚」选项框
 *      → **pointerdown 点击「睡到天亮」**（真机触屏语义，StoryDialogue 选项按钮修复验证）
 *      → 跨天 + 06:00；day 仅 +1 证明 pointerdown+click 双绑定无二次触发（幂等）
 *   C. click 兜底回归 → 选「休息到傍晚」→ 当天 18:00 不跨天
 *   D. 观星夜后（observatory_complete）夜间 house 床前 → 无选项直睡
 *   E. 观星夜后 farm 木屋白天 → 无选项直睡
 *
 * 前置：dev server 在 localhost:5173；node probe-sleep-freemode.mjs
 */

import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function sceneInfo(page) {
  return page.evaluate(() => ({
    scene: window.__game.scene.getScenes(true)[0]?.scene?.key ?? 'none',
    step: window.debug?.getStoryStep?.(),
    time: window.debug?.getTimeStr?.(),
  }));
}

async function readSaveDay(page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('return_star_save');
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data?.world?.day ?? null;
    } catch { return null; }
  });
}

async function gotoScene(page, key, spawn) {
  await page.evaluate(([k, sp]) => {
    const g = window.__game;
    const active = g.scene.getScenes(true)[0];
    if (active && active.scene.key !== k) g.scene.stop(active.scene.key);
    g.scene.start(k, sp ? { spawn: sp } : undefined);
  }, [key, spawn ?? null]);
  await sleep(2600);
}

async function teleport(page, sceneKey, x, y, facing = 'up') {
  await page.evaluate(([k, px, py, f]) => {
    const s = window.__game.scene.getScene(k);
    if (!s?.player) return;
    s.player.x = px;
    s.player.y = py;
    s.player.facing = f;
  }, [sceneKey, x, y, facing]);
  await sleep(200);
}

/** 触屏"交互"按钮（TouchControls → queueAction，等同玩家点按钮） */
async function pressInteract(page) {
  await page.evaluate(() => {
    const b = document.querySelector('#touch-controls [data-action="interact"]');
    if (b) b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  });
  await sleep(600);
}

/** 对话第一行推进（点对话文本，冒泡到 box 的 click → advance） */
async function advanceDialogue(page) {
  await page.evaluate(() => {
    const ps = [...document.querySelectorAll('p')];
    const box = ps.find(p => p.textContent && p.textContent.includes('躺在床上'));
    if (box) box.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await sleep(500);
}

/** 关闭当前打开的对话（定位 StoryDialogue 容器：fixed + zIndex 500；逐行点击可见文本直到关闭；无对话时 no-op） */
async function dismissDialogue(page) {
  for (let i = 0; i < 4; i++) {
    const had = await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('div')].find(
        d => d.style.position === 'fixed' && d.style.display !== 'none' && d.style.zIndex === '500',
      );
      if (!dlg) return false;
      const ps = [...dlg.querySelectorAll('p')].filter(p => (p.textContent || '').trim());
      if (ps.length === 0) return false;
      ps[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    });
    if (!had) break;
    await sleep(400);
  }
  await sleep(200);
}

/** 选项框状态：是否可见 + 各按钮文本 */
async function optionsState(page) {
  return page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
      .map(b => b.textContent || '')
      .filter(t => t.includes('睡到天亮') || t.includes('休息到傍晚'));
    return { count: btns.length, labels: btns };
  });
}

/** 等待睡觉提示出现并推进到选项行（promptSleepChoice 在 runner 占用时会延迟 1200ms 重试，固定时序会漏检） */
async function waitSleepOptions(page, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const st = await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('div')].find(
        d => d.style.position === 'fixed' && d.style.display !== 'none' && d.style.zIndex === '500',
      );
      if (!dlg) return { open: false, text: '', btns: 0 };
      const ps = [...dlg.querySelectorAll('p')].map(p => (p.textContent || '').trim()).filter(Boolean);
      const btns = [...dlg.querySelectorAll('button')]
        .filter(b => /睡到天亮|休息到傍晚/.test(b.textContent || '')).length;
      return { open: true, text: ps[0] || '', btns };
    });
    if (st.open && st.btns > 0) return st;
    if (st.open && st.text.includes('躺在床上')) {
      await page.evaluate(() => {
        const dlg = [...document.querySelectorAll('div')].find(
          d => d.style.position === 'fixed' && d.style.display !== 'none' && d.style.zIndex === '500',
        );
        const p = dlg && [...dlg.querySelectorAll('p')].find(p => (p.textContent || '').includes('躺在床上'));
        if (p) p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      await sleep(400);
      continue;
    }
    await sleep(250);
  }
  return { open: false, text: '', btns: 0 };
}

/** 点击选项按钮：evType='pointerdown'（真机触屏语义）或 'click'（桌面兜底） */
async function clickOption(page, label, evType) {
  const ok = await page.evaluate(([lbl, ev]) => {
    const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes(lbl));
    if (!btn) return false;
    const Evt = typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
    btn.dispatchEvent(new Evt(ev, { bubbles: true, cancelable: true }));
    return true;
  }, [label, evType]);
  await sleep(1500);
  return ok;
}

async function setFreeModeDay(page) {
  await page.evaluate(() => {
    window.debug.setChapter(1);
    window.debug.setStoryStep('done');
    window.debug.setTimeFull(5, 12, 0);
  });
  await sleep(400);
}

async function run() {
  console.log('=== 自由模式睡觉路径探针 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 375, height: 812, isMobile: true, hasTouch: true },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const results = [];
  const gameLogs = [];
  page.on('console', msg => {
    const t = msg.text();
    if (/P7b|consumeAction|MapScene:/.test(t)) gameLogs.push(t);
  });

  const assert = (name, cond, detail = '') => {
    results.push({ name, pass: !!cond });
    console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  try {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2500);
    await page.keyboard.press('Enter');
    await sleep(2200);
    await page.evaluate(() => {
      const btn = document.getElementById('intro-skip-btn');
      if (btn) btn.click();
    });
    await sleep(500);

    // ===== A. chapter1 床点拦截（设计内）→ 整理后床交互恢复 → 选项弹窗 → pointerdown「睡到天亮」 =====
    await setFreeModeDay(page);
    await gotoScene(page, 'house', { x: 40, y: 72 }); // 床前站立位 tile(2,4)
    await pressInteract(page); // 第一次：house_tidy 叠被子拦截（48px 优先级 #1）
    const tidyMarked = await page.evaluate(() => window.debug.events.hasTriggered('ch1_bed_done'));
    const infoAfterTidy = await sceneInfo(page);
    assert('A1 床点未整理时首按E=叠被子（house_tidy 拦截，设计内）',
      tidyMarked && infoAfterTidy.time.startsWith('12:'),
      `ch1_bed_done=${tidyMarked} time=${infoAfterTidy.time}`);
    await dismissDialogue(page); // 关闭「被褥叠好了…」整理对话（否则吞掉下一次按键）

    await page.evaluate(() => window.debug.setStoryStep('done'));
    await sleep(300);
    await pressInteract(page); // 第二次：床交互恢复 → 自由模式白天 → 选项弹窗
    // promptSleepChoice 在 runner 占用时会延迟 1200ms 重试 → 轮询等待而非固定时序
    const stA2 = await waitSleepOptions(page);
    assert('A2 整理后按E弹睡觉选项框', stA2.btns === 2,
      `open=${stA2.open} btns=${stA2.btns} logs=[${gameLogs.slice(-3).join(' | ')}]`);

    const dayBefore = await readSaveDay(page);
    const clicked = await clickOption(page, '睡到天亮', 'pointerdown');
    const dayAfter = await readSaveDay(page);
    const infoA = await sceneInfo(page);
    assert('A3 pointerdown 触屏点「睡到天亮」成功跨天',
      clicked && dayBefore !== null && dayAfter === dayBefore + 1 && infoA.time.startsWith('06:'),
      `day ${dayBefore}→${dayAfter} time=${infoA.time}`);
    assert('A4 幂等：day 仅 +1（pointerdown+click 双绑定未二次触发）',
      dayAfter === dayBefore + 1, `day=${dayAfter}`);
    await dismissDialogue(page); // 关闭睡觉后的「已保存 Zzz…」（否则吞掉 B1 的按键）

    // ===== B. click 兜底回归：「休息到傍晚」 =====
    await setFreeModeDay(page);
    await teleport(page, 'house', 40, 72, 'up');
    await pressInteract(page);
    const stB1 = await waitSleepOptions(page);
    assert('B1 再次按E弹选项框（床交互保持）', stB1.btns === 2, `open=${stB1.open} btns=${stB1.btns}`);
    const dayB0 = await readSaveDay(page);
    const clickedB = await clickOption(page, '休息到傍晚', 'click');
    const infoB = await sceneInfo(page);
    const dayB1 = await readSaveDay(page);
    // restUntilEvening 会以「存活 day」存档：A3 跨天后存档日比 B 段存活日大 1（setFreeModeDay 不存档），
    // 故 day 断言用 ≤（未跨天语义）而非 ===（存档日会回退为存活日）。
    assert('B2 click 点「休息到傍晚」→ 当天 18:00 不跨天',
      clickedB && infoB.time.startsWith('18:') && dayB1 <= dayB0,
      `time=${infoB.time} day ${dayB0}→${dayB1}`);
    await dismissDialogue(page); // 关闭「休息到傍晚……」提示（若已被点击冒泡关闭则为 no-op）

    // ===== C. 观星夜后夜间 house 直睡（无选项） =====
    await page.evaluate(() => {
      window.debug.setStoryStep('observatory_complete');
      window.debug.setTimeFull(6, 22, 0);
    });
    await sleep(300);
    await teleport(page, 'house', 40, 72, 'up');
    await pressInteract(page);
    await sleep(1500);
    const optsC = await optionsState(page);
    const infoC = await sceneInfo(page);
    assert('C1 观星夜后夜间按E直睡（无选项框）', optsC.count === 0 && infoC.time.startsWith('06:'),
      `options=${optsC.count} time=${infoC.time}`);
    await dismissDialogue(page); // 关闭睡觉后的「已保存 Zzz…」（否则吞掉 D1 的按键）

    // ===== D. 观星夜后 farm 木屋白天直睡 =====
    await gotoScene(page, 'farm', { x: 400, y: 300 });
    // C1 睡后存档日=7；活时钟须设为 day 7（设 6 会让睡后存档 7→7，dayD0+1 永不成立）
    await page.evaluate(() => window.debug.setTimeFull(7, 12, 0));
    await sleep(300);
    const dayD0 = await readSaveDay(page);
    await teleport(page, 'farm', 56, 328, 'up'); // tile(3,20) 床格中心（tile=16px，地图 640×400；3*16+8=56, 20*16+8=328）
    await pressInteract(page);
    await sleep(1500);
    const optsD = await optionsState(page);
    const infoD = await sceneInfo(page);
    const dayD1 = await readSaveDay(page);
    const diagD = await page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      if (!s?.player) return { err: 'no farm scene/player' };
      const pc = Math.floor(s.player.x / 16);
      const pr = Math.floor(s.player.y / 16);
      return {
        x: Math.round(s.player.x), y: Math.round(s.player.y),
        tile: `${pc},${pr}`,
        onBed: s.bedTiles?.has?.(`${pc},${pr}`) ?? null,
        bedCount: s.bedTiles?.size ?? -1,
        bedSample: s.bedTiles ? [...s.bedTiles].slice(0, 8) : [],
      };
    });
    assert('D1 farm 木屋白天直睡（无选项框，跨天）',
      optsD.count === 0 && infoD.time.startsWith('06:') && dayD1 === dayD0 + 1,
      `options=${optsD.count} time=${infoD.time} day ${dayD0}→${dayD1} diag=${JSON.stringify(diagD)} logs=[${gameLogs.slice(-4).join(' | ')}]`);
  } finally {
    const pass = results.filter(r => r.pass).length;
    console.log(`\n=== 结果：${pass}/${results.length} ===`);
    await browser.close();
    if (pass !== results.length) process.exit(1);
  }
}

run().catch(err => { console.error('探针异常:', err); process.exit(1); });
