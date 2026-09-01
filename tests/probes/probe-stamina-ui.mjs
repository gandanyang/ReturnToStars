/**
 * 体力系统 UI 验证探针（P1 提示优化）
 * 1) farm 场景 HUD 显示体力（移动横屏 + PC），且不溢出
 * 2) 农场操作体力不足时弹出提示（原为静默失败）
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function assert(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`  ❌ ${name} — ${detail}`); }
}

async function bootFreeMode(page) {
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
  await page.evaluate(() => {
    window.debug.setChapter(1);
    window.debug.setStoryStep('done');
  });
  await sleep(300);
}

async function gotoFarm(page) {
  await page.evaluate(() => {
    const g = window.__game;
    const active = g.scene.getScenes(true)[0];
    if (active && active.scene.key !== 'farm') g.scene.stop(active.scene.key);
    g.scene.start('farm', { spawn: { x: 400, y: 300 } });
  });
  await sleep(2600);
}

async function run() {
  console.log('=== 体力系统 UI 验证 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: ['--no-sandbox'],
  });

  try {
    // ── 1. 移动端横屏 ──
    console.log('── 移动端横屏 (792×375) ──');
    const m = await browser.newPage();
    // 宽度 <800 确保 isMobileLayout() 命中移动分支（config.ts: innerWidth<800 || isTouchDevice）
    await m.setViewport({ width: 792, height: 375, isMobile: true, hasTouch: true });
    await bootFreeMode(m);
    await gotoFarm(m);

    const hudM = await m.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      const el = s?.hudAreaDom;
      if (!el) return null;
      return {
        html: el.innerHTML,
        clientW: el.clientWidth, scrollW: el.scrollWidth,
        vpW: window.innerWidth,
        right: Math.round(el.getBoundingClientRect().right),
      };
    });
    if (hudM) {
      assert('移动端 farm HUD 含体力文本', /\/100|stamina/.test(hudM.html) || /100\/100/.test(hudM.html), hudM.html.slice(0, 120));
      assert('移动端确命中移动布局分支（防假故障）', !/WASD/.test(hudM.html), 'HUD 无 WASD 提示 = 移动分支特征');
      assert('移动端 farm HUD 不横向溢出', hudM.scrollW <= hudM.clientW && hudM.right <= hudM.vpW + 2,
        `scrollW=${hudM.scrollW} clientW=${hudM.clientW} right=${hudM.right} vp=${hudM.vpW}`);
    } else {
      assert('移动端 farm HUD 存在', false, 'hudAreaDom 不存在');
    }
    await m.screenshot({ path: 'tests/reports/stamina-hud-mobile.png' });

    // ── 2. 体力不足提示（移动端页面内触发） ──
    // 前置：farm_till 在体力检查前先查工具（FarmController L516），须先给锄头
    await m.evaluate(async () => {
      const { setStamina } = await import('/src/data/Stamina.ts');
      const { addItem } = await import('/src/data/Inventory.ts');
      addItem('old_hoe', 1);
      setStamina(1);
      const s = window.__game.scene.getScene('farm');
      if (s?.updateHUD) s.updateHUD();
    });
    await sleep(300);
    const hint = await m.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      for (let c = 5; c <= 14; c++) {
        for (let r = 6; r <= 14; r++) {
          try { s.tryFarmInteractAt(c, r); } catch {}
          if (s.dialogueText?.text) return s.dialogueText.text;
        }
      }
      return null;
    });
    assert('农场操作体力不足弹出提示', !!hint && hint.includes('体力不足'), `text=${hint ?? 'null'}`);
    const staminaNow = await m.evaluate(() => window.debug.getStamina());
    assert('体力不足时体力值未被扣（闸扣在前）', staminaNow === 1, `stamina=${staminaNow}`);
    await m.screenshot({ path: 'tests/reports/stamina-hint-mobile.png' });
    await m.close();

    // ── 3. PC 布局 HUD ──
    console.log('── PC (1280×720) ──');
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 720, isMobile: false });
    await bootFreeMode(p);
    await gotoFarm(p);
    const hudP = await p.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      const el = s?.hudAreaDom;
      if (!el) return null;
      return {
        html: el.innerHTML,
        clientW: el.clientWidth, scrollW: el.scrollWidth,
        vpW: window.innerWidth,
        right: Math.round(el.getBoundingClientRect().right),
      };
    });
    if (hudP) {
      assert('PC farm HUD 含体力文本', /100\/100|stamina/.test(hudP.html) || /\/100/.test(hudP.html), hudP.html.slice(0, 140));
      assert('PC 确命中 PC 布局分支（防假故障）', /WASD\/E交互/.test(hudP.html), 'HUD 含 WASD/E交互 = PC 分支特征');
      assert('PC farm HUD 不横向溢出', hudP.scrollW <= hudP.clientW && hudP.right <= hudP.vpW + 2,
        `scrollW=${hudP.scrollW} clientW=${hudP.clientW} right=${hudP.right} vp=${hudP.vpW}`);
    } else {
      assert('PC farm HUD 存在', false, 'hudAreaDom 不存在');
    }
    await p.screenshot({ path: 'tests/reports/stamina-hud-pc.png' });
    await p.close();
  } catch (e) {
    console.error('FATAL', e);
    fail++;
  } finally {
    await browser.close();
  }

  console.log(`\n=== 结果：${pass} 过 / ${fail} 败 ===`);
  process.exit(fail > 0 ? 1 : 0);
}

run();
