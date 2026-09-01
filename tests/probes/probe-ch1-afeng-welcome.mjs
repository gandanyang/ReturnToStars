/**
 * #28 阿风首次欢迎剧情探针（任务卡：docs/tasks/任务-28阿风首次欢迎剧情实现-v1.0.md）
 *
 * 验证：
 *   1. 触发：tutorial done + ch1TownIntroDone=true + 未触发过 → 进 farm → 1.8s 后自动开对白
 *   2. 台词：ADVENTURER_WELCOME_BACK_DIALOGUE 7 行（1 系统描述 + 6 对白）
 *      顺序：adv_07 → adv_10 → adv_08 → adv_09（含林澈两句夹在中间）
 *   3. 配音：adv_07/08/09/10 全部发声 + 资源 200/206/304 + 来自 voice_normalized/
 *   4. 演出后阿风 sprite 移除
 *   5. 存档写入 gameState.triggeredEvents.adventurer_welcome_back=true
 *   6. 一次性：刷新重进不再触发
 *   7. 无运行时错误
 *
 * 前置：dev server (localhost:5173) + window.__game / window.debug
 * 运行：node tests/probes/probe-ch1-afeng-welcome.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 期望的 7 行对白（与 StorySystem.ADVENTURER_WELCOME_BACK_DIALOGUE 同步）
const EXPECT_LINES = [
  '（刚走进庄园，就看见阿风靠在木屋前的栅栏上，远远地朝你挥手。）',
  '嘿！你回来了！',
  '阿风？你怎么跑这里来了？',
  '没想到这么多年过去，你还是回来了。',
  '我这些年也一直在外面跑，有时候走着走着，会想起小时候我们在这里吹风的日子。',
  '（笑）看来这里变化挺大的。',
  '是啊，不过风还是那个风。慢慢来吧，我相信这里会重新热闹起来。',
];

// 阿风配音期望（按对白出现顺序，跳过林澈旁白）
const EXPECT_VOICE = [
  'adventurer/adv_07',  // 嘿！你回来了！
  'adventurer/adv_10',  // 没想到这么多年过去，你还是回来了。
  'adventurer/adv_08',  // 我这些年也一直在外面跑...
  'adventurer/adv_09',  // 是啊，不过风还是那个风...
];

// 跳过 first_morning_response（day2 清晨演出），避免与阿风欢迎竞争
const BASE_SAVE = {
  version: '0.5', savedAt: 'afeng-welcome-probe', timestamp: Date.now(),
  player: {
    x: 320, y: 460, scene: 'farm', facing: 'down',
    inventory: { wood: 0, stone: 0 },
  },
  world: {
    day: 2, hour: 10, minute: 0, coins: 100, level: 1, xp: 0,
    stamina: 100, minedOres: [], questState: 'not_started',
  },
  farm: { tiles: [], crops: [], trees: [], restore: {} },
  story: { storyStep: 'done', ch1TownIntroDone: true },
  chapter: 1,
  gameState: {
    triggeredEvents: {
      first_morning_response: true, // 跳过 day2 清晨演出
      world_hint_rain_mushroom: true, // 跳过 P0.5 雨蘑菇提示（day2 下雨，会抢先占用对白框）
      // 不含 adventurer_welcome_back → 让本探针触发
    },
  },
};

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

const voiceReqs = [];
page.on('response', (res) => {
  const url = res.url();
  const m = url.match(/\/audio\/(voice[_a-z]*)\/([^?]+)/);
  if (m) voiceReqs.push({ dir: m[1], file: decodeURIComponent(m[2]), status: res.status() });
});

const enterGame = async (scene, timeoutMs = 25000) => {
  const t0 = Date.now();
  let cur = '';
  while (Date.now() - t0 < timeoutMs) {
    try {
      cur = await page.evaluate(() => window.__game?.scene.getScenes(true)[0]?.scene?.key ?? 'none');
    } catch {
      // Execution context destroyed（reload 期间），等下一轮重试
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
  throw new Error(`未能进入场景 ${scene}（实际 ${cur}）错误=${errors.slice(0, 5).join(' | ')}`);
};

const dialogueOpen = () => page.evaluate(() => {
  const s = window.__game?.scene?.getScene('farm');
  return !!(s?.storyDialogue?.isOpen?.());
});

const currentLine = () => page.evaluate(() => {
  const s = window.__game?.scene?.getScene('farm');
  return s?.storyDialogue?.textEl?.textContent ?? '';
});

const advance = async () => {
  await page.evaluate(() => {
    const s = window.__game?.scene?.getScene('farm');
    if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.advance();
  });
  await sleep(120);
};

/**
 * 推进到下一行并等打字完成。
 * StoryDialogue.advance：typing=true→finishTyping（不推进）；typing=false→index++/showLine（开始打字）。
 * 短句 finishTyping 很快（28ms/字 × 字数），连续 2 次 advance 容易跳行。
 * 改为：advance 1 次推进 + 等待打字完成。
 */
const advanceLine = async () => {
  await advance();              // typing=false → 推进到下一行（开始打字 + 语音请求）
  await waitForStable();        // 等当前行打字完成
};

/** 等首行打字完成（文本长度稳定） */
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

const afengSpriteAlive = () => page.evaluate(() => {
  const s = window.__game?.scene?.getScene('farm');
  return !!s?.adventurerWelcomeSprite;
});

const saveTriggered = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('return_star_save') || 'null');
  return s?.gameState?.triggeredEvents?.adventurer_welcome_back ?? false;
});

try {
  console.log('=== #28 阿风首次欢迎剧情探针 ===\n');

  // ---------- 注入存档并进 farm ----------
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(800);
  await page.evaluate((save) => {
    localStorage.setItem('return_star_save', JSON.stringify(save));
  }, BASE_SAVE);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1000);
  await enterGame('farm');
  await sleep(800);

  // ---------- 1. 触发：等 1.8s 后对白自动打开 ----------
  // tryAdventurerWelcome 在 create 钩子调用 → 1.8s 后 play
  let opened = false;
  for (let i = 0; i < 30; i++) {
    opened = await dialogueOpen();
    if (opened) break;
    await sleep(300);
  }
  result('1. 阿风欢迎对白自动打开（1.8s 后）', opened, opened ? '' : '对白未打开');

  // ---------- 2. 阿风演出精灵存在 ----------
  const spriteThere = await afengSpriteAlive();
  result('2. 阿风演出精灵已生成', spriteThere, spriteThere ? '' : '精灵未生成');

  // ---------- 3. 逐行推进，验证台词文本 ----------
  // 等首行打字完成
  const firstLine = await waitForStable();
  const seenLines = [firstLine];
  for (let i = 1; i < EXPECT_LINES.length; i++) {
    await advanceLine();
    seenLines.push(await currentLine());
  }
  const linesMatch = seenLines.every((t, i) => t.includes(EXPECT_LINES[i].substring(0, 8)));
  result('3. 7 行台词顺序与文本正确', linesMatch,
    linesMatch ? '' : `期望首句=${EXPECT_LINES[0].substring(0, 12)} 实际首句=${(seenLines[0] || '').substring(0, 12)}`);
  if (!linesMatch) {
    console.log('   期望 vs 实际：');
    EXPECT_LINES.forEach((t, i) => console.log(`     [${i}] ${t.substring(0, 24)} | ${(seenLines[i] || '').substring(0, 24)}`));
  }

  // ---------- 4. 推进到对白关闭 ----------
  // 最后一次 advance：typing=false → index>=length → close + onComplete
  await advance();
  await sleep(600);
  // 兜底：若仍开，再 advance 几次
  for (let i = 0; i < 5 && (await dialogueOpen()); i++) {
    await advance();
    await sleep(200);
  }
  await sleep(400);

  // ---------- 5. 配音 4 条全部发起 + 来自 voice_normalized + 状态码正常 ----------
  const voiceFiles = [...new Set(voiceReqs.filter(r => r.dir === 'voice_normalized').map(r => r.file))];
  // 注意：startsWith('adventurer/adv_0') 会漏掉 adv_10（其前缀是 adv_1），
  // 改用 EXPECT_VOICE 中的前缀逐项匹配。
  const afengVoices = voiceFiles.filter(f =>
    EXPECT_VOICE.some(p => f.startsWith(p))
  );
  const missing = EXPECT_VOICE.filter(v => !afengVoices.some(f => f.startsWith(v)));
  result('4. adv_07/08/09/10 全部发起语音请求', missing.length === 0,
    missing.length ? `缺失: ${missing.join(', ')} | 实际: ${afengVoices.join(', ')}` : afengVoices.join(', '));

  const afengReqFilter = (r) => r.dir === 'voice_normalized' && EXPECT_VOICE.some(p => r.file.startsWith(p));
  const badStatus = voiceReqs.filter(r => afengReqFilter(r) && ![200, 206, 304].includes(r.status));
  result('5. 阿风语音资源请求均 200/206/304', badStatus.length === 0,
    badStatus.length ? JSON.stringify(badStatus) : `${voiceReqs.filter(afengReqFilter).length} 个请求`);

  const rawCount = voiceReqs.filter(r => r.dir === 'voice' && EXPECT_VOICE.some(p => r.file.startsWith(p))).length;
  result('6. 语音来自 voice_normalized/（无 raw voice/）', rawCount === 0, `raw=${rawCount}`);

  // ---------- 7. 演出后阿风精灵已移除 ----------
  const spriteGone = !(await afengSpriteAlive());
  result('7. 对白结束后阿风精灵已移除', spriteGone, spriteGone ? '' : '精灵仍存在');

  // ---------- 8. 存档写入 adventurer_welcome_back=true ----------
  const triggered = await saveTriggered();
  result('8. 存档写入 adventurer_welcome_back=true', triggered, triggered ? '' : '存档未标记');

  // ---------- 9. 一次性：刷新重进不再触发 ----------
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1000);
  await enterGame('farm');
  await sleep(2500); // 等 1.8s + 余量
  const reopened = await dialogueOpen();
  result('9. 重进不再触发欢迎对白（一次性）', !reopened, reopened ? '对白又开了' : '');

  const spriteNotThere = !(await afengSpriteAlive());
  result('10. 重进无阿风演出精灵', spriteNotThere, spriteNotThere ? '' : '精灵又生成了');

  // ---------- 11. 无运行时错误 ----------
  result('11. 全程无运行时错误', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : '');
  result('12. 无 404 资源', notFound.length === 0, notFound.length ? notFound.slice(0, 3).join(' | ') : '');

} catch (e) {
  console.log(`\n💥 探针异常：${e.message}`);
  console.log(e.stack);
  fail++;
} finally {
  console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}
