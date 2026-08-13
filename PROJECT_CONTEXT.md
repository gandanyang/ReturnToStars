# 归星物语 · 当前开发状态快照（PROJECT_CONTEXT）

> 生成时间：2026-08-08（开发暂停时快照，供下次开工快速恢复上下文）
> 关联文档：`AGENTS.md`（开发指南）｜`docs/AI_CONTEXT.md`（平台/设备约束）｜`docs/AI_GUARDRAIL.md`（红线）｜`docs/DESIGN_DECISIONS.md`（制作人决策库）

---

## 一、项目定位

- 名称：《归星物语》（star-valley-anime）
- 一句话目标：前 15 分钟内，让玩家从"我在玩种田游戏"变成"我在让一个快消失的地方重新开始生活"。
- 阶段：进入 **Alpha 稳定阶段**，目标产出 **15~30 分钟完整体验 Demo**（2026-08-08 起进入 **v0.10 收口施工**）。
- 核心判断（制作人 P0 审查结论）：《归星物语》不是缺内容，是**玩家还没产生"这是我的岛"的感觉，游戏就开始讲"这里有秘密"**。当前最高优先级工作是"情感翻译层"——为已有系统补情绪锚，而非加内容。
- 平台：**只支持手机横屏**（Android 强制 `screenOrientation="landscape"`；竖屏被 `index.html` 的 `#rotate-hint` 全屏遮挡并引导旋转）。禁止按竖屏手游设计、禁止竖屏适配、禁止用竖屏视口验收。

## 二、技术栈

| 层 | 选型 |
|---|---|
| 游戏引擎 | Phaser 3.80（TypeScript 5.4） |
| 构建 | Vite 5.2 |
| 打包 | Capacitor 8.5 Android（APK 产物 `dist_apk/latest-release.apk`，约 28MB） |
| 测试 | Puppeteer-core 探针（`tests/probes/*.mjs`）+ `tsc --noEmit` |
| 世界/存档 | 800x600 画布基线；16x16 像素网格（Tiled，Ground/Walls 双层，tools 统一管线）；存档在 localStorage |
| 美术管线 | GPT tileset（`tools/gpt_tileset_normalizer.py` v1.1 + `tools/star_island_palette.json` 锚点调色板 + `tools/prompts/*.txt`） |
| 配音 | MiniMax T2A v2 云端 API（优先，详见 `docs/MiniMax语音生成工具手册.md`），VoxCPM 仅作离线备选（`tools/tts.mjs` / `tools/minimax_tts.ts` / `tools/gen_*` 脚本；ogg 44.1kHz stereo，-16 LUFS 标准化）；`src/audio/voicebank.data.ts` 精确匹配 |

## 三、当前版本与基线

- 最新提交：`94c1495`（2026-08-08，配音批量补录 + 前 15 分钟体验重构 P0-1/2 + 森林观景台/碎片情感化 + AI 诊断文档，423 文件）
- 事故恢复基线：`556230b`（tag `disaster-recovery-20260806`）
- 里程碑：`94c1495`（本次）→ `.484d67`→ `4df6987`（夏雅灯闪回配剧照）→ `021dc63`（阿风配音）→ `bef1a02`（店铺老板"镇子热闹了"）

## 四、已完成系统

- **场景**：farm / town / forest / house / mine / gate / StationScene（车站）/ TitleScene（标题），6 张 tileset 已全量 GPT+normalizer 管线统一
- **核心玩法**：种植（锄地/播种/浇水/收获）、日程（睡觉/时间流速 1min≈2h）、背包、NPC 对话与每日任务、商店（首次卖出作物触发"镇子热闹了"）、星之碎片收集
- **剧情/叙事**：StorySystem（STATION / 教程 / 后山 / 观星等 dialogue 常量）、StoryDialogue（含 options 选项行、跳过、打字机）、MemoryFlashback（记忆回响）、观星 5 段
- **移动端适配（P0 已收口）**：摇杆 + 交互/背包按钮（TouchControls）、`isMobileLayout()` / `isTouchDevice()` UA 判定（BUG-016/025/030/033/034 已修）、横屏 FIT + 横向黑边（制作人接受）、竖屏 rotate-hint
- **配音**：村长（MiniMax 搞笑大爷声线）、林澈（男声电子）、夏雅、阿风、老人等已批量接入；audition 试听页在 `public/audition_*.html`
- **探针**：`tests/probes/`（tutorial 11/11、mobile-ux、bug030-034、rotate-hint 3/3 等）

## 五、未完成任务（待办）

### P0（体验收口，当前主线）——前 15 分钟重构 P1/P2/P3 三部分
- P1 序章·车站（已开工，**进行中**）：独白压缩 4-5 句、手机通知两页合并一页、出发前主动选择「现在就走吗？/再看看这里。」代码已改（探针未通过）；目的地锚"爷爷把这里留给了你"待验证
- P2 教程·庄园（P0-1 锄地/播种/浇水/收获 4 句情感化）**已完成**（tsc 通过 + 教程探针 11/11）
- P3 探索·岛（后山 trigger 链路：老树→观景台→碎片，只读审查通过不拆）；少女句"它已经很久没有这样亮过了"

### 其他已知
- 排期在 `docs/design/前15分钟体验重构表-v0.1.md`（P0-1/2/3 落点表）
- 其余问题看「问题追踪.md」

## 六、当前工作点（opencode 就近任务）

1. **P0-3 站台改造（代码已改，待探针验证通过后提交）**：
   - `StationScene.ts` `playStationDialogue` 带 `onChoice` 收尾：选择后 `finishStationPrologue` → advanceStory→station_move + canMove + hideSkipButton + showMoveHint（选项行不触发 onComplete，在 onChoice 收尾）
   - 手机通知改单页合并（`PHONE_NOTIFY_VOICE_TEXT`，点击一次关闭 + 播放系统音）
   - `showMoveHint` 显示 DOM `#station-move-hint`（zIndex 400，5 秒后自动清除）
2. **探针 `tests/probes/probe-mobile-text.mjs` v6 已修横屏问题**（375x812 竖屏 → 844x390 横屏 + Android UA 注入）；但 5 项中仅标题 1 顶通过，阻塞在"手机通知未出现"——需查横屏下通知触发条件（是否仍取 375 竖屏分支，或 dev server 时序）
3. 验证通过后：提交站台改动（只暂存自己改的文件：StationScene.ts / StorySystem.ts；禁止 `git add -A`）→ 生成本项目快照 COMPLETE

### 流程红线（继续施工前必读）
- 配音统一后置：先文本稳定 → 阵容稳定 → 体验确认 → 最后统一 VoiceBank 匹配/补录，不为了单一句打断流程
- 站台改动按"方案 A（先改文本，配音后续统一补）"；StationScene 文本保留 station_01~04 才能继续匹配 `voiceBank.data.ts`
- 只改 StorySystem 台词常量式修正；不增删 dialogue 行（保持 skip 计数/自动推进）；不动 story step/存档/触发逻辑

## 七、制作人设计原则

- 稳定 > 新功能；完成一个闭环 > 加满十个半成品
- 用"情感翻译层"翻译数据流：教程步骤要翻译成"给爷爷的地方一个开始"
- 玩家选择只影响情绪/顺序，不改主线走向（如「现在就走吗？」选项不改变剧情结果）
- 叙事权限：主角成长/角色身份/世界观真相/关键剧情节点，Agent 不得自行扩写（顶层设计.md > 功能规划.md > Agent 建议）
- 移动端只横屏：禁止竖屏设计，横屏 FIT + 黑边（制作人已拍板接受，不追求撑满）

## 八、禁止事项（未获授权不得做）

- 新增战斗 / 抽卡 / 大地图 / 复杂养成 / 后端 / 重构架构 / 替换 Phaser
- 大规模修改已有系统
- ❌ 竖屏适配/竖屏验收（移动端只横屏）
- 未经制作人拍板大改文案（剧情权限规则）
- 多 Agent 并行时 git 写操作必须独占：只 `git add` 自己改的文件，禁止 `git add -A` / `git add .` / 宽泛暂存；提交由 opencode 或制作人执行；配音打包前必须先本地试听、制作人确认
- ❌ 使用 MiniMax voice_design 接口（单次 9.9 元，2026-08-13 制作人拍板）；新角色音色改用本地 TTS（IndexTTS 等）或已有音色克隆。配音优先 MiniMax T2A v2，VoxCPM 仅作离线备选

## 当前最高优先级

1. **P0 前 15 分钟体验重构收口**（P1 序章·车站正在进行，程序员阻塞在探针"手机通知未出现"）
2. 稳定 > 速度：改完必须 `tsc --noEmit` + 跑相关探针；遇到异常先看是否探针自身问题
3. 移动/触屏验证统一用**横屏视口 + Android UA**（844x390），竖屏测出的失败不是 bug（竖屏被 rotate-hint 遮挡）