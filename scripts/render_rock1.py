#!/usr/bin/env python3
"""Offline-render default Rock 1 and report LUFS / peaks."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CROC = ROOT / "public" / "rhythm" / "drums" / "crocell"
LEGACY = ROOT / "public" / "rhythm" / "drums"
SR = 44100

SAMPLE_GAIN_BEFORE = {
    "kick": 1.0,
    "snare": 1.05,
    "rim": 1.0,
    "clap": 0.82,
    "highTom": 1.0,
    "midTom": 1.0,
    "lowTom": 1.0,
    "floorTom": 1.0,
    "closedHat": 2.0,
    "openHat": 1.6,
    "ride": 2.8,
    "rideBell": 0.9,
    "crash": 0.92,
    "stack": 0.8,
    "splash": 0.76,
    "china": 0.8,
}

SAMPLE_GAIN_AFTER = {
    "kick": 1.2,
    "snare": 1.28,
    "rim": 1.22,
    "clap": 1.32,
    "highTom": 1.22,
    "midTom": 1.2,
    "lowTom": 1.2,
    "floorTom": 1.18,
    "closedHat": 2.15,
    "openHat": 1.58,
    "ride": 3.25,
    "rideBell": 4.35,
    "crash": 0.88,
    "stack": 1.05,
    "splash": 2.45,
    "china": 1.92,
}

SAMPLE_GAIN = SAMPLE_GAIN_BEFORE

REVERB_SEND = {
    "kick": 0.05,
    "snare": 0.18,
    "rim": 0.17,
    "clap": 0.26,
    "highTom": 0.18,
    "midTom": 0.17,
    "lowTom": 0.16,
    "floorTom": 0.16,
    "closedHat": 0.07,
    "openHat": 0.09,
    "ride": 0.11,
    "rideBell": 0.1,
    "crash": 0.13,
    "stack": 0.12,
    "splash": 0.13,
    "china": 0.13,
}
REVERB_RETURN = 0.34
REVERB_DECAY = 0.74
REVERB_IR_SECONDS = 0.82
REVERB_HP_HZ = 240

CYMBALS = {
    "closedHat",
    "openHat",
    "ride",
    "rideBell",
    "crash",
    "stack",
    "splash",
    "china",
}

VOICE_PIECE = {
    "kick": "kick",
    "snare": "snare_snappy_p2",
    "rim": "sidestick",
    "clap": "clap",
    "highTom": "tom_high",
    "midTom": "tom_mid",
    "lowTom": "tom_mid",
    "floorTom": "tom_low",
    "closedHat": "hihat_closed",
    "openHat": "hihat_open",
    "ride": "ride",
    "rideBell": "ride_bell",
    "crash": "crash",
    "stack": "stack",
    "splash": "splash",
    "china": "china",
}

LEGACY_FILES = {
    "clap": LEGACY / "clap.wav",
    "rideBell": LEGACY / "ride-bell.wav",
    "stack": LEGACY / "stack.wav",
    "splash": LEGACY / "splash.wav",
    "china": LEGACY / "china.wav",
}

ROCK_EIGHTH_HATS = [0, 2, 4, 6, 8, 10, 12]
ROCK_GROOVE = {
    "kick": [0, 7, 8, 10],
    "snare": [4, 12],
    "closedHat": ROCK_EIGHTH_HATS,
    "openHat": [14],
    "crash": [0],
}
ROCK_MID = {
    "kick": [0, 7, 8, 10],
    "snare": [4, 12, 15],
    "closedHat": ROCK_EIGHTH_HATS,
    "openHat": [14],
}
ROCK_FILL = {
    "kick": [0, 7],
    "snare": [4],
    "closedHat": [0, 2, 4],
    "openHat": [6, 15],
    "highTom": [8, 9, 10],
    "midTom": [11, 12],
    "floorTom": [13, 14, 15],
}

BPM = 120
STEP = 60.0 / BPM / 4.0
BAR = 60.0 / BPM * 4.0
BARS = 8
TAIL = 2.4


def db_to_gain(db: float) -> float:
    return 10 ** (db / 20.0)


def load_audio(path: Path) -> np.ndarray:
    raw = subprocess.check_output(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(path),
            "-f",
            "f32le",
            "-ac",
            "2",
            "-ar",
            str(SR),
            "-",
        ]
    )
    data = np.frombuffer(raw, dtype=np.float32)
    if data.size == 0:
        return np.zeros((0, 2), dtype=np.float32)
    return data.reshape(-1, 2).copy()


def parse_manifest() -> dict[str, dict[int, list[Path]]]:
    data = json.loads((CROC / "manifest.json").read_text())
    bank: dict[str, dict[int, list[Path]]] = {}
    for row in data.get("files", []):
        piece = row["piece"]
        tier = int(row["tier"])
        path = CROC / row["file"]
        bank.setdefault(piece, {}).setdefault(tier, []).append(path)
    return bank


def nearest_tier(rows: dict[int, list[Path]], tier: int) -> list[Path]:
    if rows.get(tier):
        return rows[tier]
    for delta in (1, -1, 2, -2, 3, -3, 4, -4):
        nxt = tier + delta
        if rows.get(nxt):
            return rows[nxt]
    return []


def snare_role(step: int) -> str:
    beat = step // 4
    slot = step % 4
    if slot == 0 and beat % 2 == 1:
        return "backbeat"
    if slot != 0:
        return "ghost"
    return "normal"


def resolve_tier(intensity: int, role: str) -> int:
    if role == "ghost":
        return max(1, min(5, intensity - 2))
    return intensity


def bar_hits(index: int) -> dict[str, list[int]]:
    if index == 7:
        return dict(ROCK_FILL)
    if index % 4 == 1:
        return dict(ROCK_MID)
    body = {k: v[:] for k, v in ROCK_GROOVE.items() if k != "crash"}
    if index % 4 == 0:
        body["crash"] = ROCK_GROOVE["crash"][:]
    return body


def ffmpeg_chain(src: Path, dest: Path, filters: str) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src), "-af", filters, str(dest)],
        check=True,
    )


def write_wav(path: Path, audio: np.ndarray) -> None:
    clipped = np.clip(audio, -1.0, 1.0)
    pcm = (clipped * 32767.0).astype(np.int16)
    import wave

    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes(pcm.tobytes())


def measure(path: Path) -> dict[str, float]:
    proc = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-i",
            str(path),
            "-af",
            "ebur128=peak=true:framelog=verbose",
            "-f",
            "null",
            "-",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    text = proc.stderr
    integrated = None
    lra = None
    tp = None
    sample_peak = None
    for line in text.splitlines():
        if "I:" in line and "LUFS" in line and integrated is None:
            m = re.search(r"I:\s+(-?[\d.]+)\s+LUFS", line)
            if m:
                integrated = float(m.group(1))
        if "LRA:" in line and lra is None:
            m = re.search(r"LRA:\s+(-?[\d.]+)\s+LU", line)
            if m:
                lra = float(m.group(1))
        if "Peak:" in line and "dBFS" in line and tp is None:
            m = re.search(r"Peak:\s+(-?[\d.]+)\s+dBFS", line)
            if m:
                tp = float(m.group(1))
        if "True peak" in line.lower() or "TP:" in line:
            m = re.search(r"TP:\s+(-?[\d.]+)\s+dBTP", line)
            if m:
                tp = float(m.group(1))
    # Fallback sample peak from numpy if ffmpeg didn't print TP.
    return {
        "lufs": integrated if integrated is not None else float("nan"),
        "lra": lra if lra is not None else float("nan"),
        "true_peak": tp if tp is not None else float("nan"),
        "log_tail": "\n".join(text.splitlines()[-20:]),
    }


def load_cache(bank, extra_map: dict[str, dict[int, list[Path]]] | None) -> dict[str, dict[int, list[np.ndarray]]]:
    cache: dict[str, dict[int, list[np.ndarray]]] = {}
    pieces = set(VOICE_PIECE.values())
    if extra_map:
        for voice, rows in extra_map.items():
            for tier, paths in rows.items():
                piece = voice
                cache.setdefault(piece, {}).setdefault(tier, [])
                for path in paths:
                    cache[piece][tier].append(load_audio(path))
    for piece in pieces:
        for tier, paths in bank.get(piece, {}).items():
            cache.setdefault(piece, {}).setdefault(tier, [])
            for path in paths:
                cache[piece][tier].append(load_audio(path))
    for voice, path in LEGACY_FILES.items():
        piece = VOICE_PIECE.get(voice, voice)
        if extra_map and voice in extra_map:
            continue
        if cache.get(piece):
            continue
        if path.exists():
            buf = load_audio(path)
            cache.setdefault(piece, {})[4] = [buf]
    return cache


def pick_buffer(cache, piece: str, tier: int, rr: int) -> np.ndarray | None:
    rows = cache.get(piece)
    if not rows:
        return None
    available = rows.get(tier)
    if not available:
        for delta in (1, -1, 2, -2, 3, -3, 4, -4):
            available = rows.get(tier + delta)
            if available:
                break
    if not available:
        return None
    return available[rr % len(available)]


def render(
    intensity: int,
    sample_gain: dict[str, float],
    cymbal_offset_db: float,
    master_gain: float,
    makeup_db: float,
    use_glue: bool,
    use_limit: bool,
    extra_map: dict[str, dict[int, list[Path]]] | None,
    kick_eq: bool,
    phone_hp: float | None,
    use_reverb: bool = False,
) -> np.ndarray:
    bank = parse_manifest()
    cache = load_cache(bank, extra_map)
    total = int((BAR * BARS + TAIL) * SR)
    mix = np.zeros((total, 2), dtype=np.float64)
    send = np.zeros((total, 2), dtype=np.float64)
    rr = {}
    cymbal_gain = db_to_gain(cymbal_offset_db)

    for bar in range(BARS):
        hits = bar_hits(bar)
        for voice, steps in hits.items():
            for step in steps:
                role = snare_role(step) if voice == "snare" else "normal"
                tier = resolve_tier(intensity, role)
                piece = VOICE_PIECE.get(voice, voice)
                if voice == "snare" and intensity >= 4 and role == "backbeat":
                    piece = "rimshot_snappy_p2"
                key = f"{piece}:{tier}"
                idx = rr.get(key, 0)
                rr[key] = idx + 1
                buf = pick_buffer(cache, piece, tier, idx)
                if buf is None:
                    continue
                gain = sample_gain.get(voice, 1.0)
                if voice in CYMBALS:
                    gain *= cymbal_gain
                audio = buf.astype(np.float64) * gain
                if kick_eq and voice == "kick":
                    # Gentle low-mid + beater presence without rewriting the file.
                    audio = biquad_peak(audio, 220, 1.4, 0.7)
                    audio = biquad_highshelf(audio, 2800, 1.2)
                t0 = int((bar * BAR + step * STEP) * SR)
                end = min(total, t0 + audio.shape[0])
                mix[t0:end] += audio[: end - t0]
                if use_reverb:
                    send[t0:end] += audio[: end - t0] * REVERB_SEND.get(voice, 0.0)

    if use_reverb:
        wet = fft_convolve(biquad_highpass(send, REVERB_HP_HZ), bake_room_ir())
        wet = wet[:total] * REVERB_RETURN
        mix += wet

    mix *= master_gain * db_to_gain(makeup_db)
    return mix.astype(np.float32)


def bake_room_ir() -> np.ndarray:
    n = int(SR * REVERB_IR_SECONDS)
    ir = np.zeros((n, 2), dtype=np.float64)
    seed = 0xC0CE11
    def rand() -> float:
        nonlocal seed
        seed = (seed + 0x6D2B79F5) & 0xFFFFFFFF
        t = seed
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t ^= (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    tau = REVERB_DECAY / math.log(1000)
    early = (
        (0.0064, 0.62, -0.38),
        (0.0118, 0.48, 0.42),
        (0.0186, 0.36, -0.18),
        (0.0274, 0.26, 0.5),
        (0.0385, 0.18, -0.46),
        (0.051, 0.13, 0.22),
        (0.067, 0.09, -0.28),
    )
    for t, g, pan in early:
        i = min(n - 1, int(t * SR))
        ir[i, 0] += g * (0.5 - pan * 0.5)
        ir[i, 1] += g * (0.5 + pan * 0.5)
    lp = [0.0, 0.0]
    for i in range(n):
        t = i / SR
        decay = math.exp(-t / tau)
        bright = math.exp(-t * 5.2)
        coeff = 0.18 + 0.62 * (1 - bright)
        for ch in range(2):
            noise = rand() * 2 - 1
            lp[ch] += coeff * (noise - lp[ch])
            ir[i, ch] += lp[ch] * decay * 0.2
    peak = float(np.max(np.abs(ir)))
    if peak > 0:
        ir *= 0.92 / peak
    return ir


def fft_convolve(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    n = x.shape[0] + ir.shape[0] - 1
    nfft = 1 << (n - 1).bit_length()
    out = np.zeros((n, 2), dtype=np.float64)
    for ch in range(2):
        spectrum = np.fft.rfft(x[:, ch], nfft) * np.fft.rfft(ir[:, ch], nfft)
        out[:, ch] = np.fft.irfft(spectrum, nfft)[:n]
    return out


def biquad_highpass(x: np.ndarray, freq: float) -> np.ndarray:
    w0 = 2 * math.pi * freq / SR
    q = 0.707
    alpha = math.sin(w0) / (2 * q)
    cosw = math.cos(w0)
    b0 = (1 + cosw) / 2
    b1 = -(1 + cosw)
    b2 = (1 + cosw) / 2
    a0 = 1 + alpha
    a1 = -2 * cosw
    a2 = 1 - alpha
    return apply_biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)


def biquad_peak(x: np.ndarray, freq: float, gain: float, q: float) -> np.ndarray:
    a = gain
    w0 = 2 * math.pi * freq / SR
    alpha = math.sin(w0) / (2 * q)
    b0 = 1 + alpha * a
    b1 = -2 * math.cos(w0)
    b2 = 1 - alpha * a
    a0 = 1 + alpha / a
    a1 = -2 * math.cos(w0)
    a2 = 1 - alpha / a
    return apply_biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)


def biquad_highshelf(x: np.ndarray, freq: float, gain: float) -> np.ndarray:
    a = gain
    w0 = 2 * math.pi * freq / SR
    cosw = math.cos(w0)
    alpha = math.sin(w0) / 2 * math.sqrt(2)
    b0 = a * ((a + 1) + (a - 1) * cosw + 2 * math.sqrt(a) * alpha)
    b1 = -2 * a * ((a - 1) + (a + 1) * cosw)
    b2 = a * ((a + 1) + (a - 1) * cosw - 2 * math.sqrt(a) * alpha)
    a0 = (a + 1) - (a - 1) * cosw + 2 * math.sqrt(a) * alpha
    a1 = 2 * ((a - 1) - (a + 1) * cosw)
    a2 = (a + 1) - (a - 1) * cosw - 2 * math.sqrt(a) * alpha
    return apply_biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)


def apply_biquad(x: np.ndarray, b0, b1, b2, a1, a2) -> np.ndarray:
    y = np.zeros_like(x)
    for ch in range(x.shape[1]):
        x1 = x2 = y1 = y2 = 0.0
        col = x[:, ch]
        out = y[:, ch]
        for i, sample in enumerate(col):
            v = b0 * sample + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
            x2, x1 = x1, sample
            y2, y1 = y1, v
            out[i] = v
    return y


def parse_gains(raw: str | None) -> dict[str, float]:
    gains = dict(SAMPLE_GAIN)
    if not raw:
        return gains
    for part in raw.split(","):
        if "=" not in part:
            continue
        key, val = part.split("=", 1)
        gains[key.strip()] = float(val)
    return gains


def parse_extra(raw: str | None) -> dict[str, dict[int, list[Path]]] | None:
    if not raw:
        return None
    data = json.loads(Path(raw).read_text())
    out: dict[str, dict[int, list[Path]]] = {}
    for voice, rows in data.items():
        for tier_s, files in rows.items():
            out.setdefault(voice, {})[int(tier_s)] = [Path(f) for f in files]
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--intensity", type=int, default=4)
    parser.add_argument("--label", default="before")
    parser.add_argument("--master", type=float, default=0.9)
    parser.add_argument("--makeup-db", type=float, default=0.0)
    parser.add_argument("--cymbal-offset", type=float, default=-1.5)
    parser.add_argument("--gains")
    parser.add_argument("--after", action="store_true")
    parser.add_argument("--extra-map")
    parser.add_argument("--glue", action="store_true", default=True)
    parser.add_argument("--no-glue", action="store_true")
    parser.add_argument("--limit", action="store_true")
    parser.add_argument("--kick-eq", action="store_true")
    parser.add_argument("--phone-hp", type=float, default=0.0)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    extra = parse_extra(args.extra_map)
    if args.after:
        args.master = 1.0
        args.makeup_db = 19.5
        args.cymbal_offset = -1.0
        args.limit = True
        args.kick_eq = True
        if not args.gains:
            args.gains = ",".join(f"{k}={v}" for k, v in SAMPLE_GAIN_AFTER.items())
    mix = render(
        intensity=args.intensity,
        sample_gain=parse_gains(args.gains),
        cymbal_offset_db=args.cymbal_offset,
        master_gain=args.master,
        makeup_db=0.0,
        use_glue=False,
        use_limit=False,
        extra_map=extra,
        kick_eq=args.kick_eq,
        phone_hp=None,
        use_reverb=args.after,
    )
    out = args.out or Path(f"/tmp/rock1_{args.label}_i{args.intensity}.wav")
    dry = out.with_name(out.stem + "_dry.wav")
    write_wav(dry, mix)
    filters = []
    if not args.no_glue:
        thresh = -16
        ratio = 2.2 if args.after else 3.2
        release = 180 if args.after else 140
        filters.append(
            f"acompressor=threshold={thresh}dB:ratio={ratio}:attack=5:release={release}:knee=8:makeup=1"
        )
    if args.makeup_db:
        filters.append(f"volume={db_to_gain(args.makeup_db)}")
    if args.limit:
        filters.append("acompressor=threshold=-1.2dB:ratio=20:attack=2:release=55:knee=1:makeup=1")
        filters.append("alimiter=limit=0.8414:level=false")
    if args.phone_hp:
        filters.append(f"highpass=f={args.phone_hp}:poles=2")
    if filters:
        ffmpeg_chain(dry, out, ",".join(filters))
    else:
        write_wav(out, mix)
    stats = measure(out)
    peak = float(20 * math.log10(max(1e-9, np.max(np.abs(load_audio(out))))))
    result = {
        "label": args.label,
        "intensity": args.intensity,
        "lufs_i": stats["lufs"],
        "lra": stats["lra"],
        "true_peak": stats["true_peak"],
        "sample_peak_db": round(peak, 2),
        "wav": str(out),
    }
    print(json.dumps(result, indent=2))
    if math.isnan(stats["lufs"]):
        print(stats["log_tail"], file=sys.stderr)


if __name__ == "__main__":
    main()
