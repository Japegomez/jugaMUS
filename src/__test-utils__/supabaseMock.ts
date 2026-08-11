/**
 * Chainable Supabase client mock for unit tests.
 * Supports patterns like: from().select().eq().single() and rpc().
 */

type ThenableResult<T> = PromiseLike<{ data: T; error: unknown }> & Record<string, unknown>

function makeThenable<T>(result: { data: T; error: unknown }): ThenableResult<T> {
  const chain: ThenableResult<T> = {
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  } as ThenableResult<T>

  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') return chain.then.bind(chain)
      if (prop === 'catch') {
        return (onRejected: (reason: unknown) => unknown) =>
          Promise.resolve(result).catch(onRejected)
      }
      // Any further chain method returns the same thenable proxy
      return (..._args: unknown[]) => new Proxy({}, handler)
    },
  }

  return new Proxy(chain, handler) as ThenableResult<T>
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

/** Default resolved result for from()/rpc() chains. */
export function createQueryResult<T>(data: T, error: unknown = null) {
  return { data, error }
}

/**
 * Build a from() chain that resolves to `{ data, error }`.
 * All intermediate methods (select, eq, insert, update, delete, order, limit, single, maybeSingle…)
 * return the same thenable.
 */
export function mockFromChain<T>(result: { data: T; error: unknown }) {
  return makeThenable(result)
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
