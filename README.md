# 《归星物语》

> **一座等待复苏的岛，一段慢慢回来的生活。**
>
> 像素风 · 治愈系 · 荒岛生活复兴 RPG —— Phaser 3 + TypeScript + Vite

《归星物语》是一款以"岛屿复兴"为核心循环的像素生活 RPG。玩家作为归星岛的旅人，在荒废的岛上重新开垦农田、修复建筑、结识居民，让一座被遗忘的岛屿一点点恢复生机——**玩家不是"操作种田 UI"，而是在这里生活**。

目标：15~30 分钟的完整 Demo 体验，让每位玩家在半小时内获得——一次星空体验、一轮完整的农业循环、一次 NPC 的情感反馈、一次世界的变化。

## 在线试玩

**腾讯云在线版（无需下载，浏览器直接打开即可玩）：**

👉 https://65957d6122464b4ab53c6e20a06a527a.app.workbuddy.link

> 手机端请横屏游玩（标题画面有旋转引导）；PC 端推荐 Chrome。

---

## 版本

**v0.10 Alpha** — 稳定阶段：岛屿复兴循环 v0.11 + 第一章小镇剧情 + 观星夜 v2 + 心语任务（春深有信）+ 生活仪式感系统 + 声音补全计划 v1.0。面向 15~30 分钟完整体验 Demo 收口。

> 开发纪律见 `AGENTS.md`；测试规范见 `TEST_RULES.md`；近期改动见 `CHANGELOG.md`。

## 快速开始

```bash
npm install
npm run dev      # 开发服务器（默认 http://localhost:5173）
npm run build    # 生产构建 → dist/
npm run preview  # 本地预览构建产物
```

## 核心循环：岛屿复兴

```
劳动（种田 / 砍树 / 挖矿）
        ↓
   获得资源
        ↓
   修复岛屿（花园 / 老屋 / 道路）
        ↓
   世界变化（复兴度 Lv0 → Lv1 → Lv2，木匠回归、商店热闹起来）
        ↓
   产生情感（居民的回应、记忆的浮现）
```

复兴度由三处建设点派生（`getRevivalLevel`）：花园恢复 → 初步复兴；老屋修复 → 木匠回归；道路通联 → 小型社区。**玩家的每个行为都会让这座岛真实地"往前走一步"**。

## 特色系统

### 🌱 生活仪式感系统（v1.0）
普通操作有即时手感（锄地土屑、播种落种、浇水吸水），第一次行为有小型仪式（first_hoe / first_plant / first_water / first_harvest）——第一次收获时，作物会被捧起来看一秒。**让"我亲手做了这件事"成为身体记忆**。

### 🗺️ 心语任务（角色剧情体系）
夏雅《春深有信》——角色专属剧情任务的首个实例：四段式剧情演出（开场 → 整理花苗 → 旧花种记录 → 收尾伏笔），专属 BGM、语音、记忆卡完整配套。

### 🏪 青禾镇商店复兴（SHOP-01）
17 种商品覆盖农业 / 岛屿修复 / 生活装饰三类；商店老板是"复兴度的观察者"——从"好久没人买这么多东西了"到"没想到这间店还能重新热闹起来"，台词随岛屿复兴档位推进。

### 🎵 声音补全计划 v1.0
- **BGM**：主题曲《Stars Gather》、青禾镇、农场、观星夜、夏雅《春深有信》专属音乐、林澈个人曲《The Waiting Shore》
- **SFX**：种田四件套 + 任务/修复/碎片交付成就感音效 + UI 高频音，全部 Web Audio 程序合成（零外部文件）
- **环境音**：每张地图昼夜两层氛围——农场的远处海浪与海鸥、青禾镇的鸟叫与犬吠、森林的树叶与虫鸣

### ✨ 观星夜 v2
三段式镜头演出 + 流星 + 小镇灯光，岛屿在星空下安静呼吸。

### 🎙️ 语音系统
角色台词经 MiniMax（T2A v2）管线生成，Web Audio 按（角色, 台词）映射播放，找不到音频静默跳过、不阻塞对话。

## 操作

| 操作 | 键位 (PC) | 触屏 (移动端) |
|---|---|---|
| 移动 | WASD / 方向键 | 虚拟摇杆 |
| 交互 | E / 空格 / 回车 | 交互按钮 |
| 砍树 / 挖矿 | 靠近目标按 E | 靠近目标点交互按钮 |
| 背包 | B | 背包按钮 |
| 商店 | 靠近商人按 E | 靠近商人点交互按钮 |
| 切换种子 | R | 切换按钮 |
| 系统菜单 | Esc | Android 物理返回键 |

> 手机端横屏游玩（标题画面有旋转引导；移动端适配以横屏 844×390 为基准）。

## 技术栈

| 层 | 技术 |
|---|---|
| 游戏引擎 | Phaser 3.80 |
| 语言 / 构建 | TypeScript / Vite |
| 美术 | 程序化像素生成（v2 像素风，统一调色板 + 1px 描边）+ GPT tileset 标准化管线 + AI 立绘 |
| 音频 | Web Audio（BGM / 环境音 / SFX 全程序合成，防 IDM 播放）+ MiniMax 语音 |
| 移动端 | Capacitor 8（Android APK 打包） |
| 自动化验证 | Puppeteer 行为探针（tests/probes/） |

## 目录结构

```
src/
├── main.ts                  # 游戏启动入口（9 个场景 + Debug API）
├── scenes/
│   ├── TitleScene.ts        # 标题画面
│   ├── StationScene.ts      # 车站开场（序章）
│   └── MapScene.ts          # 通用地图场景（gate/farm/town/forest/mine/house/elder_house 共用）
├── entities/                # Player / NPC
├── data/                    # FarmState / Economy / Inventory / TimeSystem / 复兴进度（FarmRestore）等
├── systems/
│   ├── SaveSystem.ts        # 存档（唯一持久状态入口）
│   ├── StorySystem.ts       # 主线剧情（冻结区，只读导入）
│   ├── QuestSystem.ts       # 主线任务（星之碎片）
│   ├── DailyQuestSystem.ts  # 每日任务
│   ├── EventManager.ts      # 一次性事件（入档 / 读档不重复）
│   ├── GuiXingRecordSystem.ts # 归星记录（行为标签）
│   ├── NPCSystem.ts         # NPC 作息 / 站位 / 台词
│   ├── AudioSystem.ts       # SFX（程序合成）
│   ├── MusicSystem.ts       # BGM 播放（Web Audio + antiIDM）
│   ├── AmbienceSystem.ts    # 环境音（地图 × 昼夜）
│   └── AutomationSystem.ts  # 庄园机器人自动化
├── audio/                   # VoiceBank 语音播放 / 语音映射数据
└── ui/                      # 商店 / 背包 / 任务 / 对白 / 记忆闪回 / 相册 / 结局等 DOM 面板

public/assets/               # 素材（地图 / 瓦片 / 精灵 / 立绘 / 音频 / 相簿）
art_source/                  # 美术源文件（AI 原稿 / 工作版 / 原始批次，可追溯可再生成）
tools/                       # 生成管线（像素美术 / 语音 / GPT tileset / APK 打包等 50+ 脚本）
tests/probes/                # Puppeteer 行为探针（每个功能有验收探针）
```

## 测试

```bash
npx tsc --noEmit             # TypeScript 类型检查
npm run build                # 生产构建
node tests/probes/<probe>.mjs  # 单探针（需 dev server 运行在 5173）
```

测试规范详见 `TEST_RULES.md`：按修改影响范围分级（Level 0-3）。探针覆盖教程流程 / 切图稳定性 / 砍树 / 主线 / 语音链路 / 环境音 / 商店 / 生活仪式感等。
