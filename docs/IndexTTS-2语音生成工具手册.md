# IndexTTS-2 语音生成工具手册

> 状态：✅ 已部署（2026-08-13）｜定位：**本地 TTS 引擎，替代 VoxCPM 的新主引擎**（语音/配音生成统一走本引擎）
> 参考：`docs/VoxCPM语音生成一键调用手册.md`（旧引擎，退役）｜`docs/MiniMax语音生成工具手册.md`（在线 TTS，保底备选）
> 本文档面向**后续所有 AI Agent**：涉及「生成语音 / 配音 / 试听音色」任务前必读。

---

## 0. 一句话总结

IndexTTS-2 是本地运行的神经网络 TTS：给定**参考音频**（克隆音色）+ **文本** → 输出 wav 语音。
- 环境在 **G 盘**（不在项目仓库内），与仓库的接线点在 `art_source/audio/voice/` 与 `tools/gen_mainline_voice.py`。
- **推理不能在 Trae 沙箱里跑**（写权限被拦会卡死）——凡是需要跑推理的命令，**一律整理好命令交给制作人在自己终端执行**。
- 模型加载一次 2~4 分钟（无输出是正常的），**用 `batch` 一次跑完所有台词**，避免每条重复加载。

---

## 1. 环境位置（重要）

| 项目 | 路径 |
|---|---|
| 引擎源码 | `G:\AI_Tools\index-tts`（IndexTTS-2 官方仓库 + venv） |
| Python 解释器 | `G:\AI_Tools\index-tts\.venv\Scripts\python.exe`（**Python 3.11**，专用，勿用别的） |
| 模型目录 | `G:\AI_Tools\index-tts\checkpoints`（IndexTTS-**2**，含 gpt.pth / s2mel.pth / BigVGAN / w2v-bert 等） |
| 项目参考音频 | `art_source\audio_generated\`（各角色音色参考） |
| 项目语音产物 | `art_source\audio\voice\<角色>\<tid>.wav`（+ 同名字 `.txt` 来源文本 sidecar） |
| CLI 持久化配置 | 已在 `%APPDATA%\IndexTTS\config.toml`（沙箱时重定向到 `.tmp\IndexTTS-appdata\IndexTTS\config.toml`） |

> ⚠️ **模型是 IndexTTS-2（v2），不是 2.5**。仓库 `checkpoints/` 里是 v2 模型文件。
> WebUI 启动必须 `--version 2`，否则默认 `2.5` 会尝试重新下载另一个模型（几十 GB 白下）。

---

## 2. 入口：CLI v2（批量/脚本主路径）

统一入口（模块方式，无需安装）：

```powershell
G:\AI_Tools\index-tts\.venv\Scripts\python.exe -m indextts.cli_v2 <子命令> ...
```

子命令：`init` / `config` / `check` / `download` / `synth`（单条）/ `batch`（批量）/ `concat`（拼 wav）。
详细参数表见引擎内文档 `G:\AI_Tools\index-tts\docs\cli_v2_usage.md`。

### 2.1 环境自检（快，无模型加载）

```powershell
$env:APPDATA="G:\ReturnToStars\.tmp\IndexTTS-appdata"; $env:LOCALAPPDATA="G:\ReturnToStars\.tmp\IndexTTS-localappdata"
G:\AI_Tools\index-tts\.venv\Scripts\python.exe -m indextts.cli_v2 check --model-dir G:\AI_Tools\index-tts\checkpoints
```

看到 `OK: required model files` + `cuda: available` 即环境就绪。

### 2.2 单条合成（调试用）

```powershell
G:\AI_Tools\index-tts\.venv\Scripts\python.exe -m indextts.cli_v2 synth `
  --text "虽然现在还看不出来什么。" `
  --voice "G:\ReturnToStars\art_source\audio_generated\夏雅知性女声_20260805_001.wav" `
  --output "G:\ReturnToStars\.tmp\test.wav" `
  --model-dir G:\AI_Tools\index-tts\checkpoints --device cuda:0 --fp16
```

### 2.3 批量合成（正式干活主路径，模型只加载一次）

先写 JSON Lines 清单（路径用**绝对路径**或相对于清单文件的位置），例如 `tools/voice_tasks.example.jsonl`：

```jsonl
{"text": "虽然现在还看不出来什么。", "voice": "G:/ReturnToStars/art_source/audio_generated/夏雅知性女声_20260805_001.wav", "output": "G:/ReturnToStars/art_source/audio/voice/xiya/letter_open_02.wav"}
{"text": "你每天都会来这里看看？", "voice": "G:/ReturnToStars/.tmp/ref_linche.wav", "output": "G:/ReturnToStars/art_source/audio/voice/linche/letter_open_01.wav"}
```

清单字段：`text`（必填，与 `text_file` 二选一）、`voice`（音色参考，命令级 `--voice` 可当默认值）、`output`（输出 wav，逐行模式必填）、`emotion_text` / `emotion_vector` / `emotion_audio` / `emotion_weight`（可选情感控制）。**未知字段会报错**。

然后执行（**沙箱外**）：

```powershell
$env:APPDATA="G:\ReturnToStars\.tmp\IndexTTS-appdata"; $env:LOCALAPPDATA="G:\ReturnToStars\.tmp\IndexTTS-localappdata"
G:\AI_Tools\index-tts\.venv\Scripts\python.exe -m indextts.cli_v2 batch `
  --batch-file G:\ReturnToStars\.tmp\xiya_letter_test\test.jsonl `
  --model-dir G:\AI_Tools\index-tts\checkpoints --device cuda:0 --fp16
```

- `--dry-run` 只校验清单不合成（AI 可自跑自检）。
- 成功逐条打印 `Generated: <path>`，最后 `Batch complete: N tasks generated`。
- 默认**不覆盖**已有输出；要覆盖加 `--force`。
- 失败即停（无 continue-on-error）。

---

## 3. 入口：WebUI（试听/调音色用）

制作人本地试听音色、调整情感参数时用 WebUI（常驻进程，加载一次后随便试）：

```powershell
G:\AI_Tools\index-tts\.venv\Scripts\python.exe G:\AI_Tools\index-tts\webui.py `
  --model_dir G:\AI_Tools\index-tts\checkpoints --version 2 --fp16
```

- 访问 `http://localhost:7860`
- **必须 `--version 2`**（默认 2.5 会重新下载错模型）
- WebUI 里选参考音频 + 文本 + 情感参数即可实时试听，AI 不参与

---

## 3.1 入口：REST API 服务（AI/脚本调用专用，推荐给负责配音的其他 AI）

**背景**：直接调 WebUI 的 Gradio 接口很脆（`gen_single` 有 17 个入参 + Gradio 私有返回格式，版本一升就翻车）。为此提供独立 REST API 服务，模型常驻，其他 AI / 脚本只发 HTTP POST。

**启动**（制作人在自己终端跑，加载 2~4 分钟，之后常驻）：

```powershell
G:\AI_Tools\index-tts\.venv\Scripts\python.exe G:\AI_Tools\index-tts\api_server.py `
  --model-dir G:\AI_Tools\index-tts\checkpoints --version 2 --fp16 --port 8000
```

| 接口 | 说明 |
|---|---|
| `GET  /health` | 健康检查（AI 先探测再调用）：返回 ok/model_version/vram_gb/qwen_emo |
| `POST /api/tts` | 单条合成 |
| `POST /api/tts/batch` | 批量合成 `{"tasks":[{...},{...}]}`，逐条返回结果不中断 |
| `GET  /docs` | FastAPI 自动文档（浏览器看参数） |

`/api/tts` 请求体：

```json
{
  "text": "虽然现在还看不出来什么。",
  "voice": "G:/ReturnToStars/art_source/audio_generated/夏雅_minimax定案参考_24k.wav",
  "output": "G:/ReturnToStars/.tmp/test.wav",
  "duration_factor": 1.0,
  "advanced": { "do_sample": true, "top_p": 0.8, "temperature": 0.8, "num_beams": 3, "max_mel_tokens": 1500, "max_text_tokens_per_segment": 120 }
}
```

- ⚠️ **情感参数已禁用**（2026-08-13 拍板）：`emotion_audio` / `emotion_vector` / `emotion_text` / `emotion_weight` 一律不传，见第 6 章。
- `duration_factor` 仅 v2.5 有效，v2 自动忽略（服务已处理）。
- 响应：`{"ok": true, "output": "...", "elapsed": 12.3, "size": 12345}`；错误 `{"ok": false, "error": "..."}`（400 参数错 / 500 推理失败）
- **服务由制作人启动，AI 不负责启停**；与 WebUI 各占 ~4.5GB 显存，**错开运行**
- 调用示例（PowerShell，注意 UTF-8 body）：

```powershell
$body = @{ text = "虽然现在还看不出来什么。"; voice = "G:\ReturnToStars\art_source\audio_generated\夏雅知性女声_20260805_001.wav"; output = "G:\ReturnToStars\.tmp\api_test.wav" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:8000/api/tts -Method Post -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

Python 调用：`requests.post("http://localhost:8000/api/tts", json={...})`（requests 自动 UTF-8，最省事）。

---

## 4. 关键坑（其他 AI 必读，踩过坑）

1. **沙箱禁止跑推理**：模型初始化会写 `.venv\Lib\site-packages\**\__pycache__`，Trae 沙箱拦截 → 进程卡死无输出（GPU 显存不涨）。判断方法：`nvidia-smi` 看显存（fp16 应占 ~4.5GB）——沙箱里只有 ~1.3GB 就是卡死了。**对策：命令整理好发给制作人在自己终端跑。**
2. **`--model-dir` 必须显式传** `G:\AI_Tools\index-tts\checkpoints`：持久化配置里写的是 `.tmp` 下的空目录（沙箱遗留），不传会报「missing required model files」。
3. **APPDATA/LOCALAPPDATA 重定向**：不重定向会写制作人真实 `%APPDATA%\IndexTTS`。统一重定向到 `G:\ReturnToStars\.tmp\IndexTTS-{appdata,localappdata}`。
4. **模型加载 2~4 分钟无输出 = 正常**（CLI 隐藏加载日志），不是卡死；耐心等或先 `nvidia-smi` 确认显存占用。
5. **进程退出即释放模型**：PowerShell 窗口不关不会保留模型。要省加载时间就一次 `batch` 全跑完，或开 WebUI 常驻。
6. **输出采样率 24000**：与旧 VoxCPM/MiniMax（16000）不同。游戏端用 `AudioContext.decodeAudioData` 自动重采样，**可直接播放**；转换 ogg 管线按现有脚本处理即可，无需手动降采样。
7. **参考音频 mp3 可能不被 torchaudio 直接支持**：先 ffmpeg 转 24k 单声道 wav 再喂（项目 ffmpeg：`E:\BINGdown\VoxCPM\src\ffmpeg\bin\ffmpeg.exe`）。
8. **IndexTTS 无 VoxCPM 的 prompt 回显问题**：不需要 `trim_voice_lead()` 前导裁剪；也不依赖超长参考（VoxCPM 要 12s 长段保 F0 稳定，IndexTTS 用 5~12s 纯净参考即可）。
9. **`duration_factor` 仅 v2.5 支持，v2 传它必炸**：`infer_v2.py` 没有该参数，会透传进 GPT `generate()` 的参数校验，报 `ValueError: The following model_kwargs are not used by the model: ['duration_factor']`。CLI v2 无此参数所以安全；REST API 服务已自动处理（v2 忽略）。**自己写脚本/改代码时别手搓这个参数。**
10. **情感模式禁用**（2026-08-13 制作人拍板）：详见第 6 章。任何入口（API/CLI/batch 清单）都不许带 `emotion_*`。情感靠参考音频表达。

---

## 5. 与项目语音管线的接线

```
台词源（单一数据源）
  tools/gen_mainline_voice.py 的 T 列表  ── 文本与 src/systems/StorySystem.ts 精确一致
        │  （T 是 [(role, tid, text)] 三元组；下游 gen_xiya_minimax.py / gen_voice_mapping.py import 依赖它）
        ▼
合成（本引擎 batch，产物）
  art_source/audio/voice/<role>/<tid>.wav  + 同名 .txt（来源文本 sidecar，防文本改了 wav 没重录）
        ▼
映射生成
  python tools/gen_mainline_voice.py --emit-voicebank src/audio/voicebank.data.ts
        ▼
游戏播放
  src/audio/VoiceBank.ts：speaker + 归一化文本匹配 → audio/voice_normalized/<file>.ogg（-16 LUFS 标准化）
```

- 新台词接入流程：**先往 T 列表加条目**（role/tid/text，与 StorySystem 原文逐字一致）→ batch 合成到 `art_source/audio/voice/` → `--emit-voicebank` 重新生成映射 → 游戏内自动匹配播放（找不到音频静默跳过，不阻塞）。
- 角色 speaker 名：林澈/夏雅/村长/爷爷的笔记/信/矿工老张/花匠小梅/阿风/木匠老周/商店老板；少女/HR/纸条用 `''` 通配。
- 参考音频在 `art_source/audio_generated/`，角色→参考的对应关系维护在 `gen_mainline_voice.py` 的 `ROLES` 表。

---

## 6. 音色与情感控制

- 音色 = `--voice <参考音频>`（克隆参考音色）。换音色 = 换参考音频文件。

### ⚠️ 情感模式：禁用（制作人 2026-08-13 拍板，硬性禁忌）

**IndexTTS-2 的情感模式存在巨大缺陷，禁止使用。** 适用所有入口：

- API：请求体里的 `emotion_audio` / `emotion_vector` / `emotion_text` / `emotion_weight` 一律不传
- CLI：`--emotion-text` / `--emotion-vector` / `--emotion-weight` 一律不用
- batch 清单：每行不写 `emotion_*` 键

缺陷表现（实测）：
1. `emotion_vector` 会整体污染音色与吐字（缩放/混合逻辑不成熟，听感劣化明显）
2. `emotion_text` 依赖 QwenEmotion 转向量，转出的向量同样不稳，且多一跳故障点
3. `emotion_audio`（情感参考）与主音色参考混合不可控

**正确替代：情感靠参考音频本身表达。** 需要某种情绪 → 选情绪相符的参考音克隆即可（如夏雅平静温柔用 `夏雅_minimax定案参考_24k.wav`）。不要为了"更像"去叠情感参数。

### 夏雅音色（重要）

- **正确参考音 = `art_source/audio_generated/夏雅_minimax定案参考_24k.wav`**（MiniMax 定案产物转 24k 单声道，5.4s 平静温柔最贴人设）。已在 `gen_mainline_voice.py` ROLES 里生效。
- ⚠️ **禁止用旧参考 `夏雅知性女声_20260805_001.wav`**：VoxCPM 时代 Fish 知性女声，2026-08-06 制作人拍板弃用，克隆效果差（"音色不对"的根因之一）。
- 详见 `docs/design/夏雅配音改良方案-IndexTTS参考音替换-v1.0.md`。

---

## 7. 返回码

| 码 | 含义 |
|---|---|
| 0 | 成功 |
| 1 | 输入错误（文本为空 / 缺 --output / 输出已存在 / 情感参数冲突 / 清单字段错） |
| 2 | 本地资源缺失（模型目录 / 参考音频 / 清单不存在） |
| 3 | 运行环境不可用（包缺失 / 设备不可用） |
| 4 | 推理或拼接失败（模型初始化 / infer 异常） |

错误写 stderr，成功写 stdout。
