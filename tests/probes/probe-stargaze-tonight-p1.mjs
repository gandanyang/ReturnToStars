/**
 * P1-03（2026-08-16）：观星夜 tonight 分支生活缝隙验证
 *
 * 验证：选择 C（今晚，他属于这里）后，tonight 分支应包含
 *   - 「……就是晚上风有点大。」（生活缝隙）
 *   - 「你冷？」「有一点。」
 *   - 保留「你在这里，就足够了。」
 *
 * 运行：node tests/probes/probe-stargaze-tonight-p1.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: false,
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0, fail = 0;
const result = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
};

await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
await sleep(2500);
await page.evaluate(() => { localStorage.removeItem('return_star_save'); });
await page.reload({ waitUntil: 'networkidle2' });
await sleep(2500);

// 从 StorySystem 源码读取 tonight 分支文本（与运行时同一数据源）
const branchLines = await page.evaluate(async () => {
  const mod = await import('/src/systems/StorySystem.ts');
  return mod.DEMO_ENDING_BRANCHES.tonight.map((l) => l.text);
});

const all = branchLines.join('\n');
result('P1-03 生活缝隙「……就是晚上风有点大」', all.includes('风有点大'), all);
result('P1-03 林澈「你冷？」', all.includes('你冷？'));
result('P1-03 夏雅「有一点。」', all.includes('有一点。'));
result('P1-03 保留「你在这里，就足够了。」', all.includes('你在这里，就足够了。'));
result('P1-03 保留「不需要知道。」', all.includes('不需要知道。'));

console.log(`\n结果：${pass}/${pass + fail} 通过`);
await browser.close();
process.exit(fail > 0 ? 1 : 0);
