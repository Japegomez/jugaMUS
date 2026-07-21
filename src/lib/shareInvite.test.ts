import { buildInviteShareMessage } from './shareInvite'

describe('buildInviteShareMessage', () => {
  it('formats match share text with title, meta and url', () => {
    const text = buildInviteShareMessage({
      kind: 'match',
      title: 'Mus viernes',
      meta: 'Madrid · 21/07 20:00',
      url: 'https://jugamus.web.app/m/1',
    })
    expect(text).toContain('Mus viernes')
    expect(text).toContain('Madrid · 21/07 20:00')
    expect(text).toContain('https://jugamus.web.app/m/1')
    expect(text).toMatch(/partida/i)
  })

  it('formats tournament share without meta', () => {
    const text = buildInviteShareMessage({
      kind: 'tournament',
      title: 'Torneo peña',
      url: 'https://jugamus.web.app/t/9',
    })
    expect(text).toContain('Torneo peña')
    expect(text).toContain('https://jugamus.web.app/t/9')
    expect(text).toMatch(/torneo/i)
  })
})
