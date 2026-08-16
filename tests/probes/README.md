# tests/probes 探针说明

> 本目录是《归星物语》的浏览器自动化探针集合。
> 通用测试纪律见根目录 `TEST_RULES.md`（测试等级 / 移动端横屏纪律）。
> 发版前一键回归入口：`npm run showcase`（编排脚本 `run-alpha-showcase.mjs`）。

## 一、发版前回归（showcase 四件套）

`node tests/probes/run-alpha-showcase.mjs` 串行跑四个核心探针，顺序=快速失败原则：

| 顺序 | 探针 | 验证内容 | 超时预算 | 视口 |
|---|---|---|---|---|
| 1 | `probe-dialogue-handoff.mjs` | Dialogue 契约：1 行 → onComplete → 新对话接力不卡死 | 60s | 844×390 横屏 + Android UA |
| 2 | `probe-full-story-run.mjs` | 真实玩家完整主线：新档 → 车站 → 大门 → 农场 → Day2 → 小镇 → 后山 → 观星夜 → 结算 | **260s** | 844×390 横屏 + Android UA |
| 3 | `probe-save-restore.mjs` | 存档保存 → reload → 状态保持 | 120s | 1024×768 桌面（历史） |
| 4 | `probe-shop01.mjs` | 商店恢复：商品/购买/旧花苗/老板三阶段 | 90s | 1024×768 桌面（历史） |

### showcase 维护要点（2026-08-11 实测）

- **超时预算必须 >= 探针真实耗时**。`full-story-run` 完整跑通约 **203s**（2026-08-11 计时 45/3），180s 会中途误杀——已调至 **260s** 留余量。改剧情/新增章节后须重测真实耗时再同步 timeoutMs，否则超时阈值本身变成随机失败制造器。
- 编排是**严格串行**（`for` + `await runProbe`），禁止改成并发。
- 每个探针必须在 `finally { await browser.close() }` 关浏览器，避免资源残留拖慢后续环节。

### 已知失败（非阻塞，探针层问题）

- `full-story-run` 有 3 处断言「少读 1 行」（walkDialogue 尾部漏读）：锄地播种教学 / 交付对话 / 观星夜。属探针断言精度问题，**不是剧情流程问题**，修前先确认「什么叫读完对白」（建议 sceneStep / dialogue 关闭 / quest 状态作为 terminal 信号，而非堆 index 判断）。

## 二、探针维护规则（本轮踩坑沉淀，2026-08-11）

### 规则 1：不要用内部变量验证用户行为

错误做法：用 `d.index` 变化判断对话推进（`play(newLines)` 会重置 index=0，误判）。
正确做法：用剧情状态变化（storyStep / questState / dialogue 关闭）作为推进信号。

### 规则 2：SPA 不用 networkidle2

Vite dev server 的 HMR websocket 常驻，`waitUntil: 'networkidle2'` 永不满足会挂死。
正确做法：`waitUntil: 'domcontentloaded', timeout: 15000`，再轮询游戏就绪（`window.__game` + scene.storyDialogue）。

### 规则 3：动画游戏不要默认 headless

普通 Web 测试 `headless:true` 更稳；但 Phaser 游戏循环 / 动画 / WebAudio 在 headless 下不推进
（实测 Chapter Banner 永不消失），必须用真实 Chromium 渲染环境：`headless:false`。
headless 下 `page.mouse.click` 与 `dispatchEvent(new MouseEvent('click'))` 都可能失效，
DOM 原生 `el.click()` 最接近真实用户行为（2026-08-11 实测音量提示只能靠它关闭）。

### 规则 4：不要 sleep 猜时序，用状态驱动

开场 intro 各层出现有时序差（音量提示在 Enter 后 ~6.8s 才出现）。固定 `sleep(7000)` 是猜时间，
正确做法是「循环观察状态 → 层出现即处理 → 等待目标状态」，如等对白循环内每轮先 `dismissOneLayer`。

### 规则 5：改探针不等于改游戏

探针失败先怀疑探针自身假设（时序 / 选择器 / 阈值），不要为了把测试变绿去改游戏逻辑。
尤其 Dialogue 契约 / 剧情节奏，改之前先向制作人确认「这是探针问题还是游戏问题」。

### 规则 6：验证单例运行时状态必须走真实游戏实例（2026-08-16 沉淀）

**禁止**用带时间戳的独立模块 import 去验证单例状态。Vite dev 下
`await import('/src/data/TimeSystem.ts')` 会命中带 `?t=` 时间戳的**另一个模块实例**，
读写到的与游戏运行时不是同一个单例（实测 `probe-action-time` 因此出现
"采集成功但时间恒 0 增量"的假失败，真机/构建包不触发）。

正确做法：
- 读单例状态 → `window.debug.getTimeStr()` / `window.debug` 既有 getter
- 改单例状态 → `window.debug.setTime()` 等既有 setter
- 需要暴露新能力 → 在 `src/main.ts` 的 `window.debug` 面加直连游戏实例的入口
  （如 `debug.consumeMinutes`），探针只调 debug，不再 `import` 业务模块
- 只读静态常量（不依赖单例运行状态）时，动态 import 仍可用于取源码/常量

凡新增"验证运行中状态"的探针，先检查 `window.debug` 是否已提供对应读取入口；
没有就补 debug 入口，不要绕道动态 import。

## 三、探针操作规范

- **涉及开场/车站对白的探针**：必须按 `TEST_RULES.md` 第 5 条走完整路径（音量提示 → 手机通知两页 → 车站对白）。
- **移动端探针**：横屏 844×390 + Android UA + `evaluateOnNewDocument` 覆写 UA，禁止竖屏（见 TEST_RULES.md）。
- **新增探针**：先看同类探针（如 `probe-mobile-text.mjs` / `probe-mobile-ux.mjs`）复用横屏模板，禁止重复造平行实现（AGENTS.md 硬规则）。
- **开发前置**：多数探针依赖 dev server `localhost:5173` 在跑（`npm run dev`）。
- **视口红线**：`save-restore` / `shop01` 用 1024×768 桌面视口是历史选择，横屏真机验收仍需制作人执行 APK。

## 四、目录速查

- `run-alpha-showcase.mjs` — 发版前回归编排入口（唯一一条命令）
- `_shot-store.mjs` — 截图落盘辅助（供各探针复用）
- `test-screenshots/` — 探针运行截图输出目录
- 其余 `probe-*.mjs` — 各专项探针（bug 复现 / 功能验证 / 视觉验收），按需运行
