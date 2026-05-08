module.exports = {
  overrides: [
    {
      files: ['js/**/*.js'],
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
      files: ['sw.js'],
      env: {
        browser: true,
        serviceworker: true,
        es2022: true,
      },
    },
    {
      files: ['build.js', 'server.js'],
      env: {
        node: true,
        es2022: true,
      },
    },
  ],
};
