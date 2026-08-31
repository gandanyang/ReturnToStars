# MapScene 重构 P8 归档 — CutsceneGuard 统一门控

> **文档性质**：架构重构 Phase 8 正式归档（P0~P7 冻结后的痛点驱动收尾）
> **作者**：AI Agent + 制作人协作
> **版本**：v1.0
> **创建日期**：2026-08-27
> **状态**：P8 PASS ✅（27/27 专项探针 + 回归全绿 + tsc 0 错误；提交 `887f298`）

---

## 第一部分：审计结论

### 1.1 起点

P0~P7 归档时，制作人拍板「不再主动推进 P8，CutsceneGuard 由实际痛点驱动」。本次由制作人点名启动 P8，对 MapScene 内散落的 cutscene 旗标做语义审计后收口。

### 1.2 五个旗标 · 约 56 处引用 · 五种语义模式

| 旗标 | 语义 | 引用规模 |
|---|---|---|
| `inStargazeCutscene` | 观星夜演出窗口 | ~20 |
| `inArtShowCutscene` | 星光艺术展演出窗口 | ~10 |
| `inSpringFairCutscene` | 春日集演出窗口 | 合计 ~16 |
| `inDryyardCutscene` | 秋日晒场演出窗口 | ↑ |
| `firstMorningActive` | 第一章清晨开场窗口 | ~6 |

| 模式 | 含义 | 规模 |
|---|---|---|
| 1 | 互斥守卫（演出之间不叠播） | ~20 处 |
| 2 | 单旗标守卫（某演出期间冻结输入） | ~10 处 |
| 3 | 状态转换（begin/end 生命周期调用） | ~16 处 |
| 4 | 快照传递（GateSnapshot 供 InteractionRouter 决策） | 2 处 |
| 5 | 生命周期管理 | ~6 处 |

---

## 第二部分：实施内容

### 2.1 变更清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/modules/CutsceneGuard.ts` | **新建** | 统一管理 5 个旗标的门控类 |
| `src/modules/InteractionRouter.ts` | **修改** | GateSnapshot 扩展至 5 旗标 + checkGate 门控链补全 |
| `src/scenes/MapScene.ts` | **修改** | 接入 CutsceneGuard，5 个旗标字段改 getter/setter 委托 |
| `src/main.ts` | **修改** | `debug.cutsceneGuard` 测试钩子 |
| `tests/probes/probe-cutscene-guard.mjs` | **新建** | P8 专项探针，27 用例 |

仅 5 文件，零其他改动。

### 2.2 CutsceneGuard 模块设计

```typescript
// src/modules/CutsceneGuard.ts
export type CutsceneId = 'stargaze' | 'art_show' | 'spring_fair' | 'dryyard';

export class CutsceneGuard {
  begin(id) / end(id)                 // scene cutscene 生命周期
  beginWindow() / endWindow()         // window lock（firstMorningActive 专用）
  isActive(id)                        // 单旗标查询
  isAnyActive()                       // 任一 scene cutscene 活跃
  isWindowLocked()                     // 清晨开场窗口锁定中
  isBlocked()                          // cutscene 或 window lock 任一命中
  getActiveIds(): CutsceneId[]         // 活跃清单（调试用）
  getSnapshot()                        // 聚合 5 布尔值 → GateSnapshot
}
```

### 2.3 关键设计决策

1. **getter/setter 委托模式**：MapScene 原 5 个私有布尔字段改为委托 CutsceneGuard 的存取器，全部 ~56 处既有引用**零修改透明切换**，避免机械重命名的回归风险。
2. **firstMorningActive ≠ scene cutscene**：它锁定的是「时间窗」（第一章清晨开场），而非某场具体演出，故用独立的 window lock API（`beginWindow/endWindow`）表达，不混入 `active` 集合。
3. **多旗标优先级固化进 checkGate**：`createFailed > endingPanel > stargaze > art_show > spring_fair > dryyard > morning_window > 面板 > none`，此前散落的互斥判断顺序变为可测的单一路径。

### 2.4 InteractionRouter 变更

- `GateSnapshot` 新增 `inSpringFairCutscene` / `inDryyardCutscene` / `firstMorningActive` 三个字段（原先只覆盖观星夜/艺术展两个）
- `GateResult.dialogue_only.scene` 扩展 `'spring_fair' | 'dryyard' | 'morning_window'`
- `checkGate()` 对应新增 3 个检查分支，优先级见 §2.3-3

### 2.5 明确不做（防过度抽象）

- ❌ 不提取 `withCutscene()` 模板方法（5 场演出差异大，模板会制造假共相）
- ❌ 不合并 morningXiya 等对象生命周期（超出门控职责）
- ❌ 不动 `artShowHeld` / `dryyardHeld` 等独立防重入标记（属剧情进度，非运行时门控）
- ❌ 不清理 storyDialogue 68 处守卫（P0~P7 归档时制作人已拍板保留，属防御性状态守卫）

---

## 第三部分：验证结果

| 验证项 | 结果 | 详情 |
|---|---|---|
| `tsc --noEmit` | ✅ 0 错误 | 无类型兼容问题 |
| `probe-cutscene-guard.mjs`（P8 专项） | ✅ **27/27** | Part1 单元 12 + Part2 setter/getter 委托 7 + Part3 快照覆盖 4 + Part4 多旗标优先级 3 |
| `probe-interaction-gates.mjs` | ✅ 21/21 | 门控回归 |
| `probe-interaction-targets.mjs` | ✅ 19/19 | 目标解析回归 |
| `probe-farm-tap.mjs` | ✅ 全链路 | 交互链路回归 |
| 存档协议（SAVE_VERSION + 字段） | ✅ 未触碰 | CutsceneGuard 为纯运行时状态，零持久化 |
| SHUTDOWN 钩子链 / 地图数据 | ✅ 未触碰 | 零地图与场景清理顺序变更 |

> 探针施工要点：场景内集成测试统一读 `window.__game`（非 `window.game`），断言前校验实例存在，避免启动竞态误报。

---

## 第四部分：提交与后续

```
git commit 887f298 feat(architecture): P8 CutsceneGuard 统一 Cutscene 门控
5 files changed, 518 insertions(+), 10 deletions(-)
推送远端 main：f4c0e89..887f298
```

- MapScene 重构线（P0~P8）全部落地，架构重新进入**冻结状态**
- 后续内容开发按 `docs/CURRENT_TASK.md` 第一章「复苏」方向推进

---

## 变更历史

| 版本 | 日期 | 变更 | 说明 |
|---|---|---|---|
| v1.0 | 2026-08-27 | 初版 | P8 CutsceneGuard 归档 |
