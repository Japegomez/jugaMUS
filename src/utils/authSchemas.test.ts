import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  updatePasswordSchema,
} from '@/utils/authSchemas'

describe('authSchemas', () => {
  describe('loginSchema', () => {
    it('accepts valid credentials', () => {
      expect(loginSchema.safeParse({ email: 'a@b.com', password: 'secret' }).success).toBe(true)
    })

    it('rejects invalid email', () => {
      const result = loginSchema.safeParse({ email: 'bad', password: 'x' })
      expect(result.success).toBe(false)
    })
  })

  describe('registerSchema', () => {
    it('requires matching passwords and terms acceptance', () => {
      const ok = registerSchema.safeParse({
        displayName: 'Ana',
        email: 'a@b.com',
        password: 'password1',
        confirmPassword: 'password1',
        acceptTerms: true,
      })
      expect(ok.success).toBe(true)

      const mismatch = registerSchema.safeParse({
        displayName: 'Ana',
        email: 'a@b.com',
        password: 'password1',
        confirmPassword: 'other',
        acceptTerms: true,
      })
      expect(mismatch.success).toBe(false)

      const noTerms = registerSchema.safeParse({
        displayName: 'Ana',
        email: 'a@b.com',
        password: 'password1',
        confirmPassword: 'password1',
        acceptTerms: false,
      })
      expect(noTerms.success).toBe(false)
    })
  })

  describe('forgotPasswordSchema', () => {
    it('validates email', () => {
      expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true)
    })
  })

  describe('updatePasswordSchema', () => {
    it('requires matching passwords with min length', () => {
      expect(
        updatePasswordSchema.safeParse({
          password: '12345678',
          confirmPassword: '12345678',
        }).success
      ).toBe(true)

      expect(
        updatePasswordSchema.safeParse({
          password: 'short',
          confirmPassword: 'short',
        }).success
      ).toBe(false)
    })
  })
})
