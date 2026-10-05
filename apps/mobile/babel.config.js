module.exports = {
  presets: ['module:@react-native/babel-preset'],
  env: {
    // Release bundles: drop console.log/info/debug so tokens, key lengths and user ids never reach logcat.
    // console.warn / console.error are kept for crash diagnostics.
    production: {
      plugins: [['transform-remove-console', { exclude: ['error', 'warn'] }]],
    },
  },
};
