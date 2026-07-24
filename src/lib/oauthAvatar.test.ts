import { resolveOAuthAvatarUrl, resolveOAuthAvatarUrlFromUser } from '@/lib/oauthAvatar'

describe('resolveOAuthAvatarUrl', () => {
  it('accepts Google avatar_url https links', () => {
    expect(
      resolveOAuthAvatarUrl({
        avatar_url: 'https://lh3.googleusercontent.com/a/ABC123=s96-c',
      })
    ).toBe('https://lh3.googleusercontent.com/a/ABC123=s96-c')
  })

  it('falls back to picture', () => {
    expect(
      resolveOAuthAvatarUrl({
        picture: 'https://lh3.googleusercontent.com/a/XYZ=s96-c',
      })
    ).toBe('https://lh3.googleusercontent.com/a/XYZ=s96-c')
  })

  it('rejects non-https and unknown hosts', () => {
    expect(resolveOAuthAvatarUrl({ avatar_url: 'http://lh3.googleusercontent.com/a/x' })).toBeNull()
    expect(resolveOAuthAvatarUrl({ avatar_url: 'https://evil.example.com/a.jpg' })).toBeNull()
    expect(
      resolveOAuthAvatarUrl({ avatar_url: 'https://evilgoogleusercontent.com/a.jpg' })
    ).toBeNull()
  })
})

describe('resolveOAuthAvatarUrlFromUser', () => {
  it('prefers Google identity_data over user_metadata', () => {
    expect(
      resolveOAuthAvatarUrlFromUser({
        user_metadata: { avatar_url: 'https://lh3.googleusercontent.com/a/meta' },
        identities: [
          {
            provider: 'google',
            identity_data: { picture: 'https://lh3.googleusercontent.com/a/identity' },
          },
        ],
      })
    ).toBe('https://lh3.googleusercontent.com/a/identity')
  })
})
