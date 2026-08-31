#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
试玩-07/12 语音重录接入脚本（交接文档 §三 的自动化）。

用途：制作人试听确认后，把 tmp/voice_retrial_20260830/ 的 4 条重录 wav 接入正式管线：
  ① 覆盖 art_source/audio/voice/<role>/<tid>.wav（母档归档，覆盖前备份到 tmp/voice_apply_backup/）
  ② ffmpeg 转 ogg（64kbps 单声道 44.1kHz，与 tools/convert_voice_ogg.py 参数一致）
     入 public/audio/voice_normalized/<role>/<tid>.ogg
  ③ 打印后续步骤（probe-voice / probe-bug039-voice-sync 回归 + 问题追踪闭环）

用法：
  python tools/apply_voice_retrial.py            # dry-run：只打印计划，不写任何文件
  python tools/apply_voice_retrial.py --apply    # 真正执行（先自动备份被覆盖的旧文件）
  python tools/apply_voice_retrial.py --adv-take 2 [--apply]   # 指定 adv_01 用第几个 take（默认 1）
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRIAL_DIR = ROOT / "tmp" / "voice_retrial_20260830"
BACKUP_DIR = ROOT / "tmp" / "voice_apply_backup"
ART_VOICE = ROOT / "art_source" / "audio" / "voice"
PUB_VOICE = ROOT / "public" / "audio" / "voice_normalized"
FFMPEG = "ffmpeg"

# (试听文件名不含扩展名, 角色, tid, 台词[用于与 art_source sidecar 比对])
TASKS = [
    ("linche_station_04", "linche", "station_04",
     "至少这次，是我自己选的离开。"),
    ("gardener_garden_01", "gardener", "garden_01",
     "你好呀，我叫小梅。这些花都是我亲手种的，漂亮吧？"),
    ("gardener_garden_02", "gardener", "garden_02",
     "你爷爷以前每天下午都会来闻这株花的味道。他说这和城市的空气不一样。"),
    # adv_01 按命令行 --adv-take 解析
]

ADV_TEXT = "嘿！还记得我不？小时候后山那一圈，就是我带你跑熟的。"


def resolve_adv_name(take: int) -> str:
    return f"adventurer_adv_01_take{take}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="真正执行（默认 dry-run 只打印计划）")
    ap.add_argument("--adv-take", type=int, default=1, help="adv_01 使用第几个 take（默认 1）")
    ap.add_argument("--fix-sidecar", action="store_true",
                    help="允许覆盖与重录台词不一致的 sidecar（写为新台词）。"
                         "adv_01 预期需要：旧 sidecar 是本地化前的『庄园主』时代开场白（试玩-12 根因）")
    args = ap.parse_args()

    jobs = [(name, role, tid, text) for name, role, tid, text in TASKS]
    jobs.append((resolve_adv_name(args.adv_take), "adventurer", "adv_01", ADV_TEXT))

    mode = "APPLY" if args.apply else "DRY-RUN（不写文件，加 --apply 执行）"
    print(f"=== 语音重录接入 [{mode}] ===\n")

    ok = True
    for name, role, tid, text in jobs:
        src = TRIAL_DIR / f"{name}.wav"
        art_dst = ART_VOICE / role / f"{tid}.wav"
        pub_ogg = PUB_VOICE / role / f"{tid}.ogg"
        sidecar = art_dst.with_suffix(".wav.txt")

        print(f"• {role}/{tid}")
        if not src.exists():
            print(f"  ✗ 试听源缺失: {src.relative_to(ROOT)}"); ok = False; continue
        if sidecar.exists():
            sidecar_text = sidecar.read_text(encoding="utf-8").strip()
            if sidecar_text != text:
                if args.fix_sidecar:
                    print(f"  ⚠ sidecar 为旧台词（将随接入更新为新台词）：「{sidecar_text[:24]}…」")
                else:
                    print(f"  ✗ sidecar 文本与重录台词不一致（确认属本地化更新则加 --fix-sidecar）: {sidecar}")
                    ok = False
                    continue
        else:
            print(f"  ⚠ sidecar 不存在（接入时补写新台词 sidecar）: {sidecar.name}")
        print(f"  源  : {src.relative_to(ROOT)}")
        print(f"  覆盖: {art_dst.relative_to(ROOT)}" + ("（旧文件先备份）" if art_dst.exists() else "（新文件）"))
        print(f"  转码: {pub_ogg.relative_to(ROOT)}（ffmpeg libvorbis 64k mono 44.1k）")

        if not args.apply:
            continue

        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        if art_dst.exists():
            bdir = BACKUP_DIR / role
            bdir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(art_dst, bdir / f"{tid}.wav")
            print(f"  备份: {bdir.relative_to(ROOT)}/{tid}.wav")
        shutil.copy2(src, art_dst)
        # sidecar 同步为重录台词（wav 与来源文本必须一致，VoiceBank 匹配与时长筛查都依赖它）
        sidecar.write_text(text, encoding="utf-8")
        pub_ogg.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [FFMPEG, "-y", "-i", str(src), "-c:a", "libvorbis", "-b:a", "64k", "-ac", "1", "-ar", "44100", str(pub_ogg)],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        print("  ✓ 完成")

    if args.apply and ok:
        print("\n=== 后续步骤（人工执行） ===")
        print("1. 回归: node tests/probes/probe-voice.mjs && node tests/probes/probe-bug039-voice-sync.mjs")
        print("2. 《问题追踪.md》试玩-07 / 试玩-12 状态更新为已闭环（注明重录+试听日期）")
        print("3. E-10 响度归一为独立债务，本脚本不处理")
    elif not ok:
        print("\n存在校验失败项，未执行任何写入（--apply 也不会执行失败项）")
        raise SystemExit(1)
    else:
        print("\ndry-run 结束：确认计划无误后加 --apply 执行")


if __name__ == "__main__":
    main()
