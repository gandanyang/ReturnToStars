# AI 测试规范

> 所有代码 Agent 在执行修改前后必须遵守本规范。
> 核心：测试必须服务于"这个修改可能破坏什么？"，而不是盲目跑全量测试。

## 测试原则

每次修改前：

1. 先分析影响范围
2. 禁止默认运行全部测试
3. 测试必须回答："这个修改可能破坏什么？"

---

## 测试等级

### Level 0：无需测试

适用于：

- 纯文字修改
- Dialogue 文本修改
- 注释修改
- 文档修改

只需要：检查格式。

### Level 1：快速验证

适用于：

- UI 调整
- 数值调整
- 单个系统小修改

执行：

- TypeScript 编译
- 相关模块检查
- 简单运行验证

不要运行：完整游戏流程测试。

### Level 2：功能测试

适用于：

- 新功能
- 修改核心逻辑

执行：

- 相关系统测试
- 手动关键流程测试

例如：修改种植 → 测试：种植 / 浇水 / 成长 / 收获。不要测试：剧情全部章节。

### Level 3：完整测试

只在以下情况执行：

- 大版本发布
- 存档结构修改
- 核心系统重构

---

## 测试前必须说明

开始测试前输出：

- 修改内容
- 影响文件
- 风险
- 计划测试
- 预计耗时

如果测试收益低，跳过。

---

## 移动端探针纪律（硬性，2026-08-09 制作人强调）

**本项目移动端只支持横屏**（见 `AI_CONTEXT.md` / `AI_GUARDRAIL.md`）。编写 / 运行移动端探针必须遵守：

1. **禁止竖屏视口模拟移动端**：不得使用 `375×812`、`390×844` 等 width<height 视口做移动端功能测试。
   - 竖屏会被 `index.html` 的 `#rotate-hint` 全屏遮挡（`@media (orientation: portrait)`），交互全部失效，测试结果无意义且违反横屏规则。
   - 唯一例外：`probe-rotate-hint.mjs`（专门验证旋转提示遮挡，允许竖屏）。
2. **横屏视口标准**：移动端一律用横屏触屏视口，如 `defaultViewport: { width: 844, height: 390, isMobile: true, hasTouch: true }`（或 `852×393`）。
3. **必须注入 Android UA**：`isTouchDevice()` 按 UA 判定（见 `src/config.ts`），横屏宽度 ≥800 时仅靠触屏视口不会命中移动端分支。必须 `evaluateOnNewDocument` 覆写 `navigator.userAgent`（Android 移动 UA）+ `maxTouchPoints`。
4. **新增探针统一走横屏+UA 模板**：参考 `probe-mobile-text.mjs` / `probe-mobile-ux.mjs`（2026-08-09 已按本纪律修正）。
5. **涉及开场 / 车站对白的探针路径**（不能少步，否则流程卡死）：
   - 点音量提示（zIndex 650，`建议打开声音游玩`）→
   - 手机通知**两页**（P0 修订批起为两页）：点第 1 页翻页 → 点第 2 页关闭 →（弹窗淡入播 `hr_station_01`、翻页播 `hr_station_03`）→
   - 车站对白开始。
   - 通知为两页后，"单击通知即关闭"的写法必挂。
6. **独白行数**：`STATION_DIALOGUE` 现为 10 行（含选项行），推进对白的探针须在选项行选择（`现在就走吗？`）后才能关闭对白。

> 历史遗留的竖屏探针（`probe-bug032` / `probe-claim-reward` / `probe-guide-dialogue` / `probe-mobile-sleep` / `probe-mobile-tutorial` / `probe-note-vs-woodcut` / `probe-quest-btn-topleft` 等）为 2026-08-02 横屏规则确立前产物，**未按本纪律修正前不得作为移动端验收依据**。
