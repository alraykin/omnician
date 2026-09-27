#!/usr/bin/env bash
# Download public University of Iowa MIS guitar notes (unrestricted research use)
# and split them into single-note WAVs for the accuracy suite.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/fixtures/guitar-notes"
WORK="$OUT/.download"
mkdir -p "$WORK" "$OUT"

# Iowa MIS post-2012 guitar files are linked from
# https://theremin.music.uiowa.edu/MISguitar.html
BASES=(
  "https://theremin.music.uiowa.edu/sound%20files/MIS/Piano_Other/guitar"
  "https://theremin.music.uiowa.edu/sound files/MIS/Piano_Other/guitar"
)

FILES=(
  "Guitar.ff.sulE.E2B2.mono.aif"
  "Guitar.ff.sulA.A2B2.mono.aif"
  "Guitar.ff.sulD.D3B3.mono.aif"
  "Guitar.ff.sulG.G3B3.mono.aif"
  "Guitar.ff.sulB.B3.mono.aif"
  "Guitar.ff.sul_E.E4B4.mono.aif"
)

download() {
  local name="$1"
  local dest="$WORK/$name"
  if [[ -f "$dest" && -s "$dest" ]]; then
    echo "have $name"
    return 0
  fi
  for base in "${BASES[@]}"; do
    echo "try $base/$name"
    if curl -fsSL --retry 2 -o "$dest" "$base/$name"; then
      echo "got $name"
      return 0
    fi
    rm -f "$dest"
  done
  return 1
}

have_any=0
for f in "${FILES[@]}"; do
  if download "$f"; then
    have_any=1
  else
    echo "miss $f"
  fi
done

if [[ "$have_any" -eq 0 ]]; then
  echo "Could not download Iowa MIS guitar files."
  exit 1
fi

python3 - <<'PY'
import os, struct, wave, pathlib
work = pathlib.Path(os.environ.get("WORK") or "")
# fallback
work = pathlib.Path(__file__).resolve().parent / "fixtures" / "guitar-notes" / ".download" if False else pathlib.Path("/workspace/scripts/fixtures/guitar-notes/.download")
out = work.parent

def read_aiff(path):
    data = path.read_bytes()
    if data[0:4] != b"FORM" or data[8:12] not in (b"AIFF", b"AIFC"):
        raise SystemExit(f"not aiff: {path}")
    channels = rate = bits = None
    frames = None
    offset = 12
    comm = None
    ssnd = None
    while offset + 8 <= len(data):
        cid = data[offset:offset+4]
        size = struct.unpack(">I", data[offset+4:offset+8])[0]
        chunk = data[offset+8:offset+8+size]
        if cid == b"COMM":
            comm = chunk
        elif cid == b"SSND":
            ssnd = chunk
        offset += 8 + size + (size & 1)
    if comm is None or ssnd is None:
        raise SystemExit(f"bad aiff {path}")
    channels, nframes, bits = struct.unpack(">hIh", comm[:8])
    # 80-bit float sample rate
    exp = struct.unpack(">H", comm[8:10])[0]
    mantissa = struct.unpack(">Q", comm[10:18])[0]
    sign = 1
    if exp & 0x8000:
        sign = -1
        exp &= 0x7FFF
    if exp == 0:
        rate = 0
    else:
        rate = sign * mantissa * 2.0 ** (exp - 16383 - 63)
    rate = int(round(rate))
    audio = ssnd[8:]
    return channels, rate, bits, audio

def to_mono(channels, bits, audio):
    width = bits // 8
    count = len(audio) // (width * channels)
    samples = []
    for i in range(count):
        acc = 0
        for c in range(channels):
            p = (i * channels + c) * width
            if bits == 16:
                acc += struct.unpack(">h", audio[p:p+2])[0]
            elif bits == 24:
                b = audio[p:p+3]
                v = (b[0] << 16) | (b[1] << 8) | b[2]
                if v & 0x800000:
                    v -= 0x1000000
                acc += v
            else:
                raise SystemExit(f"bits {bits}")
        samples.append(acc / channels / (32768 if bits == 16 else 8388608))
    return samples

def split_notes(samples, rate, names):
    # energy windows; Iowa files are sequential notes with silence
    win = max(1, int(rate * 0.02))
    energy = []
    for i in range(0, len(samples) - win, win):
        chunk = samples[i:i+win]
        energy.append(sum(x*x for x in chunk) / win)
    thresh = max(energy) * 0.04
    regions = []
    on = None
    for i, e in enumerate(energy):
        if e >= thresh and on is None:
            on = i
        elif e < thresh and on is not None:
            if i - on > 8:
                regions.append((on * win, i * win))
            on = None
    if on is not None:
        regions.append((on * win, len(samples)))
    regions = [r for r in regions if (r[1]-r[0]) / rate > 0.25]
    return regions

wanted = {
    "Guitar.ff.sulE.E2B2.mono.aif": ["E2"],
    "Guitar.ff.sulA.A2B2.mono.aif": ["A2"],
    "Guitar.ff.sulD.D3B3.mono.aif": ["D3"],
    "Guitar.ff.sulG.G3B3.mono.aif": ["G3"],
    "Guitar.ff.sulB.B3.mono.aif": ["B3"],
    "Guitar.ff.sul_E.E4B4.mono.aif": ["E4"],
}

for name, notes in wanted.items():
    path = work / name
    if not path.exists():
        continue
    channels, rate, bits, audio = read_aiff(path)
    samples = to_mono(channels, bits, audio)
    regions = split_notes(samples, rate, notes)
    print(name, "rate", rate, "regions", len(regions), "want", notes)
    for idx, note in enumerate(notes):
        if idx >= len(regions):
            print(" missing region for", note)
            continue
        a, b = regions[idx]
        clip = samples[a:b]
        dest = out / f"{note}.wav"
        with wave.open(str(dest), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(rate)
            frames = b"".join(struct.pack("<h", max(-32767, min(32767, int(x * 32767)))) for x in clip)
            wav.writeframes(frames)
        print(" wrote", dest, "sec", len(clip)/rate)
PY
echo "fixtures in $OUT"
ls -lh "$OUT"
