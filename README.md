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

- **Home** — branding, the greeting *Hello — are you ready to rock?*, and two tools: Tuner and Rhythm
- **Tuner**
  - Tap **Change** for top-level chips: Chromatic, Guitar, Bass, Ukulele, Folk, My customs
  - Guitar opens a submenu by setup (6 / 7 / 8 / 9 / 10 / 12-string and Baritone). Bass opens 4–8 string. Folk holds Banjo, Mandolin, Violin / Fiddle, and Bouzouki
  - Tunings are grouped under **Standard**, **Drop**, **Double Drop**, **Open**, and **Alternate / Other**, with the note string under each name (for example `E A D G B E`)
  - Chromatic hides the string list and shows an A4 calibration slider
  - A large trail shows how far off you are, with a live cents bubble on the tip (for example −18). When a note sits in tune, the needle holds the center and the display turns green
  - Instrument presets show neon white line-art headstocks. Guitar, baritone, bass, ukulele, folk, and custom tunings share the approved batwing: nearly parallel through the pegs, then a short flare into the nut. Guitar-family, folk, and custom use hex pegs; bass uses clover tuners and thicker strings. The 12-string uses six paired courses (octave pairs on E A D G, unisons on B and high e). Banjo keeps four strings on the peghead; the fifth-string tuner sits on the bass side of the neck at the fifth fret, like a real 5-string. The string being tuned is red until it locks; in-tune pegs, posts, and strings turn green. Auto nearest-string, sticky locked pegs, a lock chime, a cents bubble on the trail, and tap-to-hear are included
  - Custom 4–10 string tunings save on this device only and use the same batwing as a guitar of that string count
- **Rhythm** — combined metronome and drum machine. First open starts on **Drums** at **120 BPM** with **4 bars of 4/4 Rock** at **8ths** (groove on bars 1–3, a short tom fill on bar 4). **Click** or **Drums** share BPM (30–300) and meter. Spin the **side wheel** for tempo — it clicks on each BPM step — or tap **±5** and **Tap tempo**. Set any meter with two wheels: beats **1–30** over a beat unit of **2 / 4 / 8 / 16 / 32**. Subdivide each beat into eighths, triplets, 16ths, quintuplets, sextuplets, septuplets, or 32nds — the grid and the click ticks follow. Click sounds: woodblock, clave, digital, rim, cowbell, soft tick. Drums play real acoustic one-shots (kick, snare, hats, high/mid/floor toms, ride, crash) from the Pearl Master Studio pack by enoe (CC BY 3.0), preloaded when you open Drums or tap Play. Add up to **8 bars**, each with its own meter and accents; playback loops the sequence. **Speed Builder** is visible but locked as Premium only. Last setup stays on this device. Old `/metronome` and `/drum-machine` links open Rhythm.
- A quiet note that more can unlock with a subscription later (there are **no payments** yet)

There is no account sign-in and nothing to pay. The tuner needs microphone permission. If the browser blocks the mic, allow it for this site and tap Start Tuning again.

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
