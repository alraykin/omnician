# Native iPhone app (Capacitor)

Omnician on the phone is still the same web app. Capacitor wraps the Vite `dist/` folder in a small iOS shell named **Omnician** (`app.omnician.ios`). The live site at omnician.app is unchanged — `npm run deploy` still builds with Vite and uploads the Worker.

Do **not** sign, upload, or open App Store Connect until Alex’s Apple Developer Program account is active.

## What is already in this repo

- Capacitor core, CLI, and iOS
- `ios/` Xcode project
- App icon from the existing O mark, on the same dark `#0B0F1A` as the app
- Dark launch screen
- Native audio session so click and drums play with the silent switch on (`AVAudioSession` category **playback**, `mixWithOthers` **off**)
- Microphone permission string for the tuner
- GitHub Actions workflow that compiles an **unsigned iPhone Simulator** build on `macos-15`
- A TestFlight job that stays **off** until you opt in with secrets

This Linux cloud machine cannot run Xcode. The unsigned compile happens on GitHub’s Mac runners after the repo is on GitHub.

## Run locally (Mac only)

```bash
npm install
npm run ios:sync
npx cap open ios
```

`ios:sync` runs the same Vite production build `npm run deploy` uses, then copies `dist/` into the iOS project. Xcode Simulator does not need a paid Apple account. Device install and TestFlight do.

## Cloud build (no Mac on our side)

GitHub Actions file: `.github/workflows/ios.yml`.

This Origin repo does **not** run GitHub Actions. When you are ready:

1. Create a GitHub repository (private is fine).
2. Push this `main` branch there.
3. Actions → **iOS** workflow runs on `macos-15` (GitHub-hosted, no paid Codemagic).
4. The **Unsigned iPhone simulator** job should turn green. That is the first proof the native project compiles.
5. Leave TestFlight off until the Apple account is active.

## Credentials for TestFlight (create later)

Set these as **GitHub Actions secrets** on that GitHub repo. Names must match exactly.

| Secret | Where to get it | What it looks like |
| --- | --- | --- |
| `APPLE_TEAM_ID` | [developer.apple.com](https://developer.apple.com/account) → Membership details → Team ID | 10 characters, letters and numbers |
| `APP_STORE_CONNECT_ISSUER_ID` | [App Store Connect](https://appstoreconnect.apple.com) → Users and Access → Integrations → App Store Connect API → Issuer ID | UUID |
| `APP_STORE_CONNECT_API_KEY_ID` | Same page → Keys → Key ID of an **App Manager** (or Admin) key | ~10 characters |
| `APP_STORE_CONNECT_API_KEY_P8` | The downloaded `AuthKey_XXXXXXXXXX.p8` file, **entire contents** pasted as the secret | Starts with `-----BEGIN PRIVATE KEY-----` |

Then set a **GitHub Actions variable** (not a secret):

| Variable | Value |
| --- | --- |
| `IOS_TESTFLIGHT_ENABLED` | `true` |

Only set that variable after every secret above exists. The TestFlight job is skipped until then, so CI stays green without Apple.

### One-time Apple clicks (after the account is active)

1. Enroll in the Apple Developer Program as an individual (already in progress).
2. In App Store Connect, create the app: name **Omnician**, bundle ID **app.omnician.ios**, SKU something like `omnician-ios`.
3. Create the App Store Connect API key. Download the `.p8` once — Apple will not show it again. Store it in a password manager, then paste it into GitHub.
4. Do **not** put the `.p8` in this git repo.

Xcode automatic signing with that API key is enough for the first TestFlight. You should **not** need a `.p12` certificate or a provisioning-profile file unless automatic signing fails.

If automatic signing later fails, add these optional secrets (still unused today):

| Optional secret | What it is |
| --- | --- |
| `IOS_DIST_CERT_P12_BASE64` | Apple Distribution certificate exported as `.p12`, then `base64` |
| `IOS_DIST_CERT_PASSWORD` | Password for that `.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | App Store provisioning profile, `base64` |

## Bundle ID

The project uses **`app.omnician.ios`** as requested.

A shorter **`app.omnician`** is slightly cleaner (Apple only needs two reverse-DNS pieces). **`com.raykinmusic.omnician`** matches the LLC if you want the store listing to look corporate. Changing it later means a new App Store Connect app. Decide before the first TestFlight upload.

## Fold posture and haptics (plan only — not built)

Today both features stay in the web layer:

- Fold: `src/lib/fold-mode.ts` already uses `navigator.devicePosture` and Viewport Segments. Auto falls back to Off when the browser has no API.
- Haptics: `navigator.vibrate` on drum-dot hold and BPM wheel ticks. Safari often no-ops this.

When we hook native (later workstream, not this commit):

| Need | Plugin / approach | Native API |
| --- | --- | --- |
| Stronger taps (in-tune, drum hold, metronome beat) | Official [`@capacitor/haptics`](https://capacitorjs.com/docs/apis/haptics) | `UIImpactFeedbackGenerator` / `UINotificationFeedbackGenerator` |
| Click on every beat / lock chime | Custom `OmnicianHaptics` plugin (same pattern as `OmnicianAudio`) | `CHHapticEngine` transient + continuous events, gated when Reduce Motion / haptics-off |
| Fold Auto on iPhone Duo | Keep web APIs first; add `OmnicianPosture` only if WKWebView does not expose Device Posture / Viewport Segments | `UIWindowScene.effectiveGeometry`, screen native bounds, future UIKit hinge/posture if Apple ships it |
| Tent / Laptop / Book from hinge angle | Same custom plugin | Read posture → call existing `setFoldChoice` / layout code; do not fork the CSS layouts |
| Silent-switch audio (done) | In-app `OmnicianAudio` plugin | `AVAudioSession` `.playback` with empty options; `.playAndRecord` + `.defaultToSpeaker` while the tuner mic is live |

JS should keep using `Capacitor.isNativePlatform()` so Safari and omnician.app stay on the web path. Do not add `@capacitor/haptics` until that workstream.

## Web deploy stays the same

```bash
npm run deploy
```

still runs `scripts/deploy-cloudflare.sh` (Vite build, then `wrangler deploy`). Capacitor is extra. Do not run deploy as part of an iOS-only change unless the web UI also changed.
