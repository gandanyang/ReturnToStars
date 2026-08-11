# ComfyUI + anima turbo V10 文生图通用攻略

> 目标读者：任何需要在本机 ComfyUI 上用 anima turbo V10 出二次元美图的人 / AI Agent。
> 本文是**通用型文档**，不依赖任何具体项目资产，直接照做即可。

---

## 一、这是什么

anima turbo V10 是一套**快速文生图**的 ComfyUI 工作流组合（蒸馏 turbo 模型 + 配套 CLIP/VAE），
只需 **8 步采样**即可出图（普通 SDXL 模型通常要 25~40 步），适合批量出图 / 快速迭代。

特点：

- **步骤少、出图快**：`steps=8`，单张秒级~十几秒（取决于显卡）
- **低 CFG**：`cfg=1`（turbo 蒸馏模型的典型设置，越高越容易过曝/劣化）
- **扁平柔和动画风格**：负面提示词主动排除强光影 / 戏剧光 / 高对比，保证画风统一

---

## 二、前置条件

### 2.1 软件

- ComfyUI（推荐 0.3.0+，支持 qwen_image CLIP 类型与负 CFG）
- 模型文件放入 ComfyUI 的 `models/` 目录

### 2.2 模型三件套（必须同时就位）

| 文件 | 放入目录 | 用途 |
|---|---|---|
| `anima_turboV10.safetensors` | `models/checkpoints/` | UNet 主模型（turbo） |
| `anima_baseV10_txt.safetensors` | `models/clip/` | CLIP 文本编码器（`type=qwen_image`） |
| `qwen_image_vae.safetensors` | `models/vae/` | VAE 解码器 |

> 注意：CLIP 加载时必须指定 `type=qwen_image`，否则提示词编码结果错误。

---

## 三、工作流核心配置（必读）

以下参数来自标准工作流 `anima_turboV10.json`，**没有特别理由不要改动**。

### 3.1 采样器

| 参数 | 值 | 说明 |
|---|---|---|
| steps | **8** | turbo 蒸馏步数，别加到 15+（会劣化） |
| cfg | **1** | 蒸馏模型标准值；建议范围 0.8~1.5 |
| sampler_name | `er_sde` | 固定采样器 |
| scheduler | `simple` | 固定调度器 |
| denoise | `1.0` | 文生图全程重绘（非图生图） |
| seed | 任意整数 | 随机种子用正整数（ComfyUI 0.30 起不接受 -1） |

### 3.2 模型加载

| 节点 | 关键参数 |
|---|---|
| UNETLoader | `unet_name = anima_turboV10.safetensors`，`weight_dtype = default` |
| CLIPLoader | `clip_name = anima_baseV10_txt.safetensors`，**`type = qwen_image`** |
| VAELoader | `vae_name = qwen_image_vae.safetensors` |

### 3.3 画布尺寸

- 默认竖版：**宽 1536 × 高 1024**
- 推荐备选：
  - 横版（封面/横幅）：1216×832 或 1920×1128
  - 竖版（海报/立绘）：832×1216
- 尺寸须为 64 的倍数（latent 对齐）

---

## 四、提示词规范（重点）

工作流用字符串拼接链组织提示词，最终**正面提示词 = 质量词 + 画面描述 + lora 触发词 + 画师串**。

### 4.1 正面提示词结构

```text
[质量词] [画面描述] [lora触发词] [画师串]
```

各部分职责：

| 部分 | 示例 | 说明 |
|---|---|---|
| 质量词 | `masterpiece, best quality, score_9, score_8, highres, absurdres, anime screenshot, year 2025` | 固定前缀，保证画质与动画截图感 |
| 画面描述 | 主体 + 场景 + 氛围（如 `a girl standing in a wheat field at dusk, warm light, gentle smile`） | 每次出图的核心输入 |
| lora 触发词 | 若挂载 LoRA 时填其触发词，否则留空 | 工作流保留此槽位，无 LoRA 时留空即可 |
| 画师串 | 风格参考画师名（逗号分隔），不用则留空 | 影响风格取向，可空 |

> 注：标准工作流中质量词末尾有个中文全角逗号（`score_8，highres`），可自行修正为英文逗号，不影响语义。

### 4.2 负面提示词（固定使用）

```text
score_1, score_2, score_3, bad anatomy, bad proportions, deformed anatomy,
deformed face, deformed eyes, text, multiple fingers, watermark, artist name,
censor, mosaic, shadows, highlights, strong lighting, dramatic lighting,
rim light, backlighting, high contrast, volumetric lighting
```

要点：

- `score_1~3`：SDXL 质量分级反向锚点（配合正面 `score_8/9`）
- **主动排除强光影类关键词**（shadows / highlights / dramatic lighting / rim light / backlighting / high contrast / volumetric lighting）：这是本工作流**保持扁平柔和动画画风**的关键，删掉这部分画风会漂移

---

## 五、使用方式

### 方式 A：ComfyUI 界面

1. 将 `anima_turboV10.json` 拖入 ComfyUI 画布（或 Load 打开）
2. 确认 4.1 / 4.2 的提示词已填好
3. 点 Queue 运行，产物自动保存到 `ComfyUI/output/`

### 方式 B：HTTP API（适合脚本 / Agent 批量出图）

标准 ComfyUI API 流程：

```text
POST http://127.0.0.1:8188/prompt     # 提交工作流
GET  http://127.0.0.1:8188/history/<prompt_id>   # 轮询结果
GET  http://127.0.0.1:8188/view?filename=<图名>  # 下载图片
```

提交示例（等价于界面标准工作流）：

```json
{
  "prompt": {
    "1": { "class_type": "UNETLoader", "inputs": { "unet_name": "anima_turboV10.safetensors", "weight_dtype": "default" } },
    "2": { "class_type": "CLIPLoader", "inputs": { "clip_name": "anima_baseV10_txt.safetensors", "type": "qwen_image" } },
    "3": { "class_type": "VAELoader", "inputs": { "vae_name": "qwen_image_vae.safetensors" } },
    "5": { "class_type": "EmptyLatentImage", "inputs": { "width": 1536, "height": 1024, "batch_size": 1 } },
    "6": { "class_type": "CLIPTextEncode", "inputs": { "text": "<正面提示词>", "clip": ["2", 0] } },
    "7": { "class_type": "CLIPTextEncode", "inputs": { "text": "<负面提示词>", "clip": ["2", 0] } },
    "8": { "class_type": "KSampler", "inputs": { "seed": 123456, "steps": 8, "cfg": 1, "sampler_name": "er_sde", "scheduler": "simple", "denoise": 1.0, "model": ["1", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0] } },
    "9": { "class_type": "VAEDecode", "inputs": { "samples": ["8", 0], "vae": ["3", 0] } },
    "10": { "class_type": "SaveImage", "inputs": { "filename_prefix": "out", "images": ["9", 0] } }
  },
  "client_id": "any-client-id"
}
```

注意事项：

- 提示词含中文逗号 / 特殊字符时，JSON 字符串直接按 UTF-8 传即可
- 保存 PNG 是异步落盘，历史接口返回后文件可能尚未写完，下载前建议重试并校验文件大小
- 长时间未完成需设超时；提交失败先看返回的 `error` 字段

---

## 六、参数调节建议

| 目标 | 怎么调 |
|---|---|
| 更稳定 / 统一风格 | 固定 seed；负面提示词保持不变 |
| 画面更精致 | 质量词补 `very detailed, detailed face`；仍保持 steps=8 |
| 横版构图 | 改 1216×832（或 1920×1128） |
| 出图失败 / 发灰 | 确认 cfg 在 0.8~1.5；检查 CLIP 是否用了 `qwen_image` |
| 想叠风格 LoRA | 在 `lora触发词` 槽位填触发词，模型链上加 LoraLoader（strength 推荐 0.6~0.9） |

---

## 七、常见问题（FAQ）

**Q1：为什么 cfg 不能调大？**
anima turbo 是蒸馏模型，训练时即低 CFG；调到 3+ 会出现过曝、对比爆炸、细节劣化。

**Q2：steps=8 够吗？**
够。这是该模型的甜点步数，再加步数不会更细，反而容易引入伪影。

**Q3：负面提示词为什么刻意排除光影词？**
这是工作流作者为保证**扁平、柔和、统一动画画风**做的风格化约束。去掉会导致每张图光影风格漂移。

**Q4：CLIP 加载报错 / 提示词无效？**
确认 CLIPLoader 的 `type` 填的是 `qwen_image`，模型文件名与 `models/clip/` 下实际文件一致。

**Q5：API 提交返回 400？**
检查 JSON 里节点引用（如 `["2", 0]`）是否对应存在；`client_id` 任意即可。

---

## 八、文件清单（随本攻略配套）

| 文件 | 用途 |
|---|---|
| `anima_turboV10.json` | 标准工作流，ComfyUI 界面直接导入 |
| `anima_turboV10.safetensors` | UNet 模型 |
| `anima_baseV10_txt.safetensors` | CLIP（qwen_image） |
| `qwen_image_vae.safetensors` | VAE |
