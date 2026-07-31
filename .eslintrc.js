module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    'android/app/build/**',
    'miniprogram/**',
    // Third-party bundles are shipped as-is and must not be linted.
    '**/vendor/**',
  ],
  overrides: [
    {
      files: ['web/js/**/*.js'],
      env: {
        browser: true,
        es2022: true,
      },
      globals: {
        Buffer: 'readonly',
        OffscreenCanvas: 'readonly',
      },
    },
    {
      files: ['web/sw.js'],
      env: {
        browser: true,
        serviceworker: true,
        es2022: true,
      },
    },
    {
      files: ['web/build.js', 'web/server.js', 'scripts/**/*.js', 'shared/design/build.js'],
      env: {
        node: true,
        es2022: true,
      },
    },
    {
      files: ['shared/core/**/*.js'],
      env: {
        browser: true,
        node: true,
        es2022: true,
      },
    },
    {
      files: ['android/app/src/main/assets/weather-cloud-forecast-app/**/*.js'],
      env: {
        browser: true,
        es2022: true,
      },
      globals: {
        CustomEvent: 'readonly',
        Notification: 'readonly',
        Buffer: 'readonly',
        OffscreenCanvas: 'readonly',
      },
    },
    {
      files: ['android/app/src/main/assets/weather-cloud-forecast-app/sw.js'],
      env: {
        browser: true,
        serviceworker: true,
        es2022: true,
      },
    },
    {
      files: ['__tests__/calculations.test.js'],
      env: {
        node: true,
      },
      rules: {
        'no-new-func': 'off',
        'no-unused-vars': 'off',
      },
    },
    {
      files: ['__tests__/*.test.js'],
      env: {
        node: true,
      },
      rules: {
        'no-new-func': 'off',
        'no-unused-vars': 'off',
      },
    },
  ],
};
