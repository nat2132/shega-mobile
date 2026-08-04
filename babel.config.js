module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // `reanimated: false` disables the preset's auto-detection of the
      // worklets/reanimated babel plugin so we add it explicitly below.
      // We do NOT set `worklets: false` because Reanimated 4 ships its own
      // `react-native-reanimated/plugin` (a re-export of the worklets plugin);
      // forcing `reanimated: false` guarantees we pin exactly ONE plugin and
      // avoids the duplicate-plugin startup crash seen with Reanimated 4.
      ['babel-preset-expo', { reanimated: false, jsxRuntime: 'automatic' }],
    ],
    plugins: [
      // react-native-reanimated v4 / react-native-worklets.
      // This plugin MUST be the last one — it rewrites worklet functions so
      // they can run on the native UI thread. If it is missing, the first
      // Worklet (e.g. the very first `useAnimatedStyle`) throws at runtime
      // and the app closes without a JS error screen.
      'react-native-worklets/plugin',
    ],
  };
};