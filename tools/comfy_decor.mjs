/**
 * ComfyUI 出图（anima turboV10）— 镇子杂物 sprite 批量生成
 * 用法：node tools/comfy_decor.mjs [--dry-run] [--prompt-index N]
 * 读取 workflow/anima_turboV10.json，注入画面描述到节点 20，保存到 assets/decor_raw/
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const COMFY_URL = 'http://127.0.0.1:8188';
const WF = JSON.parse(readFileSync('workflow/anima_turboV10.json', 'utf-8'));
const OUT_DIR = 'assets/decor_raw';
mkdirSync(OUT_DIR, { recursive: true });

// 杂物 prompt（对应 prompts/decor_*.txt，转为动漫插画描述 + 像素提示词）
const PROMPTS = {
  woodpile: 'A small neat stack of firewood logs, three round wood logs stacked in a pile, warm brown bark, visible round end-cuts, small sticks leaning beside, rural village life, cozy, isolated single object, centered, plain dark background',
  pot: 'A small terracotta flower pot with a blooming plant, warm brown clay pot, green leaves, soft pink and pale yellow flowers, gently tended, rural village life, isolated single object, centered, plain dark background',
  bucket: 'A simple metal bucket, rounded grey-blue metal with a wire handle, slightly worn, a small patch of rust, standing upright, empty, rural village life, isolated single object, centered, plain dark background',
  crate: 'A small wooden storage crate, square wooden box, warm brown planks with grain lines and diagonal cross brace, slightly worn corners, the crate is small and centered with plenty of empty dark background space around it, clearly separated from the background, rural village life, isolated single object, centered, plain solid dark background',
  clothesline: 'A small rural clothesline drying rack, two wooden posts with a line, a light blue shirt and soft pink cloth and small white cloth hanging, homey and warm, rural village life, isolated single object, centered, plain dark background',
  cart: 'A small wooden wheelbarrow, wooden trough body on one wheel, tall handle, warm brown wood, resting on ground, garden tool, rural village life, isolated single object, centered, plain dark background',
  stool: 'A small round stone stool garden seat, flat smooth grey stone on smaller base stone, soft rounded shape, weathered, rural village life, isolated single object, centered, plain dark background',
  broom: 'A simple wooden broom standing upright, long wooden handle with spread straw bristles at bottom, warm brown handle tan bristles, rural village life, isolated single object, centered, plain dark background',
  rock: 'A small rounded natural river stone, smooth grey stone with gentle highlights and soft shadow, a bit mossy on one side, weathered, natural rock, isolated single object, centered, plain dark background',
  grass: 'A small clump of grass tufts, several warm green blades growing together, lighter tips, natural and simple, isolated single object, centered, plain dark background',
  fg_grass: 'A dense patch of tall grass blades with a few soft broad leaves, layered and overlapping, deep green in front lighter behind, lush foreground grass, isolated single object, centered, plain dark background',
};

// anima turbo 质量前缀（节点14 默认已含）
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyIdx = args.indexOf('--prompt-index');
const onlyN = onlyIdx >= 0 ? parseInt(args[onlyIdx + 1]) : -1;

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
  // 宽高：像素资产用方形（便于抠图）
  wf['5'].inputs.value = 1024;
  wf['6'].inputs.value = 1024;
  // 固定种子（可重复）
  wf['16'].inputs.seed = Math.floor(Math.random() * 1e15);
  if (dryRun) {
    console.log(`[dry-run] ${name}: 将提交 ${JSON.stringify(wf['20'].inputs.value).slice(0, 60)}...`);
    return;
  }
  const { prompt_id } = await api('/prompt', 'POST', { prompt: wf });
  console.log(`[${name}] prompt_id=${prompt_id}`);
  // 轮询（GET history）
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const hist = await api(`/history/${prompt_id}`, 'GET');
    if (hist[prompt_id]) {
      const status = hist[prompt_id].status.status_str;
      if (status === 'success') {
        const outputs = hist[prompt_id].outputs;
        // 找 SaveImage 输出
        for (const out of Object.values(outputs)) {
          if (out.images) {
            const img = out.images[0];
            // 下载
            const res = await fetch(`${COMFY_URL}/view?filename=${img.filename}&subfolder=${img.subfolder ?? ''}&type=output`);
            const buf = Buffer.from(await res.arrayBuffer());
            const file = `${OUT_DIR}/${name}.png`;
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
  console.error(`[${name}] timeout`);
  return false;
}

(async () => {
  const names = Object.keys(PROMPTS);
  if (onlyN >= 0) {
    await genOne(names[onlyN], PROMPTS[names[onlyN]]);
  } else {
    for (const name of names) {
      await genOne(name, PROMPTS[name]);
    }
  }
  process.exit(0);
})();
