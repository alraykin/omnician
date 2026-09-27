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

- **Home** — the locked Omnician wordmark (circular O + *omni* in white + *cian* in purple), the greeting *Hello — are you ready to rock?*, and two tools: Tuner and Rhythm. The same pages keep a phone stack, a wider tablet column, and a desktop workspace (Rhythm puts tempo and meter beside the grid; Tuner sits the gauge next to the headstock).
- **Tuner**
  - Tap **Change** for top-level chips: Chromatic, Guitar, Bass, Ukulele, Folk, My customs
  - Guitar opens a submenu by setup (6 / 7 / 8 / 9 / 10 / 12-string and Baritone). Bass opens 4–8 string. Folk holds Banjo, Mandolin, Violin / Fiddle, and Bouzouki
  - Tunings are grouped under **Standard**, **Drop**, **Double Drop**, **Open**, and **Alternate / Other**, with the note string under each name (for example `E A D G B E`)
  - Chromatic hides the string list and shows an A4 calibration slider
  - A large trail shows how far off you are, with a live cents bubble on the tip (for example −18). When a note sits in tune, the needle holds the center and the display turns green
  - Instrument presets show neon white line-art headstocks. Guitar, baritone, bass, ukulele, folk, and custom tunings share the approved batwing: nearly parallel through the pegs, then a short flare into the nut. Guitar-family, folk, and custom use hex pegs; bass uses clover tuners and thicker strings. The 12-string uses six paired courses (octave pairs on E A D G, unisons on B and high e). Banjo keeps four strings on the peghead; the fifth-string tuner sits on the bass side of the neck at the fifth fret, like a real 5-string. The string being tuned is red until it locks; in-tune pegs, posts, and strings turn green. Auto nearest-string, sticky locked pegs, a lock chime, a cents bubble on the trail, and tap-to-hear are included
  - Custom 4–10 string tunings save on this device only and use the same batwing as a guitar of that string count
  - The tuner starts listening as soon as you open it. Tapping Tuner on Home opens the mic during that tap so the page is already live on iPhone and Android. A direct link tries to start on its own; if the browser needs a gesture, tap anywhere on the page — there is no Start / Stop button. Leave the tuner and the mic stops; come back and it starts again.
  - Pitch runs on an AudioWorklet (YIN / McLeod) with raw mic capture — no OS echo cancel, noise suppress, or AGC. A pluck locks in tens of milliseconds; a sustained note stays within about half a cent. Auto still uses hysteresis so it does not flap between nearby strings.
- **Rhythm** — combined metronome and drum machine. **Play / Stop** stays in a bar at the bottom of the screen so you never have to scroll to start. **Stop** cuts drums and click immediately — already-queued hits do not keep ringing. First open on **Drums** is **120 BPM** with **8 bars of 4/4 Rock 1** (16th grid; classic 8th-note hats through the groove bars with an open-hat lift on the and of 4, Crash on beat 1 of bars 1 and 5, and the edited tom fill on bar 8). The 8 bars sit above the drum grid with a **Bar 3 of 8** readout. The grid stays full size and switches to the bar that is playing, or the one you tap. Tap a bar number to hear that bar. Tapping a grid cell plays that drum instantly (on the press, not after the click) at the current kit mix and intensity without restarting the loop. A 5-step **Intensity** control (default 4) picks recorded hit tiers — not just volume — and applies to the next hit while Play is running. Hold and drag across a lane to paint or erase a run of hits. The kit lanes, top to bottom, are **Kick, Snare, Rimshot, Clap, Tom 1, Tom 2, Tom 3, Fl Tom, HH Closed, HH Open, Ride, Ride Bell, Crash, Stack, Splash, China**. **Click** starts on **1 bar of 4/4** (quarters) and keeps its own bar count when you switch modes. Tap **Click** or **Drums** at the top to switch immediately. Tap the big number in the **round tempo dial** to type a BPM (30–300). Spin it like a real wheel: clockwise raises BPM (drag the **right** side down, or the **left** side up). Flick to coast; tap anywhere in the large area around the dial to catch it. **Tap** and **±5** sit underneath and jump straight to the new tempo. Set any meter with a compact **4 / 4** stepper: beats **1–30** over a beat unit of **2 / 4 / 8 / 16 / 32**. Subdivision is a strip of **note icons** (quarter, eighths, triplets, 16ths, then 5 / 6 / 7 as number brackets). On **Drums** it sets the grid for every bar and does not move existing hits. On **Click** that strip sets every beat; a small chip under each beat opens the same picker for that beat only (for example eighths on 1, triplets on 2, quarters on 3, sixteenths on 4). While **Play** is running, meter, subdivision, per-beat click subdivisions, bar count, and Click accents wait until the **next cycle** (end of the loop) so the current pass does not restart; the buttons update right away. Switching Click ↔ Drums applies immediately. Stopped changes apply immediately. Tempo, click sound, and drum hits can still change live. In **Click**, accents are one row across the beats. Tap to cycle **off → soft → strong**. Only the downbeat of that beat is accented; subdivision clicks inside the beat stay normal, with a slightly higher pitch. Fresh meters (and new bars) accent **beat 1 only**; every other beat starts unaccented. Accents are for **Click** only. Click sounds: **Wood** (default), **Clave**, **Digital**, **Mechanical**. Drums: the beat library is grouped by style (Rock, Funk, Metal, Pop, Hip-hop, House, Latin, Shuffle, Waltz, Odd), each with about three grooves remade for the expanded kit and inspired by players such as Mike Portnoy, Steve Gadd, Dave Weckl, John Bonham, Stewart Copeland, Questlove, and Neil Peart (original practice grids, not transcriptions). Picking a groove replaces the whole 8-bar loop. Under the grid, four **vertical mixer faders** mix **Kick**, **Snare** (snare + rimshot + clap), **Cymbals** (hats, rides, crashes, stack, splash, china), and **Toms**. Caps rest about **75% up** the throw at the default mix (cymbals sit a little quieter than the others at that 0). A live number (**0.0**, **+3.6**, **−12.0**, **−48.0**) sits under each channel. On a phone, dragging a fader opens a magnified copy so the cap stays visible under your finger. On tablet and desktop the faders are wider and map 1:1 to the visible throw — no zoom overlay. The bottom of the throw is silence (−48.0); above 0 is about +6 dB of headroom. The kit is CrocellKit (CC BY 4.0) with a VCSL clap. A light medium-room send (about −40 dB / 1% wet) sits after a dry safety clipper so the tail is never ducked. Add up to **8 bars**. On **Click**, **Speed Builder** sits beside the tempo wheel: set from/to/step percents, how many **Repeats** of the Click pattern to hold at each tempo (1–32, default 1), optional precount and spoken percent, and Play walks the tempo in cycle-accurate steps. Precount (if on) plays once before each new tempo, not before every repeat. The goal tempo keeps looping. Last setup stays on this device. Old `/metronome` and `/drum-machine` links open Rhythm.
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

**Drums** — CrocellKit by DrumGizmo.org (Lars Muldjord / Crocell / JBOSound), stereo mix by Henry Järvinen, CC BY 4.0; samples edited. Ride bell, china, splash and stack come from that same stereo mix (RideRBell, ChinaR, SplashL, CrashRStopped). Clap is CC0 from the Versilian Community Sample Library (SoloClap velocity layers, level-matched). A light generated drum-room send (about 1% wet) sits the kit in one space; the click stays dry. See `public/rhythm/drums/LICENSE.txt`.
