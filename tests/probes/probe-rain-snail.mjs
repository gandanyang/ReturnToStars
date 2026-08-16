/**
 * probe-rain-snail.mjs — 天气扩面（2026-08-16 制作人拍板）：雨天河边河螺 运行时验证
 *
 * 验证（Level 2）：
 *   A 河螺规则层：雨天 present / 晴日 present=false（querySpawn 显式传参）
 *   B 晴日（debug.setTimeFull 走真实 TimeSystem）进河畔 → 河螺采集点不存在
 *   C 雨日（雨窗内）进河畔 → 河螺点存在；靠近按 E → 背包 +1（river_snail）
 *   D 采集雨日河螺 → DiscoveryManager 记录 rain_river 特殊发现（首次）
 *   E 全程无运行时错误
 *
 * 实现注（2026-08-16）：时间不依赖存档恢复——MapScene 存档恢复只在 farm 首进触发，
 * 探针直接 start 其他场景会绕过 apply；统一用 window.debug.setTimeFull 设真实时间
 * （真实 TimeSystem 实例，避免 Vite 动态 import 双模块分裂），再 start 场景。
 *
 * 前置：dev server（npm run dev）；node tests/probes/probe-rain-snail.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = 16;
const SNAIL = { x: 23 * T + 8, y: 21 * T + 8 }; // qinghe_snail_1（东岸浅滩，避开钓点/码头/凉亭）

async function run() {
  console.log('=== 天气扩面：雨天河螺（2026-08-16）运行时验证 ===\n');
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
  const worldState = () => evalGame(() => ({
    time: window.debug?.getTimeStr?.() ?? '?',
    weather: window.debug?.nature?.weather?.() ?? '?',
  }));
  const gatherKinds = () => evalGame(() => {
    const s = window.__game.scene.getScenes(true).find((x) => x.player);
    return s?.gatherNodes?.map((n) => n.def.kind) ?? [];
  });
  const snailNodes = () => evalGame(() => {
    const s = window.__game.scene.getScenes(true).find((x) => x.player);
    return s?.gatherNodes?.filter((n) => n.def.kind === 'river_snail')?.length ?? 0;
  });
  const setGameTime = (day, hour, minute = 0) => evalGame(([d, h, m]) => {
    window.debug.setTimeFull(d, h, m);
  }, [day, hour, minute]);
  const startRiver = async () => {
    await evalGame(() => window.__game.scene.start('qinghe_river', { spawn: { x: 24 * 16, y: 4 * 16 } }));
    const t0 = Date.now();
    while (Date.now() - t0 < 10000) {
      if ((await sceneKey()) === 'qinghe_river') break;
      await sleep(300);
    }
    await sleep(800);
  };
  const dialogueText = () => evalGame(() => {
    const g = window.__game;
    const s = g.scene.getScenes(true).find((x) => x.player);
    return s?.dialogueText?.text ?? '';
  });

  await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
  await sleep(1000);
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    const ready = await evalGame(() => !!(window.__game && window.__game.scene));
    if (ready) break;
    await sleep(300);
  }
  await sleep(1000);

  // A. 规则层（纯查询：显式传参，不读实例状态——避免 Vite 动态 import 双模块读取分裂）
  const rules = await evalGame(async () => {
    const rs = await import('/src/systems/ResourceSpawner.ts');
    return {
      rain: rs.querySpawn({ scene: 'qinghe_river', kind: 'river_snail', state: 'germination', weather: 'rain', phase: 'day' }),
      clear: rs.querySpawn({ scene: 'qinghe_river', kind: 'river_snail', state: 'germination', weather: 'clear', phase: 'day' }),
    };
  });
  await sleep(300);
  check('A 规则层：雨天河螺 present=true', rules?.rain?.present === true, JSON.stringify(rules?.rain));
  check('A 规则层：晴日河螺 present=false', rules?.clear?.present === false, JSON.stringify(rules?.clear));

  // B. 晴日（day 3 非雨日）进河畔 → 河螺点不存在
  await setGameTime(3, 14);
  await startRiver();
  console.log('  [diag-B] world=%j kinds=[%s]', await worldState(), (await gatherKinds()).join(','));
  const dryCount = await snailNodes();
  check('B 晴日进河畔：河螺采集点不存在', dryCount === 0, `snailNodes=${dryCount} kinds=[${(await gatherKinds()).join(',')}]`);

  // C. 雨日（day 2 教学雨，雨窗 10-16）进河畔 → 河螺存在；按 E 采到
  await setGameTime(2, 12);
  await startRiver();
  console.log('  [diag-C] world=%j kinds=[%s]', await worldState(), (await gatherKinds()).join(','));
  const wetCount = await snailNodes();
  check('C 雨日进河畔：河螺采集点存在（1 个）', wetCount === 1, `snailNodes=${wetCount} kinds=[${(await gatherKinds()).join(',')}]`);

  // 移到河螺采集点旁并按 E
  await evalGame((px) => {
    const [x, y] = px;
    const s = window.__game.scene.getScenes(true).find((sc) => sc.player);
    s.player.setPosition(x, y);
  }, [SNAIL.x, SNAIL.y]);
  await sleep(600);
  await page.keyboard.press('KeyE');
  await sleep(1000);
  const snailInv = await evalGame(() => window.debug?.getItemCount?.('river_snail') ?? -1);
  const text = await dialogueText();
  check('C 雨日采集河螺成功（背包 +1）', snailInv === 1, `river_snail=${snailInv}`);
  check('C 采集反馈文本', text.includes('河螺'), text ? `文本: ${text.slice(0, 40)}` : 'dialogueText 为空');
  await sleep(400);

  // D. 特殊发现：rain_river 已记录（玩家记忆，走真实实例 debug 快照）
  const disc = await evalGame(() => window.debug?.nature?.discoveries?.()?.['river_snail'] ?? null);
  const hasRainRiver = !!(disc && disc.specialDiscoveries && disc.specialDiscoveries.includes('rain_river'));
  check('D 采集雨日河螺 → 记录 rain_river 特殊发现', hasRainRiver, JSON.stringify(disc));

  // E. 无运行时错误
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('E 全程无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  console.log(`\n结果：${pass}/${pass + fail} 通过`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => { console.error('探针异常:', e); process.exit(2); });