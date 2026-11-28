#!/usr/bin/env bash
# Builds FossFitness for Ubuntu Touch (24.04) as a .click package in ubuntu-touch/out/.
#
# The Android app in app/ is not modified: this script copies app/ to ubuntu-touch/.build/,
# adds the web libraries to that copy only, swaps the Android-only native modules for the
# stand-ins in web/stubs/, exports the web build with Expo and wraps it in a QML shell.
#
# Needs: Node.js 20+ (npx), rsync, and podman or docker (to run `click build` in Ubuntu 24.04).
set -euo pipefail
cd "$(dirname "$0")"
UT="$PWD"
APP="$UT/../app"
B="$UT/.build"
VERSION="$(node -p "require('$APP/version.json').versionName")"

echo "== FossFitness $VERSION for Ubuntu Touch"
rm -rf "$B"
mkdir -p "$B" "$UT/out"

echo "== Copying app/ (the original is not touched)"
rsync -a --exclude node_modules --exclude android --exclude ios --exclude .expo "$APP/" "$B/app/"
cp -r "$UT/web/stubs" "$B/app/ut-stubs"
cp "$UT/web/metro.config.js" "$B/app/metro.config.js"

echo "== Installing dependencies and the web libraries (in the copy)"
cd "$B/app"
npx -y npm@10 ci --no-audit --no-fund
npx expo install react-dom react-native-web @expo/metro-runtime

echo "== Exporting the web build"
FF_UT_STUBS="$B/app/ut-stubs" CI=1 npx expo export --platform web --output-dir "$B/dist"
# The app is loaded from local files on the phone, so paths must be relative.
sed -i 's|src="/_expo/|src="./_expo/|g; s|href="/_expo/|href="./_expo/|g' "$B/dist/index.html"
if grep -q '="/' "$B/dist/index.html"; then
    echo "index.html still has absolute paths:"; grep -o '="/[^"]*"' "$B/dist/index.html"; exit 1
fi

echo "== Adding the on-device label reader (Tesseract as WebAssembly, same model as Android)"
# tesseract.js-core: the non-SIMD LSTM build, since the phone's web engine (Chromium 87) predates
# WebAssembly SIMD. Pinned version; the model and sample label come from the Android module.
TESS_CORE_VERSION=5.1.1
mkdir -p "$B/tess" "$B/dist/ocr"
( cd "$B/tess" && npx -y npm@10 pack "tesseract.js-core@$TESS_CORE_VERSION" >/dev/null && tar xzf "tesseract.js-core-$TESS_CORE_VERSION.tgz" )
cp "$B/tess/package/tesseract-core-lstm.wasm.js" "$B/dist/ocr/"
cp "$APP/modules/label-ocr/android/src/main/assets/tessdata/eng.traineddata" "$B/dist/ocr/"
cp "$APP/modules/label-ocr/android/src/main/assets/labelocr/sample-label.png" "$B/dist/ocr/"

echo "== Assembling the click"
C="$B/click"
mkdir -p "$C/assets"
cp -r "$UT/click/qml" "$C/"
cp "$UT/click/fossfitness.apparmor" "$UT/click/fossfitness.desktop" "$C/"
sed "s/@VERSION@/$VERSION/" "$UT/click/manifest.json.in" > "$C/manifest.json"
cp "$APP/assets/icon.png" "$C/assets/icon.png"
cp -r "$B/dist" "$C/www"

echo "== Building the .click in Ubuntu 24.04"
ENGINE="$(command -v podman || command -v docker)"
"$ENGINE" run --rm --platform linux/amd64 -v "$C:/click:ro,z" -v "$UT/out:/out:z" docker.io/library/ubuntu:24.04 bash -c '
    set -e; export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq >/dev/null && apt-get install -y -qq --no-install-recommends click >/dev/null
    cp -r /click /tmp/pkg && cd /out && click build /tmp/pkg'
ls -l "$UT/out/"*"_${VERSION}_all.click"
