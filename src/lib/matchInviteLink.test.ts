jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `jugamus://${path}`),
}))

jest.mock('@/lib/inviteLinks', () => ({
  buildMatchHttpsInviteUrl: jest.fn((id: string) => `https://jugamus.app/m/${id}`),
}))

import { buildMatchHttpsInviteUrl, buildMatchInviteUrl } from '@/lib/matchInviteLink'

describe('matchInviteLink', () => {
  it('builds custom scheme invite URL', () => {
    expect(buildMatchInviteUrl('m1')).toBe('jugamus://matches/m1')
  })

  it('re-exports HTTPS invite builder', () => {
    expect(buildMatchHttpsInviteUrl('m2')).toBe('https://jugamus.app/m/m2')
  })
})
