/**
 * extract_ch1_dialogue.mjs — 从第一章相关源码/设计稿里提取逐句台词（角色→对白），
 * 供整理成「第一章逐句剧本稿」。输出 JSON 到 stdout（或 --out 文件）。
 *
 * 只提取形如 { speaker: 'X', ... , text: 'Y' } 的对象；text 支持单引号/双引号/模板串（粗匹配）。
 * 标注来源文件 + 出现顺序。台词逐字取自源码，便于制作人审核。
 *
 * 用法：node tools/extract_ch1_dialogue.mjs --out /tmp/ch1_dlg.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname, isAbsolute } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// 第一章台词主要来源（按剧情权重）
const SOURCES = {
  'StorySystem.ts':   'src/systems/StorySystem.ts',
  'MapScene.ts':      'src/scenes/MapScene.ts',
  'HouseTidy.ts':     'src/data/HouseTidy.ts',
  'FarmRestore.ts':   'src/data/FarmRestore.ts',
  'voicebank.data':   'src/audio/voicebank.data.ts',
};

/** 从对白对象块里提取 speaker + text（逐字） */
function parseBlock(block) {
  const sp = block.match(/speaker:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/);
  const tx = block.match(/\btext:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)/);
  if (!sp || !tx) return null;
  const speaker = sp[1] ?? sp[2] ?? sp[3] ?? '';
  const text = (tx[1] ?? tx[2] ?? tx[3] ?? '').trim();
  if (!text) return null;
  return { speaker, text };
}

/** 逐段提取：按 `speaker:` 分块，块内取首个 `text:`（保留源码顺序，粗提取） */
function extract(text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '')
                    .replace(/(\/\/[^\n]*)/g, m => (/^[ \t]*\/\//.test(m) ? '' : m)); // 仅删整行 // 注释
  const out = [];
  const parts = clean.split(/speaker:/g);
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const sp = seg.match(/^\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/);
    if (!sp) continue;
    const speaker = (sp[1] ?? sp[2] ?? sp[3] ?? '').trim();
    const tx = seg.match(/\btext:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)/);
    const text = tx ? (tx[1] ?? tx[2] ?? tx[3] ?? '').trim() : '';
    if (!text) continue;
    out.push({ speaker, text });
  }
  return out;
}

const all = {};
for (const [name, rel] of Object.entries(SOURCES)) {
  const full = join(root, rel);
  let text;
  try { text = readFileSync(full, 'utf8'); } catch { console.error('跳过（不存在）:', rel); continue; }
  const lines = extract(text);
  all[name] = lines;
  console.log(`[${name}] 对白行数: ${lines.length}`);
}

const total = Object.values(all).reduce((a, l) => a + l.length, 0);
console.log('\n总计对白行:', total);

const outArg = process.argv.indexOf('--out');
if (outArg > -1 && process.argv[outArg + 1]) {
  const outPath = process.argv[outArg + 1];
  writeFileSync(isAbsolute(outPath) ? outPath : join(root, outPath), JSON.stringify(all, null, 1), 'utf8');
  console.log('已写出:', outPath);
}
