# MapScene 重构 P1 归档 + P2 边界锁定

> **文档性质**：架构重构 Phase 0~1 正式归档与 P2 前置审批文档
> **作者**：AI Agent + 制作人协作
> **版本**：v1.0
> **创建日期**：2026-08-26
> **状态**：P1 PASS ✅ ｜ P2 待制作人批准

---

## 第一部分：P1 CameraDirector — 正式归档

### 1.1 变更清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/modules/CameraDirector.ts` | **新建** | 相机三件套封装：centerOn / panTo / zoomAt |
| `src/scenes/MapScene.ts` | **修改** | 注入 cameraDirector 字段 + 初始化 + 三方法改为委托 |

仅 2 文件，零其他改动。

### 1.2 CameraDirector 模块设计

```typescript
// src/modules/CameraDirector.ts
export class CameraDirector {
  constructor(cam, tweens) { ... }
  centerOn(wx, wy)       // 立即居中
  panTo(wx, wy, dur, cb?) // 平滑缓推 + zoom 补偿
  zoomAt(wx, wy, zoom, dur, cb?, preStart?) // 围绕世界点缩放
}
```

- 零 MapScene 状态依赖（仅持有 Camera + TweenManager）
- `preZoomStart` 回调保留跨域清理点（stargazeDriftTween 停止）
- 依赖注入，非全局单例

### 1.3 MapScene 改动

1. `import { CameraDirector } from '../modules/CameraDirector'`
2. `private cameraDirector!: CameraDirector;`
3. `createScene()` 中：`this.cameraDirector = new CameraDirector(this.cameras.main, this.tweens);`
4. `centerCameraOn` / `panCameraTo` / `zoomCameraAt` 改为单行委托（签名不变，调用点零修改）

### 1.4 验证结果

| 验证项 | 结果 | 详情 |
|---|---|---|
| `tsc --noEmit` | ✅ 0 错误 | 无类型兼容问题 |
| `probe-camera-center.mjs` | ✅ 8/8 | follow/pan/zoom 行为一致 |
| `test-boot.mjs` | ✅ 启动通过 | 无黑屏 |
| GID / 碰撞编号 / TileMap | ✅ 未触碰 | 零地图数据变更 |
| 存档协议（SAVE_VERSION + MapSceneFlags） | ✅ 未触碰 | 零存档字段变更 |
| SHUTDOWN 钩子链 | ✅ 未改动 | 5 条钩子原顺序保留 |
| 调用点 | ✅ 零修改 | 委托模式自动兼容 |
| 跨域 tween 清理（stargazeDriftTween） | ✅ 通过 preZoomStart 回调保留 | 行为等价 |

### 1.5 验证结论（制作人修正版措辞）

> **未观察到游戏行为变化；专项 Probe、启动测试及协议红线检查全部通过。**

（不使用"纯委托行为等价"的绝对断言，用证据匹配结论。）

### 1.6 P1 核心设计原则

1. **不修改调用方接口**：原 `centerCameraOn/panCameraTo/zoomCameraAt` 方法签名全部保持不变
2. **反向依赖为零**：CameraDirector 不 import MapScene
3. **先保持行为，再优化架构**：preZoomStart 回调保留跨域清理
4. **专项 Probe 为唯一功能证据**：不依赖"纯委托"断言

### 1.7 P1 下一步（由制作人 / opencode 执行）

```
git commit  # 指定修改文件：src/modules/CameraDirector.ts + src/scenes/MapScene.ts
  commit message:
    refactor(map): P1 CameraDirector 抽离（委托模式，行为等价）
    - 新建 src/modules/CameraDirector.ts
    - MapScene 三方法改为委托，调用点零修改
    - 验证：tsc 0 错误 + probe-camera-center 8/8 + test-boot
```

---

## 第二部分：P2 UIBus — 边界锁定分析（前置审批）

### 2.1 UI 面板全景（13 个）

按**打开源**分类：

| 类型 | 面板 | 打开源 | 关闭源 | 冻结？ |
|---|---|---|---|---|
| 演出 | `endingPanel` | 结局触发 | 关闭按钮 | ✅ 完全冻结 |
| 演出 | `inStargazeCutscene` 内 dialogue | 观星链段3 onComplete | 对话结束 | ✅ 完全冻结 |
| 演出 | `inArtShowCutscene` 内 dialogue | 艺术展触发 | 对话结束 | ✅ 完全冻结 |
| UI | `photoAlbumPanel` | 相册解锁后 | Esc/关闭 | ✅ 冻结 |
| UI | `DiscoveryPanel` | 自然记录按钮 | Esc/关闭 | ✅ 冻结 |
| UI | `HudMenuPanel` | 菜单按钮 | Esc/空白 | ✅ 冻结 |
| UI | `ResidentBoardPanel` | 需求板交互 | E/Esc | ✅ 冻结 + 放行 consumeAction |
| UI | `ShopPanel` | 商店交互/脚本 | E/Esc | ✅ 冻结 + 放行 consumeAction |
| UI | `BackpackPanel` | B 键/脚本 | B 键 | ✅ 冻结 |
| UI | `QuestPanel` | J 键/脚本 | J 键 | ✅ 冻结 |
| UI | `WaitPanel` | T 键/脚本 | T 键 | ✅ 冻结 |
| UI | `MailboxPanel` | 邮箱交互 | 关闭按钮 | ✅ 冻结 |
| UI | `MusicBoxPanel` | 八音盒交互 | 关闭按钮 | ✅ 冻结 |
| UI | `GiftPanel`(grandpaGift) | 爷爷礼物交互 | 关闭按钮 | ✅ 冻结 |
| UI | `StoryDialogue` | 剧情系统 | advance 对话 | ✅ 冻结 + 放行 E/空格推进 |

### 2.2 update 中的面板冻结守卫链（不可变）

**L1997 ~ L2196**，执行顺序严格如下（编号 = 执行顺序）：

```
① endingPanel?.isOpen()        → return（玩家 setVelocity 清零）
② inStargazeCutscene           → return（仅放行 dialogue 推进）
③ inArtShowCutscene            → return（仅放行 dialogue 推进）
④ photoAlbumPanel?.isOpen()    → return（完全冻结）
⑤ isDiscoveryPanelOpen()       → return（完全冻结）
⑥ isHudMenuOpen()              → return（完全冻结）
⑦ residentBoardPanel?.isOpen() → return（放行 consumeAction 关闭）
⑧ shopPanel.isOpen()           → return（放行 consumeAction 关闭）
⑨ backpackPanel.isOpen()       → return（放行 B 键关闭）
⑩ questPanel.isOpen()          → return（放行 J 键关闭）
⑪ isWaitPanelOpen()            → return（放行 T 键关闭）
⑫ B 键打开背包（仅当无面板打开）
⑬ J 键打开任务（仅当无面板打开）
⑭ T 键打开等待（仅当无面板打开）
⑮ R 键切换种子（仅农场 + 冷却）
⑯ 时间推进 + 小时事件 + 天气
⑰ 观星/星空/农场暖度更新
⑱ storyDialogue.isOpen()      → return（放行 dialogue 推进 + T 键开等待）
⑲ inputManager.update() + touchControls.update()
⑳ 靠近提示簇
```

### 2.3 P2 严格不变边界（8 条红线）

| # | 边界 | 说明 |
|---|---|---|
| **1** | 上述 20 步守卫链的**执行顺序**不可改变 | 任何重排都会改变玩家可操作时序 |
| **2** | 每个守卫内的**冻结行为**（setVelocity(0,0) + clearAction）不可删除 | 删除 → 面板背后角色移动 |
| **3** | 每个守卫内的**放行按键**（B/J/T/Esc/consumeAction）不可增减 | 增减 → 面板关闭方式变化 |
| **4** | `storyDialogue.isOpen()` 打开时 **T 键仍可开等待面板**（L2182-2186） | 2026-08-16 体验修复：剧情卡住时玩家想跳时间 |
| **5** | `B/J/T/R` 快捷键**仅在所有面板关闭时**才生效（L2106-2135） | "开背包/开任务"在面板打开时不响应 |
| **6** | `inStargazeCutscene` / `inArtShowCutscene` 期间**只放行 dialogue 推进** | 演出完整性 = 第0章冻结协议 |
| **7** | SHUTDOWN 钩子中 closeWaitPanel/AmbienceSystem.stop/stopRain/cleanupSceneDom/save 注册不可删除 | 防 DOM 泄漏/音频残留/存档截断 |
| **8** | showDialogueText / updateHUD / showMemoryMoment / playMemoryFlashback / showChapterBanner 不纳入 UIBus | 这些是 UI 调用方，不是面板管理方 |
| **9** | **UIBus 不得拥有 MapScene 的任何游戏状态**（制作人架构红线） | 详见 §2.3.1 |
| **10** | **UIBus 不得成为新的调度器**（制作人架构红线） | 详见 §2.3.2 |

#### 2.3.1 UIBus 状态所有权红线（制作人 2026-08-26 拍板）

UIBus 只拥有**面板生命周期相关状态**，不得拥有以下任何 MapScene 域的状态：

- ❌ 时间系统（TimeSystem / lastHour / timeTick）
- ❌ 天气系统（WeatherSystem / rainOverlay / farmWarm）
- ❌ 演出状态（inStargazeCutscene / inArtShowCutscene / shardTweens）
- ❌ 地图状态（mapKey / 玩家位置 / tilemap / 碰撞）
- ❌ 交互状态（tryInteract 路由 / fishingState / plotFlashId）
- ❌ 玩法状态（farmProgress / inventory / stamina / economy）

UIBus **允许**拥有的状态仅包括：

- ✅ 面板实例引用（~13 个面板的 isOpen/open/close 方法代理）
- ✅ 面板生命周期标记（如"是否正在打开动画中"）
- ✅ UI 快捷键路由表（B/J/T/R → 对应面板 open）
- ✅ 面板冻结守卫的聚合查询（isAnyBlocking 返回布尔值，不做任何调度决策）

#### 2.3.2 机械迁移 ≠ 重写（制作人 2026-08-26 拍板）

**正确方式**（查询聚合器）：

```text
MapScene.update()
    ↓
原 20 步守卫链（原样保留在 MapScene 内）
    ↓
UIBus 提供 isOpen()/close()/open() 查询能力
```

**禁止方式**（新调度器 → 等同于重写守卫链）：

```text
MapScene.update()
    ↓
UIBus.update()
    ↓
UIBus 重新决定这一帧应该干什么 → ❌ 改变控制权
```

`isAnyBlocking()` 的定位：**查询聚合器**，不是新的调度器。它只负责"告诉 MapScene 当前是否有任何面板阻塞"，不负责决定"应该先检查哪个面板"。

### 2.4 P2 可做的（严格限定范围）

| # | 范围 | 不可逾越 |
|---|---|---|
| **A** | 将面板实例字段（endingPanel ~13 个）移入 UIBus | 字段名保持不变（UIBus 以代理属性暴露） |
| **B** | 将守卫链的 isOpen()/open()/close() 调用改为 UIBus.* 方法委托 | 守卫链顺序/冻结行为/放行按键**一字不差** |
| **C** | 增加 UIBus.isAnyBlocking() 聚合查询方法 | 内部聚合逻辑按上述 20 步顺序判断 |
| **D** | 快捷键路由（B/J/T/R）注册到 UIBus 内 | 触发时机不变 |

### 2.5 P2 明确禁止项（6 条）

- ❌ 不允许改变 update 中的面板冻结顺序
- ❌ 不允许改变面板关闭按键
- ❌ 不允许合并/拆分任何守卫步骤
- ❌ 不允许修改 storyDialogue 的早退/放行逻辑
- ❌ 不允许触碰 inStargazeCutscene / inArtShowCutscene 链路
- ❌ 不允许触碰 SHUTDOWN 钩子注册

### 2.6 P2 风险评估

| 风险 | 等级 | 缓解 |
|---|---|---|
| 守卫顺序变化导致面板穿透 | **极高** | 守卫链原样搬运到 UIBus，快照测试验证每帧 |
| 面板 open/close 时序变化 | 高 | 每个面板的 open/close 通过 UIBus 方法委托，签名不变 |
| storyDialogue 与面板互斥关系断裂 | 高 | storyDialogue 不纳入 UIBus（保持在 MapScene 本体） |
| 探针反射字段名变更 | 高 | UIBus 以代理属性暴露所有面板引用，字段名完全兼容 |
| SHUTDOWN 钩子遗漏 | 中 | 钩子注册代码保留在 MapScene.create |

### 2.7 P2 验证清单（12 个核心探针）

| 探针 | 覆盖范围 |
|---|---|
| `probe-hud-menu.mjs` | HudMenu 开关 + 冻结 |
| `probe-resident-board-038.mjs` | 需求板开关 |
| `probe-music-box.mjs` / `probe-music-restore.mjs` | 八音盒开关 |
| `probe-grandpa-gift.mjs` | 爷爷礼物面板 |
| `probe-quest-panel-side.mjs` / `probe-ch1-quest-panel.mjs` | 任务面板 |
| `probe-sleep.mjs` / `probe-sleep-realpath.mjs` / `probe-mobile-sleep.mjs` | 睡觉面板 |
| `probe-photo-album.mjs` / `probe-photo-loop.mjs` / `probe-photo-fullscreen.mjs` | 相册面板 |
| `probe-esc-menu.mjs` | Esc 关闭所有面板 |
| `probe-dialogue-handoff.mjs` / `probe-dialogue-history.mjs` | storyDialogue 互斥 |
| `probe-shop-hold-buy.mjs` / `probe-shop-machine-sell.mjs` | 商店面板 |
| `probe-life-loop-day.mjs` | 时间推进 + 面板互斥 |
| `probe-save-scene-guard.mjs` | 存档不受面板影响 |

---

## 第三部分：后续 Phase 规划参考

> 来自《MapScene 重构审计报告 · Phase 0》D 章节，供后续阶段参考

| Phase | 目标 | 模块 | 风险 |
|---|---|---|---|
| P1 ✅ | CameraDirector | M2 | 低 |
| **P2 待批** | **UIBus** | **M9** | **高** |
| P3 | WeatherDirector + 纯函数整理 | M4 + 工具 | 中 |
| P4 | WorldDecorator | M3 | 高 |
| P5 | FishingController | M6 | 中 |
| P6 | FarmController | M7 | 高 |
| P7 | StorySequenceRunner + InteractionRouter | M8 + M5 | 极高 |

---

## 变更历史

| 版本 | 日期 | 变更 | 说明 |
|---|---|---|---|
| v1.0 | 2026-08-26 | 初版 | P1 归档 + P2 边界锁定 |

