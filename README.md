# Omnician

**You're becoming an Omnician.**

Omnician is **the ultimate practice companion** — a simple home base for the tools you reach for before you play. This version includes a live **Tuner** (uses your microphone) and **Rhythm** (click + drums in one room).

You do **not** need to know how to program. Follow the steps below on your computer, then open the app in a web browser.

---

## What you need

1. A computer (Mac, Windows, or Linux)
2. **Node.js** — this is a free program that lets Omnician run on your machine
   - Download the **LTS** version from [https://nodejs.org](https://nodejs.org)
   - Run the installer and click through with the default options
3. A web browser you already have (Chrome, Safari, Edge, or Firefox)

After installing Node.js, **close and reopen** Terminal (Mac) or Command Prompt / PowerShell (Windows) so the computer notices it.

---

## How to run Omnician

### 1. Open a terminal

- **Mac:** open **Terminal** (search for it with Spotlight)
- **Windows:** open **Command Prompt** or **PowerShell**
- **Linux:** open **Terminal**

### 2. Go to this project folder

Type `cd` then a space, then the folder where this project lives, then press Enter.

Example if the folder is on your Desktop and named `omnician`:

```bash
cd Desktop/omnician
```

### 3. Install what the app needs

Copy this command, paste it into the terminal, and press Enter:

```bash
npm install
```

The first time, this can take a minute. You only need it again if files were updated.

### 4. Start the app

```bash
npm run dev
```

Leave this terminal window open. You should see a message with an address like:

```text
http://localhost:43121
```

### 5. Open it in your browser

Click that address if the terminal makes it a link, or type **http://localhost:43121** into your browser.

You should see the Omnician home screen: a greeting, then two big buttons — Tuner and Rhythm.

### 6. Stop the app when you are done

Click the terminal window and press **Control + C**.

---

## What you will see

- **Home** — the locked Omnician wordmark (circular O + *omni* in white + *cian* in purple), the greeting *Hello — are you ready to rock?*, and two tools: Tuner and Rhythm. A floating frosted **tab bar** sits at the bottom on phone and desktop: **Home, Tuner, Click, Drums**. Click opens `/rhythm?mode=click` and Drums opens `/rhythm?mode=drums`; the tab follows the current mode. The same pages keep a phone stack, a wider tablet column, and a desktop workspace (Rhythm puts tempo and meter beside the grid; Tuner sits the gauge next to the headstock). Switching to Home or Tuner stops click, drums, and the tuner mic. Switching Click ↔ Drums stays in the same room, so a running metronome keeps going.
- **Tuner**
  - Tap **Change** for top-level chips: Chromatic, Guitar, Bass, Ukulele, Folk, My customs
  - Guitar opens a submenu by setup (6 / 7 / 8 / 9 / 10 / 12-string and Baritone). Bass opens 4–8 string. Folk holds Banjo, Mandolin, Violin / Fiddle, and Bouzouki
  - Tunings are grouped under **Standard**, **Drop**, **Double Drop**, **Open**, and **Alternate / Other**, with the note string under each name (for example `E A D G B E`). Tap a tuning to apply it and close the sheet — there is no extra Select button. Cancel or tap the dimmed backdrop to dismiss. The sheet sits above the floating tab bar so the last rows stay visible.
  - Tap **A4 = 440 Hz** under the Tuner title to set the reference pitch (415–466 Hz, 1 Hz steps). Presets cover 415 Baroque, 432, concert 440, 442, 443, and 444. The choice stays on this device. Detection, cents, string targets, and tap-to-hear tones all follow it. The old lock ±1.0 ¢ line is gone from the header (green lock is still ±1.0 cent on the gauge).
  - Chromatic hides the string list and still shows an A4 slider as a second way to set the same reference
  - A strobe of purple chevrons scrolls with true cents (flat left, sharp right) and a 0.1¢ number that never snaps to zero. Green lock is ±1.0 cent and does not move the displayed value. A large note name includes the octave.
  - Instrument presets show neon white line-art headstocks. Guitar, baritone, bass, ukulele, folk, and custom tunings share the approved batwing: nearly parallel through the pegs, then a short flare into the nut. Guitar-family, folk, and custom use hex pegs; bass uses clover tuners and thicker strings. The 12-string uses six paired courses (octave pairs on E A D G, unisons on B and high e). Banjo keeps four strings on the peghead; the fifth-string tuner sits on the bass side of the neck at the fifth fret, like a real 5-string. The string being tuned is red until it locks; in-tune pegs, posts, and strings turn green. Auto nearest-string, sticky locked pegs, a lock chime, and tap-to-hear are included
  - Custom 4–10 string tunings save on this device only and use the same batwing as a guitar of that string count
  - The tuner starts listening as soon as you open it. Tapping Tuner on Home opens the mic during that tap so the page is already live on iPhone and Android. A direct link tries to start on its own; if the browser needs a gesture, tap anywhere on the page — there is no Start / Stop button. Leave the tuner and the mic stops; come back and it starts again.
  - Pitch is a rebuilt McLeod Pitch Method (NSDF) in an AudioWorklet, with a decimated bass path and YIN/harmonic checks so a weak fundamental is not read as its octave. The detector reads the **live** AudioContext sampleRate, listens to channel 0 or the loud channel of a stereo jack (it will not average a whole audio interface together), uses a 12 Hz–1.5 kHz filter with no AGC, and **throws away** unclear readings instead of guessing. It tracks down to E0 (~20.6 Hz) with a long overlapping window. A new pluck snaps; a held note follows the real pitch (no pull-to-zero); the last good note holds as the string dies away.
  - If you have more than one input (interface, USB mic, built-in), a small **Input** menu appears on the tuner page and remembers your choice.
  - Hidden debug overlay: add `?debug=1` to the tuner URL, or triple-tap the Omnician logo. It shows sample rate, channel count, device name, RMS, raw Hz, clarity, and the detected note/cents — useful if a reading still looks wrong.
- **Rhythm** — combined metronome and drum machine. **Play / Stop** stays in a bar at the bottom of the phone screen, sitting just above the tab bar, so you never have to scroll to start. On desktop, Play stays in the left column. **Stop** cuts drums and click immediately — already-queued hits do not keep ringing. First open on **Drums** is **120 BPM** with **8 bars of 4/4 Rock 1** (16th grid; classic 8th-note hats through the groove bars with an open-hat lift on the and of 4, Crash on beat 1 of bars 1 and 5, and the edited tom fill on bar 8). The 8 bars sit above the drum grid with a **Bar 3 of 8** readout. The grid stays full size and switches to the bar that is playing, or the one you tap. Tap a bar number to hear that bar. Tapping a grid cell plays that drum instantly (on the press, not after the click) at the current kit mix and intensity without restarting the loop. **Intensity** is per style (Rock 5, Funk 5, Metal 4, Pop 4, Hip-hop 5, House 3, Latin 4, Shuffle 4, Jazz 4, Waltz 3, Odd 4). It changes how that kit is played — velocity dynamics, ghost notes, hat openness, busier hats, cymbal choice, fills, and kit brightness — not overall volume. A loudness-match gain (estimated RMS energy of the realized bar vs a 4/4 reference, plus a small high-shelf compensate) keeps perceived loudness roughly the same across every level and style, and applies on the next hit while Play is running. Hold and drag across a lane to paint or erase a run of hits. The kit lanes, top to bottom, are **Kick, Snare, Rimshot, Tom 1, Tom 2, Fl Tom, HH Closed, HH Open, Ride, Ride Bell, Crash, Stack, Splash, China**. **Click** starts on **1 bar of 4/4** (quarters) and keeps its own bar count when you switch modes. Use the bottom tabs to switch Click and Drums immediately. Tap the big number in the **round tempo dial** to type a BPM (30–300). Spin it like a real wheel: clockwise raises BPM (drag the **right** side down, or the **left** side up). The grab zone extends a little past the dial on the left and right, so a touch or scroll just beside it still turns the wheel — it does not steal taps from Speed Builder, Tap, −5/+5, or Listen, and the page still scrolls outside that zone. Flick to coast; tap anywhere in the large area around the dial to catch it. **Tap** and **±5** sit underneath and jump straight to the new tempo — tap is always quarter-note BPM. **Listen** sits full-width under that row: it opens the mic (echo cancellation, noise suppression, and auto-gain off), stops playback, and finds the tempo after about 8–10 seconds — or sooner if the beat is clear. You can also **Choose file** (mp3, m4a, wav, and similar, decoded in the browser). The result is a whole-number BPM (with a tenth if it helps), ½× and 2× choices, a confidence hint, **Use this tempo**, and **Listen again**. Using a tempo is the same as turning the wheel (it applies on the next note). If Speed Builder is on, that BPM becomes the 100% target and practice still starts at the from-% tempo. Detection is an onset-strength envelope (multi-band spectral flux) plus a comb-filter tempogram with a prior around 120 BPM, range 40–240, and octave-error handling — independent Ellis / librosa-style code, no extra library. Set any meter with a compact **4 / 4** stepper: beats **1–30** over a beat unit of **2 / 4 / 8 / 16 / 32**. BPM is always the quarter note, so each beat lasts `(60 / BPM) × (4 / denominator)`: 4/8 at 120 is twice as fast as 4/4, /16 is four times, /2 is half. Subdivision stays relative to the beat (same number of clicks per beat); the note icons and labels follow the denominator (in /8 the beat is an eighth, 2-subdiv shows 16ths, 4-subdiv shows 32nds). Drums grid steps use the same beat length. On **Drums** it sets the grid for every bar and does not move existing hits. On **Click** that strip sets every beat; a small chip under each beat opens the same picker for that beat only (for example eighths on 1, triplets on 2, quarters on 3, sixteenths on 4). While **Play** is running, meter, subdivision, per-beat click subdivisions, bar count, and Click accents wait until the **next cycle** (end of the loop) so the current pass does not restart; the buttons update right away. Switching Click ↔ Drums applies immediately. Stopped changes apply immediately. Tempo, click sound, and drum hits can still change live. In **Click**, accents are one row across the beats. Tap to cycle **off → soft → strong**. Only the downbeat of that beat is accented; subdivision clicks inside the beat stay normal, with a slightly higher pitch. Fresh meters (and new bars) accent **beat 1 only**; every other beat starts unaccented. Accents are for **Click** only. Click sounds: **Wood** (default), **Clave**, **Digital**, **Mechanical**. Drums: the beat library is grouped by style (Rock, Funk, Metal, Pop, Hip-hop, House, Latin, Shuffle, Jazz, Waltz, Odd), each with about three grooves remade for the expanded kit and inspired by players such as Mike Portnoy, Steve Gadd, Dave Weckl, John Bonham, Stewart Copeland, Questlove, and Neil Peart (original practice grids, not transcriptions). Picking a groove replaces the whole 8-bar loop. Under the grid, four **vertical mixer faders** mix **Kick**, **Snare** (snare + rimshot + clap), **Cymbals** (hats, rides, crashes, stack, splash, china), and **Toms**. Caps rest about **75% up** the throw at the default mix (cymbals sit a little quieter than the others at that 0). A live number (**0.0**, **+3.6**, **−12.0**, **−48.0**) sits under each channel. On a phone, dragging a fader opens a magnified copy so the cap stays visible under your finger. On tablet and desktop the faders are wider and map 1:1 to the visible throw — no zoom overlay. The bottom of the throw is silence (−48.0); above 0 is about +6 dB of headroom. The kit is CrocellKit (CC BY 4.0) with a VCSL clap. A light medium-room send (about −40 dB / 1% wet) sits after a dry safety clipper so the tail is never ducked. Add up to **8 bars**. On **Click** and **Drums**, **Speed Builder** sits beside the tempo wheel (same panel, shared settings): set from/to/step percents, how many **Repeats** of the full pattern to hold at each tempo (1–32, default 1), optional precount and spoken percent, and Play walks the tempo in cycle-accurate steps. **Precount** (default on) is one shared switch: on **Drums** it counts in one bar of the current meter before the groove, even with Speed Builder off; with Speed Builder on, the same setting counts in once before each new tempo (never twice). The count uses the distinct precount click and the same beat length as the meter (`(60 / BPM) × (4 / denominator)`), then bar 1 beat 1 starts with no gap. Click only uses precount when Speed Builder is on. The goal tempo keeps looping. A large percent / BPM flash appears at each tempo change. **Announce** is the same style of slide switch, stacked directly above Precount, and plays bundled neural voice clips (Kokoro af_heart) through the same audio engine as the click — not the phone’s robotic system voice. Last setup stays on this device. Old `/metronome` and `/drum-machine` links open Rhythm.
- A quiet note that more can unlock with a subscription later (there are **no payments** yet)

There is no account sign-in and nothing to pay. The tuner needs microphone permission. If the browser blocks the mic, allow it for this site in Settings, then tap the tuner page to try again.

---

## If something goes wrong

**The terminal says `npm` is not recognized, or `command not found: npm`**  
Node.js is missing, or the terminal was left open during install. Install Node.js from [nodejs.org](https://nodejs.org), then close the terminal completely and try again.

**The page will not load**  
Make sure `npm run dev` is still running, then visit http://localhost:43121

**It says the port is already in use**  
Omnician is probably already running in another terminal. Use that one, or stop it with Control + C and start it again.

**You changed files and the page looks old**  
Save the files, then refresh the browser.

---

## For later (optional)

Once the app is running, you can also build a production copy:

```bash
npm run build
npm run preview
```

That is not required to try Omnician today.

---

## Sample credits

**Click** voices are CC0 / public domain. Copies live in `public/rhythm/clicks/` with a LICENSE file. Wood uses Druminfected’s metronome tick; its original accent was clipped, so the strong hit is a Versilian VCSL woodblock. Clave is VCSL. Digital is NenadSimic’s menu click, low-passed. Mechanical is Sadiquecat’s metronome click 2.

**Speed Builder Announce** — spoken percents are Kokoro-82M **af_heart** (Apache 2.0). Clips live in `public/rhythm/announce/af_heart/` with `LICENSE.txt`.

**Drums** — CrocellKit by DrumGizmo.org (Lars Muldjord / Crocell / JBOSound), stereo mix by Henry Järvinen, CC BY 4.0; samples edited. Ride bell, china, splash and stack come from that same stereo mix (RideRBell, ChinaR, SplashL, CrashRStopped). A light generated drum-room send (about 1% wet) sits the kit in one space; the click stays dry. See `public/rhythm/drums/LICENSE.txt`.
