#!/usr/bin/env bash
# Boot an iOS 27.x simulator matching the Xcode 27 SDK, install the unsigned
# App.app, launch it, and fail if the process dies, the window scene never
# connects, or UIKit traps (EXC_BREAKPOINT / SIGTRAP / missing UIScene).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DERIVED="${1:-$ROOT/ios/App/DerivedData}"
BUNDLE_ID="${BUNDLE_ID:-app.omnician}"
WAIT_SEC="${SMOKE_WAIT_SEC:-10}"

APP=""
if [[ -d "$DERIVED/Build/Products/Debug-iphonesimulator/App.app" ]]; then
  APP="$DERIVED/Build/Products/Debug-iphonesimulator/App.app"
else
  APP="$(find "$DERIVED" -type d -name 'App.app' -path '*iphonesimulator*' 2>/dev/null | head -n 1 || true)"
fi
if [[ -z "$APP" || ! -d "$APP" ]]; then
  echo "ios-sim-launch-smoke: no App.app under $DERIVED" >&2
  find "$DERIVED" -name '*.app' 2>/dev/null | head >&2 || true
  exit 1
fi
echo "ios-sim-launch-smoke: app $APP"

INFO_PLIST="$APP/Info.plist"
if ! /usr/libexec/PlistBuddy -c 'Print :UIApplicationSceneManifest:UISceneConfigurations:UIWindowSceneSessionRoleApplication:0:UISceneDelegateClassName' "$INFO_PLIST" >/dev/null 2>&1; then
  echo "ios-sim-launch-smoke: built app is missing UIApplicationSceneManifest (iOS 27 launch assert)" >&2
  /usr/libexec/PlistBuddy -c 'Print' "$INFO_PLIST" >&2 || true
  exit 1
fi
echo "ios-sim-launch-smoke: scene manifest ok"

PICK="$(xcrun simctl list devices available -j | python3 -c '
import json, re, sys
data = json.load(sys.stdin)
best = None
for runtime, devices in data.get("devices", {}).items():
    m = re.search(r"iOS[- ](\d+)[.\-](\d+)", runtime)
    if not m:
        continue
    major, minor = int(m.group(1)), int(m.group(2))
    if major < 27:
        continue
    for d in devices:
        if d.get("isAvailable") is False:
            continue
        name = d.get("name", "")
        if "Duo" not in name and not name.startswith("iPhone"):
            continue
        duo = 1 if "Duo" in name else 0
        key = (major, minor, duo)
        cand = (key, d.get("udid"), runtime, name)
        if best is None or cand[0] > best[0]:
            best = cand
if not best:
    sys.exit(0)
print(best[1])
print(best[2])
print(best[3])
')"

if [[ -z "$PICK" ]]; then
  echo "ios-sim-launch-smoke: no available iOS 27.x iPhone simulator" >&2
  xcrun simctl list devices available >&2 || true
  xcrun simctl list runtimes >&2 || true
  exit 1
fi
UDID="$(printf '%s\n' "$PICK" | sed -n '1p')"
RUNTIME="$(printf '%s\n' "$PICK" | sed -n '2p')"
DEVICE_NAME="$(printf '%s\n' "$PICK" | sed -n '3p')"
echo "ios-sim-launch-smoke: device $DEVICE_NAME runtime $RUNTIME udid $UDID"

xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b

xcrun simctl install "$UDID" "$APP"
xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true

LAUNCH="$(xcrun simctl launch "$UDID" "$BUNDLE_ID")"
echo "ios-sim-launch-smoke: $LAUNCH"
PID="$(printf '%s\n' "$LAUNCH" | sed -n 's/.*: //p' | tr -d '[:space:]')"
if [[ -z "$PID" ]]; then
  echo "ios-sim-launch-smoke: simctl launch did not print a pid" >&2
  exit 1
fi

sleep "$WAIT_SEC"

dump_logs() {
  echo "--- simctl log ---" >&2
  xcrun simctl spawn "$UDID" log show --last "$((WAIT_SEC + 5))s" --info --style compact \
    --predicate 'processImagePath CONTAINS "App" OR eventMessage CONTAINS "OmnicianScene" OR eventMessage CONTAINS "UIScene" OR eventMessage CONTAINS "does not adopt UIScene" OR subsystem == "app.omnician"' \
    2>/dev/null | tail -120 >&2 || true
  echo "--- DiagnosticReports ---" >&2
  find "$HOME/Library/Logs/DiagnosticReports" -type f \( -name '*Omnician*' -o -name '*App*' \) -mmin -15 2>/dev/null | tail -20 >&2 || true
  CRASH_DIR="$HOME/Library/Developer/CoreSimulator/Devices/$UDID/data/Library/Logs/CrashReporter"
  if [[ -d "$CRASH_DIR" ]]; then
    echo "--- simulator CrashReporter ---" >&2
    find "$CRASH_DIR" -type f -mmin -15 2>/dev/null | tail -20 >&2 || true
  fi
}

LOG="$(xcrun simctl spawn "$UDID" log show --last "$((WAIT_SEC + 5))s" --info --style compact \
  --predicate 'processImagePath CONTAINS "App" OR eventMessage CONTAINS "OmnicianScene" OR eventMessage CONTAINS "UIScene" OR eventMessage CONTAINS "does not adopt UIScene" OR subsystem == "app.omnician"' \
  2>/dev/null || true)"
printf '%s\n' "$LOG"

if printf '%s\n' "$LOG" | grep -Eqi 'EXC_BREAKPOINT|SIGTRAP|does not adopt UIScene|UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption'; then
  echo "ios-sim-launch-smoke: FAIL UIKit scene/lifecycle trap in simulator log" >&2
  dump_logs
  exit 1
fi

if ! printf '%s\n' "$LOG" | grep -q 'OmnicianScene: window connected'; then
  echo "ios-sim-launch-smoke: FAIL window scene did not connect (missing OmnicianScene log)" >&2
  dump_logs
  exit 1
fi

if ! xcrun simctl spawn "$UDID" launchctl print "pid/$PID" >/dev/null 2>&1; then
  echo "ios-sim-launch-smoke: FAIL pid $PID died within ${WAIT_SEC}s" >&2
  dump_logs
  exit 1
fi

echo "ios-sim-launch-smoke: ok pid $PID alive, window scene connected on $DEVICE_NAME ($RUNTIME)"
xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
exit 0
