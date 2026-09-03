/**
 * probe-quest-panel-chapters.mjs — 任务面板主线页签·章节分段渲染验证
 *
 * 背景（2026-09-02）：面板原版无论进度只渲染「星之碎片」Demo 行 → 一/二/三章存档看到的
 * 任务列表永远停在 Demo 阶段。改造为章节分段（第0章/一/二/三章，flag 只读推导，零存档字段）。
 *
 * 验证（Level 2）：
 *   V1 跳 ch0_before_stargaze（第0章）→ 星之碎片可见，无一/二/三章分段
 *   V2 跳 ch2_pier_ready（老船长靠岸：夜谈/黑点未触发）→ 第二章分段可见，第三章分段不出现
 *   V3 跳 ch2_night_after（夜谈之后：落地即触发灯塔黑点）→ 第三章分段出现（灯塔开门/守灯人行）
 *   V4 全程无页面错误
 *
 * 前置：dev server (localhost:5173)
 * 运行：node tests/probes/probe-quest-panel-chapters.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
function result(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}

const warns = [];

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: false,
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') warns.push('[console.error] ' + msg.text()); });
page.on('pageerror', (e) => warns.push('pageerror: ' + e.message));

/** devHub 启动：reset → devHub → 标题 Enter → 车站 */
async function bootToDevHubStation() {
  await page.goto(BASE + '?reset=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);
  await page.goto(BASE + '?devHub=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2500);
  await page.waitForFunction(() => {
    const s = window.__game?.scene?.getScene?.('title');
    return !!s && s.scene.isActive();
  }, { timeout: 10000 });
  await sleep(800);
  await page.keyboard.press('Enter');
  await sleep(2500);
}

/**
 * 直接调 triggerInteract 打开种子菜单（合成键盘 E 不稳定），在菜单内按首个文本节点点击种子。
 * 种子按钮结构：div[文本节点=label, 子div=desc]。
 */
async function pickSeed(label) {
  const ok = await page.evaluate((lbl) => {
    const s = window.__game.scene.getScene('station');
    if (!s?.player) return 'no-station';
    s.player.x = 400; s.player.y = 445;
    s.checkInteractable();
    s.triggerInteract();
    const menu = [...document.querySelectorAll('body > div')].find((d) => d.style.zIndex === '9999');
    if (!menu) return 'no-menu';
    const el = [...menu.querySelectorAll('div')].find(
      (x) => x.firstChild?.nodeType === 3 && x.firstChild?.textContent?.trim() === lbl,
    );
    if (!el) return 'no-label';
    el.click();
    return 'ok';
  }, label);
  if (ok !== 'ok') throw new Error(`pickSeed(${label}) -> ${ok}`);
  await sleep(4500);
}

/** 清自动对话链（种子落点会自动播剧情，J/面板交互被门控） */
async function skipAutoDialogues() {
  let idle = 0;
  for (let i = 0; i < 24 && idle < 2; i++) {
    const busy = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
      const skip = btns.find((b) => /Skip/.test(b.textContent ?? ''));
      if (skip) { skip.click(); return 'skip'; }
      if (document.body.innerText.includes('点击或空格继续')) return 'dialog';
      return 'idle';
    });
    if (busy === 'skip') { idle = 0; await sleep(500); continue; }
    if (busy === 'dialog') { idle = 0; await page.keyboard.press('Space'); await sleep(400); continue; }
    idle += 1;
    await sleep(400);
  }
}

/** 直接调场景实例 questPanel.open() → 切主线页签 → 返回面板文本 */
async function readMainTab() {
  await skipAutoDialogues();
  const opened = await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    const qp = s?.questPanel ?? s?.uiBus?.questPanel ?? null;
    if (!qp?.open) return false;
    qp.open();
    return true;
  });
  if (!opened) throw new Error('questPanel not reachable');
  await sleep(500);
  await page.click('[data-tab="main"]');
  await sleep(300);
  const text = await page.evaluate(() => document.querySelector('#qp-body')?.innerText ?? '');
  await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    s?.questPanel?.close?.();
  });
  await sleep(300);
  return text;
}

try {
  // ============ V1: 第0章（观星夜前）→ 仅星之碎片，无章节链 ============
  await bootToDevHubStation();
  await pickSeed('观星夜前');
  const t1 = await readMainTab();
  result('V1a ch0: 星之碎片可见', t1.includes('星之碎片'));
  result('V1b ch0: 无第一章分段', !t1.includes('第一章 · 复苏'));
  result('V1c ch0: 无第二章/三章分段', !t1.includes('第二章') && !t1.includes('第三章'));

  // ============ V2: 第二章中段（老船长靠岸：黑点未触发）→ 第二章可见、第三章不出现 ============
  await bootToDevHubStation();
  await pickSeed('故人远来·老船长靠岸');
  const t2 = await readMainTab();
  result('V2a ch2: 第二章分段可见', t2.includes('第二章 · 春信'));
  result('V2b ch2: 修钟已完成', t2.includes('广场老钟') && /广场老钟[\s\S]{0,30}已完成/.test(t2));
  result('V2c ch2: 第三章分段未出现（黑点未触发）', !t2.includes('第三章 · 归位'));

  // ============ V3: 第二章末（夜谈之后：落地即触发黑点）→ 第三章分段出现 ============
  await bootToDevHubStation();
  await pickSeed('故人远来·夜谈之后');
  let v3done = false;
  for (let i = 0; i < 8; i++) {
    const t3 = await readMainTab();
    if (t3.includes('第三章 · 归位')) {
      v3done = true;
      result('V3a ch3: 黑点后第三章分段出现', true);
      result('V3b ch3: 灯塔开门行可见', t3.includes('灯塔开门'));
      result('V3c ch3: 守灯人陈叔行可见', t3.includes('守灯人陈叔'));
      break;
    }
    await sleep(2500);
  }
  if (!v3done) {
    result('V3a ch3: 黑点后第三章分段出现', false, '20s 内未出现');
    result('V3b ch3: 灯塔开门行可见', false, '依赖 V3a');
    result('V3c ch3: 守灯人陈叔行可见', false, '依赖 V3a');
  }

  // ============ V4: 无页面错误 ============
  result('V4 无页面错误', warns.length === 0, warns[0]?.slice(0, 80) ?? 'clean');
} catch (e) {
  result('探针执行中断', false, String(e).slice(0, 100));
} finally {
  await browser.close();
}

console.log(`\n===== 任务面板章节分段探针: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
