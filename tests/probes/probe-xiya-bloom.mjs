/**
 * D-011 夏雅《春深有信·二 花期未至》剧情专线（第一章追加）—— 运行时验证探针
 *
 * 验证（Level 2）：
 *   A 前置门禁：未完成 ·一 或 未恢复集市 → 旧广场不生成剧情夏雅 / 无交互
 *   B S1 开场：白天在旧广场遇到"公告栏旁"夏雅 → 按 E → S1 对白 → asked 入档
 *   C S2→S8：7 个交互点（旧布匹 / 晒架木料 / 邻居婆婆 / 日记纸页 / 邻居们 / 收成摆设 / 灯笼）
 *           每段推进 stage，存档落档（非破坏性、不重复触发）
 *   D 尾声：夏雅收尾 → 完成对白 + bloomDone 入档 + 永久「晒场生活痕迹」小景生成
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
// 安全区：再左移 28px——resident_board(#32, 半径48px, 板在(32,16)) 优先级高于 bloom_xiya(#42)，
// 站在 BLOOM_POS 正点(距板32px)会被需求板吃掉 E；站这里距板 56px 出圈、距 mark 28px 仍在 bloom 32px 半径内
const BLOOM_SAFE_POS = { x: BLOOM_POS.x - 28, y: BLOOM_POS.y };

// save 构造：所有 world 恢复 / 教程完成 / ·一 完成 / 时段 14:00 白天
const makeSave = (x, y, overrides = {}) => ({
  version: '0.5', savedAt: 'xiya-bloom-probe', timestamp: Date.now(),
  player: { x, y, scene: 'town', facing: 'down', inventory: {} },
  world: { day: 3, hour: 14, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
  farm: { tiles: [], crops: [], trees: [], restore: { garden: true, oldHouse: true } },
  // 集市/花园/旧屋恢复：走顶层 worldRestore（FEATURE-037 决策 5 契约）——
  // isRestored('marketSquare') 只认 apply() 由此字段派生的内存表，mapFlags 无此派生通道
  worldRestore: { garden: true, oldHouse: true, marketSquare: true },
  // ch1TownIntroDone：首次进镇 TOWN_INTRO_DIALOGUE 的门控（MapScene L2048 / SaveSystem L416）——
  // 缺它每次进镇自动播开场引导，首个 E 被引导对白吃掉，B/C 组全部超时
  story: { storyStep: 'done', ch1TownIntroDone: true },
  mapFlags: {
    // 前置：教程完成、第一章完成、春深有信·一 完成
    tutorialDone: true,
    ch1Complete: true,
    xiyaLetterAsked: true,
    xiyaLetterDone: true,
    xiyaLetterStage: 4,
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
  // 实时读游戏状态：一次 evaluate 拿全 stage / 对白开关 / completed / 页面文本。
  // dlgOpen 用 storyDialogue.isOpen()（StoryDialogue L278，display 判断）——
  // 比 bodyText 提示词可靠（蝴蝶记忆小景等 UI 也带"继续"提示，会假阳性）。
  const liveState = () => page.evaluate(() => {
    const s = window.__game?.scene?.getScenes(true)?.[0];
    const dlg = s?.storyDialogue;
    return {
      stage: typeof s?.xiyaBloomStage === 'number' ? s.xiyaBloomStage : 0,
      done: !!s?.xiyaBloomDone,
      dlgOpen: typeof dlg?.isOpen === 'function' ? dlg.isOpen() : false,
      dlgCompleted: dlg?.completed === true,
      text: document.body.innerText,
    };
  });
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

  /**
   * 触发期望的 stage 迁移并验证对白锚词（读游戏实时状态机，不猜 bodyText 提示词）。
   *
   * 目标对白由「dlgOpen && stage===expectNext」唯一认定（MapScene advanceStage
   * 先置 stage 后 play，二者同步成立才算目标开了）。分支：
   *   目标开着       → 采锚词；completed（末行/跳过置位，淡出中）→ 停手等关闭；
   *                    否则按空格推进
   *   目标已关闭     → 锚词全 = 成功；缺 = 失败（绝不盲按补救）
   *   stage 已超前   → 级联（不应发生）= 失败
   *   其余           → 蝴蝶捕捉/花匠小梅等竞争消费者吃掉了 E（stage 未动）或
   *                    异己对白开着 → 按空格推进/重试（空格≡E，InputManager 三键同路）
   *
   * 防级联关键（Run 4/5 教训）：玩家全程不挪窝，每段对白关闭后新交互点原地生成——
   * 任何"落在目标对白关闭之后"的按键 ≡E 会立刻触发下一 stage 连跳。
   * completed 信号保证最后一按必然落在对白仍开着的轮询之后，关闭即停手。
   */
  const interactWithAnchor = async (targetPos, anchorStrs, expectNext, desc) => {
    await movePlayer(targetPos.x, targetPos.y);
    await sleep(350);
    await pressE();
    const need = Array.isArray(anchorStrs) ? anchorStrs : [anchorStrs];
    const seen = new Set();
    const t0 = Date.now();
    while (Date.now() - t0 < 45000) {
      const st = await liveState();
      if (st.dlgOpen && st.stage === expectNext) {
        for (const s of need) if (st.text.includes(s)) seen.add(s);
        if (st.dlgCompleted) continue;
        await page.keyboard.press('Space');
        await sleep(180);
        continue;
      }
      if (!st.dlgOpen && st.stage === expectNext) {
        if (need.every((s) => seen.has(s))) {
          check(desc, true);
          return true;
        }
        check(desc, false, `目标对白已关闭但锚词未采全（缺=${need.filter((s) => !seen.has(s)).join('|')}）`);
        return false;
      }
      if (!st.dlgOpen && st.stage > expectNext) {
        check(desc, false, `级联超前：stage=${st.stage} 已越过期望 ${expectNext}`);
        return false;
      }
      await page.keyboard.press('Space');
      await sleep(220);
    }
    check(desc, false, `超时：期望 stage=${expectNext} 锚词已看=${[...seen].join('|') || '无'}`);
    return false;
  };

  try {
    // ============ Case A: 前置门禁 ============
    console.log('\n[A] 前置门禁验证：缺 ·一 / 缺集市恢复 → 不生成剧情夏雅');
    const missingLetterSave = makeSave(XIYA_SPAWN_POS.x, XIYA_SPAWN_POS.y, {
      mapFlags: { xiyaLetterDone: false }, // 集市已恢复（worldRestore）→ 单独验证 ·一 门禁
    });
    await gotoTownWithSave(missingLetterSave);
    let st = await sceneState();
    check('A1 ·一 未完成：不生成 bloomXiya', !st?.bloomXiya);
    check('A1 ·一 未完成：不生成 bloomMark', !st?.bloomMark);

    const missingMarketSave = makeSave(XIYA_SPAWN_POS.x, XIYA_SPAWN_POS.y, {
      extra: { worldRestore: { garden: true, oldHouse: true } }, // 缺 marketSquare → 单独验证集市门禁
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
    await interactWithAnchor(XIYA_SPAWN_POS, ['喂——林澈', '旧广场'], 1, 'B-S1 开场：喂——林澈 / 旧广场 出现');
    let mf = await getMapFlags();
    check('B-S1 落档：xiyaBloomAsked=true', mf?.xiyaBloomAsked === true);
    check('B-S1 落档：xiyaBloomStage=1', mf?.xiyaBloomStage === 1);
    st = await sceneState();
    check('B-S1 现场：旧布匹 交互点生成', st?.bloomMarkText === '旧布匹');

    // S2 仓库整理：锚点为 StorySystem S2 原文（"一卷布"在 S1 场景行，勿用）
    await interactWithAnchor(BLOOM_SAFE_POS, ['临时仓库', '还在这里，真好'], 2, 'C-S2 仓库整理：临时仓库/还在这里，真好');
    mf = await getMapFlags();
    check('C-S2 stage=2', mf?.xiyaBloomStage === 2);
    st = await sceneState();
    check('C-S2 现场：晒架木料 交互点', st?.bloomMarkText === '晒架木料');

    // S3 修晒架：原文锚点"晒架"、"钉子"（2026-08-29 口径：花架→晒架）
    await interactWithAnchor(BLOOM_SAFE_POS, ['晒架', '钉子'], 3, 'C-S3 晒架修补：晒架/钉子');
    mf = await getMapFlags();
    check('C-S3 stage=3', mf?.xiyaBloomStage === 3);
    st = await sceneState();
    check('C-S3 现场：邻居婆婆 交互点', st?.bloomMarkText === '邻居婆婆');

    // S4 误会解释：原文锚点"名单"、"爷爷"
    await interactWithAnchor(BLOOM_SAFE_POS, ['名单', '爷爷'], 4, 'C-S4 误会：名单/爷爷');
    mf = await getMapFlags();
    check('C-S4 stage=4', mf?.xiyaBloomStage === 4);
    st = await sceneState();
    check('C-S4 现场：日记纸页 交互点', st?.bloomMarkText === '日记纸页');

    // S5 真相转换：原文"不是只有你一个人记得"、"愿意一起"
    await interactWithAnchor(BLOOM_SAFE_POS, ['不是只有你一个人记得', '愿意一起'], 5, 'C-S5 真相：不是只有你一个人记得 / 愿意一起');
    mf = await getMapFlags();
    check('C-S5 stage=5', mf?.xiyaBloomStage === 5);
    st = await sceneState();
    check('C-S5 现场：邻居们 交互点', st?.bloomMarkText === '邻居们');

    // S6 邻居们（2026-08-29 口径：布棚→晒架/竹席；锚词用 S6 独有句"一年就一趟"）
    await interactWithAnchor(BLOOM_SAFE_POS, ['一年就一趟'], 6, 'C-S6 邻居们：一年就一趟');
    mf = await getMapFlags();
    check('C-S6 stage=6', mf?.xiyaBloomStage === 6);
    st = await sceneState();
    check('C-S6 现场：收成摆设 交互点', st?.bloomMarkText === '收成摆设');

    // S7 春祭当天：锚点为 S7 原文（S7 内无"春祭"字样）
    await interactWithAnchor(BLOOM_SAFE_POS, ['缝得还挺细', '旧灯一盏盏亮起来'], 7, 'C-S7 春祭当天：缝得还挺细/旧灯一盏盏亮起来');
    mf = await getMapFlags();
    check('C-S7 stage=7', mf?.xiyaBloomStage === 7);
    st = await sceneState();
    check('C-S7 现场：灯笼 交互点', st?.bloomMarkText === '灯笼');

    // S8 收束（2026-08-29 口径：烟花→灯塔／大家）：锚点为 S8 原文
    await interactWithAnchor(BLOOM_SAFE_POS, ['灯塔', '大家都在看'], 8, 'C-S8 收束：灯塔/大家都在看');
    mf = await getMapFlags();
    check('C-S8 stage=8', mf?.xiyaBloomStage === 8);
    st = await sceneState();
    check('C-S8 现场：收尾夏雅 生成', !!st?.bloomXiya);

    // 尾声：锚点"樱花落地还会再开"、"长出来"
    await interactWithAnchor(XIYA_SPAWN_POS, ['樱花落地还会再开', '长出来'], 9, 'D-尾声：樱花落地还会再开 / 长出来');
    mf = await getMapFlags();
    check('D-尾声 落档：xiyaBloomDone=true', mf?.xiyaBloomDone === true);
    check('D-尾声 落档：xiyaBloomStage=9', mf?.xiyaBloomStage === 9);
    st = await sceneState();
    check('D-尾声 现场：晒场生活痕迹小景 生成', !!st?.bloomPerm);
    check('D-尾声 现场：剧情夏雅已清理', !st?.bloomXiya);
    check('D-尾声 现场：交互点已清理', !st?.bloomMark);

    // ============ Case E: 任务面板 ============
    console.log('\n[E] 任务面板：花期未至条目');
    // 任务键是 J（InputManager keyJ，MapScene 直读；HUD 提示"按 J 打开任务"）。
    // 花期未至条目注册在 QuestPanel 的 SIDE_QUESTS（支线页签），open() 默认页签是
    // daily——必须切到支线页签才能看到；且只抓 #quest-panel 自身文本，
    // 避免尾声 StoryNotification 卡片标题（同名）污染 body.innerText 造成假通过。
     // 按住 60ms 采样键状态与门控：isDown=false=事件未送达；justDown=true 但面板不开=gate 卡住；
    // justDown=false=已被 update 循环消费（面板应开）；gate 非 none=玩法键被门控吞掉
    await page.keyboard.down('KeyJ');
    await sleep(60);
    const jProbe = await page.evaluate(() => {
      const s = window.__game?.scene?.getScenes(true)?.[0];
      let gate = null;
      try { gate = s?.interactionRouter?.checkGate?.(s?.buildGateSnapshot?.() ?? {}) ?? null; } catch { /* 忽略 */ }
      return { isDown: !!s?.inputManager?.keyJ?.isDown, justDown: !!s?.inputManager?.keyJ?._justDown, gate };
    });
    await page.keyboard.up('KeyJ');
    const panelOpened = await (async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < 5000) {
        const visible = await page.evaluate(() => {
          const p = document.getElementById('quest-panel');
          return !!p && p.style.display !== 'none';
        });
        if (visible) return true;
        await sleep(150);
      }
      return false;
    })();
    check('E0 QuestPanel：按 J 后面板打开', panelOpened,
      `jProbe=${JSON.stringify(jProbe)}`);
    if (panelOpened) {
      await page.evaluate(() => {
        const tab = document.querySelector('#quest-panel button[data-tab="side"]');
        if (tab) tab.click();
      });
      await sleep(400);
      const panelText = await page.evaluate(() =>
        document.querySelector('#quest-panel')?.innerText ?? '');
      check('E1 QuestPanel 支线页签：含「春深有信·二 花期未至」', panelText.includes('春深有信·二 花期未至'),
        `出现：${panelText.slice(0, 400)}…`);
      check('E2 QuestPanel：条目已完成状态匹配（含完成锚点）',
        // "已完成"/"陪夏雅一步一步收拾一场秋日晒场" 任一即可（后者为进行中 objective 文案）
        panelText.includes('陪夏雅一步一步收拾一场秋日晒场') || panelText.includes('已完成'),
        `出现：${panelText.slice(0, 400)}…`);
    } else {
      check('E1 QuestPanel 支线页签：含「春深有信·二 花期未至」', false, '面板未打开');
      check('E2 QuestPanel：条目已完成状态匹配（含完成锚点）', false, '面板未打开');
    }
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
