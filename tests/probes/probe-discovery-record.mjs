/**
 * probe-discovery-record.mjs — P0 Phase C 自然观察发现记录探针
 *
 * 依据：《任务-P0采集深化任务拆分-v1.0.md》Phase C（DiscoveryRecord / 玩家记忆进存档）。
 * 验证：
 *   T1 首次采集 → 建记录（resourceId / firstDiscoverDay / location）
 *   T2 特殊条件（雨天+森林蘑菇）→ specialDiscoveries 追加 'rain_forest'
 *   T3 萤火虫（时段观察）→ specialDiscoveries 追加 'night_firefly'
 *   T4 重复采集/重复特殊 → 不重复增加记录
 *   T5 序列化/恢复（玩家记忆存存档）：set → 序列化 ≠ 空；restore 后一致；旧档无字段 → 空
 *   T6 无运行时错误
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
    const dm = await import('/src/systems/DiscoveryManager.ts');
    const out = {};

    // T1 首次采集 → 建记录（蒲公英，farm）
    const c1 = dm.recordDiscovery({ resourceId: 'dandelion', day: 7, location: 'farm' });
    out.d_and = dm.getDiscovery('dandelion');
    // 再次普通采集 → noop（已存在，无特殊）
    const c2 = dm.recordDiscovery({ resourceId: 'dandelion', day: 8, location: 'farm' });
    out.repeat = c2;

    // T2 特殊条件：雨天森林采蘑菇 → add rain_forest
    // （语义修复 2026-08-16：真实雨窗为 Day2；day 值仅作记忆存档，此处取雨日便于对照）
    const m1 = dm.recordDiscovery({ resourceId: 'wild_mushroom', day: 2, location: 'forest', special: 'rain_forest' });
    out.mush = dm.getDiscovery('wild_mushroom');
    // 重复同一特殊 → noop
    const m2 = dm.recordDiscovery({ resourceId: 'wild_mushroom', day: 3, location: 'forest', special: 'rain_forest' });
    out.mush_repeat = m2;

    // T3 萤火虫：夜晚观察 → night_firefly（API 记录，供未来时段触发/NPC 接口）
    const f1 = dm.recordDiscovery({ resourceId: 'firefly', day: 3, location: 'forest', special: 'night_firefly' });
    out.fire = dm.getDiscovery('firefly');

    // T4 幂等查询
    out.has_dand = dm.hasDiscovery('dandelion');
    out.has_none = dm.hasDiscovery('nothing_never');
    out.has_special_mush = dm.hasSpecialDiscovery('wild_mushroom', 'rain_forest');
    out.has_special_dand = dm.hasSpecialDiscovery('dandelion', 'rain_forest');

    // T5 序列化/恢复
    out.saved = dm.getNatureDiscoverySaveData();
    dm.restoreNatureDiscoverySaveData(out.saved);
    out.rel_saved = dm.getNatureDiscoverySaveData();
    // 旧档无字段 → 空
    dm.restoreNatureDiscoverySaveData(undefined);
    out.empty_after_reset = dm.getNatureDiscoverySaveData();

    return out;
  });

  console.log('dandelion:', JSON.stringify(r.d_and));
  console.log('mushroom:', JSON.stringify(r.mush));
  console.log('firefly:', JSON.stringify(r.fire));

  // T1
  check('T1 首次采集蒲公英建记录', !!r.d_and && r.d_and.resourceId === 'dandelion' && r.d_and.firstDiscoverDay === 7, JSON.stringify(r.d_and));
  check('T1 记录含地点 farm', r.d_and?.firstDiscoverLocation === 'farm', JSON.stringify(r.d_and));
  check('T1 重复普通采集 → noop', r.repeat === 'noop', `c2=${r.repeat}`);

  // T2
  check('T2 雨天森林蘑菇记录存在', r.mush?.specialDiscoveries?.includes('rain_forest') === true, JSON.stringify(r.mush));
  check('T2 重复特殊 → noop（不重复增加）', r.mush_repeat === 'noop', `m2=${r.mush_repeat}`);

  // T3
  check('T3 萤火虫夜间特殊发现记录', r.fire?.specialDiscoveries?.includes('night_firefly') === true, JSON.stringify(r.fire));

  // T4
  check('T4 hasDiscovery(dandelion)=true', r.has_dand === true, '');
  check('T4 hasDiscovery(未见)=false', r.has_none === false, '');
  check('T4 蘑菇含 rain_forest 特殊', r.has_special_mush === true, '');
  check('T4 蒲公英无 rain_forest 特殊', r.has_special_dand === false, '');

  // T5（序列化/恢复/旧档空）
  check('T5 序列化含玩家记忆（非空）', r.saved && Object.keys(r.saved).length >= 3, JSON.stringify(Object.keys(r.saved ?? {})));
  check('T5 恢复后一致（记录仍在）', r.rel_saved && r.rel_saved.dandelion?.firstDiscoverDay === 7, JSON.stringify(r.rel_saved?.dandelion));
  check('T5 旧档无字段 → 空', r.empty_after_reset && Object.keys(r.empty_after_reset).length === 0, JSON.stringify(r.empty_after_reset));

  // T6
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('T6 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-discovery-record 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-discovery-record 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
