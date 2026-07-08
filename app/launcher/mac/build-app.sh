#!/bin/bash
# Rebuilds "Job Tracker.app" (the macOS double-click launcher) from source.
# Run on macOS from anywhere:  bash app/launcher/mac/build-app.sh
#
# WHY an AppleScript applet (not a hand-made bundle with a shell-script
# executable): modern macOS (26+) refuses to launch a .app whose main executable
# is an unsigned shell script via double-click (it runs fine from a terminal, but
# LaunchServices silently declines). An `osacompile` applet has a real,
# macOS-trusted Mach-O executable, so it launches reliably. The applet itself does
# nothing but hand off to app/launch.command (see the .applescript).
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"     # app/launcher/mac
ROOT="$(cd "$HERE/../../.." && pwd)"      # project root (up past launcher/, app/)
APP="$ROOT/Job Tracker.app"
ICON="$HERE/../JobTracker.icns"           # app/launcher/JobTracker.icns

rm -rf "$APP"
osacompile -o "$APP" "$HERE/JobTracker.applescript"

# Swap the default AppleScript applet icon for ours. osacompile also points the
# icon at an asset-catalog entry (CFBundleIconName) which overrides applet.icns,
# so remove that key + the default Assets.car to make our icon win.
cp "$ICON" "$APP/Contents/Resources/applet.icns"
/usr/libexec/PlistBuddy -c "Delete CFBundleIconName" "$APP/Contents/Info.plist" 2>/dev/null || true
rm -f "$APP/Contents/Resources/Assets.car"

# Ad-hoc code-sign so macOS will launch it (no paid certificate needed).
xattr -cr "$APP"
codesign --force --deep --sign - "$APP"

echo "Built: $APP"
