/**
 * probe-ch1-elder-visit.mjs — Sprint 2 P1-2 村长来访 Vertical Slice 验收探针
 *
 * 验收目标（制作人 2026-08-12）：
 *   chapter=1 → 老屋整理完成 → 下一晚 → 村长出现 → 玩家知道青禾镇正在尝试重新开始
 *
 * 断言点：
 *   E1 前置：老屋整理未完成 → 无村长来访（不触发）
 *   E2 触发（2026-08-14 放宽）：整理完成当天进老屋 → 村长即出现（原"下一晚"门禁已取消）
 *   E3 触发：整理完成 + 进老屋 → 村长精灵出现 + 敲门音 + 对白
 *   E4 对白文本：含"灯亮着"（制作人定稿方向：灯是小镇复苏的隐喻）
 *   E5 选项：A 愿意帮忙 → ch1ElderChoice='help'；B 还没想好 → 'unsure'
 *   E6 一次性：触发后读档重进 → 不重复触发（elderVisitSprite 无）
 *   E7 存档：ch1ElderVisitDay/ch1ElderChoice 随 flags 入档
 * 附加  无页面错误
 *
 * 依赖：dev server (localhost:5173) + window.debug / window.__game
 * 视口：横屏 1024x768（项目红线）
 * 运行：node tests/probes/probe-ch1-elder-visit.mjs
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
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}

const warns = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') warns.push('[console.error] ' + msg.text());
});

/** 写入种子存档并进入 house 场景 */
async function enterHouseWithSave(overrides = {}) {
  const save = {
    version: '0.5', savedAt: 'elder-visit-probe', timestamp: Date.now(),
    player: { x: 160, y: 192, scene: 'house', facing: 'down', inventory: {} },
    world: { day: 1, hour: 21, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'done' },
    chapter: 1,
    gameState: { triggeredEvents: {} },
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
    if (sc === 'house') break;
  }
  await sleep(900);
}

/** 读取村长来访相关状态 */
async function elderState() {
  return page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('house');
    return {
      sprite: !!s?.elderVisitSprite,
      label: !!s?.elderVisitLabel,
      choice: s?.ch1ElderChoice ?? undefined,
      visitDay: s?.ch1ElderVisitDay ?? 0,
      triggered: window.debug.events.hasTriggered('ch1_elder_visit'),
      dialogOpen: !!s?.storyDialogue?.isOpen?.(),
    };
  });
}

// ============ E1 老屋整理未完成 → 无村长来访 ============
{
  await enterHouseWithSave({ gameState: { triggeredEvents: {} } }); // 未标记任何 ch1_*_done
  await sleep(1500);
  const st = await elderState();
  result('E1 整理未完成：村长不出现', !st.sprite && !st.triggered, `sprite=${st.sprite} triggered=${st.triggered}`);
}

// ============ E2 完成当天进老屋 → 村长来访（2026-08-14 放宽：不再等"下一晚"） ============
{
  // 完成 4 点，ch1ElderVisitDay=1（world.day=1 同天），当前 day=1 → 进老屋即触发
  await enterHouseWithSave({
    world: { day: 1, hour: 21, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    mapFlags: { ch1ElderVisitDay: 1 },
    gameState: { triggeredEvents: { ch1_bed_done: true, ch1_lamp_done: true, ch1_desk_done: true, ch1_radio_done: true, ch1_house_tidy_done: true } },
  });
  await sleep(2200); // 敲门延迟 1.2s + 缓冲
  const st = await elderState();
  result('E2 完成当天进老屋：村长出现（2026-08-14 放宽）', !!st.sprite && st.triggered, `sprite=${st.sprite} triggered=${st.triggered}`);
}

// ============ E3/E4 下一晚 → 村长出现 + 敲门 + 对白 ============
{
  // 完成 4 点且 ch1ElderVisitDay=1，当前 day=2 夜晚 → 触发
  await enterHouseWithSave({
    world: { day: 2, hour: 21, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    mapFlags: { ch1ElderVisitDay: 1 },
    gameState: { triggeredEvents: { ch1_bed_done: true, ch1_lamp_done: true, ch1_desk_done: true, ch1_radio_done: true, ch1_house_tidy_done: true } },
  });
  await sleep(2200); // 敲门延迟 1.2s + 缓冲
  let st = await elderState();
  result('E3 下一晚进老屋：村长精灵出现', !!st.sprite, `sprite=${st.sprite}`);
  result('E3b 对白已打开', st.dialogOpen, `dialogOpen=${st.dialogOpen}`);
  await sleep(400);
  const dialogText = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('house');
    const dlg = s?.storyDialogue;
    return dlg?.textEl ? dlg.textEl.textContent : '(no-dialogue)';
  });
  // 逐行推进对白，收集全部文本（读实例 textEl，不依赖 DOM class）
  let allText = dialogText;
  for (let i = 0; i < 8; i++) {
    // 若停在选项行（选项容器可见）→ 停止推进，交给 E5 选 A
    const atOptions = await page.evaluate(() => {
      const s = window.__game?.scene?.getScene?.('house');
      const dlg = s?.storyDialogue;
      return !!(dlg?.optionsEl && dlg.optionsEl.style.display !== 'none');
    });
    if (atOptions) break;
    await page.keyboard.press('KeyE');
    await sleep(350);
    const t = await page.evaluate(() => {
      const s = window.__game?.scene?.getScene?.('house');
      const dlg = s?.storyDialogue;
      return dlg?.textEl ? dlg.textEl.textContent : '';
    });
    allText += ' | ' + t;
    const still = await page.evaluate(() => {
      const s = window.__game?.scene?.getScene?.('house');
      return !!s?.storyDialogue?.isOpen?.();
    });
    if (!still) break;
  }
  result('E4 对白含"灯亮着"（灯=小镇复苏隐喻）', allText.includes('灯亮着'), allText.slice(0, 120));
  result('E4b 对白含"集市还能不能重新开起来"', allText.includes('集市'), allText.slice(0, 120));
  await page.screenshot({ path: 'tests/probes/test-screenshots/ch1-elder-visit.png' });
}

// ============ E5 选项 A → ch1ElderChoice='help' ============
{
  // 已在上一段触发（内存），直接选 A
  const choiceA = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('house');
    const dlg = s?.storyDialogue;
    const btns = dlg?.optionsEl ? Array.from(dlg.optionsEl.querySelectorAll('button')) : [];
    return { count: btns.length, texts: btns.map((b) => b.textContent) };
  });
  result('E5 出现选项（愿意帮忙 / 还没想好）', choiceA.count >= 2, `count=${choiceA.count} ${JSON.stringify(choiceA.texts)}`);
  if (choiceA.count >= 2) {
    await page.keyboard.press('Digit1');
    await sleep(800);
  }
  const st = await elderState();
  result('E5b 选 A → ch1ElderChoice=help', st.choice === 'help', `choice=${st.choice}`);
  result('E5c 村长精灵已清理', !st.sprite, `sprite=${st.sprite}`);
}

// ============ E6 一次性：重进不重复触发 ============
{
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.keyboard.press('Enter');
  await sleep(600);
  for (let i = 0; i < 25; i++) {
    await sleep(300);
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === 'house') break;
  }
  await sleep(1500);
  const st = await elderState();
  result('E6 读档重进：不重复触发', !st.sprite && st.triggered, `sprite=${st.sprite} triggered=${st.triggered}`);
}

// ============ E7 存档字段 ============
{
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('return_star_save');
    try {
      const d = JSON.parse(raw);
      const ev = d.gameState?.triggeredEvents ?? {};
      return {
        visitTriggered: !!ev.ch1_elder_visit,
        visitDay: d.mapFlags?.ch1ElderVisitDay ?? '(none)',
        choice: d.mapFlags?.ch1ElderChoice ?? '(none)',
      };
    } catch { return { visitTriggered: false, visitDay: '(none)', choice: '(none)' }; }
  });
  result('E7a 存档含 ch1_elder_visit', saved.visitTriggered, JSON.stringify(saved));
  result('E7b 存档含 ch1ElderChoice', saved.choice === 'help', `choice=${saved.choice}`);
  result('E7c 存档含 ch1ElderVisitDay', saved.visitDay !== '(none)', `day=${saved.visitDay}`);
}

// ============ 附加：无页面错误 ============
result('附加 无页面错误', warns.length === 0, warns.join('; ').slice(0, 160));

await browser.close();
console.log(`\n===== probe-ch1-elder-visit 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
