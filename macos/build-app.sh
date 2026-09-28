#!/bin/zsh
set -euo pipefail

PROJECT_DIR="${0:A:h:h}"
APP_DIR="$PROJECT_DIR/FullCourt.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

cd "$PROJECT_DIR"
FULLCOURT_NATIVE=1 npm run build
node "$PROJECT_DIR/macos/inline-build.mjs"

rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR/web"

xcrun clang -fobjc-arc -O2 \
  -mmacosx-version-min=13.0 \
  -framework Cocoa \
  -framework WebKit \
  "$PROJECT_DIR/macos/main.m" \
  -o "$MACOS_DIR/FullCourt"

cp "$PROJECT_DIR/macos/Info.plist" "$CONTENTS_DIR/Info.plist"
ditto "$PROJECT_DIR/dist" "$RESOURCES_DIR/web"
codesign --force --deep --sign - "$APP_DIR"

echo "Built $APP_DIR"
