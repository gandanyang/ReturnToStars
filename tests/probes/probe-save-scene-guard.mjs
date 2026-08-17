/**
 * probe-save-scene-guard.mjs — P0 存档卫生专项：scene 空值保护验证
 *
 * 验证（2026-08-17 SaveSystem P0 改动）：
 *   T1 带 scene:'' 调用 save() → 返回 false（拒绝写入）
 *   T2 带 scene:'' 拒绝后 localStorage 不新增/不改写 return_star_save
 *   T3 正常 scene 调用 save() → 返回 true（回归，不受保护影响）
 *   T4 正常存档可正常写入并往返
 *
 * 前置：dev server 在 localhost:5173
 * 运行：node tests/probes/probe-save-scene-guard.mjs
 */
import puppeteer from 'puppeteer-core';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

try {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(1500);

  const r = await page.evaluate(async () => {
    const ss = await import('/src/systems/SaveSystem.ts');
    const out = {};
    localStorage.removeItem('return_star_save');

    // T1+T2: 空 scene 应被拒绝
    const guardRet = ss.save({ x: 3, y: 4, scene: '', facing: 'down' });
    out.t1ret = guardRet;
    out.t2exists = localStorage.getItem('return_star_save') !== null;

    // 先写一个正常档，再尝试用空 scene 覆盖 → 应拒绝且保留原档
    const okRet = ss.save({ x: 10, y: 20, scene: 'farm', facing: 'down' });
    const before = localStorage.getItem('return_star_save');
    const guardRet2 = ss.save({ x: 99, y: 99, scene: '', facing: 'up' });
    const after = localStorage.getItem('return_star_save');
    out.t3ret = okRet;
    out.t4guard2 = guardRet2;
    out.t4unchanged = before === after;
    const saved = JSON.parse(after);
    out.t5loc = saved?.player?.x === 10 && saved?.player?.y === 20 && saved?.player?.scene === 'farm';
    return out;
  });

  console.log('raw:', JSON.stringify(r));
  check('T1 空 scene save 返回 false', r.t1ret === false, `ret=${r.t1ret}`);
  check('T2 空 scene 拒绝后未写入新档', r.t2exists === false, `exists=${r.t2exists}`);
  check('T3 正常 scene save 返回 true', r.t3ret === true, `ret=${r.t3ret}`);
  check('T4 空 scene 覆盖被拒绝且原档保留', r.t4guard2 === false && r.t4unchanged === true, `guard2=${r.t4guard2} unchanged=${r.t4unchanged}`);
  check('T5 原档内容未被破坏（位置仍是 10,20,farm）', r.t5loc === true, JSON.stringify(r));

  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('T6 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-save-scene-guard 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-save-scene-guard 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
