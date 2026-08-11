/**
 * Chainable Supabase client mock for unit tests.
 * Supports patterns like: from().select().eq().single() and rpc().
 */

const CHAIN_METHODS = [
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
  'contains',
  'containedBy',
  'rangeGt',
  'rangeGte',
  'rangeLt',
  'rangeLte',
  'rangeAdjacent',
  'overlaps',
  'textSearch',
  'match',
  'not',
  'or',
  'filter',
  'order',
  'limit',
  'range',
  'abortSignal',
  'single',
  'maybeSingle',
  'csv',
  'geojson',
  'explain',
  'rollback',
  'returns',
] as const

export type MockQueryChain<T = unknown> = {
  then: PromiseLike<{ data: T; error: unknown }>['then']
  catch: Promise<{ data: T; error: unknown }>['catch']
} & Record<(typeof CHAIN_METHODS)[number], jest.Mock>

/**
 * Build a from() chain that resolves to `{ data, error }`.
 * Each chain method is a jest.fn() returning the same builder (spies for assertions).
 */
export function mockFromChain<T>(result: { data: T; error: unknown }): MockQueryChain<T> {
  const chain = {
    then: (
      onFulfilled?: ((value: { data: T; error: unknown }) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(result).catch(onRejected),
  } as MockQueryChain<T>

  for (const method of CHAIN_METHODS) {
    chain[method] = jest.fn(() => chain)
  }

  return chain
}

/** Default resolved result for from()/rpc() chains. */
export function createQueryResult<T>(data: T, error: unknown = null) {
  return { data, error }
}

export type SupabaseMock = {
  from: jest.Mock
  rpc: jest.Mock
  auth: {
    getSession: jest.Mock
    getUser: jest.Mock
    signInWithPassword: jest.Mock
    signUp: jest.Mock
    signOut: jest.Mock
    resetPasswordForEmail: jest.Mock
    updateUser: jest.Mock
    onAuthStateChange: jest.Mock
    exchangeCodeForSession: jest.Mock
    setSession: jest.Mock
    signInWithIdToken: jest.Mock
  }
  storage: {
    from: jest.Mock
  }
  channel: jest.Mock
  removeChannel: jest.Mock
  functions: {
    invoke: jest.Mock
  }
}

export function createSupabaseMock(overrides: Partial<SupabaseMock> = {}): SupabaseMock {
  const mock: SupabaseMock = {
    from: jest.fn(() => mockFromChain({ data: null, error: null })),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
      getUser: jest.fn(async () => ({ data: { user: null }, error: null })),
      signInWithPassword: jest.fn(async () => ({
        data: { session: null, user: null },
        error: null,
      })),
      signUp: jest.fn(async () => ({ data: { session: null, user: null }, error: null })),
      signOut: jest.fn(async () => ({ error: null })),
      resetPasswordForEmail: jest.fn(async () => ({ data: {}, error: null })),
      updateUser: jest.fn(async () => ({ data: { user: null }, error: null })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      exchangeCodeForSession: jest.fn(async () => ({ data: { session: null }, error: null })),
      setSession: jest.fn(async () => ({ data: { session: null }, error: null })),
      signInWithIdToken: jest.fn(async () => ({
        data: { session: null, user: null },
        error: null,
      })),
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(async () => ({ data: { path: 'avatars/x.png' }, error: null })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.com/x.png' } })),
        remove: jest.fn(async () => ({ data: null, error: null })),
      })),
    },
    channel: jest.fn(() => {
      const ch = {
        on: jest.fn(() => ch),
        subscribe: jest.fn(() => ch),
        unsubscribe: jest.fn(),
      }
      return ch
    }),
    removeChannel: jest.fn(),
    functions: {
      invoke: jest.fn(async () => ({ data: null, error: null })),
    },
    ...overrides,
  }
  return mock
}
