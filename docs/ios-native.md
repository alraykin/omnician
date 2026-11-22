# Native iPhone app (Capacitor)

Omnician on the phone is still the same web app. Capacitor wraps the Vite `dist/` folder in a small iOS shell named **Omnician** (`app.omnician`). The live site at omnician.app is unchanged — `npm run deploy` still builds with Vite and uploads the Worker.

The Apple Developer Program account is in use for TestFlight via GitHub Actions secrets. Do **not** put those secrets in this git repo.

## What is already in this repo

- Capacitor core, CLI, and iOS
- `ios/` Xcode project
- App icon from the existing O mark, on the same dark `#0B0F1A` as the app
- Dark launch screen
- Native audio session so click and drums play with the silent switch on (`AVAudioSession` category **playback**, `mixWithOthers` **off**)
- Microphone permission string for the tuner
- GitHub Actions workflow that compiles an **unsigned iPhone Simulator** build on `xcode-27` with the newest Xcode 27.x (iOS 27.1+ SDK fills the Duo inner display), then boots an iOS 27 simulator and fails if the process dies or the window scene never connects
- UIScene lifecycle (`SceneDelegate` + `UIApplicationSceneManifest`) required to launch when linked against the iOS 27 SDK
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
3. Actions → **iOS** workflow runs on `xcode-27` with the newest Xcode 27.x on that image (GitHub-hosted, no paid Codemagic). App Store Connect requires a current iOS SDK. iPhone Duo uses the full inner display when the build is linked against iOS 27.1+.
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
2. In App Store Connect, create the app: name **Omnician**, bundle ID **app.omnician**, SKU something like `omnician`.
3. Create the App Store Connect API key. Download the `.p8` once — Apple will not show it again. Store it in a password manager, then paste it into GitHub.
4. Do **not** put the `.p8` in this git repo.

You do **not** need a registered iPhone. The TestFlight job archives **unsigned** (so Xcode never asks for an iOS Development profile), then `xcodebuild -exportArchive` signs with **Apple Distribution** and creates the App Store profile in the cloud using the API key (`-allowProvisioningUpdates`). Build number is the GitHub run number; marketing version stays **1.0**. `ITSAppUsesNonExemptEncryption` is already false, so TestFlight should not stop on export-compliance. You should **not** need a `.p12` or a provisioning-profile file unless that automatic distribution signing fails.

If automatic signing later fails, add these optional secrets (still unused today):

| Optional secret | What it is |
| --- | --- |
| `IOS_DIST_CERT_P12_BASE64` | Apple Distribution certificate exported as `.p12`, then `base64` |
| `IOS_DIST_CERT_PASSWORD` | Password for that `.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | App Store provisioning profile, `base64` |

## Bundle ID

The project uses **`app.omnician`**. Changing it after the first TestFlight upload means a new App Store Connect app.

## Fold posture (automatic)

There is no Fold mode button or setting on web or in the native app. Layouts follow the device:

| Pose | Layout |
| --- | --- |
| Outer portrait / phone portrait | Normal |
| Outer / phone landscape, on Click | Tent pendulum |
| Inner portrait, flat (hinge fully open) | Normal |
| Inner portrait, laptop (~70–130° hinge, horizontal crease) | Click/Drums laptop |
| Inner landscape (flat or book) | Tuner book |

Safari uses Viewport Segments and `navigator.devicePosture` when present, plus window size for tent. `?fold=` still overrides for QA.

The native `OmnicianPosture` plugin drives the same CSS layouts with hysteresis. CI uses GitHub’s `xcode-27` image and the newest Xcode 27.x there (27.2 as of the current image: Swift 6.4, iOS 27.2 SDK), so `#if compiler(>=6.4)` compiles `UIHingeInteraction(updateHandler:)` and `reservedRegions(kind:options:)` (Kind is `UIView.ReservedRegion.Kind`, not a C enum). Those APIs are attached only after `viewDidAppear` when `view.window != nil`, always on the main queue, and wrapped in an ObjC `@try/@catch` so a hinge assertion cannot kill the process. Runtime still uses `if #available(iOS 27.1, *)`; older iPhones keep the iOS 15 deployment target and fall back to window size + CoreMotion. There are no `UITraitCollection` posture traits. Hinge is not used for native Auto Layout; we only read it as input for the web layouts. The simulator job boots a simulator, installs the unsigned app, launches it, and fails if the process dies within ~10s.

Haptics stay on `navigator.vibrate` for now.

## Native vs web sounds

Safari on omnician.app and the native app share **one KitEngine** (`src/lib/rhythm-audio.ts`), the same Crocell/click files under `public/rhythm/`, and the same `SAMPLE_GAIN` / fader defaults / hat choke / intensity dynamics.

Safari loads Factory beats from same-origin `GET /api/factory/library` and samples from `/rhythm/...` on that host.

The TestFlight webview origin is `omnician://localhost` (also `capacitor://localhost` / `ionic://localhost`). Native fetches `https://omnician.app/api/factory/library` and `https://omnician.app/rhythm/...` first, then the files copied into the app bundle by `cap sync`. The Worker sends GET/HEAD/OPTIONS CORS for those three webview origins on the public library **and** `/rhythm/*` (`run_worker_first` so static samples cannot skip the Worker). Login, PUT, history, restore, and `FACTORY_ADMIN_PASSWORD` stay same-origin with no CORS.

WKWebView `decodeAudioData` often fails on the licensed AAC/m4a drum hits (and sometimes mp3 announce files) when they come from the custom app scheme, which used to drop every drum to the baked synth fallback. `OmnicianAudio.decodeSample` turns those **same bytes** into PCM with `AVAudioFile`. The plugin still does not play audio; it only sets `AVAudioSession` playback (silent switch) and decodes.

`localStorage` is still per-origin (webview vs omnician.app). Factory-published library JSON is the shared default.

CI `npm run test:sound-sources` asserts native and web reference the same sample files and per-drum gains.

## iPhone Duo inner display

Build 1.0 (6) was an iPhone-only target (`TARGETED_DEVICE_FAMILY = 1`), so iOS opened it in the compatibility letterbox instead of the ~720×1024 inner screen. The project is now universal (`1,2`), lists all four orientations for iPhone and iPad, keeps `UILaunchStoryboardName`, and does not set `UIRequiresFullScreen`. The webview uses `contentInset: never`, `viewport-fit=cover`, and `env(safe-area-inset-*)`. Fold/unfold and rotation resize the webview and fire `resize` so Laptop / Book / Tent (shortest side ≥ 640) match Safari.

Apple letterboxes iOS 26 SDK binaries on Duo. GitHub Actions builds on `xcode-27` with Xcode 27.2 so TestFlight links against the iOS 27.x SDK and can fill the inner display. Apps linked with that SDK must adopt the UIScene lifecycle (`UIApplicationSceneManifest` + `SceneDelegate`); a legacy `AppDelegate.window` + `UIMainStoryboardFile` path traps in UIKit during scene connection on iOS 27.

## Web deploy stays the same

```bash
npm run deploy
```

still runs `scripts/deploy-cloudflare.sh` (Vite build, then `wrangler deploy`). Capacitor is extra. Do not run deploy as part of an iOS-only change unless the web UI also changed.
