import { phoneE164Schema } from './validators'

describe('phoneE164Schema', () => {
  it('accepts a valid Spanish mobile number', () => {
    expect(phoneE164Schema.safeParse('+34612345678').success).toBe(true)
  })

  it('accepts other country codes within E.164 length', () => {
    expect(phoneE164Schema.safeParse('+14155552671').success).toBe(true)
  })

  it('rejects numbers without leading plus', () => {
    expect(phoneE164Schema.safeParse('34612345678').success).toBe(false)
  })

  it('rejects numbers that are too short', () => {
    expect(phoneE164Schema.safeParse('+123456').success).toBe(false)
  })

  it('rejects numbers starting with +0', () => {
    expect(phoneE164Schema.safeParse('+0123456789').success).toBe(false)
  })
})
