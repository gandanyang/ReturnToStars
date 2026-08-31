/**
 * probe-ch1-busline-smoke.mjs — 第一章四条链「总线冒烟·交叉污染断言」（2026-08-29 制作人拍板）
 *
 * 目的：不做逐段对白复证，只验证 daily / spring-fair / dryyard / bloom 四条链**同一基线下共存**时：
 *   - 事件顺序 / 共享 EventManager / 存档恢复 / NPC 日常优先级 / 跨章节门禁 无互相污染
 *   - 重点 ①：dryyard_held → NPCSystem 全镇回应 在并存档下仍生效（不被 bloom/其余链吞掉）
 *   - 重点 ②：xiyaBloom 新口径（晒架/灯塔/灯笼）不吞晒场完成态；事件 key 彼此独立
 *
 * 用「全成就档」：春日集已办 + 晒场完成 + 心语·二完成 同时为真，读档后逐项断言。
 * 运行：node tests/probes/probe-ch1-busline-smoke.mjs（前置 dev server）
 */

import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 全成就档：四条链全部完成态
const makeFullSave = () => ({
  version: '0.5', savedAt: 'busline-smoke', timestamp: Date.now(),
  player: { x: 400, y: 300, scene: 'town', facing: 'down', inventory: { wood: 3 } },
  world: { day: 3, hour: 12, minute: 0, coins: 500, level: 2, xp: 200, stamina: 100, minedOres: [], questState: 'completed' },
  farm: { tiles: [], crops: [], trees: [], restore: { garden: true, oldHouse: true } },
  story: { storyStep: 'done', ch1TownIntroDone: true },
  chapter: 1,
  worldRestore: { garden: true, oldHouse: true, marketSquare: true },
  mapFlags: {
    shopState: 'opened', tutorialDone: true, ch1Complete: true,
    // 心语·一/二 完成态
    xiyaLetterAsked: true, xiyaLetterDone: true, xiyaLetterStage: 4,
    xiyaBloomAsked: true, xiyaBloomDone: true, xiyaBloomStage: 9,
    // 晒场完成态
    dryyardUnlocked: true, dryyardEnvStage: 3, dryyardMaterialsDone: true,
    dryyardHeld: true, dryyardPerm: true,
    // 屏蔽干扰支线
    sideXiyaGardenAsked: true, sideXiyaGardenDone: true, board_quest_done: true,
  },
  gameState: {
    triggeredEvents: {
      // daily / spring-fair / dryyard / bloom 各自事件 key（互不吞并、可同存）
      ch1_spring_fair: true, crop_corn_first_harvest: true,
      dryyard_intro: true, dryyard_laozhang_craft: true, dryyard_xiya_photo: true,
      dryyard_afeng_help: true, dryyard_held: true, dryyard_laozhang_first: true,
    },
  },
});

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
};
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

try {
  console.log('=== 第一章四条链·总线冒烟（交叉污染断言）===\n');
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(800);
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), makeFullSave());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(1500);
  for (let i = 0; i < 20; i++) {
    await sleep(350);
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)?.[0]?.scene?.key ?? 'none');
    if (sc === 'town') break;
    if (sc === 'title') await page.keyboard.press('Enter');
  }
  await sleep(2500);

  // A. 存档恢复：四条链完成态全部保持
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('return_star_save') || 'null'));
  check('A1 存档：dryyardPerm / dryyardHeld 保持', saved?.mapFlags?.dryyardPerm === true && saved?.mapFlags?.dryyardHeld === true);
  check('A2 存档：xiyaBloomDone / stage=9 保持', saved?.mapFlags?.xiyaBloomDone === true && saved?.mapFlags?.xiyaBloomStage === 9);
  check('A3 存档：四链事件 key 共存（spring_fair / dryyard_held 等）',
    Object.values(saved?.gameState?.triggeredEvents ?? {}).filter(Boolean).length >= 7);

  // B. 读档后无重放：事件 key 各自独立、互不触发对方
  const s = await page.evaluate(() => {
    const sc = window.__game.scene.getScenes(true).find((e) => e.scene?.key === 'town');
    return {
      springFairCutscene: sc?.inSpringFairCutscene === true,
      dryyardHeld: sc?.dryyardHeld === true,
      dryyardPerm: sc?.dryyardPerm === true,
      bloomDone: sc?.xiyaBloomDone === true,
      bloomXiya: !!sc?.bloomXiya,       // 完成后不应再生
      bloomPerm: !!sc?.bloomPermSprite, // 完成小景应在
      dlgOpen: sc?.storyDialogue?.isOpen?.() ?? false,
    };
  });
  check('B1 读档后春日集不重放触发', s.springFairCutscene === false && s.dlgOpen === false);
  check('B2 晒场完成态保持（不重放 intro）', s.dryyardPerm === true && s.dryyardHeld === true);
  check('B3 心语·二完成后：剧情夏雅不再生成', s.bloomDone === true && s.bloomXiya === false);
  check('B4 心语·二完成后：晒场生活痕迹小景常驻', s.bloomPerm === true);

  // C. 全镇回应（重点①）：dryyard_held → NPC 日常切晒场句（不被 bloom/其它链吞掉）
  const npcLine = await page.evaluate(async () => {
    const npc = await import('/src/systems/NPCSystem.ts');
    return (npc.getDailyNpcLine('elder', 3)?.[0]?.text ?? '');
  });
  check('C1 全镇回应：dryyard_held + bloomDone 并存时镇长日常仍为晒场句', npcLine.includes('晒场'), npcLine);
  const shopLine = await page.evaluate(async () => {
    const npc = await import('/src/systems/NPCSystem.ts');
    return (npc.getDailyNpcLine('shopkeeper', 3)?.[0]?.text ?? '');
  });
  check('C2 全镇回应：商店老板日常也为晒场句', shopLine.includes('晒场'), shopLine);

  // D. 口径存活（重点②）：code 台词层无旧口径（春祭/烟花），新口径（晒架/灯塔）在
  const dlg = await page.evaluate(async () => {
    const st = await import('/src/systems/StorySystem.ts');
    const s1 = JSON.stringify(st.XIYA_BLOOM_S1_OPEN_DIALOGUE ?? []);
    const s8 = JSON.stringify(st.XIYA_BLOOM_S8_FIREWORKS_DIALOGUE ?? []);
    return { s1, s8 };
  });
  const allTxt = dlg.s1 + dlg.s8;
  check('D1 台词层：S1/S8 无"烟花"旧口径', !allTxt.includes('烟花'), allTxt.slice(0, 60));
  check('D2 台词层：晒场新口径在（晒架/灯塔）', allTxt.includes('晒架') && allTxt.includes('灯塔'));

  // E. NPC 优先级并存：晒场完成 > 集市恢复（白天、非雨天、非夜间）
  const nightLine = await page.evaluate(async () => {
    const npc = await import('/src/systems/NPCSystem.ts');
    const t = await import('/src/data/TimeSystem.ts');
    t.setTime(12, 0);
    return (npc.getDailyNpcLine('elder', 3)?.[0]?.text ?? '');
  });
  check('E1 优先级：晒场句优先于集市句（同档）', nightLine.includes('晒场'), nightLine);

  // F. 运行时无错误（总线档：任何真错误都应红）
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('F1 总线档无运行时错误', realErrors.length === 0, realErrors.slice(0, 4).join(' | '));

  console.log(`\n===== 总线冒烟结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 冒烟异常:', e.message);
  console.log((e.stack || '').split('\n').slice(0, 6).join('\n'));
  fail++;
  console.log(`\n===== 总线冒烟结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);