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

You should see the Omnician home screen: the wordmark, then three big buttons — Tuner, Click, and Drums.

### 6. Stop the app when you are done

Click the terminal window and press **Control + C**.

---

## What you will see

- **Home** — a large Omnician wordmark (the real `/brand/omnician-wordmark.png`, about three-quarters of a phone’s width), *The ultimate practice companion* tucked 10px under it, and three large buttons: **Tuner**, **Click**, and **Drums**. That group sits in the middle of the screen. Home does not show the header tool switcher or a Settings gear. Inside Tuner, Click, and Drums, a compact segmented **Home / Tuner / Click / Drums** switcher stays in the top header, with the active mode highlighted. A small gear in the top-right (44px tap target) opens **Settings**. The small header wordmark is a Home link (`aria-label="Home"`) and uses the same leave path as the Home tab. Click opens `/rhythm?mode=click` and Drums opens `/rhythm?mode=drums`; the tab follows the current mode. The same pages keep a phone stack, a wider tablet column, and a desktop workspace (Rhythm puts tempo and meter beside the grid; Tuner stacks the headstock above the needle). Switching to Home or Tuner stops click, drums, and the tuner mic. Switching Click ↔ Drums stays in the same room, so a running metronome keeps going.
- **Settings** — full-screen page at `/settings` (categories at `/settings/:category`). Back returns to the tool you came from. Tuner: Auto strings, Split/Inline default, microphone input. Click: Wood / Clave / Digital / Mechanical. Drums: MIDI import mapping. Speed Builder: Announce and Precount. Sound & Audio explains that Volume, kit mix, and Intensity stay on the tool pages. About & Legal links to `/privacy`, `/terms`, `/credits`, and `/support` (placeholder text for now), plus the app version and © 2026 Raykin Music LLC. Preference behavior is unchanged — only the location of the controls moved.
- **Tuner**
  - Tap **Change** for a two-step sheet. Step 1 is category chips (Chromatic, Guitar, Bass, Ukulele, Folk, My customs) plus Guitar/Bass string-count rows only — no tuning list and no search. **‹ Back** at the top-left closes the sheet without changing the current tuning (same as **Cancel** or the dimmed backdrop).
  - Tap a string count (for example **6-string**) to replace the sheet with that instrument’s tunings. Step 2 is titled like **Guitar · 6-string**, with **‹ Back** returning to step 1. Tunings are grouped under **Standard**, **Drop**, **Double Drop**, **Open**, and **Alternate / Other**, with the note string under each name (for example `E A D G B E`). Tap a tuning to apply it and close the sheet — there is no extra Select button.
  - Chromatic applies and closes immediately. Ukulele, Folk, and My customs skip the string-count grid and open their list (Folk is grouped by Banjo, Mandolin, Violin / Fiddle, and Bouzouki). The sheet sits above the home indicator so the last rows stay visible.
  - The compact **A4 440 Hz ⌄** pill sits centered under the Tuner title, no wider than that word. Tap it to set the reference pitch (415–466 Hz, 1 Hz steps). Presets cover 415 Baroque, 432, concert 440, 442, 443, and 444. The choice stays on this device. Detection, cents, string targets, and tap-to-hear tones all follow it. The old lock ±1.0 ¢ line is gone from the header (green lock is still ±1.0 cent on the gauge).
  - Chromatic hides the string list. Tap Chromatic in the picker to apply it and close the sheet, same as any other tuning. Reference pitch is only the A4 control under the Tuner title.
  - The tuner shows a compact −50 to +50 ¢ scale with a large moving ball and a circle at 0; when the ball sits in the circle it fills most of that target. Motion and cents stay live — no snapping. Within ±1.0 cent the ball and circle turn green. The detected note stays large above the scale. Green lock is ±1.0 cent and does not move the displayed value.
  - The **Split** / **Inline** headstock sits directly under the instrument card, in a fixed box so toggling those views does not shift the page. Split is the approved symmetric rounded paddle (1200×1400): concave flare out of the nut, sides that widen toward a soft arched top, 3+3 posts with horizontal shafts and rectangular buttons, a gentle string fan to the inner side of each post, a faint truss cover, and the real `/brand/omnician-wordmark.png` in the middle (nut toward tip, 80% opacity). Other string counts keep that outline and only change spacing; 12-string uses six pegs per side on the same paddle. **Inline** uses the approved v4 SVG on the same viewBox: the exact outline path (concave left flare, long tuner edge, rounded dome, nearly vertical treble edge, swoop back to the nut), the specified nut and parallel string slots, posts and rounded-rectangle buttons on that diagonal, a faint truss cover, and the wordmark along the treble side. 4-string bass draws four strings with larger posts. 12-string presets hide the pill and always show Split; switching away restores the saved Inline choice. Both views drop the fret lines and fade the neck and strings out just below the nut. The needle display sits below the headstock.
  - The string being tuned is red until it has been held in tune for about 1.5 seconds. After that the peg stays green for the rest of the session — it will not turn red again even if later notes on that string read off-pitch. Tap the peg to retune it, or change the tuning to clear every lock. Auto nearest-string, a lock chime, and tap-to-hear are included. When every string in the current tuning is green, Omnician plays one warm success sound and a one-shot glow over the headstock.
  - Custom 4–10 string tunings save on this device only and use the same Split paddle / Inline outline as a guitar of that string count
  - The tuner starts listening as soon as you open it. One tap on the Home card or the Tuner tab goes to the tuner immediately and starts the mic after that navigation (the permission prompt never holds the page on Home). A direct link tries to start on its own; if the browser needs a gesture, tap anywhere on the page — there is no Start / Stop button. Leave the tuner and the mic stops; come back and it starts again.
  - Pitch is a rebuilt McLeod Pitch Method (NSDF) in an AudioWorklet, with a decimated bass path and YIN/harmonic checks so a weak fundamental is not read as its octave. The detector reads the **live** AudioContext sampleRate, listens to channel 0 or the loud channel of a stereo jack (it will not average a whole audio interface together), uses a 12 Hz–1.5 kHz filter with no AGC, and **throws away** unclear readings instead of guessing. It tracks down to E0 (~20.6 Hz) with a long overlapping window. A new pluck snaps; a held note follows the real pitch (no pull-to-zero); the last good note holds as the string dies away.
  - If you have more than one input (interface, USB mic, built-in), **Settings → Tuner** has an **Input** menu and remembers your choice. Auto strings and the Split / Inline headstock default live there too. **A4** stays on the Tuner page — it is a primary control, not a buried setting.
  - Hidden tuner overlay: add `?debug=1` to the tuner URL, or triple-tap the Omnician logo. It shows sample rate, channel count, device name, RMS, raw Hz, clarity, and the detected note/cents — useful if a reading still looks wrong.
  - Hidden iOS audio overlay: add `?debug=audio` to any page (for Alex: [https://omnician.app/rhythm?mode=click&debug=audio](https://omnician.app/rhythm?mode=click&debug=audio)). It shows playback/capture state, sample rates, whether `currentTime` is advancing, `audioSession.type`, live mic tracks, **need recover**, last recovery, **last error**, **last stop**, and a short **stop stack**. Screenshot that after Tuner or Listen if Click/Drums go silent. Listen errors also print that raw error under the usual message when the overlay is on.
  - Hidden iPhone strategy lab (does not change Click / Tuner / Listen): [https://omnician.app/audio-lab](https://omnician.app/audio-lab). Each letter starts the mic for ~3 seconds, then **Play test click** and mark Heard / Silent. **P** is after the mic: preview clicks, then a lookahead scheduler (Drums with Precount off). It logs `context.state` every 100ms for 2 seconds, and every `stop` plus `interrupted` / `suspended` with a stack trace.
- **Rhythm** — combined metronome and drum machine. Click, Drums, and tap-to-hear tones use **one playback AudioContext**, created lazily on the first Play tap, with `resume()` called in that tap before anything is awaited. Omnician does **not** write `navigator.audioSession.type` at all (not `playback` on the first tap — that was B6KcZYEI — and not `auto` or `playback` after the mic or after the first clicks: those session changes fade Web Audio after one or two precount clicks). The iPhone silent switch still mutes Web Audio; that is accepted. Tuner and Listen stop Click/Drums if they are running, then open the mic on a separate **capture** context; iOS is left to pick the session for `getUserMedia`. Listen marks the same **mic was used** flag as Tuner even when getUserMedia was already started in the tap. Every `getUserMedia` stream is adopted as soon as it is granted. Listen records through an analyser tap (not ScriptProcessor). When Listen finishes, you cancel/close it, or you leave Tuner, Omnician stops every mic track, disconnects the capture graph, drops the stream refs, and closes the capture context even if playback is still `running` — the iPhone orange mic dot should go off within a second or two. Hiding the tab or `pagehide` does the same. After the mic has been used — Tuner **or** Listen — the **next Play tap** also tears down leftover Listen/Tuner graphs and stops tracks (it still does **not** close capture in that same tap) and `resume()`s the **same** playback context inside that tap. Playback is never closed after the mic (a replacement context was being born interrupted). Play does not call `speechSynthesis` (that delayed system-voice start also fades Web Audio during precount). Announce is only the bundled Kokoro clips through the same Web Audio graph — if a clip is not ready, that announce is skipped rather than falling back to the phone voice. Listen preview schedules its clicks in one tap; Play uses a lookahead scheduler that rebases a stale `nextNoteTime`, keeps going if `currentTime` freezes (wall-clock `start(0)`), and ignores a late preview `stopAll`. Decoded drum/click buffers stay cached so that rebuild does not refetch. There is no silent HTML audio. If iOS marks playback `interrupted` or `suspended` after the mic, Omnician `resume()`s that same context and does **not** treat it as Stop (that was the ~0.5s Play-button halt). Overlay **last stop** shows the last real transport stop and a short stack. If `resume()` resolves and the context is still `suspended`, that is stored as **last error** on the debug overlay. **Play / Stop** stays in a bar at the bottom of the phone screen, so you never have to scroll to start. The Drums **Record** button and Record sheet are hidden for now (`RECORDER_ENABLED` in `src/lib/features.ts`); Play is full width. The recorder code is still in the repo. **+ New** (to the right of Beat library) starts a blank beat at **120 BPM**, **4 bars of 4/4**, 16th-note subdivision, empty grid, and count-off on. **Import** (beside New) opens a `.mid` / `.midi` file on this device — iPhone Files or a computer folder — and reads it in the browser. Tempo comes from the first tempo event (120 if none); the time signature is used when present. Notes from every track and channel use Alex’s Cubase map (middle C = **C3** = MIDI 60). MIDI note mapping lives in **Settings → Drums**. Hits snap with Smart quantize (16ths, triplets when they fit). At most the first **8 bars** load. Unmapped notes are skipped with a count. The file name becomes the default beat name for **My beats**. **Save** appears when that beat is new or edited, asks for a name, and stores it in **My beats** on this device (`localStorage`). The Beat library lists My beats at the top — load, rename, or delete (with confirm). Saving again updates that beat; **Save as new** makes another copy. Presets stay unchanged unless you save them as one of your beats. First time, a *New · Record your own beat* tip sits above it — tap to dismiss; Omnician remembers that on this device. Record opens a pad sheet over the dimmed Drums page (a centered window on desktop). The sheet fills the phone screen: header, a compact tempo row (tap the number to type 30–300, Tap tempo, ±1 arrows), transport, Overdub/Click/Count-in, Quantize, shrinking lanes, then a 5×3 pad grid (equal pads, one spare slot) that never overlaps the controls. The red Record button first asks **New beat** (empty 4 bars at the sheet tempo) or **This beat** (keep the current grid). Pad hits write immediately so kick and snare in the same instant both stick, and a tap just before the bar line lands on beat 1. Recording plays every bar in order (hits land in whichever bar is playing), then loops back to bar 1 with a count-off before each cycle; the mini grid shows **Bar X of N**. A **Click** toggle (default on, remembered on this device) plays the current Click-page sound on every beat while you record — beat 1 accented — so a blank New beat still has something to play to. Those clicks are not written into the saved grid. Hit pads or keys to play the current kit mix and intensity into the selected bar: 1-bar count-in shows a small Count-in N in the transport with pulsing beat dots (pads stay fully visible and playable, default on), looping overdub or replace, undo last pass, clear (with confirm), and quantize chips (Smart default, 1/8, 1/16, 1/8T, 1/16T, Off). Smart snaps to the bar’s subdivision and offers triplets when that grid is clearly closer. Done writes the hits into the same grid as drawing by hand, so the beat becomes a custom/edited groove. Desktop **Keys on** shows key caps (Space kick, F/J snare, and the rest of the kit on the home row / cymbal keys). On desktop, and on an iPhone or iPad turned sideways, Play stays in the left column (two columns: controls on the left, grid on the right). The page may scroll; the drum grid is not a nested scroll box. Portrait phones keep Play at the bottom of the screen. Mode switching is the top header on every layout — not a floating bottom bar. **Stop** cuts drums and click immediately — already-queued hits do not keep ringing. First open on **Drums** is **120 BPM** with **8 bars of 4/4 Rock 1** (16th grid; classic 8th-note hats through the groove bars with an open-hat lift on the and of 4, Crash on beat 1 of bars 1 and 5, and the edited tom fill on bar 8). The 8 bars sit above the drum grid with a **Bar 3 of 8** readout. The grid stays full size and switches to the bar that is playing, or the one you tap. Tap a bar number to hear that bar. Tapping a grid cell plays that drum instantly (on the press, not after the click) at the current kit mix and intensity without restarting the loop. **Intensity** is four playing dynamics shared by every style: **pp**, **p**, **f**, and **ff**. It never adds, drops, or rewrites notes — the same groove, same hits. Softer marks use CrocellKit’s softer velocity-layer samples plus a matching quieter level; harder marks use the harder samples and play louder, like a drummer hitting softer or harder. Rim stays about 85% of snare at each level. Changing intensity applies on the next hit while Play is running. Hold and drag across a lane to paint or erase a run of hits. The kit lanes, top to bottom, are **Kick, Snare, Rimshot, Tom 1, Tom 2, Fl Tom, HH Closed, HH Open, Ride, Ride Bell, Crash, Catch, Splash, China**. **Click** starts on **1 bar of 4/4** (quarters) and keeps its own bar count when you switch modes. Use the top header to switch Home, Tuner, Click, and Drums immediately. Tap the big number in the **round tempo dial** to type a BPM (30–300). Spin it like a real wheel: clockwise raises BPM (drag the **right** side down, or the **left** side up). The grab zone extends a little past the dial on the left and right, so a touch or scroll just beside it still turns the wheel — it does not steal taps from Speed Builder, Volume, Tap, −5/+5, or Listen, and the page still scrolls outside that zone. Flick to coast; tap anywhere in the large area around the dial to catch it. **Tap** and **±5** sit underneath and jump straight to the new tempo — tap is always quarter-note BPM. Speed Builder From / To / Step / Repeats +/− buttons keep stepping if you hold them. **Listen** sits full-width under that row: it opens the mic (echo cancellation, noise suppression, and auto-gain off), stops playback, and finds the tempo after about 8–10 seconds — or sooner if the beat is clear. You can also **Choose file** (mp3, m4a, wav, and similar, decoded in the browser). The result is a whole-number BPM (with a tenth if it helps), ½× / 1× / 2× choices you can tap to hear a short click preview, a confidence hint, **Use this tempo**, and **Listen again**. Tapping ½× / 1× / 2× only previews the click and keeps the sheet open; **Use this tempo** applies the tempo and closes the sheet (same as turning the wheel, on the next note). Closing without **Use this tempo** leaves the dial unchanged. When Listen finishes or you close it, the mic tracks stop so the orange status dot should go off. If Speed Builder is on, that BPM becomes the 100% target and practice still starts at the from-% tempo. Detection is an onset-strength envelope (multi-band spectral flux) plus a comb-filter tempogram with a prior around 120 BPM, range 40–240, and octave-error handling — independent Ellis / librosa-style code, no extra library. Set any meter with a compact **4 / 4** stepper: beats **1–30** over a beat unit of **2 / 4 / 8 / 16 / 32**. BPM is always the quarter note, so each beat lasts `(60 / BPM) × (4 / denominator)`: 4/8 at 120 is twice as fast as 4/4, /16 is four times, /2 is half. Subdivision stays relative to the beat (same number of clicks per beat); the note icons and labels follow the denominator (in /8 the beat is an eighth, 2-subdiv shows 16ths, 4-subdiv shows 32nds). Drums grid steps use the same beat length. On **Drums** it sets the grid for every bar and does not move existing hits. On **Click** that strip sets every beat; a small chip under each beat opens the same picker for that beat only (for example eighths on 1, triplets on 2, quarters on 3, sixteenths on 4). While **Play** is running, meter, subdivision, per-beat click subdivisions, bar count, and Click accents wait until the **next cycle** (end of the loop) so the current pass does not restart; the buttons update right away. Switching Click ↔ Drums applies immediately. Stopped changes apply immediately. Tempo, click sound, and drum hits can still change live. In **Click**, accents are one row across the beats. Tap to cycle **off → soft → strong**. Only the downbeat of that beat is accented; subdivision clicks inside the beat stay normal, with a slightly higher pitch. Fresh meters (and new bars) accent **beat 1 only**; every other beat starts unaccented. Accents are for **Click** only. Click sounds (**Wood** default, **Clave**, **Digital**, **Mechanical**) are chosen in **Settings → Click**. Drums: the beat library is grouped by style (Rock, Funk, Metal, Pop, Hip-hop, House, Latin, Shuffle, Jazz, Waltz, Odd), each with about three grooves remade for the expanded kit and inspired by players such as Mike Portnoy, Steve Gadd, Dave Weckl, John Bonham, Stewart Copeland, Questlove, and Neil Peart (original practice grids, not transcriptions). Picking a groove replaces the whole 8-bar loop. Under the grid, four **vertical mixer faders** mix **Kick**, **Snare** (snare + rimshot + clap), **Cymbals** (hats, rides, crashes, catch, splash, china), and **Toms**. Caps rest about **75% up** the throw at the default mix (cymbals sit a little quieter than the others at that 0). A live number (**0.0**, **+3.6**, **−12.0**, **−48.0**) sits under each channel. On a phone or any touch / coarse-pointer device, dragging a fader opens a magnified copy in the middle of the screen so the cap stays visible under your finger; a tap or press never jumps the value — only dragging moves it, with a long fine throw. A mouse on desktop maps 1:1 to the visible throw and does not zoom. The bottom of the throw is silence (−48.0); above 0 is about +6 dB of headroom. The kit is CrocellKit (CC BY 4.0) with a VCSL clap; that credit now lives in **Settings → About & Legal → Credits & Licenses**. A light medium-room send (about −40 dB / 1% wet) sits after a dry safety clipper so the tail is never ducked. Add up to **8 bars**. On **Click** and **Drums**, a compact **Volume** fader sits between Speed Builder and the tempo wheel (one shared value, remembered on this device, default 100% / 0 dB). It scales Click and Drums playback only — not the tuner or Listen mic. **Speed Builder** sits beside the tempo wheel: set from/to/step percents, how many **Repeats** of the full pattern to hold at each tempo (1–32, default 1), and Play walks the tempo in cycle-accurate steps. The on/off switch stays on that card. **Announce** and **Precount** live in **Settings → Speed Builder**. **Precount** (default on) is one shared switch: on **Drums** it counts in one bar of the current meter before the groove, even with Speed Builder off; with Speed Builder on, the same setting counts in once before each new tempo (never twice). The count uses the distinct precount click and the same beat length as the meter (`(60 / BPM) × (4 / denominator)`), then bar 1 beat 1 starts with no gap. Click only uses precount when Speed Builder is on. The goal tempo keeps looping. A large percent / BPM flash appears at each tempo change. **Announce** plays bundled neural voice clips (Kokoro af_heart) through the same audio engine as the click — not the phone’s robotic system voice. Last setup stays on this device. Old `/metronome` and `/drum-machine` links open Rhythm.
- There are **no payments** yet. The home page no longer mentions a future subscription.

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

### Permanent site (omnician.app)

The live site is a Cloudflare Worker that serves the Vite `dist/` folder. Client routes such as `/tuner` and `/rhythm` are covered by Wrangler's single-page-application fallback (`wrangler.jsonc`). The repo is not on GitHub, so deploys are a direct Wrangler upload — not Cloudflare Pages Git.

When Cloudflare credentials are in the environment, publish with:

```bash
npm run deploy
```

That script builds the app, then runs `wrangler deploy`. It needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Do not put those values in the repo. They belong in Cursor **Cloud Agents → Secrets** (token as a **Runtime Secret**, account ID as an **Environment Variable**). After a change lands on `main`, run `npm run deploy` so **omnician.app** updates. Do not add a `public/_redirects` SPA rewrite — Wrangler already serves `/tuner` and `/rhythm` with `not_found_handling: "single-page-application"`.

iMessage and other link previews use `https://omnician.app/brand/og-card.png` (1200×630). The page title is Omnician; the description is *The ultimate musician’s practice companion.*

---

## Sample credits

**Click** voices are CC0 / public domain. Copies live in `public/rhythm/clicks/` with a LICENSE file. Wood uses Druminfected’s metronome tick; its original accent was clipped, so the strong hit is a Versilian VCSL woodblock. Clave is VCSL. Digital is NenadSimic’s menu click, low-passed. Mechanical is Sadiquecat’s metronome click 2.

**Speed Builder Announce** — spoken percents are Kokoro-82M **af_heart** (Apache 2.0). Clips live in `public/rhythm/announce/af_heart/` with `LICENSE.txt`.

**Drums** — CrocellKit by DrumGizmo.org (Lars Muldjord / Crocell / JBOSound), stereo mix by Henry Järvinen, CC BY 4.0; samples edited. Ride bell, china, splash and catch come from that same stereo mix (RideRBell, ChinaR, SplashL, CrashRStopped). A light generated drum-room send (about 1% wet) sits the kit in one space; the click stays dry. See `public/rhythm/drums/LICENSE.txt`.
