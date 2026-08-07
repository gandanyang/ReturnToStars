#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MiniMax（海螺）T2A v2 批量生成/重录林澈语音（制作人 2026-08-08：林澈音色定案 A=Gentle_Youth，全量替换旧 VoxCPM 产物）。

两种模式：
  1. 默认：补录 v0.10.1 新增 9 条（内置 TASKS）
  2. --all-linche：从 gen_mainline_voice.py T 清单动态加载全部 linche 条目（+ hr/hr_station_02），
     全部用音色 A 重新生成替换旧音频（force 语义，忽略 sidecar 跳过）。

音色：
  林澈  Chinese (Mandarin)_Gentle_Youth（制作人选定 A）
  HR   同林澈声线 + 电话感 EQ（lowpass=3400/highpass=300，仅运行时标准化 wav 生效）

产物：
  art_source/audio/voice/<role>/<tid>.wav       （16k mono PCM s16le，管线源）
  art_source/audio/voice/<role>/<tid>.wav.txt   （来源文本 sidecar，供重录校验）
  public/audio/voice_normalized/<role>/<tid>.wav（loudnorm -16 LUFS，44.1k stereo；hr 附电话 EQ）

用法：
  python tools/gen_newlines_minimax.py --dry-run
  python tools/gen_newlines_minimax.py --all-linche --dry-run
  python tools/gen_newlines_minimax.py --all-linche

配置：
  MINIMAX_API_KEY 优先级：环境变量 > tools/.env > tools/.secrets.enc（DPAPI 保险箱）
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
ART_DIR = ROOT / "art_source" / "audio" / "voice"
NORM_DIR = ROOT / "public" / "audio" / "voice_normalized"
FFMPEG = r"C:\ffmpeg-6.0-essentials_build\bin\ffmpeg.exe"
BASE_URL = "https://api.minimaxi.com/v1/t2a_v2"
DEFAULT_MODEL = "speech-2.8-turbo"
VOICES = {
    "elder": "Chinese (Mandarin)_Humorous_Elder",
    "xiya": "female-shaonv-jingpin",
    "linche": "Chinese (Mandarin)_Gentle_Youth",
    "hr": "Chinese (Mandarin)_Gentle_Youth",
}
ROLE_DIRS = {"hr": "system", "sms": "system"}  # 与 gen_mainline_voice.py 一致：hr/sms 映射到 system 目录
PHONE_EQ_ROLES = {"hr"}  # 电话感 EQ 仅作用于运行时标准化 wav
MAX_RETRY = 3

# 默认模式：v0.10.1 新增补录 9 条（文本与 gen_mainline_voice.py T 清单 / StorySystem.ts 一致）
TASKS = [
    ("elder", "shard_03", '他还说，这座岛上的碎片，只有真正"想留下来"的人才能拿起来。'),
    ("elder", "shard_08", "林远山以前提过，岛上有些东西，不是留下来的，是等着被发现的。"),
    ("elder", "shard_09", "不过，比起它是什么，我更在意一件事——"),
    ("elder", "shard_10", "这么多年过去，终于又有人走到这里来了。"),
    ("xiya", "forest_01", "……这个，我以前从没见过。"),
    ("xiya", "forest_08", "在岛上住了这么久，也没听人提过后山有这样的东西。"),
    ("xiya", "forest_09", "不知道。也许，是这几天才出现的。"),
    ("linche", "forest_08", "……它一直在这里吗？"),
    ("linche", "forest_09", "我以为回来以后，只会看到一座快要消失的岛。"),
]


def load_linche_tasks() -> list[tuple[str, str, str]]:
    """从 gen_mainline_voice.py 动态导入 T 清单，取全部 linche + hr 条目。"""
    spec = importlib.util.spec_from_file_location("gmv", str(TOOLS / "gen_mainline_voice.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return [t for t in mod.T if t[0] in ("linche", "hr")]


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


def ffmpeg_convert(args: list[str]) -> None:
    r = subprocess.run([FFMPEG, "-y", *args], capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError("ffmpeg 失败: " + (r.stderr or "")[-300:])


def to_wav_16k(mp3_bytes: bytes, out_wav: Path) -> None:
    """管线源 wav：16k 单声道 PCM s16le（与 gen_elder_minimax.py 一致）。"""
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "tmp.mp3"
        tmp.write_bytes(mp3_bytes)
        ffmpeg_convert(["-i", str(tmp), "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(out_wav)])


def to_wav_norm(mp3_bytes: bytes, out_wav: Path, phone_eq: bool = False) -> None:
    """运行时 wav：loudnorm -16 LUFS，44.1k stereo（与 normalize_audio.py 一致）；hr 附加电话感 EQ。"""
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "tmp.mp3"
        tmp.write_bytes(mp3_bytes)
        af = "loudnorm=I=-16:TP=-1.5:LRA=11"
        if phone_eq:
            af += ",lowpass=f=3400,highpass=f=300"
        ffmpeg_convert(["-i", str(tmp), "-af", af, "-ar", "44100", "-ac", "2", str(out_wav)])


def main() -> int:
    p = argparse.ArgumentParser(description="MiniMax 批量生成/重录林澈语音（音色 A）")
    p.add_argument("--dry-run", action="store_true", help="只打印任务清单，不调用 API")
    p.add_argument("--all-linche", action="store_true",
                   help="全量重录 T 清单全部 linche + hr 条目（force，忽略 sidecar 跳过）")
    p.add_argument("--model", default=DEFAULT_MODEL)
    args = p.parse_args()

    tasks = load_linche_tasks() if args.all_linche else TASKS
    mode = "全量重录 linche+hr" if args.all_linche else "补录 9 条"
    print(f"MiniMax {mode}：共 {len(tasks)} 条 | model={args.model}")
    if args.dry_run:
        for role, tid, text in tasks:
            print(f"  [{role}/{tid}] {text[:36]}")
        return 0

    api_key = get_api_key()
    ok = 0
    failed: list[str] = []
    for role, tid, text in tasks:
        role_dir = ROLE_DIRS.get(role, role)
        out_art = ART_DIR / role_dir / f"{tid}.wav"
        out_norm = NORM_DIR / role_dir / f"{tid}.wav"
        side = out_art.with_suffix(".wav.txt")
        out_art.parent.mkdir(parents=True, exist_ok=True)
        out_norm.parent.mkdir(parents=True, exist_ok=True)
        try:
            mp3, dur = None, 0.0
            last_err = ""
            for attempt in range(1, MAX_RETRY + 1):
                try:
                    mp3, dur = tts(text, VOICES[role], args.model, api_key)
                    break
                except Exception as e:  # noqa: BLE001
                    last_err = str(e)
                    print(f"  [重试 {attempt}/{MAX_RETRY}] {tid}: {last_err[:120]}")
            if mp3 is None:
                raise RuntimeError(f"生成失败（{MAX_RETRY} 次重试）: {last_err}")
            to_wav_16k(mp3, out_art)
            to_wav_norm(mp3, out_norm, phone_eq=role in PHONE_EQ_ROLES)
            if out_art.stat().st_size < 1024 or out_norm.stat().st_size < 1024:
                raise RuntimeError("产物过小，疑似无效")
            side.write_text(text, encoding="utf-8")
            ok += 1
            print(f"  [OK] [{role}/{tid}] {dur:.1f}s -> {out_norm.name}（{out_norm.stat().st_size:,} bytes）")
        except Exception as e:  # noqa: BLE001
            failed.append(f"{role}/{tid}")
            print(f"  [FAIL] [{role}/{tid}] {e}")

    print(f"\n完成：成功 {ok}，失败 {len(failed)}")
    if failed:
        print("失败列表:", ", ".join(failed))
        return 40
    return 0


if __name__ == "__main__":
    sys.exit(main())
