/**
 * tools/comfy_ch3_npcs.mjs — 第三章 NPC sprite 生成（ComfyUI anima_turboV10）
 *
 * 生成：陈叔（守灯人）+ 张先生（旅人/记录者）32x32 NPC sprite
 * 用法：node tools/comfy_ch3_npcs.mjs [--dry-run]
 * 依赖：本地 ComfyUI 运行在 127.0.0.1:8188
 * 输出：assets/ch3_raw/{chen,zhang}_raw.png（1024x1024 原始）
 *       → 后处理缩至 32x32 → public/assets/sprites/npc_chen.png / npc_zhang.png
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const COMFY_URL = 'http://127.0.0.1:8188';
const WF = JSON.parse(readFileSync('workflow/anima_turboV10.json', 'utf-8'));
const OUT_DIR = 'assets/ch3_raw';
const SPRITE_DIR = 'public/assets/sprites';
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(SPRITE_DIR, { recursive: true });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const PROMPTS = {
  chen: 'An elderly lighthouse keeper in his 60s, short grey hair, weathered kind face, wearing a simple dark blue work uniform with rolled up sleeves, holding a small brass oil lamp, calm and steady expression, full body standing pose facing forward, simple white background, anime style, clean flat colors, chibi proportions, game sprite',
  zhang: 'A young man in his early 30s, short dark hair, wearing a casual olive green jacket over a white shirt and dark trousers, carrying a vintage camera hanging from a neck strap, curious friendly expression, full body standing pose facing forward, simple white background, anime style, clean flat colors, chibi proportions, game sprite',
};

async function api(path, method = 'POST', body) {
  const r = await fetch(COMFY_URL + path, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { _raw: text, _status: r.status }; }
}

async function genOne(name, promptText) {
  const wf = JSON.parse(JSON.stringify(WF));
  wf['20'].inputs.value = promptText;
  wf['5'].inputs.value = 1024;
  wf['6'].inputs.value = 1024;
  wf['16'].inputs.seed = 42;
  wf['22'].inputs.filename_prefix = `ch3_${name}`;

  if (dryRun) {
    console.log(`[dry-run] ${name}: ${promptText.slice(0, 80)}...`);
    return true;
  }

  const { prompt_id } = await api('/prompt', 'POST', { prompt: wf });
  if (!prompt_id) {
    console.error(`[${name}] 提交失败:`, JSON.stringify(arguments[2] || {}).slice(0, 200));
    return false;
  }
  console.log(`[${name}] prompt_id=${prompt_id}`);

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const hist = await api(`/history/${prompt_id}`, 'GET');
    if (hist[prompt_id]) {
      const status = hist[prompt_id].status?.status_str;
      if (status === 'success') {
        const outputs = hist[prompt_id].outputs;
        for (const out of Object.values(outputs)) {
          if (out.images) {
            const img = out.images[0];
            const res = await fetch(`${COMFY_URL}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`);
            const buf = Buffer.from(await res.arrayBuffer());
            const file = `${OUT_DIR}/${name}_raw.png`;
            writeFileSync(file, buf);
            console.log(`[${name}] saved ${file} (${buf.length} bytes)`);
            return true;
          }
        }
      } else if (status === 'error') {
        console.error(`[${name}] ERROR:`, JSON.stringify(hist[prompt_id].status).slice(0, 200));
        return false;
      }
    }
  }
  console.error(`[${name}] 超时`);
  return false;
}

// 主流程
const results = {};
for (const [name, prompt] of Object.entries(PROMPTS)) {
  results[name] = await genOne(name, prompt);
}

console.log('\n=== ch3 NPC 生成结果 ===');
for (const [name, ok] of Object.entries(results)) {
  console.log(`  ${name}: ${ok ? '✅' : '❌'}`);
}

// 提示后处理
const okCount = Object.values(results).filter(Boolean).length;
if (okCount > 0 && !dryRun) {
  console.log(`\n下一步：用 Python PIL 后处理 → 32x32 sprite`);
  console.log(`  python -c "from PIL import Image; ...缩至 32x32..."`);
}
process.exit(Object.values(results).some(r => !r) ? 1 : 0);
