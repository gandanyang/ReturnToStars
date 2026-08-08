/**
 * probe-tree-big.mjs — farm 树美术升级验证（2026-08-09）
 *
 * 验证：
 * T1 大树存在：treeSprites 中有 tree_big 纹理的树（(col+row)%3===0 的位置）
 * T2 大小树并存：tree_big / tree1 / tree2 均有（不是全大或全小）
 * T3 大树碰撞只占 1 格：body 显示尺寸 16×16（源图 32×32 × scale0.5）——不堵 2 格路
 * T4 树冠邻格可通行：玩家可站在大树树冠覆盖的邻格（视觉 2 格宽但碰撞 1 格）
 * T5 主题音乐：标题画面 BGM=title（新归档 title_main.ogg），无加载失败
 *
 * 依赖：dev server (localhost:5173)；视口横屏 1024x768（项目红线）
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: false,
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0;
let fail = 0;
function result(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}

const musicWarns = [];
page.on('console', (msg) => {
  if (msg.text().includes('[MusicSystem] 加载失败') || msg.type() === 'error') musicWarns.push(msg.text().slice(0, 100));
});
page.on('pageerror', (e) => musicWarns.push('pageerror: ' + e.message));

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(3000);

  // ── T5 主题音乐（标题画面自动播放 title → title_main.ogg）──
  const t5 = await page.evaluate(() => {
    // 标题画面需要用户交互才起播（autoplay 拦截），模拟一次交互
    window.dispatchEvent(new PointerEvent('pointerdown'));
    return 'interacted';
  });
  await sleep(2500);
  const curMusic = await page.evaluate(() => window.debug.musicCurrent?.() ?? null);
  result('T5 标题画面 BGM=title（Stars Gather 归档）', curMusic === 'title', curMusic);

  await page.keyboard.press('Enter');
  await sleep(1200);
  await page.evaluate(() => { const b = document.getElementById('intro-skip-btn'); if (b) b.click(); });
  await sleep(500);
  await page.evaluate(() => {
    window.debug.setStoryStep('done');
    window.debug.setTime(9, 0);
    window.debug.events?.markTriggered?.('first_morning_response');
  });
  await sleep(400);
  await page.evaluate(() => { window.__game.scene.start('farm', { spawn: { x: 200, y: 300 } }); });
  // 轮询等 farm 就绪
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const ok = await page.evaluate(() => !!window.__game?.scene?.getScene?.('farm')?.player);
    if (ok) break;
    await sleep(300);
  }
  await sleep(2000);

  // ── T1/T2/T3 树精灵统计 ──
  const t123 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    const tex = { tree_big: 0, tree1: 0, tree2: 0, stump: 0 };
    const bigInfo = [];
    for (const [key, sp] of s.treeSprites) {
      const k = sp.texture?.key ?? '?';
      if (k in tex) tex[k]++;
      if (k === 'tree_big') {
        bigInfo.push({
          key,
          bodyW: sp.body?.width ?? -1,
          bodyH: sp.body?.height ?? -1,
          origin: { x: sp.originX, y: sp.originY },
          displayH: sp.displayHeight,
        });
      }
    }
    return { tex, bigInfo: bigInfo.slice(0, 3), bigCount: bigInfo.length };
  });
  result('T1 大树存在（tree_big 精灵 > 0）', t123.tex.tree_big > 0, JSON.stringify(t123.tex));
  result('T2 大小树并存', t123.tex.tree_big > 0 && t123.tex.tree1 > 0 && t123.tex.tree2 > 0, JSON.stringify(t123.tex));
  const bodyOk = t123.bigInfo.every((b) => b.bodyW === 16 && b.bodyH === 16 && b.origin.y === 1);
  result('T3 大树碰撞仅 1 格（body 16×16 + 锚点底部）', bodyOk, JSON.stringify(t123.bigInfo[0]));

  // ── T4 树冠邻格可通行：玩家瞬移到大树树冠覆盖的邻格，确认不被碰撞弹开 ──
  const t4 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    // 找一棵大树的位置（从 treeSprites key "col,row"）
    let bigPos = null;
    for (const [key, sp] of s.treeSprites) {
      if (sp.texture?.key === 'tree_big') { bigPos = key; break; }
    }
    if (!bigPos) return { ok: false, reason: '无大树' };
    const [col, row] = bigPos.split(',').map(Number);
    const cx = col * 16 + 8;
    const cy = row * 16 + 8;
    // 站到大树右侧邻格（树冠 2 格宽的覆盖区）——大树锚点底部中心，树冠向上/两侧展开
    s.player.x = cx + 16 + 4; // 右侧邻格偏右
    s.player.y = cy - 4;      // 树冠中部高度
    s.player.body.reset(s.player.x, s.player.y);
    return { ok: true, pos: { x: s.player.x, y: s.player.y } };
  });
  await sleep(500);
  const t4b = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    return { x: s.player.x, y: s.player.y };
  });
  // 玩家位置未被明显弹开（树冠邻格无碰撞）——允许 ±2px 物理抖动
  const moved = t4.ok && Math.abs(t4b.x - t4.pos.x) < 8 && Math.abs(t4b.y - t4.pos.y) < 8;
  result('T4 树冠邻格可通行（碰撞仅树干 1 格）', moved, t4.ok ? `from(${t4.pos.x},${t4.pos.y})→to(${t4b.x},${t4b.y})` : t4.reason);

  // 附加：无加载失败/页面错误
  result('附加 无音乐加载失败/页面错误', musicWarns.length === 0, musicWarns.slice(0, 2).join('; '));
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-tree-big 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
