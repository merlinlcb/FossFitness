// Version: CI sets BUILD_NUMBER (GitHub run number) so every APK installs as an update.
// Builds without it (F-Droid, local) use version.json, which is bumped for each tagged release.
const release = require('./version.json');
const buildNumber = parseInt(process.env.BUILD_NUMBER || String(release.versionCode), 10);
// Distribution: 'fdroid' builds leave out the in-app updater (F-Droid delivers updates itself).
const distribution = process.env.FF_DISTRIBUTION || 'github';
// Android application id. Phones that installed the app as "Health Tracker" keep updating when a
// build sets FF_APP_ID=com.merlinlcb.healthtracker.
const appId = process.env.FF_APP_ID || 'io.github.merlinlcb.fossfitness';
// Builds under the old id exist only to move those phones to FossFitness (see src/lib/migration.js),
// so they're named so people can tell the two apps apart while both are installed.
const legacy = appId === 'com.merlinlcb.healthtracker';
// The HealthHub server (github.com/merlinlcb/HealthHub) suggested at sign-in. Set at build time;
// empty means people type their server's address. Signed-in phones always use the server they signed in to.
const defaultServer = (process.env.HT_DEFAULT_SERVER || '').trim().replace(/\/+$/, '');

module.exports = {
  expo: {
    name: legacy ? 'Health Tracker (old)' : 'FossFitness',
    slug: 'fossfitness',
    // fossfitness://move?... hands a sign-in over from the old app (only FossFitness itself listens).
    ...(legacy ? {} : { scheme: 'fossfitness' }),
    version: process.env.BUILD_NUMBER ? `${release.versionName.split('.').slice(0, 2).join('.')}.${buildNumber}` : release.versionName,
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    android: {
      package: appId,
      versionCode: buildNumber,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#000000',
      },
      edgeToEdgeEnabled: true,
      // Health Connect: read-only access, asked for only when you connect in Settings → Health Connect.
      permissions: [
        'android.permission.health.READ_STEPS',
        'android.permission.health.READ_SLEEP',
        'android.permission.health.READ_WEIGHT',
        'android.permission.health.READ_EXERCISE',
        'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
      ],
      // Privacy: never let Android auto-upload app data to the cloud. Use Settings → Export backup instead.
      allowBackup: false,
      // Privacy: strip permissions the app doesn't need. INTERNET is allowed (since 2.1) only so the app can
      // sync with the HealthHub server the user signs in to; it talks to no other host.
      blockedPermissions: [
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_PHONE_STATE',
        'com.google.android.gms.permission.AD_ID',
        'com.google.android.c2dm.permission.RECEIVE',
      ],
    },
    extra: { defaultServer, distribution, inAppUpdates: distribution !== 'fdroid' },
    plugins: [
      [
        'expo-notifications',
        {
          color: '#10B981',
          icon: './assets/notification-icon.png',
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            // Keep the APK lean: only real phones (ARM). Emulators on x86 aren't needed.
            buildArchs: ['armeabi-v7a', 'arm64-v8a'],
            // Health Connect needs Android 8 (API 26) or newer.
            minSdkVersion: 26,
          },
        },
      ],
      [
        'expo-image-picker',
        {
          cameraPermission: 'FossFitness uses the camera to read nutrition labels.',
          photosPermission: 'FossFitness reads nutrition labels from photos you pick.',
          microphonePermission: false,
        },
      ],
      'react-native-health-connect',
      './plugins/withReleaseSigning',
    ],
  },
};
