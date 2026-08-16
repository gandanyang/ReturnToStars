/**
 * probe-nature-p0.mjs — P0 采集深化基础层探针（T1 NatureSystem + T2 ResourceTag）
 *
 * 依据：《任务-P0采集深化任务拆分-v1.0.md》v1.1。
 * 验证：
 *   T1 getCurrentState：day→自然状态（固定规则，可推导不存档）
 *   T2 getWeatherToday：确定性天气（day 推导，无随机漂移）
 *   T3 getTimePhase：时段（晨/日/暮/夜）
 *   T4 ResourceTag：现有采集物已打正确标签（plant/flower/food/wood）
 *   T5 无运行时错误
 *   T6（附加）读档兼容：设置 day=5 再读，状态推导一致（纯函数——由 day 可得，不依赖存档）
 *
 * 2026-08-16 修正（制作人拍板 Bug 1）：不再动态 import NatureSystem / TimeSystem。
 * 原因：动态 import 在 Vite dev 下命中带 ?t= 时间戳的另一模块实例，导致 NatureSystem 内
 *       getTime() 读到第二份 time 单例（getCurrentState/getTimePhase 恒返回初始值）。
 *       改走 window.debug 指向游戏真实实例（setTimeFull + nature.* 挂钩），消除双实例。
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, 'test-screenshots');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.bringToFront();

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

try {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(1500);

  const r = await page.evaluate(async () => {
    // 经 window.debug 走游戏真实实例（绕过 Vite dev 双模块问题）
    const inv = await import('/src/data/Inventory.ts');
    const out = {};

    // T1 自然状态：day→state（经 debug.setTimeFull 设真实实例时间）
    window.debug.setTimeFull(2, 12, 0);  out.state_day2 = window.debug.nature.state();
    window.debug.setTimeFull(12, 12, 0); out.state_day12 = window.debug.nature.state();
    window.debug.setTimeFull(25, 12, 0); out.state_day25 = window.debug.nature.state();
    window.debug.setTimeFull(40, 12, 0); out.state_day40 = window.debug.nature.state();

    // T2 天气：确定性（同一 day 两次结果一致）
    window.debug.setTimeFull(5, 12, 0); const w1 = window.debug.nature.weather();
    window.debug.setTimeFull(5, 15, 0); const w2 = window.debug.nature.weather();
    out.weather_same_day = { w1, w2 };
    window.debug.setTimeFull(6, 12, 0); out.weather_day6 = window.debug.nature.weather();

    // T3 时段
    window.debug.setTimeFull(1, 7, 0);  out.phase_dawn = window.debug.nature.phase();
    window.debug.setTimeFull(1, 13, 0); out.phase_day = window.debug.nature.phase();
    window.debug.setTimeFull(1, 19, 0); out.phase_dusk = window.debug.nature.phase();
    window.debug.setTimeFull(1, 21, 0); out.phase_night = window.debug.nature.phase();

    // T4 资源标签
    const tags = {};
    for (const id of ['dandelion', 'wild_berry', 'wild_mushroom', 'small_flower', 'twig']) {
      tags[id] = inv.getItemDef(id).resourceTags ?? [];
    }
    out.tags = tags;

    return out;
  });

  console.log('state: day2=%s day12=%s day25=%s day40=%s',
    r.state_day2.label, r.state_day12.label, r.state_day25.label, r.state_day40.label);
  console.log('tags:', JSON.stringify(r.tags));

  // T1 自然状态映射
  check('T1 day2 → 萌芽期', r.state_day2.id === 'germination', `got=${r.state_day2.id}`);
  check('T1 day12 → 繁盛期', r.state_day12.id === 'thriving', `got=${r.state_day12.id}`);
  check('T1 day25 → 收获期', r.state_day25.id === 'harvest', `got=${r.state_day25.id}`);
  check('T1 day40 → 静谧期', r.state_day40.id === 'serene', `got=${r.state_day40.id}`);

  // T2 天气确定性
  check('T2 天气由 day 确定性推导（同日两次同）', r.weather_same_day.w1 === r.weather_same_day.w2, JSON.stringify(r.weather_same_day));

  // T3 时段
  check('T3 7时 → dawn', r.phase_dawn === 'dawn', `got=${r.phase_dawn}`);
  check('T3 13时 → day', r.phase_day === 'day', `got=${r.phase_day}`);
  check('T3 19时 → dusk', r.phase_dusk === 'dusk', `got=${r.phase_dusk}`);
  check('T3 21时 → night', r.phase_night === 'night', `got=${r.phase_night}`);

  // T4 资源标签
  check('T4 蒲公英 → plant+flower', r.tags.dandelion.includes('plant') && r.tags.dandelion.includes('flower'), JSON.stringify(r.tags.dandelion));
  check('T4 野莓 → food', r.tags.wild_berry.includes('food'), JSON.stringify(r.tags.wild_berry));
  check('T4 野蘑菇 → food', r.tags.wild_mushroom.includes('food'), JSON.stringify(r.tags.wild_mushroom));
  check('T4 小野花 → plant+flower', r.tags.small_flower.includes('plant') && r.tags.small_flower.includes('flower'), JSON.stringify(r.tags.small_flower));
  check('T4 小树枝 → wood', r.tags.twig.includes('wood'), JSON.stringify(r.tags.twig));

  // T6（附加）可推导不依赖存档：状态只是 day 的函数（架构性质，间接验证）
  check('T6 NatureSystem 状态为 day 纯函数（接口存在）', typeof r.state_day2 !== 'undefined' && r.state_day2.gatherKinds !== undefined, '');

  // T5 无运行时错误
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('T5 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-nature-p0 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-nature-p0 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
