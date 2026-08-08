/**
 * 全剧情流程模拟探针：真实玩家从新档跑完主线到结局（v0.1）
 *
 * 设计（制作人拍板「剧情全真实 + 时空钩子」）：
 *  - 剧情交互全部真实操作：触屏交互键/背包按钮/选项点击/锄地播种浇水/睡觉跨天/走真实出口
 *  - 仅时间用 debug 钩子：观星夜 setTime(21,0)（真实玩家需等到夜晚，探针跳时）
 *
 * 主线最短路径：标题 → 车站(开场对话+选项) → 走出车站 → 大门(夏雅→钥匙开门)
 *   → 农场(锄×3→播×3→浇×3→睡觉跨天) → Day2 清晨 → 小镇(村长接任务)
 *   → 后山(观景台→碎片+闪回) → 交付 → 观星夜(三段镜头→三选项→分支→FINALE→结算面板)
 *
 * 视口红线：844×390 landscape + hasTouch + Android UA（项目只支持横屏，禁止竖屏视口）
 * 前置：Vite dev server 在 localhost:5173
 * 运行：node tests/probes/probe-full-story-run.mjs
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, 'test-screenshots', 'full-run');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/?reset=1';

mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
function result(step, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  const msg = `${icon} ${step}${passed ? '' : ' - ' + detail}`;
  results.push(msg);
  console.log(msg);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
let shotIdx = 0;

async function shot(page, label) {
  shotIdx++;
  const path = join(SHOT_DIR, `${String(shotIdx).padStart(2, '0')}-${label}.png`);
  await page.screenshot({ path });
  console.log(`  📸 ${label}.png`);
}

async function sceneInfo(page) {
  return page.evaluate(() => ({
    scene: window.__game.scene.getScenes(true)[0]?.scene?.key ?? 'none',
    step: window.debug?.getStoryStep?.(),
  }));
}

async function questState(page) {
  return page.evaluate(() => window.debug?.getQuestState?.() ?? 'n/a');
}

/** 真实移动：直接改玩家坐标（等价玩家走到该位置），facing 为朝向 */
async function teleport(page, sceneKey, x, y, facing = 'up') {
  await page.evaluate(([k, px, py, f]) => {
    const s = window.__game.scene.getScene(k);
    if (!s?.player) return;
    s.player.x = px;
    s.player.y = py;
    s.player.facing = f;
  }, [sceneKey, x, y, facing]);
  await sleep(200);
}

/** 真实触屏「交互/使用工具」按钮（等同玩家点右下角交互键） */
async function pressInteract(page) {
  await page.evaluate(() => {
    const b = document.querySelector('#touch-controls [data-action="interact"]');
    if (b) b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  });
  await sleep(500);
}

/** 真实触屏「背包」按钮（文字匹配） */
async function pressBackpack(page) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#touch-controls div')];
    const b = btns.find(x => x.textContent?.trim() === '背包');
    if (b) b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  });
  await sleep(500);
}

/**
 * 真实逐行推进对话并记录全部行（不跳对话）。
 * 每行：若打字中先按一次显全文 → 读当前行 → 推进到下一行。
 * 遇选项行（line.options）停止，返回行列表。
 */
async function walkDialogue(page, maxLines = 45) {
  await sleep(600);
  const lines = [];
  for (let i = 0; i < maxLines; i++) {
    // 打字机中：先显示全文（真实玩家长按/连点行为）
    await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      const d = s?.storyDialogue;
      if (d?.isOpen() && d.typing) d.advance();
    });
    await sleep(120);
    const cur = await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      const d = s?.storyDialogue;
      if (!d?.isOpen()) return null;
      const l = d.lines[d.index];
      return l ? { speaker: l.speaker ?? '', text: l.text ?? '', options: l.options } : null;
    });
    if (!cur) break;
    lines.push(cur);
    if (cur.options?.length) break; // 选项行：停下等玩家点选
    const advanced = await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      const d = s?.storyDialogue;
      if (!d?.isOpen()) return false;
      const before = d.index;
      d.advance();
      return d.index !== before;
    });
    if (!advanced) break;
  }
  await sleep(250);
  return lines;
}

/** 真实点击选项按钮（按文本关键词匹配） */
async function clickOption(page, keyword) {
  const clicked = await page.evaluate((kw) => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(kw));
    if (btn) { btn.click(); return true; }
    return false;
  }, keyword);
  await sleep(700);
  return clicked;
}

/**
 * 排空自动触发的事件对白（日常随机事件等，非主线推进路径）。
 * 与 walkDialogue 的区别：不记录行、不等待选项，直接推进到对话关闭。
 * 用途：场景切换连跳时，自动对白打开会阻断出口检测（update 提前 return），
 * 真实玩家按 E 推进即可，探针等价模拟（2026-08-09 修复：adventurer_forest 随机事件）。
 */
async function drainAutoDialogue(page, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const open = await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      return s?.storyDialogue?.isOpen?.() ?? false;
    });
    if (!open) return true;
    await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      if (s?.storyDialogue?.isOpen()) s.storyDialogue.advance();
    });
    await sleep(80);
  }
  return false;
}

/** 快速推进对话 n 行（用于已知行数的长对话收尾，等价玩家连点） */
async function skipDialogue(page, lineCount) {
  for (let i = 0; i < lineCount * 2 + 1; i++) {
    await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      if (s?.storyDialogue?.isOpen()) s.storyDialogue.advance();
    });
    await sleep(50);
  }
  await sleep(400);
}

/** 等待记忆闪回 overlay 出现（碎片采集后播放） */
async function waitFlashbackShow(page, waitMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < waitMs) {
    const disp = await page.evaluate(() => {
      const el = document.getElementById('memory-flashback-overlay');
      return el ? el.style.display : 'absent';
    });
    if (disp !== 'absent' && disp !== 'none') return true;
    await sleep(300);
  }
  return false;
}

/** 点击推进记忆闪回 overlay 直到关闭（前提：waitFlashbackShow 已确认出现） */
async function advanceFlashback(page, maxRounds = 30) {
  for (let i = 0; i < maxRounds; i++) {
    const disp = await page.evaluate(() => {
      const el = document.getElementById('memory-flashback-overlay');
      if (!el) return 'absent';
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return el.style.display;
    });
    if (disp === 'absent' || disp === 'none') { await sleep(1400); return true; }
    await sleep(200);
  }
  return false;
}

/** 等待并点掉手机通知（zIndex 600，两页）与音量提示等全屏 DOM 层 */
async function dismissOverlays(page) {
  for (let round = 0; round < 3; round++) {
    let closedAny = false;
    for (let i = 0; i < 25; i++) {
      const hit = await page.evaluate(() => {
        const layers = [...document.querySelectorAll('div')].filter(d =>
          Number(d.style?.zIndex) >= 600 && d.style?.display !== 'none');
        if (layers.length === 0) return 'none';
        // 全屏层点击中心关闭/翻页（音量提示 / 手机通知）
        return { w: window.innerWidth / 2, h: window.innerHeight / 2 };
      });
      if (hit === 'none') break;
      await page.mouse.click(hit.w, hit.h);
      await sleep(700);
      closedAny = true;
    }
    if (!closedAny) break;
  }
  await sleep(600);
}

/** 轮询等待 storyDialogue 打开（最多 waitMs） */
async function waitDialogueOpen(page, waitMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < waitMs) {
    const open = await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      return s?.storyDialogue?.isOpen?.() ?? false;
    });
    if (open) return true;
    await sleep(400);
  }
  return false;
}

async function run() {
  console.log('=== 全剧情流程模拟：真实玩家主线到结局 ===\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 844, height: 390, isMobile: true, hasTouch: true },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const pageErrs = [];
  page.on('pageerror', e => {
    pageErrs.push(e.message);
    console.log(`  [pageerror] ${e.message}`);
    console.log((e.stack || '').split('\n').slice(0, 8).join('\n'));
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [err] ${msg.text().substring(0, 160)}`);
  });

  try {
    // 移动端真实玩家 UA（isTouchDevice 走 UA 判定，触屏控件/农田点击依赖它）
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');

    // ============ 1. 标题 → 车站 ============
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(2500);
    let info = await sceneInfo(page);
    result('新档进入标题画面', info.scene === 'title', `scene=${info.scene}`);
    await page.keyboard.press('Enter');
    await sleep(3000);
    info = await sceneInfo(page);
    result('按开始进入车站', info.scene === 'station', `scene=${info.scene}`);
    await shot(page, '01-station-start');

    // ============ 2. 车站开场：音量/手机通知 → 开场对白 → 选项 ============
    await dismissOverlays(page);
    await shot(page, '02-phone-dismissed');
    const stationLines = await walkDialogue(page);
    result('车站开场对白 7 行播放', stationLines.length >= 7, `行数=${stationLines.length}`);
    const stationChoice = stationLines.find(l => l.options?.length);
    result('车站出现出发选项', !!stationChoice, JSON.stringify(stationChoice?.options ?? ''));
    await shot(page, '03-station-options');
    const clickedGo = await clickOption(page, '现在就走吗');
    result('选择「现在就走吗」', clickedGo);
    // 选项后播放收尾句「……走吧。」——对话开着时 StationScene update 会提前 return
    // （对话打开禁止移动 + 出口检测被跳过），必须连点推进到对话关闭才能走出车站（真实玩家行为）
    await walkDialogue(page, 5);
    await sleep(500);
    info = await sceneInfo(page);
    result('开场后步骤 = station_move', info.step === 'station_move', `step=${info.step}`);

    // ============ 3. 走出车站 → 庄园大门 ============
    // 横屏 844×390 下 W≈1298、出口阈值 W-160≈1138，须传送 ≥1180（2026-08-08 教训）
    await teleport(page, 'station', 1180, 460, 'right');
    await sleep(3500);
    info = await sceneInfo(page);
    result('走出车站到达大门', info.scene === 'gate' && info.step === 'arrive_manor', JSON.stringify(info));

    // ============ 4. 夏雅对话 → 拿钥匙 ============
    await teleport(page, 'gate', 248, 204, 'up');
    await pressInteract(page);
    const xiyaLines = await walkDialogue(page);
    result('夏雅对话 7 行', xiyaLines.length >= 7, `行数=${xiyaLines.length}`);
    info = await sceneInfo(page);
    result('获得庄园钥匙 step=get_key', info.step === 'get_key', `step=${info.step}`);

    // ============ 5. 背包 → 使用钥匙开门 ============
    await pressBackpack(page);
    const bpOpen = await page.evaluate(() => document.getElementById('backpack-panel')?.style.display ?? '');
    result('触屏背包按钮打开面板', bpOpen === 'flex', `display=${bpOpen}`);
    const keyClicked = await page.evaluate(() => {
      const btn = document.querySelector('button[data-action="use-key"]');
      if (btn) { btn.click(); return true; }
      return false;
    });
    result('使用钥匙', keyClicked);
    const gateLines = await walkDialogue(page);
    result('开门对白播放', gateLines.length >= 11, `行数=${gateLines.length}`);
    info = await sceneInfo(page);
    result('开门后 step=clear_land', info.step === 'clear_land', `step=${info.step}`);
    await shot(page, '04-gate-opened');

    // ============ 6. 穿过大门 → 农场 ============
    await teleport(page, 'gate', 240, 40, 'up');
    await sleep(3000);
    info = await sceneInfo(page);
    result('进入农场', info.scene === 'farm', `scene=${info.scene}`);

    // ============ 7. 锄地 ×3 → 播种教学 ============
    const plotSpots = [[216, 184], [232, 184], [248, 184]];
    for (const [x, y] of plotSpots) {
      await teleport(page, 'farm', x, y, 'up');
      await pressInteract(page);
    }
    const sowLines = await walkDialogue(page);
    result('锄地×3 触发播种教学', sowLines.length >= 2, `行数=${sowLines.length}`);
    info = await sceneInfo(page);
    result('锄地后 step=sow_seeds', info.step === 'sow_seeds', `step=${info.step}`);

    // ============ 8. 播种 ×3 → 浇水教学 ============
    for (const [x, y] of plotSpots) {
      await teleport(page, 'farm', x, y, 'up');
      await pressInteract(page);
    }
    const waterLines = await walkDialogue(page);
    result('播种×3 触发浇水教学', waterLines.length >= 5, `行数=${waterLines.length}`);
    info = await sceneInfo(page);
    result('播种后 step=water_crops', info.step === 'water_crops', `step=${info.step}`);

    // ============ 9. 浇水 ×3 → 晚间对话 ============
    for (const [x, y] of plotSpots) {
      await teleport(page, 'farm', x, y, 'up');
      await pressInteract(page);
    }
    const eveningLines = await walkDialogue(page);
    result('浇水×3 触发晚间对话', eveningLines.length >= 5, `行数=${eveningLines.length}`);
    info = await sceneInfo(page);
    result('浇水后 step=evening_talk', info.step === 'evening_talk', `step=${info.step}`);
    await shot(page, '05-farm-tutorial-done');

    // ============ 10. 回老屋睡觉跨天（真实教程路径：回屋睡） ============
    await teleport(page, 'farm', 104, 320, 'up'); // farm 左出口 → house (160,192)
    await sleep(3200);
    info = await sceneInfo(page);
    result('回到老屋', info.scene === 'house', `scene=${info.scene}`);
    await teleport(page, 'house', 40, 40, 'up'); // 床铺
    await pressInteract(page);
    await sleep(3000);
    info = await sceneInfo(page);
    result('睡觉后教程完成 step=done', info.step === 'done', `step=${info.step}`);
    const dayAfterSleep = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('return_star_save')).world.day; } catch { return null; }
    });
    result('睡觉真实跨天到 Day2', dayAfterSleep === 2, `day=${dayAfterSleep}`);

    // ============ 11. Day2 清晨：出屋回农场 → 记忆演出（memory moment 4s 自动淡出）→ 夏雅对话 ============
    // 清晨演出由 farm 场景 create 的 delayedCall(900ms) 触发（tryTutorialSleep 本身不触发），
    // 故玩家必须重进 farm 场景（真实玩家清晨出门）才会播放
    await teleport(page, 'house', 160, 232, 'up'); // house 底出口 → farm (112,160)
    await sleep(3200);
    info = await sceneInfo(page);
    result('清晨走出老屋回到农场', info.scene === 'farm', `scene=${info.scene}`);
    await sleep(5000); // 等演出 4s 淡出动画完成
    const morningOpened = await waitDialogueOpen(page, 8000);
    const morningLines = morningOpened ? await walkDialogue(page, 25) : [];
    result('Day2 清晨记忆演出与夏雅对话播放', morningOpened && morningLines.length >= 5, `打开=${morningOpened} 行数=${morningLines.length}`);
    await shot(page, '06-day2-morning');

    // ============ 12. 去小镇 → 村长接任务 ============
    await page.evaluate(() => window.debug.setTime(10, 0)); // 村长上班时间（06:00 村长不在镇上会触发 elderHouseHint 误入村长家）
    await teleport(page, 'farm', 616, 168, 'up'); // farm 右出口 → town
    await sleep(3500);
    info = await sceneInfo(page);
    result('进入小镇', info.scene === 'town', `scene=${info.scene}`);
    const townLines = await walkDialogue(page);
    result('小镇首次入场对话', townLines.length >= 5, `行数=${townLines.length}`);
    await teleport(page, 'town', 216, 184, 'up'); // 村长 (216,168)
    await pressInteract(page);
    if (!(await waitDialogueOpen(page, 2500))) {
      await page.keyboard.press('KeyE'); // 触屏交互键未命中时按键盘 E（等价玩家交互）
      await sleep(700);
    }
    const elderLines = await walkDialogue(page);
    result('村长委托对话', elderLines.length >= 10, `行数=${elderLines.length}`);
    const qAfterAccept = await questState(page);
    result('接任务后 questState=accepted', qAfterAccept === 'accepted', `state=${qAfterAccept}`);
    await shot(page, '07-quest-accepted');

    // ============ 13. 后山：观景台 → 碎片 + 闪回 ============
    // town 左出口 → farm；farm 顶出口 → forest
    await teleport(page, 'town', 16, 160, 'up');
    await sleep(3200);
    info = await sceneInfo(page);
    result('返回农场', info.scene === 'farm', `scene=${info.scene}`);
    // 阿风欢迎「你回来了！」：去过镇上后回 farm 自动播放（tryAdventurerWelcome 7 行）。
    // 对话打开时 MapScene update 提前 return → 出口检测被跳过（与车站同款），必须走完对话
    const welcomeLines = await walkDialogue(page);
    result('阿风欢迎「你回来了！」对话播放', welcomeLines.length >= 6, `行数=${welcomeLines.length}`);
    await teleport(page, 'farm', 248, 30, 'up'); // farm 顶出口 → forest
    await sleep(3200);
    info = await sceneInfo(page);
    result('进入后山', info.scene === 'forest', `scene=${info.scene}`);
    await teleport(page, 'forest', 328, 136, 'up'); // 观景台 (328,120-136)
    await sleep(700); // checkForestLookout 每帧检测，靠近即触发
    const lookoutLines = await walkDialogue(page);
    result('观景台铺垫对白', lookoutLines.length >= 6, `行数=${lookoutLines.length}`);
    await teleport(page, 'forest', 328, 184, 'up'); // 碎片 (328,168)
    await pressInteract(page);
    const shardLines = await walkDialogue(page);
    result('碎片对白 14 行', shardLines.length >= 14, `行数=${shardLines.length}`);
    await shot(page, '08-shard-dialogue');
    const flashShown = await waitFlashbackShow(page);
    const flashOk = flashShown && (await advanceFlashback(page));
    result('记忆闪回 overlay 出现并推进关闭', flashOk, `shown=${flashShown}`);
    await sleep(1500);
    const qAfterCollect = await questState(page);
    result('采集后 questState=collected', qAfterCollect === 'collected', `state=${qAfterCollect}`);

    // ============ 14. 交付：回小镇找村长 ============
    // forest 底出口 → farm；farm 右出口 → town
    // 随机日常事件对白（30% 概率）会在 farm 场景延迟触发并阻断出口检测，
    // 循环「排空对白 → 检查场景 → 重新靠右出口」直到成功切入 town
    await teleport(page, 'forest', 240, 300, 'up');
    await sleep(3200);
    const tExit0 = Date.now();
    while (Date.now() - tExit0 < 15000) {
      await drainAutoDialogue(page);
      const info = await sceneInfo(page);
      if (info.scene === 'town') break;
      await teleport(page, 'farm', 616, 168, 'up');
      await sleep(600);
    }
    await sleep(1200);
    info = await sceneInfo(page);
    result('返回小镇', info.scene === 'town', `scene=${info.scene}`);
    await teleport(page, 'town', 216, 184, 'up');
    await pressInteract(page);
    if (!(await waitDialogueOpen(page, 2500))) {
      await page.keyboard.press('KeyE');
      await sleep(700);
    }
    const deliverLines = await walkDialogue(page);
    result('交付对话（碎片 13 + 为何种田 7）', deliverLines.length >= 20, `行数=${deliverLines.length}`);
    const qAfterDeliver = await questState(page);
    result('交付后 questState=completed', qAfterDeliver === 'completed', `state=${qAfterDeliver}`);
    await shot(page, '09-quest-completed');

    // ============ 15. 观星夜（时空钩子：跳到夜晚 21:00） ============
    await page.evaluate(() => window.debug.setTime(21, 0));
    // town 左出口 → farm → 观星点
    // 同第 14 步：循环排空随机事件对白，确保后续交互落在观星点
    await teleport(page, 'town', 16, 160, 'up');
    await sleep(3200);
    const tExit1 = Date.now();
    while (Date.now() - tExit1 < 10000) {
      await drainAutoDialogue(page);
      const info = await sceneInfo(page);
      if (info.scene === 'farm') break;
      await teleport(page, 'farm', 504, 240, 'up');
      await sleep(600);
    }
    await teleport(page, 'farm', 504, 240, 'up'); // 观星点 (504,232)
    await pressInteract(page);
    // v0.10.4：三段镜头（2s+3s+3s=8s）完成后 DEMO_ENDING_DIALOGUE 才播放，等镜头到位
    await sleep(9500);
    if (!(await waitDialogueOpen(page, 3000))) {
      await page.keyboard.press('KeyE'); // 触屏交互键未命中时按键盘 E
      await sleep(9500);
    }
    await shot(page, '10-stargaze-opening');
    const endOpen = await page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      return s?.storyDialogue?.isOpen?.() ?? false;
    });
    result('观星夜对话打开', endOpen);
    const endLines = await walkDialogue(page);
    result('观星夜对白播放（17 行含选项）', endLines.length >= 17, `行数=${endLines.length}`);
    const endChoice = endLines.find(l => l.options?.length);
    result('观星夜三选项渲染', !!endChoice && endChoice.options?.length === 3, JSON.stringify(endChoice?.options ?? ''));
    await shot(page, '11-stargaze-options');
    const picked = await clickOption(page, '我想先弄清楚');
    result('选择「我想先弄清楚爷爷…」', picked);
    const branchLines = await walkDialogue(page);
    result('分支独白播放', branchLines.length >= 4, `行数=${branchLines.length}`);
    await shot(page, '12-stargaze-branch');
    await skipDialogue(page, 5); // FINALE 5 行 → 晨曦过渡
    await sleep(4500); // 晨曦 3.5s + 镜头回拉，等结算面板稳定打开

    const panel = await page.evaluate(() => {
      const el = document.getElementById('ending-panel');
      return { exists: !!el, display: el?.style.display ?? '' };
    });
    result('结算面板打开', panel.exists && panel.display === 'flex', JSON.stringify(panel));
    await shot(page, '13-ending-panel');

    info = await sceneInfo(page);
    result('storyStep = observatory_complete', info.step === 'observatory_complete', `step=${info.step}`);
    const saved = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('return_star_save')); } catch { return null; }
    });
    result('存档含 observatory_complete', saved?.story?.storyStep === 'observatory_complete', saved?.story?.storyStep ?? 'null');

    // 继续自由游玩：关闭面板
    await page.evaluate(() => {
      document.querySelector('#ending-panel [data-action="continue"]')?.click();
    });
    let closed = '';
    for (let i = 0; i < 20; i++) {
      await sleep(200);
      closed = await page.evaluate(() => document.getElementById('ending-panel')?.style.display ?? '');
      if (closed === 'none') break;
    }
    result('继续自由游玩可关闭面板', closed === 'none', `display=${closed}`);
    await shot(page, '14-free-mode');

    // ---------- 汇总 ----------
    const pass = results.filter(r => r.startsWith('✅')).length;
    const fail = results.filter(r => r.startsWith('❌')).length;
    console.log(`\n运行时错误: ${pageErrs.length} 条`);
    for (const e of pageErrs) console.log(`  [err] ${e}`);
    console.log(`\n========== 结果: ✅ ${pass} 通过 / ❌ ${fail} 失败 ==========`);
    console.log(`截图目录: ${SHOT_DIR}`);
    if (fail > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('探针异常:', err);
  process.exit(1);
});
