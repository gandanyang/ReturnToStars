/**
 * Animagine XL 4.0 立绘测试出图
 * 用法：node tools/comfy_animagine_test.mjs [seed]
 * 读 workflow/animagineXL40_portrait.json，注入正向提示词，提交 ComfyUI，下载到 tmp/animagine_test/
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const COMFY_URL = 'http://127.0.0.1:8188';
const WF = JSON.parse(readFileSync('workflow/animagineXL40_portrait.json', 'utf-8'));
const OUT_DIR = 'tmp/animagine_test';
mkdirSync(OUT_DIR, { recursive: true });

// 正向提示词（夏雅，Animagine XL 4.0 danbooru 标签风格）
const POSITIVE =
  'masterpiece, best quality, very aesthetic, absurdres, 1girl, solo, ' +
  'orange hair, medium hair, hair clip, warm bright smile, brown eyes, ' +
  'open short jacket, white shirt, canvas shoulder bag, small wrench, ' +
  'countryside, farm, green field, gentle sunlight, blue sky, ' +
  'upper body, looking at viewer, depth of field';

const seed = parseInt(process.argv[2]) || Math.floor(Math.random() * 1e15);

async function api(path, method = 'POST', body) {
  const r = await fetch(COMFY_URL + path, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { _raw: text, _status: r.status }; }
}

(async () => {
  const wf = JSON.parse(JSON.stringify(WF));
  wf['3'].inputs.text = POSITIVE;
  wf['5'].inputs.seed = seed;
  console.log(`提交 seed=${seed} ...`);

  const submit = await api('/prompt', 'POST', { prompt: wf });
  if (!submit.prompt_id) {
    console.error('提交失败:', JSON.stringify(submit).slice(0, 500));
    process.exit(1);
  }
  const pid = submit.prompt_id;
  console.log(`prompt_id=${pid}`);

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
          const file = `${OUT_DIR}/xiya_animagine_${seed}.png`;
          writeFileSync(file, buf);
          console.log(`✅ saved ${file} (${buf.length} bytes)`);
          process.exit(0);
        }
      }
    } else if (status === 'error') {
      console.error('❌ 出图失败:', JSON.stringify(hist[pid].status).slice(0, 800));
      process.exit(1);
    }
    if (i % 10 === 0) process.stdout.write('.');
  }
  console.error('\n超时');
  process.exit(1);
})();
