/**
 * D1 轨迹诊断（临时）：farm 传送 (144,960) 后玩家被推到 (144,393) 的原因采样
 * 区分「物理渐变推挤」vs「逻辑一帧跳变」，并列出 player 相关 collider
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('=== D1 轨迹诊断 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 375, height: 812, isMobile: true, hasTouch: true },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  page.on('console', msg => {
    const t = msg.text();
    if (/P7b|consumeAction|MapScene:|switch|exit|bound/i.test(t)) console.log('  [log]', t);
  });

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

    // 初始化 chapter1 自由模式（同 freemode D1 前置）
    await page.evaluate(() => {
      window.debug.setChapter(1);
      window.debug.setStoryStep('done');
      window.debug.setTimeFull(7, 12, 0);
    });
    await sleep(400);

    // gotoScene farm
    await page.evaluate(() => {
      const g = window.__game;
      const active = g.scene.getScenes(true)[0];
      if (active && active.scene.key !== 'farm') g.scene.stop(active.scene.key);
      g.scene.start('farm', { spawn: { x: 400, y: 300 } });
    });
    await sleep(2600);

    // collider 清单（传送前）
    const colliders = await page.evaluate(() => {
      const sc = window.__game.scene.getScene('farm');
      if (!sc) return null;
      const cs = sc.physics?.world?.colliders?.colliders || [];
      const nm = o => (o && (o.name || (o.constructor && o.constructor.name))) || '?';
      return cs.map(c => `${nm(c.objectA)} <-> ${nm(c.objectB)} (overlap=${c.overlapOnly})`);
    });
    console.log('colliders:', JSON.stringify(colliders, null, 1));

    // 传送并密集采样
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      if (!s?.player) return;
      s.player.x = 144;
      s.player.y = 960;
      s.player.facing = 'up';
    });
    const tile0 = await page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      const t = s.wallsLayer?.getTileAtWorldXY(144, 960);
      return t ? { index: t.index, collides: t.collides } : null;
    });
    console.log('tile@(144,960):', JSON.stringify(tile0));

    for (let i = 0; i < 22; i++) {
      const s = await page.evaluate(() => {
        const sc = window.__game.scene.getScene('farm');
        const p = sc?.player;
        if (!p) return null;
        const b = p.body;
        return {
          x: Math.round(p.x), y: Math.round(p.y),
          vx: b ? Math.round(b.velocity.x) : null,
          vy: b ? Math.round(b.velocity.y) : null,
          bl: b ? `${b.blocked.up}/${b.blocked.down}/${b.blocked.left}/${b.blocked.right}` : null,
          emb: b ? b.embedded : null,
          active: window.__game.scene.getScenes(true)[0]?.scene?.key,
        };
      });
      console.log(String(i).padStart(2), JSON.stringify(s));
      await sleep(100);
    }
  } catch (e) {
    console.error('FATAL', e);
  } finally {
    await browser.close();
  }
}

run();
