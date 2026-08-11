# Testing guide — jugaMUS

## Philosophy

- **Characterization tests** cover existing critical logic (`services`, `hooks`, `utils`, `lib`).
- **Strict TDD** (red → green → refactor) applies to every new feature and bugfix going forward.
- Scope follows `REQUIREMENTS.md`: unit tests for business logic, not UI screens/components (except rare pure helpers).

## Red → green → refactor

1. Write a failing test in the colocated `*.test.ts` next to the module under test.
2. Implement the minimum production code to make it pass.
3. Refactor while keeping the suite green.
4. Do not commit with failing tests.

## Where tests live

| Area     | Path                             | Notes                                     |
| -------- | -------------------------------- | ----------------------------------------- |
| Utils    | `src/utils/*.test.ts`            | Pure helpers, validators, form builders   |
| Lib      | `src/lib/*.test.ts`              | Analytics, auth helpers, invites, storage |
| Services | `src/services/*.service.test.ts` | Supabase mocked via `__test-utils__`      |
| Hooks    | `src/hooks/*.test.ts`            | `renderHookWithClient` + service mocks    |

Skip unit-testing pure SDK wiring (`supabase.ts`, `sentry.ts`, `posthog.ts`, `queryClient.ts`) and thin native UI glue hooks (`useOrientationLock`, `useNotifications`, …).

## Test utilities

- [`src/__test-utils__/supabaseMock.ts`](../src/__test-utils__/supabaseMock.ts) — chainable `from()` / `rpc()` mock builder.
- [`src/__test-utils__/queryClientMock.ts`](../src/__test-utils__/queryClientMock.ts) — `QueryClient` with retries disabled.
- [`src/__test-utils__/renderHook.tsx`](../src/__test-utils__/renderHook.tsx) — `renderHook` wrapped in `QueryClientProvider`.

Example:

```ts
import { createSupabaseMock, mockFromChain } from '@/__test-utils__/supabaseMock'

const mockSupabase = createSupabaseMock()
jest.mock('@/lib/supabase', () => ({
  get supabase() {
    return mockSupabase
  },
}))

mockSupabase.from.mockReturnValue(mockFromChain({ data: { id: '1' }, error: null }))
```

## Commands

```bash
npm test                          # watch / local
npm run test:ci                   # CI: coverage + thresholds
npx jest path/to/file.test.ts     # single file
npx jest -t "mapResultRpcError"   # by test name
```

## Coverage gates

Configured in `jest.config.js` for `src/{utils,lib,services,hooks}` (with documented exclusions).

Global thresholds (approximate floor):

- Lines / statements / functions: **≥ 60%**
- Branches: **≥ 50%** (branch density is higher in large service files)

## Pre-commit

Husky runs `lint-staged`, which for staged `src/**/*.{ts,tsx}` files runs ESLint, Prettier, and `jest --passWithNoTests --findRelatedTests --ci`.
