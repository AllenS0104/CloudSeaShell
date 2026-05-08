module.exports = {
  preset: 'react-native',
  collectCoverageFrom: [
    'shared/core/**/*.js',
    '!shared/core/ports/**', // 接口契约 noop
  ],
  coverageThreshold: {
    global: { statements: 80, lines: 80, functions: 75, branches: 70 },
  },
};
