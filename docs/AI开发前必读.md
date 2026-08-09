# AI 开发前必读（门禁）

每个任务开始前，先读完下面 3 份再动手：

1. `AGENTS.md`（项目规则）
2. `docs/AI开发前必读.md`（本文件）
3. `docs/开发约束与架构入口.md`（架构入口 + 检查清单）

核心规则（违反了就是返工）：

- **不重复造系统**：动手前先查 `src/systems/`、`src/data/`、`docs/tasks/` 有没有类似的。
- **持久状态只进 `SaveSystem`**（SaveData），禁止 localStorage / scene / global 散落。
- **一次性事件**（剧情 / NPC 事件 / 相簿解锁 / 记忆卡 / 彩蛋 / 支线）一律 `EventManager.triggerOnce`。
- **新增文件前**先输出"已有系统检查：复用方案 / 新增文件 / 修改文件"，确认再写代码。
- **行为不变的重构默认不做**；稳定优先。
- **ComfyUI 生图默认工作流**：`workflow/anima_turboV10.json`（anima turbo），禁止自行选用/新建其它默认工作流。

已有可直接用的：`SaveSystem` / `EventManager` / `StorySystem` / `QuestSystem` / `DailyQuestSystem` / `PhotoAlbum` / `NPCSystem` / `AmbienceSystem`。

已有工具脚本：`tools/` 下 50+ 个（语音/出图/音频/打包，先查再写）；**GPT 请示桥** `tools/gpt-bridge.mjs`（网页版 ChatGPT 传话，制作人要求"请示 GPT"时用，见 `docs/工具-GPT请示桥.md`）。

---

## AI 项目记忆层（开工快速定位）

| 问题 | 文件 |
|---|---|
| 这个游戏是什么？ | 根目录 `PROJECT_CONTEXT.md` + `docs/AI_CONTEXT.md` |
| 什么不能做（设计）？ | `docs/DESIGN_RULES.md` |
| 什么不能做（施工）？ | `docs/AI_GUARDRAIL.md` |
| 现在干什么？ | `docs/CURRENT_TASK.md` |
| 为什么这么决定？ | `docs/DESIGN_DECISIONS.md` |
| 历史变化？ | 根目录 `CHANGELOG.md` |

> 开工顺序：**AGENTS.md → 本文件 → AI_GUARDRAIL.md → CURRENT_TASK.md → 对应任务文档**。
