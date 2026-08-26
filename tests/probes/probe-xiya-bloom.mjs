/**
 * D-011 夏雅《春深有信·二 花期未至》剧情专线（第一章追加）—— 运行时验证探针
 *
 * 验证（Level 2）：
 *   A 前置门禁：未完成 ·一 或 未恢复集市 → 旧广场不生成剧情夏雅 / 无交互
 *   B S1 开场：白天在旧广场遇到"公告栏旁"夏雅 → 按 E → S1 对白 → asked 入档
 *   C S2→S8：7 个交互点（旧布匹 / 花台材料 / 邻居婆婆 / 日记纸页 / 邻居们 / 春祭摊位 / 烟花灯）
 *           每段推进 stage，存档落档（非破坏性、不重复触发）
 *   D 尾声：夏雅收尾 → 完成对白 + bloomDone 入档 + 永久春祭记忆小景生成
 *   E 任务面板：QuestPanel 显示「春深有信·二 花期未至」条目 → 完成后状态更新
 *   F 完成后重进：永久小景仍在，剧情不再生成
 *   G 全程无运行时错误
 *
 * 前置：dev server；node tests/probes/probe-xiya-bloom.mjs
 * 存档构造：tutorial 完成、garden/oldHouse 已恢复、集市已恢复（marketSquare=true）
 *          、春深有信·一 done（xiyaLetterDone=true，避免花园见证/藤架支线干扰）
 *          、时段 hour=14（白天窗口 8<=hour<20）
 */

import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = 16;
// 旧广场公告栏旁锚点（与 MapScene BLOOM_POS 一致：col30,row16）
const BLOOM_POS = { x: 30 * T + T / 2, y: 16 * T + T / 2 };
// 剧情夏雅生成位置（spawnBloomXiya 默认偏移 -24 x）
const XIYA_SPAWN_POS = { x: BLOOM_POS.x - 24, y: BLOOM_POS.y };

// save 构造：所有 world 恢复 / 教程完成 / ·一 完成 / 时段 14:00 白天
const makeSave = (x, y, overrides = {}) => ({
  version: '0.5', savedAt: 'xiya-bloom-probe', timestamp: Date.now(),
  player: { x, y, scene: 'town', facing: 'down', inventory: {} },
  world: { day: 3, hour: 14, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
  farm: { tiles: [], crops: [], trees: [], restore: { garden: true, oldHouse: true } },
  story: { storyStep: 'done' },
  mapFlags: {
    // 前置：教程完成、第一章完成、春深有信·一 完成、集市恢复
    tutorialDone: true,
    ch1Complete: true,
    xiyaLetterAsked: true,
    xiyaLetterDone: true,
    xiyaLetterStage: 4,
    // 集市恢复：标记 restored_marketSquare=true 会被 RestoreSystem 派生 isRestored('marketSquare')
    restored_marketSquare: true,
    // 屏蔽花园见证/旧藤架/需求板引导 可能的交互干扰
    sideXiyaGardenAsked: true,
    sideXiyaGardenDone: true,
    board_quest_done: true,
    ...(overrides.mapFlags || {}),
  },
  ...(overrides.extra || {}),
});

async function run() {
  console.log('=== D-011 夏雅《春深有信·二 花期未至》运行时验证 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' - ' + detail : ''}`);
    ok ? pass++ : fail++;
  };

  const getMapFlags = () => page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('return_star_save') || 'null');
    return s ? (s.mapFlags || {}) : null;
  });
  const bodyText = () => page.evaluate(() => document.body.innerText);
  const sceneState = () => page.evaluate(() => {
    const s = window.__game?.scene?.getScenes(true)?.[0];
    if (!s) return null;
    return {
      key: s.scene?.key ?? 'none',
      bloomXiya: !!s.bloomXiya,
      bloomLabel: !!s.bloomXiyaLabel,
      bloomMark: !!s.bloomMark,
      bloomMarkText: s.bloomMark?.text ?? '',
      bloomPerm: !!s.bloomPermSprite,
      bloomStage: s.xiyaBloomStage,
      bloomAsked: s.xiyaBloomAsked,
      bloomDone: s.xiyaBloomDone,
    };
  });
  const movePlayer = (x, y) => page.evaluate(([px, py]) => {
    const s = window.__game.scene.getScenes(true)[0];
    s.player.x = px; s.player.y = py;
  }, [x, y]);

  const enterGame = async (scene, timeoutMs = 20000) => {
    const t0 = Date.now();
    let cur = '';
    while (Date.now() - t0 < timeoutMs) {
      cur = await page.evaluate(() => window.__game?.scene?.getScenes(true)?.[0]?.scene?.key ?? 'none');
      if (cur === scene) return;
      if (cur === 'title') {
        await page.keyboard.press('Enter');
        await page.mouse.click(400, 300);
      }
      await sleep(350);
    }
    throw new Error(`未能进入场景 ${scene}（实际 ${cur}）错误=${errors.slice(0, 5).join(' | ')}`);
  };

  const gotoTownWithSave = async (saveObj) => {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(1000);
    await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), saveObj);
    await page.reload({ waitUntil: 'networkidle2' });
    await enterGame('town');
    await sleep(1200);
  };

  const pressE = async () => {
    await page.keyboard.press('KeyE');
    await sleep(500);
  };

  /** 推进对白直到出现所有 watchStrs（每个是 String）并关闭对话框；超时抛错 */
  const advanceDialogue = async (watchStrs, timeoutMs = 30000) => {
    const need = Array.isArray(watchStrs) ? watchStrs : [watchStrs];
    const seen = new Set();
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const b = await bodyText();
      for (const s of need) if (b.includes(s)) seen.add(s);
      // 判断是否在对话中（含「按 空格 继续」或含「E 交互」或含说话人前缀的多行文本都算对话中）
      const inDialogue = b.includes('按 空格 继续') || b.includes('按 Enter 继续');
      if (need.every((s) => seen.has(s)) && !inDialogue) {
        await sleep(300);
        return true;
      }
      // 还有未看完 → 空格推进
      await page.keyboard.press('Space');
      await sleep(180);
    }
    throw new Error(`advanceDialogue 超时（期望=${need.join('|')} 已看=${[...seen].join('|')} 错误=${errors.slice(0, 5).join(' | ')}`);
  };

  // 把玩家送到目标（xiya 或 mark）x,y 并按 E 触发，推进对白包含 anchorStrs
  const interactWithAnchor = async (targetPos, anchorStrs, desc) => {
    await movePlayer(targetPos.x, targetPos.y);
    await sleep(350);
    await pressE();
    try {
      await advanceDialogue(anchorStrs);
    } catch (e) {
      check(desc, false, String(e));
      return false;
    }
    check(desc, true);
    return true;
  };

  try {
    // ============ Case A: 前置门禁 ============
    console.log('\n[A] 前置门禁验证：缺 ·一 / 缺集市恢复 → 不生成剧情夏雅');
    const missingLetterSave = makeSave(XIYA_SPAWN_POS.x, XIYA_SPAWN_POS.y, {
      mapFlags: { xiyaLetterDone: false, restored_marketSquare: true },
    });
    await gotoTownWithSave(missingLetterSave);
    let st = await sceneState();
    check('A1 ·一 未完成：不生成 bloomXiya', !st?.bloomXiya);
    check('A1 ·一 未完成：不生成 bloomMark', !st?.bloomMark);

    const missingMarketSave = makeSave(XIYA_SPAWN_POS.x, XIYA_SPAWN_POS.y, {
      mapFlags: { restored_marketSquare: false },
    });
    await gotoTownWithSave(missingMarketSave);
    st = await sceneState();
    check('A2 集市未恢复：不生成 bloomXiya', !st?.bloomXiya);
    check('A2 集市未恢复：不生成 bloomMark', !st?.bloomMark);

    // ============ Case B→D: 9 段主流程 ============
    console.log('\n[B→D] 主线：S1→S8+尾声 顺序推进');
    const fullSave = makeSave(XIYA_SPAWN_POS.x, XIYA_SPAWN_POS.y);
    await gotoTownWithSave(fullSave);
    st = await sceneState();
    check('B0 前置满足：生成 bloomXiya（S1 开场）', !!st?.bloomXiya && !!st?.bloomLabel,
      `got bloomXiya=${st?.bloomXiya} label=${st?.bloomLabel}`);

    // S1 开场对白锚点：原文里有"喂——林澈！"和"旧广场"
    await interactWithAnchor(XIYA_SPAWN_POS, ['喂——林澈', '旧广场'], 'B-S1 开场：喂——林澈 / 旧广场 出现');
    let mf = await getMapFlags();
    check('B-S1 落档：xiyaBloomAsked=true', mf?.xiyaBloomAsked === true);
    check('B-S1 落档：xiyaBloomStage=1', mf?.xiyaBloomStage === 1);
    st = await sceneState();
    check('B-S1 现场：旧布匹 交互点生成', st?.bloomMarkText === '旧布匹');

    // S2 仓库整理：锚点原文"一卷布"、"临时仓库"
    await interactWithAnchor(BLOOM_POS, ['一卷布', '临时仓库'], 'C-S2 仓库整理：一卷布/临时仓库');
    mf = await getMapFlags();
    check('C-S2 stage=2', mf?.xiyaBloomStage === 2);
    st = await sceneState();
    check('C-S2 现场：花台材料 交互点', st?.bloomMarkText === '花台材料');

    // S3 花台搭起：原文锚点"花架"、"钉子"
    await interactWithAnchor(BLOOM_POS, ['花架', '钉子'], 'C-S3 花架修补：花架/钉子');
    mf = await getMapFlags();
    check('C-S3 stage=3', mf?.xiyaBloomStage === 3);
    st = await sceneState();
    check('C-S3 现场：邻居婆婆 交互点', st?.bloomMarkText === '邻居婆婆');

    // S4 误会解释：原文锚点"名单"、"爷爷"
    await interactWithAnchor(BLOOM_POS, ['名单', '爷爷'], 'C-S4 误会：名单/爷爷');
    mf = await getMapFlags();
    check('C-S4 stage=4', mf?.xiyaBloomStage === 4);
    st = await sceneState();
    check('C-S4 现场：日记纸页 交互点', st?.bloomMarkText === '日记纸页');

    // S5 真相转换：原文"不是只有你一个人记得"、"愿意一起"
    await interactWithAnchor(BLOOM_POS, ['不是只有你一个人记得', '愿意一起'], 'C-S5 真相：不是只有你一个人记得 / 愿意一起');
    mf = await getMapFlags();
    check('C-S5 stage=5', mf?.xiyaBloomStage === 5);
    st = await sceneState();
    check('C-S5 现场：邻居们 交互点', st?.bloomMarkText === '邻居们');

    // S6 邻居们回心转意：锚点"布棚"、"大家都来了"
    await interactWithAnchor(BLOOM_POS, ['布棚'], 'C-S6 邻居们：布棚');
    mf = await getMapFlags();
    check('C-S6 stage=6', mf?.xiyaBloomStage === 6);
    st = await sceneState();
    check('C-S6 现场：春祭摊位 交互点', st?.bloomMarkText === '春祭摊位');

    // S7 春祭当天：锚点"春祭"、"旧灯一盏盏亮起来"
    await interactWithAnchor(BLOOM_POS, ['春祭', '旧灯一盏盏亮起来'], 'C-S7 春祭当天：春祭/旧灯');
    mf = await getMapFlags();
    check('C-S7 stage=7', mf?.xiyaBloomStage === 7);
    st = await sceneState();
    check('C-S7 现场：烟花灯 交互点', st?.bloomMarkText === '烟花灯');

    // S8 烟花前挂灯：锚点"烟花"、"灯"
    await interactWithAnchor(BLOOM_POS, ['烟花', '灯'], 'C-S8 挂灯：烟花/灯');
    mf = await getMapFlags();
    check('C-S8 stage=8', mf?.xiyaBloomStage === 8);
    st = await sceneState();
    check('C-S8 现场：收尾夏雅 生成', !!st?.bloomXiya);

    // 尾声：锚点"樱花落地还会再开"、"长出来"
    await interactWithAnchor(XIYA_SPAWN_POS, ['樱花落地还会再开', '长出来'], 'D-尾声：樱花落地还会再开 / 长出来');
    mf = await getMapFlags();
    check('D-尾声 落档：xiyaBloomDone=true', mf?.xiyaBloomDone === true);
    check('D-尾声 落档：xiyaBloomStage=9', mf?.xiyaBloomStage === 9);
    st = await sceneState();
    check('D-尾声 现场：春祭记忆小景 生成', !!st?.bloomPerm);
    check('D-尾声 现场：剧情夏雅已清理', !st?.bloomXiya);
    check('D-尾声 现场：交互点已清理', !st?.bloomMark);

    // ============ Case E: 任务面板 ============
    console.log('\n[E] 任务面板：花期未至条目');
    await page.keyboard.press('KeyQ');
    await sleep(700);
    const questHtml = await page.evaluate(() => document.body.innerText);
    check('E1 QuestPanel：含「春深有信·二 花期未至」', questHtml.includes('春深有信·二 花期未至'));
    check('E2 QuestPanel：条目已完成状态匹配（含完成锚点）',
      // "已完成"/"陪夏雅一步一步筹办" 任一即可
      questHtml.includes('陪夏雅一步一步筹办一场小镇春祭') || questHtml.includes('已完成'),
      `出现：${questHtml.slice(0, 600)}…`);
    await page.keyboard.press('Escape');
    await sleep(400);

    // ============ Case F: 完成后重进（跨天/读档常驻） ============
    console.log('\n[F] 完成后重进：永久小景仍在，剧情不再生成');
    // 从 localStorage 读当前存档（已完成态），直接 reload 用它
    const doneSave = await page.evaluate(() => JSON.parse(localStorage.getItem('return_star_save') || 'null'));
    if (doneSave) {
      await page.reload({ waitUntil: 'networkidle2' });
      await enterGame('town');
      await sleep(1200);
      st = await sceneState();
      check('F1 完成后重进：bloomPerm 仍在', !!st?.bloomPerm);
      check('F2 完成后重进：bloomXiya 不再生成', !st?.bloomXiya);
      check('F3 完成后重进：bloomMark 不再生成', !st?.bloomMark);
    } else {
      check('F0 读档：完成态存档存在', false, 'localStorage 空');
    }

    // ============ Case G: 运行时错误 ============
    check('G 运行时无错误', errors.length === 0, errors.slice(0, 5).join(' | '));

    console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ==="`);
    process.exit(fail === 0 ? 0 : 1);
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error('探针异常终止：', e);
  process.exit(2);
});
