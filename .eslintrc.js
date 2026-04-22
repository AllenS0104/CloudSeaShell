module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    'android/app/build/**',
    'miniprogram/**',
  ],
  overrides: [
    {
      files: ['android/app/src/main/assets/weather-cloud-forecast-app/**/*.js'],
      env: {
        browser: true,
        es2021: true,
      },
      globals: {
        CustomEvent: 'readonly',
        Notification: 'readonly',
      },
    },
    {
      files: ['android/app/src/main/assets/weather-cloud-forecast-app/sw.js'],
      env: {
        browser: true,
        serviceworker: true,
        es2021: true,
      },
    },
    {
      files: ['__tests__/calculations.test.js'],
      rules: {
        'no-new-func': 'off',
        'no-unused-vars': 'off',
      },
    },
    {
      files: ['__tests__/*.test.js'],
      rules: {
        'no-new-func': 'off',
        'no-unused-vars': 'off',
      },
    },
  ],
};
