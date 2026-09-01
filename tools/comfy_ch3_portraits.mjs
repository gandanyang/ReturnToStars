/**
 * tools/comfy_ch3_portraits.mjs — 第三章角色立绘生成（ComfyUI anima_turboV10）
 *
 * 生成：陈叔 / 张先生（张远）/ 老船长 — 512×512 立绘 → webp → 接入 StoryDialogue PORTRAIT_MAP
 * 用法：node tools/comfy_ch3_portraits.mjs [--dry-run]
 * 依赖：本地 ComfyUI 运行在 127.0.0.1:8188
 * 输出：public/assets/portraits/chen_ai.webp / zhang_ai.webp / captain_ai.webp
 */
import { readFileSync, writeFileSync } from 'fs';

const COMFY_URL = 'http://127.0.0.1:8188';
const WF = JSON.parse(readFileSync('workflow/anima_turboV10.json', 'utf-8'));
const OUT_DIR = 'public/assets/portraits';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const PORTRAITS = {
  chen: {
    file: 'chen_ai.webp',
    prompt: 'Portrait of an elderly lighthouse keeper in his 60s, weathered kind face with deep smile lines, short grey hair and light stubble, wearing a simple dark blue work jacket with a collared shirt underneath, looking slightly to the side with a calm and steady expression, soft warm lighting from a window, upper body portrait, anime illustration style, muted warm color palette, clean background, masterpiece, best quality',
  },
  zhang: {
    file: 'zhang_ai.webp',
    prompt: 'Portrait of a young man in his early 30s, short neat dark hair, clean shaven, wearing a casual olive green jacket over a white t-shirt, a vintage camera hanging from a neck strap, looking at the viewer with a curious and friendly half-smile, soft natural lighting, upper body portrait, anime illustration style, muted warm color palette, clean background, masterpiece, best quality',
  },
  captain: {
    file: 'captain_ai.webp',
    prompt: 'Portrait of an old sea captain in his 70s, deeply weathered face with age spots and wrinkles, short white beard, wearing a worn navy blue captain cap and a thick grey sweater, holding an unlit pipe, looking forward with a hard but not unkind expression, soft overcast lighting, upper body portrait, anime illustration style, muted cool color palette, clean background, masterpiece, best quality',
  },
};

async function api(path, method = 'POST', body) {
  const r = await fetch(COMFY_URL + path, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { _raw: text, _status: r.status }; }
}

async function genOne(name, promptText, outFile) {
  const wf = JSON.parse(JSON.stringify(WF));
  wf['20'].inputs.value = promptText;
  wf['5'].inputs.value = 512;
  wf['6'].inputs.value = 512;
  wf['16'].inputs.seed = 42;
  wf['22'].inputs.filename_prefix = `ch3_portrait_${name}`;

  if (dryRun) {
    console.log(`[dry-run] ${name}: ${promptText.slice(0, 80)}...`);
    return true;
  }

  const { prompt_id } = await api('/prompt', 'POST', { prompt: wf });
  if (!prompt_id) {
    console.error(`[${name}] 提交失败`);
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
            // 保存 PNG → 转 WebP（用 sharp 或直接保存 PNG 然后手动转）
            const pngFile = outFile.replace('.webp', '_raw.png');
            writeFileSync(pngFile, buf);
            console.log(`[${name}] saved ${pngFile} (${buf.length} bytes)`);
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
for (const [name, config] of Object.entries(PORTRAITS)) {
  results[name] = await genOne(name, config.prompt, config.file);
}

console.log('\n=== 立绘生成结果 ===');
for (const [name, ok] of Object.entries(results)) {
  console.log(`  ${name}: ${ok ? '✅' : '❌'}`);
}
console.log('\n下一步：PNG → WebP 转换（npx sharp-cli 或 Python PIL）→ 接入 StoryDialogue PORTRAIT_MAP');
process.exit(Object.values(results).some(r => !r) ? 1 : 0);
