/** Public Cloudflare Turnstile site key. The secret key never ships in the app. */
export function getTurnstileSiteKey(): string {
  return process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ''
}

/** Production native page host (Firebase invite hosting). No protocol. */
export const DEFAULT_TURNSTILE_HOSTNAME = 'musapp-731e1.web.app'

/** Expo Go / injected HTML origin. Add this hostname on the Turnstile widget. */
export const TURNSTILE_DEV_BASE_URL = 'http://localhost'

export function getTurnstileHostname(): string {
  const raw =
    process.env.EXPO_PUBLIC_TURNSTILE_HOSTNAME?.trim() ||
    process.env.EXPO_PUBLIC_INVITE_HOST?.trim() ||
    DEFAULT_TURNSTILE_HOSTNAME
  return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}

export function getTurnstileOrigin(): string {
  return `https://${getTurnstileHostname()}`
}

export function getTurnstileHostedPageUrl(siteKey: string): string {
  return `${getTurnstileOrigin()}/turnstile.html?k=${encodeURIComponent(siteKey)}`
}

export function getTurnstileWebViewSource(
  siteKey: string,
  options?: { dev?: boolean }
): { uri: string } | { html: string; baseUrl: string } {
  const isDev = options?.dev ?? (typeof __DEV__ !== 'undefined' && __DEV__)
  if (isDev) {
    return { html: buildTurnstileWidgetHtml(siteKey), baseUrl: TURNSTILE_DEV_BASE_URL }
  }
  return { uri: getTurnstileHostedPageUrl(siteKey) }
}

export function isTurnstileEnabled(): boolean {
  return getTurnstileSiteKey().length > 0
}

export const CAPTCHA_REQUIRED_MESSAGE = 'Completa la verificación de seguridad'
export const CAPTCHA_FAILED_MESSAGE = 'Completa la verificación de seguridad e inténtalo de nuevo.'
export const CAPTCHA_WIDGET_ERROR_MESSAGE =
  'No se pudo completar la verificación. Añade localhost (Expo Go) y musapp-731e1.web.app en el widget de Turnstile.'

export type TurnstileWebViewMessage =
  { type: 'token'; token: string } | { type: 'error'; code?: string } | { type: 'expired' }

export function parseTurnstileWebViewMessage(raw: string): TurnstileWebViewMessage | null {
  try {
    const parsed = JSON.parse(raw) as { type?: unknown; token?: unknown; code?: unknown }
    if (parsed.type === 'token' && typeof parsed.token === 'string' && parsed.token.length > 0) {
      return { type: 'token', token: parsed.token }
    }
    if (parsed.type === 'error') {
      return {
        type: 'error',
        code: typeof parsed.code === 'string' && parsed.code.length > 0 ? parsed.code : undefined,
      }
    }
    if (parsed.type === 'expired') {
      return { type: 'expired' }
    }
    return null
  } catch {
    return null
  }
}

function escapeForScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\u003c')
}

/** HTML loaded inside the native WebView. Origin must match the Turnstile hostname allowlist. */
export function buildTurnstileWidgetHtml(siteKey: string): string {
  const key = escapeForScriptString(siteKey)
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    html, body { margin: 0; padding: 16px 0; background: #fff; }
    #cf-turnstile { display: flex; justify-content: center; min-height: 65px; }
  </style>
  <script>
    function post(payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }
    window.onTurnstileLoad = function () {
      turnstile.render('#cf-turnstile', {
        sitekey: '${key}',
        theme: 'light',
        size: 'normal',
        language: 'es',
        callback: function (token) { post({ type: 'token', token: token }); },
        'error-callback': function (code) {
          post({ type: 'error', code: String(code || '') });
        },
        'expired-callback': function () { post({ type: 'expired' }); },
        'timeout-callback': function () { post({ type: 'expired' }); }
      });
    };
  </script>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad" async defer></script>
</head>
<body>
  <div id="cf-turnstile"></div>
</body>
</html>`
}
