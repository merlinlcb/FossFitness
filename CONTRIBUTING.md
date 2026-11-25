# Contributing to FossFitness

Thank you for helping. FossFitness is meant to become a community project, so this guide tries to explain
not only *what* to do but *where things live and why they are the way they are*. If anything here is unclear
or out of date, a pull request that fixes this file is a very welcome first contribution.

- [What FossFitness promises its users](#what-fossfitness-promises-its-users)
- [Ways to help](#ways-to-help)
- [Getting set up](#getting-set-up)
- [Map of the repository](#map-of-the-repository)
- [How the app works](#how-the-app-works)
- [Rules that protect people's data](#rules-that-protect-peoples-data)
- [Privacy, dependencies and F-Droid](#privacy-dependencies-and-f-droid)
- [Patched dependencies](#patched-dependencies)
- [Writing code](#writing-code)
- [Tests and CI](#tests-and-ci)
- [Pull requests](#pull-requests)
- [How pull requests are reviewed](#how-pull-requests-are-reviewed)
- [Automated contributors (bots and AI agents)](#automated-contributors-bots-and-ai-agents)
- [Releases (maintainers)](#releases-maintainers)
- [License](#license)

## What FossFitness promises its users

Every change is judged against these. A pull request that breaks one will not be merged, however useful it is.

1. **Works on its own.** Everything except the group features runs on the phone, with no account and no network.
2. **No tracking.** No ads, no analytics, no crash reporters, no telemetry of any kind.
3. **No Google services.** No Firebase, Play services, ML Kit or Play Install Referrer, so the app can live on F-Droid.
4. **Talks only to the user's own server.** When signed in, the app contacts exactly one host: the HealthHub
   server the person chose. It contacts nothing else, ever.
5. **People's history is never lost.** An update must always be able to read what older versions saved.
6. **Plain language.** The app is used by people who are not technical. Labels and messages are short and clear.

## Ways to help

- **Report a bug or suggest a feature:** open an issue. Say what you did, what you expected and what happened,
  plus your Android version and the app version (Settings shows it).
- **Fix a bug or build a feature:** for anything bigger than a small fix, open an issue first so we can agree on
  the approach before you spend time on it.
- **Improve the data:** the exercise library and the food database are built from files and scripts in this repo
  (see [Food data](#food-data) and [Training](#training)).
- **Improve this guide or the README.**

Translations are not set up yet (the text is in English inside the components). If you want to start them, open
an issue first: it needs a plan for how strings are extracted.

## Getting set up

You need:

| Tool | Version | Why |
|---|---|---|
| Node.js | 22 (20.19 or newer works) | Expo SDK 54 |
| npm | **10** | The lockfile must be written by npm 10. npm 11 drops some entries and `npm ci` then fails in CI. If your Node ships npm 11, use `npx -y npm@10 install ...` for anything that changes `package-lock.json`. |
| JDK | 17 | React Native's Gradle plugin asks for a Java 17 toolchain |
| Android SDK | with the NDK | only for building an APK; tests and lint don't need it |

```bash
cd app
npm ci                 # installs dependencies and applies app/patches (postinstall)
npm test               # unit tests (Jest)
npm run lint           # ESLint
```

To run on a phone or emulator during development: `npx expo run:android`.

To build a release APK the way CI does:

```bash
cd app
npx expo prebuild --platform android --no-install --clean   # generates app/android (never commit it)
cd android && ./gradlew assembleRelease
```

Without signing variables the APK is signed with a throwaway debug key, which is fine for testing.
Add `FF_DISTRIBUTION=fdroid` to both commands to build the F-Droid flavour (see [Build settings](#build-settings)).

## Map of the repository

```
.
├── app/                     The Android app (Expo SDK 54 / React Native 0.81)
├── fastlane/metadata/       Store listing text, icon, screenshots and per-version changelogs (F-Droid reads these)
├── fdroid/                  Our copy of the F-Droid build recipe and notes on submitting it
├── .github/workflows/       CI: lint, tests, APK build, on-device OCR test, releases
├── README.md                What the app is, for users
├── CONTRIBUTING.md          This file
├── AGENTS.md                Extra rules for automated contributors
├── SECURITY.md              How to report a security problem privately
├── NOTICE.md                Third-party code and data, with licenses
└── LICENSE                  GPL-3.0
```

### `app/`

| Path | What it is |
|---|---|
| `App.js` | The root: providers, the page list (`PAGES`) in swipe order, the bottom bar, onboarding gate, celebrations |
| `index.js` | Entry point that registers `App` |
| `app.config.js` | Expo config: app id, version, permissions (and the ones we block), build-time settings in `extra` |
| `version.json` | The release version. `versionCode` = major×1000 + minor×100 + patch (CI checks this) |
| `package.json`, `package-lock.json` | Dependencies. Also sets `expo.autolinking.android.buildFromSource` (see [Patched dependencies](#patched-dependencies)) |
| `patches/` | Changes to third-party packages, applied by `patch-package` on install |
| `plugins/withReleaseSigning.js` | Expo config plugin: signs release builds from environment variables |
| `modules/label-ocr/` | Our native module: reads nutrition labels on the phone with Tesseract. Has its own README and an on-device test |
| `modules/app-handoff/` | Our native module: hands a sign-in from the old "Health Tracker" app to FossFitness, checking the receiving app's signing certificate |
| `scripts/` | Python scripts that build the food data (`build_usda_foods.py`, `build_menustat.py`) and the icons (`make_icons.py`) |
| `assets/` | Icons and splash image |
| `src/theme.js` | Colour palettes, spacing and type sizes |
| `src/screens/` | One file per page or full-screen view |
| `src/components/` | Pieces shared between screens |
| `src/lib/` | Plain JavaScript logic, no React. Almost all tests live here |
| `src/state/` | App state: the store, the reducer, defaults, and the server connection |

### `app/src/screens/`

| File | Page |
|---|---|
| `TodayScreen.js` | Today: rings, daily goals and the to-do list (open items first, done ones struck through) |
| `NutritionScreen.js` | Nutrition: calories and macros, water and fasting cards, the food log, saved meals |
| `FoodScreen.js` | Adding food: search, portions, custom foods, label scanning (`FoodPicker`, `PortionEditor`, `CustomFoodForm`) |
| `NutritionFactsView.js` | A full Nutrition Facts label for a day or a 7-day average |
| `WaterScreen.js`, `FastingScreen.js` | Water and fasting detail pages |
| `MoveScreen.js`, `WorkoutPlanView.js` | Train: today's activity, the plan, exercise logging |
| `ProgressScreen.js` | Progress: weight chart and history, streaks, health trackers |
| `SocialScreen.js`, `QuestsScreen.js`, `ChatScreen.js` | Social: quests, medals, chat, compare, notes |
| `SettingsScreen.js` | Settings: a menu of sections, each its own page |
| `OnboardingScreen.js` | First-run setup (also used by Settings → Re-enroll) |

### `app/src/components/`

| File | What it is |
|---|---|
| `ui.js` | Basic building blocks: cards, buttons, text fields, steppers, segmented controls. Use these before writing new ones |
| `Badges.js` | Medal artwork, the badge shelf, the badge sheet and the level-up celebration |
| `Meals.js` | Saved meals: the "My meals" card, the meal logger and editor |
| `HealthTrackers.js` | Optional trackers: medications and custom measurements |
| `FactsLabel.js`, `LineChart.js`, `WeekCard.js` | Display pieces |
| `MyExercises.js`, `ExerciseGoalEditor.js`, `ProfileFields.js` | Editors shared by Settings and onboarding |
| `AccountCard.js`, `InviteCard.js` | Signing in to a server, invite codes |
| `MoveToFossFitness.js` | Only shown in the old "Health Tracker" build: moves the person to FossFitness |

### `app/src/lib/`

Each file starts with a comment saying what it does. The main ones:

| File | Responsibility |
|---|---|
| `calc.js` | Core formulas: BMR, calorie and water goals. Inputs are always metric |
| `units.js` | Metric ↔ imperial, for display and input only |
| `dates.js` | Day keys (`YYYY-MM-DD` in the phone's local time) and date helpers |
| `foods.js`, `nutrients.js`, `facts.js` | The offline food database, nutrient list, Nutrition Facts totals |
| `meals.js` | Saved meals |
| `label.js`, `labelOcr.js` | Reading a nutrition label from OCR text; calling the native OCR module |
| `exercise.js`, `workoutPlan.js`, `workoutLog.js`, `exerciseGoal.js` | Activities (MET values), the exercise library and plans, workout logging, the exercise goal |
| `fasting.js`, `weighIn.js` | Fasting stages, when a weigh-in is due |
| `game.js` | XP, levels, streaks, quests and medals |
| `insights.js`, `overview.js`, `metrics.js`, `logStreaks.js` | Numbers and suggestions shown on Today and Progress |
| `health.js` | Optional health trackers (medications, measurements) |
| `schedule.js`, `notifications.js` | Planning reminders (pure) and scheduling them as local notifications |
| `healthConnect.js`, `healthConnectMap.js` | Reading from Android Health Connect (read-only) and converting it |
| `sync.js` | What is sent to and merged from the server. Pure JavaScript, well tested |
| `api.js` | The tiny HTTP client for the server |
| `backup.js` | Export and import of backup files |
| `migration.js` | Moving people from the old "Health Tracker" app id to FossFitness |
| `themes.js` | Dark, light, follow-the-phone and timed modes |

### `app/src/state/`

| File | Responsibility |
|---|---|
| `defaults.js` | `DEFAULT_STATE`, `STATE_VERSION` and `hydrateState`, which deep-merges saved data over defaults |
| `reducer.js` | Every change to app data is an action handled here |
| `store.js` | `StoreProvider`: loads and saves state on the phone (AsyncStorage) |
| `hub.js` | `HubProvider`: account, sync, people, chat, update checks, celebrations |
| `hcSync.js` | Keeps Health Connect data fresh while the app is open |

## How the app works

### State and storage

All of a person's data is one state object (`DEFAULT_STATE` in `state/defaults.js` shows its shape). Screens read
it with `useStore()` and change it only by dispatching actions to `state/reducer.js`. No screen writes storage
directly.

`state/store.js` saves the state on the phone in AsyncStorage:

- `healthtracker:v2:core`: everything except the daily logs.
- `healthtracker:v2:days:YYYY-MM`: the daily logs, one key per month, so no single value grows too large. Only
  changed months are rewritten.
- `healthtracker:v2`: the older single-value format, still read if no `:core` key exists.

The key names keep the app's old name on purpose: renaming them would make updates lose data.

On load, `hydrateState()` merges the saved data over `DEFAULT_STATE`. That is how a new setting added in an update
gets a sensible value on phones that saved data before it existed.

Units: everything is **stored in metric** (kg, cm, ml, minutes). Conversion happens only when showing or reading
input (`lib/units.js`). Days are keyed by the local calendar date (`lib/dates.js`).

### The server (optional)

Group features and backup use a self-hosted server called HealthHub. It is a separate project (not yet public).
The app talks to it only through `lib/api.js`, from `state/hub.js`:

| Endpoint | Used for |
|---|---|
| `POST /api/register`, `/api/login`, `/api/logout` | Accounts |
| `POST /api/sync` | Two-way sync (see below) |
| `GET /api/friends`, `POST /api/chat` | People in the group, chat and notes |
| `POST /api/app/link`, `/api/handoff`, `/api/handoff/claim` | App updates and moving from the old app |

`lib/sync.js` decides what is sent: changed days and weigh-ins, plus the settings listed in `SETTINGS_KEYS`. The
server stores the settings object as a whole, so a new key added to `SETTINGS_KEYS` syncs and restores without a
server change. The server's admin can read synced data, and other members see only levels, streaks, XP, chat,
shared notes and the Compare view, never food logs. Keep it that way.

The app works fully without a server. Every server call must fail quietly (the person may be offline or not
signed in) and must never block the UI.

### Food data

`lib/usdaFoods.json` (USDA FoodData Central) and `lib/restaurantFoods.json` (MenuStat) are generated by the
scripts in `app/scripts/`. Don't edit them by hand. Change the script and regenerate, and say in the pull request
which source files you used. `lib/curatedMicros.json` fills in vitamins and minerals for common foods. Nutrition
is stored per 100 g (or 100 ml for drinks).

### Training

The exercise library and the suggested plans are in `lib/workoutPlan.js`. Calorie estimates use MET values from
the Compendium of Physical Activities (`lib/exercise.js`). New exercises need an id that never changes (ids are
stored in people's plans and logs), a body-part group and a MET value.

### The game layer

`lib/game.js` turns logs into XP, levels, streaks, daily quests and medals (`BADGE_FAMILIES`, seven metal tiers
each). Medals are computed from history, so changing a threshold changes medals people already have. Bump
`BADGE_VERSION` when you do, so the change is filed quietly instead of celebrated.

### Reminders

Notifications are local only (`lib/notifications.js`): `lib/schedule.js` turns state into a list of reminders,
which are scheduled on the phone. There is no push service and no token.

### Label scanning

`modules/label-ocr` runs Tesseract on the phone and returns text; `lib/label.js` turns the text into nutrition
values. The model file is checked in (see the module's README for its source and checksum). CI runs a real scan
of a sample label on an Android emulator.

### Build settings

Set as environment variables when running `expo prebuild` and Gradle.

| Variable | Default | Effect |
|---|---|---|
| `FF_DISTRIBUTION` | `github` | `fdroid` leaves out the in-app updater and builds an unsigned APK for F-Droid to sign |
| `FF_APP_ID` | `io.github.merlinlcb.fossfitness` | Android application id. `com.merlinlcb.healthtracker` builds the "Health Tracker (old)" bridge app used only to move old installs |
| `HT_DEFAULT_SERVER` | empty | Server suggested at sign-in |
| `BUILD_NUMBER` | from `version.json` | Overrides the version code |
| `HT_KEYSTORE_FILE`, `HT_KEYSTORE_PASSWORD`, `HT_KEY_ALIAS`, `HT_KEY_PASSWORD` | none | Release signing. Only the maintainer's CI has these |

## Rules that protect people's data

These matter more than anything else in this guide. A mistake here can wipe someone's months of history, and
because releases update phones automatically, it would reach everyone within minutes.

1. **Never rename or remove a stored field, and never change what it means.** Add a new field instead, give it a
   default in `DEFAULT_STATE`, and leave the old one readable. The same goes for ids (foods, exercises, medals,
   quests) and storage keys.
2. **New fields need defaults** so `hydrateState()` can fill them in for existing data. If a structural change
   is unavoidable, raise `STATE_VERSION` and add a tested conversion of the old shape.
3. **Old data must still load.** If you change anything about stored or synced data, add a test that loads data in
   the old shape and checks nothing is lost.
4. **Sync must stay compatible in both directions.** Phones and servers update at different times: a new app must
   work with an older server, and an older app must not break when a newer app has synced first.
5. **Metric in storage, local dates as day keys.** Don't store display units or UTC dates.
6. **Never log or send personal data** (food, weight, medications, chat) anywhere except the person's own server.

## Privacy, dependencies and F-Droid

- **Don't add network hosts.** No fonts, images, APIs or update checks from the internet. Everything ships in the APK.
- **Don't add permissions** without discussing it in an issue first. `app.config.js` blocks the ones we don't need.
- **New dependencies:** they must be free software with a GPL-3.0-compatible license, must not pull in Google
  services or trackers, and must build from source. Prefer a few lines of our own code over a new package. Add
  anything that is bundled to `NOTICE.md`.
- **F-Droid builds everything from source** and scans for binaries and non-free libraries. If you change the build
  (Gradle, Expo plugins, native modules, Node version), mention it in the pull request so the recipe in `fdroid/`
  can be checked. The F-Droid build runs with `FF_DISTRIBUTION=fdroid`, so code that depends on the in-app
  updater must check `inAppUpdates` in `extra`.

## Patched dependencies

`app/patches/` changes three packages. Each patch file name includes the exact version it applies to:

| Patch | Why |
|---|---|
| `expo-notifications+<version>.patch` | Removes Firebase Cloud Messaging. The app only uses local notifications; small stand-in classes keep the unused remote-push code compiling |
| `expo-application+<version>.patch` | Removes Google's Play Install Referrer library |
| `expo-modules-core+<version>.patch` | Backport of expo/expo#49634, so the camera and photo picker keep working after Android recreates the screen |

Expo normally ships prebuilt binary libraries, which would ignore these patches. `package.json` sets
`expo.autolinking.android.buildFromSource` to `[".*"]` so every Expo module is compiled from source instead.
Don't remove it.

**Upgrading one of these packages** means updating its patch: apply the old patch by hand to the new version, then
run `npx patch-package <name>` and delete the old patch file. If `npm ci` prints a patch error, the patch no
longer matches. Don't ignore it. A missing Firebase patch would put Google code back into the app and get it
removed from F-Droid. Upgrading the Expo SDK touches all three, so open an issue first.

## Writing code

- **Put logic in `src/lib/` as plain functions and test it there.** Screens and components should mostly arrange
  things and call into `lib`. This keeps the app testable without a phone.
- **Start each new file with a one-line comment** saying what it is for, like the existing files.
- **Use the building blocks in `components/ui.js` and the values in `theme.js`.** Every screen must work in both dark
  and light mode.
- **Write user-facing text in plain, friendly English.** Short sentences, no jargon, no blame ("Couldn't read the
  label. Try again in better light" rather than "OCR error"). Use the units the person chose.
- **Keep changes focused.** Don't reformat or reorganise code you aren't changing; it hides the real change from
  reviewers. The project has no automatic formatter, so match the surrounding style.
- **`npm run lint` must report no errors.**
- **Never commit** `app/android/`, `node_modules/`, keystores, `.env` files, real health data, or screenshots of
  real people's data. Test data uses made-up people.

## Tests and CI

```bash
cd app
npm test                          # all unit tests
npx jest src/lib/meals.test.js    # one file
npm run lint
```

Tests live next to the code as `src/**/*.test.js` and run in Node (no phone needed). Add or update tests with every
change to `src/lib/` or `src/state/`, and with every bug fix (a test that failed before the fix).

GitHub Actions (`.github/workflows/build.yml`) runs on every push and pull request:

1. **build:** checks `version.json`, installs with `npm ci` (which applies the patches), lints, runs the unit tests,
   generates the Android project and builds the release APK. The APK is attached to the run as an artifact, so you
   can install a pull request's build on a test phone.
2. **scanner-test:** builds the label-OCR module's instrumented test and reads a sample label on an Android 14
   emulator.
3. **release:** only for version tags, and only if both jobs above passed.

A pull request can only be merged when CI is green.

## Pull requests

1. Fork the repository (or make a branch if you have write access). Branch from `main` and give the branch a
   descriptive name, like `fix-water-goal-rounding`.
2. Make one change per pull request. Several unrelated fixes are easier to review as separate pull requests.
3. Fill in the pull request template: what changed, why, how you tested it, and whether it touches stored or
   synced data. Link the issue it fixes.
4. If it changes something visible, add a screenshot (made-up data only).
5. Don't change `app/version.json` or add changelog files; that's done at release time.

## How pull requests are reviewed

Every pull request is checked against this list. Contributors can use it to check their own work first.

- **Promises:** nothing breaks the [promises](#what-fossfitness-promises-its-users): no tracking, no Google, no new
  hosts or permissions, offline still works.
- **Data:** stored and synced data stays compatible ([rules](#rules-that-protect-peoples-data)), with a test if it's
  touched.
- **Correctness:** the change does what it says, edge cases are handled (empty logs, first day, imperial units,
  offline, no account), and the tests cover it.
- **Scope:** the diff contains only what the description says. Generated files, lockfile changes and patches are
  explained.
- **Dependencies:** any new or upgraded package is justified, compatibly licensed, built from source, and the
  patches still apply.
- **Wording and look:** text is plain and friendly, and screens work in dark and light mode and on small phones.
- **CI** is green.

Only maintainers merge, and only maintainers make releases.

## Automated contributors (bots and AI agents)

Automated contributions are welcome under stricter rules, because an automated change can be confidently wrong.
They are listed in [AGENTS.md](AGENTS.md). In short: automated contributors work on branches and open pull
requests labelled `automated`; they never push to `main`, merge, tag or release. Their pull requests are first
reviewed by an automated reviewer against the checklist above. Anything it can't verify with confidence goes to a
human maintainer, and a human maintainer always has the final say.

## Releases

Releases go to people's phones automatically: GitHub builds are offered by the in-app updater (through HealthHub),
and F-Droid picks up new tags on its own. So a release is only made from a green `main`.

**Patch releases are automatic.** When `main` has merged changes to the app (anything under `app/` except tests and
`app/scripts/`) that aren't released yet, and nothing else has merged for an hour, the FossFitness Bot opens a pull
request named `Release vX.Y.Z`. It raises the patch number in `app/version.json` and writes
`fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` from the **For the changelog** section of each merged
pull request ("Bug fixes and small improvements." if none has one). Once CI is green, the release pull request is
checked to contain exactly those two files, merged, and tagged `vX.Y.Z`. The tag builds and publishes the release.
To hold a release back, close that pull request. Changes that are only tests or docs never cause a release.

**Minor and major versions are made by a maintainer:**

1. Set the new version in `app/version.json` (`versionCode` = major×1000 + minor×100 + patch).
2. Add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`: a few plain sentences for users.
3. Commit, then tag `v<versionName>` (for example `v2.3.0`) and push the tag.

Either way, CI checks the tag matches `version.json`, builds and signs the APK, runs the on-device test, and
publishes a GitHub Release with `FossFitness.apk`.

The release signing key is held by the maintainer and lives only in the repository's CI secrets. Forks and pull
requests build with a debug key. The F-Droid build is signed by F-Droid.

The `fdroid/` folder keeps our copy of the F-Droid recipe. The live copy is in F-Droid's
[fdroiddata](https://gitlab.com/fdroid/fdroiddata) repository, and F-Droid's update checker adds new versions from
tags. Change the recipe only if the build itself changes.

## License

FossFitness is licensed under the GNU General Public License v3.0 or later. By contributing, you agree that your
contribution is licensed under the same terms. Third-party code and data are listed in [NOTICE.md](NOTICE.md).
