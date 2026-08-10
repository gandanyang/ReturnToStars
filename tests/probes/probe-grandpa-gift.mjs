/**
 * probe-grandpa-gift.mjs — P0 爷爷的归星包裹（老屋旧木箱）验证探针
 *
 * 验证：
 * T1 第一次进 house 场景 → 出现「爷爷的包裹」交互物（grandpaGiftMark）
 * T2 靠近木箱按 E → 打开 #gift-panel 面板（visible + isOpen）
 * T3 面板信内容 = 制作人定稿（含「慢慢来」「有人愿意留下」），包裹清单渲染（信/小鱼干/旧花苗/木材/石头/金币200）
 * T4 点「收下」→ 面板关闭 + grandpaGiftMark 移除
 * T5 发放入档：triggerOnce('grandpa_gift_opened') 已标记 + 存档 inventory 五项 + coins 增加 200
 * T6 重进 house → 不再出现包裹交互物（一次性判重）
 * 附加 无页面错误
 *
 * 依赖：dev server (localhost:5173) + window.debug / window.__game
 * 视口：横屏 1024x768（项目红线：禁止竖屏视口）
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

async function waitPanel(expectOpen, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const vis = await page.evaluate(() => {
      const el = document.getElementById('gift-panel');
      return !!el && el.style.display !== 'none';
    });
    if (vis === expectOpen) return vis;
    await sleep(200);
  }
  return await page.evaluate(() => {
    const el = document.getElementById('gift-panel');
    return !!el && el.style.display !== 'none';
  });
}

async function waitNoMark(timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const has = await page.evaluate(() => !!window.__game?.scene?.getScene?.('house')?.grandpaGiftMark);
    if (!has) return true;
    await sleep(200);
  }
  return false;
}

try {
  // 前置：清存档 + 重载，保证未领取状态
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

  // 直接切到 house（第一次进入，未领取）
  await page.evaluate(() => {
    window.debug.setStoryStep('done');
    window.debug.setTime(10, 0);
    window.__game.scene.start('house', { spawn: { x: 160, y: 192 } });
  });
  const hok = await waitScene('house');
  result('T1a 老屋场景就绪', hok, 'scene=house');

  const markOk = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('house');
    return !!s?.grandpaGiftMark && !!s?.grandpaGiftMark.visible;
  });
  result('T1b 第一次进老屋出现「爷爷的包裹」交互物', markOk, 'grandpaGiftMark');

  // T2 靠近木箱 → 打开面板
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('house');
    if (s.grandpaGiftMark) {
      s.player.x = s.grandpaGiftPos.x + 4;
      s.player.y = s.grandpaGiftPos.y + 16;
    }
    s.player.facing = 'up';
  });
  await sleep(400);
  const r2 = await page.evaluate(() => window.__game.scene.getScene('house').tryGrandpaGiftInteract());
  const vis2 = await waitPanel(true);
  result('T2 靠近木箱打开包裹面板', r2 === true && vis2, `ret=${r2} visible=${vis2}`);

  // T3 面板内容：信（制作人定稿）+ 物品清单
  const content = await page.evaluate(() => {
    const el = document.getElementById('gift-panel');
    if (!el) return null;
    const letter = document.getElementById('gift-letter')?.textContent ?? '';
    const items = document.getElementById('gift-items')?.textContent ?? '';
    return { letter, items, title: el.textContent };
  });
  result('T3a 信含「林澈：」开头', !!content && content.letter.includes('林澈：'), content ? content.letter.slice(0, 40) : 'null');
  result('T3b 信含「慢慢来」「有人愿意留下」', !!content && content.letter.includes('慢慢来') && content.letter.includes('有人愿意留下'), '');
  result('T3c 包裹清单渲染（信/小鱼干/旧花苗/木材/石头/金币200）',
    !!content && content.items.includes('爷爷的信') && content.items.includes('小鱼干') &&
    content.items.includes('旧花苗') && content.items.includes('木材') && content.items.includes('石头') &&
    content.items.includes('金币 200'),
    content ? content.items.slice(0, 120) : 'null');

  // T4 点「收下」→ 面板关闭 + 标记移除
  await page.evaluate(() => {
    document.querySelector('#gift-panel [data-action="gift"]')?.click();
  });
  const vis4 = await waitPanel(false);
  const markGone = await waitNoMark();
  result('T4 收下后面板关闭 + 木箱提示移除', vis4 === false && markGone, `visible=${vis4} markGone=${markGone}`);

  // T5 发放入档：triggerOnce 标记 + 存档物品/金币
  const state = await page.evaluate(() => {
    const s = window.__game.scene.getScene('house');
    const raw = localStorage.getItem('return_star_save');
    const d = raw ? JSON.parse(raw) : null;
    return {
      triggered: window.debug.events.hasTriggered('grandpa_gift_opened'),
      inv: d?.player?.inventory ?? null,
      coins: d?.world?.coins ?? null,
      mark: !!s?.grandpaGiftMark,
    };
  });
  result('T5a triggerOnce 已标记（防重复领取）', state.triggered === true, `triggered=${state.triggered}`);
  result('T5b 存档物品五项（信/小鱼干/旧花苗/木材/石头）',
    !!state.inv && state.inv.grandpa_letter === 1 && state.inv.dried_fish === 1 &&
    state.inv.flower_seedling === 1 && state.inv.wood === 5 && state.inv.stone === 5,
    JSON.stringify(state.inv));
  result('T5c 金币 +200（新档基线 100 → 300）', state.coins === 300, `coins=${state.coins}`);

  // T6 重进 house → 不再出现包裹
  await page.evaluate(() => {
    window.__game.scene.start('house', { spawn: { x: 160, y: 192 } });
  });
  await waitScene('house');
  await sleep(500);
  const markAgain = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('house');
    return !!s?.grandpaGiftMark;
  });
  result('T6 重进老屋不再出现包裹（一次性判重）', markAgain === false, `mark=${markAgain}`);

  result('附加 无页面错误', warns.length === 0, warns.join('; ').slice(0, 160));
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-grandpa-gift 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
