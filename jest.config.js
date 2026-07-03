/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // M2.5: engine test suite. Screens/stores aren't the coverage goal (per
  // MILESTONE-2.md), so only run tests under src/engine for now.
  testMatch: ['<rootDir>/src/engine/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
