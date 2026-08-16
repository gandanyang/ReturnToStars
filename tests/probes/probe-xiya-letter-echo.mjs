/**
 * probe-xiya-letter-echo.mjs — 心语任务·一「世界回响」B 观星夜呼应探针
 *
 * 依据：《心语任务-世界回响原则-v0.1》（B 为首个实例）+ 衔接设计 B 项。
 * 验证：
 *   T1 未完成·一（xiyaLetterDone=false）→ 观星夜对白不变（无注入句，定稿仍 17 行）
 *   T2 完成·一（xiyaLetterDone=true）→ buildStargazeLines 注入夏雅半句（第 6 行位置）
 *   T3 定稿数组未被污染（DEMO_ENDING_DIALOGUE 仍无注入句——一字不改红线）
 *   T4 注入句文案吻合方向稿（"今晚的星星"）
 *   T5 无运行时错误
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

/** 种子存档进 farm（预置观星夜完成态 + 可选 xiyaLetterDone） */
async function seedFarm(done = false) {
  const save = {
    version: '0.5', savedAt: 'xiya-echo', timestamp: Date.now(),
    player: { x: 504, y: 232, scene: 'farm', facing: 'down', inventory: {} },
    world: { day: 2, hour: 21, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'in_progress', ch1TownIntroDone: true },
    chapter: 0, worldRestore: {},
    mapFlags: { xiyaLetterDone: done },
    gameState: { triggeredEvents: {
      xiya_letter_stage: done ? 3 : 0,
    } },
  };
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2200);
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === 'farm') break;
  }
  await sleep(2000);
  await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.reset?.();
  });
}

try {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(800);

  // ── T1/T3 未完成·一：无注入，定稿数组不被污染 ──
  await seedFarm(false);
  const r1 = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('farm');
    s.xiyaLetterDone = false; // 确定性：直接设实例字段，排除 mapFlags 时序干扰
    const built = s.buildStargazeLines();
    return {
      lineCount: built.length,
      hasEcho: JSON.stringify(built).includes('今晚的星星'),
      echoIndex: built.findIndex((l) => (l.text ?? '').includes('今晚的星星')),
    };
  });
  console.log('未完成:', JSON.stringify(r1));
  check('T1 未完成·一 → 对白无注入句', r1.hasEcho === false, `lineCount=${r1.lineCount}`);
  check('T1 未完成·一 → 对白为定稿原行数', r1.lineCount === 16, `lineCount=${r1.lineCount}`);

  // ── T2/T4 完成·一：注入夏雅半句 ──
  await seedFarm(true);
  const r2 = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('farm');
    s.xiyaLetterDone = true; // 确定性：直接设实例字段
    const built = s.buildStargazeLines();
    return {
      lineCount: built.length,
      hasEcho: JSON.stringify(built).includes('今晚的星星'),
      echoIndex: built.findIndex((l) => (l.text ?? '').includes('今晚的星星')),
      echoSpeaker: (built.find((l) => (l.text ?? '').includes('今晚的星星')) ?? {}).speaker,
    };
  });
  console.log('已完成:', JSON.stringify(r2));
  check('T2 完成·一 → 对白注入夏雅半句', r2.hasEcho === true, `lineCount=${r2.lineCount}`);
  check('T2 注入后对白 17 行（16+1）', r2.lineCount === 17, `lineCount=${r2.lineCount}`);
  check('T4 注入句为夏雅（speaker=夏雅）', r2.echoSpeaker === '夏雅', `speaker=${r2.echoSpeaker}`);
  check('T2 注入位置在第 6 行（夏雅"会有人回来继续看"之后）', r2.echoIndex === 6, `idx=${r2.echoIndex}`);

  // ── T3 定稿数组红线：DEMO_ENDING_DIALOGUE 不被污染 ──
  const r3 = await page.evaluate(async () => {
    const st = await import('/src/systems/StorySystem.ts');
    const demo = st.DEMO_ENDING_DIALOGUE;
    return { lineCount: demo.length, hasEcho: JSON.stringify(demo).includes('今晚的星星') };
  });
  console.log('定稿数组:', JSON.stringify(r3));
  check('T3 DEMO_ENDING_DIALOGUE 定稿数组保持原行数（一字不改红线）', r3.lineCount === 16, JSON.stringify(r3));
  check('T3 定稿数组未被注入污染', r3.hasEcho === false, '');

  // ── T5 无运行时错误 ──
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('T5 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  await page.screenshot({ path: join(SHOT_DIR, 'xiya-echo-final.png') });
  console.log(`\n===== probe-xiya-letter-echo 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-xiya-letter-echo 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
