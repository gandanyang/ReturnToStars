/**
 * 主角林澈 多用途出图（Animagine XL 4.0）
 * 用法：node tools/comfy_linche_variants.mjs [key1,key2,...]
 * 半身头像 / 全身设定 / 像素sprite 三种，同一套外貌设定，下载到 tmp/animagine_linche/
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const COMFY_URL = 'http://127.0.0.1:8188';
const WF = JSON.parse(readFileSync('workflow/animagineXL40_portrait.json', 'utf-8'));
const OUT_DIR = 'tmp/animagine_linche';
mkdirSync(OUT_DIR, { recursive: true });

// 林澈统一外貌：27岁前程序员→回村接手庄园，深棕短发微乱、温和疲惫眼神、平静内敛
const LOOK =
  '1boy, solo, 27 years old, short dark brown hair, slightly messy hair, gentle tired eyes, calm reserved expression, warm fair skin, casual shirt, light outdoor jacket, jeans';

const NEG =
  'nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name';

const VARIANTS = {
  linche_half: {
    positive:
      'masterpiece, best quality, very aesthetic, absurdres, ' + LOOK +
      ', upper body, looking at viewer, soft afternoon light, rural village background, green field, 2d anime game portrait, clean cel shading, painterly detail, warm and inviting',
    width: 832, height: 1216,
  },
  linche_full: {
    positive:
      'masterpiece, best quality, very aesthetic, absurdres, ' + LOOK +
      ', full body, standing, small backpack, standing in front of a farmhouse, green field, blue sky, white clouds, soft sunlight, 2d anime game character, clean cel shading, full body, game character design sheet',
    width: 832, height: 1216,
  },
  linche_pixel: {
    positive:
      'masterpiece, best quality, very aesthetic, absurdres, pixel art, 16-bit, retro game, game character sprite, ' + LOOK +
      ', small backpack, stardew valley inspired, hard pixel edges, limited color palette, clean readable silhouette, subtle shading, no gradients, pure black background, centered, front view, full body head to feet',
    width: 1024, height: 1024,
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

async function genOne(key) {
  const cfg = VARIANTS[key];
  if (!cfg) { console.error(`未知: ${key}`); return; }
  const wf = JSON.parse(JSON.stringify(WF));
  wf['2'].inputs.text = NEG;
  wf['3'].inputs.text = cfg.positive;
  wf['4'].inputs.width = cfg.width;
  wf['4'].inputs.height = cfg.height;
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
  let keys = process.argv.slice(2).filter(a => !a.startsWith('-'));
  if (keys.length === 0) keys = ['linche_half', 'linche_full', 'linche_pixel'];
  for (const k of keys) await genOne(k);
  process.exit(0);
})();
