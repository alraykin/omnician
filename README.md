# Omnician

**You're becoming an Omnician.**

Omnician is **the ultimate practice companion** — a simple home base for the tools you reach for before you play. This version includes a live **Tuner** (uses your microphone) plus upcoming rooms for **Metronome** and **Drum Machine**.

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

You should see the Omnician home screen: a greeting, then three big buttons.

### 6. Stop the app when you are done

Click the terminal window and press **Control + C**.

---

## What you will see

- **Home** — branding, the greeting *Hello — are you ready to rock?*, and three tools
- **Tuner**
  - Tap **Change** for top-level chips: Chromatic, Guitar, Bass, Ukulele, Folk, My customs
  - Guitar opens a submenu by setup (6 / 7 / 8 / 9 / 10 / 12-string and Baritone). Bass opens 4–8 string. Folk holds Banjo, Mandolin, Violin / Fiddle, and Bouzouki
  - Tunings are grouped under **Standard**, **Drop**, **Double Drop**, **Open**, and **Alternate / Other**, with the note string under each name (for example `E A D G B E`)
  - Chromatic hides the string list and shows an A4 calibration slider
  - A large trail shows how far off you are, with a live cents bubble on the tip (for example −18). When a note sits in tune, the needle holds the center and the display turns green
  - Instrument presets show neon white line-art headstocks in Alex’s style: guitar and ukulele share hex pegs on a batwing; bass uses clover tuners with wound strings; banjo adds the fifth peg on the neck. String spacing is even. The active peg, post, and string turn red until in tune, then green. Auto nearest-string, sticky locked pegs, a lock chime, a cents bubble on the trail, and tap-to-hear are included
  - Custom 4–10 string tunings save on this device only
- **Metronome / Drum Machine** — placeholder pages that say **Coming in V1**
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
