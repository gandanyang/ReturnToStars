/**
 * probe-resource-condition.mjs — P0 采集深化 Phase B 条件资源生成探针
 *
 * 依据：《任务-P0采集深化任务拆分-v1.0.md》Phase B（ResourceSpawner 查表，Gathering 不污染）。
 * 样本（3 个验证点）：
 *   ① 野蘑菇（天气）：雨天森林 factor 提高；晴天森林 factor 普通
 *   ② 蒲公英（自然状态）：萌芽期 factor 高、静谧期 factor 低
 *   ③ 河螺（天气条件出现，2026-08-16 天气扩面）：雨天 present、晴天 present=false
 * 附加：
 *   T4 无规则资源默认 present + factor1（不破坏现有采集）
 *   T5 无运行时错误
 *   T6 回归：现有采集判定结构不受影响（确认 querySceneResource 可被调用）
 *   T7 萤火虫占位规则移除后，白天小野花不再被误伤（present 恒 true）——反向守护
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
    const rs = await import('/src/systems/ResourceSpawner.ts');
    const ts = await import('/src/data/TimeSystem.ts');
    const out = {};

    // ① 蘑菇：雨天 vs 晴天（forest）
    ts.setTimeFull(5, 12, 0); // day5 → weather rain（%5===0）
    out.mush_rain = rs.querySpawn({ scene: 'forest', kind: 'wild_mushroom', state: 'germination', weather: 'rain', phase: 'day' });
    ts.setTimeFull(6, 12, 0); // day6 → clear
    out.mush_clear = rs.querySpawn({ scene: 'forest', kind: 'wild_mushroom', state: 'germination', weather: 'clear', phase: 'day' });

    // ② 蒲公英：萌芽 vs 静谧（state factor）
    out.dand_germ = rs.querySpawn({ scene: 'forest', kind: 'dandelion', state: 'germination', weather: 'clear', phase: 'day' });
    out.dand_serene = rs.querySpawn({ scene: 'forest', kind: 'dandelion', state: 'serene', weather: 'clear', phase: 'day' });

    // ③ 河螺：雨天 vs 晴日（weatherPresent 条件出现）
    out.snail_rain = rs.querySpawn({ scene: 'qinghe_river', kind: 'river_snail', state: 'germination', weather: 'rain', phase: 'day' });
    out.snail_clear = rs.querySpawn({ scene: 'qinghe_river', kind: 'river_snail', state: 'germination', weather: 'clear', phase: 'day' });

    // ④ 无规则资源（wild_berry / twig）默认 present + factor1
    out.berry_default = rs.querySpawn({ scene: 'town', kind: 'wild_berry', state: 'germination', weather: 'clear', phase: 'day' });

    // ⑤ 回归守护：萤火虫占位移除后，白天小野花 present 恒 true（不被误伤）
    out.flower_day = rs.querySpawn({ scene: 'forest', kind: 'small_flower', state: 'germination', weather: 'clear', phase: 'day' });

    return out;
  });

  console.log('mush rain=%s factor=%s clear=%s factor=%s', r.mush_rain.present, r.mush_rain.factor, r.mush_clear.present, r.mush_clear.factor);
  console.log('dand germ=%s serene=%s', r.dand_germ.factor, r.dand_serene.factor);
  console.log('snail rain=%s clear=%s', r.snail_rain.present, r.snail_clear.present);

  // ① 蘑菇：天气因子（雨天>晴天）
  check('T1 雨天蘑菇 factor 提高（>1）', r.mush_rain.factor > 1, `factor=${r.mush_rain.factor}`);
  check('T1 晴天蘑菇 factor 普通', r.mush_clear.factor === 1, `factor=${r.mush_clear.factor}`);

  // ② 蒲公英：自然状态因子（萌芽>静谧）
  check('T2 萌芽期蒲公英 factor 高', r.dand_germ.factor > 1, `factor=${r.dand_germ.factor}`);
  check('T2 静谧期蒲公英 factor 低', r.dand_serene.factor < 1, `factor=${r.dand_serene.factor}`);

  // ③ 河螺：天气条件出现（雨天 present / 晴日 not present）
  check('T3 雨天河螺 present=true', r.snail_rain.present === true, JSON.stringify(r.snail_rain));
  check('T3 晴日河螺 present=false', r.snail_clear.present === false, JSON.stringify(r.snail_clear));

  // ④ 无规则资源
  check('T4 无规则资源默认 present+factor1', r.berry_default.present === true && r.berry_default.factor === 1, JSON.stringify(r.berry_default));

  // ⑤ 小野花回归守护（萤火虫占位移除）
  check('T7 白天小野花 present 恒 true（占位已移除）', r.flower_day.present === true, JSON.stringify(r.flower_day));

  // T5 无运行时错误
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('T5 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-resource-condition 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-resource-condition 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
