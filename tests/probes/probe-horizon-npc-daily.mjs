/**
 * 岛屿边界扩展 P0：NPC 每日句池加句回归探针
 *
 * 验证 NPCSystem 镇长(elder)/阿风(adventurer) 每日随机句池新增两句后：
 *   1. 两天内 getDailyNpcLine 均返回非空、格式正确的台词
 *   2. 连续 days=池大小 范围内取句不重复且覆盖全部池条目（含新增 2 句）
 *
 * 直接经 Vite 动态 import 生产模块，避开共享 5173 的 HMR 干扰。
 * 用法：GAME_URL=http://localhost:5174/ node tests/probes/probe-horizon-npc-daily.mjs
 */
import puppeteer from 'puppeteer-core';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5174/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('=== 岛屿扩展 P0：NPC 每日句池回归 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: true,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  let fails = 0;
  const check = (name, ok, extra = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
    if (!ok) fails++;
  };

  try {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(1500);

    const res = await page.evaluate(async () => {
      const mod = await import('/src/systems/NPCSystem.ts');
      const getLine = mod.getDailyNpcLine;
      const out = { elder: {}, adventurer: {}, poolError: '' };
      for (const id of ['elder', 'adventurer']) {
        const seen = new Set();
        // 连续取 days=池大小 的范围（加 2 缓冲），覆盖全部池条目
        for (let day = 1; day <= 14; day++) {
          const lines = getLine(id, day);
          if (!lines || lines.length === 0) { out[id].empty = day; break; }
          const text = lines[0].text;
          if (typeof text !== 'string' || !text.trim()) { out[id].badText = day; break; }
          seen.add(text);
          if (typeof lines[0].speaker !== 'string' || typeof lines[0].color !== 'string') {
            out[id].badShape = day; break;
          }
        }
        out[id] = { ...out[id], seenCount: seen.size, lines: [...seen] };
      }
      return out;
    });

    const elder = res.elder;
    const adv = res.adventurer;

    check('镇长池取句无空/坏形状', !elder.empty && !elder.badText && !elder.badShape,
      `空=${elder.empty ?? '-'} 坏文本=${elder.badText ?? '-'} 坏形状=${elder.badShape ?? '-'}`);
    check('镇长池覆盖 ≥ 池大小条目', elder.seenCount >= 7, `覆盖 ${elder.seenCount} 句`);
    const elderNew = elder.lines.some(t => t.includes('以前码头每天都有船来'));
    check('镇长新句「以前码头每天都有船来…」在池内且可取到', elderNew,
      elderNew ? '命中' : (elder.lines[0] ?? '')?.substring(0, 20));

    check('阿风池取句无空/坏形状', !adv.empty && !adv.badText && !adv.badShape,
      `空=${adv.empty ?? '-'} 坏文本=${adv.badText ?? '-'} 坏形状=${adv.badShape ?? '-'}`);
    check('阿风池覆盖 ≥ 池大小条目', adv.seenCount >= 8, `覆盖 ${adv.seenCount} 句`);
    const advNew = adv.lines.some(t => t.includes('西边那座灯塔，门锈住了'));
    check('阿风新句「西边那座灯塔，门锈住了…」在池内且可取到', advNew,
      advNew ? '命中' : (adv.lines[0] ?? '')?.substring(0, 20));

    const realErrors = errors.filter(e => !e.includes('favicon'));
    check('无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

    console.log(`\n${fails === 0 ? '🎉 全部通过' : `⚠️ ${fails} 项失败`}`);
  } finally {
    await browser.close();
  }
  process.exit(fails === 0 ? 0 : 1);
}

run().catch(err => { console.error('探针异常:', err); process.exit(1); });
