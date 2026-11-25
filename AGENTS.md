# Rules for automated contributors

This file is for bots and AI coding agents working on FossFitness. Read [CONTRIBUTING.md](CONTRIBUTING.md)
first: it explains where everything lives and the rules every contributor follows. The rules below are extra,
because an automated change can be confidently wrong, and a release reaches people's phones within minutes.

## What you may and may not do

- **Do** work on a branch named `bot/<short-description>` and open a pull request against `main`.
- **Do** label the pull request `automated` and fill in every section of the pull request template.
- **Do** write **For the changelog** for app users, not developers: one or two plain sentences about what they'll
  notice, or `none`. Release notes are built from it automatically.
- **Never** push to `main`, merge a pull request, create or push tags, or create releases (patch releases
  are made automatically after merges; see "Releases" in CONTRIBUTING.md).
- **Never** edit `app/version.json`, `fastlane/metadata/android/en-US/changelogs/`, `.github/workflows/`,
  `fdroid/`, `LICENSE`, or the signing plugin (`app/plugins/withReleaseSigning.js`). Releases and the build
  pipeline are for human maintainers.
- **Never** edit generated files by hand: `app/src/lib/usdaFoods.json` and `app/src/lib/restaurantFoods.json`
  come from the scripts in `app/scripts/`.
- **Never** add network hosts, permissions, analytics, or Google/Firebase/Play libraries (see the promises in
  CONTRIBUTING.md).
- **Never** put secrets, IP addresses, server names, real people's names or real health data in code, tests,
  commits or pull request text. Test data uses made-up people.

## Scope

- One issue per pull request. Keep the diff to what the issue asks for. No drive-by refactoring or reformatting.
- Prefer small changes. If the work needs more than about 300 changed lines (not counting tests), stop and
  explain the plan in the issue instead.
- **Ask a human first** (comment on the issue and stop) before touching any of these:
  - stored or synced data: `app/src/state/`, `app/src/lib/sync.js`, `app/src/lib/backup.js`,
    `app/src/lib/migration.js`, storage keys, `DEFAULT_STATE`, `STATE_VERSION`
  - native code: `app/modules/`, `app/patches/`, `app/app.config.js`
  - dependencies: anything in `package.json` or `package-lock.json`
  - medal or XP rules in `app/src/lib/game.js` (they change medals people already earned)

## Before opening the pull request

Run these in `app/` and include the results in the pull request:

```bash
npm ci
npm run lint      # must report 0 errors
npm test          # must pass
```

- Add or update tests in `app/src/**/*.test.js` for any logic you change, and a failing-then-passing test for
  any bug fix.
- If you change dependencies (only after a human agreed), use npm 10 (`npx -y npm@10 install ...`) so the
  lockfile stays valid, and check that `npm ci` applies every patch in `app/patches/` without errors.
- Re-read your diff. Remove debugging code, unrelated changes and anything you can't explain.

## In the pull request description

- What you changed and why, in plain words, with the issue it closes.
- How you tested it: which tests you added, and the lint and test results.
- Whether it touches stored or synced data (it should say "no" unless a human agreed).
- Anything you are unsure about. Saying "I could not verify X" is much better than guessing.

## Review

Your pull request is reviewed first by an automated reviewer using the checklist in CONTRIBUTING.md. If it asks
for changes, push fixes to the same branch and reply to each point. If it can't verify something, a human
maintainer decides. Don't open a new pull request to get around a review.
