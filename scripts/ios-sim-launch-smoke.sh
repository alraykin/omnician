#!/usr/bin/env bash
# Boot an iOS 27.x simulator matching the Xcode 27 SDK, install the unsigned
# App.app, launch it, and fail if the process dies or UIKit traps. Prefer the
# OmnicianScene marker from a live `log stream` started before launch; if that
# marker never appears, pass when the pid is still alive, no new App crash
# report exists, and FrontBoard has the app scene in the foreground.
set -Eeuo pipefail
trap 'echo "ios-sim-launch-smoke: ERR line ${LINENO} cmd=${BASH_COMMAND} exit=$?" >&2' ERR

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DERIVED="${1:-$ROOT/ios/App/DerivedData}"
BUNDLE_ID="${BUNDLE_ID:-app.omnician}"
WAIT_SEC="${SMOKE_WAIT_SEC:-10}"
STREAM_PIDS=()
STREAM_DIR=""

cleanup() {
  local p
  for p in "${STREAM_PIDS[@]+"${STREAM_PIDS[@]}"}"; do
    kill "$p" 2>/dev/null || true
  done
  for p in "${STREAM_PIDS[@]+"${STREAM_PIDS[@]}"}"; do
    wait "$p" 2>/dev/null || true
  done
}
trap cleanup EXIT

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

STREAM_DIR="$(mktemp -d)"
SCENE_STREAM="$STREAM_DIR/scene.log"
FB_STREAM="$STREAM_DIR/frontboard.log"
CRASH_MARK="$STREAM_DIR/crash.mark"
touch "$CRASH_MARK"

# Live stream must start before launch. `log show --last` misses NSLog / private
# os_log and can look at the wrong time window.
xcrun simctl spawn "$UDID" log stream --level debug --style compact \
  --predicate 'subsystem == "app.omnician"' \
  >"$SCENE_STREAM" 2>&1 &
STREAM_PIDS+=($!)
xcrun simctl spawn "$UDID" log stream --level debug --style compact \
  --predicate 'eventMessage CONTAINS "app.omnician" OR processImagePath CONTAINS "FrontBoard"' \
  >"$FB_STREAM" 2>&1 &
STREAM_PIDS+=($!)
sleep 2

LAUNCH="$(xcrun simctl launch "$UDID" "$BUNDLE_ID")"
echo "ios-sim-launch-smoke: $LAUNCH"
PID="$(printf '%s\n' "$LAUNCH" | sed -n 's/.*: //p' | tr -d '[:space:]')"
if [[ -z "$PID" ]]; then
  echo "ios-sim-launch-smoke: simctl launch did not print a pid" >&2
  exit 1
fi

sleep "$WAIT_SEC"

# Stop streams so files are flushed before we grep.
cleanup
STREAM_PIDS=()
trap - EXIT

new_crashes() {
  # Do not glob App* — that matches AppIntentsLiveEntityService and other system
  # simulator processes. Only our binary: App- / App_ / App. plus .ips headers.
  local dirs=() d
  for d in \
    "$HOME/Library/Logs/DiagnosticReports" \
    "$HOME/Library/Logs/CrashReporter" \
    "$HOME/Library/Developer/CoreSimulator/Devices/$UDID/data/Library/Logs/CrashReporter" \
    "$HOME/Library/Developer/CoreSimulator/Devices/$UDID/data/Library/Logs/DiagnosticReports"
  do
    [[ -d "$d" ]] && dirs+=("$d")
  done
  if [[ ${#dirs[@]} -eq 0 ]]; then
    return 0
  fi
  find "${dirs[@]}" -type f \( -name '*.ips' -o -name '*.crash' \) \
    -newer "$CRASH_MARK" 2>/dev/null \
  | while IFS= read -r f; do
      base="$(basename "$f")"
      case "$base" in
        App-*|App_*|App.*) printf '%s\n' "$f"; continue ;;
      esac
      if head -c 16384 "$f" 2>/dev/null | grep -Eq '"app_name"[[:space:]]*:[[:space:]]*"App"|"bundleID"[[:space:]]*:[[:space:]]*"app\.omnician"'; then
        printf '%s\n' "$f"
      fi
    done || true
}

dump_logs() {
  echo "--- scene log stream (subsystem app.omnician) ---" >&2
  tail -120 "$SCENE_STREAM" >&2 || true
  echo "--- FrontBoard / app.omnician event stream ---" >&2
  tail -160 "$FB_STREAM" >&2 || true
  echo "--- new crash reports ---" >&2
  new_crashes | tail -20 >&2 || true
}

SCENE_LOG="$(cat "$SCENE_STREAM" 2>/dev/null || true)"
FB_LOG="$(cat "$FB_STREAM" 2>/dev/null || true)"
COMBINED="$SCENE_LOG"$'\n'"$FB_LOG"
printf '%s\n' "$COMBINED"

CRASHES="$(new_crashes)"
if [[ -n "$CRASHES" ]]; then
  echo "ios-sim-launch-smoke: FAIL new crash report for App after launch" >&2
  printf '%s\n' "$CRASHES" >&2
  dump_logs
  exit 1
fi

if printf '%s\n' "$COMBINED" | grep -Eqi 'EXC_BREAKPOINT|SIGTRAP|does not adopt UIScene|UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption'; then
  echo "ios-sim-launch-smoke: FAIL UIKit scene/lifecycle trap in simulator log" >&2
  dump_logs
  exit 1
fi

PID_ALIVE=0
if xcrun simctl spawn "$UDID" launchctl print "pid/$PID" >/dev/null 2>&1; then
  PID_ALIVE=1
fi
if [[ "$PID_ALIVE" -eq 0 ]]; then
  echo "ios-sim-launch-smoke: FAIL pid $PID died within ${WAIT_SEC}s" >&2
  dump_logs
  exit 1
fi

MARKER=0
if printf '%s\n' "$COMBINED" | grep -q 'OmnicianScene: window connected'; then
  MARKER=1
fi

FRONTBOARD=0
if printf '%s\n' "$FB_LOG" | grep -q 'app.omnician' && printf '%s\n' "$FB_LOG" | grep -Eqi 'foreground|app.omnician-default'; then
  FRONTBOARD=1
fi

if [[ "$MARKER" -eq 1 ]]; then
  echo "ios-sim-launch-smoke: ok pid $PID alive, OmnicianScene marker on $DEVICE_NAME ($RUNTIME)"
elif [[ "$FRONTBOARD" -eq 1 ]]; then
  echo "ios-sim-launch-smoke: ok pid $PID alive, FrontBoard scene foreground (OmnicianScene log not captured) on $DEVICE_NAME ($RUNTIME)"
else
  echo "ios-sim-launch-smoke: FAIL pid $PID alive but no OmnicianScene marker and FrontBoard scene not seen in foreground" >&2
  dump_logs
  exit 1
fi

xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
exit 0
