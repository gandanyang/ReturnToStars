/**
 * 探针：观星夜画面居中/特效可见 防复发验证（BUG-049 归档，2026-08-11）
 *
 * 背景：BUG-049「观星夜特效不在屏幕正中间」反复回归（08-08 修相机公式 → 又触发 → 08-11 修
 * 特效布局/背景）。归档后固化本探针：任何改动观星夜相关代码（panCameraTo / zoomCameraAt /
 * createStarField / startStargaze / 观星点坐标 / 月亮坐标 / 星空范围 / 相机背景色）都必须跑本探针。
 *
 * 断言（对应三次根因）：
 *   A2 观星点基准居中：横移呼吸 tween 会使 scrollX 在 baseX±12 波动，取 3 次采样平均 ≈ 期望（容差 ±3）
 *   A3 月亮 (400,112) 可见：屏幕坐标在画面内（本次修复：原 (397,64) 在垂直视野外，月亮全程不可见）
 *   A4 星空底覆盖视野：视野右/下边界 ≤ 星空底 920×460（本次修复：原只覆盖 640×400 → 右侧深灰带）
 *   A5 相机背景色 = #0d1a30 深蓝夜空（本次修复：兜底防灰边）
 *
 * 前置：Vite dev server 跑在 localhost:5173
 * 运行：node tests/probes/probe-stargaze-visual.mjs [--mobile]
 */
import puppeteer from 'puppeteer-core';

const GAME_URL = 'http://localhost:5173/';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const IS_MOBILE = process.argv.includes('--mobile');
const LABEL = IS_MOBILE ? 'mobile(844x390)' : 'desktop(1024x768)';

const results = [];
function result(step, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${LABEL}] ${step}: ${passed ? '通过' : '失败'}${detail ? ' - ' + detail : ''}`);
  results.push(passed);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log(`=== 观星夜画面防复发探针（${LABEL}）===\n`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: IS_MOBILE
      ? { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }
      : { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });

  try {
    const page = await browser.newPage();
    if (IS_MOBILE) {
      await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
    }
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`  [err] ${msg.text().substring(0, 120)}`);
    });

    // ---------- 准备：清档 → 主线完成 → 夜晚 → 农场观星点按 E ----------
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2500);
    await page.evaluate(() => {
      window.debug.setStoryStep('done');
      window.debug.setQuestState('completed'); // tryStargaze 触发条件（L5894）
      window.debug.setTime(21, 0);
    });
    await page.evaluate(() => {
      const g = window.__game;
      const active = g.scene.getScenes(true)[0];
      if (active && active.scene.key !== 'farm') g.scene.stop(active.scene.key);
      g.scene.start('farm', { spawn: { x: 480, y: 300 } });
    });
    await sleep(2600);
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      s.player.x = 504; s.player.y = 240; s.player.facing = 'up';
    });
    await page.keyboard.press('KeyE');
    await sleep(300);
    // 三段镜头 2+3+3=8s（mobile 帧率低可能更慢）：轮询等待段3 pan 到位
    //（scrollY 到位 + scrollX 进入基准±15 横移带），最多 20s
    const sample = () => page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      const cam = s?.cameras?.main;
      if (!cam) return null;
      const zoom = cam.zoom;
      const scrollX = cam.scrollX, scrollY = cam.scrollY;
      const w = cam.width, h = cam.height;
      const bgColor = cam.backgroundColor?.color ?? null;
      return {
        scrollX, scrollY, zoom, w, h,
        camBg: bgColor === null ? null : `#${bgColor.toString(16).padStart(6, '0')}`,
        moonScreen: [(400 - scrollX) * zoom, (112 - scrollY) * zoom],
        viewW: w / zoom, viewH: h / zoom,
        starFieldVisible: !!s?.starFieldVisible,
        dlgOpen: !!s?.storyDialogue?.isOpen?.(),
      };
    });

    let ready = null;
    let readyCount = 0;
    for (let i = 0; i < 60; i++) {
      const s = await sample();
      if (s) {
        const eX = 504 - s.w / (2 * s.zoom);
        const eY = 232 - s.h / (2 * s.zoom);
        if (Math.abs(s.scrollY - eY) <= 1 && s.scrollX >= eX - 2 && s.scrollX <= eX + 13) {
          ready = s; readyCount++;
          if (readyCount >= 3) break;
        } else {
          readyCount = 0;
        }
      }
      await sleep(400);
    }
    if (!ready) { result('段3镜头到位（观星夜进入）', false, '24s 超时'); return; }

    // 横移 tween：scrollX 在 [baseX, baseX+12] 往返（Sine.inOut yoyo，1.6s/周期）。
    // 6 次 × 300ms 覆盖 >1 个周期：min≈baseX（验居中基准）、max≈baseX+12（验横移幅度）
    const samples = [ready];
    for (let i = 0; i < 5; i++) { await sleep(300); samples.push(await sample()); }
    if (!samples.every(Boolean)) { result('采样成功', false, 'cam 不可读'); return; }

    const s1 = samples[0];
    const xs = samples.map(s => s.scrollX);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const expectX = 504 - s1.w / (2 * s1.zoom);
    const expectY = 232 - s1.h / (2 * s1.zoom);
    const dY = Math.abs(s1.scrollY - expectY);
    const s3 = samples[samples.length - 1];

    // A1 星空已显示
    result('星空已显示', s1.starFieldVisible && s3.starFieldVisible, `t1=${s1.starFieldVisible} t3=${s3.starFieldVisible}`);

    // A2 观星点基准居中（横移呼吸在 [baseX, baseX+12]，min≈baseX 即居中基准正确）
    result('观星点基准居中',
      minX >= expectX - 3 && minX <= expectX + 3 && maxX >= expectX + 7 && maxX <= expectX + 13 && dY <= 1,
      `scrollX范围=[${minX.toFixed(1)},${maxX.toFixed(1)}] 期望基准=${expectX.toFixed(1)}(±12横移) | scrollY=${s1.scrollY.toFixed(1)} 期望=${expectY.toFixed(1)} (Δ${dY.toFixed(1)})`);

    // A3 月亮 (400,112) 在画面内（本次修复核心：修复前屏幕 y=-36 在画面上方外）
    const m = s3.moonScreen;
    result('月亮在画面内', m[0] > 0 && m[0] < s3.w && m[1] > 0 && m[1] < s3.h,
      `月亮屏幕=(${m[0].toFixed(0)},${m[1].toFixed(0)}) 画面=${s3.w}x${s3.h}`);

    // A4 星空底覆盖视野（底 920x460；修复前只 640x400 → 右侧深灰带）
    const overR = s3.scrollX + s3.viewW;
    const overB = s3.scrollY + s3.viewH;
    result('星空覆盖视野（无灰边）', overR <= 920 + 1 && overB <= 460 + 1,
      `视野右边界=${overR.toFixed(1)}/920 下边界=${overB.toFixed(1)}/460`);

    // A5 相机背景色深蓝夜空（兜底防灰边）
    result('相机背景深蓝夜空', s3.camBg === '#0d1a30', `背景色=${s3.camBg}`);

    const pass = results.filter(Boolean).length;
    const fail = results.length - pass;
    console.log(`\n========== [${LABEL}] 结果: ✅ ${pass} / ❌ ${fail} ==========`);
    if (fail > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('探针异常:', err);
  process.exit(1);
});
