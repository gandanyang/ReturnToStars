# 《归星物语》项目长期记忆

> 跨会话约定与"轮子清单"。开工先读：`docs/AI开发前必读.md` + `docs/开发约束与架构入口.md` + 任务卡。

## 核心规范
- 新需求动手前先做"已有系统检查"；红线：禁第二 SaveManager/EventManager/QuestTrigger；禁 Scene 直存 localStorage（收口 SaveSystem）；禁单 NPC 独立管理器；一次性触发必须 `EventManager.triggerOnce(id, fn)`。

## 轮子清单（直接复用）
- 存档 SaveSystem.ts｜事件 EventManager.ts｜剧情 StorySystem.ts（冻结区单写者制）｜任务 QuestSystem.ts+DailyQuestSystem.ts｜相簿 data/PhotoAlbum.ts｜恢复 data/FarmRestore.ts｜NPC NPCSystem.ts｜环境音 AmbienceSystem.ts｜音乐 audio/MusicSystem.ts｜语音 audio/VoiceBank.ts（镇长→村长 key 桥接）｜Debug main.ts window.debug
- UI：模块级单例+panelFadeIn/Out；StoryDialogue.ts 打字机；MemoryFlashback.ts 闪回；MemoryMoment.ts 飘字
- tools/（50+ 先查再写）：语音 gen_voice/gen_mainline_voice/gen_xiya_minimax.py+minimax_tts/fish_tts.ts；出图 gen_portrait_comfy.py/gpt_image_gen.mjs；GPT tileset 管线 gpt_tileset_normalizer.py+prompts/*.txt+锚点 tools/star_island_palette.json；打包 build_apk/install_apk.py；gpt-bridge.mjs 请示桥
- 探针 tests/probes/：ch1-walkthrough/stargaze/photo-album/dialogue-history/voice/npc-*/lighthouse/west-coast-visual 等

## 协作约定
- 多 AI 并发：git 写统一交 opencode/制作人；高危命令禁 Agent（reset/clean/checkout .）；截图归档进程活跃（消失≠清理，重跑探针重建）；试玩 tmp/_player-run.mjs（瞬时按键须 HOLD）

## 制作人拍板
- **配音**：优先 MiniMax T2A v2；**IndexTTS-2 主引擎**（08-13），CLI batch 主路径 `G:\AI_Tools\index-tts\.venv\Scripts\python.exe -m indextts.cli_v2 batch`；WebUI API 不可自动化；emotion 不稳定勿用；夏雅参考音=`art_source/audio_generated/夏雅_minimax定案参考_24k.wav`；76 条已 IndexTTS 重录（旧备份 art_source/audio/voice/xiya_minimax_backup/）；沙箱删除用 Python os.remove/rename
- **T2 红线**：只做 Day1 引导链+关键对白+出售反馈世界化；禁新货币/建筑/任务链/UI/经济公式；冻结好感/新地图/战斗/大型农业
- 术语：心语任务=角色剧情统一命名；村长→镇长收敛 ｜ 阶段：Alpha→可展示版，P0=收口→回归→TapTap→实机 PV
- **出图**：游戏像素一律走 GPT 管线（09api.com 中转；SD 像素不达标已放弃 08-14）；Animagine XL 4.0 立绘工作流已建（workflow/animagineXL40_portrait.json + tools/comfy_animagine_test.mjs）

## 平台事实
- 🔴 横屏优先红线：禁竖屏视口（375×812）——触发 #rotate-hint+竖屏分支拦截；必须横屏（1024×768 或 844×390+hasTouch）

## 文本护栏（08-10 制作人拍板）
- D-017 文风标准 v1.1｜D-018 自主表达审查｜D-019 米哈游对白学习库 v0.1（金句准入五问：资格/伤口or观点/行动支撑/不完整人话/遮名可猜+大词配额制）；A1 老周已定稿施工冻结

## ⭐ Phaser 教训
- 相机判定勿信 cam.scrollX（用 getWorldPoint(0,0).x）；玩家移位必须 setPosition()；Graphics fillStyle 的 alpha 烘焙进填充色（用 setAlpha）；视觉验证用独立端口（5199）+ __game.scene 守卫；探针定位场景用 find(x => x.player)

## 灯塔预埋（08-10 ✅）
- 三层：可见去不了（黑灯）→ 城市复兴后亮灯+台词「西边的灯塔……好像又亮起来了」→ 任务完成后开放见执灯人；实现：farm 西侧海湾 + exits.ts `locked:true`（移除即开放）；恢复点见 `docs/design/灯塔未来内容预埋方案-v1.0.md`

## ComfyUI/Forge 模型（08-14）
- 主力 `/g/forge/models/Stable-diffusion/`：animagineXL40 ⭐ / WAI_NSFW-illustrious-SDXL / GhostXL（动漫三巨头）+ 写实 majicMIX/meinamix + FLUX；VAE：ClearVAE/cutevae/klF8Anime2VAE/sdxl_fp16_fix；Lora：yourname_style（新海诚）
- ComfyUI 运行中（127.0.0.1:8188）；anima_turboV10 工作流主模型未下载（需 anima-turbo-v1.0/anima-base-v1.0）

## Godot MVP（08-15 脚本语言迁移）
- `godot_mvp/`（技术验证）脚本已 GDScript → **C#**：player.cs / fish_ui.cs / tools/build_scene.cs；场景引用已切 .cs，原 .gd 保留作对照；运行需 Godot 4.7 **.NET 版** + dotnet SDK 8；本机无 SDK/无 mono 版/网络不通，未编译验证
- 既有缺陷：MVP 钓鱼 FishTimer.timeout 未连接（咬钩永不触发），未随迁移修复
