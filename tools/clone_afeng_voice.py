#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一次性脚本：用 MiniMax voice_clone 接口克隆阿风音色。

流程：
  1. 上传参考音频（afeng_clone_ref.wav，adv_07+08+09 拼接，15.19s）→ file_id
  2. 调用 /v1/voice_clone 创建克隆音色（voice_id=afeng_clone_v1）
  3. 输出 voice_id 供 gen_role_minimax.py 使用

用法：
  python tools/clone_afeng_voice.py

产物：
  - 克隆音色 voice_id：afeng_clone_v1（写入 tools/.env 的 MINIMAX_VOICE_MAP）
  - 试听音频：art_source/audio/voice/adventurer/afeng_clone_trial.mp3

注意：克隆音色 7 天内未使用会被删除。生成 adv_08/09/10 后即视为正式使用。
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
CLONE_VOICE_ID = "afeng_clone_v1"
REF_AUDIO = ROOT / "art_source" / "audio" / "voice" / "adventurer" / "afeng_clone_ref.wav"
TRIAL_TEXT = "没想到这么多年过去，你还是回来了。"
TRIAL_MODEL = "speech-2.8-turbo"


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
    """返回 (api_key, group_id)。"""
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


def upload_file(api_key: str, group_id: str, file_path: Path) -> int:
    """上传文件到 MiniMax，返回 file_id。"""
    import urllib.parse
    boundary = "----CloneAfengBoundary" + str(os.getpid())
    with open(file_path, "rb") as f:
        file_bytes = f.read()
    filename = file_path.name
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="purpose"\r\n\r\n'
        f"voice_clone\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: audio/wav\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")
    url = BASE_URL + "/files/upload" + (f"?GroupId={urllib.parse.quote(group_id)}" if group_id else "")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if data.get("base_resp", {}).get("status_code", 0) != 0:
        raise RuntimeError("上传失败: " + json.dumps(data, ensure_ascii=False)[:300])
    file_id = data.get("file", {}).get("file_id")
    if not file_id:
        raise RuntimeError("响应无 file_id: " + json.dumps(data, ensure_ascii=False)[:300])
    print(f"  [上传] file_id={file_id} ({file_path.name}, {len(file_bytes):,} bytes)")
    return int(file_id)


def clone_voice(api_key: str, group_id: str, file_id: int, voice_id: str) -> dict:
    """调用 voice_clone 创建克隆音色，返回响应（含 demo_audio 试听链接）。"""
    import urllib.parse
    body = {
        "file_id": file_id,
        "voice_id": voice_id,
        "text": TRIAL_TEXT,
        "model": TRIAL_MODEL,
        "need_noise_reduction": False,
        "need_volume_normalization": False,
        "aigc_watermark": False,
    }
    url = BASE_URL + "/voice_clone" + (f"?GroupId={urllib.parse.quote(group_id)}" if group_id else "")
    req = urllib.request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if data.get("base_resp", {}).get("status_code", 0) != 0:
        raise RuntimeError("克隆失败: " + json.dumps(data, ensure_ascii=False)[:400])
    return data


def download_trial(demo_url: str, out_path: Path) -> None:
    """下载试听音频。"""
    req = urllib.request.Request(demo_url)
    with urllib.request.urlopen(req, timeout=60) as resp:
        out_path.write_bytes(resp.read())


def main() -> int:
    if not REF_AUDIO.exists():
        print(f"❌ 参考音频不存在: {REF_AUDIO}")
        return 1
    print(f"阿风声音克隆：参考音频={REF_AUDIO.name}")
    api_key, group_id = get_api_key()
    print(f"  API Key: {api_key[:8]}...{api_key[-4:]}  GroupId: {group_id or '(无)'}")

    print("\n[1/3] 上传参考音频...")
    file_id = upload_file(api_key, group_id, REF_AUDIO)

    print(f"\n[2/3] 创建克隆音色 voice_id={CLONE_VOICE_ID}...")
    resp = clone_voice(api_key, group_id, file_id, CLONE_VOICE_ID)
    demo_url = resp.get("demo_audio", "")
    print(f"  [克隆] 成功！voice_id={CLONE_VOICE_ID}")
    if demo_url:
        print(f"  [试听] {demo_url}")
        trial_path = ROOT / "art_source" / "audio" / "voice" / "adventurer" / "afeng_clone_trial.mp3"
        try:
            download_trial(demo_url, trial_path)
            print(f"  [试听] 已下载到 {trial_path}")
        except Exception as e:
            print(f"  [试听] 下载失败（可手动访问链接）: {e}")

    print(f"\n[3/3] 克隆完成。voice_id={CLONE_VOICE_ID}")
    print(f"\n下一步：用此 voice_id 生成 adv_08/09/10（adv_07 文本未变会自动跳过）：")
    print(f"  python tools/gen_role_minimax.py --role adventurer --voice-id {CLONE_VOICE_ID}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
