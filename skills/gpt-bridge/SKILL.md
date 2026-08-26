---
name: "gpt-bridge"
description: "GPT 请示桥：调用网页版 ChatGPT 传话工具。当用户说「请示 GPT」「拿去问 GPT」「把结果发给网页版 ChatGPT」「外部顾问」「second opinion」等，需要把任务上下文/输出发给网页版 ChatGPT 取回回复时触发。"
---

# GPT 请示桥 Skill

## 作用

把「任务上下文 + agent 输出」发到**网页版 ChatGPT**，取回它的回复，供制作人决策做外部顾问（完全遵循 / 再沟通一轮）。

- 工具：`tools/gpt-bridge.mjs`
- 登录态：复用 Chrome 独立 profile（`.gpt-bridge-profile/`，已登录）
- 不是替代本机 agent，是「外部第二意见」；制作人明确要求时才使用，不自行频繁调用。

---

## 触发器

当制作人或用户要求「请示 GPT / 拿去问 GPT / 网页版 ChatGPT 传话」时触发本 Skill。

⚠️ 只用于**网页版 ChatGPT** 传话；本机 agent 能直接做的事不要走这里。

---

## 可用命令

```bash
# 1. 检查登录态（冒烟，确认 Chrome profile 还能用）
node tools/gpt-bridge.mjs --check

# 2. 直接发内容（短文本，默认开新对话）
node tools/gpt-bridge.mjs --ask "要问 GPT 的内容"

# 3. 从文件发内容（长文推荐：任务上下文 + 输出落盘后整段发）
node tools/gpt-bridge.mjs --ask-file tmp/ask-gpt.md

# 4. 列出侧栏已有对话（先看有哪些，再挑 --convo）
node tools/gpt-bridge.mjs --list-convo

# 5. 去已有的某个对话里续聊（按序号 / 标题片段 / 链接片段选）
node tools/gpt-bridge.mjs --ask "继续追问" --convo 3
node tools/gpt-bridge.mjs --ask-file tmp/ask-gpt.md --convo "青禾凤蝶"

# 6. 明确开启新对话（默认也是新对话，可省略 --new）
node tools/gpt-bridge.mjs --ask "新任务" --new
```

### 如何选择对话

- `--list-convo`：打印侧栏会话清单（序号 / 标题 / 链接），据此挑目标。
- `--convo <参数>`：去**已有对话**。参数支持三种写法——纯数字（列表里的序号）、标题片段、链接 `/c/...` 片段；按包含匹配取第一个命中。
- `--new`：点「新对话」按钮，**重新开启新对话**。
- 不传 `--convo` 时默认开启新对话（与旧版行为一致）。

### 回复处理

- 终端直接打印 GPT 回复
- 同时落盘 `tmp/gpt-reply-<时间戳>.txt`（供后续引用）
- 发送前建议把要发的内容写入 `tmp/ask-gpt.md`（先写文件再 `--ask-file`，便于审查发出去的是什么）

---

## 多行消息规范（v1.1）

- 脚本逐行输入，行间用 `Shift+Enter` 换行（ChatGPT 的换行键，不触发发送），全部输完才按 Enter 发送。
- 发送前打印 `▶ 内容已填入输入框（N 行 / M 字符）`，可确认消息完整。

---

## 接入指引（给其他 AI agent）

可直接 shell 调用，零配置：

```bash
node "g:/ReturnToStars/tools/gpt-bridge.mjs" --ask-file "g:/ReturnToStars/tmp/ask-gpt.md"
```

**前提**：agent 工作目录是项目仓库（node 依赖在仓库内），先确认登录态（`--check`）。

---

## 注意事项

1. **登录态**：Chrome 独立 profile 已登录；若失效（`--check` 显示未登录），跑 `--check --wait` 在弹出窗口手动登录一次。
2. **人机验证**：ChatGPT 偶尔弹 Cloudflare 验证 → 在弹出窗口手动点一下，脚本会继续等待。
3. **不是自动化绕过**：本工具是「手动辅助传话」，不承诺绕过验证 / 风控。
4. **隐私**：发出去的内容会进入 ChatGPT 官方对话历史；敏感信息先确认再发。
5. **不要滥用**：制作人明确要求才使用；agent 不得自行频繁调用。
6. **布局变更**：若侧栏读不到会话（`--list-convo` 为空），可能是 ChatGPT 新布局，先人工核对选择器。

---

## 常用问题

| 问题 | 处理 |
|---|---|
| `--check` 显示未登录 | 跑 `--check --wait` 手动登录一次 |
| 卡在「等待回复」 | 窗口里可能有人机验证，手动处理；或超时后看 `tmp/gpt-reply-*` |
| 回复为空 | 可能还在生成或页面结构变更；重试一次 |
| 其他 agent 找不到 node | 用绝对路径调 node（node_modules 依赖仓库内） |

---

## 详细文档

完整说明见 `docs/工具-GPT请示桥.md`。