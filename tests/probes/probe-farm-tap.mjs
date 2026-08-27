/**
 * 移动端点击种田探针：验证触屏设备在农场点击可操作农田格 → 直接锄地
 *
 * 路径：标题 → 车站 → setStoryStep('done') 跳过教程 → 出口进农场 → 点击农田格 → 检查该格视觉变化
 *
 * 前置：dev server 在 localhost:5173；node probe-farm-tap.mjs
 */

import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5175/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function sceneInfo(page) {
  return page.evaluate(() => ({
    scene: window.__game.scene.getScenes(true)[0]?.scene?.key ?? 'none',
    step: window.debug?.getStoryStep?.(),
  }));
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

/** 读取某农田格状态：用数据层验证（比视觉层更可靠，不受批量揭示时序影响） */
async function tileState(page, col, row) {
  return page.evaluate(([c, r]) => {
    const s = window.__game.scene.getScene('farm');
    // 检查 MapScene 类的静态属性
    const SceneClass = s?.constructor;
    const hasDebugTiles = SceneClass && '_debugTiles' in SceneClass;
    const debugTilesMap = SceneClass?._debugTiles;
    const debugSize = debugTilesMap?.size ?? -1;
    const debugVal = debugTilesMap?.get?.(`${c},${r}`) ?? 'N/A';
    
    // 优先使用 MapScene 实例的调试方法（避免 Vite HMR 模块分裂问题）
    const methodResult = s?.getTileStateForDebug?.(c, r);
    // 兜底：window.debug.farm
    const farmResult = window.debug?.farm?.getTileState?.(c, r);
    
    const v = s?.tileRects?.get(`${c},${r}`);
    return { 
      state: methodResult ?? farmResult ?? 'unknown',
      methodResult,
      farmResult,
      debugTilesExists: hasDebugTiles,
      debugTilesSize: debugSize,
      debugValue: debugVal,
      hasRect: !!v,
      visible: v?.plot?.visible ?? false,
      frame: v?.plot?.frame?.name ?? 'none',
    };
  }, [col, row]);
}

/** 读取某农田格视觉（原始方式，用于对比） */
async function tileVisual(page, col, row) {
  return page.evaluate(([c, r]) => {
    const s = window.__game.scene.getScene('farm');
    const v = s?.tileRects?.get(`${c},${r}`);
    if (!v?.plot) return { exists: false };
    return { exists: true, visible: v.plot.visible, frame: v.plot.frame.name };
  }, [col, row]);
}

/** 诊断：从多源读取某格状态（排查 Vite HMR 模块分裂） */
async function tileStateDiag(page, col, row) {
  return page.evaluate(([c, r]) => {
    const s = window.__game.scene.getScene('farm');
    const fromScene = s?.getTileStateForDebug?.(c, r) ?? 'no_method';
    const fromDebugFarm = window.debug?.farm?.getTileState?.(c, r) ?? 'no_debug_farm';
    const fromSceneFallback = s ? (window.__game.scene?.getScene('farm')?.tileRects?.get(`${c},${r}`) ? 'has_rect' : 'no_rect') : 'no_scene';
    // 直接读 FarmState 全局 Map（如果可访问）
    const g = globalThis;
    const globalTiles = g?.__FARM_TILES__?.get?.(`${c},${r}`) ?? 'no_global_map';
    return { fromScene, fromDebugFarm, fromSceneFallback, globalTiles };
  }, [col, row]);
}

/** 等待指定格达到目标状态（最多 2 秒，每 50ms 轮询） */
async function waitForTileState(page, col, row, expectedState, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await tileState(page, col, row);
    if (result.state === expectedState) return { success: true, state: result.state, elapsed: Date.now() - start };
    await sleep(50);
  }
  return { success: false, state: (await tileState(page, col, row)).state, elapsed: timeoutMs };
}

/** 世界坐标 → 屏幕坐标（用 cam.worldView 换算，worldView 才是真实视口边界） */
async function worldToScreen(page, wx, wy) {
  return page.evaluate(([x, y]) => {
    const s = window.__game.scene.getScene('farm');
    const cam = s.cameras.main;
    const vw = cam.worldView;
    const gx = (x - vw.x) * (800 / vw.width);
    const gy = (y - vw.y) * (600 / vw.height);
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    return {
      sx: rect.left + gx * (rect.width / 800),
      sy: rect.top + gy * (rect.height / 600),
      vw: { x: vw.x, y: vw.y, w: vw.width, h: vw.height },
    };
  }, [wx, wy]);
}

async function run() {
  console.log('=== 移动端点击种田探针（触屏点击农田格直接锄地）===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    // 项目只支持横屏：移动端模拟用 844×390 横屏视口（禁止竖屏，竖屏会触发 rotate-hint 拦截层）
    defaultViewport: { width: 844, height: 390, isMobile: true, hasTouch: true },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  // isTouchDevice() 走 UA 判定（Android/iPhone/Mobile），必须注入移动 UA，否则 handleFarmTap 直接 return
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
  page.on('console', (msg) => {
    const t = msg.text();
    if (t.includes('[P6B-DEBUG]') || t.includes('[DEBUG] handleFarmTap') || t.includes('[DEBUG] tryFarmInteractAt') || t.includes('[DEBUG] hoe applied') || t.includes('[DEBUG] handleFarmTap guards') || t.includes('[FarmState]') || t.includes('[INPUT-DEBUG]')) console.log('  🐛', t);
  });

  try {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2500);

    // 标题 → 车站 → 跳过开场 → 跳过教程（直接进入可自由种田状态）
    await page.keyboard.press('Enter');
    await sleep(2200);
    await page.evaluate(() => {
      const btn = document.getElementById('intro-skip-btn');
      if (btn) btn.click();
    });
    await sleep(800);
    await page.evaluate(() => window.debug.setStoryStep('done'));
    // 跳过教程 → 未经过 get_key 剧情，初始无锄头/水壶；补发工具（等价于教程完成后的玩家状态）
    await page.evaluate(() => {
      window.debug.giveItem('old_hoe', 1);
      window.debug.giveItem('old_watering_can', 1);
      // P6b 批量锄地验证：需要充足体力，否则 startBatch 遍历到一半体力耗尽，目标格不会被锄
      window.debug.setStamina?.(999) ?? console.warn('setStamina not found');
    });
    await sleep(300);
    let info = await sceneInfo(page);
    console.log(`1. 车站 + 跳过教程 → 场景=${info.scene}, 步骤=${info.step}`);

    // 车站出口 → 农场（教程 done 后出口直达 farm）
    // 注意：W = max(1120, innerWidth/innerHeight*600)，横屏 844×390 下 W≈1298，出口阈值 W-160≈1138，
    // 旧坐标 970 在竖屏时代够用、横屏下不足，必须传送到阈值右侧
    await teleport(page, 'station', 1180, 460, 'right');
    await sleep(3500);
    info = await sceneInfo(page);
    console.log(`2. 进入农场 → 场景=${info.scene}${info.scene === 'farm' ? ' ✅' : ' ❌'}`);
    if (info.scene !== 'farm') throw new Error('未进入农场场景');

    // 停止相机跟随，手动把视口定位到目标格 (15,10) 附近
    // （相机 zoom=2 视口只有 400×300 世界像素，startFollow 会每帧覆盖 scroll，必须 stopFollow）
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      const cam = s.cameras.main;
      cam.stopFollow();
      // 目标格中心 (248,168) 居中 → 视口左边界 (48, 18)；farm 地图 640×400，均在合法范围
      cam.scrollX = 48 - 200;
      cam.scrollY = 18 - 150;
    });
    await sleep(300);

    // BUG-033 后竖屏触屏会显示全屏旋转提示层 #rotate-hint（pointer:coarse 命中 portrait 媒体查询），
    // 拦截触屏点击；本探针模拟竖屏触屏但验证的是 farm 点击逻辑，点击前先移除提示层
    await page.evaluate(() => {
      document.getElementById('rotate-hint')?.remove();
      // chapter-banner 会覆盖整个屏幕并拦截 pointerdown 事件，需要移除或禁用
      const banner = document.querySelector('.chapter-banner');
      if (banner) {
        banner.remove();
        console.log('[PROBE] Removed chapter-banner');
      }
    });
    await sleep(100);

    // 选农田格 (15,10)：世界坐标 (248, 168)，点击前应为 empty
    const col = 15, row = 10;
    const before = await tileState(page, col, row);
    console.log(`3. 点击前格子(${col},${row}) state=${before.state} ${before.state === 'empty' ? '✅' : '❌'}`);

    const { sx, sy, vw } = await worldToScreen(page, col * 16 + 8, row * 16 + 8);
    console.log(`   视口=(${vw.x.toFixed(0)},${vw.y.toFixed(0)},${vw.w},${vw.h}) 目标格屏幕=(${sx.toFixed(0)},${sy.toFixed(0)})`);
    
    // 点击前先跑一次诊断
    const diagBefore = await tileStateDiag(page, col, row);
    console.log(`   诊断(点击前): scene=${diagBefore.fromScene} debugFarm=${diagBefore.fromDebugFarm} global=${diagBefore.globalTiles}`);
    
    // 执行点击前先测试 Phaser 是否能接收 pointerdown 事件
    const inputDebug = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const s = window.__game.scene.getScene('farm');
      
      // 详细检查 chapter-banner 和其他覆盖层
      const chapterBanner = document.querySelector('.chapter-banner');
      const cbStyle = chapterBanner ? getComputedStyle(chapterBanner) : null;
      
      // 检查所有 pointer-events 不是 none 的元素
      const allElements = document.querySelectorAll('*');
      const blockingElements = [];
      for (const el of allElements) {
        const style = getComputedStyle(el);
        if (style.pointerEvents === 'auto') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 400 && rect.height > 200) {
            blockingElements.push({
              tag: el.tagName,
              id: el.id || '',
              class: (el.className || '').toString().substring(0, 50),
              display: style.display,
              visibility: style.visibility,
              pointerEvents: style.pointerEvents,
              rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
              zIndex: style.zIndex,
            });
          }
        }
      }
      
      const result = {
        canvasExists: !!canvas,
        canvasPointerEvents: canvas ? getComputedStyle(canvas).pointerEvents : 'no_canvas',
        canvasTouchAction: canvas ? getComputedStyle(canvas).touchAction : 'no_canvas',
        sceneExists: !!s,
        inputEnabled: s?.input?.enabled ?? 'no_input',
        chapterBannerDisplay: cbStyle?.display ?? 'no_banner',
        chapterBannerPointerEvents: cbStyle?.pointerEvents ?? 'no_banner',
        blockingElements,
      };
      console.log('[INPUT-DEBUG]', JSON.stringify(result));
      return result;
    });
    console.log('   >>> Input debug:', JSON.stringify(inputDebug));
    
    // 执行点击
    console.log('   >>> About to tap at', sx, sy);
    await page.touchscreen.tap(sx, sy);
    console.log('   >>> Tap executed');
    
    // 等待批量操作完成（45 格锄地是同步的，应该很快完成）
    await sleep(200);
    console.log('   >>> After 200ms sleep');
    
    // 验证目标格 (15,10) 已锄地
    const result4 = await tileState(page, col, row);
    const tilledData = result4.state === 'tilled';
    console.log(`4. 点击后格子(${col},${row}) state=${result4.state} method=${result4.methodResult} farm=${result4.farmResult} debugTiles=${result4.debugTilesSize} debugVal=${result4.debugValue} ${tilledData ? '✅' : '❌'}`);
    
    if (!tilledData) {
      // 如果失败，跑详细诊断
      const diagAfter = await tileStateDiag(page, col, row);
      console.log(`   诊断(失败后): scene=${diagAfter.fromScene} debugFarm=${diagAfter.fromDebugFarm} global=${diagAfter.globalTiles}`);
    }
    
    // 批量验证：(15,10) 属 Plot A，抽查另一格 (13,9) 数据层也应为 tilled
    const result4c = await tileState(page, 13, 9);
    const batchTilled = result4c.state === 'tilled';
    console.log(`4c. 批量校验 Plot A(13,9) state=${result4c.state} method=${result4c.methodResult} farm=${result4c.farmResult} ${batchTilled ? '✅' : '❌'}`);

    // 再点一次同一格：tilled → 连点不崩溃即可
    await page.touchscreen.tap(sx, sy);
    await sleep(400);
    const after2 = await tileState(page, col, row);
    console.log(`5. 连点不崩溃 → state=${after2.state} ✅`);

    if (!tilledData || !batchTilled) throw new Error('点击种田未生效（含批量校验）');
    console.log('\n🎉 点击种田探针通过');
  } finally {
    await browser.close();
  }
}

run().catch(err => { console.error('探针异常:', err); process.exit(1); });
