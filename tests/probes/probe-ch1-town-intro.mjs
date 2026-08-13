/**
 * probe-ch1-town-intro.mjs — [C-1] TOWN_INTRO_DIALOGUE 文案对齐验证
 *
 * 验证项（2026-08-13 P0 残留清理：文案对齐第一章"从老屋出来到镇子"路径）：
 *   1. 触发条件：town + isTutorialDone + !isCh1TownIntroDone → 自动播放
 *   2. 文案对齐：首句包含"从老屋出来"或"沿着土路"（非旧版"庄园外的石桥"）
 *   3. 林澈内心独白：含"青禾镇"或"爷爷"（保持叙事锚点）
 *   4. 镇长承接：含"镇长"+"老屋"或"新主人"（第一章老屋整理后的承接）
 *   5. 教程引导末句：含"靠近"+"对话"（保留 E 键交互教学）
 *   6. 一次性：读档重进不再触发
 *   7. 无运行时错误
 *
 * 前置：dev server (localhost:5181) + window.__game / window.debug
 * 运行：node tests/probes/probe-ch1-town-intro.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:5173/';
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

const errors = [];
const notFound = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() === 404) notFound.push(r.url()); });

const enterGame = async (scene, timeoutMs = 25000) => {
  const t0 = Date.now();
  let cur = '';
  while (Date.now() - t0 < timeoutMs) {
    try {
      cur = await page.evaluate(() => window.__game?.scene.getScenes(true)[0]?.scene?.key ?? 'none');
    } catch {
      await sleep(300);
      continue;
    }
    if (cur === scene) return;
    if (cur === 'title') {
      await page.keyboard.press('Enter');
      await page.mouse.click(400, 300);
    }
    try {
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('div')].find((d) => d.textContent?.includes('建议打开声音游玩'));
        if (el) { el.click(); return true; }
        return false;
      });
    } catch { /* ignore */ }
    await sleep(350);
  }
  throw new Error(`未能进入场景 ${scene}（实际 ${cur}）`);
};

const dialogueOpen = () => page.evaluate(() => {
  const s = window.__game?.scene?.getScene('town');
  return !!(s?.storyDialogue?.isOpen?.());
});

const currentLine = () => page.evaluate(() => {
  const s = window.__game?.scene?.getScene('town');
  return s?.storyDialogue?.textEl?.textContent ?? '';
});

const advance = async () => {
  await page.evaluate(() => {
    const s = window.__game?.scene?.getScene('town');
    if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.advance();
  });
  await sleep(120);
};

const waitForStable = async (timeoutMs = 3000) => {
  const t0 = Date.now();
  let prev = '';
  while (Date.now() - t0 < timeoutMs) {
    const cur = await currentLine();
    if (cur && cur === prev && cur.length > 4) return cur;
    prev = cur;
    await sleep(150);
  }
  return prev;
};

const advanceLine = async () => {
  await advance();
  await waitForStable();
};

// 第0章完成教程的存档（isTutorialDone=true，未触发 ch1TownIntroDone）
// storyStep='done' 触发 isTutorialDone() = true（StorySystem.ts 的 isTutorialDone 判定）
const SAVE = {
  version: '0.5', savedAt: 'town-intro-probe', timestamp: Date.now(),
  player: { x: 208, y: 296, scene: 'town', facing: 'up', inventory: {} },
  world: { day: 2, hour: 7, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'done' },
  chapter: 0,
  gameState: { triggeredEvents: {} },
};

try {
  console.log('=== [C-1] TOWN_INTRO 文案对齐探针 ===\n');

  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(800);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1000);
  // 直接进入 town（存档场景即 town），create() 会判定 isTutorialDone + !ch1TownIntroDone 触发
  await enterGame('town');
  await sleep(800);

  // ---------- 1. 触发：600ms 后对白自动打开 ----------
  let opened = false;
  for (let i = 0; i < 30; i++) {
    opened = await dialogueOpen();
    if (opened) break;
    await sleep(300);
  }
  result('1. 进入 town 后 TOWN_INTRO 对白自动打开', opened, opened ? '' : '对白未打开');

  // ---------- 2. 首句文案对齐 ----------
  const firstLine = await waitForStable();
  const hasOldBridge = firstLine.includes('庄园外的石桥') || firstLine.includes('庄园石桥');
  const hasNewPath = firstLine.includes('老屋') || firstLine.includes('土路');
  result('2. 首句文案对齐第一章路径（老屋/土路）', hasNewPath && !hasOldBridge,
    `firstLine="${firstLine.slice(0, 60)}"`);

  // ---------- 3. 林澈内心独白 ----------
  await advanceLine();
  const secondLine = await currentLine();
  const hasAnchor = secondLine.includes('青禾镇') || secondLine.includes('爷爷');
  result('3. 林澈内心独白含叙事锚点（青禾镇/爷爷）', hasAnchor,
    `secondLine="${secondLine.slice(0, 60)}"`);

  // ---------- 4. 镇长承接 ----------
  await advanceLine();
  const lines = [firstLine, secondLine, await currentLine()];
  // 继续推进，收集所有对白行
  for (let i = 0; i < 5; i++) {
    await advanceLine();
    const t = await currentLine();
    if (!t) break;
    lines.push(t);
    if (!(await dialogueOpen())) break;
  }
  const allText = lines.join(' ');
  const hasElderBridge = allText.includes('镇长') && (allText.includes('老屋') || allText.includes('新主人'));
  result('4. 镇长承接含老屋/新主人（第一章整合后承接）', hasElderBridge,
    `未找到"镇长+老屋/新主人"，全文：${allText.slice(0, 200)}`);

  // ---------- 5. 末句教程引导 ----------
  const hasTutorial = allText.includes('靠近') && allText.includes('对话');
  result('5. 末句保留教程引导（靠近+对话）', hasTutorial,
    `未找到"靠近+对话"`);

  // ---------- 6. 一次性：重进不触发 ----------
  // 推进到对白关闭
  for (let i = 0; i < 8 && (await dialogueOpen()); i++) {
    await advance();
    await sleep(150);
  }
  await sleep(400);
  // 退出 town 再回来
  await page.evaluate(() => {
    const g = window.__game;
    const active = g.scene.getScenes(true)[0];
    if (active && active.scene.key !== 'farm') g.scene.stop(active.scene.key);
    g.scene.start('farm', { spawn: { x: 320, y: 460 } });
  });
  await sleep(2000);
  await page.evaluate(() => {
    const g = window.__game;
    const active = g.scene.getScenes(true)[0];
    if (active && active.scene.key !== 'town') g.scene.stop(active.scene.key);
    g.scene.start('town', { spawn: { x: 208, y: 296 } });
  });
  await sleep(2800);
  const reopened = await dialogueOpen();
  result('6. 重进 town 不再触发 TOWN_INTRO（一次性）', !reopened, reopened ? '对白又开了' : '');

  // ---------- 7. 无运行时错误 ----------
  result('7. 全程无运行时错误', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : '');
  result('8. 无 404 资源', notFound.length === 0, notFound.length ? notFound.slice(0, 3).join(' | ') : '');

} catch (e) {
  console.log(`\n💥 探针异常：${e.message}`);
  console.log(e.stack);
  fail++;
} finally {
  console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}
