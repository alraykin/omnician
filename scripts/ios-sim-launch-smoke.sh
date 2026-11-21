#!/usr/bin/env bash
# Boot a simulator, install the unsigned App.app, launch it, and fail if the
# process dies within ~10s. Catches native launch crashes before TestFlight.
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

UDID="$(xcrun simctl list devices available -j | python3 -c '
import json, sys
data = json.load(sys.stdin)
duo = iphone = None
for devices in data.get("devices", {}).values():
    for d in devices:
        if d.get("isAvailable") is False:
            continue
        name = d.get("name", "")
        if "Duo" in name and duo is None:
            duo = d.get("udid")
        elif name.startswith("iPhone") and iphone is None:
            iphone = d.get("udid")
print(duo or iphone or "")
')"

if [[ -z "$UDID" ]]; then
  echo "ios-sim-launch-smoke: no available iPhone simulator" >&2
  xcrun simctl list devices available >&2 || true
  exit 1
fi
echo "ios-sim-launch-smoke: udid $UDID"

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

if xcrun simctl spawn "$UDID" launchctl print "pid/$PID" >/dev/null 2>&1; then
  echo "ios-sim-launch-smoke: ok pid $PID still alive after ${WAIT_SEC}s"
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
  exit 0
fi

echo "ios-sim-launch-smoke: FAIL pid $PID died within ${WAIT_SEC}s" >&2
echo "--- DiagnosticReports ---" >&2
find "$HOME/Library/Logs/DiagnosticReports" -type f \( -name '*Omnician*' -o -name '*App*' \) -mmin -15 2>/dev/null | tail -20 >&2 || true
echo "--- simctl diagnose (log tail) ---" >&2
xcrun simctl spawn "$UDID" log show --last "${WAIT_SEC}s" --predicate 'eventMessage CONTAINS "Omnician" OR processImagePath CONTAINS "App"' --style compact 2>/dev/null | tail -80 >&2 || true
exit 1
