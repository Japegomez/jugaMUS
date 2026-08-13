/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react'

import { useTurnstileCaptcha } from '@/hooks/useTurnstileCaptcha'

describe('useTurnstileCaptcha', () => {
  const prevKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY

  afterEach(() => {
    process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY = prevKey
  })

  it('resolves immediately when Turnstile is disabled', async () => {
    delete process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY
    const { result } = renderHook(() => useTurnstileCaptcha())
    expect(result.current.enabled).toBe(false)
    await expect(result.current.solve()).resolves.toEqual({ error: null })
    expect(result.current.visible).toBe(false)
  })

  it('opens on solve and resolves with the token', async () => {
    process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY = '0x4AAAA-test'
    const { result } = renderHook(() => useTurnstileCaptcha())

    let solved: ReturnType<typeof result.current.solve> | undefined
    act(() => {
      solved = result.current.solve()
    })
    expect(result.current.visible).toBe(true)

    act(() => {
      result.current.complete('cf-token')
    })
    await expect(solved).resolves.toEqual({ token: 'cf-token', error: null })
    expect(result.current.visible).toBe(false)
  })

  it('treats dismiss as cancelled without an error', async () => {
    process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY = '0x4AAAA-test'
    const { result } = renderHook(() => useTurnstileCaptcha())

    let solved: ReturnType<typeof result.current.solve> | undefined
    act(() => {
      solved = result.current.solve()
    })
    act(() => {
      result.current.cancel()
    })
    await expect(solved).resolves.toEqual({ error: null, cancelled: true })
  })
})
