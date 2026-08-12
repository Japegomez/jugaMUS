/** @jest-environment jsdom */

import { act, waitFor } from '@testing-library/react'

import { renderHookWithClient } from '@/__test-utils__/renderHook'
import { useAuthStore } from '@/hooks/useAuth'
import { profileQueryKey, useProfile, useUpdateProfile } from '@/hooks/useProfile'

jest.mock('@/services/profiles.service', () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
}))

import { getProfile, updateProfile } from '@/services/profiles.service'

const mockGetProfile = getProfile as jest.Mock
const mockUpdateProfile = updateProfile as jest.Mock

describe('profileQueryKey', () => {
  it('includes user id', () => {
    expect(profileQueryKey('u1')).toEqual(['profile', 'u1'])
  })
})

describe('useProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('loads profile for session user', async () => {
    const profile = { id: 'user-1', display_name: 'Ana' }
    mockGetProfile.mockResolvedValue(profile)

    const { result } = renderHookWithClient(() => useProfile())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(profile)
    expect(mockGetProfile).toHaveBeenCalledWith('user-1')
  })
})

describe('useUpdateProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('updates cache on success', async () => {
    const updated = { id: 'user-1', display_name: 'Nuevo nombre' }
    mockUpdateProfile.mockResolvedValue(updated)

    const { result, queryClient } = renderHookWithClient(() => useUpdateProfile())

    await act(async () => {
      await result.current.mutateAsync({ display_name: 'Nuevo nombre' })
    })

    expect(queryClient.getQueryData(profileQueryKey('user-1'))).toEqual(updated)
  })
})
