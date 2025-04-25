/* eslint-disable @typescript-eslint/no-var-requires */
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    [
      'react-native-reanimated/plugin',
      {
        processNestedWorklets: true
      }
    ],
    ['react-native-worklets-core/plugin'],
  ],
}
