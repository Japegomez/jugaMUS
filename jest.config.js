/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/*.test.ts?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/utils/**/*.ts',
    'src/lib/**/*.ts',
    'src/services/**/*.ts',
    'src/hooks/**/*.ts',
    '!**/*.d.ts',
    '!**/*.test.ts',
    '!**/*.test.tsx',
    // Pure config / SDK wiring — not unit-tested by design
    '!src/lib/supabase.ts',
    '!src/lib/sentry.ts',
    '!src/lib/posthog.ts',
    '!src/lib/queryClient.ts',
    '!src/lib/authStorage.ts',
    // Native WebBrowser / Linking OAuth flow — covered by device QA
    '!src/lib/oauth.ts',
    '!src/lib/orientationLock.ts',
    // Thin UI/native glue hooks — covered by manual QA / E2E later
    '!src/hooks/useHiddenStatusBar.ts',
    '!src/hooks/useScreenTopPadding.ts',
    '!src/hooks/useOrientationLock.ts',
    '!src/hooks/useNotifications.ts',
    '!src/hooks/useBackgroundSessionTimeout.ts',
    '!src/hooks/useAnalytics.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}
