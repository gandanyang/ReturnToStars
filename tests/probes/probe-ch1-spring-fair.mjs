/**
 * probe-ch1-spring-fair.mjs — 第一章 P3 春日集（克制版）验收探针
 *
 * 验收目标（v0.3 任务书 P3）：
 *   集市恢复后的夜晚进 town → 镇上重新聚起人（灯火 + 人声 + 一句独白 + 第2章钩子）
 *   规模 ≤ 观星夜 40%（无镜头切换/无星空/无分支）
 *
 * 断言点：
 *   S1 门禁：集市未恢复 → 夜晚进 town 不触发（不提前投放）
 *   S2 触发：chapter=1 + marketSquare 已恢复 + 夜晚(hour>=20) → 进 town 触发
 *      （ch1_spring_fair 标记 + 灯火/剪影 FX 出现 + inSpringFairCutscene=true）
 *   S3 存档：gameState.triggeredEvents.ch1_spring_fair = true
 *   S4 读档不重复：重进 town 不重建 FX（一次性，读档不再触发）
 * 附加  无页面错误
 *
 * 依赖：dev server (localhost:5173) + window.debug / window.__game
 * 视口：横屏 1024x768（项目红线）
 * 运行：node tests/probes/probe-ch1-spring-fair.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: false,
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0;
let fail = 0;
function result(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  <- ' + detail}`);
  ok ? pass++ : fail++;
}

const warns = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') warns.push('[console.error] ' + msg.text());
});

/** 写入种子存档并进入 town 场景（ch1TownIntroDone=true 跳过首次进镇剧情，避免与春日集对话竞争） */
async function enterTownWithSave(overrides = {}) {
  const save = {
    version: '0.5', savedAt: 'spring-fair-probe', timestamp: Date.now(),
    player: { x: 400, y: 300, scene: 'town', facing: 'down', inventory: { wood: 40, stone: 30 } },
    world: { day: 2, hour: 21, minute: 0, coins: 300, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'done', ch1TownIntroDone: true },
    chapter: 1,
    worldRestore: { marketSquare: true },
    gameState: { triggeredEvents: { ch1_elder_visit: true } },
    ...overrides,
  };
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(800);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(600);
  for (let i = 0; i < 25; i++) {
    await sleep(300);
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === 'town') break;
  }
  await sleep(900);
}

/** 读取春日集演出状态 */
async function fairState() {
  return page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('town');
    if (!s) return { inScene: false };
    return {
      inScene: true,
      inCutscene: !!s.inSpringFairCutscene,
      fxCount: Array.isArray(s.springFairFX) ? s.springFairFX.length : -1,
      marketRestored: !!(s.marketSquareRestore && s.marketSquareRestore.restored),
    };
  });
}

// ============ S1 集市未恢复 → 不触发 ============
{
  await enterTownWithSave({
    worldRestore: {}, // 集市未恢复
  });
  await sleep(1500); // 超过 create 后 1s 延迟判定窗口
  const st = await fairState();
  result('S1 集市未恢复：春日集不触发（不提前投放）', st.inScene && !st.inCutscene && st.fxCount === 0,
    `inCutscene=${st.inCutscene} fx=${st.fxCount}`);
}

// ============ S2 集市已恢复 + 夜晚 → 触发 ============
{
  await enterTownWithSave(); // 默认：marketSquare=true, hour=21
  await sleep(2000); // create 后 1s 判定 + 演出启动
  const st = await fairState();
  result('S2 触发：灯火/剪影 FX 出现 + 演出进行中', st.inScene && st.inCutscene && st.fxCount >= 6,
    `inCutscene=${st.inCutscene} fx=${st.fxCount}`);
  await page.screenshot({ path: 'tests/probes/test-screenshots/ch1-spring-fair.png' });
}

// ============ S3 存档字段 ============
{
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('return_star_save');
    try {
      const d = JSON.parse(raw);
      return { evt: d.gameState?.triggeredEvents?.ch1_spring_fair === true, market: d.worldRestore?.marketSquare === true };
    } catch { return { evt: false, market: false }; }
  });
  result('S3 存档：gameState.triggeredEvents.ch1_spring_fair=true', saved.evt, JSON.stringify(saved));
}

// ============ S4 读档不重复 ============
{
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(600);
  for (let i = 0; i < 25; i++) {
    await sleep(300);
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === 'town') break;
  }
  await sleep(1500); // 超过延迟判定窗口：已标记 → 不重建 FX
  const st = await fairState();
  result('S4 读档不重复：不重建 FX（一次性）', st.inScene && !st.inCutscene && st.fxCount === 0,
    `inCutscene=${st.inCutscene} fx=${st.fxCount}`);
}

// ============ 附加：无页面错误 ============
result('附加 无页面错误', warns.length === 0, warns.join('; ').slice(0, 160));

await browser.close();
console.log(`\n===== probe-ch1-spring-fair 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
