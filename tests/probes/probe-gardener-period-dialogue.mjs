/**
 * 探针 — 花匠小梅「时段对白」垂直切片防回归（2026-08-16）
 *
 * 目标：让小梅的生活句呼应「世界在回应时间」——上午在农场(07-14)口吻=照料花圃，
 *      下午在森林(14-18)口吻=采撷（与 buildSchedule 同步，不产生"人在A地说B地话"的矛盾）；
 *      夜晚回家由 NIGHT_LINES 覆盖、白天不在场由 schedule 把她移走自然呈现。
 * 修法：getDailyNpcLine(npcId, day, location) 新增 location 参，小梅按当前所在场景切换
 *      GARDENER_PERIOD_LINES[location]；优先级 夜晚 > 集市恢复 > 时段生活句 > 默认。
 *
 * 本探针是**源码级静态守卫**（非浏览器运行）：未来 AI 重构 getDailyNpcLine / 删除时段池 /
 * 或把调用点丢了 location 时，直接红掉拦住回归。
 * 断言：
 *   0. NPCSystem 存在 GARDENER_PERIOD_LINES，且含 farm / forest 两个非空档位
 *   1. getDailyNpcLine 签名含 location 参
 *   2. 优先级保住既有特性：夜晚(NIGHT_LINES) 与 集市恢复(MARKET_RESTORED_LINES) 分支仍在
 *   3. MapScene.showDialogue 以 npc.currentLocation 传给 getDailyNpcLine
 *   4. MapScene 生活句拼到 baseLines（而非 npc.dialogues）——保证阿风后山变体上不串句
 *   5. 去重粒度：小梅按「NPC+位置」当天各说一次（否则上午说过→下午被跳过）
 *
 * 运行：node tests/probes/probe-gardener-period-dialogue.mjs（无需 dev server / 浏览器）
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

const NPC_FILE = join(root, 'src', 'systems', 'NPCSystem.ts');
const MAP_FILE = join(root, 'src', 'scenes', 'MapScene.ts');

let pass = 0;
let fail = 0;
function ok(step, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${step}${detail ? ' - ' + detail : ''}`); }
  else { fail++; console.log(`  ❌ ${step}${detail ? ' - ' + detail : ''}`); }
}

const npcSrc = readFileSync(NPC_FILE, 'utf8');
const mapSrc = readFileSync(MAP_FILE, 'utf8');

// 提取时段池 block：const GARDENER_PERIOD_LINES … 到下一个 };
const pb = npcSrc.match(/const\s+GARDENER_PERIOD_LINES: Record<string, DialogueLine\[\]>\s*=\s*\{([\s\S]*?)\n\};/);
const periodBlock = pb ? pb[1] : null;
const farmPart = periodBlock ? /farm:\s*\[[\s\S]*?\]/.exec(periodBlock)?.[0] : null;
const forestPart = periodBlock ? /forest:\s*\[[\s\S]*?\]/.exec(periodBlock)?.[0] : null;

console.log('=== 探针：花匠小梅时段对白垂直切片防回归 ===\n');

// 0. 时段池存在且 farm/forest 非空
ok('存在 GARDENER_PERIOD_LINES 时段池', !!periodBlock);
ok('farm 档位非空', !!farmPart && /speaker: '花匠小梅'/.test(farmPart));
ok('forest 档位非空', !!forestPart && /speaker: '花匠小梅'/.test(forestPart));

// 1. 签名含 location 参
ok('getDailyNpcLine 签名含 location 参', /getDailyNpcLine\(npcId: string, day: number, location\?: string\)/.test(npcSrc));

// 2. 优先级保住既有特性
ok('夜晚 NIGHT_LINES 分支保留', /isNight\(\) && getChapter\(\) >= 1 \? NIGHT_LINES\[npcId\]/.test(npcSrc));
ok('集市恢复 MARKET_RESTORED_LINES 分支保留', /MARKET_RESTORED_LINES\[npcId\]/.test(npcSrc));

// 3. MapScene 传 location
ok('MapScene 以 npc.currentLocation 调用 getDailyNpcLine',
  /getDailyNpcLine\(npc\.id, today, npc\.currentLocation\)/.test(mapSrc));

// 4. 生活句拼到 baseLines（阿风后山变体不串句）
ok('生活句拼到 baseLines（非 npc.dialogues）', /lines = \[\.\.\.baseLines, \.\.\.daily\]/.test(mapSrc));

// 5. 去重粒度：小梅按（NPC+位置）当天各说一次 —— 否则上午说过→下午被跳过，时段切片失效
ok('小梅按 NPC+位置 去重（否则下午不会再有句）',
  /dedupKey = npc\.id === 'gardener' \? `\$\{npc\.id\}:\$\{npc\.currentLocation\}` : npc\.id/.test(mapSrc));
ok('getDailyNpcLine 调用与去重键都用 currentLocation',
  /set\(dedupKey, today\)/.test(mapSrc));

console.log(`\n${fail === 0 ? '✅ 全部通过' : '❌ 有失败项'}  （${pass} 通过 / ${fail} 失败）`);
process.exit(fail === 0 ? 0 : 1);
