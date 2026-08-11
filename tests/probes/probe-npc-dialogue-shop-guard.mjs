/**
 * 探针：NPC 对话不被商店剧情覆盖 防复发验证（BUG 2026-08-11）
 *
 * 背景：MapScene.showDialogue 是所有 NPC 共用的对话入口，但三个商店剧情 build
 * （buildShopStateDialogue / buildShopSideDialogue / buildShopRevivalDialogue）
 * 曾无 npc.id === 'shopkeeper' 守卫 → 新档 shopState='none' 时，神秘女/阿风等
 * 任何 NPC 的对话都会被「商店关门剧情」完全替代（台词变成商店老板的）。
 * 修复：三个 build 仅在商店老板对话时调用。
 *
 * 断言：
 *   A1 阿风（森林 09:00）首行 speaker=阿风、台词含「新搬来的林澈」——非商店台词
 *   A2 神秘女（森林 17:00）首行 speaker=系统叙事、台词含「少女站在树影下」——非商店台词
 *   A3 对照：商店老板（镇上 10:00）首行仍触发商店关闭剧情（含「店门」/「招牌」）
 *
 * 前置：Vite dev server 跑在 localhost:5173
 * 运行：node tests/probes/probe-npc-dialogue-shop-guard.mjs
 */
import puppeteer from 'puppeteer-core';

const GAME_URL = 'http://localhost:5173/';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = [];
function result(step, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${step}: ${passed ? '通过' : '失败'}${detail ? ' - ' + detail : ''}`);
  results.push(passed);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('=== NPC 对话不被商店剧情覆盖 防复发探针 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`  [err] ${msg.text().substring(0, 140)}`);
      else if (msg.text().includes('[DEBUG]')) console.log(`  [dbg] ${msg.text().substring(0, 140)}`);
    });

    // ---------- 准备：清档（shopState 默认 'none'）→ 主线完成 → 场景/时间就位 ----------
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2500);
    await page.evaluate(() => {
      window.debug.setStoryStep('done');
      window.debug.setQuestState('completed');
    });

    // 读取当前 StoryDialogue 首行（speaker + 已打出的文本），未打开返回 null
    const readDlg = () => page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      const dlg = s?.storyDialogue;
      if (!dlg || !dlg.isOpen()) return null;
      return {
        name: dlg.nameEl?.textContent ?? '',
        text: dlg.textEl?.textContent ?? '',
      };
    });

    // 关闭当前所有打开的对话（触底自动关），用于跳过首次进镇 intro 等
    const closeDialogue = () => page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      const dlg = s?.storyDialogue;
      for (let i = 0; i < 30 && dlg?.isOpen(); i++) dlg.advance();
    });

    // 切场景 + 挪玩家到指定 NPC 旁 + 按 E，轮询等待对话首行出现
    // useShowDialogue=true：跳过 tryInteract（镇上花圃事件等前置锚点会抢交互），直调
    // showDialogue(npc)——守卫逻辑就在 showDialogue 内部，直调同样验证注入守卫。
    const interactNpc = async (sceneKey, npcId, useShowDialogue = false, timeoutMs = 8000) => {
      await page.evaluate(({ sceneKey }) => {
        const g = window.__game;
        const active = g.scene.getScenes(true)[0];
        if (active && active.scene.key !== sceneKey) g.scene.stop(active.scene.key);
        g.scene.start(sceneKey, { spawn: { x: 100, y: 100 } });
      }, { sceneKey });
      await sleep(1500);
      // 首次进镇会自动播 intro，先跳过，避免抢走 NPC 对话
      await closeDialogue();
      // 时间已由调用方 setTime，等待 NPC 重建就位后把玩家贴到 NPC 上（用当前活动场景）
      await page.evaluate(({ npcId }) => {
        const s = window.__game.scene.getScenes(true)[0];
        const npc = s.npcList.find(n => n.id === npcId);
        if (npc?.sprite && !npc.vanished) {
          s.player.x = npc.sprite.x;
          s.player.y = npc.sprite.y;
        }
      }, { npcId });
      // 用 tryInteract() 直接触发（与 E 键同入口；puppeteer 键盘事件时序不稳，改用直调更稳定）
      await page.evaluate(({ npcId, useShowDialogue }) => {
        const s = window.__game.scene.getScenes(true)[0];
        if (useShowDialogue) {
          const npc = s.npcList.find(n => n.id === npcId);
          if (npc) s.showDialogue(npc);
        } else {
          s.tryInteract();
        }
      }, { npcId, useShowDialogue });
      await sleep(400);
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const d = await readDlg();
        if (d) {
          // 打字机渐进：等到文本已打出若干字符
          if (d.text.length >= 2) {
            await sleep(900); // 让第一行打完，读取完整首行
            return await readDlg();
          }
        }
        await sleep(200);
      }
      return null;
    };

    // ---------- A1 阿风（森林 09:00，调度 08:00-14:00 森林） ----------
    await page.evaluate(() => window.debug.setTime(9, 0));
    let d = await interactNpc('forest', 'adventurer');
    result('A1 阿风对话不被商店覆盖',
      !!d && d.name === '阿风' && d.text.includes('新搬来的林澈'),
      d ? `首行 speaker="${d.name}" 文本="${d.text.slice(0, 40)}…"` : '对话未打开');
    await closeDialogue();

    // ---------- A2 神秘女（森林 17:00，调度 16:00-20:00 森林） ----------
    await page.evaluate(() => window.debug.setTime(17, 0));
    d = await interactNpc('forest', 'mystery');
    result('A2 神秘女对话不被商店覆盖',
      !!d && d.name === '' && d.text.includes('少女站在树影下'),
      d ? `首行 speaker="${d.name}" 文本="${d.text.slice(0, 40)}…"` : '对话未打开');
    await closeDialogue();

    // ---------- A3 对照：商店老板（镇上 10:00，shopState='none' → 应触发关闭剧情） ----------
    await page.evaluate(() => window.debug.setTime(10, 0));
    d = await interactNpc('town', 'shopkeeper', true);
    if (!d) {
      const diag = await page.evaluate(() => {
        const s = window.__game.scene.getScenes(true)[0];
        const shop = s?.npcList?.find(x => x.id === 'shopkeeper');
        return {
          key: s?.scene?.key,
          shopState: s?.shopState,
          npcIds: s?.npcList?.map(n => `${n.id}:${n.sprite ? 'sprite' : 'noSprite'}:${n.vanished ? 'gone' : 'here'}`),
          player: s?.player ? [s.player.x, s.player.y] : null,
          shop: shop?.sprite ? [shop.sprite.x, shop.sprite.y] : null,
          dlgOpen: s?.storyDialogue?.isOpen?.(),
          dlgName: s?.storyDialogue?.nameEl?.textContent,
        };
      });
      console.log('  [diag] A3:', JSON.stringify(diag));
    }
    result('A3 对照：商店老板对话仍触发商店剧情',
      !!d && (d.text.includes('店门') || d.text.includes('招牌')),
      d ? `首行 speaker="${d.name}" 文本="${d.text.slice(0, 40)}…"` : '对话未打开');

    const pass = results.filter(Boolean).length;
    const fail = results.length - pass;
    console.log(`\n========== 结果: ✅ ${pass} / ❌ ${fail} ==========`);
    if (fail > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('探针异常:', err);
  process.exit(1);
});
