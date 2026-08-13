/**
 * probe-ch1-house-tidy.mjs — Sprint 1 P1-1 老屋整理 Vertical Slice 验证探针
 *
 * 验证（对应 v0.3 任务拆分 P1-1 验收 + Sprint 1 验收流程）：
 *   G1 Chapter 门禁：chapter=0（第0章）进 house → 无整理点；chapter>=1 → 4 个整理点出现
 *   G2 四交互点逐个整理（床/灯/书桌/收音机）→ getHouseTidyLevel 递增 1→2→3→4
 *   G3 收音机额外反馈：触发「过去的声音」（radio_life）音频 + 生活台词
 *   G4 聚合事件：4 点全完成 → ch1_house_tidy_done 触发 + isHouseTidyComplete()=true + 人生节点
 *   G5 save/load：整理 2/4 后保存 → 重新进入 → 状态保持（getHouseTidyLevel=2，已整理点不再出现）
 *   G6 全完成读档：4/4 后 reload → chapter 保持 + getHouseTidyLevel=4 + 4 点均画"整理后"视觉
 *   G7 重复进入不重复触发：整理过的点无交互标记（mark），事件不重复触发
 * 附加  无页面错误
 *
 * 依赖：dev server (localhost:5173) + window.debug / window.__game
 * 视口：横屏 1024x768（项目红线：禁止竖屏视口）
 * 运行：node tests/probes/probe-ch1-house-tidy.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = 16; // TILE_SIZE（与 FarmState.ts 一致）
const POINTS = {
  bed: { x: 2.5 * T, y: 2.5 * T },
  lamp: { x: 5.5 * T, y: 3.5 * T },
  desk: { x: 13.5 * T, y: 4.5 * T },
  radio: { x: 16.5 * T, y: 54 },
};

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
page.on('pageerror', (e) => warns.push('pageerror: ' + e.message));

async function waitScene(key, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate((k) => {
      const s = window.__game?.scene?.getScene?.(k);
      return !!s && !!s.player;
    }, key);
    if (ok) return true;
    await sleep(300);
  }
  return false;
}

/** 进入 house 场景（可带 spawn） */
async function enterHouse(spawnX = 160, spawnY = 192) {
  await page.evaluate(([x, y]) => {
    window.__game.scene.start('house', { spawn: { x, y } });
  }, [spawnX, spawnY]);
  await waitScene('house');
  await sleep(600);
}

/** 当前整理等级 + 各点 mark 状态 */
async function tidyState() {
  return page.evaluate(() => {
    const s = window.__game.scene.getScene('house');
    return {
      level: window.debug.getHouseTidyLevel(),
      complete: window.debug.isHouseTidyComplete(),
      points: (s?.houseTidy ?? []).map((t) => ({
        key: t.key,
        hasMark: !!t.mark,
        hasDone: !!t.done,
      })),
      houseTidyCount: s?.houseTidy?.length ?? -1,
    };
  });
}

/** 靠近某整理点并按 E（直接调交互函数，等价真实按键路径） */
async function tidyPoint(key) {
  const p = POINTS[key];
  const ok = await page.evaluate(([x, y]) => {
    const s = window.__game.scene.getScene('house');
    s.player.x = x;
    s.player.y = y;
    s.player.facing = 'up';
    return s.tryHouseTidyInteract();
  }, [p.x, p.y + 20]);
  await sleep(300);
  return ok;
}

try {
  // ============ 前置：清存档 + 重载 ============
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.evaluate(() => {
    localStorage.removeItem('return_star_save');
    window.__game?.scene?.stop?.('house');
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.keyboard.press('Enter');
  await sleep(1200);
  await page.evaluate(() => {
    const b = document.getElementById('intro-skip-btn');
    if (b) b.click();
  });
  await sleep(500);

  // ============ G1a Chapter 门禁：第0章（chapter=0）进 house → 无整理点 ============
  await page.evaluate(() => {
    window.debug.setStoryStep('done');
    window.debug.setTime(10, 0);
    window.debug.setChapter(0);
  });
  await enterHouse();
  let st = await tidyState();
  result('G1a chapter=0 无老屋整理点（门禁生效）', st.points.length === 0 && st.houseTidyCount === 0,
    `points=${st.points.length} houseTidy=${st.houseTidyCount}`);

  // ============ G1b Chapter 门禁：chapter>=1 进 house → 4 个整理点 ============
  await page.evaluate(() => window.debug.setChapter(1));
  await enterHouse();
  st = await tidyState();
  const marksG1 = st.points.filter((p) => p.hasMark).length;
  result('G1b chapter>=1 出现 4 个整理点', st.houseTidyCount === 4 && marksG1 === 4,
    `count=${st.houseTidyCount} marks=${marksG1} level=${st.level}`);

  // ============ G2 逐个整理 → 等级递增 + B-2 音效接线断言 ============
  const order = ['bed', 'lamp', 'desk', 'radio'];
  // B-2（2026-08-13 体验债务）：每件整理的专属反馈音效 key
  const sfxExpect = { bed: 'tidy_bed', lamp: 'tidy_lamp', desk: 'tidy_desk', radio: 'radio_life' };
  let prevLevel = 0;
  let monotonic = true;
  let sfxOk = true;
  let sfxDetail = '';
  for (const key of order) {
    const before = await page.evaluate(() => window.debug.sfxLog().length);
    const r = await tidyPoint(key);
    const after = await tidyState();
    if (after.level !== prevLevel + 1 || !r) monotonic = false;
    prevLevel = after.level;
    const played = await page.evaluate(([b, k]) => window.debug.sfxLog().slice(b).includes(k), [before, sfxExpect[key]]);
    if (!played) { sfxOk = false; sfxDetail += ` [${key}]`; }
    console.log(`  [${key}] 整理 ret=${r} → level=${after.level} sfx=${played ? sfxExpect[key] : '缺失'}`);
  }
  result('G2 四交互点逐个整理，等级 1→2→3→4 递增', monotonic && prevLevel === 4,
    `finalLevel=${prevLevel}`);
  result('G2b B-2 每件整理均有专属反馈音效接线（tidy_bed/lamp/desk/radio_life）', sfxOk,
    sfxDetail || 'ok');

  // ============ G3 聚合事件 + 全部完成 ============
  st = await tidyState();
  const agg = await page.evaluate(() => window.debug.events.hasTriggered('ch1_house_tidy_done'));
  const aggKeys = await page.evaluate(() => {
    const d = window.debug.events.getSaveData();
    return ['ch1_bed_done', 'ch1_lamp_done', 'ch1_desk_done', 'ch1_radio_done', 'ch1_house_tidy_done']
      .every((k) => !!d.triggeredEvents[k]);
  });
  result('G3 全完成：level=4 + isHouseTidyComplete=true', st.complete && st.level === 4,
    `level=${st.level} complete=${st.complete}`);
  result('G4 ch1_house_tidy_done 聚合事件已触发 + 4 单项均已记录', agg === true && aggKeys === true,
    `agg=${agg} keysAll=${aggKeys}`);

  // 4 点均无交互标记（已完成态）
  const marksAfter = st.points.filter((p) => p.hasMark).length;
  const doneAfter = st.points.filter((p) => p.hasDone).length;
  result('G5 全完成后 4 点均画"整理后"视觉、无交互标记', marksAfter === 0 && doneAfter === 4,
    `marks=${marksAfter} done=${doneAfter}`);

  // ============ G6 存档 + 读档（reload 恢复） ============
  // 交互后已自动 save()（tryHouseTidyInteract 内），reload 应恢复 chapter + level=4
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(3000);
  await page.keyboard.press('Enter');
  await sleep(1200);
  const reloadState = await page.evaluate(() => ({
    chapter: window.debug.getChapter(),
    level: window.debug.getHouseTidyLevel(),
    complete: window.debug.isHouseTidyComplete(),
  }));
  await enterHouse();
  st = await tidyState();
  const reloadMarks = st.points.filter((p) => p.hasMark).length;
  const reloadDone = st.points.filter((p) => p.hasDone).length;
  result('G6a 读档后 chapter 保持=1', reloadState.chapter === 1, `chapter=${reloadState.chapter}`);
  result('G6b 读档后整理等级保持=4（状态持久化）',
    reloadState.level === 4 && reloadState.complete === true,
    `level=${reloadState.level} complete=${reloadState.complete}`);
  result('G6c 重进 house 4 点均保持"整理后"视觉、无交互标记（不重复触发）',
    reloadMarks === 0 && reloadDone === 4 && st.level === 4,
    `marks=${reloadMarks} done=${reloadDone} level=${st.level}`);

  // ============ G7 部分整理（2/4）save/load 中间态 ============
  // 用独立新 page（干净会话，不受前序 G 段内存/存档污染）：
  // 写入"已整理 2 项"的种子存档 → reload → 重进 house → 验证 level=2 且中间态视觉正确。
  // ⚠️ 不能用 removeItem+reload：beforeunload 自动存档会把旧内存状态写回，覆盖清档。
  {
    const page7 = await browser.newPage();
    await page7.goto(BASE, { waitUntil: 'networkidle2' });
    await sleep(1000);
    await page7.evaluate(() => {
      localStorage.setItem('return_star_save', JSON.stringify({
        version: '0.5', savedAt: 'g7', timestamp: Date.now(),
        player: { x: 160, y: 192, scene: 'house', facing: 'down', inventory: {} },
        world: { day: 1, hour: 10, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
        farm: { tiles: [], crops: [], trees: [] },
        story: { storyStep: 'done' }, chapter: 1,
        gameState: { triggeredEvents: { ch1_bed_done: true, ch1_lamp_done: true } },
      }));
    });
    await page7.reload({ waitUntil: 'networkidle2' });
    await sleep(2500);
    await page7.keyboard.press('Enter');
    await sleep(1200);
    // 等待 house 场景就绪（page7 实例）
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      const ok = await page7.evaluate(() => {
        const s = window.__game?.scene?.getScene?.('house');
        return !!s && !!s.player;
      });
      if (ok) break;
    }
    await sleep(600);
    const st7 = await page7.evaluate(() => {
      const s = window.__game.scene.getScene('house');
      const points = s.houseTidy.map(t => ({ key: t.key, hasMark: !!t.mark, hasDone: !!t.done }));
      const level = ['bed', 'lamp', 'desk', 'radio'].filter(k => window.debug.events.hasTriggered(`ch1_${k}_done`)).length;
      return { level, points };
    });
    const midDone7 = st7.points.filter(p => p.hasDone).map(p => p.key).sort();
    const midMarks7 = st7.points.filter(p => p.hasMark).map(p => p.key).sort();
    result('G7 部分整理(2/4)重进：level=2，已完成点画整理后、未完成点仍有交互标记',
      st7.level === 2 && midDone7.join(',') === 'bed,lamp' && midMarks7.join(',') === 'desk,radio',
      `level=${st7.level} done=[${midDone7}] marks=[${midMarks7}]`);
    await page7.close();
  }

  // ============ 附加：无页面错误 ============
  result('附加 无页面错误', warns.length === 0, warns.join('; ').slice(0, 200));
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-ch1-house-tidy 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
