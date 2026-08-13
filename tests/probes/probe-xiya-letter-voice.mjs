/**
 * 探针 — 春深有信（xiya_letter）语音播放链路
 *
 * 背景：任务卡 08-08 实现时 letter 语音产物缺失（voicebank 引用但无 ogg），
 * 2026-08-13 补齐 xiya 26 + linche 18 条 letter 配音后，验证游戏内对白自动匹配播放。
 *
 * 验证目标（Level 2）：
 *  1. 游戏启动 → farm 场景持有 storyDialogue
 *  2. 播放 OPEN 开场：命中 letter_open_*（夏雅 + 林澈）
 *  3. 播放 FLOWER 花苗：命中 letter_flower_*
 *  4. 播放 RECORD 记录：命中 letter_record_*
 *  5. 播放 FINAL 收尾：命中 letter_final_*
 *  6. 系统演出行（（夕阳落在田埂上。））不请求语音
 *
 * 前置：Vite dev server；public/audio/voice_normalized/ 已含 letter ogg
 * 运行：GAME_URL=http://localhost:5199/ node tests/probes/probe-xiya-letter-voice.mjs
 */

import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5199/';

let pass = 0;
let fail = 0;
function ok(step, passed, detail = '') {
  if (passed) { pass++; console.log(`  ✅ ${step}${detail ? ' - ' + detail : ''}`); }
  else { fail++; console.log(`  ❌ ${step}${detail ? ' - ' + detail : ''}`); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('=== 探针：春深有信 letter 语音播放链路 ===\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  // 收集 voice_normalized 响应（含 letter 与非 letter）
  const voiceReqs = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/audio/voice_normalized/')) {
      const pathPart = url.split('/audio/voice_normalized/')[1].split('?')[0];
      voiceReqs.push({ file: decodeURIComponent(pathPart), status: res.status() });
    }
  });

  await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.keyboard.press('Enter');
  await sleep(2500);

  // 切到 farm
  await page.evaluate(() => {
    const g = window.__game;
    const active = g.scene.getScenes(true)[0];
    if (active) g.scene.stop(active.scene.key);
  });
  await sleep(600);
  await page.evaluate(() => { window.__game.scene.start('farm'); });
  await sleep(2000);

  const hasDialogue = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    return !!(s?.storyDialogue?.play);
  });
  ok('1. farm 场景持有 storyDialogue 实例', hasDialogue);
  if (!hasDialogue) {
    console.log('  进入 farm 失败，终止');
    await browser.close();
    return;
  }

  // 播放 4 组对白（真实对白行，逐行推进）
  const playResult = await page.evaluate(async () => {
    const mod = await import('/src/systems/StorySystem.ts');
    const groups = [
      ['open', mod.XIYA_LETTER_OPEN_DIALOGUE],
      ['flower', mod.XIYA_LETTER_FLOWER_DIALOGUE],
      ['record', mod.XIYA_LETTER_RECORD_DIALOGUE],
      ['final', mod.XIYA_LETTER_FINAL_DIALOGUE],
    ];
    const s = window.__game.scene.getScene('farm');
    const out = {};
    // 解锁音频（用户手势模拟）
    try {
      if (window.__game?.sound?.unlock) window.__game.sound.unlock();
    } catch (e) {}
    for (const [name, lines] of groups) {
      const before = performance.now();
      s.storyDialogue.play(lines);
      for (let i = 1; i < lines.length; i++) {
        await new Promise(r => setTimeout(r, 350));
        if (s.storyDialogue?.isOpen?.()) s.storyDialogue.advance();
      }
      await new Promise(r => setTimeout(r, 350));
      if (s.storyDialogue?.isOpen?.()) s.storyDialogue.skip?.() || s.storyDialogue.advance();
      out[name] = Math.round(performance.now() - before);
    }
    return out;
  });
  console.log(`  4 组播放完成: ${JSON.stringify(playResult)}`);
  await sleep(1500);

  const files = voiceReqs.map(r => r.file);
  const urls = [...new Set(files)];
  const letter = urls.filter(f => f.includes('letter'));
  const nonLetter = urls.filter(f => !f.includes('letter'));
  console.log(`  语音请求 ${urls.length} 个（letter ${letter.length}）: ${letter.join(', ') || '<无>'}`);

  ok('2. 开场 OPEN → letter_open_* 命中', letter.some(f => f.includes('letter_open')),
    letter.filter(f => f.includes('letter_open')).join(','));
  ok('3. 花苗 FLOWER → letter_flower_* 命中', letter.some(f => f.includes('letter_flower')),
    letter.filter(f => f.includes('letter_flower')).join(','));
  ok('4. 记录 RECORD → letter_record_* 命中', letter.some(f => f.includes('letter_record')),
    letter.filter(f => f.includes('letter_record')).join(','));
  ok('5. 收尾 FINAL → letter_final_* 命中', letter.some(f => f.includes('letter_final')),
    letter.filter(f => f.includes('letter_final')).join(','));
  ok('6. 夏雅与林澈 letter 均有命中', letter.some(f => f.startsWith('xiya/letter')) && letter.some(f => f.startsWith('linche/letter')),
    `xiya=${letter.filter(f => f.startsWith('xiya/letter')).length} linche=${letter.filter(f => f.startsWith('linche/letter')).length}`);
  ok('7. 系统演出行不触发语音（无旁白 ogg）', !urls.some(f => f.includes('system/')), nonLetter.join(',') || '无');
  // 断言时检查有没有非 200
  const bad = voiceReqs.filter(r => r.status !== 200 && r.status !== 206);
  ok('8. 所有语音请求 200/206', bad.length === 0, bad.length ? `${bad.length} 个异常: ${bad.map(b => b.file + '=' + b.status).join(',')}` : '');

  console.log(`\n========== 结果: ${pass} 通过 / ${fail} 失败 ==========`);
  await browser.close();
  if (fail > 0) process.exit(1);
}

run();
