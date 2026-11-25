## What and why

<!-- What does this change, and why? Link the issue: "Closes #123". -->

## How I tested it

<!-- Tests added or changed, and anything you checked by hand (on which phone / Android version). -->

- [ ] `npm run lint` reports no errors
- [ ] `npm test` passes
- [ ] Screenshots attached for visible changes (made-up data only), checked in dark and light mode

## Checklist

- [ ] It keeps the app's promises: works offline, no tracking, no Google services, no new network hosts or permissions
- [ ] It does **not** change stored or synced data, **or** it adds defaults for new fields and a test that loads old data
- [ ] New or upgraded dependencies are explained below and the patches in `app/patches/` still apply (or: no dependency changes)
- [ ] The diff only contains this change (no unrelated reformatting)
- [ ] I did not edit `app/version.json`, changelogs, workflows or the F-Droid recipe

## Anything a reviewer should know

<!-- Things you're unsure about or couldn't test. Automated contributors: say what you could not verify. -->
