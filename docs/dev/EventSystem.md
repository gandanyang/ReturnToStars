# 事件系统契约：triggerOnce 时序规则（项目规则，2026-08-12 制作人拍板）

> 所有 Agent 在编写一次性事件（剧情 / 记忆 / 相簿 / 支线 / NPC 事件 / 世界恢复）时必读。
> 违反本规则会导致：**漏存档（读档后事件重复触发）** 与 **全完成判断漏判（聚合事件永不触发）**。

## 核心时序：先执行 fn，再标记状态

`EventManager.triggerOnce(id, fn)` / `triggerOnceIf(id, cond, fn)` 的执行顺序是：

1. （triggerOnceIf）先 `evalCondition(cond)`——章节 / 主线 / 恢复点任一不满足 → 直接返回 false，不触发不记录
2. 执行 `fn()`（事件内容）
3. **之后**才标记 `triggeredEvents[id] = true`

**不是**"先标记再执行"。当前 key 在整个 fn 执行期间都是"未触发"状态。

## 后果（必踩的坑）

因为"先执行 fn 后标记"，在 fn 内部做这两件事会出错：

- ❌ `save()` → **漏存当前 key**：此刻 `triggeredEvents[id]` 还是 false，存档里没有这个 key；读档后条件事件再次满足 → 事件重复触发。
- ❌ "是否全部完成"的判断 → **漏判当前 key**：例如第 4 个事件完成后在 fn 内检查"4 个都完成了？"会得到 false，因为当前 key 还没标记。

## 正确写法

```ts
// 只把"事件本身"（视觉 / 反馈 / 演出）放进 fn
const ok = triggerOnceIf('ch1_lamp_done', { chapter: CHAPTER_1 }, () => {
  this.onTidyItemDone(item); // 视觉 + 反馈台词，不含存档、不含全完成判断
});
if (!ok) return;
// ★ triggerOnceIf 已返回：当前 key 此刻已标记
save({ x: this.player.x, y: this.player.y, scene: this.mapKey }); // 存档放这里，才能带上当前 key

// 全完成判断也放 triggerOnceIf 之后（而不是 fn 内）
if (isHouseTidyComplete()) {
  triggerOnce('ch1_house_tidy_done', () => { /* 聚合演出 */ });
  save({ ... }); // 聚合事件标记后需再存一次，否则读档后聚合事件丢失
}
```

## 反例（禁止）

```ts
triggerOnce('xxx', () => {
  save();          // ❌ 漏存当前 key
  checkComplete(); // ❌ 漏判当前 key（此时当前 key 尚未标记）
});
```

## API 选择

| 场景 | 用 |
|---|---|
| 事件有触发条件（章节/主线/恢复点） | `triggerOnceIf(id, { chapter / quest / restore }, fn)` |
| 无条件纯一次性 | `triggerOnce(id, fn)` |
| 只读判重 | `hasTriggered(id)` |
| 迁移/调试/恢复历史状态 | `markTriggered(id)`（不执行事件） |

- 事件 key 命名：`ch1_<行为>_done`（玩家完成了一次叙事行为）；聚合事件 `ch1_<行为群>_done`（如 `ch1_house_tidy_done`）。
- 派生状态（如 `getHouseTidyLevel()`）只读 `hasTriggered` 计数，**零新增存档字段**。

## EventCondition v1 冻结（制作人 2026-08-12 拍板）

- 只允许 `chapter` / `quest` / `restore` 三字段，**禁止扩展**（npc / item / time / weather / relationship / money 一律不加）。
- 条件组合超过三字段时：**先用 triggerOnceIf 判断主条件，再用 triggerOnce 记录**，或在调用层自行组合判断（时间 / 进度等派生条件写在调用层，见 `MapScene.tryElderVisitSequence`）。

## 存档纪律

- EventManager **不隐式存档**；调用方负责在 `triggerOnce` / `triggerOnceIf` **返回之后**（非 fn 内）调用 `save()`。
- 聚合事件触发后同样需要一次 `save()`。

## 已按本规则施工的参考实现

- `MapScene.tryHouseTidyInteract`：4 个整理点 + 聚合事件 `ch1_house_tidy_done`（存档在 triggerOnceIf 返回后）。
- `MapScene.tryElderVisitSequence`：村长来访 `ch1_elder_visit`（时间/进度派生条件在调用层组合）。
- `MapScene.tryCarpenterReturn` / `tryAdventurerWelcome`：一次性演出。
