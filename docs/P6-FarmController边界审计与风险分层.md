# P6 FarmController 边界审计与风险分层

> 制作人审批：P5 归档，进入 P6 前置边界设计
> 日期：2026-08-27

## 农场系统全景

### 核心循环

```
时间推进（Action Time）
  ↓
锄地（empty → tilled）
  ↓
播种（tilled → planted，消耗种子）
  ↓
浇水（planted → watered，成长前置条件）
  ↓
等待次日成长（watered → grown）
  ↓
收获（grown → tilled，获得作物）
  ↓
库存 + 金币 + 任务 + 存档 + NPC 剧情
```

### 农场 vs 钓鱼复杂度对比

| 维度 | Fishing | Farming |
|------|---------|---------|
| 状态数量 | 7 个（idle/casting/waiting/fakeBite/realBite/success/fail） | 5 个（empty/tilled/planted/watered/grown）× N 格 |
| 时间依赖 | 单次会话（刷新即丢） | 跨日持久（存档） |
| 资源消耗 | 无 | 种子、体力、时间 |
| 奖励 | 单次鱼 | 作物（可多次） |
| 经济链 | 无 | 金币、经验、任务 |
| 天气影响 | 无 | 农场温暖氛围 |
| NPC 关联 | 老姜台词 | 多个 NPC 剧情 |

### 代码位置统计

| 分类 | 方法数 | 示例 |
|------|--------|------|
| 视觉/装饰 | ~15 | setupFarmTiles, setupFarmDecorations, updateTileVisual |
| 交互入口 | ~10 | tryFarmInteract, handleFarmTap, interactPlot |
| 作物生命周期 | ~8 | tillTileAt, plantTileAt, waterTileAt, harvestTileAt |
| 经济链 | ~10 | addItem, addXp, consumeStamina, consumeMinutes |
| DOM | ~4 | seedSelectorEl, seedSwitchBtn, cropPickerEl |
| 温暖系统 | ~5 | farmWarmOverlay, farmWarmParticles, updateFarmWarm |

---

## 风险分层设计

### P6a：Farm 视觉/装饰（风险：低）

**迁移范围**：
- `setupFarmTiles()` - 设置农场瓦片
- `setupFarmDecorations()` - 农场装饰
- `setupFarmAmbience()` - 农场环境
- `setupFarmTreeGroves()` - 农场树丛
- `createFarmBird()` - 农场小鸟
- `setupFarmWarm()` / `playFarmWarmPulse()` / `updateFarmWarm()` - 温暖氛围
- `farmWarmAlphaForHour()` / `farmWarmSkyAlphaForHour()` - 温暖参数
- 视觉更新相关：`updateTileVisual`, `refreshPlotVisual`

**保留在 MapScene**：
- 瓦片数据初始化（与地图加载耦合）
- `tileRects` 管理（与场景生命周期绑定）

**理由**：纯视觉/DOM 操作，无状态依赖，类似 P4 WorldDecorator。

---

### P6b：Farm 交互入口（风险：中）

**迁移范围**：
- `tryFarmInteract()` - 单格交互入口
- `handleFarmTap()` - 移动端点击处理
- `tryFarmInteractAt()` - 单格操作调度（不含具体执行）
- `interactPlot()` - Plot 批量交互入口
- `startBatch()` - 批量操作执行器（调度层）
- `flashPlotError()` / `drawPlotHighlight()` / `updatePlotTargetHighlight()` - 视觉反馈
- `seedSelectorEl` / `seedSwitchBtn` / `cropPickerEl` - DOM 管理

**保留在 MapScene**：
- 实际操作执行（tillTileAt/plantTileAt 等）
- 状态机判断逻辑

**理由**：交互调度逻辑复杂，但数据操作分离。类似 P5b DOM/hint 层。

---

### P6c：Crop 生命周期（风险：高）

**迁移范围**：
- `tillTileAt()` - 锄地（empty → tilled）
- `plantTileAt()` - 播种（tilled → planted）
- `waterTileAt()` - 浇水（planted → watered）
- `harvestTileAt()` - 收获（grown → tilled）
- `getCropVisualStage()` - 作物成长阶段判定
- 首次标记：`firstHoe` / `firstPlant` / `firstWater` / `firstHarvestShown`

**外部依赖（Hooks 注入）**：
- 状态读写：`getTileState`, `setTileState`, `getCrop`, `setCrop`
- 背包：`getItemCount`, `addItem`
- 体力/时间：`consumeStamina`, `consumeMinutes`
- 经验：`addXp`
- 任务：`onDQPlant`, `onDQWater`, `onDQHarvest`
- 教程：`checkTutorialProgress`
- 音效：`play('hoe'|'plant'|'water'|'harvest')`
- 对话：`showDialogueText`
- 存档：`save`

**保留在 MapScene**：
- 视觉反馈（seedDrop, waterSplash, harvestPop 等）
- `showMemoryMoment` 调用
- 剧情触发（triggerOnce, triggerTag）

**理由**：核心状态变更，涉及 Action Time 消耗顺序。需要严格验证时序。

---

### P6d：收获与经济链（风险：高）

**迁移范围**：
- 收获物品分配逻辑
- 金币计算
- NPC 剧情触发
- 任务完成回调
- 经济平衡检查

**保留在 MapScene**：
- 经济系统核心（InventorySystem）
- 价格/商店逻辑
- 剧情系统（StorySystem）

**理由**：涉及多个系统的协作，边界最复杂。

---

## 接口设计草案

### FarmHooks 接口

```typescript
export interface FarmHooks {
  // 状态读写
  getTileState(col: number, row: number): TileState;
  setTileState(col: number, row: number, state: TileState): void;
  getCrop(col: number, row: number): CropData | null;
  setCrop(col: number, row: number, crop: CropData | undefined): void;
  
  // 背包
  getItemCount(id: string): number;
  addItem(id: string, count: number): void;
  
  // 体力/时间
  consumeStamina(cost: number): boolean;
  consumeMinutes(minutes: number): void;
  getActionStaminaCost(action: string): number;
  getActionTimeCost(action: string): number;
  
  // 经验
  addXp(amount: number, source: string): void;
  
  // 任务
  onDQPlant(): void;
  onDQWater(): void;
  onDQHarvest(cropType: CropType): void;
  
  // 教程
  checkTutorialProgress(action: 'till' | 'sow' | 'water'): void;
  
  // 音效
  playSfx(name: string): void;
  
  // 对话/提示
  showDialogueText(text: string): void;
  showFloatText(x: number, y: number, text: string, color?: string): void;
  
  // 存档
  save(x: number, y: number, scene: string, facing: number): void;
  
  // 玩家位置
  getPlayerPos(): { x: number; y: number; facing: number };
  
  // 地块视觉对象管理
  getTileRect(col: number, row: number): CropVisualData | null;
  updateTileVisual(col: number, row: number): void;
}
```

---

## 风险点与验证策略

### 1. Action Time 时序（P6c）

```
原时序（MapScene.tillTileAt）：
1. consumeStamina（体力闸，不足则不执行）
2. setTileState（状态变更）
3. triggerTag / showMemoryMoment（首次事件）
4. consumeMinutes（时间消耗）
5. return true

必须保持的顺序：
- 体力检查必须在状态变更之前
- 时间消耗必须在状态变更之后
- 首次事件必须在状态变更之后、时间消耗之前
```

### 2. 批量操作数据一致性（P6b）

```
startBatch 流程：
1. 收集所有 affected tiles
2. 调用 tillTileAt/plantTileAt/waterTileAt/harvestTileAt
3. 更新视觉
4. 更新 HUD

风险：单个操作失败时，批量操作应部分成功
验证：每个操作返回 boolean，汇总 affected 列表
```

### 3. 经济链完整性（P6d）

```
收获流程：
1. setTileState → tilled
2. setCrop → undefined
3. addItem → 物品入库
4. addXp → 经验增加
5. onDQHarvest → 任务更新
6. consumeMinutes → 时间消耗
7. save → 存档

验证：物品、经验、任务、时间必须全部正确更新
```

### 4. 存档兼容性

```
现有存档结构：
- tiles: 二维数组，存储 TileState
- crops: 二维数组，存储 CropData

P6 抽离不改变存档结构，仅改变运行时逻辑。
```

---

## 验收标准

| 阶段 | 验收标准 |
|------|----------|
| P6a | tsc 通过 + Farm 视觉正确渲染 |
| P6b | tsc 通过 + 单格/批量交互正确 |
| P6c | tsc 通过 + 状态机完整 + Action Time 时序验证 |
| P6d | tsc 通过 + 经济链完整 + 存档正确 |

---

## 建议执行顺序

1. 先完成 P6a（视觉/装饰）—— 低风险，快速建立 FarmController 骨架
2. 再完成 P6b（交互入口）—— 中风险，验证 DOM 管理
3. 然后 P6c（作物生命周期）—— 高风险，需要专项测试
4. 最后 P6d（收获与经济链）—— 最高风险，涉及多个系统

每个阶段完成后：tsc 编译 + 核心探针 + 手动验证

---

制作人确认后可开始 P6a。
