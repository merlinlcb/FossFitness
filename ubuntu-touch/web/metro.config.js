// Metro config used ONLY by ubuntu-touch/build.sh for the web export.
// It swaps Android-only native modules for small web stand-ins in ../web/stubs.
// The Android app in app/ never sees this file.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const stubs = process.env.FF_UT_STUBS;
const aliases = {
  'react-native-health-connect': path.join(stubs, 'health-connect.js'),
  'expo-notifications': path.join(stubs, 'notifications.js'),
};
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && aliases[moduleName]) {
    return { type: 'sourceFile', filePath: aliases[moduleName] };
  }
  // The app's label reader (src/lib/labelOcr.js) calls the Android-only Tesseract module;
  // on Ubuntu Touch use the WebAssembly Tesseract stand-in instead.
  if (platform === 'web' && /(^|\/)labelOcr$/.test(moduleName) && !context.originModulePath.includes('ut-stubs')) {
    return { type: 'sourceFile', filePath: path.join(stubs, 'label-ocr.js') };
  }
  return (upstream || context.resolveRequest)(context, moduleName, platform);
};
module.exports = config;
