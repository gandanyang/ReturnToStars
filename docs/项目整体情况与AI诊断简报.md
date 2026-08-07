# 归星物语 · 项目整体情况与 AI 诊断简报

> 用途：给不熟悉本项目的其他 AI / 开发者快速建立上下文，用于诊断、审查或接手。
> 生成：2026-08-08（trae 语音线会话）｜维护：随项目状态更新
> 开工门禁（对本项目任何 AI 都有效）：`AGENTS.md` → `docs/AI开发前必读.md` → `docs/开发约束与架构入口.md`

---

## 1. 项目一句话

《归星物语》是**像素风农场生活 RPG**（类星露谷、二次元剧情表现），Phaser 3 + TypeScript + Capacitor 打包安卓 APK，移动端优先。
**当前阶段（2026-08-08）：Alpha 稳定阶段**——核心目标是做一次 **15~30 分钟完整体验 Demo**：玩家首次进入能完成「一次星空体验 + 一次农业循环 + 一次 NPC 情感反馈 + 一次世界变化」的完整情绪闭环。

核心判断标准（制作人原话）：陌生玩家打开 → 玩 15-30 分钟 → 是否觉得 **"这个世界有感觉。"**

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 游戏引擎 | Phaser 3.80（WebGL/Canvas） |
| 语言/构建 | TypeScript 5.4 + Vite 5（`tsc && vite build`） |
| 移动端 | Capacitor 8（android，JDK 21 + Gradle 8.14 wrapper） |
| 地图 | Tiled JSON（`public/assets/maps/*.json` + `tiles/*.png`，gid 语义禁止改动） |
| 语音生成 | **MiniMax T2A v2 云端 API**（2026-08-06 起唯一推荐管线；VoxCPM 仅离线备选） |
| 测试 | Puppeteer 探针（`tests/probes/*.mjs`，走 `http://localhost:5173`）+ tsc |
| 运行时 | 浏览器 Web Audio（防 IDM 媒体嗅探弹窗，音频不走 `<audio>` 标签播放） |

## 3. 目录导读

```
src/
  main.ts           入口 + window.debug 测试钩子
  config.ts         全局配置
  scenes/           MapScene(主场景, ~庞大) / StationScene(车站开场) / TitleScene(标题)
  systems/          存档/剧情/任务/NPC/事件/环境音/天气/自动化/归星记录 等 17 个系统
  data/             Inventory/FarmPlot/PhotoAlbum/TimeSystem/Economy 等数据与逻辑
  ui/               StoryDialogue/BackpackPanel/QuestPanel/EndingPanel 等 DOM UI
  audio/            VoiceBank.ts(播放) + voicebank.data.ts(映射,自动生成勿手改)
  entities/         Player / NPC
public/
  audio/voice_normalized/  运行时语音（ogg，44.1k -16LUFS）；linche/ system/ elder/ xiya/ 等
  audio/voice/             旧 wav 目录（历史产物，打包已剔除）
  assets/                  地图/瓦片/立绘/图标
art_source/          美术与音频源文件（16k 管线 wav、原始图、宣传图；打包剔除）
tools/               50+ 工具脚本（语音生成/出图/音频/打包/探针）
docs/                AGENTS 规则、设计文档、任务卡、报告、制作人控制台
tests/probes/        Puppeteer 探针（每个功能一条，回归主力）
```

## 4. 核心系统地图（复用入口，禁止重造平行实现）

| 能力 | 文件 | 说明 |
|---|---|---|
| 存档 | `src/systems/SaveSystem.ts` | 唯一持久状态入口（SaveData），**禁止散落 localStorage** |
| 一次性事件 | `src/systems/EventManager.ts` | 剧情/支线/彩蛋必须 `triggerOnce` |
| 主线剧情 | `src/systems/StorySystem.ts` | **单写者制**（并发改剧情有冲突风险） |
| 主线任务 | `src/systems/QuestSystem.ts` + `DailyQuestSystem.ts` | 星之碎片状态机 + 每日任务池 |
| NPC | `src/systems/NPCSystem.ts` + `src/entities/NPC.ts` | 日程/站位/生活动作 |
| 剧情语音 | `src/audio/VoiceBank.ts` + `voicebank.data.ts` | (speaker,text) 归一化匹配，找不到静默跳过 |
| 场景一次性 flag | `MapSceneFlags`（MapScene.ts 内） | 随存档持久化 |
| 世界恢复 | `src/data/FarmRestore.ts` | 花园/老屋/道路恢复状态 |
| 自动化 | `src/systems/AutomationSystem.ts` | 农业机器人（浇水/收获，防刷任务） |
| 环境音 | `src/systems/AmbienceSystem.ts` | 昼夜/雨天 WebAudio 合成 |
| 天气 | `src/systems/WeatherSystem.ts` | v0.10-lite：季节推进 + 天气事件表 |
| 归星记录 | `src/systems/IslandReportSystem.ts` + `GuiXingRecordSystem.ts` | 章节结算生活化报告 + 相簿 |
| 居民需求板 | `src/systems/ResidentRequestSystem.ts` | 小镇信息板一键交付 |
| 对话历史 | `src/systems/DialogueHistoryManager.ts` | 内存 50 条回顾，不存档 |
| 安卓返回键 | `src/systems/AndroidBackHandler.ts` | 防误退 |

## 5. 玩法与剧情现状（15-30 分钟 Demo 流程）

```
车站开场（手机短信通知 + 林澈独白 5 句，语音）→ 回岛庄园 → 教程引导链
  （清理→播种→浇水→收获→出售→资源→修复，Day1 种田循环）
  → 镇长/星之碎片任务（去森林/后山）→ 观星夜演出（星空/镜头/结尾收束）
  → 归星记录结算（土地/记忆/庄园/羁绊/评价 五段生活化报告）
```

- 主线：序章 v0.7 + 第一章 v0.8（车站→庄园→青禾镇→星之碎片）
- 角色语音：林澈（主角）/ 夏雅 / 爷爷 / 村长 / 神秘少女 / 矿工老张 / 花匠小梅 / 阿风 / 商店老板 / HR 手机通知
- 已实现闭环：M1-3 爷爷旧花园（环境改变+夏雅回应）、NPC 生活化、自动机器人、环境音效、NPC 生活事件（夏雅/村长试点）、归星录相簿

## 6. 语音管线现状（2026-08-08 最新）

- **音色定案**（MiniMax T2A v2，model `speech-2.8-turbo`）：
  - 林澈（主角 + HR 电话）= `Chinese (Mandarin)_Gentle_Youth`（温柔青年）——**2026-08-08 全量重录 67 条替代旧 VoxCPM**
  - 夏雅 = `female-shaonv-jingpin`；村长 = `Chinese (Mandarin)_Humorous_Elder`
- 管线：MiniMax mp3 → ffmpeg 16k mono（art 源 `art_source/audio/voice_normalized_src/`）→ loudnorm(-16 LUFS, TP=-1.5, LRA=11) 44.1k stereo（运行时 `public/audio/voice_normalized/`）→ **ogg（libvorbis q5）**
- voicebank 映射：`src/audio/voicebank.data.ts`（203 条，由 `tools/gen_mainline_voice.py --emit-voicebank` 从 T 清单自动生成，**勿手改**）
- 校验：`tools/check_voicebank_match.py`（StorySystem+NPCSystem 台词 vs voicebank 对齐）
- 本轮（2026-08-08）同时：短信播报删第 1 页自动朗读（hr_station_01 停用，保留翻页 hr_station_03）；语音交付流程=试听确认 → 更新文档 → 打包 APK → 装机复验

## 7. 最近完成（2026-08-08 及近期）

| 项 | 状态 |
|---|---|
| 林澈全量重录 MiniMax 音色 A（67 条，linche 66 + HR 1）| ✅ 已试听确认、已打包 |
| 豆包短信播报第一句自动朗读删除（hr_station_01 停用）| ✅ tsc 归零 |
| 配音选角表更新（林澈/HR → MiniMax 音色 A）| ✅ |
| 村长全量重录（MiniMax Humorous_Elder 32 条）| ✅ 已试听、待装机 |
| APK release（29.5MB，已验证含 66+3 条新 ogg）| ✅ `dist_apk/latest-release.apk` |

## 8. 待办与已知遗留（给诊断 AI 的重点检查项）

### P0 剩余
- **观星夜演出**（星空/镜头/结尾收束，方案已定稿 MVP）——在途施工线
- 真机测试（批 2 目测 + 批 3 真机 + 新玩家 15-30 分钟完整流程）——制作人执行
- 短信配音/村长重录/林澈重录 APK 已打包 → **待装机复验听感**

### 已知遗留（非本会话范围）
- **StorySystem 另有 4 条新增台词缺 voicebank**（另一 Agent 并行改动，374 行 vs 203 映射；未匹配属其责任范围）——`check_voicebank_match.py` 会报 118 条未匹配（含此部分 + 历史旁白）
- 探针基线既有失败：`probe-farm-tap`（点击种田 camera 视口）、`probe-stargaze`（观星链路）——stash 前后一致，非近期改动引入，待专项排查
- 试玩-07 重录、6 个残留临时探针清理——未获制作人确认

### 冻结区（制作人 2026-08-07：存量消化期，暂不加新东西）
- 新系统/新内容/新任务卡一律冻结；好感系统/新地图/战斗/大型农业扩展冻结至 v0.9 发布后
- **完整天气模拟冻结**（仅环境表现轻量范围已解冻）

## 9. 硬约束（违反即返工/事故）

1. **稳定 > 新功能**：不新增战斗/抽卡/大地图/复杂养成/后端；不重构架构；不替换 Phaser
2. **不重造系统**：动手前查 `src/systems/`、`src/data/`、`docs/` 有无类似（禁止 `Inventory2.ts` 之类）
3. **持久状态只进 SaveSystem**；一次性事件一律 `EventManager.triggerOnce`
4. **StorySystem 单写者制**：改剧情前 git status 确认 + 登记；剧情文本改动先过制作人
5. **Git 写权限规则**：一个仓库同时只允许一个 Agent 持有 Git 写权限；**禁止** `git add -A`/`git add .`/`git commit`（统一由 opencode/制作人执行）；提交前确认 `git status`；只 add 自己改的文件
6. **测试分级**（TEST_RULES.md）：Level 0 纯文档 / Level 1 tsc+相关模块 / Level 2 相关系统测试+关键流程 / Level 3 大版本全测；禁止默认跑全部
7. **语音交付流程**：禁止直接打包——先本地试听 → 制作人确认音色 → 更新文档 → 打包 → 装机
8. **地图 gid 语义/碰撞编号禁止改动**（存档与地图数据关联）
9. **Design Authority**：制作人决策 > 顶层设计.md > 功能规划文档 > Agent 建议；已废弃方案不得自行恢复

## 10. 常用命令

```powershell
# 开发
npm run dev                # Vite dev（localhost:5173，探针依赖）
npx tsc --noEmit           # 类型检查（改代码后必跑）

# 打包（注意：local.env.ps1 dot-source 在部分终端不生效，需内联设 JAVA_HOME）
$env:JAVA_HOME="C:\Java\jdk-21.0.12+8"; $env:ANDROID_SDK_ROOT="$env:LOCALAPPDATA\Android\Sdk"
python tools/build_apk.py --skip-frontend   # 前端没改时；产物 dist_apk/latest-release.apk

# 语音
python tools/gen_newlines_minimax.py --all-linche   # 林澈全量重录脚本
python tools/check_voicebank_match.py               # voicebank 对齐校验
python tools/convert_voice_ogg.py                   # wav→ogg（需 PATH 前置完整版 ffmpeg：
#   $env:PATH = "C:\ffmpeg-6.0-essentials_build\bin;" + $env:PATH）
```

## 11. 给诊断 AI 的建议切入点

1. 先读：`AGENTS.md` → `docs/AI开发前必读.md` → `docs/开发约束与架构入口.md` → 本文档
2. 状态看：`docs/制作人控制台.md`（制作人看板，最新拍板）＋ `docs/问题追踪.md`（bug 台账）
3. 跑诊断：`npx tsc --noEmit` → `python tools/check_voicebank_match.py` → 关键探针（`tests/probes/`）
4. 大文件注意：`src/scenes/MapScene.ts`（主场景，历史多 Agent 叠加改动，改动前先确认归属）
