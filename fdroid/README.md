# Releasing on F-Droid

F-Droid builds FossFitness from source and signs it with its own key, so the F-Droid build
and the GitHub release can't update over each other. Pick one per phone.

## Each release

1. Bump `app/version.json` (`versionName` and a higher `versionCode`).
2. Add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`.
3. Commit, then tag `v<versionName>` and push the tag. F-Droid's update checker finds new tags
   matching `^v[0-9.]+$` and reads the version from `app/version.json`.

## First submission

1. Fork <https://gitlab.com/fdroid/fdroiddata>.
2. Copy `io.github.merlinlcb.fossfitness.yml` from this folder to `metadata/` in your fork.
3. Test it with fdroidserver. The easiest way is the F-Droid build container:
   `fdroid readmeta && fdroid lint io.github.merlinlcb.fossfitness && fdroid build -v -l io.github.merlinlcb.fossfitness`
4. Open a merge request. Reviewers usually ask for a few changes (Node setup, scan rules).

## Build flavour

`FF_DISTRIBUTION=fdroid` (set in the recipe):
- leaves out the in-app updater, because F-Droid handles updates
- leaves the release APK unsigned, for F-Droid to sign

No Google libraries are used in any build:
- Firebase is patched out of expo-notifications
- the Play Install Referrer is patched out of expo-application
- label OCR uses Tesseract, not ML Kit
- all Expo modules are compiled from source (`buildFromSource` in `app/package.json`)
