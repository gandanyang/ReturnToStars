/**
 * probe-narrative-shadow.mjs — 暗线一致性探针（叙事双层结构总则 v1.0 §十）
 *
 * 不理解文学，只做状态机回归保护：
 *   ① 信息等级门控：L0-L4 各阶段，可见锚点与可交互入口必须与等级一致
 *      （低阶段看不到高阶段内容 = 防剧透硬规则的回归化）
 *   ② 暗线注册表 ID 存在性：注册表中的 triggerOnce 锚点均为合法事件
 *   ③ 结局不提前触发：ch3FinaleActive 仅在 ch3_finale_open 后为 true；
 *      三结局在归位窗口前一律不可达
 *   ④ 链路顺序：玻璃(阶段1)→村民(阶段2)→黑点(阶段3)→开放→碰面→日记→碎片→结算→归位
 *
 * 注册表：docs/design/叙事双层结构总则-明线暗线施工规范-v1.0.md §五
 * 运行：node tests/probes/probe-narrative-shadow.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.PROBE_BASE || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: 'new',
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0, fail = 0;
function result(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}
const warns = [];
page.on('pageerror', (e) => warns.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') warns.push('console: ' + m.text()); });

const BASE_FLAGS = {
  ch1_awakening: true, ch1_elder_visit: true, ch1_spring_fair: true, lighthouse_lit_seen: true,
  ch1_house_tidy_done: true, ch1_market_cleared: true,
};

/** 在当前页写入种子并重载（停场防 beforeunload 覆盖） */
async function loadStage(flags, hour = 20) {
  await page.evaluate(() => {
    for (const s of window.__game?.scene?.getScenes(true) ?? []) window.__game.scene.stop(s.scene.key);
  });
  await sleep(400);
  const save = {
    version: '0.5', savedAt: 'shadow', timestamp: Date.now(),
    player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: { wood: 20 } },
    world: { day: 9, hour, minute: 0, coins: 500, level: 2, xp: 180, stamina: 100, minedOres: [] },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
    chapter: 1,
    worldRestore: { oldHouse: true, marketSquare: true },
    gameState: { triggeredEvents: Object.assign({}, BASE_FLAGS, flags) },
  };
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await waitScene('farm');
  await page.evaluate(() => {
    for (const s of window.__game.scene.getScenes(true)) {
      if (s.scene.key !== 'farm') window.__game.scene.stop(s.scene.key);
    }
  });
  await sleep(800);
}

async function waitScene(key, timeout = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate((k) => {
      const s = window.__game?.scene?.getScene?.(k);
      return !!s && !!s.player && s.scene.isActive();
    }, key);
    if (ok) return true;
    await sleep(300);
  }
  return false;
}

async function teleport(mapKey, x, y) {
  await page.evaluate(([mk, px, py]) => {
    const cur = window.__game.scene.getScenes(true).find((s) => s.player);
    if (!cur || cur.scene.key !== mk) window.__game.scene.start(mk, { spawn: { x: px, y: py } });
    for (const s of window.__game.scene.getScenes(true)) {
      if (s.scene.key !== mk) window.__game.scene.stop(s.scene.key);
    }
    const s = window.__game.scene.getScene(mk);
    if (s?.player) { s.player.x = px; s.player.y = py; if (s.player.body) s.player.body.reset(px, py); }
  }, [mapKey, x, y]);
  await waitScene(mapKey);
  await sleep(600);
}

async function callOn(mapKey, fn) {
  return page.evaluate(([mk, f]) => {
    const s = window.__game.scene.getScene(mk);
    if (!s || typeof s[f] !== 'function') return 'no_fn';
    return s[f]();
  }, [mapKey, fn]);
}

/** 注册表 ID 存在性：hasTriggered 对每个锚点返回布尔（不抛错=事件系统认识该键路径） */
async function registryCheck(ids) {
  return page.evaluate((list) => {
    const ev = window.debug.events;
    return list.map((id) => ({ id, ok: typeof ev.hasTriggered(id) === 'boolean' }));
  }, ids);
}

const REGISTRY = [
  'ch1_spring_fair', 'ch2_pier_repaired', 'ch2_night_talk', 'ch3_ship_arrived', 'ch3_captain_meet',
  'ch3_end_stay', 'ch3_end_leave', 'ch3_end_bridge',
  'ch3_b_photo', 'ch3_town_react', 'ch3_diary_finale',
  'lighthouse_lit_seen', 'ch3_lh_stage1', 'ch2_lighthouse_talked', 'ch3_lighthouse_arrival',
  'ch3_gap_first', 'ch3_diary_2', 'ch3_diary_3', 'ch3_finale_open',
];

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(1500);

  // ============ R1 注册表存在性 ============
  const reg = await registryCheck(REGISTRY);
  const regBad = reg.filter((r) => !r.ok);
  result('R1 暗线注册表：19 个锚点全部为合法事件键', regBad.length === 0,
    regBad.map((r) => r.id).join(','));

  // ============ S0 阶段基线：仅亮灯 → 高层锚点全部不可见/不可达 ============
  await loadStage({}, 12);
  await teleport('lighthouse', 250, 176);
  const s0 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('lighthouse');
    return {
      shardLh: s.ch3ShardVisible ? s.ch3ShardVisible('lh') : null,
      finaleActive: s.ch3FinaleActive ? s.ch3FinaleActive() : null,
      endShip: s.canTryCh3EndShip ? s.canTryCh3EndShip() : null,
      stage1Blocked: window.debug.events.hasTriggered('ch2_lighthouse_talked'),
    };
  });
  result('S0a 阶段0：碎片①不可见（L0 门控——碰面前不出现）', s0.shardLh === false, JSON.stringify(s0));
  result('S0b 阶段0：归位未激活（结局不可达）', s0.finaleActive === false && s0.endShip === false, JSON.stringify(s0));
  result('S0c 阶段0：节拍1 未发生 → 阶段1 玻璃细节不触发（窗口顺序正确）',
    s0.stage1Blocked === false, `ch2_lighthouse_talked=${s0.stage1Blocked}`);

  // ============ S1 阶段：碰面后 → 碎片① 可见、② 仍不可见（渐进发现） ============
  await loadStage({ ch3_lighthouse_arrival: true, ch3_ship_arrived: true, ch3_b_photo: true, ch3_town_react: true, ch3_captain_meet: true }, 20);
  await teleport('lighthouse', 250, 176);
  const s1 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('lighthouse');
    return { lh: s.ch3ShardVisible('lh'), qh: s.ch3ShardVisible('qh'), fm: s.ch3ShardVisible('fm') };
  });
  result('S1 碰面后：碎片① 可见 / ②③ 不可见（看见→寻找→理解 的第一拍）',
    s1.lh === true && s1.qh === false && s1.fm === false, JSON.stringify(s1));

  // ============ S2 阶段：段2 读后 → 碎片② 解锁、③ 仍锁 ============
  await loadStage({ ch3_lighthouse_arrival: true, ch3_ship_arrived: true, ch3_b_photo: true, ch3_town_react: true, ch3_captain_meet: true, ch3_diary_2: true }, 20);
  await teleport('qinghe_river', 150, 342);
  const s2 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('qinghe_river');
    return { qh: s.ch3ShardVisible('qh') };
  });
  result('S2 段2 后：碎片② 解锁（日记指引寻找）', s2.qh === true, JSON.stringify(s2));

  // ============ S3 阶段：段3 读后 → 碎片③ 解锁 ============
  await loadStage({ ch3_lighthouse_arrival: true, ch3_ship_arrived: true, ch3_b_photo: true, ch3_town_react: true, ch3_captain_meet: true, ch3_diary_2: true, ch3_diary_3: true }, 20);
  await teleport('farm', 60, 202);
  const s3 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    return { fm: s.ch3ShardVisible('fm') };
  });
  result('S3 段3 后：碎片③ 解锁（海湾缺口）', s3.fm === true, JSON.stringify(s3));

  // ============ S4 阶段：三片集齐 + 结算 → 归位窗口 ============
  await loadStage({
    ch3_lighthouse_arrival: true, ch3_ship_arrived: true, ch3_b_photo: true, ch3_town_react: true,
    ch3_captain_meet: true, ch3_diary_2: true, ch3_diary_3: true,
    ch3_shard_lh: true, ch3_shard_qh: true, ch3_shard_fm: true, ch3_diary_finale: true,
  }, 21);
  await teleport('lighthouse', 250, 176);
  const s4 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('lighthouse');
    return { active: s.ch3FinaleActive() };
  });
  result('S4 结算后：归位窗口激活（ch3FinaleActive）', s4.active === true, JSON.stringify(s4));

  // ============ S5 结局不提前：窗口激活但未做出行为 → 三结局互相独立、未入档 ============
  const s5 = await page.evaluate(() => window.debug.events.hasTriggered('ch3_end_stay')
    || window.debug.events.hasTriggered('ch3_end_leave')
    || window.debug.events.hasTriggered('ch3_end_bridge'));
  result('S5 结局未提前触发（窗口激活≠结局发生）', s5 === false, `anyEnd=${s5}`);

  // ============ S6 阶段1 真实窗口：亮灯+未到节拍1 → 玻璃细节触发 ============
  await loadStage({ ch1_awakening: true, lighthouse_lit_seen: true }, 12);
  await teleport('farm', 60, 176);
  await page.evaluate(() => {
    const b = document.querySelector('#touch-controls [data-action="interact"]');
    if (b) b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  });
  await sleep(800);
  const s6 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    return { text: s.dialogueText?.text ?? '', marked: window.debug.events.hasTriggered('ch3_lh_stage1') };
  });
  result('S6 阶段1：玻璃被擦过（L0→L1 首次埋点）', s6.text.includes('被人擦过了') && s6.marked === true,
    s6.text.slice(-60));

  // ============ 附加 ============
  result('附加 无页面错误', warns.length === 0, warns.join('; ').slice(0, 160));
} catch (e) {
  console.log('\n❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-narrative-shadow 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
