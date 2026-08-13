import { createSupabaseMock, mockFromChain } from '@/__test-utils__/supabaseMock'

const mockSupabase = createSupabaseMock()

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async () => ({
    base64: 'aGVsbG8=',
    uri: 'file:///tmp.jpg',
  })),
  SaveFormat: { JPEG: 'jpeg' },
}))

jest.mock('@/lib/supabase', () => ({
  get supabase() {
    return mockSupabase
  },
}))

import {
  getProfile,
  getPublicProfile,
  getViewableUserProfile,
  updateProfile,
  uploadAvatar,
} from '@/services/profiles.service'

const ownProfile = {
  id: 'u1',
  display_name: 'Yo',
  phone_e164: '+34600000000',
  photo_url: null,
  city: 'Madrid',
  role: 'user',
  status: 'active',
  badge_showcase: [],
  notify_push: true,
  notify_on_join: true,
  notify_on_match_start: true,
  notify_on_match_edit: true,
  notify_on_match_cancel: true,
  notify_on_result: true,
  notify_on_reminder_24h: true,
  notify_on_reminder_2h: true,
  notify_on_reminder_in_progress: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('profiles.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.from.mockReset()
    mockSupabase.rpc.mockReset()
    mockSupabase.auth.getUser.mockReset()
  })

  describe('getProfile', () => {
    it('uses get_own_profile rpc when viewing own profile', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null,
      })
      mockSupabase.rpc.mockResolvedValue({ data: [ownProfile], error: null })

      const profile = await getProfile('u1')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_own_profile')
      expect(profile).toEqual(ownProfile)
    })

    it('throws when own profile rpc returns empty', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null,
      })
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })

      await expect(getProfile('u1')).rejects.toThrow('Perfil no encontrado')
    })

    it('queries profiles table for other users without phone or prefs', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'viewer' } },
        error: null,
      })
      const other = {
        id: 'u2',
        display_name: 'Otro',
        city: 'Barcelona',
        photo_url: null,
        badge_showcase: [],
        role: 'user',
        status: 'active',
        notify_push: true,
        notify_on_join: true,
        notify_on_match_start: true,
        notify_on_match_edit: true,
        notify_on_match_cancel: true,
        notify_on_result: true,
        notify_on_reminder_24h: true,
        notify_on_reminder_2h: true,
        notify_on_reminder_in_progress: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }
      mockSupabase.from.mockReturnValue(mockFromChain({ data: other, error: null }))

      const profile = await getProfile('u2')

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles')
      expect(profile).toEqual({
        id: 'u2',
        display_name: 'Otro',
        city: 'Barcelona',
        photo_url: null,
        badge_showcase: [],
        role: 'user',
        status: 'active',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      })
      expect(profile).not.toHaveProperty('phone_e164')
      expect(profile).not.toHaveProperty('notify_push')
    })

    it('throws on profiles query error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'viewer' } },
        error: null,
      })
      mockSupabase.from.mockReturnValue(
        mockFromChain({ data: null, error: { message: 'not found' } })
      )

      await expect(getProfile('u2')).rejects.toThrow('not found')
    })
  })

  describe('updateProfile', () => {
    it('updates and re-fetches profile', async () => {
      mockSupabase.from.mockReturnValue(mockFromChain({ data: null, error: null }))
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null,
      })
      mockSupabase.rpc.mockResolvedValue({
        data: [{ ...ownProfile, display_name: 'Nuevo' }],
        error: null,
      })

      const updated = await updateProfile('u1', { display_name: 'Nuevo' })

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles')
      expect(updated.display_name).toBe('Nuevo')
    })

    it('throws on update error', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({ data: null, error: { message: 'update failed' } })
      )

      await expect(updateProfile('u1', { display_name: 'X' })).rejects.toThrow('update failed')
    })
  })

  describe('getPublicProfile', () => {
    it('returns profile row on success', async () => {
      const publicRow = {
        id: 'u2',
        display_name: 'Publico',
        photo_url: null,
        city: 'Valencia',
      }
      mockSupabase.rpc.mockResolvedValue({ data: [publicRow], error: null })

      const profile = await getPublicProfile('u2')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_public_profile', {
        p_profile_id: 'u2',
      })
      expect(profile).toEqual(publicRow)
    })

    it('returns null on rpc error', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'denied' } })

      expect(await getPublicProfile('u2')).toBeNull()
    })

    it('returns null when empty', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })

      expect(await getPublicProfile('u2')).toBeNull()
    })
  })

  describe('getViewableUserProfile', () => {
    it('returns viewable profile on success', async () => {
      const viewable = {
        id: 'u2',
        display_name: 'Vista',
        city: 'Sevilla',
        phone_e164: null,
        photo_url: null,
        badge_showcase: ['first_win'],
      }
      mockSupabase.rpc.mockResolvedValue({ data: [viewable], error: null })

      const profile = await getViewableUserProfile('u2')

      expect(profile).toEqual(viewable)
    })

    it('throws on rpc error', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'rpc fail' } })

      await expect(getViewableUserProfile('u2')).rejects.toThrow('rpc fail')
    })

    it('returns null when empty', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })

      expect(await getViewableUserProfile('u2')).toBeNull()
    })
  })

  describe('uploadAvatar', () => {
    beforeEach(() => {
      mockSupabase.storage.from.mockReturnValue({
        upload: jest.fn(async () => ({ data: { path: 'u1.jpg' }, error: null })),
        getPublicUrl: jest.fn(() => ({
          data: { publicUrl: 'https://cdn.example/avatars/u1.jpg' },
        })),
        remove: jest.fn(async () => ({ data: null, error: null })),
      })
    })

    it('uploads compressed image and updates profile', async () => {
      mockSupabase.from.mockReturnValue(mockFromChain({ data: null, error: null }))

      const url = await uploadAvatar('u1', 'file:///photo.jpg', 'image/jpeg')

      expect(url).toMatch(/^https:\/\/cdn\.example\/avatars\/u1\.jpg\?t=\d+$/)
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('avatars')
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles')
    })

    it('rejects disallowed mime type', async () => {
      await expect(uploadAvatar('u1', 'file:///doc.pdf', 'application/pdf')).rejects.toThrow(
        'Formato de imagen no permitido'
      )
    })

    it('returns null when onlyIfEmpty and profile already has photo', async () => {
      mockSupabase.from.mockReturnValue(mockFromChain({ data: null, error: null }))

      const url = await uploadAvatar('u1', 'file:///photo.jpg', 'image/jpeg', { onlyIfEmpty: true })

      expect(url).toBeNull()
    })

    it('onlyIfEmpty updates when row wins conflict', async () => {
      mockSupabase.from.mockReturnValue(mockFromChain({ data: { id: 'u1' }, error: null }))

      const url = await uploadAvatar('u1', 'file:///photo.jpg', 'image/jpeg', { onlyIfEmpty: true })

      expect(url).toMatch(/^https:\/\/cdn\.example/)
    })

    it('throws on storage upload error', async () => {
      mockSupabase.storage.from.mockReturnValue({
        upload: jest.fn(async () => ({ data: null, error: { message: 'upload fail' } })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example/x.jpg' } })),
        remove: jest.fn(async () => ({ data: null, error: null })),
      })

      await expect(uploadAvatar('u1', 'file:///photo.jpg')).rejects.toThrow('upload fail')
    })
  })
})
