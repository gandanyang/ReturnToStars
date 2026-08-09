#!/usr/bin/env node
/**
 * 生成《归星物语》全剧情台本网页（含配音试听）
 *
 * - 台词数据源：src/systems/StorySystem.ts / src/data/MemoryFlashbacks.ts /
 *               src/systems/NPCSystem.ts / src/systems/DailyEventSystem.ts
 *               + QuestSystem / MapScene 少量内联台词（脚本内手工维护）
 * - 配音映射源：src/audio/voicebank.data.ts（与游戏运行时 VoiceBank 完全同源）
 * - 匹配规则：与 VoiceBank.find 一致（speaker 精确 / '' 通配 + 归一化文本精确匹配）
 * - 输出：public/story_script.html（dev server 根目录可访问）
 *
 * 用法：node tools/gen_story_webpage.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'story_script.html');

// ── 台词块中文标签（声明名 → 章节内小标题） ──
const LABELS = {
  // 序章
  STATION_DIALOGUE: '车站 · 出发前',
  XIYA_DIALOGUE: '初遇夏雅 · 庄园门口',
  GATE_OPENED_DIALOGUE: '开门 · 旧锄头',
  XIYA_DAWN_DIALOGUE: '夏雅清晨偶遇',
  FIRST_MORNING_RESPONSE_DIALOGUE: '岛屿的第一声回应（Day2 清晨）',
  GRANDPA_NOTES: '爷爷的笔记（庄园角落可读物件）',
  FIRST_HARVEST_DIALOGUE: '第一次收获',
  XIYA_EVENING_DIALOGUE: '夏雅傍晚关心',
  XIYA_EVENING_OBS_DIALOGUE: '点灯人 · 观察台词',
  SOW_SEEDS_DIALOGUE: '播种引导',
  WATER_CROPS_DIALOGUE: '浇水引导',
  EVENING_DIALOGUE: '第一夜 · 睡前',
  // 第一章
  TOWN_INTRO_DIALOGUE: '首次进入小镇',
  ELDER_QUEST_DIALOGUE: '村长委托 · 星之碎片',
  ELDER_BUSY_DIALOGUE: '村长「暂时有事」· 启动物资',
  ELDER_BUSY_SHORT_DIALOGUE: '村长简短提醒',
  SHARD_DELIVER_DIALOGUE: '交付星之碎片',
  FOREST_LOOKOUT_DIALOGUE: '后山观景台',
  FOREST_SHARD_DIALOGUE: '森林碎片发现',
  WOODCUT_TIP_DIALOGUE: '砍树引导',
  MINE_TIP_DIALOGUE: '挖矿引导',
  GARDEN_RESTORED_XIYA_DIALOGUE: '花园恢复 · 夏雅见证',
  OLD_HOUSE_RESTORED_DIALOGUE: '老屋修复 · 村长',
  FOREST_ROAD_RESTORED_DIALOGUE: '道路修复 · 老张',
  CARPENTER_RETURN_DIALOGUE: '木匠回归',
  ADVENTURER_WELCOME_BACK_DIALOGUE: '阿风欢迎回家',
  ELDER_WHY_FARM_DIALOGUE: '村长「为什么种田」',
  XIYA_SMALL_THINGS_DIALOGUE: '夏雅「小事的价值」',
  XIYA_PHOTO_ENTRY_DIALOGUE: '夏雅整理旧照片 · 入口',
  XIYA_PHOTO_DONE_DIALOGUE: '夏雅整理旧照片 · 完成',
  XIYA_LETTER_OPEN_DIALOGUE: '春深有信 · 开场',
  XIYA_LETTER_FLOWER_DIALOGUE: '春深有信 · 互动一（花苗）',
  XIYA_LETTER_RECORD_DIALOGUE: '春深有信 · 互动二（旧花种记录）',
  XIYA_LETTER_FINAL_DIALOGUE: '春深有信 · 收尾',
  MINER_LAMP_ENTRY_DIALOGUE: '老张「矿灯」· 入口',
  MINER_LAMP_NEED_DIALOGUE: '老张「矿灯」· 材料不足',
  MINER_LAMP_DONE_DIALOGUE: '老张「矿灯」· 点亮',
  GARDENER_PLUM_ENTRY_DIALOGUE: '小梅「小梅花」· 入口',
  GARDENER_PLUM_DONE_DIALOGUE: '小梅「小梅花」· 种下',
  XIYA_GARDEN_TRELLIS_DIALOGUE: '支线 · 修藤架（入口）',
  XIYA_GARDEN_TRELLIS_NEED_DIALOGUE: '支线 · 修藤架（木材不足）',
  XIYA_GARDEN_TRELLIS_DONE_DIALOGUE: '支线 · 修藤架（完成）',
  ELDER_TEA_QUEST_DIALOGUE: '支线 · 看星星的地方（委托）',
  ELDER_STAR_SITE_DIALOGUE: '支线 · 看星星的地方（触发）',
  OLD_ROBOT_DIALOGUE: '旧农业机器人修复',
  // Demo 结尾
  DEMO_ENDING_DIALOGUE: '观星夜 · 收尾',
  DEMO_ENDING_BRANCHES: '观星夜 · 三选一分支',
  DEMO_ENDING_FINALE: '观星夜 · 次日清晨',
  // 记忆闪回
  SHARD_1_FLASHBACK: '碎片一 · 归属（田埂看星星）',
  SHARD_2_FLASHBACK: '碎片二 · 连接（村里玩伴）',
  SHARD_3_FLASHBACK: '碎片三 · 创造（木工小船）',
  XIYA_LAMP_FLASHBACK: '灯意象 · 童年点灯回忆',
  XIYA_GARDEN_FLASHBACK: '记忆卡 · 院子有人照顾',
  ELDER_STAR_FLASHBACK: '记忆卡 · 看星星的地方',
  XIYA_PHOTO_FLASHBACK: '记忆卡 · 旧照片',
  PLUM_BLOOM_FLASHBACK: '记忆卡 · 小梅花',
  SHOP_CROP_ENTRY_DIALOGUE: '商店 · 一篮作物（入口）',
  SHOP_CROP_NEED_DIALOGUE: '商店 · 一篮作物（数量不足）',
  SHOP_CROP_DONE_DIALOGUE: '商店 · 一篮作物（完成）',
  SHOP_CROP_FLASHBACK: '记忆卡 · 送菜',
  // NPC
  ELDER_DIALOGUES: '村长 · 兜底台词',
  SHOPKEEPER_DIALOGUES: '商店老板 · 欢迎 / 买卖',
  MYSTERY_DIALOGUES: '神秘少女 · 初遇',
  MYSTERY_AFTER_OBSERVATORY_DIALOGUE: '神秘少女 · 观星后',
  MINER_DIALOGUES: '矿工老张 · 常驻对话',
  GARDENER_DIALOGUES: '花匠小梅 · 常驻对话',
  ADVENTURER_DIALOGUES: '阿风 · 常驻对话',
  CARPENTER_DIALOGUES: '木匠老周 · 常驻对话',
  NPC_DAILY_LINES: '居民每日闲聊（随机一句）',
  DAILY_EVENTS: '日常随机事件',
};

// ── 说话人 → 名牌颜色（与 StorySystem.COLORS 对齐 + 补充） ──
const SPEAKER_COLORS = {
  林澈: '#7eb8da',
  夏雅: '#f0a050',
  村长: '#c8b898',
  神秘少女: '#b8a0e8',
  信: '#e8d8a8',
  爷爷的笔记: '#e8d8a8',
  爷爷: '#d8c8a0',
  矿工老张: '#b89878',
  老张: '#d8a050',
  花匠小梅: '#a0d888',
  小梅: '#a0d888',
  阿风: '#88b8e8',
  木匠老周: '#c89860',
  商店老板: '#8ac8a0',
};

// ═════════════════════════ 源文件解析 ═════════════════════════

/** 跳过字符串字面量，返回字符串结束后的下标 */
function skipString(src, i, quote) {
  i += 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === quote) return i + 1;
    if (c === '\n') return i; // 未闭合，防御
    i += 1;
  }
  return i;
}

/** 从 start 的 '{' 开始，返回匹配 '}' 的下标（感知字符串与注释） */
function findMatchingBrace(src, start) {
  let depth = 0;
  let i = start;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(src, i, c); continue; }
    if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl < 0 ? src.length : nl; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) return i; }
    i += 1;
  }
  return i;
}

/** 提取对象字面量（含 speaker: 与 text: 键），返回 { start, end, content } */
function extractObjects(src) {
  const objs = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(src, i, c); continue; }
    if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl < 0 ? src.length : nl; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '{') {
      const end = findMatchingBrace(src, i);
      const content = src.slice(i + 1, end);
      if (/(^|[\s,])speaker\s*:/.test(content) && /(^|[\s,])text\s*:/.test(content)) {
        objs.push({ start: i, end, content });
      }
      i = end + 1;
      continue;
    }
    i += 1;
  }
  return objs;
}

/** 读取字符串字面量（带转义），返回 { value, end } */
function readString(src, i) {
  const quote = src[i];
  let out = '';
  i += 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      const n = src[i + 1];
      if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else if (n === 'u') {
        const hex = src.slice(i + 2, i + 6);
        out += String.fromCharCode(parseInt(hex, 16) || 0);
        i += 4;
      } else out += n;
      i += 2;
      continue;
    }
    if (c === quote) return { value: out, end: i + 1 };
    out += c;
    i += 1;
  }
  return { value: out, end: i };
}

/** 提取对象内某键的字符串值 */
function keyString(content, key) {
  const m = content.match(new RegExp(`(^|[\\s,{])${key}\\s*:`));
  if (!m) return undefined;
  let i = content.indexOf(':', m.index + m[1].length) + 1;
  while (i < content.length && /\s/.test(content[i])) i += 1;
  if (content[i] === "'" || content[i] === '"') return readString(content, i).value;
  return undefined;
}

/** 方括号匹配（感知字符串与注释） */
function findMatchingBracket(src, start) {
  let depth = 0, i = start;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(src, i, c); continue; }
    if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl < 0 ? src.length : nl; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '[') depth += 1;
    else if (c === ']') { depth -= 1; if (depth === 0) return i; }
    i += 1;
  }
  return i;
}

/** 解析台词对象 → { speaker, text, inner, options, isHint } */
function parseDialogueObj(content) {
  const speaker = keyString(content, 'speaker') ?? '';
  let text = keyString(content, 'text') ?? '';
  let isHint = false;
  const tm = content.match(/(^|[\s,{])text\s*:/);
  if (tm) {
    let i = content.indexOf(':', tm.index + tm[1].length) + 1;
    while (i < content.length && /\s/.test(content[i])) i += 1;
    if (content.startsWith('hint(', i)) {
      isHint = true;
      i += 'hint('.length;
      while (i < content.length && /\s/.test(content[i])) i += 1;
      if (content[i] === "'" || content[i] === '"') text = readString(content, i).value;
    }
  }
  const inner = /(^|[\s,])inner\s*:\s*true/.test(content);
  // options 数组
  let options = [];
  const om = content.match(/(^|[\s,{])options\s*:\s*\[/);
  if (om) {
    const openIdx = content.indexOf('[', om.index);
    const closeIdx = findMatchingBracket(content, openIdx);
    const optStr = content.slice(openIdx + 1, closeIdx);
    let j = 0;
    while (j < optStr.length) {
      while (j < optStr.length && /\s|,/.test(optStr[j])) j += 1;
      if (j >= optStr.length) break;
      if (optStr[j] === "'" || optStr[j] === '"') {
        const r = readString(optStr, j);
        options.push(r.value);
        j = r.end;
      } else j += 1;
    }
  }
  return { speaker, text, inner, options, isHint };
}

/** 声明容器提取：返回 [{ name, type, start }] */
function findContainers(src) {
  const out = [];
  const re = /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*:\s*((?:Record\s*<[^>]+>\s*)?DialogueLine\[\]|DailyEvent\[\]|Record\s*<\s*string\s*,\s*DialogueLine\[\]\s*>|[A-Za-z_$][\w$]*\[\])\s*=\s*\[/g;
  const re2 = /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*:\s*(?:Record\s*<[^>]+>|Record\s*<\s*string\s*,\s*DialogueLine\[\]\s*>)\s*=\s*\{/g;
  let m;
  while ((m = re.exec(src))) out.push({ name: m[1], type: m[2], start: m.index, isRecord: false });
  while ((m = re2.exec(src))) out.push({ name: m[1], type: m[2], start: m.index, isRecord: true });
  out.sort((a, b) => a.start - b.start);
  return out;
}

/** 子分组：用于 Record 容器（NPC_DAILY_LINES / DEMO_ENDING_BRANCHES） */
function findSubgroup(src, obj, container) {
  // 从 container.start 到 obj.start 之间，找最后一个 'key: ['（非 options），且括号闭合于 obj 之后
  const seg = src.slice(container.start, obj.start);
  const re = /([A-Za-z_$][\w$]*)\s*:\s*\[/g;
  let m, last = null;
  while ((m = re.exec(seg))) {
    if (m[1] === 'options') continue;
    const openIdx = container.start + m.index + m[0].indexOf('[');
    const closeIdx = findMatchingBracket(src, openIdx);
    if (obj.start > openIdx && obj.end < closeIdx) last = { key: m[1], openIdx, closeIdx };
  }
  return last;
}

// ═════════════════════════ 语音映射与匹配 ═════════════════════════

function normalize(text) {
  let t = String(text).replace(/^（[^）]*）/u, '');
  t = t.replace(/^「/u, '').replace(/」$/u, '');
  t = t.trim();
  if (t === '') {
    const m = String(text).match(/「([^」]+)」/u);
    if (m) t = m[1].trim();
  }
  return t;
}

function loadVoiceEntries() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'audio', 'voicebank.data.ts'), 'utf8');
  const entries = [];
  const re = /file:\s*'([^']+)',\s*speaker:\s*'([^']*)',\s*text:\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(src))) {
    entries.push({ file: m[1], speaker: m[2], text: m[3].replace(/\\(.)/g, '$1') });
  }
  return entries;
}

function matchVoices(line, entries) {
  const n = normalize(line.text);
  if (!n) return [];
  return entries
    .filter((e) => (e.speaker === '' || e.speaker === line.speaker) && normalize(e.text) === n)
    .map((e) => ({
      url: 'audio/voice_normalized/' + e.file.replace(/\.wav$/i, '.ogg'),
      file: e.file,
    }));
}

function listOggFiles() {
  const dir = path.join(ROOT, 'public', 'audio', 'voice_normalized');
  const out = [];
  function walk(d, prefix) {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) walk(p, prefix + name + '/');
      else if (name.endsWith('.ogg')) out.push(prefix + name);
    }
  }
  if (fs.existsSync(dir)) walk(dir, '');
  out.sort();
  return out;
}

// ═════════════════════════ 组块构建 ═════════════════════════

const SOURCE_FILES = [
  { file: 'src/systems/StorySystem.ts', section: '主线剧情 · 序章归乡 / 第一章小镇 / 观星夜', order: 1 },
  { file: 'src/data/MemoryFlashbacks.ts', section: '童年记忆闪回 / 记忆卡', order: 2 },
  { file: 'src/systems/NPCSystem.ts', section: 'NPC 对话与居民闲聊', order: 3 },
  { file: 'src/systems/DailyEventSystem.ts', section: '日常随机事件', order: 4 },
];

// 手工维护的少量内联台词（QuestSystem / MapScene 运行时内联，未入数据文件）
const EXTRA_BLOCKS = [
  {
    section: '主线任务附加台词（QuestSystem 内联）',
    blocks: [
      {
        title: '任务进行中 · 村长',
        lines: [
          { speaker: '村长', text: '去你爷爷以前常去的后山看看吧，孩子。' },
          { speaker: '村长', text: '星辰岛的秘密才刚刚揭开……期待你的下一次冒险。' },
        ],
      },
    ],
  },
  {
    section: '商店复兴观察台词（MapScene 内联）',
    blocks: [
      {
        title: '商店老板 · 复兴度三阶段',
        lines: [
          { speaker: '商店老板', text: '好久没人买这么多东西了。' },
          { speaker: '商店老板', text: '最近镇上的人好像又多起来了。' },
          { speaker: '商店老板', text: '没想到这间店还能重新热闹起来。' },
        ],
      },
    ],
  },
];

function buildSections() {
  const sections = [];
  for (const sf of SOURCE_FILES) {
    const src = fs.readFileSync(path.join(ROOT, sf.file), 'utf8');
    const containers = findContainers(src);
    const objects = extractObjects(src);
    const blocks = [];

    for (const obj of objects) {
      let container = null;
      for (let k = containers.length - 1; k >= 0; k--) {
        if (containers[k].start < obj.start) { container = containers[k]; break; }
      }
      if (!container) continue;

      // DailyEvent[] 容器：外层事件对象内含 dialogue: [...]，需拆出全部对白行
      if (container.type === 'DailyEvent[]' || container.name === 'DAILY_EVENTS') {
        const idm = obj.content.match(/\bid\s*:\s*'([^']+)'/);
        const eventId = idm ? idm[1] : '';
        const dm = obj.content.match(/(^|[\s,{])dialogue\s*:\s*\[/);
        if (dm) {
          const openIdx = obj.content.indexOf('[', dm.index);
          const closeIdx = findMatchingBracket(obj.content, openIdx);
          const arr = obj.content.slice(openIdx + 1, closeIdx);
          for (const inObj of extractObjects(arr)) {
            const line = parseDialogueObj(inObj.content);
            if (!line.text && line.options.length === 0) continue;
            let block = blocks.find((b) => b.name === container.name && b.sub === eventId);
            if (!block) {
              block = { name: container.name, sub: eventId, lines: [] };
              blocks.push(block);
            }
            block.lines.push(line);
          }
        }
        continue;
      }

      const line = parseDialogueObj(obj.content);
      if (!line.text && line.options.length === 0) continue; // 空行跳过
      let sub = '';
      if (container.isRecord || container.type.includes('Record') || container.name === 'DAILY_EVENTS') {
        const sg = findSubgroup(src, obj, container);
        if (sg) sub = sg.key;
      }
      let block = blocks.find((b) => b.name === container.name && b.sub === sub);
      if (!block) {
        block = { name: container.name, sub, lines: [] };
        blocks.push(block);
      }
      block.lines.push(line);
    }

    // 按声明在文件中的顺序排序块
    blocks.sort((a, b) => {
      const ca = containers.find((c) => c.name === a.name);
      const cb = containers.find((c) => c.name === b.name);
      return (ca?.start ?? 0) - (cb?.start ?? 0);
    });

    sections.push({ title: sf.section, order: sf.order, blocks });
  }

  for (const ex of EXTRA_BLOCKS) {
    sections.push({
      title: ex.section,
      order: 10,
      blocks: ex.blocks.map((b) => ({
        name: '', sub: '', title: b.title,
        lines: b.lines.map((l) => ({ ...l, inner: false, options: [], isHint: false })),
      })),
    });
  }

  sections.sort((a, b) => a.order - b.order);
  return sections;
}

// ═════════════════════════ HTML 生成 ═════════════════════════

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLineHTML(line, idx, voices) {
  const isScene = line.speaker === '' && /^（/.test(line.text);
  const color = SPEAKER_COLORS[line.speaker] || (line.speaker === '' ? '#999999' : '#dddddd');
  const voiceBtns = voices.length
    ? voices
        .map(
          (v, vi) =>
            `<button class="play" data-src="${esc(v.url)}" title="${esc(v.file)}">▶ ${voices.length > 1 ? vi + 1 : ''}</button>`,
        )
        .join('')
    : '';
  const badges = [];
  if (line.inner) badges.push('<span class="badge inner">内心独白</span>');
  if (line.isHint) badges.push('<span class="badge hint">操作提示</span>');

  let html = `<div class="line" data-speaker="${esc(line.speaker)}" data-text="${esc(line.text)}" data-voiced="${voices.length ? '1' : '0'}">`;
  html += `<div class="line-head"><span class="idx">${idx}</span>`;
  if (line.speaker) {
    html += `<span class="speaker" style="color:${color};border-color:${color}55">${esc(line.speaker)}</span>`;
  } else {
    html += `<span class="speaker scene">旁白</span>`;
  }
  html += badges.join('') + voiceBtns + '</div>';
  html += `<div class="line-text${line.options.length ? ' opt' : ''}">${esc(line.text) || ''}</div>`;
  if (line.options.length) {
    html += '<div class="options">' + line.options.map((o) => `<span class="opt-item">${esc(o)}</span>`).join('') + '</div>';
  }
  html += '</div>';
  return html;
}

function renderBlockHTML(block) {
  const title = block.title || LABELS[block.name] || block.name || '（未命名）';
  const sub = block.sub ? `<span class="subkey">${esc(subLabel(block.sub))}</span>` : '';
  let body = '';
  let voiced = 0;
  block.lines.forEach((line, i) => {
    const voices = matchVoices(line, VOICE_ENTRIES);
    if (voices.length) voiced += 1;
    body += renderLineHTML(line, i + 1, voices);
  });
  return `<section class="block"><h3>${esc(title)}${sub}<span class="count">${block.lines.length} 句${voiced ? ` / 配音 ${voiced}` : ''}</span></h3><div class="lines">${body}</div></section>`;
}

function subLabel(key) {
  const map = {
    try_stay: '分支一 · 留下来',
    unknown: '分支二 · 弄清楚爷爷',
    tonight: '分支三 · 还没想好',
    elder: '村长',
    shopkeeper: '商店老板',
    miner: '矿工老张',
    gardener: '花匠小梅',
    adventurer: '阿风',
    carpenter: '木匠老周',
    elder_morning: '村长晨间问候',
    elder_garden_complete: '村长评价花园',
    xiya_afternoon: '夏雅午后散步',
    xiya_old_house: '夏雅回忆老屋',
    gardener_flower: '小梅照料花圃',
    miner_morning: '老张出发挖矿',
    adventurer_forest: '阿风后山探险',
    adventurer_logbook: '阿风借出冒险日志',
  };
  return map[key] || key;
}

function renderCatalogHTML() {
  // 统计所有已匹配到台词的音频
  const matched = new Set();
  const sections = buildSections();
  for (const sec of sections) {
    for (const blk of sec.blocks) {
      for (const line of blk.lines) {
        for (const v of matchVoices(line, VOICE_ENTRIES)) matched.add(v.url);
      }
    }
  }
  const all = listOggFiles();
  const orphan = all.filter((f) => !matched.has('audio/voice_normalized/' + f));
  if (orphan.length === 0) return '';
  const items = orphan
    .map(
      (f) =>
        `<div class="line"><div class="line-head"><span class="idx">·</span><span class="speaker scene">未匹配</span><button class="play" data-src="${esc('audio/voice_normalized/' + f)}">▶</button></div><div class="line-text mono">${esc(f)}</div></div>`,
    )
    .join('');
  return `<section class="block"><h3>未匹配到当前台词的语音文件（旧版录音 / 已生成未接入）<span class="count">${orphan.length} 条</span></h3><div class="lines">${items}</div></section>`;
}

// ═════════════════════════ 主流程 ═════════════════════════

const VOICE_ENTRIES = loadVoiceEntries();
const sections = buildSections();

let totalLines = 0;
let voicedLines = 0;
let speakerSet = new Set();
for (const sec of sections) {
  for (const blk of sec.blocks) {
    for (const line of blk.lines) {
      totalLines += 1;
      if (line.speaker) speakerSet.add(line.speaker);
      if (matchVoices(line, VOICE_ENTRIES).length) voicedLines += 1;
    }
  }
}

const speakers = [...speakerSet].sort();
const speakersHTML = speakers
  .map((s) => `<option value="${esc(s)}">${esc(s)}</option>`)
  .join('');

const body = sections
  .map(
    (sec) =>
      `<section class="section"><h2>${esc(sec.title)}</h2>${sec.blocks.map(renderBlockHTML).join('')}</section>`,
  )
  .join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>《归星物语》全剧情台本 · 配音试听</title>
<style>
  :root { --bg:#0d1526; --panel:#131e33; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:"Microsoft YaHei","PingFang SC",sans-serif; background:linear-gradient(180deg,#0b1220 0%,#101a2e 100%); color:#dbe6f5; min-height:100vh; }
  header { position:sticky; top:0; z-index:10; background:rgba(11,18,32,.92); backdrop-filter:blur(6px); border-bottom:1px solid #223; padding:14px 20px; }
  header h1 { margin:0 0 6px; font-size:19px; color:#e8d8a8; letter-spacing:2px; }
  .stats { display:flex; flex-wrap:wrap; gap:8px 18px; font-size:12px; color:#9fb0c8; }
  .stats b { color:#f0d080; font-weight:600; }
  .toolbar { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
  .toolbar input, .toolbar select { background:#0b1220; color:#dbe6f5; border:1px solid #2a3a55; border-radius:6px; padding:5px 9px; font-size:13px; }
  .toolbar label { display:flex; align-items:center; gap:5px; font-size:13px; color:#9fb0c8; cursor:pointer; }
  main { max-width: 860px; margin:0 auto; padding:18px 16px 80px; }
  .section { margin-bottom:26px; }
  .section > h2 { font-size:15px; color:#f0d080; border-left:3px solid #f0d080; padding-left:9px; margin:26px 0 10px; letter-spacing:1px; }
  .block { background:var(--panel); border:1px solid #1d2b45; border-radius:10px; padding:12px 14px; margin-bottom:14px; }
  .block h3 { margin:0 0 8px; font-size:13px; color:#b9c8e0; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .block h3 .count { font-size:11px; color:#6d7f9c; font-weight:400; }
  .block h3 .subkey { font-size:11px; color:#8ac8a0; background:#12331f; padding:1px 7px; border-radius:10px; }
  .lines { display:flex; flex-direction:column; }
  .line { display:flex; flex-direction:column; gap:3px; padding:7px 4px; border-bottom:1px dashed #1c2b44; }
  .line:last-child { border-bottom:none; }
  .line-head { display:flex; align-items:center; gap:8px; min-height:26px; }
  .idx { width:22px; font-size:11px; color:#4d5f7c; text-align:right; flex:none; }
  .speaker { font-size:12px; font-weight:700; border:1px solid; border-radius:4px; padding:0 7px; line-height:19px; background:rgba(255,255,255,.04); }
  .speaker.scene { color:#7d8da8 !important; border-color:#33425f !important; }
  .badge { font-size:10px; border-radius:8px; padding:1px 7px; color:#0b1220; }
  .badge.inner { background:#b8a0e8; }
  .badge.hint { background:#7d8da8; }
  .play { flex:none; width:28px; height:22px; border:none; border-radius:5px; background:#f0a050; color:#1a120a; font-size:12px; cursor:pointer; transition:filter .15s; }
  .play:hover { filter:brightness(1.15); }
  .play.playing { background:#7ed88a; }
  .line-text { font-size:14px; line-height:1.7; padding-left:30px; color:#dfe9f8; }
  .line-text.opt { color:#9aa9c2; }
  .line-text.mono { font-size:12px; color:#7d8da8; font-family:Consolas,monospace; }
  .options { display:flex; flex-wrap:wrap; gap:7px; padding-left:30px; margin-top:3px; }
  .opt-item { font-size:12px; color:#0b1220; background:#e8d8a8; border-radius:10px; padding:2px 10px; }
  .footer { text-align:center; color:#4d5f7c; font-size:11px; padding:18px 0 30px; }
  .hidden { display:none !important; }
</style>
</head>
<body>
<header>
  <h1>《归星物语》全剧情台本 · 配音试听</h1>
  <div class="stats">
    <span>台词 <b>${totalLines}</b> 句</span>
    <span>有配音 <b>${voicedLines}</b> 句</span>
    <span>配音覆盖 <b>${totalLines ? Math.round((voicedLines / totalLines) * 100) : 0}%</b></span>
    <span>语音文件 <b>${listOggFiles().length}</b> 个</span>
    <span>生成时间 ${new Date().toLocaleString('zh-CN')}</span>
  </div>
  <div class="toolbar">
    <select id="speaker-filter"><option value="">全部角色</option>${speakersHTML}</select>
    <input id="text-search" type="text" placeholder="搜索台词文本…" />
    <label><input id="voiced-only" type="checkbox" /> 仅显示有配音</label>
    <label><input id="hide-hint" type="checkbox" checked /> 隐藏操作提示</label>
  </div>
</header>
<main>
${body}
${renderCatalogHTML()}
<div class="footer">由 tools/gen_story_webpage.mjs 自动生成 · 语音匹配逻辑与游戏 VoiceBank 一致</div>
</main>
<script>
(function () {
  var audio = null;
  function play(url, btn) {
    if (audio) { audio.pause(); audio = null; }
    document.querySelectorAll('.play.playing').forEach(function (b) { b.classList.remove('playing'); });
    var a = new Audio(url);
    audio = a;
    if (btn) btn.classList.add('playing');
    a.play().catch(function () {});
    a.onended = function () { if (btn) btn.classList.remove('playing'); audio = null; };
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.play');
    if (btn) play(btn.getAttribute('data-src'), btn);
  });
  var spk = document.getElementById('speaker-filter');
  var txt = document.getElementById('text-search');
  var voiced = document.getElementById('voiced-only');
  var hideHint = document.getElementById('hide-hint');
  function apply() {
    var q = txt.value.trim().toLowerCase();
    document.querySelectorAll('.line').forEach(function (li) {
      var show = true;
      if (spk.value && li.getAttribute('data-speaker') !== spk.value) show = false;
      if (voiced.checked && li.getAttribute('data-voiced') !== '1') show = false;
      if (q && li.getAttribute('data-text').toLowerCase().indexOf(q) < 0) show = false;
      if (hideHint.checked && li.querySelector('.badge.hint')) show = false;
      li.classList.toggle('hidden', !show);
    });
    // 折叠空块
    document.querySelectorAll('.block').forEach(function (blk) {
      var any = false;
      blk.querySelectorAll(':scope > .lines > .line').forEach(function (li) {
        if (!li.classList.contains('hidden')) any = true;
      });
      blk.classList.toggle('hidden', !any);
    });
    document.querySelectorAll('.section').forEach(function (sec) {
      var any = false;
      sec.querySelectorAll(':scope > .block').forEach(function (blk) {
        if (!blk.classList.contains('hidden')) any = true;
      });
      sec.classList.toggle('hidden', !any);
    });
  }
  spk.addEventListener('change', apply);
  txt.addEventListener('input', apply);
  voiced.addEventListener('change', apply);
  hideHint.addEventListener('change', apply);
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(`✅ 已生成：${path.relative(ROOT, OUT)}`);
console.log(`   台词 ${totalLines} 句（含选项行），有配音 ${voicedLines} 句，角色 ${speakers.length} 位，语音文件 ${listOggFiles().length} 个`);
