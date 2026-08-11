/**
 * 探针：day2 清晨演出 vs 首次收获对白 防覆盖回归验证（2026-08-11）
 *
 * 背景：玩家第一天没收获过（firstHarvestShown=false），day2 清晨演出
 * （tryFirstMorningSequence：清晨旁白 → 2600ms 后夏雅「岛屿的第一声回应」对白）期间，
 * 若手速快先去田里收货 → 首次收获情绪瞬间（爷爷回忆旁白 + FIRST_HARVEST_DIALOGUE）
 * 与清晨演出竞争 StoryDialogue 单实例互相覆盖 → 剧情乱。
 *
 * 修复（2026-08-11，MapScene.ts）：
 *  - firstMorningActive 窗口内首次收获 → 旁白/对白抑制，清晨对白结束后补播（pendingFirstHarvest 链）
 *  - 清晨对白播放前守卫：若已有对白在播（演出触发前抢先收割的首收对白）→ 轮询等它播完再播清晨对白
 *
 * 两段流程覆盖两条真实路径：
 *   段1（演出触发前收割 → 守卫等待）：重进 farm 后 400ms 收割（firstMorningActive=false）
 *       → 首收对白正常弹出 → 2600ms 触发点发现对白在播 → 等首收对白播完 → 清晨对白随后播出
 *   段2（演出触发后收割 → 抑制+补播）：重进 farm 后 1500ms 收割（firstMorningActive=true）
 *       → 首收对白被抑制 → 清晨对白播完后补播首收对白
 *
 * 断言：
 *   段1：A1 收获正常 / A2 首收对白完整播出 / A3 清晨对白完整播出 / A4 顺序正确（首收先播、清晨后播、未覆盖）/ A5 onComplete 复位（firstMorningActive=false、夏雅精灵清除）
 *   段2：A6 收获正常 / A7 对白被抑制（未弹出）/ A8 清晨对白播完后补播首收对白
 *
 * 前置：Vite dev server 跑在 localhost:5173
 * 运行：node tests/probes/probe-day2-morning-fast-harvest.mjs
 */
import puppeteer from 'puppeteer-core';

const GAME_URL = 'http://localhost:5173/';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = [];
function result(step, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${step}: ${passed ? '通过' : '失败'}${detail ? ' - ' + detail : ''}`);
  results.push(passed);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('=== day2 清晨演出 vs 首次收获对白 防覆盖探针 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`  [err] ${msg.text().substring(0, 140)}`);
    });

    /** 准备：清档 → 主线完成 → 田里放一株成熟萝卜 → day2 06:00 → 重进 farm */
    const prepare = async () => {
      await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'networkidle2' });
      await sleep(2500);
      await page.evaluate(() => {
        window.debug.setStoryStep('done');
        window.debug.setQuestState('completed');
        // 农田格子放一株成熟萝卜（未收获过：firstHarvestShown=false）
        window.debug.farm.setTileState(14, 16, 'grown');
        window.debug.farm.setCrop(14, 16, 'radish');
      });
      await page.evaluate(() => window.debug.nextDay()); // 推进到 day2 06:00
      await sleep(600);
      // 重进 farm → create 挂钩 delayedCall(900) 触发 day2 清晨演出
      await page.evaluate(() => {
        const g = window.__game;
        const active = g.scene.getScenes(true)[0];
        if (active && active.scene.key !== 'farm') g.scene.stop(active.scene.key);
        g.scene.start('farm', { spawn: { x: 480, y: 300 } });
      });
    };

    /** 采样当前对白并翻一行（打字机立即显示全文）。返回 {open,name,text} */
    const sample = (advance = true) => page.evaluate((doAdv) => {
      const s = window.__game.scene.getScenes(true)[0];
      const dlg = s?.storyDialogue;
      if (!dlg || !dlg.isOpen()) return { open: false, name: '', text: '' };
      const info = {
        open: true,
        name: dlg.nameEl?.textContent ?? '',
        text: dlg.textEl?.textContent ?? '',
      };
      if (doAdv) dlg.advance();
      return info;
    }, advance);

    const diag = () => page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      return {
        key: s?.scene?.key,
        firstMorningActive: s?.firstMorningActive,
        firstMorningDone: s?.firstMorningDone,
        firstHarvestShown: s?.firstHarvestShown,
        pendingFirstHarvest: s?.pendingFirstHarvest,
        morningXiya: !!s?.morningXiya,
      };
    });

    // ========== 段1：演出触发前收割（守卫等待路径） ==========
    console.log('--- 段1：演出触发前收割（守卫等待） ---');
    await prepare();
    await sleep(400); // create 挂钩 900ms 前，firstMorningActive=false
    const d1 = await diag();
    console.log('  [diag] 收割前:', JSON.stringify(d1));
    const harvest1 = await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      return s.harvestTileAt(14, 16);
    });
    result('A1 收获正常（radish）', harvest1 === 'radish', `返回=${harvest1}`);

    // 主循环：每 250ms 采样+翻行，共 15s，记录对白序列
    const seq1 = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      const info = await sample();
      if (info.open) seq1.push(info.text);
      await sleep(250);
    }
    // 首收对白末行 / 清晨对白首末行
    const firstHarvestLines = seq1.map((t, i) => ({ i, t }))
      .filter(x => x.t.includes('夏雅不知什么时候走了过来') || x.t.includes('比我们想象得更愿意回应'));
    const morningFirst = seq1.findIndex(t => t.includes('清晨。阳光从老屋的窗户透进来'));
    const morningLast = seq1.findIndex(t => t.includes('交给时间'));
    const firstHarvestStart = seq1.findIndex(t => t.includes('夏雅不知什么时候走了过来'));
    const firstHarvestEnd = seq1.findIndex(t => t.includes('比我们想象得更愿意回应'));
    console.log('  [seq] 首收对白行:', firstHarvestLines.map(x => `${x.i}:${x.t.slice(0, 18)}…`).join(' | '));
    console.log('  [seq] 清晨对白首行 index=', morningFirst, '末行 index=', morningLast);

    result('A2 首收对白完整播出',
      firstHarvestStart >= 0 && firstHarvestEnd > firstHarvestStart,
      `首行@${firstHarvestStart} 末行@${firstHarvestEnd}`);
    result('A3 清晨对白完整播出',
      morningFirst >= 0 && morningLast > morningFirst,
      `首行@${morningFirst} 末行@${morningLast}`);
    result('A4 顺序正确（首收先播完、清晨后播、未覆盖）',
      morningFirst >= 0 && firstHarvestEnd >= 0 && morningFirst > firstHarvestEnd,
      `清晨首行@${morningFirst} 应晚于首收末行@${firstHarvestEnd}`);
    // 兜底翻完清晨对白触发 onComplete（A5 检查复位）
    await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      const dlg = s?.storyDialogue;
      for (let i = 0; i < 40 && dlg?.isOpen(); i++) dlg.advance();
    });
    await sleep(400);
    const d1end = await diag();
    result('A5 清晨对白结束后复位（firstMorningActive=false、夏雅精灵清除）',
      d1end.firstMorningActive === false && d1end.morningXiya === false,
      JSON.stringify(d1end));

    // ========== 段2：演出触发后收割（抑制 + 补播链） ==========
    console.log('\n--- 段2：演出触发后收割（抑制+补播） ---');
    await prepare();
    await sleep(1500); // create 挂钩 900ms 已触发演出，firstMorningActive=true
    const d2 = await diag();
    console.log('  [diag] 收割前:', JSON.stringify(d2));
    const harvest2 = await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      return s.harvestTileAt(14, 16);
    });
    result('A6 收获正常（radish）', harvest2 === 'radish', `返回=${harvest2}`);
    await sleep(500);
    const after2 = await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      return { open: !!(s?.storyDialogue && s.storyDialogue.isOpen()), pending: s?.pendingFirstHarvest };
    });
    result('A7 首次收获对白被抑制（窗口内不弹）',
      after2.open === false && after2.pending === true,
      JSON.stringify(after2));

    // 翻完清晨对白（等待 → 播完后自动补播）
    let sawMorning = false;
    const t2 = Date.now();
    let deferredText = '';
    while (Date.now() - t2 < 18000) {
      const info = await sample();
      if (info.open) {
        if (info.text.includes('清晨。阳光从老屋的窗户透进来')) sawMorning = true;
        if (info.text.includes('夏雅不知什么时候走了过来')) deferredText = info.text;
      }
      await sleep(250);
      // 清晨对白播完（补播已开始）即提前退出
      if (deferredText) break;
    }
    result('A8 清晨对白播完后补播首次收获对白',
      sawMorning && !!deferredText,
      `清晨=${sawMorning} 补播首行="${deferredText.slice(0, 30)}…"`);

    const pass = results.filter(Boolean).length;
    const fail = results.length - pass;
    console.log(`\n========== 结果: ✅ ${pass} / ❌ ${fail} ==========`);
    if (fail > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('探针异常:', err);
  process.exit(1);
});
