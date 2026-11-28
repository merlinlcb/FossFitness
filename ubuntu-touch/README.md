# FossFitness for Ubuntu Touch

This folder builds FossFitness for [Ubuntu Touch](https://ubuntu-touch.io) 24.04 as a `.click` package.

It reuses the app in `../app` without changing it. The build copies `app/`, adds the web libraries to
that copy, exports it with Expo's web target, and wraps the result in a small QML shell (Morph.Web)
so it runs as a normal Ubuntu Touch app. The Android build, its dependencies and `app/package.json`
are untouched.

## Build

Needs Node.js 20 or newer, `rsync`, and podman or docker.

```bash
./build.sh
```

The package lands in `out/fossfitness.merlinlcb_<version>_all.click`. It is architecture `all`
(no compiled code), so the same file works on every Ubuntu Touch 24.04 phone.

## Install

From a computer with `adb` and Developer Mode on the phone:

```bash
adb push out/fossfitness.merlinlcb_*_all.click /home/phablet/
adb shell sudo click install --user=phablet --allow-unauthenticated /home/phablet/fossfitness.merlinlcb_*_all.click
```

## What works and what doesn't (yet)

| Feature | Ubuntu Touch |
|---|---|
| Logging food, water, workouts, fasting, weight; quests, medals, charts | Works |
| Group server: sign in, sync, chat, compare | Works |
| Health Connect | Not available (Android only); the app hides it |
| Reading nutrition labels with the camera | Works: Ubuntu Touch's photo picker (Camera, Gallery, Files) and Tesseract running in the app, on the phone (first scan takes a few seconds to load) |
| Reminders and notifications | Not yet: calls are no-ops on this platform |
| Backup export / import | Untested |

Your data lives in the app's own storage on the phone. To move from Android, sign in to the same
group server; your history syncs down.

## How it fits together

| Path | What it is |
|---|---|
| `build.sh` | The whole build |
| `web/metro.config.js` | Metro config used only for this build; swaps Android-only modules for `web/stubs/` |
| `web/stubs/` | Web stand-ins for `react-native-health-connect`, `expo-notifications` and the label reader (`label-ocr.js`: Tesseract compiled to WebAssembly, same English model as the Android module; also makes `Alert.alert` show dialogs) |
| `click/` | Click manifest, AppArmor policy, desktop file and the QML shell (`qml/Main.qml`), which also answers the web view's file requests with Ubuntu Touch's own content picker |

Modules that the app already loads lazily with a fallback (app handoff) need no stub. The build downloads
`tesseract.js-core` (pinned version, Apache-2.0) from npm and copies the English model and the sample label
from `app/modules/label-ocr/` into the web build.
