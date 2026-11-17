// Config plugin: sign release builds with the keystore given in env vars.
// HT_KEYSTORE_FILE, HT_KEYSTORE_PASSWORD, HT_KEY_ALIAS, HT_KEY_PASSWORD.
// Without them, F-Droid builds (FF_DISTRIBUTION=fdroid) stay unsigned, because F-Droid signs them itself;
// other builds fall back to the debug keystore (local dev builds).
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING = `
        release {
            if (System.getenv("HT_KEYSTORE_FILE")) {
                storeFile file(System.getenv("HT_KEYSTORE_FILE"))
                storePassword System.getenv("HT_KEYSTORE_PASSWORD")
                keyAlias System.getenv("HT_KEY_ALIAS")
                keyPassword System.getenv("HT_KEY_PASSWORD")
            }
        }`;

function applySigning(gradle) {
  if (gradle.includes('HT_KEYSTORE_FILE')) return gradle;

  const sc = gradle.indexOf('signingConfigs {');
  if (sc === -1) throw new Error('withReleaseSigning: signingConfigs block not found');
  const insertAt = sc + 'signingConfigs {'.length;
  gradle = gradle.slice(0, insertAt) + RELEASE_SIGNING + gradle.slice(insertAt);

  const bt = gradle.indexOf('buildTypes {');
  const rel = gradle.indexOf('release {', bt);
  const target = 'signingConfig signingConfigs.debug';
  const idx = gradle.indexOf(target, rel);
  if (bt === -1 || rel === -1 || idx === -1) throw new Error('withReleaseSigning: release buildType signing not found');
  return (
    gradle.slice(0, idx) +
    'signingConfig System.getenv("HT_KEYSTORE_FILE") ? signingConfigs.release : (System.getenv("FF_DISTRIBUTION") == "fdroid" ? null : signingConfigs.debug)' +
    gradle.slice(idx + target.length)
  );
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = applySigning(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.applySigning = applySigning;
