# 夏雅配音改良方案（IndexTTS-2 参考音替换）v1.0

> 状态：✅ **已全量落地（2026-08-13）**：76 条 xiya 全部 IndexTTS-2 重录完成并接入
> 关联：`docs/IndexTTS-2语音生成工具手册.md`（引擎手册）｜`docs/design/配音选角表-v0.1.md`（选角历史）

---

## 1. 问题诊断（为什么"之前的参考音效果很差"）

**根因：参考音本身是废弃声线。**

`.tmp/xiya_letter_test/test.jsonl`（IndexTTS 试音）用的参考音是：

```
art_source/audio_generated/夏雅知性女声_20260805_001.wav
```

这是 **VoxCPM 时代（08-05）的 Fish 知性女声 `bdc493bc` 克隆参考**——制作人已于 08-06 拍板废弃该声线（F0 漂移 + prompt 回显问题），夏雅定案音色为 **MiniMax T2A v2 `female-shaonv-jingpin`**（少女音色-beta：温暖不柔弱 / 安静有力量 / 带一点疲惫感）。

用废弃声线做参考 → IndexTTS 克隆出来的自然不是"夏雅"，而是"旧知性女声" → 效果差。

**附加问题**：该参考是 12s 长段（VoxCPM 保 F0 稳定性用），IndexTTS 不需要这么长，且是 16k 采样（IndexTTS 手册建议 24k 纯净参考）。

## 2. 改良方案（核心洞察）

**用仓库里现成的 MiniMax 定案产物做 IndexTTS 参考音** —— 零成本、音色就是制作人拍板的那把声音：

```
参考音来源：art_source/audio/voice/xiya/*.wav（44+ 条 MiniMax 定案产物，16k）
处理：ffmpeg 转 24k 单声道 → art_source/audio_generated/夏雅_minimax定案参考_24k.wav
```

### 参考音挑选依据（从定案产物中筛选）

| 候选 | 时长 | 语音密度 | 评语 |
|---|---|---|---|
| **water_05** ✅ | 5.4s | 78% | **"嗯。留下需要的，换成需要的东西，这里才能慢慢恢复起来。"**——平静有力量、生活感、温柔，最贴人设 |
| xiya_03 | 4.3s | 90% | "林爷爷以前提过你……"情绪偏复杂，备选 |
| ending_05 | 4.4s | 76% | "嗯。他说，总有一天，会有人回来继续看。"——也可 |
| dawn_03 | 3.1s | 93% | 太短（<4s 不稳） |

选定 **water_05**（5.4s 在 IndexTTS 推荐 5~12s 区间内，语音密度高，情绪为"平静温柔"最贴合角色）。

## 3. 验证结果（CLI 批量合成，2026-08-13）

生成命令（IndexTTS-2 CLI v2 batch，**与 WebUI 同模型同参考音，产物等价**）：

```powershell
$env:APPDATA="G:\ReturnToStars\.tmp\IndexTTS-appdata"; $env:LOCALAPPDATA="G:\ReturnToStars\.tmp\IndexTTS-localappdata"
G:\AI_Tools\index-tts\.venv\Scripts\python.exe -m indextts.cli_v2 batch `
  --batch-file G:\ReturnToStars\.tmp\xiya_improve_test\test.jsonl `
  --model-dir G:\AI_Tools\index-tts\checkpoints --device cuda:0 --fp16 --force
```

| 文件 | 参考音 | 文本 | 采样率 | 时长 | 峰值 | RMS |
|---|---|---|---|---|---|---|
| water_05_new.wav | 新（定案） | 嗯。留下需要的… | 22050 | 4.8s | 10447 | 2179 |
| xiya_03_new.wav | 新（定案） | 林爷爷以前提过你… | 22050 | 6.9s | 17731 | 2041 |
| mine_04_new.wav | 新（定案） | 别逞强，你爷爷… | 22050 | 4.6s | 10724 | 2521 |
| water_05_OLD.wav | 旧（废弃） | 嗯。留下需要的… | 22050 | 4.3s | 32733 | 7195 |

> 同文本 water_05 新旧对照：新参考音 RMS≈2179（MiniMax 定案本身响度偏低），旧参考音 RMS≈7195（Fish 声线响度高）。音量差异由游戏端 -16 LUFS 标准化统一，试听时建议开满音量对比音色。

**试听文件**：`.tmp/xiya_improve_test/*.wav`（4 条，含新旧对照）

## 4. 全量落地记录（2026-08-13）

1. **制作人试听确认**：新参考音音色到位；去掉 emotion 控制（纯克隆）后情绪收敛自然（xiya_03 时长 6.9s→4.5s）
2. **全量生成**：T 列表完整提取 **76 条** xiya（50 主线/支线 + 26 信件 letter），CLI batch 两批完成（50 + 26），全部 22050Hz 可读，时长 1.0~6.7s
3. **管线**：sidecar 76/76 → loudnorm -16 LUFS（76/76）→ ogg 64k 单声道（76/76）→ `--emit-voicebank` re-emit（256 条，xiya 76 条零缺失）
4. **回退保护**：旧 MiniMax 定案产物备份在 `art_source/audio/voice/xiya_minimax_backup/`（52 wav + txt + .minimax_done）

> ⚠️ 注意：IndexTTS 输出 22050Hz/24000Hz（v2 模型为 22050），旧管线（VoxCPM/MiniMax）为 16k——游戏端 `AudioContext.decodeAudioData` 自动重采样可直接播放，转换 ogg 管线按现有脚本处理即可。

## 5. 踩坑记录（已固化）

- **WebUI API 不宜自动化**：gradio 5.45 的 `Radio type="index"` 组件，gradio_client 2.6 客户端校验要求传字符串 choices、但 webui.py 服务端 `if type(...) is not int: ...value` 期望 int → 两者冲突；HTTP 直连 `queue/join` 传字符串能过校验但推理在 speech synthesis 阶段崩（`show_error=False` 隐藏原因，怀疑与 WebUI 进程的 fp16/显存状态有关）。**结论：批量生成统一走 CLI batch（官方主路径，已验证 4/4 成功）。**
- CLI batch 与 WebUI 同模型目录同参考音，产物一致；WebUI 仅用于人工试听调参。
- **⚠️ 不要用 emotion 控制（2026-08-13 制作人反馈）**：`emotion_text`（如"平静中带一点感慨"）会被 QwenEmotion 转成高情绪向量，把平铺直叙的台词读成"情绪过载"（如 xiya_03"不会有人回来了"听感过头）。**正确做法：纯克隆，不带 emotion 字段**——参考音 water_05 本身是平静温柔的基调，克隆时情绪自然延续，台词本身的标点（省略号/句号）就能表达语气。全量清单已去掉 emotion_text。
