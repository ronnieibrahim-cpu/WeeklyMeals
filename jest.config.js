/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // M2.5: engine test suite. Screens/stores aren't the coverage goal (per
  // MILESTONE-2.md), so only run tests under src/engine for now. M4.2 adds
  // src/data/import: normalize.ts's `inferProvides`/`unsupportedProvides`
  // are pure logic shared by the importer and scripts/validateRecipes.ts,
  // same rationale as the engine suite.
  // M4.7: src/stores/syncStore.test.ts is added as a narrow, deliberate
  // exception — the bug it guards against is a call-ordering regression
  // between two network functions that only the store wiring can reproduce;
  // pure merge logic is already covered exhaustively under src/engine. This
  // is not a general invitation to add store tests going forward.
  testMatch: [
    '<rootDir>/src/engine/**/*.test.ts',
    '<rootDir>/src/data/import/**/*.test.ts',
    '<rootDir>/src/stores/syncStore.test.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
