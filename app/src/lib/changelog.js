// Release notes for Settings → What's new. app.config.js builds them into `extra.changelog` from the
// fastlane changelog files (one per versionCode); this turns that list into what the page shows.

// 2203 → "2.2.3" (versionCode = major×1000 + minor×100 + patch).
export function versionName(code) {
  const n = Math.floor(Number(code));
  return `${Math.floor(n / 1000)}.${Math.floor((n % 1000) / 100)}.${n % 100}`;
}

// Valid entries only, newest first, with the installed one marked.
export function changelogEntries(raw, releaseCode) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && Number.isInteger(e.versionCode) && e.versionCode > 0 && typeof e.text === 'string' && e.text.trim())
    .map((e) => ({
      versionCode: e.versionCode,
      version: versionName(e.versionCode),
      text: e.text.trim(),
      installed: e.versionCode === releaseCode,
    }))
    .sort((a, b) => b.versionCode - a.versionCode);
}
