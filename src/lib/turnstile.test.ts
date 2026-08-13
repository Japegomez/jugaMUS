import {
  buildTurnstileWidgetHtml,
  CAPTCHA_WIDGET_ERROR_MESSAGE,
  DEFAULT_TURNSTILE_HOSTNAME,
  getTurnstileHostname,
  getTurnstileHostedPageUrl,
  getTurnstileOrigin,
  getTurnstileSiteKey,
  getTurnstileWebViewSource,
  isTurnstileEnabled,
  parseTurnstileWebViewMessage,
  TURNSTILE_DEV_BASE_URL,
} from './turnstile'

describe('turnstile', () => {
  const prevKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY
  const prevHost = process.env.EXPO_PUBLIC_TURNSTILE_HOSTNAME
  const prevInvite = process.env.EXPO_PUBLIC_INVITE_HOST

  afterEach(() => {
    if (prevKey === undefined) delete process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY
    else process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY = prevKey
    if (prevHost === undefined) delete process.env.EXPO_PUBLIC_TURNSTILE_HOSTNAME
    else process.env.EXPO_PUBLIC_TURNSTILE_HOSTNAME = prevHost
    if (prevInvite === undefined) delete process.env.EXPO_PUBLIC_INVITE_HOST
    else process.env.EXPO_PUBLIC_INVITE_HOST = prevInvite
  })

  it('reads the public site key from env', () => {
    process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY = ' 0x4AAAA-test '
    expect(getTurnstileSiteKey()).toBe('0x4AAAA-test')
    expect(isTurnstileEnabled()).toBe(true)
  })

  it('is disabled when the site key is missing', () => {
    delete process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY
    expect(getTurnstileSiteKey()).toBe('')
    expect(isTurnstileEnabled()).toBe(false)
  })

  it('defaults native hostname to the invite host', () => {
    delete process.env.EXPO_PUBLIC_TURNSTILE_HOSTNAME
    delete process.env.EXPO_PUBLIC_INVITE_HOST
    expect(getTurnstileHostname()).toBe(DEFAULT_TURNSTILE_HOSTNAME)
    expect(getTurnstileOrigin()).toBe('https://musapp-731e1.web.app')
  })

  it('strips protocol from a custom hostname', () => {
    process.env.EXPO_PUBLIC_TURNSTILE_HOSTNAME = 'https://www.jugamus.app/'
    expect(getTurnstileHostname()).toBe('www.jugamus.app')
    expect(getTurnstileOrigin()).toBe('https://www.jugamus.app')
  })

  it('builds the hosted challenge URL with the site key', () => {
    process.env.EXPO_PUBLIC_TURNSTILE_HOSTNAME = 'musapp-731e1.web.app'
    expect(getTurnstileHostedPageUrl('0x4AAAA-test')).toBe(
      'https://musapp-731e1.web.app/turnstile.html?k=0x4AAAA-test'
    )
  })

  it('uses localhost HTML in development and a hosted page in release', () => {
    const htmlSource = getTurnstileWebViewSource('0x4AAAA-test', { dev: true })
    expect(htmlSource).toEqual({
      html: buildTurnstileWidgetHtml('0x4AAAA-test'),
      baseUrl: TURNSTILE_DEV_BASE_URL,
    })

    process.env.EXPO_PUBLIC_TURNSTILE_HOSTNAME = 'musapp-731e1.web.app'
    expect(getTurnstileWebViewSource('0x4AAAA-test', { dev: false })).toEqual({
      uri: 'https://musapp-731e1.web.app/turnstile.html?k=0x4AAAA-test',
    })
  })

  it('parses token, error and expired WebView messages', () => {
    expect(parseTurnstileWebViewMessage('{"type":"token","token":"cf-ok"}')).toEqual({
      type: 'token',
      token: 'cf-ok',
    })
    expect(parseTurnstileWebViewMessage('{"type":"error","code":"110200"}')).toEqual({
      type: 'error',
      code: '110200',
    })
    expect(parseTurnstileWebViewMessage('{"type":"expired"}')).toEqual({ type: 'expired' })
    expect(parseTurnstileWebViewMessage('not-json')).toBeNull()
    expect(parseTurnstileWebViewMessage('{"type":"token","token":""}')).toBeNull()
  })

  it('embeds the site key in widget HTML', () => {
    const html = buildTurnstileWidgetHtml('0x4AAAA-test')
    expect(html).toContain("sitekey: '0x4AAAA-test'")
    expect(html).toContain('challenges.cloudflare.com/turnstile')
  })

  it('exposes a user-facing widget error message', () => {
    expect(CAPTCHA_WIDGET_ERROR_MESSAGE).toContain('localhost')
  })
})
