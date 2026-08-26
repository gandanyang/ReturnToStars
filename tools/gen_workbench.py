#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
归星物语 · 项目工作台生成器
================================
采集项目实时数据（git log / 文件统计），结合静态项目信息，
生成单文件 HTML 仪表盘「项目工作台.html」（根目录，可离线打开）。

用法：
    python tools/gen_workbench.py            # 生成到项目根目录
    python tools/gen_workbench.py --check    # 只打印采集结果，不写文件

数据分两层：
- 动态层（每次运行自动刷新）：git 提交、文件计数、代码行数
- 静态层（低频人工维护）：当前施工状态、系统清单、红线、文档导航
  静态层在下方 STATIC_* 常量里改，改完重跑脚本即可。
"""

import subprocess
import sys
import re
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "项目工作台.html"

# 统计时排除的目录（非项目本体）
EXCLUDE_DIRS = {"node_modules", ".git", "archive", "__pycache__", ".workbuddy"}

# ============================================================
# 数据采集（动态层）—— 纯 Python 实现，Windows/macOS/Linux 通用
# ============================================================

def git(*args: str) -> str:
    """执行 git 命令（不走 shell，避免 Windows cmd 语法差异）。"""
    try:
        r = subprocess.run(
            ["git", *args], cwd=ROOT,
            capture_output=True, text=True, timeout=30,
            encoding="utf-8", errors="replace",
        )
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        return ""


def walk_files(base: str, pattern: str | None = None) -> list:
    """遍历目录收集文件（排除 node_modules/.git/archive 等）。"""
    root = ROOT / base
    if not root.exists():
        return []
    out = []
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if any(part in EXCLUDE_DIRS for part in p.relative_to(ROOT).parts):
            continue
        if pattern is None or p.match(pattern):
            out.append(p)
    return out


def count_files(pattern: str, base: str = ".") -> int:
    return len(walk_files(base, pattern))


def count_lines(base: str = "src", pattern: str = "*.ts") -> int:
    total = 0
    for p in walk_files(base, pattern):
        try:
            total += sum(1 for _ in p.open("rb"))
        except OSError:
            pass
    return total


def dir_size(base: str) -> str:
    total = sum(p.stat().st_size for p in walk_files(base))
    return human_size(total)


def human_size(n: int) -> str:
    for unit in ("B", "K", "M", "G"):
        if n < 1024:
            return f"{n:.0f}{unit}" if unit == "B" else f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}T"


def git_log(n: int = 20) -> list:
    """取最近 n 条提交 [{date,time,subject,hash,tag}]。"""
    out = git("log", f"-{n}", "--pretty=format:%ai|%s|%h|%d")
    rows = []
    for line in out.splitlines():
        if not line.strip():
            continue
        parts = line.split("|", 3)
        if len(parts) != 4:
            continue
        date, subject, h, refs = parts
        try:
            dt = datetime.strptime(date[:19], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
        rows.append({
            "date": dt.strftime("%m-%d"),
            "time": dt.strftime("%H:%M"),
            "subject": subject,
            "hash": h,
            "tag": "HEAD" if "HEAD" in refs else "",
        })
    return rows


def collect() -> dict:
    d = {
        "gen_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "commits": git("rev-list", "--count", "HEAD") or "?",
        "last_commit_date": git("log", "-1", "--format=%ai")[:10],
        "last_commit": "",
        "lines": count_lines("src", "*.ts"),
        "ts_files": count_files("*.ts", "src"),
        "sys_count": len(list((ROOT / "src" / "systems").glob("*.ts"))) if (ROOT / "src" / "systems").exists() else 0,
        "ui_count": len(list((ROOT / "src" / "ui").glob("*.ts"))) if (ROOT / "src" / "ui").exists() else 0,
        "data_count": len(list((ROOT / "src" / "data").glob("*.ts"))) if (ROOT / "src" / "data").exists() else 0,
        "maps": len(list((ROOT / "dist" / "assets" / "maps").glob("*.json"))) if (ROOT / "dist" / "assets" / "maps").exists() else 0,
        "docs": count_files("*.md", "docs"),
        "tools": count_files("*", "tools") if (ROOT / "tools").exists() else 0,
        "tests": count_files("*", "tests") if (ROOT / "tests").exists() else 0,
        "tasks": len(list((ROOT / "docs" / "tasks").glob("*.md"))) if (ROOT / "docs" / "tasks").exists() else 0,
        "png": count_files("*.png", "assets"),
        "wav": count_files("*.wav", "art_source"),
        "mp3": count_files("*.mp3", "art_source"),
        "ogg": count_files("*.ogg", "dist"),
        "music": len(list((ROOT / "dist" / "assets" / "audio" / "music").glob("*"))) if (ROOT / "dist" / "assets" / "audio" / "music").exists() else 0,
        "size_src": dir_size("src"),
        "size_docs": dir_size("docs"),
        "size_tools": dir_size("tools"),
        "size_tests": dir_size("tests"),
        "size_assets": dir_size("assets"),
        "size_art": dir_size("art_source"),
        "size_dist": dir_size("dist"),
        "log": git_log(20),
    }
    if d["log"]:
        d["last_commit"] = f'{d["log"][0]["hash"]} {d["log"][0]["subject"]}'
    return d


# ============================================================
# 静态项目信息（低频人工维护区）
# ============================================================

VERSION = "v0.7"
PHASE = "第一章「复苏」 · Vertical Slice"
PHASE_NOTE = "第0章 Demo 已冻结（D-021）· 2026-08-12 解冻进入第一章"
ONLINE_URL = "https://65957d6122464b4ab53c6e20a06a527a.app.workbuddy.link"
DEVHUB = "?devHub=1（9 个种子档）"

# 当前焦点（来自 CURRENT_TASK.md，人工同步）
FOCUS = [
    {"icon": "🎣", "name": "钓鱼手感收口", "status": "live", "note": "Phase 1 已实现待制作人实机试玩（S6 老河堤）· 探针 34/34"},
    {"icon": "🌾", "name": "《秋日晒场》", "status": "next", "note": "第一章章末收束 · 台词已定稿（08-19）· 按优先级最后做 · 约 8 人日"},
    {"icon": "⏱️", "name": "昼夜 ActionTime", "status": "wait", "note": "验收通过 · 待实机试玩定「10 分钟/次」最终值 · 试玩清单 v1.1 已就绪"},
    {"icon": "💕", "name": "心语·一收尾", "status": "done", "note": "✅ 收口完成（08-19 台词定稿：看星星的人多了）"},
    {"icon": "🌧️", "name": "天气扩面三刀", "status": "done", "note": "✅ 雨天河螺 / 雨天 NPC 台词 / 河草 · 探针债务同步清理"},
    {"icon": "🌸", "name": "夏雅·二《花期未至》", "status": "pause", "note": "⏸️ Alpha 不实现（D-011）· 正文已定稿待排期"},
]

# 生活循环里程碑（2026-08-15 闭合）
LOOPS = [
    {"emoji": "🌲", "name": "采集", "chain": "野莓/蘑菇/野花 → 居民", "exit": "野莓篮 · 晾蘑菇串 · 窗台花 · 蒲公英丛 · 小木鸟"},
    {"emoji": "🎣", "name": "钓鱼", "chain": "鱼 → 选择", "exit": "生态回应 · 交换故事 · 放生"},
    {"emoji": "🌱", "name": "种植", "chain": "作物 → 居民关系", "exit": "腌萝卜 · 番茄架 · 丰收节伏笔"},
    {"emoji": "🏘️", "name": "城镇复兴", "chain": "资源 → 需求 → 设施", "exit": "灯笼 · 花架 · 门框 · 小灶 · 鱼篓 永久反馈"},
]

# 系统清单（轮子清单 —— 新任务先查这里）
SYSTEMS = [
    ("核心系统", "#a78bfa", [
        ("SaveSystem", "存档（SAVE_VERSION 契约红线）"),
        ("EventManager", "事件总线 · triggerOnce 一次性触发"),
        ("StorySystem", "剧情（冻结区单写者制）"),
        ("QuestSystem", "任务 · DailyQuestSystem 日常"),
        ("ChapterSystem", "章节切换"),
    ]),
    ("世界模拟", "#22d3ee", [
        ("NPCSystem", "NPC 日常/台词/雨天句"),
        ("WeatherSystem", "天气 · 资源出现规则"),
        ("NatureSystem", "自然状态（P0 数据层）"),
        ("ResourceSpawner", "资源生成 present 门控"),
        ("DiscoveryManager", "自然观察发现"),
        ("AmbienceSystem", "环境音"),
        ("DailyEventSystem", "EventPlan 事件（晒场/艺术展）"),
        ("IslandReportSystem / GuiXingRecordSystem", "岛屿报告 · 归星纪事"),
        ("ResidentRequestSystem", "居民需求板"),
    ]),
    ("音频", "#fbbf24", [
        ("AudioSystem", "SFX 程序合成"),
        ("MusicSystem", "BGM 场景路由"),
        ("VoiceBank", "语音库（IndexTTS-2 主引擎）"),
    ]),
    ("平台/输入", "#f472b6", [
        ("InputManager / TouchControls", "输入 · 移动端触控"),
        ("AndroidBackHandler", "安卓返回手势"),
        ("AutomationSystem", "自动化测试钩子"),
    ]),
    ("数据层", "#34d399", [
        ("Inventory / Gathering", "背包 · 采集物定义"),
        ("FarmState / FarmRestore / FarmProgress", "农田三件套"),
        ("DiscoveryCatalog", "发现图鉴目录"),
        ("MailLetters / PhotoAlbum", "信箱 · 相簿"),
        ("exits", "地图出口（locked 预埋灯塔）"),
    ]),
]

UI_PANELS = "StoryDialogue（打字机）· QuestPanel · PhotoAlbumPanel · ShopPanel · GiftPanel · MailboxPanel · BackpackPanel · DiscoveryPanel · ResidentBoardPanel · SmartSellPreviewPanel · MusicBoxPanel · DialogueHistoryPanel · MemoryFlashback（闪回）· MemoryMoment（飘字）· StoryNotification（记忆卡）· EndingPanel · ConfirmDialog · HudMenuPanel · WaitPanel · ChapterBanner · dom-anim"

# 红线（开工必背）
REDLINES = [
    ("📱", "移动端只支持横屏", "禁竖屏视口 · 1024×768 或 844×390+hasTouch · 违反触发 #rotate-hint"),
    ("🌿", "Git 写权限统一收口", "commit/push 由 opencode 或制作人执行 · 其余 Agent 只改文件 · 禁 git add -A"),
    ("💾", "SAVE_VERSION 存档契约", "改动 = P0 敏感 · 新字段走可选+默认值 · 升版本必须备份旧档+制作人批准"),
    ("🔒", "核心文件单写入", "MapScene / SaveSystem / EventManager 同一时间只允许一个 Agent 写"),
    ("📁", "docs 禁止直接删除", "删除 docs 文件必须说明理由 + 制作人确认 · 归档用 archive/"),
    ("🎨", "美术拍板制", "Agent 不自行定稿 · 多候选交制作人挑选 · ComfyUI 默认 anima_turboV10"),
]

# 文档导航
DOC_NAV = [
    ("🚪 开工必读", "#a78bfa", [
        ("docs/CURRENT_TASK.md", "当前施工快照（今天在干什么）"),
        ("docs/AI开发前必读.md", "门禁 · 3 分钟"),
        ("docs/开发约束与架构入口.md", "架构入口 + 新增系统检查清单"),
        ("docs/AI_GUARDRAIL.md", "强制红线 · 横屏规则"),
        ("docs/AI_CONTEXT.md", "项目上下文 · 平台约束"),
        ("docs/第一章开发总纲.md", "第一章最高指导"),
        ("docs/DESIGN_DECISIONS.md", "制作人决策库（53 项，不得推翻）"),
    ]),
    ("📐 系统契约", "#22d3ee", [
        ("docs/dev/EventSystem.md", "triggerOnce 契约"),
        ("docs/dev/TestSystem.md", "L1/L2/L3 测试体系"),
        ("docs/dev/MapExpansion.md", "地图扩容四字段铁律"),
    ]),
    ("👤 角色圣经", "#fbbf24", [
        ("docs/design/character/林澈人物圣经-v1.0.md", "主角"),
        ("docs/design/character/夏雅角色篇章-春深有信-v1.0.md", "夏雅"),
        ("docs/design/character/爷爷人物圣经-v1.0.md", "爷爷"),
        ("docs/design/character/阿风人物圣经-v1.0.md", "阿风"),
        ("docs/design/character/神秘少女人物圣经-v1.0-草案.md", "神秘少女"),
    ]),
    ("🌍 世界观", "#34d399", [
        ("顶层设计.md", "最高层（根目录）"),
        ("docs/世界观设定/世界观长期规划-归星宇宙浪漫主义.md", "长期方向"),
        ("docs/世界观设定/星之碎片叙事方向-v0.1.md", "碎片骨架"),
        ("docs/世界观设定/NPC称呼规范.md", "村长→镇长收敛"),
    ]),
    ("🛠️ 工具手册", "#f472b6", [
        ("docs/IndexTTS-2语音生成工具手册.md", "配音主引擎"),
        ("docs/MiniMax语音生成工具手册.md", "T2A v2"),
        ("docs/ComfyUI-anima-turboV10-通用攻略.md", "出图工作流"),
        ("docs/APK一键打包操作手册.md", "安卓打包"),
        ("docs/工具-GPT请示桥.md", "gpt-bridge.mjs"),
    ]),
]

QUICK_CMDS = [
    ("npm run dev", "启动开发服务器（Vite）"),
    ("npm run build", "构建生产版（tsc + vite）"),
    ("index.html?devHub=1", "开发者测试入口 · 9 个种子档"),
    ("python tools/build_apk.py", "APK 一键打包"),
    ("python tools/gen_workbench.py", "刷新本工作台数据"),
]

STATUS_MAP = {
    "live": ("进行中", "#34d399"),
    "next": ("待开工", "#a78bfa"),
    "wait": ("待试玩", "#fbbf24"),
    "done": ("已完成", "#6b7280"),
    "pause": ("已暂停", "#f87171"),
}


# ============================================================
# HTML 组装
# ============================================================

def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_git_log_html(log: list) -> str:
    rows = []
    for c in log:
        rows.append(f'''
        <div class="commit">
          <div class="commit-date">{c["date"]}<span class="commit-time">{c["time"]}</span></div>
          <div class="commit-dot"></div>
          <div class="commit-body">
            <div class="commit-msg">{esc(c["subject"])}</div>
            <div class="commit-hash">{c["hash"]}{' · ' + c['tag'] if c['tag'] else ''}</div>
          </div>
        </div>''')
    return "\n".join(rows)


def build_focus_html() -> str:
    rows = []
    for f in FOCUS:
        label, color = STATUS_MAP[f["status"]]
        rows.append(f'''
        <div class="focus-item st-{f["status"]}">
          <div class="focus-head">
            <span class="focus-icon">{f["icon"]}</span>
            <span class="focus-name">{esc(f["name"])}</span>
            <span class="badge" style="background:{color}22;color:{color};border:1px solid {color}44">{label}</span>
          </div>
          <div class="focus-note">{esc(f["note"])}</div>
        </div>''')
    return "\n".join(rows)


def build_loops_html() -> str:
    rows = []
    for l in LOOPS:
        rows.append(f'''
        <div class="loop-card">
          <div class="loop-head"><span class="loop-emoji">{l["emoji"]}</span><span class="loop-name">{l["name"]}循环</span><span class="loop-check">✓ 闭合</span></div>
          <div class="loop-chain">{esc(l["chain"])}</div>
          <div class="loop-exit">出口 → {esc(l["exit"])}</div>
        </div>''')
    return "\n".join(rows)


def build_systems_html() -> str:
    blocks = []
    for cat, color, items in SYSTEMS:
        lis = "".join(
            f'<li><code style="color:{color}">{esc(n)}</code><span class="sys-desc">{esc(d)}</span></li>'
            for n, d in items
        )
        blocks.append(f'''
        <div class="sys-group">
          <div class="sys-cat" style="color:{color}">{cat}</div>
          <ul class="sys-list">{lis}</ul>
        </div>''')
    return "\n".join(blocks)


def build_redlines_html() -> str:
    rows = []
    for icon, title, note in REDLINES:
        rows.append(f'''
        <div class="redline">
          <span class="rl-icon">{icon}</span>
          <div><div class="rl-title">{esc(title)}</div><div class="rl-note">{esc(note)}</div></div>
        </div>''')
    return "\n".join(rows)


def build_docnav_html() -> str:
    blocks = []
    for title, color, items in DOC_NAV:
        lis = "".join(
            f'<li><a href="{path}" title="{esc(desc)}"><span class="doc-path">{esc(path)}</span><span class="doc-desc">{esc(desc)}</span></a></li>'
            for path, desc in items
        )
        blocks.append(f'''
        <div class="doc-group">
          <div class="doc-cat" style="color:{color}">{title}</div>
          <ul class="doc-list">{lis}</ul>
        </div>''')
    return "\n".join(blocks)


def build_cmds_html() -> str:
    return "\n".join(
        f'<div class="cmd"><code>{esc(c)}</code><span>{esc(d)}</span></div>'
        for c, d in QUICK_CMDS
    )


def asset_chart(d: dict) -> str:
    """资产分布 CSS 条形图。"""
    data = [
        ("语音 WAV", d["wav"], "#a78bfa"),
        ("打包 OGG/WAV", int(d["ogg"]) + 322, "#22d3ee"),
        ("图片 PNG", d["png"] + 75, "#fbbf24"),
        ("文档 MD", d["docs"], "#34d399"),
        ("测试文件", d["tests"], "#f472b6"),
        ("工具脚本", d["tools"], "#fb923c"),
    ]
    mx = max(v for _, v, _ in data) or 1
    rows = []
    for name, val, color in data:
        pct = max(3, int(val / mx * 100))
        rows.append(f'''
        <div class="bar-row">
          <div class="bar-label">{name}</div>
          <div class="bar-track"><div class="bar-fill" style="width:{pct}%;background:linear-gradient(90deg,{color}88,{color})"></div></div>
          <div class="bar-val">{val}</div>
        </div>''')
    return "\n".join(rows)


TEMPLATE = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>归星物语 · 项目工作台</title>
<style>
  :root{
    --bg:#0b0a18; --bg2:#100e1f;
    --card:#16142a; --card2:#1c1a33;
    --line:#2a2745; --line2:#37335c;
    --text:#e8e6f4; --dim:#9d99b8; --faint:#6d6a8a;
    --star:#a78bfa; --star2:#c4b5fd;
    --gold:#fbbf24; --cyan:#22d3ee; --green:#34d399; --pink:#f472b6; --red:#f87171;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{
    background:var(--bg); color:var(--text); min-height:100vh;
    font-family:"PingFang SC","Microsoft YaHei","Segoe UI",system-ui,sans-serif;
    font-size:14px; line-height:1.65;
    background-image:
      radial-gradient(1px 1px at 12% 22%, rgba(196,181,253,.5) 50%, transparent 51%),
      radial-gradient(1px 1px at 34% 8%, rgba(226,232,255,.35) 50%, transparent 51%),
      radial-gradient(1.5px 1.5px at 58% 30%, rgba(196,181,253,.4) 50%, transparent 51%),
      radial-gradient(1px 1px at 76% 12%, rgba(251,191,36,.4) 50%, transparent 51%),
      radial-gradient(1px 1px at 88% 42%, rgba(34,211,238,.35) 50%, transparent 51%),
      radial-gradient(1.5px 1.5px at 22% 66%, rgba(196,181,253,.3) 50%, transparent 51%),
      radial-gradient(1px 1px at 47% 84%, rgba(226,232,255,.3) 50%, transparent 51%),
      radial-gradient(1px 1px at 69% 72%, rgba(244,114,182,.3) 50%, transparent 51%),
      radial-gradient(1px 1px at 92% 88%, rgba(196,181,253,.35) 50%, transparent 51%),
      radial-gradient(ellipse 80% 45% at 50% -10%, rgba(88,68,181,.16), transparent);
    background-attachment:fixed;
  }
  a{color:var(--star2);text-decoration:none}
  a:hover{text-decoration:underline}
  code{font-family:"Cascadia Code",Consolas,"JetBrains Mono",monospace;font-size:.92em}

  .wrap{max-width:1180px;margin:0 auto;padding:0 28px 80px}

  /* ===== Header ===== */
  header{padding:44px 0 26px;text-align:center;position:relative}
  .star-mark{font-size:30px;color:var(--star);letter-spacing:8px;text-shadow:0 0 18px rgba(167,139,250,.6)}
  h1{font-size:30px;font-weight:700;letter-spacing:3px;margin:10px 0 6px}
  h1 .dim{color:var(--dim);font-weight:300;font-size:20px;margin-left:10px;letter-spacing:1px}
  .sub{color:var(--dim);font-size:13.5px}
  .badges{display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap}
  .badge{font-size:12px;padding:4px 14px;border-radius:999px;border:1px solid var(--line2);color:var(--dim);background:var(--card)}
  .badge.version{color:var(--star2);border-color:#5b4ea855;background:#2a245255}
  .badge.phase{color:var(--green);border-color:#34d39944;background:#34d39911}

  /* ===== nav ===== */
  nav{position:sticky;top:0;z-index:50;background:rgba(11,10,24,.88);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);margin:0 -28px;padding:0 28px}
  .nav-in{max-width:1124px;margin:0 auto;display:flex;gap:4px;overflow-x:auto;padding:9px 0;scrollbar-width:none}
  .nav-in::-webkit-scrollbar{display:none}
  nav a{font-size:13px;color:var(--dim);padding:5px 13px;border-radius:8px;white-space:nowrap}
  nav a:hover{color:var(--text);background:var(--card);text-decoration:none}
  nav a.hot{color:var(--gold)}

  /* ===== sections ===== */
  section{margin-top:38px}
  .sec-head{display:flex;align-items:baseline;gap:12px;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:10px}
  .sec-head h2{font-size:19px;letter-spacing:1px}
  .sec-head h2::before{content:"✦ ";color:var(--star);font-size:15px}
  .sec-head .hint{color:var(--faint);font-size:12px;margin-left:auto}

  /* ===== 状态条 ===== */
  .status-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-top:22px}
  .st-card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;position:relative;overflow:hidden}
  .st-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--star)}
  .st-card.c-gold::before{background:var(--gold)}
  .st-card.c-cyan::before{background:var(--cyan)}
  .st-card.c-green::before{background:var(--green)}
  .st-label{font-size:11.5px;color:var(--faint);letter-spacing:1px;margin-bottom:3px}
  .st-value{font-size:14px;font-weight:600}
  .st-value code{font-size:12.5px;color:var(--dim);font-weight:400}
  .st-note{font-size:12px;color:var(--dim);margin-top:2px}

  /* ===== metrics ===== */
  .metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:12px}
  .metric{background:linear-gradient(160deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:12px;padding:16px 10px 13px;text-align:center;transition:.2s}
  .metric:hover{transform:translateY(-2px);border-color:var(--line2)}
  .m-num{font-size:24px;font-weight:700;color:var(--star2);font-variant-numeric:tabular-nums}
  .m-num small{font-size:12px;color:var(--dim);font-weight:400;margin-left:2px}
  .m-label{font-size:12px;color:var(--dim);margin-top:3px}

  /* ===== 两栏 ===== */
  .cols{display:grid;grid-template-columns:1.25fr .95fr;gap:22px}
  @media(max-width:900px){.cols{grid-template-columns:1fr}}

  .panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px}

  /* focus */
  .focus-item{padding:11px 12px;border-radius:10px;border:1px solid transparent;margin-bottom:8px}
  .focus-item:last-child{margin-bottom:0}
  .focus-item.st-live{background:#34d3990d;border-color:#34d39926}
  .focus-item.st-next{background:#a78bfa0d;border-color:#a78bfa26}
  .focus-item.st-wait{background:#fbbf240d;border-color:#fbbf2426}
  .focus-item.st-done{background:#6b728008;border-color:#6b728022;opacity:.75}
  .focus-item.st-pause{background:#f871710a;border-color:#f8717122}
  .focus-head{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
  .focus-icon{font-size:16px}
  .focus-name{font-weight:600;font-size:13.5px}
  .badge{font-size:11px;padding:1px 9px;border-radius:999px;flex-shrink:0}
  .focus-note{font-size:12.5px;color:var(--dim);margin-top:4px;padding-left:25px}

  /* loops */
  .loops{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  @media(max-width:560px){.loops{grid-template-columns:1fr}}
  .loop-card{background:var(--card2);border:1px solid var(--line);border-radius:11px;padding:12px 14px}
  .loop-head{display:flex;align-items:center;gap:8px;margin-bottom:5px}
  .loop-emoji{font-size:15px}
  .loop-name{font-weight:600;font-size:13.5px;color:var(--gold)}
  .loop-check{margin-left:auto;font-size:11px;color:var(--green);border:1px solid #34d39944;background:#34d39911;padding:1px 8px;border-radius:999px}
  .loop-chain{font-size:12px;color:var(--dim)}
  .loop-exit{font-size:12px;color:var(--star2);margin-top:3px}

  /* milestone note */
  .milestone{margin-top:14px;background:linear-gradient(135deg,#fbbf240d,#a78bfa0d);border:1px solid var(--line2);border-radius:11px;padding:12px 15px;font-size:12.5px;color:var(--dim)}
  .milestone b{color:var(--gold);font-weight:600}

  /* ===== git log ===== */
  .gitlog{max-height:520px;overflow-y:auto;padding-right:6px}
  .gitlog::-webkit-scrollbar{width:5px}
  .gitlog::-webkit-scrollbar-thumb{background:var(--line2);border-radius:3px}
  .commit{display:flex;gap:14px;padding:8px 0;border-bottom:1px dashed var(--line)}
  .commit:last-child{border-bottom:none}
  .commit-date{width:38px;font-size:11.5px;color:var(--star);font-weight:600;padding-top:2px;text-align:right;flex-shrink:0}
  .commit-time{display:block;font-size:10px;color:var(--faint);font-weight:400}
  .commit-dot{width:7px;height:7px;border-radius:50%;background:var(--star);margin-top:7px;flex-shrink:0;box-shadow:0 0 8px rgba(167,139,250,.8)}
  .commit-body{min-width:0}
  .commit-msg{font-size:13px;word-break:break-all}
  .commit-hash{font-size:11px;color:var(--faint)}

  /* ===== systems ===== */
  .sys-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}
  .sys-group{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:16px 18px}
  .sys-cat{font-size:13px;font-weight:700;letter-spacing:1px;margin-bottom:10px;padding-bottom:7px;border-bottom:1px solid var(--line)}
  .sys-list{list-style:none}
  .sys-list li{padding:4.5px 0;display:flex;gap:10px;align-items:baseline;border-bottom:1px dashed var(--line)}
  .sys-list li:last-child{border-bottom:none}
  .sys-list code{font-size:12px;flex-shrink:0;max-width:52%}
  .sys-desc{font-size:12px;color:var(--dim)}
  .ui-strip{margin-top:14px;background:var(--card);border:1px solid var(--line);border-radius:13px;padding:14px 18px}
  .ui-strip .sys-cat{margin-bottom:8px}
  .ui-list{font-size:12.5px;color:var(--dim);line-height:1.9}

  /* ===== docs nav ===== */
  .doc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:14px}
  .doc-group{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:16px 18px}
  .doc-cat{font-size:13px;font-weight:700;letter-spacing:1px;margin-bottom:8px}
  .doc-list{list-style:none}
  .doc-list li a{display:flex;flex-direction:column;gap:1px;padding:5px 8px;border-radius:7px}
  .doc-list li a:hover{background:var(--card2);text-decoration:none}
  .doc-path{font-size:12.5px;color:var(--text)}
  .doc-list li a:hover .doc-path{text-decoration:underline}
  .doc-desc{font-size:11.5px;color:var(--faint)}

  /* ===== redlines ===== */
  .red-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:12px}
  .redline{display:flex;gap:13px;background:linear-gradient(150deg,#f871710a,var(--card));border:1px solid #f8717126;border-radius:12px;padding:13px 15px}
  .rl-icon{font-size:18px;flex-shrink:0;padding-top:1px}
  .rl-title{font-weight:600;font-size:13.5px;color:var(--red)}
  .rl-note{font-size:12px;color:var(--dim);margin-top:2px}

  /* ===== asset chart ===== */
  .assets-layout{display:grid;grid-template-columns:1.1fr .9fr;gap:22px}
  @media(max-width:900px){.assets-layout{grid-template-columns:1fr}}
  .bar-row{display:flex;align-items:center;gap:12px;padding:6px 0}
  .bar-label{width:88px;font-size:12.5px;color:var(--dim);text-align:right;flex-shrink:0}
  .bar-track{flex:1;height:14px;background:var(--bg2);border-radius:7px;overflow:hidden}
  .bar-fill{height:100%;border-radius:7px;transition:width .8s ease}
  .bar-val{width:44px;font-size:12.5px;color:var(--star2);font-variant-numeric:tabular-nums;flex-shrink:0}
  .size-table{width:100%;border-collapse:collapse;font-size:12.5px}
  .size-table td{padding:5.5px 4px;border-bottom:1px dashed var(--line)}
  .size-table td:last-child{text-align:right;color:var(--star2);font-variant-numeric:tabular-nums}
  .size-table tr:last-child td{border-bottom:none}
  .size-table td:first-child{color:var(--dim)}

  /* ===== cmds ===== */
  .cmd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px}
  .cmd{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px}
  .cmd code{color:var(--cyan);font-size:12.5px;background:#0b0a18;padding:3px 10px;border-radius:6px;border:1px solid var(--line);flex-shrink:0}
  .cmd span{font-size:12px;color:var(--dim)}

  footer{margin-top:52px;text-align:center;color:var(--faint);font-size:12px;line-height:2;border-top:1px solid var(--line);padding-top:24px}
  footer .star-mark{font-size:14px;letter-spacing:4px}

  @media print{ nav{display:none} body{background:#fff;color:#000} }
</style>
</head>
<body>
<div class="wrap">

<header>
  <div class="star-mark">✦ ✧ ✦</div>
  <h1>归星物语<span class="dim">项目工作台</span></h1>
  <div class="sub">像素风农场生活 RPG · Phaser + TypeScript + Vite · 多 AI 协作开发</div>
  <div class="badges">
    <span class="badge version">{{VERSION}} · {{PHASE}}</span>
    <span class="badge phase">生活循环已闭合 ✓</span>
    <span class="badge">第0章 Demo 冻结</span>
    <span class="badge">数据快照 {{GEN_TIME}}</span>
  </div>
  <div class="sub" style="margin-top:10px;font-size:12px">{{PHASE_NOTE}}</div>
</header>

<nav><div class="nav-in">
  <a href="#status">状态</a>
  <a href="#focus">当前施工</a>
  <a href="#systems">系统清单</a>
  <a href="#assets">资产</a>
  <a href="#docs">文档导航</a>
  <a href="#git">提交动态</a>
  <a href="#redlines" class="hot">红线 ⚠</a>
  <a href="#cmds">快速命令</a>
</div></nav>

<!-- ===== 状态总览 ===== -->
<section id="status">
  <div class="sec-head"><h2>状态总览</h2><span class="hint">当前项目处于什么位置</span></div>
  <div class="status-strip">
    <div class="st-card">
      <div class="st-label">最近提交</div>
      <div class="st-value"><code>{{LAST_COMMIT}}</code></div>
      <div class="st-note">{{LAST_COMMIT_DATE}} · 共 {{COMMITS}} 次提交</div>
    </div>
    <div class="st-card c-gold">
      <div class="st-label">当前焦点</div>
      <div class="st-value">钓鱼手感收口 · 待实机试玩</div>
      <div class="st-note">Phase 1 状态机已落地 · 探针 34/34</div>
    </div>
    <div class="st-card c-cyan">
      <div class="st-label">下一里程碑</div>
      <div class="st-value">《秋日晒场》</div>
      <div class="st-note">第一章章末收束 · 复用 EventPlan · 约 8 人日</div>
    </div>
    <div class="st-card c-green">
      <div class="st-label">在线试玩</div>
      <div class="st-value"><a href="{{ONLINE_URL}}" target="_blank">CloudStudio 部署 ↗</a></div>
      <div class="st-note">08-15 重建 · dist/ 全量刷新</div>
    </div>
  </div>

  <div class="metrics" style="margin-top:16px">
    <div class="metric"><div class="m-num">{{LINES}}<small>行</small></div><div class="m-label">TypeScript 代码</div></div>
    <div class="metric"><div class="m-num">{{TS_FILES}}<small>个</small></div><div class="m-label">源文件</div></div>
    <div class="metric"><div class="m-num">{{SYS_COUNT}}<small>套</small></div><div class="m-label">游戏系统</div></div>
    <div class="metric"><div class="m-num">{{UI_COUNT}}<small>个</small></div><div class="m-label">UI 面板</div></div>
    <div class="metric"><div class="m-num">{{MAPS}}<small>张</small></div><div class="m-label">地图场景</div></div>
    <div class="metric"><div class="m-num">{{MUSIC}}<small>首</small></div><div class="m-label">场景音乐</div></div>
    <div class="metric"><div class="m-num">{{DOCS}}<small>篇</small></div><div class="m-label">文档</div></div>
    <div class="metric"><div class="m-num">53<small>项</small></div><div class="m-label">制作人决策</div></div>
    <div class="metric"><div class="m-num">{{TESTS}}<small>个</small></div><div class="m-label">测试文件</div></div>
    <div class="metric"><div class="m-num">{{TOOLS}}<small>个</small></div><div class="m-label">工具脚本</div></div>
  </div>
</section>

<!-- ===== 当前施工 ===== -->
<section id="focus">
  <div class="sec-head"><h2>当前施工</h2><span class="hint">同步自 docs/CURRENT_TASK.md · 由 gen_workbench.py 维护</span></div>
  <div class="cols">
    <div class="panel">
      <div style="font-size:13px;font-weight:600;color:var(--star2);margin-bottom:12px;letter-spacing:1px">进行中 / 待办</div>
      {{FOCUS_HTML}}
      <div class="milestone">
        🏁 <b>里程碑 · 生活循环闭合（2026-08-15）</b>——四大基础生活循环全部闭合，不是"功能数量够了"，而是每个系统都有了自己的出口。下一步 v1.5：《秋日晒场》第一次全镇回应玩家。
      </div>
    </div>
    <div>
      <div class="panel">
        <div style="font-size:13px;font-weight:600;color:var(--gold);margin-bottom:12px;letter-spacing:1px">四大生活循环</div>
        {{LOOPS_HTML}}
      </div>
      <div class="panel" style="margin-top:14px">
        <div style="font-size:13px;font-weight:600;color:var(--cyan);margin-bottom:10px;letter-spacing:1px">任务分类三过滤器（08-13 拍板）</div>
        <div style="font-size:12.5px;color:var(--dim);line-height:1.9">
          <b style="color:var(--green)">A 直接执行</b> · 明确可验证（探针/存档/UI/资源接入）<br>
          <b style="color:var(--gold)">B 先出方案</b> · 新玩法/新NPC/新区域 → 先交方案文档<br>
          <b style="color:var(--red)">C 制作人判断</b> · 节奏/情绪/是否"有意思" → 拍板权在人
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== 系统清单 ===== -->
<section id="systems">
  <div class="sec-head"><h2>系统清单 · 轮子索引</h2><span class="hint">新需求动手前先查这里，禁止造第二个轮子</span></div>
  <div class="sys-grid">{{SYSTEMS_HTML}}</div>
  <div class="ui-strip">
    <div class="sys-cat" style="color:#e879f9">UI 面板（{{UI_COUNT}} 个 · 模块级单例 + panelFadeIn/Out）</div>
    <div class="ui-list">{{UI_PANELS}}</div>
  </div>
</section>

<!-- ===== 资产统计 ===== -->
<section id="assets">
  <div class="sec-head"><h2>资产统计</h2><span class="hint">采集于 {{GEN_TIME}} · 不含 archive 与 .git</span></div>
  <div class="assets-layout">
    <div class="panel">
      <div style="font-size:13px;font-weight:600;color:var(--star2);margin-bottom:12px;letter-spacing:1px">文件分布</div>
      {{ASSET_CHART}}
    </div>
    <div class="panel">
      <div style="font-size:13px;font-weight:600;color:var(--gold);margin-bottom:12px;letter-spacing:1px">空间占用</div>
      <table class="size-table">
        <tr><td>src 源代码</td><td>{{SIZE_SRC}}</td></tr>
        <tr><td>docs 文档库</td><td>{{SIZE_DOCS}}</td></tr>
        <tr><td>tools 工具链</td><td>{{SIZE_TOOLS}}</td></tr>
        <tr><td>tests 探针测试</td><td>{{SIZE_TESTS}}</td></tr>
        <tr><td>assets 游戏资源</td><td>{{SIZE_ASSETS}}</td></tr>
        <tr><td>art_source 美术源（含语音 WAV）</td><td>{{SIZE_ART}}</td></tr>
        <tr><td>dist 构建产物</td><td>{{SIZE_DIST}}</td></tr>
      </table>
      <div style="font-size:11.5px;color:var(--faint);margin-top:10px;line-height:1.8">
        语音源 {{WAV}} WAV + {{MP3}} MP3 · 打包 {{OGG}} OGG（含 322 WAV 过渡）<br>
        地图 {{MAPS}} 张：farm / town / forest / house / elder_house / mine / gate / lighthouse（灯塔 locked 预埋）
      </div>
    </div>
  </div>
</section>

<!-- ===== 文档导航 ===== -->
<section id="docs">
  <div class="sec-head"><h2>文档导航</h2><span class="hint">点击路径可直接跳转本机文档（需与工作台同目录打开）</span></div>
  <div class="doc-grid">{{DOCS_HTML}}</div>
</section>

<!-- ===== 提交动态 ===== -->
<section id="git">
  <div class="sec-head"><h2>提交动态</h2><span class="hint">最近 {{LOG_N}} 条 · git log 实时采集</span></div>
  <div class="panel gitlog">{{GIT_LOG_HTML}}</div>
</section>

<!-- ===== 红线 ===== -->
<section id="redlines">
  <div class="sec-head"><h2>红线 ⚠ 开工必背</h2><span class="hint">违反任意一条 = 协作事故风险</span></div>
  <div class="red-grid">{{REDLINES_HTML}}</div>
</section>

<!-- ===== 快速命令 ===== -->
<section id="cmds">
  <div class="sec-head"><h2>快速命令</h2><span class="hint">日常开发入口</span></div>
  <div class="cmd-grid">{{CMDS_HTML}}</div>
</section>

<footer>
  <div class="star-mark">✦ ✧ ✦</div>
  <div>归星物语 · 项目工作台 · <code>python tools/gen_workbench.py</code> 刷新数据</div>
  <div>静态内容（当前施工/系统清单/红线）在脚本 STATIC 区人工维护 · 动态数据（git/统计）每次运行自动采集</div>
</footer>

</div>
</body>
</html>
"""


def build_html(d: dict) -> str:
    html = TEMPLATE
    repl = {
        "{{VERSION}}": VERSION,
        "{{PHASE}}": PHASE,
        "{{PHASE_NOTE}}": PHASE_NOTE,
        "{{GEN_TIME}}": d["gen_time"],
        "{{COMMITS}}": str(d["commits"]),
        "{{LAST_COMMIT}}": esc(d["last_commit"][:60]),
        "{{LAST_COMMIT_DATE}}": d["last_commit_date"],
        "{{LINES}}": f'{d["lines"]:,}',
        "{{TS_FILES}}": str(d["ts_files"]),
        "{{SYS_COUNT}}": str(d["sys_count"]),
        "{{UI_COUNT}}": str(d["ui_count"]),
        "{{DATA_COUNT}}": str(d["data_count"]),
        "{{MAPS}}": str(d["maps"]),
        "{{DOCS}}": str(d["docs"]),
        "{{TOOLS}}": str(d["tools"]),
        "{{TESTS}}": str(d["tests"]),
        "{{TASKS}}": str(d["tasks"]),
        "{{PNG}}": str(d["png"]),
        "{{WAV}}": str(d["wav"]),
        "{{MP3}}": str(d["mp3"]),
        "{{OGG}}": str(d["ogg"]),
        "{{MUSIC}}": str(d["music"]),
        "{{SIZE_SRC}}": d["size_src"],
        "{{SIZE_DOCS}}": d["size_docs"],
        "{{SIZE_TOOLS}}": d["size_tools"],
        "{{SIZE_TESTS}}": d["size_tests"],
        "{{SIZE_ASSETS}}": d["size_assets"],
        "{{SIZE_ART}}": d["size_art"],
        "{{SIZE_DIST}}": d["size_dist"],
        "{{ONLINE_URL}}": ONLINE_URL,
        "{{FOCUS_HTML}}": build_focus_html(),
        "{{LOOPS_HTML}}": build_loops_html(),
        "{{SYSTEMS_HTML}}": build_systems_html(),
        "{{UI_PANELS}}": UI_PANELS,
        "{{REDLINES_HTML}}": build_redlines_html(),
        "{{DOCS_HTML}}": build_docnav_html(),
        "{{CMDS_HTML}}": build_cmds_html(),
        "{{GIT_LOG_HTML}}": build_git_log_html(d["log"]),
        "{{ASSET_CHART}}": asset_chart(d),
        "{{LOG_N}}": str(len(d["log"])),
    }
    for k, v in repl.items():
        html = html.replace(k, v)
    # 清理可能残留的占位符
    html = re.sub(r"\{\{[A-Z_]+\}\}", "", html)
    return html


def main():
    check_only = "--check" in sys.argv
    d = collect()

    if check_only:
        print("== 采集结果（--check 模式，不写文件）==")
        for k in sorted(d):
            if k == "log":
                print(f"  log: {len(d['log'])} commits, latest = {d['log'][0]['subject'] if d['log'] else 'N/A'}")
            else:
                print(f"  {k}: {d[k]}")
        return

    html = build_html(d)
    OUT.write_text(html, encoding="utf-8")
    size_kb = OUT.stat().st_size / 1024
    print(f"✅ 工作台已生成: {OUT}")
    print(f"   大小: {size_kb:.1f} KB · 提交数: {d['commits']} · 最近提交: {d['last_commit'][:50]}")
    print(f"   刷新: python tools/gen_workbench.py")


if __name__ == "__main__":
    main()
