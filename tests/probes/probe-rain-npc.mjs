/**
 * probe-rain-npc.mjs — 天气扩面第二刀（2026-08-16 制作人拍板）：雨天 NPC 生活台词 验证
 *
 * 验证（Level 2，快照式）：
 *   A 雨日 12:00（雨窗内）→ 各 NPC getDailyNpcLine 命中 RAIN_LINES（镇长/老板/矿工/小梅/阿风/老周/少女）
 *   B 晴日 14:00 → 各 NPC 不命中 RAIN_LINES（走日常池/时段池）
 *   C 雨日 14:00 小梅(farm) → 雨天句优先于时段句
 *   D 河畔夏雅雨天变体对白存在（XIYA_RIVERSIDE_RAIN_DIALOGUE 已挂载，StorySystem 层）
 *   E 雨日判定与 WeatherSystem 同源（getWeather(day) 驱动 getDailyNpcLine；雨窗内 isCurrentlyRaining）
 *   F 全程无运行时错误
 *
 * 为什么快照式：NPC 生活台词挂在固定对白之后，真实对白播放会被剧情/支线/商店状态对白抢占
 * （商店未开张、镇子描述演出等优先级更高），模拟真实玩家状态成本过高且不稳定——
 * 本探针直接读主实例 getDailyNpcLine（window.debug.npcDaily），验证"池选择规则"这一核心事实，
 * 与 debug.nature 快照探针同范式（绕过 Vite dev 双模块分裂）。
 *
 * 前置：dev server（npm run dev）；node tests/probes/probe-rain-npc.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log('=== 天气扩面第二刀：雨天 NPC 台词（2026-08-16）验证 ===\n');
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
  const setGameTime = (day, hour) => evalGame(([d, h]) => {
    window.debug.setTimeFull(d, h, 0);
  }, [day, hour]);
  // 读取主实例某 NPC 当天生活台词（快照；返回 null=无池）
  const dailyLine = (id, location) => evalGame(([n, loc]) => {
    const r = window.debug.npcDaily(n, loc);
    if (!r || r.length === 0) return null;
    return r.map((l) => l.text).join(' / ');
  }, [id, location]);

  await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
  await sleep(1000);
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    const ready = await evalGame(() => !!(window.__game && window.__game.scene && window.debug?.npcDaily));
    if (ready) break;
    await sleep(300);
  }
  await sleep(800);

  // 雨天关键词（RAIN_LINES 每池第一条的锚词）
  const RAIN_KEYS = {
    elder: ['下着雨', '泥都软了'],
    shopkeeper: ['雨一落', '柜台前就没人', '擦擦灰'],
    miner: ['下雨天矿洞里', '潮气重'],
    gardener: ['雨下得正好', '花池子不用我浇', '花盆往檐下挪'],
    adventurer: ['下雨天跑不了远路', '看雨'],
    carpenter: ['雨天木料不能动', '听雨打棚顶'],
    mystery: ['雨……灯影', '灯影会碎在水里'],
  };

  // A. 雨日 12:00（雨窗内）→ 全部命中雨天池
  await setGameTime(2, 12);
  for (const id of Object.keys(RAIN_KEYS)) {
    const loc = id === 'gardener' ? 'farm' : undefined;
    const line = await dailyLine(id, loc);
    const hit = RAIN_KEYS[id].some((k) => line && line.includes(k));
    check(`A 雨日 ${id} 命中雨天句`, hit, line ? line.slice(0, 60) : 'null');
  }

  // C. 雨日 14:00 小梅 farm → 雨天优先于时段句
  await setGameTime(2, 14);
  const gardRain = await dailyLine('gardener', 'farm');
  const gardRainHit = RAIN_KEYS.gardener.some((k) => gardRain && gardRain.includes(k));
  check('C 雨日小梅(farm) 雨天句优先于时段句', gardRainHit, gardRain ? gardRain.slice(0, 60) : 'null');

  // B. 晴日 14:00 → 全部不命中雨天池
  await setGameTime(3, 14);
  for (const id of Object.keys(RAIN_KEYS)) {
    const loc = id === 'gardener' ? 'farm' : undefined;
    const line = await dailyLine(id, loc);
    const noRain = !RAIN_KEYS[id].some((k) => line && line.includes(k));
    check(`B 晴日 ${id} 不命中雨天句（日常/时段池）`, noRain, line ? line.slice(0, 60) : 'null');
  }

  // D. 河畔夏雅雨天变体对白已挂载（StorySystem 主实例）
  const xiyaDialogue = await evalGame(async () => {
    const ss = await import('/src/systems/StorySystem.ts');
    const d = ss.XIYA_RIVERSIDE_RAIN_DIALOGUE;
    return Array.isArray(d) && d.length > 0 ? d.map((l) => l.text).join('/') : null;
  });
  await sleep(200);
  const xiyaHas = !!(xiyaDialogue && (xiyaDialogue.includes('雨天的河') || xiyaDialogue.includes('河在说话') || xiyaDialogue.includes('河在说话')));
  check('D 河畔夏雅雨天变体对白存在', xiyaHas, xiyaDialogue ? xiyaDialogue.slice(0, 80) : 'null');

  // E. 雨日判定同源：day2=雨日（雨窗内 isCurrentlyRaining=true）
  await setGameTime(2, 12);
  const weatherCheck = await evalGame(() => ({
    rainy: window.debug.nature.weather() === 'rain',
    day: window.debug.getTimeStr(),
  }));
  check('E 雨日判定与 WeatherSystem 同源（day2 雨窗内）', weatherCheck.rainy === true, JSON.stringify(weatherCheck));

  // F. 无运行时错误
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('F 全程无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  console.log(`\n结果：${pass}/${pass + fail} 通过`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => { console.error('探针异常:', e); process.exit(2); });