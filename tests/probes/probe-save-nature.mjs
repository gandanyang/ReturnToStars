/**
 * probe-save-nature.mjs — P0 Phase D 收口：自然系统存档兼容探针（最重要收尾测试）
 *
 * 依据：《任务-P0采集深化任务拆分-v1.0.md》v1.1 Phase D。
 * 验证（重点：旧档兼容 + 玩家记忆进存档 + 世界状态不存档 + 防 SaveSystem 漏读 natureDiscovery）：
 *   T1 旧存档无 natureDiscovery → 正常加载（DiscoveryManager 空，不崩）
 *   T2 有发现 → save → load 含 natureDiscovery（玩家记忆进存档，防 AI 改 SaveSystem 漏字段）
 *   T3 save → apply 重载 → DiscoveryManager 恢复一致（首次发现/地点/特殊）
 *   T4 重复发现不膨胀（同一特殊只记一次）
 *   T5 世界状态（自然状态/天气/时段）不进入存档（可推导，不存）
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

  // 用真实游戏实例做存取链：
  //   - DiscoveryManager 记录写入/读取 → window.debug.nature.recordDiscovery / discoveries（真实实例，
  //     绕过 Vite dev 下动态 import 与 SaveSystem 内部 import 的 ?t= 双模块问题）
  //   - SaveSystem.save/load/apply → 动态 import（无单例状态，安全）
  const r = await page.evaluate(async () => {
    const ss = await import('/src/systems/SaveSystem.ts');
    const ns = await import('/src/systems/NatureSystem.ts');
    const ts = await import('/src/data/TimeSystem.ts');
    const out = {};
    // 真实实例读取入口（debug 面）
    const disc = () => window.debug.nature.discoveries();

    // 清空 localStorage·save
    localStorage.removeItem('return_star_save');

    // ── T1 旧存档无 natureDiscovery：直接写一个无该字段的存档 → apply → 不崩、Discovery 空
    const legacy = {
      version: '0.5', savedAt: 'legacy', timestamp: Date.now(),
      player: { x: 0, y: 0, scene: 'farm', facing: 'down', inventory: {} },
      world: { day: 5, hour: 12, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [] },
      farm: { tiles: [], crops: [], trees: [] },
      story: { storyStep: 'done' },
    };
    localStorage.setItem('return_star_save', JSON.stringify(legacy));
    const loadedLegacy = ss.load();
    const applyLegacy = (() => { try { ss.apply(loadedLegacy); return 'ok'; } catch (e) { return 'threw:' + e.message; } })();
    out.t1 = { loaded: !!loadedLegacy, apply: applyLegacy, discEmpty: Object.keys(disc()).length === 0 };

    // ── T2 有发现 → save → load 含 natureDiscovery
    ts.setTimeFull(7, 12, 0);
    window.debug.nature.recordDiscovery('dandelion', 7, 'farm');
    window.debug.nature.recordDiscovery('wild_mushroom', 5, 'forest', 'rain_forest');
    window.debug.nature.recordDiscovery('firefly', 3, 'forest', 'night_firefly');
    ss.save({ x: 1, y: 2, scene: 'farm', facing: 'down' });
    const saved = JSON.parse(localStorage.getItem('return_star_save'));
    out.t2 = {
      hasField: !!saved.natureDiscovery,
      dand: saved.natureDiscovery?.dandelion ?? null,
      globalsKeys: Object.keys(saved).filter((k) => ['natureState', 'weather', 'timePhase', 'NatureState', 'Weather', 'TimePhase'].includes(k)),
    };

    // ── T3 save → apply 重载 → DiscoveryManager 恢复
    const re = ss.load();
    ss.apply(re);
    out.t3 = {
      dandRestored: disc().dandelion ?? null,
      mushSpecial: !!disc().wild_mushroom?.specialDiscoveries?.includes('rain_forest'),
      fireSpecial: !!disc().firefly?.specialDiscoveries?.includes('night_firefly'),
    };

    // ── T4 重复发现不膨胀（同一特殊只记一次）
    window.debug.nature.recordDiscovery('wild_mushroom', 6, 'forest', 'rain_forest');
    out.t4 = { specialCount: disc().wild_mushroom?.specialDiscoveries?.length ?? 0 };

    // ── T5 世界状态不进存档
    out.t5 = { noNatureStateKey: !('natureState' in saved) && !('natureStateId' in saved), noWeatherKey: !('weather' in saved), noPhaseKey: !('timePhase' in saved) };

    return out;
  });

  // T1 旧档兼容
  console.log('legacy:', JSON.stringify(r.t1));
  check('T1 旧档(无 natureDiscovery)可 load', r.t1.loaded === true, '');
  check('T1 旧档 apply 不崩', r.t1.apply === 'ok', `apply=${r.t1.apply}`);
  check('T1 apply 后 Discovery 空（不误判）', r.t1.discEmpty === true, '');

  // T2 玩家记忆进存档
  console.log('save field:', JSON.stringify(r.t2));
  check('T2 save 含 natureDiscovery 字段', r.t2.hasField === true, '');
  check('T2 蒲公英记录入档（day/location）', r.t2.dand?.firstDiscoverDay === 7 && r.t2.dand?.firstDiscoverLocation === 'farm', JSON.stringify(r.t2.dand));

  // T3 往返恢复
  console.log('reload:', JSON.stringify(r.t3));
  check('T3 重载后蒲公英记录恢复', r.t3.dandRestored?.resourceId === 'dandelion' && r.t3.dandRestored?.firstDiscoverDay === 7, JSON.stringify(r.t3.dandRestored));
  check('T3 蘑菇 rain_forest 特殊恢复', r.t3.mushSpecial === true, '');
  check('T3 萤火虫 night_firefly 特殊恢复', r.t3.fireSpecial === true, '');

  // T4 不膨胀
  console.log('no-bloat:', JSON.stringify(r.t4));
  check('T4 重复特殊不膨胀（仍 1 条）', r.t4.specialCount === 1, `count=${r.t4.specialCount}`);

  // T5 世界状态不存
  console.log('world-not-saved:', JSON.stringify(r.t5));
  check('T5 自然状态/天气/时段 不进存档', r.t5.noNatureStateKey && r.t5.noWeatherKey && r.t5.noPhaseKey, '');

  // T6 无运行时错误
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('T6 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-save-nature 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-save-nature 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
