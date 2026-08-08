# 任务：夏雅《春深有信·一》Demo Cut（心语任务）

> 状态：✅ 已实现并验证（2026-08-08）｜决策依据：DESIGN_DECISIONS.md D-011（2026-08-08 制作人拍板）
> 体系：**「心语任务」首个实例**（D-012，2026-08-09 制作人拍板：角色剧情任务统一命名心语任务）——本卡/后续文档/代码一律称「心语任务」
> 范围：Alpha Demo Cut，只做第一章核心体验 5 步；**不做好感系统 / 章节系统 / 心语任务框架**（P2 Beta）
> 剧情权限：对白文本**逐字取自** `docs/design/character/夏雅角色篇章-春深有信-v1.0.md` 第一章定稿，**不得扩写或改变**；实现仅落档与接线。

## 0. 实现与验证记录（2026-08-08）

- ✅ `src/systems/StorySystem.ts`：新增 `XIYA_LETTER_OPEN/FLOWER/RECORD/FINAL_DIALOGUE` 4 组对话（L435-508，逐字提取定稿，未扩写）
- ✅ `src/scenes/MapScene.ts`：flags/字段/save/apply/生成逻辑/4 段交互/标记全部接线（`setupLetterXiya` + `tryXiyaLetterInteract` 4 段逐步交互）
- ✅ `src/ui/QuestPanel.ts`：`QuestFlags` + `SIDE_QUESTS` 注册 `xiya_letter`《春深有信·一》
- ✅ `tests/probes/probe-xiya-letter.mjs`（新建）：**18/18 全绿**（A 开场/B 花苗/C 记录/D 收尾/E 面板/F 读档恢复 stage1/G 完成后重进/H 无错误）
- ✅ 回归：`probe-quest-panel-side` 10/10、`probe-e1e9-persist` 8/8、`probe-t3-npc-events` 16/18→18/18（修木匠回归演出劫持）
- ✅ `npx tsc --noEmit` 通过

**探针关键经验**：
1. 「院子有人照顾」支线（`trySideXiyaGarden`）锚点=花田中心，`restore.garden=true` 时会劫持探针按 E → 探针存档注入 `sideXiyaGardenAsked/Done=true` 规避
2. 木匠回归演出（`tryCarpenterReturn`，`restore.oldHouse=true` 时 delayedCall 2.6s 自动播对白）会劫持探针文本断言 → 注入 `gameState.triggeredEvents['carpenter_returned']=true` 跳过
3. 对话结束回调（清理/生成）发生在 play 完成后 → 断言用 `drainDialogue` 等场景状态而非仅文本出现

## 1. 制作人确认的实现决策

| 决策点 | 拍板 |
|---|---|
| 夏雅载体 | **独立剧情夏雅**：剧情触发时在花田边临时生成（参照 E9 傍晚夏雅创建模式），不碰 E9 日常闲聊逻辑 |
| 剧情拆段 | **4 段逐步交互**：开场 → 互动一（花苗）→ 互动二（旧花种记录）→ 收尾（埋伏笔） |
| 「旧花种记录」落地 | **仅对话 + 记忆 moment**（不入背包，不新增 Inventory 物品；记忆卡文本用物品名「旧花种记录」，不扩写） |

> ⚠️ 注：设计文档 L135「【获得物品】：「旧花种记录」」按制作人拍板改为「记忆 moment 表现」——Decision Override Rule 生效，实现以本卡为准。

## 2. 剧情流程（对应设计文档行号）

- **触发条件**：farm 场景 + `isTutorialDone()`（完成新手引导：播种/浇水/收获）+ 时段 `12:00 <= hour < 20:00`（下午/傍晚）+ `xiyaLetterDone !== true`
- 满足时花田边生成独立剧情夏雅（npc_xiya sprite + 「夏雅」label + 交互检测）

| 段 | 交互目标 | 对话组 | 来源 | 之后 |
|---|---|---|---|---|
| A 开场 | 靠近夏雅按 E | 演出（夕阳田埂）+ 对白 16 句 | 设计 L47-119 | 设 `xiyaLetterAsked=true` + save；生成「花苗」交互点 |
| B 互动一 | 「花苗」交互点 | 6 句（快的话几天/慢的话一个季节） | 设计 L121-131 | 生成「旧花种记录」交互点 |
| C 互动二 | 「记录」交互点 | 6 句（写了好多年/失败也算种过）+ `showMemoryMoment('获得「旧花种记录」')` | 设计 L133-142 | 生成「夏雅」收尾交互点 |
| D 收尾 | 「夏雅」交互点 | 对白续 6 句 + 演出（风/路灯）+ 埋伏笔 4 句（下周岛上有个小活动） | 设计 L149-175 | 设 `xiyaLetterDone=true` + 销毁夏雅与全部交互点 + save |

- **完成**：《春深有信·一》完成态入 QuestPanel 支线；「夏雅好感剧情入口 / 春祭准备阶段 / 烟花活动前置」以完成态标记占位（不建系统，伏笔已在 D 段对话埋下）

## 3. 修改文件清单

| 文件 | 改动 |
|---|---|
| `src/systems/StorySystem.ts` | 新增 4 组对话：`XIYA_LETTER_OPEN/FLOWER/RECORD/FINAL_DIALOGUE`（逐字提取定稿） |
| `src/scenes/MapScene.ts` | `MapSceneFlags` + 实例字段 + save/apply + 花田夏雅生成逻辑 + 4 段交互函数 + 交互点标记（参照 `trySideXiyaPhoto` / `xiyaPhotoMark` 模式） |
| `src/ui/QuestPanel.ts` | `QuestFlags` 接口 + `SIDE_QUESTS` 注册 `xiya_letter`《春深有信·一》（isUnlocked=Asked, isDone=Done） |
| `docs/tasks/任务-夏雅春深有信DemoCut-v1.0.md` | 本卡 |

不涉及：SaveSystem 结构、QuestSystem、Inventory、时间系统、其他场景。

## 4. 存档兼容

- 新增字段均 optional（`xiyaLetterAsked?/Done?`），旧档 apply 默认 false，**不影响现有存档读取**
- 完成后 `save()` 写入（与既有支线一致）

## 5. 测试要求（Level 2）

- `npx tsc --noEmit` 通过
- 剧情流程探针：新档 → 教程（锄/播/浇/收获）→ `setTime(16,0)` → 回 farm → 4 段依次交互 → 完成态 → QuestPanel 显示完成 → 存档可读（重进场景不重复触发）
- 回归：E9 傍晚夏雅闲聊不受影响（独立 NPC 互不干扰）

## 6. 验收口径

- 玩家：完成教学后某天下午/傍晚在农场花田边遇到夏雅 → 完整体验第一章 5 步 → 任务面板《春深有信·一》完成 → 对话中已埋春祭/烟花伏笔
- 稳定性：触发一次后不再重复；读档可续；不阻塞主线
