/**
 * probe-river-grass.mjs — 天气扩面三刀收口（2026-08-16 制作人拍板）：河草（普通资源）验证
 *
 * 验证（Level 2）：
 *   A 规则层：river_grass 无天气/时段规则 → present 恒 true、factor=1（晴/雨都是）
 *   B 晴日进河畔 → 河草采集点存在（普通资源始终出现，不依赖天气）
 *   C 靠近河草按 E → 背包 +1（river_grass）
 *   D 采集 → DiscoveryManager 记录 created（普通发现，无 special）
 *   E 全程无运行时错误
 *
 * 与河螺对比：河螺=天气条件出现（雨天才有）；河草=普通资源（始终在场）——"常态+条件"双资源。
 *
 * 前置：dev server（npm run dev）；node tests/probes/probe-river-grass.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = 16;
const GRASS = { x: 26 * T + 8, y: 26 * T + 8 }; // qinghe_grass_1（南岸湿草地）

async function run() {
  console.log('=== 天气扩面三刀：河草（普通资源，2026-08-16）验证 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' - ' + detail : ''}`);
    ok ? pass++ : fail++;
  };

  const evalGame = (fn, ...args) => page.evaluate(fn, ...args);
  const sceneKey = () => evalGame(() => {
    const s = window.__game?.scene.getScenes(true).find((x) => x.player);
    return s?.scene?.key ?? 'none';
  });
  const setGameTime = (day, hour) => evalGame(([d, h]) => {
    window.debug.setTimeFull(d, h, 0);
  }, [day, hour]);
  const gatherKinds = () => evalGame(() => {
    const s = window.__game.scene.getScenes(true).find((x) => x.player);
    return s?.gatherNodes?.map((n) => n.def.kind) ?? [];
  });
  const grassNodes = () => evalGame(() => {
    const s = window.__game.scene.getScenes(true).find((x) => x.player);
    return s?.gatherNodes?.filter((n) => n.def.kind === 'river_grass')?.length ?? 0;
  });
  const startRiver = async () => {
    await evalGame(() => window.__game.scene.start('qinghe_river', { spawn: { x: 24 * 16, y: 4 * 16 } }));
    const t0 = Date.now();
    while (Date.now() - t0 < 10000) {
      if ((await sceneKey()) === 'qinghe_river') break;
      await sleep(300);
    }
    await sleep(800);
  };

  await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
  await sleep(1000);
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    const ready = await evalGame(() => !!(window.__game && window.__game.scene));
    if (ready) break;
    await sleep(300);
  }
  await sleep(1000);

  // A. 规则层（显式传参纯查询）
  const rules = await evalGame(async () => {
    const rs = await import('/src/systems/ResourceSpawner.ts');
    return {
      rain: rs.querySpawn({ scene: 'qinghe_river', kind: 'river_grass', state: 'germination', weather: 'rain', phase: 'day' }),
      clear: rs.querySpawn({ scene: 'qinghe_river', kind: 'river_grass', state: 'germination', weather: 'clear', phase: 'day' }),
    };
  });
  await sleep(300);
  check('A 规则层：河草雨天 present=true', rules?.rain?.present === true, JSON.stringify(rules?.rain));
  check('A 规则层：河草晴日 present=true（普通资源）', rules?.clear?.present === true && rules?.clear?.factor === 1, JSON.stringify(rules?.clear));

  // B. 晴日进河畔 → 河草点存在（始终出现）
  await setGameTime(3, 14);
  await startRiver();
  console.log('  [diag-B] kinds=[%s]', (await gatherKinds()).join(','));
  const dryGrass = await grassNodes();
  check('B 晴日河畔：河草采集点存在（1 个）', dryGrass === 1, `grassNodes=${dryGrass} kinds=[${(await gatherKinds()).join(',')}]`);

  // C. 靠近河草按 E 采集
  await evalGame((px) => {
    const [x, y] = px;
    const s = window.__game.scene.getScenes(true).find((sc) => sc.player);
    s.player.setPosition(x, y);
  }, [GRASS.x, GRASS.y]);
  await sleep(600);
  await page.keyboard.press('KeyE');
  await sleep(1000);
  const grassInv = await evalGame(() => window.debug?.getItemCount?.('river_grass') ?? -1);
  check('C 采集河草成功（背包 +1）', grassInv === 1, `river_grass=${grassInv}`);

  // D. 发现记录 created（普通发现，无 special）
  const disc = await evalGame(() => window.debug?.nature?.discoveries?.()?.['river_grass'] ?? null);
  const okDisc = !!disc && disc.firstDiscoverDay >= 1 && (!disc.specialDiscoveries || disc.specialDiscoveries.length === 0);
  check('D 采集河草 → 普通发现记录（无特殊条件）', okDisc, JSON.stringify(disc));

  // E. 无运行时错误
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('E 全程无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  console.log(`\n结果：${pass}/${pass + fail} 通过`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => { console.error('探针异常:', e); process.exit(2); });