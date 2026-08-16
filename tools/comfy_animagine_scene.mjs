/**
 * Animagine XL 4.0 场景美术出图
 * 用法：node tools/comfy_animagine_scene.mjs [场景key1,key2,...]
 * 读 workflow/animagineXL40_portrait.json 骨架，注入场景提示词 + 横版尺寸，提交 ComfyUI，下载到 tmp/animagine_scene/
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const COMFY_URL = 'http://127.0.0.1:8188';
const WF = JSON.parse(readFileSync('workflow/animagineXL40_portrait.json', 'utf-8'));
const OUT_DIR = 'tmp/animagine_scene';
mkdirSync(OUT_DIR, { recursive: true });

const NEG =
  'nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name, people, person, human, girl, boy, character';

const SCENES = {
  lighthouse_night: {
    positive:
      'masterpiece, best quality, very aesthetic, absurdres, scenery, no humans, night, starry sky, milky way, many stars, shooting star, lighthouse, island, sea, ocean, small village, houses, warm window lights, harbor, moonlight, reflection on water, distant view, wide shot, serene, peaceful, beautiful, atmospheric',
    width: 1216, height: 832,
  },
  farm_dusk: {
    positive:
      'masterpiece, best quality, very aesthetic, absurdres, scenery, no humans, wheat field, golden hour, sunset, dusk, farm, farmhouse, windmill, rural, countryside, warm light, clouds, dirt path, distant hills, wide shot, peaceful, cozy, atmospheric',
    width: 1216, height: 832,
  },
  town_street: {
    positive:
      'masterpiece, best quality, very aesthetic, absurdres, scenery, no humans, small town street, cobblestone road, wooden houses, flower pots, warm afternoon light, blue sky, white clouds, rural village, shop signs, cozy, peaceful, wide shot, atmospheric',
    width: 1216, height: 832,
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
  const cfg = SCENES[key];
  if (!cfg) { console.error(`未知场景: ${key}`); return; }
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
  if (keys.length === 0) keys = ['lighthouse_night', 'farm_dusk'];
  for (const k of keys) {
    await genOne(k);
  }
  process.exit(0);
})();
