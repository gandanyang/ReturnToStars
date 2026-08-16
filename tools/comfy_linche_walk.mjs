/**
 * 主角林澈 4 朝向像素行走图生成（anima turboV10 工作流）
 * 用法：node tools/comfy_linche_walk.mjs [--dry-run] [--dirs front,back,left,right]
 * 读取 workflow/anima_turboV10.json，注入主体 prompt 到节点 20，保存到 assets/linche_raw/
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const COMFY_URL = 'http://127.0.0.1:8188';
const WF = JSON.parse(readFileSync('workflow/anima_turboV10.json', 'utf-8'));
const OUT_DIR = 'assets/linche_raw';
mkdirSync(OUT_DIR, { recursive: true });

// 林澈统一外貌（对齐既有 LOOK）：27 岁前程序员→回村接手庄园，深棕短发微乱、温和疲惫、平静内敛
const LOOK =
  '1boy, solo, 27 years old, short dark brown hair, slightly messy hair, gentle tired eyes, calm reserved expression, warm fair skin, casual shirt, light outdoor jacket, jeans';

// 像素风基础（正常比例全身，细长身形 → 适合 32x48 帧）
const PIXEL =
  'pixel art, 16-bit, retro game, game character sprite, full body head to feet, normal body proportions, natural upright slim figure, standing straight, idle stance, stardew valley style, hard pixel edges, limited color palette, clean readable silhouette, no gradients, pure black background, centered';

const DIRS = {
  front: LOOK + ', ' + PIXEL + ', front view, facing viewer, arms relaxed at sides',
  back: LOOK + ', ' + PIXEL + ', from behind, back view, seen from back',
  side: LOOK + ', ' + PIXEL + ', left side view, facing left, natural profile, standing straight, arms at sides',
};

const NEG = 'nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, smooth, airbrush, gradient, 3d, realistic, photo, multiple people';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dirsArg = args.find((a) => a.startsWith('--dirs'));
const dirs = dirsArg ? dirsArg.split('=')[1].split(',') : Object.keys(DIRS);

async function api(path, method = 'POST', body) {
  const r = await fetch(COMFY_URL + path, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { _raw: text, _status: r.status }; }
}

async function genOne(name, positive) {
  const wf = JSON.parse(JSON.stringify(WF));
  // 正面 prompt：节点 20 填主体，质量前缀由节点 14 提供；负面用节点 2
  wf['20'].inputs.value = positive;
  wf['2'].inputs.text = NEG;
  wf['5'].inputs.value = 768;
  wf['6'].inputs.value = 768;
  wf['16'].inputs.seed = Math.floor(Math.random() * 1e15);
  if (dryRun) {
    console.log(`[dry-run] ${name}: ${JSON.stringify(positive).slice(0, 90)}...`);
    return;
  }
  const submit = await api('/prompt', 'POST', { prompt: wf });
  if (!submit.prompt_id) { console.error(`[${name}] 提交失败:`, JSON.stringify(submit).slice(0, 300)); return; }
  console.log(`[${name}] prompt_id=${submit.prompt_id} 等待...`);
  for (let i = 0; i < 160; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const hist = await api(`/history/${submit.prompt_id}`, 'GET');
    if (hist[submit.prompt_id]) {
      const status = hist[submit.prompt_id].status.status_str;
      if (status === 'success') {
        const outputs = hist[submit.prompt_id].outputs;
        for (const out of Object.values(outputs)) {
          if (out.images) {
            const img = out.images[0];
            const res = await fetch(`${COMFY_URL}/view?filename=${img.filename}&subfolder=${img.subfolder ?? ''}&type=output`);
            const buf = Buffer.from(await res.arrayBuffer());
            const file = `${OUT_DIR}/linche_${name}.png`;
            writeFileSync(file, buf);
            console.log(`[${name}] 已保存 ${file}`);
          }
        }
        return;
      } else if (status === 'error') {
        console.error(`[${name}] 生成失败`, JSON.stringify(hist[submit.prompt_id].status).slice(0, 300));
        return;
      }
    }
  }
  console.error(`[${name}] 超时`);
}

for (const d of dirs) {
  if (!DIRS[d]) { console.error(`未知朝向: ${d}`); continue; }
  await genOne(d, DIRS[d]);
}
console.log('全部完成');
