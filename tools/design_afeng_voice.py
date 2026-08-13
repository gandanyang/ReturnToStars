#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一次性脚本：用 MiniMax voice_design 设计 3 个阿风候选音色供制作人试听。

流程：
  - 调用 /v1/voice_design 3 次（3 个不同描述方向）
  - 试听文本统一用 adv_10 台词
  - 输出 3 个 mp3 试听文件 + 3 个 voice_id

用法：
  python tools/design_afeng_voice.py

产物：
  - art_source/audio/voice/adventurer/afeng_design_a_v1.mp3
  - art_source/audio/voice/adventurer/afeng_design_b_v1.mp3
  - art_source/audio/voice/adventurer/afeng_design_c_v1.mp3

注意：voice_design 产出的音色为临时音色，7 天内未使用会被删除。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
BASE_URL = "https://api.minimaxi.com/v1"
PREVIEW_TEXT = "没想到这么多年过去，你还是回来了。"
OUT_DIR = ROOT / "art_source" / "audio" / "voice" / "adventurer"

# 3 个候选方向（均围绕"经历过远方但依旧温柔的人"人设微调）
CANDIDATES = [
    {
        "voice_id": "afeng_design_a_v1",
        "prompt": "一位经历过远方旅行的温和青年男声，音色温暖、略带距离感但不冷漠，语速平缓，像在风中讲故事的人",
        "desc_cn": "A 温和旅行者（基础版）",
    },
    {
        "voice_id": "afeng_design_b_v1",
        "prompt": "一位略带沙哑的青年男声，有阅历感但不沧桑，声音里带着远方的风尘与温柔，像长途旅行后回到故乡的人",
        "desc_cn": "B 略带沙哑的远方感（强调阅历）",
    },
    {
        "voice_id": "afeng_design_c_v1",
        "prompt": "一位清澈温和的青年男声，音色干净、温暖、略带疏离，像在黄昏的窗边轻声说话的人，不年轻也不老",
        "desc_cn": "C 清澈温和青年（偏干净）",
    },
]


def read_env_file() -> dict[str, str]:
    env: dict[str, str] = {}
    p = TOOLS / ".env"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def get_api_key() -> tuple[str, str]:
    api_key = os.environ.get("MINIMAX_API_KEY")
    group_id = os.environ.get("MINIMAX_GROUP_ID", "")
    if not api_key:
        env = read_env_file()
        api_key = env.get("MINIMAX_API_KEY", "")
        group_id = env.get("MINIMAX_GROUP_ID", "")
    if not api_key:
        r = subprocess.run(
            ["node", str(TOOLS / "secret_key.mjs"), "get", "MINIMAX_API_KEY"],
            capture_output=True, text=True, timeout=30, cwd=str(ROOT),
        )
        if r.returncode == 0 and r.stdout.strip():
            api_key = r.stdout.strip()
        r2 = subprocess.run(
            ["node", str(TOOLS / "secret_key.mjs"), "get", "MINIMAX_GROUP_ID"],
            capture_output=True, text=True, timeout=30, cwd=str(ROOT),
        )
        if r2.returncode == 0 and r2.stdout.strip():
            group_id = r2.stdout.strip()
    if not api_key:
        raise RuntimeError("未找到 MINIMAX_API_KEY（环境变量 / tools/.env / 加密保险箱）")
    return api_key, group_id


def voice_design(api_key: str, group_id: str, prompt: str, voice_id: str) -> tuple[str, bytes]:
    """调用 voice_design，返回 (voice_id, trial_audio_bytes)。"""
    import urllib.parse
    body = {
        "prompt": prompt,
        "preview_text": PREVIEW_TEXT,
        "voice_id": voice_id,
        "aigc_watermark": False,
    }
    url = BASE_URL + "/voice_design" + (f"?GroupId={urllib.parse.quote(group_id)}" if group_id else "")
    req = urllib.request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if data.get("base_resp", {}).get("status_code", 0) != 0:
        raise RuntimeError("设计失败: " + json.dumps(data, ensure_ascii=False)[:400])
    vid = data.get("voice_id", voice_id)
    trial_hex = data.get("trial_audio", "")
    if not trial_hex:
        raise RuntimeError("响应无试听音频: " + json.dumps(data, ensure_ascii=False)[:300])
    return vid, bytes.fromhex(trial_hex)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"阿风音色设计：共 {len(CANDIDATES)} 个候选，试听文本：{PREVIEW_TEXT}\n")
    api_key, group_id = get_api_key()
    print(f"  API Key: {api_key[:8]}...{api_key[-4:]}  GroupId: {group_id or '(无)'}\n")

    results = []
    for i, c in enumerate(CANDIDATES, 1):
        print(f"[{i}/{len(CANDIDATES)}] {c['desc_cn']}")
        print(f"  prompt: {c['prompt']}")
        print(f"  voice_id: {c['voice_id']}")
        try:
            vid, audio = voice_design(api_key, group_id, c["prompt"], c["voice_id"])
            out = OUT_DIR / f"{c['voice_id']}.mp3"
            out.write_bytes(audio)
            print(f"  [OK] 试听已保存: {out} ({len(audio):,} bytes)\n")
            results.append((c["desc_cn"], vid, out))
        except Exception as e:
            print(f"  [FAIL] {e}\n")
            results.append((c["desc_cn"], None, None))

    print("=" * 60)
    print("设计完成，请试听以下 3 个候选：")
    for desc, vid, path in results:
        if vid and path:
            print(f"  {desc}")
            print(f"    voice_id: {vid}")
            print(f"    试听: {path}")
        else:
            print(f"  {desc} — 失败")
    print("\n制作人选定后，告知 voice_id，我将批量生成 adv_07/08/09/10（全量重配）。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
