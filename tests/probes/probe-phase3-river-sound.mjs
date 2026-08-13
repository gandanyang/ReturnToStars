/**
 * probe-phase3-river-sound.mjs — Phase 3 §四 S6 老河堤水声增强验证
 *
 * 拍板基线 v1.0 §四 S6：位置触发水声（不能全局播）——
 * 玩家靠近西侧老河堤时 AmbienceSystem 叠加"河水流动"层，远离时移除。
 *
 * 段A（模块级逻辑，动态 import 独立实例）：
 *   - town 白天基础 3 层（voices+wind+birds）
 *   - setRiverProximity(true) → +1 层；false → 回落；幂等不重复叠加
 *   - stop() 清空含 riverNode；意图保持：stop 后重进 town 由 start 恢复
 *   - 非 town 地图靠近只记录意图不叠加
 *
 * 段B（游戏集成，AudioSpy 节点计数 + MapScene.riverSoundNear 状态）：
 *   - 进 town 玩家在中央广场 → riverSoundNear === false
 *   - 瞬移河边 (5,15)（西岸第一列可站立地，x=88 < 96 阈值）→ riverSoundNear === true
 *     且音频节点增量 ≥（bufferSource +1, biquadFilter +1, oscillator +1）= 河声层已创建
 *   - 瞬移回中央广场 → riverSoundNear === false（位置离开移除）
 *
 * 前置：dev server 运行（建议独立端口 5199 防 HMR 抖动）
 * 运行：GAME_URL=http://localhost:5199/ node tests/probes/probe-phase3-river-sound.mjs
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, 'test-screenshots');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}
const waitFor = async (page, fn, timeout = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await fn();
    if (v) return v;
    await sleep(250);
  }
  return null;
};

/** 进入 town 场景（写档 → reload）。先卸净旧实例再写新档（防卸载自动保存覆盖）。 */
async function enterTown(page, save) {
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1600);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(() => {
    if ('caches' in window) caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
  });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(600);
  for (let i = 0; i < 25; i++) {
    await sleep(300);
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === 'town') break;
  }
  await sleep(1500);
}

const baseSave = (patch = {}) => ({
  version: '0.5', savedAt: 'phase3-river', timestamp: Date.now(),
  player: { x: 360, y: 440, scene: 'town', facing: 'up', inventory: {} },
  world: { day: 1, hour: patch.hour ?? 12, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'done' }, chapter: patch.chapter ?? 0,
  worldRestore: patch.worldRestore ?? {},
  gameState: { triggeredEvents: patch.triggeredEvents ?? {} },
});

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
const pageErrs = [];
page.on('pageerror', e => pageErrs.push(e.message));

try {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(800);

  // ========== 段A：模块级逻辑（独立实例） ==========
  // 全局声音总开关默认静音（2026-08-13），start() 首行检查 isSoundEnabled() → 先打开
  const soundOn = await page.evaluate(async () => {
    const audio = await import('/src/systems/AudioSystem.ts');
    audio.setSoundEnabled(true);
    return audio.isSoundEnabled();
  });
  check('A: 全局声音已打开（前置）', soundOn === true);
  const injected = await page.evaluate(async () => {
    try {
      const mod = await import('/src/systems/AmbienceSystem.ts');
      window.__ambience = mod;
      return true;
    } catch (e) { console.error('import fail', e); return false; }
  });
  check('A: AmbienceSystem 可动态导入', injected);

  if (injected) {
    const a1 = await page.evaluate(() => {
      const A = window.__ambience;
      A.stop();
      A.start('town', 10); // 白天：voices+wind（birds 为事件音不进循环层）
      return A.getSourceCount();
    });
    check(`A: town 白天基础 2 层（实际 ${a1}）`, a1 === 2, `count=${a1}`);

    const a2 = await page.evaluate(() => {
      const A = window.__ambience;
      A.setRiverProximity(true); // 靠近河边 → 叠加水声
      return A.getSourceCount();
    });
    check(`A: 靠近河边水声叠加 +1（实际 ${a2}）`, a2 === 3, `count=${a2}`);

    const a3 = await page.evaluate(() => {
      const A = window.__ambience;
      A.setRiverProximity(false); // 远离 → 移除
      return A.getSourceCount();
    });
    check(`A: 远离河边水声移除回落 2（实际 ${a3}）`, a3 === 2, `count=${a3}`);

    const a4 = await page.evaluate(() => {
      const A = window.__ambience;
      A.setRiverProximity(true);
      A.setRiverProximity(true); // 幂等：重复 true 不重复叠加
      const c = A.getSourceCount();
      A.setRiverProximity(false);
      return c;
    });
    check(`A: setRiverProximity 幂等（重复 true 仍 3，实际 ${a4}）`, a4 === 3, `count=${a4}`);

    const a5 = await page.evaluate(() => {
      const A = window.__ambience;
      A.stop();
      return A.getSourceCount();
    });
    check('A: stop() 清空含 riverNode（0）', a5 === 0, `count=${a5}`);

    // 意图保持：靠近意图（stopped 只记录）→ stop → 重进 town → start 恢复河声
    const a6 = await page.evaluate(() => {
      const A = window.__ambience;
      A.setRiverProximity(true); // stopped：只记录意图 riverNear=true
      A.stop();
      A.start('town', 10); // start 检测 riverNear && town → 恢复水声
      const c = A.getSourceCount(); // voices+wind+water = 3
      A.stop();
      return c;
    });
    check(`A: 意图保持——stop 后重进 town 恢复河声 3 层（实际 ${a6}）`, a6 === 3, `count=${a6}`);

    // 非 town 地图：靠近只记录意图不叠加
    const a7 = await page.evaluate(() => {
      const A = window.__ambience;
      A.start('farm', 10); // farm 白天：wind+waves = 2（birds 为事件音不进循环层）
      A.setRiverProximity(true); // activeMap=farm → 不创建
      const c = A.getSourceCount();
      A.stop();
      return c;
    });
    check(`A: 非 town 地图靠近不叠加（仍 2，实际 ${a7}）`, a7 === 2, `count=${a7}`);
  } else {
    check('A: 模块导入失败', false);
  }

  // ========== 段B：游戏集成（AudioSpy + riverSoundNear） ==========
  // 注意：enterTown 内含 page.reload() 会清掉 window 状态，AudioSpy 必须先进 town 再装
  await enterTown(page, baseSave());

  // 进 town 可能带开场对话（storyDialogue 打开时 update 提前 return，位置检测暂停）。
  // 对话打开时玩家本就不可移动，属正常行为；探针先关闭对话恢复检测。
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.reset();
  });
  await sleep(400);

  await page.evaluate(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    window.__spy = { osc: 0, buf: 0, flt: 0 };
    const op = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function () { window.__spy.osc++; return op.call(this); };
    const bs = AC.prototype.createBufferSource;
    AC.prototype.createBufferSource = function () { window.__spy.buf++; return bs.call(this); };
    const bf = AC.prototype.createBiquadFilter;
    AC.prototype.createBiquadFilter = function () { window.__spy.flt++; return bf.call(this); };
  });
  const spy0 = await page.evaluate(() => ({ ...window.__spy }));
  const s0 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    return {
      riverNear: s?.riverSoundNear ?? null,
      pos: s?.player ? { x: Math.round(s.player.x), y: Math.round(s.player.y) } : null,
    };
  });
  console.log(`B: 初始 中央广场 pos=${JSON.stringify(s0.pos)} riverSoundNear=${s0.riverNear} spy 基线 buf=${spy0.buf} flt=${spy0.flt} osc=${spy0.osc}`);
  check('B: AudioSpy 已就位（计数器可用）', Number.isFinite(spy0.buf) && Number.isFinite(spy0.flt) && Number.isFinite(spy0.osc), JSON.stringify(spy0));
  check('B: 远离河边 → riverSoundNear === false', s0.riverNear === false, `riverNear=${s0.riverNear}`);

  // 瞬移到河边长椅 (5,15)：px = (88, 248)，x=88 < 6*16=96 触发。
  // 瞬移 + 等帧 + 读取合并为一个 async evaluate（消除页面状态中间重置的不确定性）
  const s1 = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('town');
    s.player.setPosition(88, 248);
    await new Promise(r => setTimeout(r, 800));
    return { riverNear: s?.riverSoundNear ?? null, spy: window.__spy ? { ...window.__spy } : null };
  });
  const dNear = { buf: (s1.spy?.buf ?? 0) - spy0.buf, flt: (s1.spy?.flt ?? 0) - spy0.flt, osc: (s1.spy?.osc ?? 0) - spy0.osc };
  console.log(`B: 河边 pos=(88,248) riverSoundNear=${s1.riverNear} 节点增量 buf+${dNear.buf} flt+${dNear.flt} osc+${dNear.osc}`);
  check('B: 靠近河边 → riverSoundNear === true', s1.riverNear === true, `riverNear=${s1.riverNear}`);
  check('B: 河声层已创建（buf/flt/osc 各 +1 及以上）', dNear.buf >= 1 && dNear.flt >= 1 && dNear.osc >= 1, JSON.stringify(dNear));

  // 瞬移回中央广场（远离河）
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    s.player.setPosition(400, 288);
  });
  await sleep(800);
  const s2 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    return { riverNear: s?.riverSoundNear ?? null };
  });
  check('B: 远离河边 → riverSoundNear 回落 false', s2.riverNear === false, `riverNear=${s2.riverNear}`);

  // 截一张河边照（制作人目测：长椅 + 河 + 可感知氛围）
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    s.player.setPosition(88, 248);
  });
  await sleep(600);
  await page.screenshot({ path: join(SHOT_DIR, 'phase3-river-bench.png') });
  console.log('📸 phase3-river-bench.png');

  if (pageErrs.length) console.log(`页面错误（${pageErrs.length}）:`, pageErrs.slice(0, 5));
  check('无页面运行时错误', pageErrs.length === 0, pageErrs.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

console.log(`\n===== probe-phase3-river-sound 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
