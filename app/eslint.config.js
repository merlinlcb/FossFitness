// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'scripts/*'],
  },
  {
    // Apostrophes inside <Text> are fine in React Native.
    rules: { 'react/no-unescaped-entities': 'off' },
  },
  {
    files: ['**/*.test.js'],
    languageOptions: { globals: { describe: 'readonly', test: 'readonly', expect: 'readonly' } },
  },
]);
