# 归星物语 — AI 自动化测试体系（v2.0）

> 性质：**AI 协作开发文档 / 测试系统契约**
> 受众：所有参与本项目的 AI Agent（WorkBuddy / opencode / TRAE / Codex）
> 强制纪律：本文档与 `TEST_RULES.md` / `AGENTS.md` / `tests/probes/README.md` 同级生效，修改前后必须遵守
> 维护原则：测试基础设施变更必须同步本文档；新增测试范式须先入文档再使用

---

## 一、总览：两层测试结构

本项目的自动化测试分**两层**，各自定位、命令、目录均不同，**不要混用**：

| 层 | 目录 | 定位 | 触发方式 | 数量策略 |
|---|---|---|---|---|
| **L1 功能回归（v2 harness）** | `tests/{smoke,save,gameplay,event,chapter}/` | 稳定的核心流程回归，每改一次相关模块就跑 | `npm test` / `npm run test:<suite>` | 少而精，覆盖关键路径 |
| **L2 专项探针（probes）** | `tests/probes/probe-*.mjs` | 单点功能验证 / bug 复现 / 视觉验收 | `node tests/probes/probe-xxx.mjs`（按需） | 按需新增，可多可少 |
| **L3 发版编排（showcase）** | `tests/probes/run-alpha-showcase.mjs` | 发版前四件套回归 | `npm run showcase` | 严格串行，禁止并发 |

**判断该用哪层**：
- 修改后想确认"核心流程没坏" → L1（`npm test`）
- 新功能做完想专项验证 → L2（写新探针）
- 录视频 / 发版前 → L3（`npm run showcase`）

---

## 二、命令速查

### L1 功能回归（harness）

```bash
npm test                  # 跑全部 5 个套件（smoke/save/gameplay/event/chapter）
npm run test:smoke        # 仅 smoke（启动验证）
npm run test:save         # 仅 save（存档读写）
npm run test:gameplay     # 仅 gameplay（农业循环）
node tests/harness/runner.mjs event    # event 套件（一次性事件）
node tests/harness/runner.mjs chapter  # chapter 套件（章节回归）
```

### L2 专项探针（按需）

```bash
node tests/probes/probe-ch1-house-tidy.mjs          # 老屋整理
node tests/probes/probe-ch1-xiya-old-shadow.mjs     # P1-3 夏雅旧日留影
node tests/probes/probe-t3-npc-events.mjs           # T3 NPC 三事件
# ...其余见 tests/probes/ 目录
```

### L3 发版回归

```bash
npm run showcase          # 串行跑 4 个核心探针（dialogue-handoff → full-story-run → save-restore → shop01）
```

### 前置依赖

- **必须** dev server 在跑：`npm run dev`（默认 `localhost:5173`）
- **必须** Chrome 安装在 `C:\Program Files\Google\Chrome\Application\chrome.exe`（路径硬编码在 harness，改路径前先确认是否所有探针都要改）
- **必须** `puppeteer-core` 已装（`package.json` devDependencies）

---

## 三、L1 测试基础设施（tests/harness/）

4 个文件，**所有 v2 测试必须通过 harness API 操作**，禁止直接 `puppeteer.launch`：

### 3.1 browser.mjs — 浏览器管理

| 函数 | 签名 | 用途 |
|---|---|---|
| `launch(opts)` | `{ viewport?, mobile? } → { browser, page }` | 启动 Chromium + 打开游戏页 + 等待 `window.__game` 就绪 |
| `waitForGame(page, timeoutMs)` | `→ Promise<void>` | 轮询 `window.__game` + `window.debug` + 至少一个 active scene |
| `close(browser)` | `→ void` | 安全关闭（忽略已关闭错误） |
| `sleep(ms)` | `→ Promise<void>` | 工具函数 |

**`launch` 关键行为**：
- 桌面默认视口 `1024×768`
- `mobile: true` → 横屏 `844×390` + Android UA + `maxTouchPoints=5`（**横屏红线，禁止竖屏**）
- 自动收集 `page._consoleErrors`（按 `msg.type()==='error'` 过滤）
- 打开页面后自动 `waitForGame`

### 3.2 game.mjs — 游戏操作封装

所有方法通过 `page.evaluate` 调用游戏内 `window.debug` API。**禁止绕过 debug 直接改 localStorage**（除"写种子存档"场景）。

| 函数 | 用途 | 关键注意 |
|---|---|---|
| `sceneInfo(page)` | 当前场景 / storyStep / chapter / dialogueOpen |  |
| `readSave(page)` | 读取存档关键字段（day/hour/storyStep/scene/coins/inventory/quests） | 结构化返回，不返回原始 JSON |
| `clearSave(page)` | 清存档 + reload + 等游戏就绪 |  |
| `skipDialogue(page, lineCount)` | 跳过 N 行对白 | 每行 advance 2 次 + 1 次关闭 |
| `pressE(page, waitMs)` | 按 E 键 |  |
| `teleport(page, sceneKey, x, y, facing)` | 传送玩家到指定位置 | 不切场景，只改 player 坐标 |
| `gotoScene(page, key, spawn?)` | 切换场景 | stop 当前 + start 目标 + sleep 2600ms |
| `setTileState / setCrop / getTileState` | 农田格子操作 |  |
| `giveItem(page, item, count)` | 给物品 |  |
| `nextDay(page)` | 推进到次日 |  |
| `setTime(page, hour, minute)` | 设置时间 |  |
| `screenshot(page, name)` | 截图到 `tests/reports/screenshots/` |  |

### 3.3 report.mjs — 测试报告

```javascript
const report = createReport('save');           // 创建套件报告
report.check('存档保持', true, 'day=2, coins=100');  // 记录一个检查项
await report.finalize();                        // 生成 JSON + Markdown 报告
```

**输出位置**：
- JSON：`tests/reports/json/<suite>.json`
- Markdown：`tests/reports/markdown/<suite>.md`
- 自动记录 git commit hash + 分支 + 耗时

### 3.4 runner.mjs — 测试运行器

- 扫描 `tests/<suite>/test-*.mjs`，串行执行
- 每个测试文件 `export default async function ({ suiteReport }) { ... return { passed, failed } }`
- 5 个套件：`smoke / save / gameplay / event / chapter`
- 退出码：失败 > 0 → `1`，全过 → `0`

---

## 四、L1 测试编写范式

### 4.1 文件骨架（必读模板）

```javascript
/**
 * <Suite> Test: <功能名>
 *
 * 验证：
 *   1. <检查项 1>
 *   2. <检查项 2>
 *
 * 前置：dev server 在 localhost:5173 运行
 */
import { launch, close, sleep } from '../harness/browser.mjs';
import { sceneInfo, clearSave, screenshot, pressE } from '../harness/game.mjs';

export default async function ({ suiteReport: r }) {
  const { browser, page } = await launch({ viewport: { width: 1024, height: 768 } });

  try {
    await clearSave(page);
    // ... 测试逻辑
    r.check('检查项名', condition, `detail=${value}`);

    const passed = r.results.filter(x => x.ok).length;
    const failed = r.results.filter(x => !x.ok).length;
    return { passed, failed };
  } finally {
    await close(browser);   // 必须在 finally 关闭，避免浏览器残留
  }
}
```

### 4.2 必须遵守的范式规则

1. **必须用 harness**：`launch` / `close` / `sceneInfo` 等都从 `../harness/*.mjs` import，禁止直接 `puppeteer.launch`
2. **必须 try/finally**：`finally { await close(browser) }`，否则浏览器残留拖慢后续测试
3. **必须 `clearSave` 起步**：除非测试目的就是验证脏档，否则清档确保干净状态
4. **必须用 `r.check` 记录**：不要 `console.log` 自行打结果，runner 靠 `r.results` 统计
5. **必须 return `{ passed, failed }`**：runner 用这个返回值聚合报告
6. **文件命名**：`test-<feature>.mjs`，放在对应套件目录
7. **视口默认桌面**：移动端测试必须横屏 + UA（见 §六）

### 4.3 何时新增 L1 测试

- **新增核心系统**（如存档结构、事件系统、章节切换）→ 必须加 L1
- **修关键 bug**（如存档损坏、场景卡死）→ 加 L1 防回归
- **一次性支线 / 单点 UI** → 写探针即可，不必升 L1

---

## 五、L2 探针编写范式

### 5.1 探针 vs L1 的区别

| 维度 | L1 测试 | L2 探针 |
|---|---|---|
| 入口 | `npm run test:<suite>` | `node tests/probes/probe-xxx.mjs` |
| 框架 | harness（launch/close/report） | 自管 puppeteer（可不用 harness） |
| 报告 | `tests/reports/json+markdown/` | 控制台输出 + 截图 |
| 用途 | 稳定回归 | 专项验证 / bug 复现 / 视觉验收 |
| 命名 | `test-*.mjs` | `probe-*.mjs` |

### 5.2 探针骨架（参考 `probe-t3-npc-events.mjs` / `probe-ch1-xiya-old-shadow.mjs`）

```javascript
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: false,                    // 必须 false（见 §七规则 3）
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0, fail = 0;
const result = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
};

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

try {
  // ... 探针逻辑
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-xxx 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
```

### 5.3 探针命名规范

- `probe-ch1-<feature>.mjs` — 第一章功能
- `probe-ch0-<feature>.mjs` — 第0章功能
- `probe-bug<NNN>-<desc>.mjs` — bug 复现（NNN = bug 编号）
- `probe-mobile-<feature>.mjs` — 移动端专项（必须横屏+UA）
- `probe-<npc>-<event>.mjs` — NPC 事件（如 `probe-xiya-letter.mjs`）

---

## 六、测试纪律（硬性，所有 AI 必须遵守）

### 6.1 测试等级（修改前必须判断）

| 等级 | 适用 | 执行 | 禁止 |
|---|---|---|---|
| **L0** | 纯文字 / 注释 / 文档 | 仅检查格式 | 不跑测试 |
| **L1** | UI / 数值 / 单系统小改 | `tsc --noEmit` + 相关套件 | 不跑全量 |
| **L2** | 新功能 / 核心逻辑修改 | 相关系统测试 + 关键流程探针 |  |
| **L3** | 大版本 / 存档结构 / 核心重构 | 完整测试（`npm test` + `showcase`） |  |

**测试前必须输出**：修改内容 / 影响文件 / 风险 / 计划测试 / 预计耗时。**禁止默认跑全量**。

### 6.2 横屏红线（移动端探针）

本项目**移动端只支持横屏**。移动端探针必须：

1. **禁止竖屏视口**：不得用 `375×812` / `390×844` 等 width<height 视口（会被 `#rotate-hint` 全屏遮挡，测试无意义）
2. **横屏视口标准**：`{ width: 844, height: 390, isMobile: true, hasTouch: true }`
3. **必须注入 Android UA**：`isTouchDevice()` 按 UA 判定，必须 `evaluateOnNewDocument` 覆写 `navigator.userAgent` + `maxTouchPoints`
4. **参考模板**：`probe-mobile-text.mjs` / `probe-mobile-ux.mjs`（已按纪律修正）
5. **唯一例外**：`probe-rotate-hint.mjs`（专门验证旋转提示，允许竖屏）

> 历史竖屏探针（`probe-bug032` / `probe-claim-reward` / `probe-mobile-sleep` 等）未修正前**不得作为移动端验收依据**。

### 6.3 真实链路纪律（存档恢复测试）

**刷新后仅启动 TitleScene 时 `apply()` 不会被调用**，模块状态保持初始值。验证存档恢复必须：

- 写入种子存档 → reload → **按 Enter** 触发 `TitleScene → StationScene.create → apply → 场景切换` 完整链路
- **仅读取 localStorage 不视为有效验证**
- 参考 `tests/event/test-once.mjs` 第 71-84 行 / `tests/chapter/test-ch0-regression.mjs` 第 95-103 行

### 6.4 不改游戏逻辑纪律（探针层铁律）

> 探针失败先怀疑探针自身假设（时序 / 选择器 / 阈值），**不要为了把测试变绿去改游戏逻辑**。

- Dialogue 契约 / 剧情节奏改动前**先向制作人确认**「这是探针问题还是游戏问题」
- 测试必须通过 `window.debug` API 验证真实链路，禁止为测试改游戏代码
- 探针中 `window.debug.xxx()` 是只读探针，不是修改游戏行为

---

## 七、探针常见坑（踩坑沉淀）

### 规则 1：不要用内部变量验证用户行为

❌ 用 `dialogue.index` 变化判断对话推进（`play(newLines)` 会重置 index=0，误判）
✅ 用剧情状态变化（`storyStep` / `questState` / dialogue 关闭）作为推进信号

### 规则 2：SPA 不用 networkidle2

Vite dev server 的 HMR websocket 常驻，`waitUntil: 'networkidle2'` 永不满足会挂死。

❌ `await page.goto(URL, { waitUntil: 'networkidle2' })`
✅ `await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 })` + 轮询 `window.__game`

### 规则 3：动画游戏不要 headless

Phaser 游戏循环 / 动画 / WebAudio 在 `headless:true` 下不推进（实测 Chapter Banner 永不消失）。

❌ `headless: true`
✅ `headless: false`（必须真实 Chromium 渲染环境）

headless 下 `page.mouse.click` 与 `dispatchEvent(new MouseEvent('click'))` 都可能失效，DOM 原生 `el.click()` 最接近真实用户行为。

### 规则 4：不要 sleep 猜时序，用状态驱动

开场 intro 各层出现有时序差（音量提示在 Enter 后 ~6.8s 才出现）。固定 `sleep(7000)` 是猜时间。

❌ `await sleep(7000)` 然后假设层已出现
✅ 循环观察状态 → 层出现即处理 → 等待目标状态

### 规则 5：开场 / 车站对白探针必须走完整路径

涉及开场 / 车站对白的探针**不能少步**，否则流程卡死：

1. 点音量提示（zIndex 650，`建议打开声音游玩`）
2. 手机通知**两页**（P0 修订批起为两页）：
   - 点第 1 页翻页 → 弹窗淡入播 `hr_station_01`
   - 点第 2 页关闭 → 翻页播 `hr_station_03`
3. 车站对白开始

> 通知为两页后，"单击通知即关闭"的写法必挂。

### 规则 6：showcase 超时预算必须 >= 真实耗时

`full-story-run` 完整跑通约 **203s**（2026-08-11 计时），180s 会中途误杀。改剧情 / 新增章节后须**重测真实耗时再同步 timeoutMs**，否则超时阈值本身变成随机失败制造器。

showcase 编排是**严格串行**（`for` + `await runProbe`），**禁止改成并发**。

---

## 八、AI 测试决策流程

修改完成后，按以下流程决策跑什么测试：

```
修改完成
   │
   ├─ 纯文字/注释/文档？ ──是──→ L0：仅检查格式，不跑测试
   │
   ├─ UI/数值/单系统小改？ ──是──→ L1：
   │   │                           1. npx tsc --noEmit
   │   │                           2. npm run test:<相关套件>
   │   │                           3. 必要时跑相关探针
   │   │
   ├─ 新功能/核心逻辑修改？ ──是──→ L2：
   │   │                           1. npx tsc --noEmit
   │   │                           2. 写新探针验证（probe-xxx.mjs）
   │   │                           3. 跑相关 L1 套件防回归
   │   │                           4. 必要时升级为 L1 测试
   │   │
   └─ 大版本/存档结构/核心重构？ ──是──→ L3：
                                   1. npx tsc --noEmit
                                   2. npm test（全量 L1）
                                   3. npm run showcase（发版四件套）
                                   4. 真机验收（制作人执行）
```

### 8.1 修改前必须输出

```
- 修改内容：<一句话>
- 影响文件：<文件列表>
- 风险：<可能破坏什么>
- 计划测试：<等级 + 命令>
- 预计耗时：<分钟>
```

### 8.2 修改后必须输出

```
- 修改内容：<实际改动>
- 是否影响存档：<是/否>
- 是否需要测试：<是/否>
- 测试结果：<通过/失败 + 详情>
```

**禁止只说"应该没问题"，必须验证。**

---

## 九、debug API 速查（探针常用）

通过 `page.evaluate(() => window.debug.xxx())` 调用：

| API | 用途 |
|---|---|
| `window.debug.getStoryStep()` | 当前剧情步骤 |
| `window.debug.setStoryStep(step)` | 设置剧情步骤（探针造状态用） |
| `window.debug.advanceStory()` | 推进下一步 |
| `window.debug.getChapter()` / `setChapter(n)` | 章节 |
| `window.debug.getTime()` / `setTime(h, m)` | 游戏时间 |
| `window.debug.nextDay()` | 推进次日（**内部调用 save()**） |
| `window.debug.giveItem(item, count)` | 给物品 |
| `window.debug.getQuestState()` / `setQuestState(s)` | 任务状态 |
| `window.debug.getObservatoryComplete()` | 观星夜完成 |
| `window.debug.farm.setTileState / setCrop / getTileState` | 农田操作 |
| `window.debug.events.triggerOnce(id, fn)` | 触发一次性事件 |
| `window.debug.events.markTriggered(id)` | 标记已触发 |
| `window.debug.events.hasTriggered(id)` | 是否已触发 |
| `window.debug.events.getSaveData()` | 事件存档数据 |

**场景对象访问**：
```javascript
const s = window.__game.scene.getScene('farm');   // 当前场景实例
s.player.x / s.player.y / s.player.facing;        // 玩家位置
s.storyDialogue.isOpen();                          // 对白是否打开
s.storyDialogue.advance();                         // 推进对白
s.tryInteract();                                   // 触发交互（等价按 E）
```

---

## 十、文件目录速查

```
tests/
├── harness/                          # L1 基础设施（4 文件，稳定不轻易改）
│   ├── browser.mjs                   # launch / close / waitForGame
│   ├── game.mjs                      # sceneInfo / clearSave / pressE / teleport ...
│   ├── report.mjs                    # createReport / check / finalize
│   └── runner.mjs                    # 套件运行器
├── smoke/test-boot.mjs               # 启动验证
├── save/test-basic.mjs               # 存档读写
├── gameplay/test-farm-cycle.mjs      # 农业循环
├── event/test-once.mjs               # 一次性事件
├── chapter/test-ch0-regression.mjs   # 第0章回归
├── probes/                           # L2 探针集合
│   ├── README.md                     # 探针维护规则（必读）
│   ├── run-alpha-showcase.mjs        # L3 发版编排入口
│   ├── probe-ch1-house-tidy.mjs      # 老屋整理（范式参考）
│   ├── probe-ch1-xiya-old-shadow.mjs # P1-3 夏雅旧日留影（最新范式）
│   ├── probe-t3-npc-events.mjs       # T3 NPC 三事件（多事件串行范式）
│   └── probe-*.mjs                   # 其余专项探针
└── reports/                          # 自动生成
    ├── json/<suite>.json
    ├── markdown/<suite>.md
    └── screenshots/<name>.png
```

---

## 十一、参考文档（同级生效）

- `TEST_RULES.md` — 测试等级 / 横屏纪律（根目录，AI 必读）
- `tests/probes/README.md` — 探针维护规则 / showcase 四件套
- `AGENTS.md` — 开发护栏 / 测试要求
- `docs/dev/EventSystem.md` — 事件系统契约（`triggerOnce` / `triggerOnceIf`，涉及一次性事件必读）

---

## 十二、文档维护规则

1. **测试基础设施变更必须同步本文档**：改 `harness/*.mjs` API → 同步更新 §三
2. **新增测试范式须先入文档再使用**：禁止先写代码后补文档
3. **踩坑沉淀即时入文档**：新增"规则 N"加到 §七
4. **debug API 新增必须入文档**：新增 `window.debug.xxx` → 同步 §九
5. **本文档与 `TEST_RULES.md` / `tests/probes/README.md` 保持一致**：冲突时以 `TEST_RULES.md` 为准（根目录权威）
