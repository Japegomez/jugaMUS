/** @jest-environment jsdom */

import { renderHookWithClient } from '@/__test-utils__/renderHook'
import { useAuthStore } from '@/hooks/useAuth'
import { useExploreListsRealtimeSync } from '@/hooks/useExploreListsRealtimeSync'

const mockChannel = {
  on: jest.fn(function (this: typeof mockChannel) {
    return this
  }),
  subscribe: jest.fn(function (this: typeof mockChannel) {
    return this
  }),
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => mockChannel),
    removeChannel: jest.fn(async () => undefined),
  },
}))

jest.mock('@/lib/invalidateExploreCaches', () => ({
  invalidateAllExploreListQueries: jest.fn(),
  idsFromRealtimeRow: jest.fn(() => ({})),
}))

import { supabase } from '@/lib/supabase'

describe('useExploreListsRealtimeSync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: null })
  })

  it('does not subscribe without session user', () => {
    renderHookWithClient(() => useExploreListsRealtimeSync())
    expect(supabase.channel).not.toHaveBeenCalled()
  })

  it('subscribes to postgres changes when user is signed in', () => {
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })

    const { unmount } = renderHookWithClient(() => useExploreListsRealtimeSync())

    expect(supabase.channel).toHaveBeenCalledWith('explore-lists-sync:user-1')
    expect(mockChannel.on).toHaveBeenCalled()
    expect(mockChannel.subscribe).toHaveBeenCalled()

    unmount()
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel)
  })
})
