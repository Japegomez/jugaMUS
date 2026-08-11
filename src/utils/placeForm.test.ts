import { z } from 'zod'

import { placePayload, refinePlaceRequired } from '@/utils/placeForm'

describe('placeForm', () => {
  describe('refinePlaceRequired', () => {
    it('requires place text when place_defined is true', () => {
      const schema = z
        .object({ place_defined: z.boolean(), place_text: z.string().optional() })
        .superRefine(refinePlaceRequired)

      const result = schema.safeParse({ place_defined: true, place_text: '  ' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('Introduce el nombre del lugar')
      }
    })

    it('passes when place is undefined by checkbox', () => {
      const schema = z
        .object({ place_defined: z.boolean(), place_text: z.string().optional() })
        .superRefine(refinePlaceRequired)

      expect(schema.safeParse({ place_defined: false, place_text: '' }).success).toBe(true)
    })
  })

  describe('placePayload', () => {
    it('clears place text when not defined', () => {
      expect(placePayload({ place_defined: false, place_text: 'Bar' })).toEqual({
        place_defined: false,
        place_text: null,
      })
    })

    it('trims place text when defined', () => {
      expect(placePayload({ place_defined: true, place_text: '  Café Central  ' })).toEqual({
        place_defined: true,
        place_text: 'Café Central',
      })
    })
  })
})
