/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // M2.5: engine test suite. Screens/stores aren't the coverage goal (per
  // MILESTONE-2.md), so only run tests under src/engine for now. M4.2 adds
  // src/data/import: normalize.ts's `inferProvides`/`unsupportedProvides`
  // are pure logic shared by the importer and scripts/validateRecipes.ts,
  // same rationale as the engine suite.
  testMatch: ['<rootDir>/src/engine/**/*.test.ts', '<rootDir>/src/data/import/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
