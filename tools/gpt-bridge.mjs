#!/usr/bin/env node
/**
 * GPT 请示桥（gpt-bridge）—— 网页版 ChatGPT 传话工具
 *
 * 作用：把「任务上下文 + 我的输出」发到网页版 ChatGPT，取回它的回复。
 * 用法：
 *   node tools/gpt-bridge.mjs --check            # 只检查登录状态（冒烟测试）
 *   node tools/gpt-bridge.mjs --ask "内容文本"    # 发一条消息并等回复（默认新对话）
 *   node tools/gpt-bridge.mjs --ask-file 文件路径 # 从文件读内容再发（长文用这个）
 *   node tools/gpt-bridge.mjs --check --wait      # 检查登录态，未登录则等你手动登录
 *   node tools/gpt-bridge.mjs --list-convo        # 列出侧栏已有对话（用来挑 --convo）
 *   node tools/gpt-bridge.mjs --ask "..." --convo 3          # 去已有对话[3]
 *   node tools/gpt-bridge.mjs --ask "..." --convo "青禾凤蝶" # 按标题/链接片段匹配
 *   node tools/gpt-bridge.mjs --ask "..." --new    # 重新开启新对话（默认也是新对话）
 *
 * 说明：
 *   - 用独立 profile（.gpt-bridge-profile/），不碰你日常 Chrome 的登录
 *   - 首次需要手动登录一次 ChatGPT，之后自动复用
 *   - 若弹出人机验证，在窗口里手动点一下即可（脚本会等待）
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CHATGPT_URL = 'https://chatgpt.com/';
const PROFILE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.gpt-bridge-profile');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { check: false, wait: false, ask: null, askFile: null, noContext: false, listConvo: false, newChat: false, convo: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') out.check = true;
    else if (args[i] === '--wait') out.wait = true;
    else if (args[i] === '--ask') out.ask = args[i + 1];
    else if (args[i] === '--ask-file') out.askFile = args[i + 1];
    else if (args[i] === '--no-context') out.noContext = true;
    else if (args[i] === '--list-convo') out.listConvo = true;
    else if (args[i] === '--new') out.newChat = true;
    else if (args[i] === '--convo') out.convo = args[i + 1];
  }
  return out;
}

/**
 * 自动附加最近一轮 GPT 回复作为上下文（方案 C：多轮追问时 GPT 记得前文）。
 * 找 tmp/gpt-reply-*.txt 里最新的一个，拼在发问内容前面。
 * --no-context 可关闭（新任务不想带旧上下文时用）。
 */
function buildAskWithContext(ask, noContext) {
  const TMP_DIR = path.join(process.cwd(), 'tmp');
  if (noContext) return { text: ask, contextUsed: null };
  let files = [];
  try {
    files = fs.readdirSync(TMP_DIR).filter((f) => f.startsWith('gpt-reply-') && f.endsWith('.txt'));
  } catch { return { text: ask, contextUsed: null }; }
  if (files.length === 0) return { text: ask, contextUsed: null };
  files.sort().reverse(); // 文件名带时间戳，排序取最新
  const latest = path.join(TMP_DIR, files[0]);
  const prev = fs.readFileSync(latest, 'utf8').trim();
  if (!prev) return { text: ask, contextUsed: null };
  // 拼接：明确标注"上一轮对话"，让 GPT 区分上下文与当前提问
  const text =
    '[以下是上一轮对话中 GPT 的回复（上下文，供参考）：]\n\n' +
    prev +
    '\n\n[以下是我现在新的问题：]\n\n' +
    ask;
  return { text, contextUsed: latest };
}

/** 判断当前是否已登录（URL 停在 chatgpt.com 本体 = 已登录；跳到 auth/登录页 = 未登录） */
function loginState(url) {
  if (!url) return 'unknown';
  if (url.includes('auth.openai.com') || url.includes('login') || url.includes('signin') || url.includes('accounts.google')) return 'not-logged-in';
  if (url.includes('chatgpt.com')) return 'logged-in';
  return 'unknown';
}

/** 等待侧栏会话列表出现；侧栏收起时先尝试展开 */
async function ensureSidebar(page) {
  for (let i = 0; i < 20; i++) {
    const has = await page.evaluate(() =>
      !!document.querySelector('a[data-testid="conversation-item"], a[href^="/c/"]'));
    if (has) return true;
    const opened = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, a')].find((b) => {
        const label = (b.getAttribute('aria-label') || '') + (b.getAttribute('title') || '');
        return /new chat|chat history|sidebar|toggle|新对话|对话列表|侧栏/i.test(label);
      });
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!opened) return false;
    await sleep(800);
  }
  return false;
}

/** 读取侧栏全部会话（标题 + 链接），用 conversation-item 或 /c/ 链接两种方式兜底识别 */
function collectConversations() {
  return [...document.querySelectorAll('a[data-testid="conversation-item"], a[href^="/c/"]')]
    .map((el, index) => {
      const titleEl = el.querySelector('.truncate, h3, .line-clamp-2, span[class*="line-clamp"]');
      return {
        index,
        title: ((titleEl || el).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) || '(无标题)',
        href: el.getAttribute('href') || '',
      };
    });
}

/** 列出侧栏已有对话，方便挑 --convo */
async function listConversations(page) {
  await ensureSidebar(page);
  const convos = await page.evaluate(collectConversations);
  if (convos.length === 0) {
    console.log('（侧栏没有读到会话，可能页面还没加载完或布局变更。）');
    return;
  }
  console.log(`共 ${convos.length} 个对话：`);
  convos.forEach((c) => console.log(`  [${c.index}] ${c.title}  (${c.href})`));
  console.log('  选其中一个用 --convo <编号|标题片段|链接片段>；开新对话用 --new。');
}

/**
 * 根据 --convo 选中目标对话：纯数字=侧栏序号，否则按标题/链接做包含匹配（取第一个命中）。
 */
async function pickConversation(page, selector) {
  await ensureSidebar(page);
  const convos = await page.evaluate(collectConversations);
  if (convos.length === 0) {
    console.log('❌ 没读到侧栏会话，无法选择目标对话。');
    return false;
  }
  const num = /^\d+$/.test(selector.trim());
  const target = num
    ? convos[parseInt(selector, 10)]
    : convos.find((c) =>
        c.title.toLowerCase().includes(selector.toLowerCase()) ||
        c.href.toLowerCase().includes(selector.toLowerCase()));
  if (!target) {
    console.log(`❌ 没找到匹配「${selector}」的对话。可用 --list-convo 查看。`);
    return false;
  }
  console.log(`▶ 切换到已有对话 [${target.index}] ${target.title} ...`);
  const ok = await page.evaluate((href) => {
    const el = [...document.querySelectorAll('a[data-testid="conversation-item"], a[href^="/c/"]')]
      .find((x) => x.getAttribute('href') === href);
    if (el) { el.click(); return true; }
    return false;
  }, target.href);
  if (ok) await sleep(1500); // 等会话页面加载
  return ok;
}

/** 点「新对话」开启一个全新对话（已在首页时可不操作） */
async function openNewChat(page) {
  const clicked = await page.evaluate(() => {
    const el = document.querySelector('a[data-testid="new-chat-button"], [data-testid="new-chat-button"], a[aria-label*="New chat"], a[aria-label*="新对话"], a[href="/"]');
    if (el) { el.click(); return true; }
    const fallback = [...document.querySelectorAll('button, a')].find((b) =>
      /新对话|new chat/i.test((b.getAttribute('aria-label') || '') + (b.getAttribute('title') || '') + (b.textContent || '')));
    if (fallback) { fallback.click(); return true; }
    return false;
  });
  if (clicked) { console.log('▶ 已开启新对话。'); await sleep(1200); }
  else console.log('（未找到「新对话」按钮，可能已在首页/新对话。）');
  return true;
}

async function main() {
  const opts = parseArgs();
  if (opts.askFile) opts.ask = fs.readFileSync(opts.askFile, 'utf8').trim();

  // 方案 C：自动带上轮回复作为上下文（多轮追问 GPT 记得前文）
  let contextInfo = null;
  if (opts.ask) {
    const built = buildAskWithContext(opts.ask, opts.noContext);
    if (built.contextUsed) {
      opts.ask = built.text;
      contextInfo = built.contextUsed;
      console.log(`ℹ️ 已自动附加上一轮回复作为上下文: ${built.contextUsed}`);
    } else {
      console.log('ℹ️ 未附加上下文（--no-context 或暂无历史回复）');
    }
  }

  console.log(`▶ 启动 Chrome（独立 profile: ${PROFILE_DIR}）...`);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const page = await browser.newPage();
  // 尽量减小被识别为自动化的概率（不承诺绕过验证，只是减少误判）
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  console.log(`▶ 打开 ${CHATGPT_URL} ...`);
  await page.goto(CHATGPT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => {
    console.log('  首跳可能被拦截（Cloudflare 等），等待人工处理...', e.message.slice(0, 80));
  });

  // 轮询等待页面稳定（最多 90 秒：给 Cloudflare 验证 / 登录跳转留时间）
  let state = 'unknown';
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    try {
      state = loginState(page.url());
    } catch { /* 页面可能还在跳转 */ }
    if (state === 'logged-in') break;
  }

  if (state === 'logged-in') {
    console.log('✅ 已登录 ChatGPT，可以直接传话。');

    // 只列表模式：打印侧栏对话后即关，不发消息
    if (opts.listConvo) {
      await listConversations(page);
      await browser.close();
      return;
    }
  } else if (state === 'not-logged-in') {
    console.log('⚠️ 未登录（跳到了登录页）。');
    if (opts.wait) {
      console.log('  请在打开的窗口里手动登录 ChatGPT（登录后自动继续）...');
      for (let i = 0; i < 300; i++) {
        await sleep(1000);
        try {
          if (loginState(page.url()) === 'logged-in') { state = 'logged-in'; break; }
        } catch { }
      }
      if (state === 'logged-in') console.log('✅ 登录成功，继续。');
      else console.log('⏰ 等待登录超时（5 分钟）。');
    }
  } else {
    console.log('❓ 状态不明，可能卡在验证页。若看到人机验证，请在窗口里手动处理。');
  }

  // 传话模式：已登录才发消息
  if (opts.ask && state === 'logged-in') {
    // 选择对话：给了 --convo 就去已有会话，否则默认开新对话
    if (opts.convo) {
      if (!(await pickConversation(page, opts.convo))) {
        await browser.close();
        process.exit(1);
      }
    } else {
      await openNewChat(page);
    }
    console.log(`▶ 发送内容（${opts.ask.length} 字符）...`);
    // 等待输入框出现（新版 ChatGPT 用 contenteditable / ProseMirror）
    let inputSel = null;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      try {
        const found = await page.evaluate(() => {
          const sels = ['#prompt-textarea', 'div[contenteditable="true"]', 'textarea'];
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el && el.offsetParent !== null) return s;
          }
          return null;
        });
        if (found) { inputSel = found; break; }
      } catch {
        // 页面导航导致旧 frame 脱离：等下一轮重试
      }
    }
    if (!inputSel) {
      console.log('❌ 没找到输入框（页面结构可能变了或还在加载）。请手动在窗口里发消息。');
      await browser.close();
      process.exit(1);
    }

    await page.click(inputSel);
    // 多行文本规范输入：ChatGPT 中 Enter=发送、Shift+Enter=换行。
    // 逐行输入，行间用 Shift+Enter 换行（不触发发送），全部输完才按 Enter 发送。
    const lines = opts.ask.split('\n');
    for (let i = 0; i < lines.length; i++) {
      await page.type(inputSel, lines[i], { delay: 2 });
      if (i < lines.length - 1) {
        await page.keyboard.down('Shift');
        await page.keyboard.press('Enter');
        await page.keyboard.up('Shift');
        await sleep(50);
      }
    }
    console.log(`▶ 内容已填入输入框（${lines.length} 行 / ${opts.ask.length} 字符），即将发送...`);
    await sleep(500); // 留一拍，让输入框渲染稳定
    await page.keyboard.press('Enter');
    console.log('▶ 已发送，等待 ChatGPT 回复...');

    // 轮询等回复完成：找最后一个 assistant 消息并确认不再"正在生成"
    // 策略：发送后先等 12 秒（GPT 生成中），再每 3 秒采样一次；
    // 页面导航导致 frame 脱离时，重新获取 page 主 frame 继续读。
    let replyText = '';
    const deadline = Date.now() + 6 * 60 * 1000; // 最多等 6 分钟
    let firstSample = null;
    await sleep(12000); // 给生成留初始时间
    while (Date.now() < deadline) {
      await sleep(3000);
      let r = null;
      try {
        // 若主 frame 脱离，page.mainFrame() 会抛错 → 触发下面重新导航逻辑
        r = await page.evaluate(() => {
          const arts = [...document.querySelectorAll('article, div[data-message-author-role="assistant"]')];
          if (arts.length === 0) return { text: '', busy: false };
          const last = arts[arts.length - 1];
          const busy = !!document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop"], .result-streaming');
          return { text: last.textContent || '', busy };
        });
      } catch (e) {
        // frame 脱离：等页面稳定后重试（最多 3 次导航恢复）
        console.log(`  ⏳ 页面导航中（${e.message.slice(0, 50)}）…`);
        await sleep(5000);
        continue;
      }
      if (r && r.text && !r.busy) {
        if (firstSample === null) {
          firstSample = r.text;
          continue; // 需要两次一致才确认完成
        }
        if (firstSample === r.text) { replyText = r.text; break; }
        firstSample = r.text;
      }
    }

    // 兜底：轮询未确认完成但页面里已有回复 → 最后再读一次
    if (!replyText) {
      try {
        const finalRead = await page.evaluate(() => {
          const arts = [...document.querySelectorAll('article, div[data-message-author-role="assistant"]')];
          if (arts.length === 0) return '';
          return arts[arts.length - 1].textContent || '';
        });
        if (finalRead && finalRead !== opts.ask) replyText = finalRead;
      } catch { /* 忽略 */ }
    }

    if (replyText) {
      console.log('\n========== GPT 回复 ==========');
      console.log(replyText);
      console.log('===============================');
      // 落盘供后续使用
      const outFile = path.join(process.cwd(), 'tmp', `gpt-reply-${Date.now()}.txt`);
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, replyText, 'utf8');
      console.log(`💾 回复已存: ${outFile}`);
    } else {
      console.log('⚠️ 没等到完整回复（可能还在生成或验证卡住）。可以稍后再试，或手动在窗口里复制。');
    }
  }

  // 检查模式：看一眼就关
  if (!opts.ask && !opts.wait) {
    console.log('（检查完毕，关闭浏览器）');
  } else {
    // 传话/等待模式：保持窗口 3 秒便于你看到结果，然后关闭
    await sleep(3000);
  }
  await browser.close();
  console.log('✓ 浏览器已关闭。');
}

main().catch((e) => {
  console.error('脚本出错:', e.message);
  process.exit(1);
});
