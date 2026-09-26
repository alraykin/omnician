#!/usr/bin/env python3
"""Encode leftover lanes from CrocellKit stereo mix + VCSL clap tiers."""

from __future__ import annotations

import json
import math
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path("/tmp/croc/CrocellKit_Stereo_MIX")
CLAP_SRC = Path("/tmp/vcsl-claps")
OUT = ROOT / "public" / "rhythm" / "drums" / "crocell"
MANIFEST = OUT / "manifest.json"

PIECES = {
    "ride_bell": {
        "dir": SRC / "RideRBell",
        "xml": SRC / "RideRBell" / "RideRBell.xml",
        "seconds": 2.5,
    },
    "china": {
        "dir": SRC / "ChinaR",
        "xml": SRC / "ChinaR" / "ChinaR.xml",
        "seconds": 3.5,
    },
    "splash": {
        "dir": SRC / "SplashL",
        "xml": SRC / "SplashL" / "SplashL.xml",
        "seconds": 2.2,
    },
    "stack": {
        "dir": SRC / "CrashRStopped",
        "xml": SRC / "CrashRStopped" / "CrashRStopped.xml",
        "seconds": 1.35,
    },
}

CLAP_TIERS = {
    1: CLAP_SRC / "SoloClap_vl1.wav",
    2: CLAP_SRC / "SoloClap_vl2.wav",
    3: CLAP_SRC / "SoloClap_vl3.wav",
    4: CLAP_SRC / "SoloClap_vl3.wav",
    5: CLAP_SRC / "SoloClap_vl4.wav",
}


def parse_samples(xml_path: Path, base: Path) -> list[tuple[float, Path]]:
    text = xml_path.read_text()
    rows: list[tuple[float, Path]] = []
    seen: set[str] = set()
    for match in re.finditer(r'<sample name="[^"]+" power="([^"]+)">[\s\S]*?file="([^"]+)"', text):
        rel = match.group(2)
        if rel in seen:
            continue
        seen.add(rel)
        rows.append((float(match.group(1)), base / rel))
    rows.sort(key=lambda item: item[0])
    return rows


def split_tiers(rows: list[tuple[float, Path]]) -> dict[int, list[Path]]:
    if not rows:
        return {}
    n = len(rows)
    # Equal-count buckets by recorded power so Intensity tracks the source.
    buckets: dict[int, list[Path]] = {tier: [] for tier in range(1, 6)}
    for index, (_power, path) in enumerate(rows):
        tier = min(5, 1 + index * 5 // n)
        buckets[tier].append(path)
    # Ensure every tier has at least one hit; borrow nearest neighbor.
    for tier in range(1, 6):
        if buckets[tier]:
            continue
        for delta in (1, -1, 2, -2, 3, -3, 4, -4):
            other = tier + delta
            if 1 <= other <= 5 and buckets[other]:
                buckets[tier] = buckets[other][:2]
                break
    # Cap at 2 round-robins, preferring the ends of the bucket.
    out: dict[int, list[Path]] = {}
    for tier, paths in buckets.items():
        if len(paths) <= 2:
            out[tier] = paths
        else:
            out[tier] = [paths[0], paths[-1]]
    return out


def peak_rms(path: Path) -> tuple[float, float]:
    raw = subprocess.check_output(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(path),
            "-ac",
            "2",
            "-ar",
            "44100",
            "-f",
            "f32le",
            "-",
        ]
    )
    import numpy as np

    data = np.frombuffer(raw, dtype=np.float32)
    if data.size == 0:
        return -99.0, -99.0
    peak = float(np.max(np.abs(data)))
    rms = float(np.sqrt(np.mean(np.square(data))))
    peak_db = 20 * math.log10(max(peak, 1e-9))
    rms_db = 20 * math.log10(max(rms, 1e-9))
    return round(peak_db, 2), round(rms_db, 2)


def encode(src: Path, dest: Path, seconds: float, clap_match: bool = False) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    fade = min(0.14, max(0.04, seconds * 0.08))
    start = max(0.0, seconds - fade)
    filters = [
        "aformat=channel_layouts=stereo",
        "aresample=44100",
        f"atrim=0:{seconds:.3f}",
        f"afade=t=out:st={start:.3f}:d={fade:.3f}",
    ]
    if clap_match:
        # Sit the dry VCSL clap with the roomy kit without changing its character.
        filters.insert(2, "highpass=f=160:poles=1")
        filters.insert(3, "equalizer=f=3200:t=q:w=0.7:g=1.2")
        # Match snare-body level; keep velocity spacing between layers.
        filters.insert(4, "volume=-5.5dB")
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(src),
        "-af",
        ",".join(filters),
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "44100",
        "-ac",
        "2",
        str(dest),
    ]
    subprocess.run(cmd, check=True)


def main() -> None:
    manifest = json.loads(MANIFEST.read_text())
    files = [row for row in manifest.get("files", []) if row.get("piece") not in PIECES and row.get("piece") != "clap"]
    extra_map: dict[str, dict[str, list[str]]] = {}

    for piece, spec in PIECES.items():
        rows = parse_samples(spec["xml"], spec["dir"])
        tiers = split_tiers(rows)
        print(f"{piece}: { {t: len(p) for t, p in tiers.items()} }")
        for tier, paths in tiers.items():
            extra_map.setdefault(piece, {})[str(tier)] = []
            for rr, src in enumerate(paths, start=1):
                dest = OUT / piece / f"t{tier}_rr{rr}.m4a"
                encode(src, dest, spec["seconds"])
                peak_db, rms_db = peak_rms(dest)
                rel = f"{piece}/t{tier}_rr{rr}.m4a"
                files.append(
                    {
                        "piece": piece,
                        "tier": tier,
                        "rr": rr,
                        "file": rel,
                        "peak_db": peak_db,
                        "rms_db": rms_db,
                    }
                )
                extra_map[piece][str(tier)].append(str(dest))
                print(f"  {rel}  peak {peak_db}  rms {rms_db}")

    extra_map["clap"] = {}
    for tier, src in CLAP_TIERS.items():
        dest = OUT / "clap" / f"t{tier}_rr1.m4a"
        encode(src, dest, 0.55, clap_match=True)
        peak_db, rms_db = peak_rms(dest)
        rel = f"clap/t{tier}_rr1.m4a"
        files.append(
            {
                "piece": "clap",
                "tier": tier,
                "rr": 1,
                "file": rel,
                "peak_db": peak_db,
                "rms_db": rms_db,
            }
        )
        extra_map["clap"][str(tier)] = [str(dest)]
        print(f"  {rel}  peak {peak_db}  rms {rms_db}")

    files.sort(key=lambda row: (row["piece"], row["tier"], row["rr"]))
    manifest["files"] = files
    manifest["extras"] = {
        "ride_bell": "CrocellKit RideRBell stereo mix",
        "china": "CrocellKit ChinaR stereo mix",
        "splash": "CrocellKit SplashL stereo mix",
        "stack": "CrocellKit CrashRStopped extra cymbal, used for Stack",
        "clap": "VCSL SoloClap velocity layers, tone-matched",
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    Path("/tmp/croc/extra_map.json").write_text(json.dumps(extra_map, indent=2))
    print(f"wrote {len(files)} manifest rows")


if __name__ == "__main__":
    main()
