// Integration tests: real HTTP requests (supertest) against the Nest app and a
// real Postgres. Run with `pnpm backend test:int`.
module.exports = {
  moduleFileExtensions: ['js', 'mjs', 'json', 'ts', 'tsx'],
  rootDir: './',
  testRegex: '\\.int-spec\\.ts$',
  // better-auth and its dependencies are ESM-only, but Jest runs CommonJS, so
  // plain JS (node_modules included) is compiled to CommonJS with swc.
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.m?js$': ['@swc/jest', { module: { type: 'commonjs' } }],
  },
  transformIgnorePatterns: [],
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  globalSetup: '<rootDir>/src/test-int/global-setup.ts',
  setupFiles: ['<rootDir>/src/test-int/env.ts'],
  // One database shared by all files: run them one after another.
  // The console mailer prints whole HTML emails; keep the output readable.
  silent: true,
  maxWorkers: 1,
  testTimeout: 30000,
};
