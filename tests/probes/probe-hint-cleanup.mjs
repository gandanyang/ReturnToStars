/**
 * 探针 — 底部「按 [E] 查看/交互」提示的兜底清扫防回归（2026-08-16）
 *
 * 背景：制作者反馈某底部提示「一直停在屏幕上」。逐一排查后，所有单个提示的
 * 靠近显示/走远隐藏逻辑均正确，问题属「提示 DOM 节点残留/孤儿」这一类。
 * 修法：
 *   1) 所有底部交互提示统一打共享 class `hint-interact`；
 *   2) hideAllInteractHints() 末尾加 DOM 清扫，强制移除任何残留节点；
 *   3) 修复 checkArtShowProximity 在 artShowHeld 时早返回不隐藏的漏洞。
 *
 * 本探针是**源码级静态守卫**：未来重构若删了清理标记/清扫行列/或复位该漏洞，直接红掉。
 * 断言：
 *   0. hideAllInteractHints 含 .hint-interact 清扫
 *   1. 12 个底部交互提示都打了 hint-interact class
 *   2. checkArtShowProximity 的 artShowHeld 分支会显式 hideArtShowHint
 *
 * 运行：node tests/probes/probe-hint-cleanup.mjs（无需 dev server / 浏览器）
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const MAP_FILE = join(root, 'src', 'scenes', 'MapScene.ts');

let pass = 0, fail = 0;
function ok(step, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${step}${detail ? ' - ' + detail : ''}`); }
  else { fail++; console.log(`  ❌ ${step}${detail ? ' - ' + detail : ''}`); }
}

const src = readFileSync(MAP_FILE, 'utf8');
const stSrc = readFileSync(join(root, 'src', 'scenes', 'StationScene.ts'), 'utf8');

console.log('=== 探针：底部交互提示兜底清扫防回归 ===\n');

// 0. 清扫兜底存在
ok('hideAllInteractHints 含 .hint-interact DOM 清扫',
  /document\.querySelectorAll<HTMLElement>\('\.hint-interact'\)\.forEach\(\(el\) => el\.remove\(\)\)/.test(src));

// 1. 共享 class 标记齐备（12 个底部提示）
const marked = (src.match(/hint\.classList\.add\('hint-interact'\)/g) || []).length;
ok('12 个底部交互提示都打了 hint-interact class', marked === 12, `实际 ${marked} 处`);

// 2. artShowHeld 漏洞已修复（早返回时显式隐藏）
ok('artShowHeld 分支显式 hideArtShowHint（不再裸 return）',
  /if \(this\.artShowHeld\) \{ this\.hideArtShowHint\(\); return; \}/.test(src));

// 3. 车站（StationScene）根因：shutdown 已注册 + 交互提示打 class
ok('StationScene 将 shutdown 注册到 SHUTDOWN 事件（切场景必清理）',
  /this\.events\.once\(Phaser\.Scenes\.Events\.SHUTDOWN, this\.shutdown, this\)/.test(stSrc));
ok('StationScene 公告栏交互提示也打了 hint-interact class',
  /hint\.classList\.add\('hint-interact'\)[\s\S]*?this\.interactHintEl = hint;/.test(stSrc));

console.log(`\n${fail === 0 ? '✅ 全部通过' : '❌ 有失败项'}  （${pass} 通过 / ${fail} 失败）`);
process.exit(fail === 0 ? 0 : 1);
