#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MiniMax（海螺）T2A 批量生成任意角色语音（泛化版 gen_xiya_minimax）。

用法:
  python tools/gen_role_minimax.py --role carpenter --voice-id laozhou_carpenter_v1 [--dry-run] [--limit N]
  python tools/gen_role_minimax.py --role carpenter --voice-id laozhou_carpenter_v1 --dry-run

产物:
  art_source/audio/voice/<role>/<tid>.wav     （16k 单声道 PCM s16le，与旧管线一致）
  art_source/audio/voice/<role>/<tid>.wav.txt （来源文本 sidecar，供 gen_mainline_voice 校验）

配置:
  MINIMAX_API_KEY 优先级：环境变量 > tools/.env > tools/.secrets.enc（DPAPI 保险箱）

说明:
  MiniMax 无 VoxCPM 的 prompt 回显问题，无需前导裁剪；台词清单从
  gen_mainline_voice.py 的 T 列表直接导入（按 role 过滤），与 StorySystem 映射保持一致。
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
BASE_URL = "https://api.minimaxi.com/v1/t2a_v2"
DEFAULT_MODEL = "speech-2.8-turbo"
MAX_RETRY = 3


def load_role_tasks(role: str) -> list[tuple[str, str, str]]:
    spec = importlib.util.spec_from_file_location("gmv", str(TOOLS / "gen_mainline_voice.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return [t for t in mod.T if t[0] == role]


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


def get_api_key() -> str:
    if os.environ.get("MINIMAX_API_KEY"):
        return os.environ["MINIMAX_API_KEY"]
    env = read_env_file()
    if env.get("MINIMAX_API_KEY"):
        return env["MINIMAX_API_KEY"]
    r = subprocess.run(
        ["node", str(TOOLS / "secret_key.mjs"), "get", "MINIMAX_API_KEY"],
        capture_output=True, text=True, timeout=30, cwd=str(ROOT),
    )
    if r.returncode == 0 and r.stdout.strip():
        return r.stdout.strip()
    raise RuntimeError("未找到 MINIMAX_API_KEY（环境变量 / tools/.env / 加密保险箱）")


def tts(text: str, voice_id: str, model: str, api_key: str) -> tuple[bytes, float]:
    body = {
        "model": model,
        "text": text,
        "stream": False,
        "output_format": "hex",
        "voice_setting": {"voice_id": voice_id, "speed": 1.0, "vol": 1.0, "pitch": 0},
        "audio_setting": {"sample_rate": 32000, "bitrate": 128000, "format": "mp3", "channel": 1},
    }
    req = urllib.request.Request(
        BASE_URL,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if data.get("base_resp", {}).get("status_code", 0) != 0:
        raise RuntimeError("API 错误: " + json.dumps(data.get("base_resp", data), ensure_ascii=False)[:300])
    audio_hex = (data.get("data") or {}).get("audio")
    if not audio_hex:
        raise RuntimeError("响应无音频: " + json.dumps(data, ensure_ascii=False)[:300])
    dur = (data.get("extra_info") or {}).get("audio_length", 0) / 1000.0
    return bytes.fromhex(audio_hex), dur


def to_wav(mp3_bytes: bytes, out_wav: Path) -> None:
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "tmp.mp3"
        tmp.write_bytes(mp3_bytes)
        r = subprocess.run(
            ["python", "-m", "pydub", "-q"], capture_output=True, text=True,
        )
        # pydub 可能未安装；直接用 ffmpeg（与 gen_xiya_minimax 一致）
        ffmpeg = r"E:\BINGdown\VoxCPM\src\ffmpeg\bin\ffmpeg.exe"
        r2 = subprocess.run(
            [ffmpeg, "-y", "-i", str(tmp), "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(out_wav)],
            capture_output=True, text=True, timeout=90,
        )
        if r2.returncode != 0:
            raise RuntimeError("ffmpeg 失败: " + r2.stderr[-300:])


def main() -> int:
    p = argparse.ArgumentParser(description="MiniMax 批量生成任意角色语音")
    p.add_argument("--role", required=True, help="角色（gen_mainline_voice.py 的 role，如 carpenter）")
    p.add_argument("--voice-id", required=True, help="MiniMax voice_id（如 laozhou_carpenter_v1）")
    p.add_argument("--dry-run", action="store_true", help="只打印任务清单，不调用 API")
    p.add_argument("--limit", type=int, default=0, help="只跑前 N 条")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--force", action="store_true", help="覆盖已存在文件")
    p.add_argument("--ids", default="", help="只跑指定 tid（逗号分隔，如 adv_07,adv_08）；不传则跑全部")
    args = p.parse_args()

    tasks = load_role_tasks(args.role)
    if args.limit > 0:
        tasks = tasks[: args.limit]
    if args.ids:
        wanted = {x.strip() for x in args.ids.split(",") if x.strip()}
        tasks = [t for t in tasks if t[1] in wanted]

    voice_dir = ROOT / "art_source" / "audio" / "voice" / args.role
    voice_dir.mkdir(parents=True, exist_ok=True)

    todo = []
    for role, tid, text in tasks:
        out = voice_dir / f"{tid}.wav"
        sidecar = voice_dir / f"{tid}.wav.txt"
        if out.exists() and sidecar.exists() and not args.force:
            recorded = sidecar.read_text(encoding="utf-8").strip()
            if recorded == text:
                continue  # 已生成且文本一致
        todo.append((role, tid, text))

    print(f"MiniMax 批量生成：角色={args.role} 共 {len(tasks)} 条，待跑 {len(todo)} | voice={args.voice_id} model={args.model}")
    if args.dry_run:
        for role, tid, text in todo:
            print(f"  [{role}/{tid}] {text}")
        return 0

    api_key = get_api_key()
    ok = 0
    failed: list[str] = []
    for role, tid, text in todo:
        out = voice_dir / f"{tid}.wav"
        sidecar = voice_dir / f"{tid}.wav.txt"
        try:
            mp3, dur = None, 0.0
            last_err = ""
            for attempt in range(1, MAX_RETRY + 1):
                try:
                    mp3, dur = tts(text, args.voice_id, args.model, api_key)
                    break
                except Exception as e:  # noqa: BLE001
                    last_err = str(e)
                    print(f"  [重试 {attempt}/{MAX_RETRY}] {tid}: {last_err[:120]}")
            if mp3 is None:
                raise RuntimeError(f"生成失败（{MAX_RETRY} 次重试）: {last_err}")
            to_wav(mp3, out)
            if out.stat().st_size < 1024:
                raise RuntimeError("产物过小，疑似无效")
            sidecar.write_text(text, encoding="utf-8")
            ok += 1
            print(f"  [OK] [{role}/{tid}] {dur:.1f}s -> {out.name} ({out.stat().st_size:,} bytes)")
        except Exception as e:  # noqa: BLE001
            failed.append(f"{role}/{tid}")
            print(f"  [FAIL] [{role}/{tid}] {e}")

    print(f"\n完成：本轮成功 {ok} / {len(todo)}，失败 {len(failed)}")
    if failed:
        print("失败列表:", ", ".join(failed))
        return 40
    return 0


if __name__ == "__main__":
    sys.exit(main())
