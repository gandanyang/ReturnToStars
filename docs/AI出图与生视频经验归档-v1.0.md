# AI 出图与生视频经验归档 v1.0

> 归档时间：2026-08-10（制作人要求：本项目所有 AI 出图/生视频前必读）
> 适用范围：GPT 生图（`tools/gpt_image_gen.mjs`）、ComfyUI MiniMax H3 视频生成
> 原则：**出图/出视频前先给制作人看原图/预览，确认后再继续**；宁可慢一步，不要白跑一条
> 配套：**视频提示词写作统一用官方 skill `h3-prompt-writing`**（`~/.codex/skills/h3-prompt-writing/`，含 `references/base-en.txt` 与 `references/ref-en.txt` 两份官方提示词指南）；旧 Hailuo 提示词指南/首尾帧库已删除（2026-08-10 由 `h3-prompt-writing` 替代）

---

## 一、总管线（制作人定稿优先级）

1. **生图**：① gpt-image-2（在线，走项目中转站，默认）→ ② ComfyUI 本地（anima turbo，备选）→ ③ 脚本像素管线
2. **生视频**：ComfyUI MiniMax H3（本机本地推理），fl2va 用于文/图生视频，ref2va 用于参考图/参考音频生视频

---

## 二、GPT 生图（tools/gpt_image_gen.mjs）

### 配置现状

- 中转站地址与 Key 在 `tools/.env`（已 .gitignore）：`OPENAI_BASE_URL` + `OPENAI_API_KEY`
- ⚠️ Key 目前是明文存在 `tools/.env`，脚本会警告；建议执行 `node tools/gpt_image_key.mjs set` 改为 DPAPI 加密存储
- 直连 `api.openai.com` 在本机网络不通（被墙），**必须走中转站**，不要另起炉灶

### 标准调用

```bash
# 先零成本预演（看接口地址与费用估算）
node tools/gpt_image_gen.mjs --dry-run "提示词"

# 真实生成（制作人批准后）
node tools/gpt_image_gen.mjs --yes --size 1344x768 --quality medium --out 输出路径.png "提示词"
```

- 常用尺寸：立绘 1024×1536 / 概念图 1344×768 / 方形 1024×1024；质量 medium 起步
- 成本参考：1344×768 medium 单张约 $0.08

### ⚠️ 问题①（制作人反馈 2026-08-10）：GPT 文字/语言理解过强

**现象**：GPT 会把角色名 `Xia Ya` 直译成中文「夏芽」（且字是错的），甚至往画面里加中文路标/文字，关键字也是错的。

**规避铁律（所有 AI 生图必须遵守）**：

1. 提示词必须显式声明角色名不翻译，例如：
   `The character name "Xia Ya" is a proper name. Do NOT translate or transcribe it into any other language or script.`
2. 提示词必须显式禁止画面文字，例如：
   `No text, no letters, no signs, no subtitles, no captions, no banners, no watermarks, no Chinese characters anywhere in the image.`
3. 把「名字」与「画面元素」分离：名字只用于角色标识，不允许作为画面内容出现。
4. 生图后必须人工/程序检查画面是否出现文字；出现任何文字（尤其中文/错误字）→ 视为不合格，重新生成或要求修复。
5. 可用 `--no-augment` 降低模型自由发挥（脚本支持）。

## 三、ComfyUI MiniMax H3 视频生成

### 0. 提示词写作（先读，再做）

写 H3 视频提示词前，先按官方 skill 流程走：

1. 识别输入模式：T2VA（纯文本）/ I2VA（首帧）/ FL2VA（首尾帧）/ L2VA（文+参考）/ Ref2VA（完整参考）
2. 基础模式（T2VA/I2VA/FL2VA）读 `~/.codex/skills/h3-prompt-writing/references/base-en.txt`
3. 完整参考模式（Ref2VA）读 `~/.codex/skills/h3-prompt-writing/references/ref-en.txt`
4. 严格保留官方提示词结构的字段名、章节顺序、标签与时间标注（`integrated_multimodal_description` / `overall_soundscape` / `non_diegetic_music`）

> 旧 Hailuo 提示词指南与首尾帧提示词库已于 2026-08-10 删除，不再使用。

### 模型区分（最容易踩坑）

| 模型 | 用途 | 说明 |
|---|---|---|
| `minimax_h3_fl2va_pruned_int8_convrot.safetensors` | 文生视频 / 图生视频（t2v / i2v） | 与 ref2va 是**不同权重**，别混用 |
| `minimax_h3_ref2va_pruned_int8_convrot.safetensors` | 参考图/参考音频生视频（r2v） | r2v 工作流必须用这个 |

配套：`qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`（文本编码器）、`minimax_h3_video_vae_fp16` + `minimax_h3_audio_vae_fp32`（双 VAE）、`minimax_h3_fl2v_lightx2v_turbo_4step_...`（Turbo LoRA）。

### API 调用方法

1. `POST http://127.0.0.1:8188/prompt`，body 为 API 格式工作流 JSON（`class_type` + `inputs`，节点间用 `["节点id", 输出序号]` 引用），返回 `prompt_id`
2. `GET /history/{prompt_id}` 轮询，`status.status_str = success/error`
3. 输出在 `F:\ComfyUI-aki-v3\ComfyUI\output\video\`

### 已验证可用的 i2v 工作流（fl2va + Turbo LoRA）

```
LoadImage(首帧) ─┐
UNETLoader(fl2va) → LoraLoaderModelOnly(turbo 1.8) → MiniMaxH3SigmaShift(12,3) ─┬→ BasicGuider
CLIPLoader(qwen3vl) ─┐                                                        └→ BasicScheduler(beta, steps, 1)
VAELoader(video vae) ─┤→ MiniMaxH3ImageToVideo(prompt/宽/高/length, first_frame) → SamplerCustomAdvanced(noise,guider,sampler,sigmas,latent)
VAELoader(audio vae) ─┘                                                              │
                                                                                      ├→ VAEDecode → CreateVideo(fps=24, audio) → SaveVideo
                                                                                      └→ VAEDecodeAudio ─┘
```

关键参数：sampler `euler`；scheduler `beta`；length 124（≈5 秒）；首帧与生成分辨率一致最佳。

### 首尾帧模式（多动作 / 长镜头推荐，2026-08-10 实测）

- **结论**：镜头里有一连串动作（如跪地 → 播种 → 覆土 → 微笑）时，单给首帧，结尾容易漂移 / 跳变 / 动作没做完
- **解法**：用首尾帧——`MiniMaxH3ImageToVideo` 自带可选 `last_frame` 输入，**不需要换节点**，给一张"末帧"图即可（首帧 = 动作起点，末帧 = 收尾状态）
- **做法**：末帧图用 gpt-image-2 文生图（同一人物 / 服装 / 场景，动作收尾状态），然后 i2v 同时接 `first_frame` + `last_frame`
- **实测**：5 秒播种镜头（首帧跪地播种 / 末帧轻抚土壤看新芽），12 步 1344×768，结尾落稳、过渡自然；耗时比单首帧略增（约 21 分钟）
- **注意**：124 帧（≈5 秒）是 H3 最短训练长度，**不要靠缩短时长**解决动作问题，用首尾帧约束
- **工作流文件**：`F:\ComfyUI-aki-v3\ComfyUI\user\default\workflows\FLF_i2v_first_last_v1.json`（`MiniMaxH3ImageToVideo` id=9，first_frame/last_frame 已接线）与 `YZ_FLF_CLEAN_v1.json`（id=24）

### 性能实测（4060 Ti 16GB，fl2va int8 + Turbo LoRA）

| 分辨率 | 步数 | 耗时 | 备注 |
|---|---|---|---|
| 864×480 | 8 | ≈ 4.5 分钟 | 偏糊 |
| 1344×768 | 12 | ≈ 18.5 分钟 | 明显更清晰，仍偏软 |

规律：分辨率翻倍 ≈ 耗时 ×4；步数 8→12 ≈ +50%。GPU 100% 满载、显存峰值约 12/16GB，无 OOM。**上限：16GB 显存不要超过 1600×900**（作者实测再高会 OOM）。

### 画质经验（制作人反馈：H3 原生输出偏糊）

MiniMax H3 原生输出本身偏软（官方样片也如此），不是显卡/参数设置错误。

**路线 A：原生质量**——1344×768（模型训练分辨率）+ 12 步，真实细节，但一条 18+ 分钟。

**路线 B（推荐，效率优先）**：快速生成（如 1216×672 + 8 步）→ 后处理锐化 + 2x 放大：

```bash
ffmpeg -i 输入.mp4 -vf "unsharp=5:5:1.2:5:5:0.6,eq=contrast=1.04:saturation=1.04,scale=2*in_w:2*in_h:flags=lanczos" \
  -c:v libx264 -crf 18 -preset medium -c:a copy 输出_锐化2x.mp4
```

7 秒出片，锐度提升明显（锐化强度可按需调低，防边缘发虚）。

### 提速选项

- ✅ **EasyCache**（ComfyUI 核心节点，零安装）：`EasyCache(model, reuse_threshold=0.02, start_percent=0.4, end_percent=0.85, verbose=false)`，作者实测 >50% 提速（有小幅质量损失）
- ❌ Sol-Attn / FirstBlockCache / Spectrum 等第三方加速：4060 Ti 上收益不确定且需 Triton/第三方包，**不建议**（工作流里这些节点保持 bypass）

### SageAttention 坑（已解决，勿再踩）

- KJNodes 的 `PathchSageAttentionKJ` / `MiniMaxH3MemoryEfficientSageAttentionPatch` 需要 `sageattention` + `triton`
- 本环境 Python 3.13 + Windows 无 triton，装了也用不了 → **直接 bypass 这两个节点**（模型走 PyTorch attention，不影响出片）

### 网络坑

- `huggingface.co` / `api.openai.com` 直连不通 → 模型下载用 `hf-mirror.com`（大文件用 Windows BITS 传输防断流），GPT 生图走项目中转站

---

## 四、流程纪律（制作人拍板）

1. **出图/生视频前，先把原图/预览给制作人确认**，不要直接开跑长任务
2. 生图后检查画面文字/名字直译问题（见问题①）
3. 视频生成任务时长 5~40 分钟不等，先确认参数再跑，避免白等
4. 归档文档与经验持续更新，本文件即 AI 通用教材

---

## 五、下一步待办（2026-08-10）

- [ ] 制作人提供参考图 + 新图问题清单 → 按新约束重出 Xia Ya 概念图
- [ ] 验证「快速生成 + EasyCache + 后处理锐化」组合的最终效果
