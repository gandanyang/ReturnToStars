/**
 * 主角林澈 4 方向站立像素图（Animagine XL 4.0）
 * 用法：node tools/comfy_linche_dirs.mjs [front,back,left,right]
 * 下载到 tmp/animagine_dirs/
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const COMFY_URL = 'http://127.0.0.1:8188';
const WF = JSON.parse(readFileSync('workflow/animagineXL40_portrait.json', 'utf-8'));
const OUT_DIR = 'tmp/animagine_dirs';
mkdirSync(OUT_DIR, { recursive: true });

const BASE =
  'masterpiece, best quality, very aesthetic, absurdres, pixel art, 8-bit, chunky pixels, large visible pixels, low resolution, retro game, game character sprite, 1boy, solo, full body, standing, short dark brown hair, calm expression, casual shirt, jeans, stardew valley inspired, hard pixel edges, limited color palette, clean readable silhouette, no gradients, pure black background, centered, character fills frame, full body head to feet';

const NEG =
  'nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name, smooth, airbrush, gradient, 3d, realistic, photo';

const DIRS = {
  front: BASE + ', front view, facing viewer',
  back: BASE + ', from behind, back view, seen from back',
  left: BASE + ', side view, facing left, profile',
  right: BASE + ', side view, facing right, profile',
};

async function api(path, method = 'POST', body) {
  const r = await fetch(COMFY_URL + path, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { _raw: text, _status: r.status }; }
}

async function genOne(key) {
  const wf = JSON.parse(JSON.stringify(WF));
  wf['2'].inputs.text = NEG;
  wf['3'].inputs.text = DIRS[key];
  wf['4'].inputs.width = 512;
  wf['4'].inputs.height = 512;
  const seed = Math.floor(Math.random() * 1e15);
  wf['5'].inputs.seed = seed;

  const submit = await api('/prompt', 'POST', { prompt: wf });
  if (!submit.prompt_id) { console.error(`[${key}] 提交失败:`, JSON.stringify(submit).slice(0, 400)); return; }
  const pid = submit.prompt_id;
  console.log(`[${key}] seed=${seed} prompt_id=${pid}`);

  for (let i = 0; i < 200; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const hist = await api(`/history/${pid}`, 'GET');
    if (!hist[pid]) continue;
    const status = hist[pid].status?.status_str;
    if (status === 'success') {
      for (const out of Object.values(hist[pid].outputs)) {
        if (out.images) {
          const img = out.images[0];
          const res = await fetch(`${COMFY_URL}/view?filename=${img.filename}&subfolder=${img.subfolder ?? ''}&type=output`);
          const buf = Buffer.from(await res.arrayBuffer());
          const file = `${OUT_DIR}/${key}_${seed}.png`;
          writeFileSync(file, buf);
          console.log(`[${key}] ✅ ${file} (${buf.length} bytes)`);
          return;
        }
      }
    } else if (status === 'error') {
      console.error(`[${key}] ❌`, JSON.stringify(hist[pid].status).slice(0, 600));
      return;
    }
    if (i % 10 === 0) process.stdout.write('.');
  }
  console.error(`[${key}] 超时`);
}

(async () => {
  const keys = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const list = keys.length ? keys : ['front', 'back', 'left', 'right'];
  for (const k of list) await genOne(k);
  process.exit(0);
})();
