/**
 * Alpha Showcase 发版前回归编排脚本（v0.6-alpha-showcase）
 *
 * 设计目标：录视频 / 发版前一条命令跑完核心验收，不用手动一个个跑 probe。
 *
 * 编排顺序（四个 probe 都是新档自包含，无状态依赖）：
 *   1. probe-dialogue-handoff.mjs — Dialogue 契约（1行→onComplete→新对话不卡死）— 快速失败先行
 *   2. probe-full-story-run.mjs   — 真实玩家完整主线（标题→车站→大门→农场→Day2→小镇→后山→观星夜→结算）
 *   3. probe-save-restore.mjs     — 存档保存→reload→状态保持验证
 *   4. probe-shop01.mjs           — 商店恢复（商品表/购买/旧花苗/老板三阶段）
 *
 * 不写任何新的测试逻辑（复用现有 probe，禁止重造平行实现，AGENTS.md 硬规则）。
 * 仅做：前置 dev server 检查 → 顺序 spawn → 解析 ✅/❌ → 汇总回归报告。
 *
 * 前置：dev server 在 localhost:5173（npm run dev）
 * 运行：npm run showcase  或  node tests/probes/run-alpha-showcase.mjs
 *
 * 视口红线提醒（AI_GUARDRAIL.md）：
 *   - probe-full-story-run 用横屏 844×390 + Android UA（符合红线）
 *   - probe-save-restore / probe-shop01 用 1024×768 桌面视口（历史选择，本编排不改动）
 *   - 真机验收仍需制作人执行（横屏 APK），本脚本仅做浏览器侧自动化回归
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROBES_DIR = __dirname;
const DEV_URL = 'http://localhost:5175/'; // 临时 5175（5173 被占用），验证后改回

// 被编排的 probe 列表（顺序 = 发版前回归优先级）
// 顺序原则：快速失败。Dialogue 基础契约先跑（10s），挂了就不浪费 180s 跑主线。
const PROBES = [
  {
    name: 'dialogue-handoff',
    file: 'probe-dialogue-handoff.mjs',
    desc: 'Dialogue 契约（1行→onComplete→新对话 不卡死）',
    timeoutMs: 60_000,
    // probe-dialogue-handoff 输出格式：`========== probe-dialogue-handoff 结果: X 通过 / Y 失败 ==========`
    parse: (out) => parseResultLine(out, /probe-dialogue-handoff\s*结果:\s*(\d+)\s*通过\s*\/\s*(\d+)\s*失败/),
    viewport: '844×390 横屏 + Android UA ✅',
  },
  {
    name: 'full-story-run',
    file: 'probe-full-story-run.mjs',
    desc: '真实玩家完整主线（新档→观星夜→结算）',
    timeoutMs: 180_000,
    // probe-full-story-run 输出格式：`========== 结果: ✅ X 通过 / ❌ Y 失败 ==========`
    parse: (out) => parseResultLine(out, /结果:\s*✅\s*(\d+)\s*通过\s*\/\s*❌\s*(\d+)\s*失败/),
    viewport: '844×390 横屏 + Android UA ✅',
  },
  {
    name: 'save-restore',
    file: 'probe-save-restore.mjs',
    desc: '存档保存→reload→状态保持',
    timeoutMs: 120_000,
    // probe-save-restore 输出格式：`结果: X 通过 / Y 失败`
    parse: (out) => parseResultLine(out, /结果:\s*(\d+)\s*通过\s*\/\s*(\d+)\s*失败/),
    viewport: '1024×768 桌面视口（历史，非横屏）',
  },
  {
    name: 'shop01',
    file: 'probe-shop01.mjs',
    desc: '商店恢复（商品/购买/旧花苗/老板三阶段）',
    timeoutMs: 90_000,
    // probe-shop01 输出格式：`===== probe-shop01 结果: X 通过 / Y 失败 =====`
    parse: (out) => parseResultLine(out, /probe-shop01\s*结果:\s*(\d+)\s*通过\s*\/\s*(\d+)\s*失败/),
    viewport: '1024×768 桌面视口（历史，非横屏）',
  },
];

/** 从 probe stdout 解析「X 通过 / Y 失败」 */
function parseResultLine(stdout, regex) {
  const m = stdout.match(regex);
  if (!m) return { parsed: false, pass: 0, fail: 0 };
  return { parsed: true, pass: parseInt(m[1], 10), fail: parseInt(m[2], 10) };
}

/** 探测 dev server 是否在运行（避免 spawn 后才报错） */
async function checkDevServer() {
  try {
    const res = await fetch(DEV_URL, { method: 'GET', signal: AbortSignal.timeout(3000) });
    return res.ok || res.status === 200;
  } catch {
    return false;
  }
}

/** spawn 一个 probe，超时保护 + 收集 stdout */
function runProbe(probe) {
  return new Promise((resolve) => {
    const file = join(PROBES_DIR, probe.file);
    const t0 = Date.now();
    let stdout = '';
    let timedOut = false;

    const child = spawn(process.execPath, [file], {
      cwd: PROBES_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGTERM'); } catch {}
    }, probe.timeoutMs);

    child.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      process.stdout.write(s); // 实时透传，让制作人看到进度
    });
    child.stderr.on('data', (d) => process.stderr.write(d));

    child.on('close', (code) => {
      clearTimeout(timer);
      const elapsed = Math.round((Date.now() - t0) / 1000);
      const parsed = probe.parse(stdout);
      resolve({
        name: probe.name,
        desc: probe.desc,
        viewport: probe.viewport,
        exitCode: code ?? -1,
        timedOut,
        elapsedSec: elapsed,
        pass: parsed.parsed ? parsed.pass : null,
        fail: parsed.parsed ? parsed.fail : null,
        parsedOk: parsed.parsed,
      });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        name: probe.name,
        desc: probe.desc,
        viewport: probe.viewport,
        exitCode: -1,
        timedOut: false,
        elapsedSec: Math.round((Date.now() - t0) / 1000),
        pass: null, fail: null, parsedOk: false,
        error: err.message,
      });
    });
  });
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Alpha Showcase 发版前回归（v0.6-alpha-showcase）       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // 1. dev server 前置检查
  console.log('[前置] 检查 dev server (localhost:5173)…');
  const devOk = await checkDevServer();
  if (!devOk) {
    console.log('❌ dev server 未运行。请先在另一个终端执行：npm run dev');
    console.log('   然后再运行：npm run showcase');
    process.exit(1);
  }
  console.log('✅ dev server 已运行\n');

  // 2. 顺序跑三个 probe
  const results = [];
  for (let i = 0; i < PROBES.length; i++) {
    const p = PROBES[i];
    console.log(`\n┌── [${i + 1}/${PROBES.length}] ${p.name} ─────────────────────────`);
    console.log(`│ ${p.desc}`);
    console.log(`│ 视口：${p.viewport}`);
    console.log(`│ 超时：${p.timeoutMs / 1000}s`);
    console.log('└──────────────────────────────────────────');
    const r = await runProbe(p);
    results.push(r);
    console.log(`\n  → ${r.name} 完成：exit=${r.exitCode} 耗时=${r.elapsedSec}s` +
      (r.parsedOk ? ` ✅${r.pass}/❌${r.fail}` : '（结果行未解析到）') +
      (r.timedOut ? ' [超时]' : '') + (r.error ? ` [error: ${r.error}]` : ''));
  }

  // 3. 汇总回归报告
  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  发版前回归报告                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  let totalPass = 0, totalFail = 0, allOk = true;
  console.log('环节'.padEnd(20) + '状态'.padEnd(8) + '通过/失败'.padEnd(14) + '耗时'.padEnd(8) + '视口');
  console.log('─'.repeat(80));
  for (const r of results) {
    const ok = r.exitCode === 0 && !r.timedOut && !r.error;
    if (!ok) allOk = false;
    const status = ok ? '✅ PASS' : '❌ FAIL';
    const pf = r.parsedOk ? `${r.pass}/${r.fail}` : 'n/a';
    const vp = r.viewport.length > 28 ? r.viewport.slice(0, 27) + '…' : r.viewport;
    if (r.parsedOk) { totalPass += r.pass; totalFail += r.fail; }
    console.log(
      r.name.padEnd(20) +
      status.padEnd(8) +
      pf.padEnd(14) +
      (r.elapsedSec + 's').padEnd(8) +
      vp
    );
    if (r.timedOut) console.log(`    ⚠ 超时（${r.elapsedSec}s）`);
    if (r.error) console.log(`    ⚠ ${r.error}`);
  }
  console.log('─'.repeat(80));
  console.log('合计'.padEnd(20) + (allOk ? '✅ ALL PASS' : '❌ HAS FAIL').padEnd(8) +
    `${totalPass}/${totalFail}`.padEnd(14) + 
    (results.reduce((s, r) => s + r.elapsedSec, 0) + 's').padEnd(8));

  // 失败定位
  const failed = results.filter(r => r.exitCode !== 0 || r.timedOut || r.error);
  if (failed.length) {
    console.log('\n❌ 失败环节定位（逐个排查）：');
    for (const r of failed) {
      console.log(`  • ${r.name}（${r.file ?? PROBES.find(p => p.name === r.name).file}）`);
      console.log(`    退出码=${r.exitCode} 超时=${r.timedOut} 耗时=${r.elapsedSec}s`);
      if (r.error) console.log(`    错误：${r.error}`);
      console.log(`    单独重跑：node tests/probes/${PROBES.find(p => p.name === r.name).file}`);
    }
  }

  // 视口红线提醒
  const hasNonLandscape = results.some(r => r.viewport.includes('非横屏'));
  if (hasNonLandscape) {
    console.log('\n⚠ 视口红线提醒（AI_GUARDRAIL.md）：');
    console.log('  部分 probe 使用桌面 1024×768 视口（历史选择，本编排未改动）。');
    console.log('  发版 / 录视频前，制作人仍需在横屏真机（landscape APK）上做最终验收。');
  }

  console.log('\n' + (allOk ? '✅ 发版前回归通过，可进入录视频/发版流程。' : '❌ 发版前回归未通过，请先修复上述失败环节。'));
  process.exit(allOk ? 0 : 1);
}

run().catch(err => {
  console.error('编排脚本异常:', err);
  process.exit(1);
});
