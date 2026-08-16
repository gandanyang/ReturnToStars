/**
 * 探针 — 阿风后山对白空间语义防回归（2026-08-16 制作人拍板）
 *
 * 修复目标：阿风站在后山(forest)时不再说「有空来后山，我带你转转」（人就在后山=自相矛盾）。
 * 修法：NPCSystem.getAdventurerDialogue(location) 分场景取对白 —— town 用原版(带 adv_06 配音)，
 *       forest 用 ADVENTURER_MOUNTAIN_DIALOGUES 变体(尾句改「那就从这儿开始，往深里走。」，暂静音)。
 *
 * 本探针是**源码级静态守卫**（非浏览器运行）：意在未来 AI 重构阿风对白时，
 * 若把矛盾句复刻进后山变体、或删掉分场景入口，直接红掉拦住回归。
 * 断言：
 *   0. NPCSystem 存在分场景入口 getAdventurerDialogue 与后山变体 ADVENTURER_MOUNTAIN_DIALOGUES
 *   1. 后山变体 block 内不得出现矛盾句「有空来后山，我带你转转。」
 *   2. 后山变体 tail 保留修复句「那就从这儿开始，往深里走。」
 *   3. 默认"镇上"变体仍需保留矛盾句（原配音 adv_06 继续使用）
 *   4. MapScene.showDialogue 实际调用了 getAdventurerDialogue(npc.currentLocation)
 *
 * 运行：node tests/probes/probe-adventurer-mountain-dialogue.mjs（无需 dev server / 浏览器）
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

const NPC_FILE = join(root, 'src', 'systems', 'NPCSystem.ts');
const MAP_FILE = join(root, 'src', 'scenes', 'MapScene.ts');

const FORBIDDEN = '有空来后山，我带你转转。';      // 矛盾句：须只存在于默认(镇上)变体
const FIXED_LINE = '那就从这儿开始，往深里走。';     // 修复句：须存在于后山变体

let pass = 0;
let fail = 0;
function ok(step, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${step}${detail ? ' - ' + detail : ''}`); }
  else { fail++; console.log(`  ❌ ${step}${detail ? ' - ' + detail : ''}`); }
}

const npcSrc = readFileSync(NPC_FILE, 'utf8');
const mapSrc = readFileSync(MAP_FILE, 'utf8');

// 提取后山变体 block：const ADVENTURER_MOUNTAIN_DIALOGUES … 到下一个 ]; 
const mb = npcSrc.match(/const\s+ADVENTURER_MOUNTAIN_DIALOGUES: DialogueLine\[\]\s*=\s*\[([\s\S]*?)\n\];/);
const mountainBlock = mb ? mb[1] : null;

console.log('=== 探针：阿风后山对白空间语义防回归 ===\n');

// 0. 分场景入口存在
ok('存在 getAdventurerDialogue 分场景入口',
  /export function getAdventurerDialogue\(location: string\)/.test(npcSrc));
ok('存在 ADVENTURER_MOUNTAIN_DIALOGUES 后山变体', !!mountainBlock);

if (mountainBlock) {
  // 1. 后山变体不得出现矛盾句（核心防回归）
  ok('后山变体不含「有空来后山，我带你转转。」', !mountainBlock.includes(FORBIDDEN));
  // 2. 后山变体保留修复句
  ok(`后山变体保留修复句「${FIXED_LINE}」`, mountainBlock.includes(FIXED_LINE));
} else {
  ok('后山变体不含矛盾句', false, '无法解析 ADVENTURER_MOUNTAIN_DIALOGUES block');
}

// 3. 默认(镇上)变体仍保留矛盾句 + 原配音入口仍在
ok('默认对白仍保留矛盾句（镇上/原配音）', npcSrc.includes(FORBIDDEN));
{ const vp = readFileSync(join(root, 'src', 'audio', 'voicebank.data.ts'), 'utf8');
  ok('voicebank 仍保留 adv_06（镇上原配音）', vp.includes(FORBIDDEN)); }

// 4. MapScene 实际接入分场景入口
ok('MapScene 调用 getAdventurerDialogue(npc.currentLocation)',
  /getAdventurerDialogue\(npc\.currentLocation\)/.test(mapSrc));

console.log(`\n${fail === 0 ? '✅ 全部通过' : '❌ 有失败项'}  （${pass} 通过 / ${fail} 失败）`);
process.exit(fail === 0 ? 0 : 1);
