import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook as rtlRenderHook, type RenderHookOptions } from '@testing-library/react'

import { createTestQueryClient } from './queryClientMock'

type Options<TProps> = RenderHookOptions<TProps> & {
  queryClient?: ReturnType<typeof createTestQueryClient>
}

/**
 * renderHook wrapped with QueryClientProvider (retries off).
 */
export function renderHookWithClient<TResult, TProps>(
  callback: (props: TProps) => TResult,
  options: Options<TProps> = {}
) {
  const queryClient = options.queryClient ?? createTestQueryClient()
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return {
    queryClient,
    ...rtlRenderHook(callback, {
      ...options,
      wrapper: Wrapper as React.ComponentType<{ children: React.ReactNode }>,
    }),
  }
}
