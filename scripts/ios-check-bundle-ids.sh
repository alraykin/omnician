#!/usr/bin/env bash
# Fail if any nested bundle inside the archived .app reuses the app id.
# Usage: ios-check-bundle-ids.sh /path/to/Omnician.xcarchive
set -euo pipefail

archive="${1:?archive path required}"
app=""
for candidate in \
  "$archive/Products/Applications/App.app" \
  "$archive/Products/Applications/Omnician.app"
do
  if [ -d "$candidate" ]; then
    app="$candidate"
    break
  fi
done

if [ -z "$app" ]; then
  echo "No .app inside $archive/Products/Applications" >&2
  ls -la "$archive/Products/Applications" >&2 || ls -la "$archive" >&2 || true
  exit 1
fi

echo "App bundle: $app"
fail=0
found_app_plist=0

while IFS= read -r -d '' plist; do
  bid="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$plist" 2>/dev/null || echo '(none)')"
  rel="${plist#"$app/"}"
  echo "$rel  $bid"
  if [ "$rel" = "Info.plist" ]; then
    found_app_plist=1
    if [ "$bid" != "app.omnician" ]; then
      echo "ERROR: app Info.plist is '$bid', expected app.omnician" >&2
      fail=1
    fi
  elif [ "$bid" = "app.omnician" ]; then
    echo "ERROR: $rel also has CFBundleIdentifier app.omnician" >&2
    fail=1
  fi
done < <(find "$app" -name Info.plist -print0)

if [ "$found_app_plist" -eq 0 ]; then
  echo "ERROR: $app/Info.plist was not found" >&2
  fail=1
fi

exit "$fail"
