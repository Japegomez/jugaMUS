import {
  changePasswordSchema,
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
    const base = {
      displayName: 'Ana',
      email: 'a@b.com',
      acceptTerms: true,
    }

    it('requires matching passwords and terms acceptance', () => {
      const ok = registerSchema.safeParse({
        ...base,
        password: 'Password1!',
        confirmPassword: 'Password1!',
      })
      expect(ok.success).toBe(true)

      const mismatch = registerSchema.safeParse({
        ...base,
        password: 'Password1!',
        confirmPassword: 'other',
      })
      expect(mismatch.success).toBe(false)

      const noTerms = registerSchema.safeParse({
        ...base,
        password: 'Password1!',
        confirmPassword: 'Password1!',
        acceptTerms: false,
      })
      expect(noTerms.success).toBe(false)
    })

    it('rejects passwords missing uppercase, lowercase, a digit or a symbol', () => {
      expect(
        registerSchema.safeParse({
          ...base,
          password: 'password1!',
          confirmPassword: 'password1!',
        }).success
      ).toBe(false)
      expect(
        registerSchema.safeParse({
          ...base,
          password: 'PASSWORD1!',
          confirmPassword: 'PASSWORD1!',
        }).success
      ).toBe(false)
      expect(
        registerSchema.safeParse({
          ...base,
          password: 'Password!',
          confirmPassword: 'Password!',
        }).success
      ).toBe(false)
      expect(
        registerSchema.safeParse({
          ...base,
          password: 'Password1',
          confirmPassword: 'Password1',
        }).success
      ).toBe(false)
    })
  })

  describe('forgotPasswordSchema', () => {
    it('validates email', () => {
      expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true)
    })
  })

  describe('updatePasswordSchema', () => {
    it('requires matching passwords that meet Auth complexity', () => {
      expect(
        updatePasswordSchema.safeParse({
          password: 'Password1!',
          confirmPassword: 'Password1!',
        }).success
      ).toBe(true)

      expect(
        updatePasswordSchema.safeParse({
          password: 'short',
          confirmPassword: 'short',
        }).success
      ).toBe(false)

      expect(
        updatePasswordSchema.safeParse({
          password: '12345678',
          confirmPassword: '12345678',
        }).success
      ).toBe(false)

      expect(
        updatePasswordSchema.safeParse({
          password: 'Password1!',
          confirmPassword: 'Password2!',
        }).success
      ).toBe(false)
    })
  })

  describe('changePasswordSchema', () => {
    const valid = {
      currentPassword: 'OldPass1!',
      password: 'NewPass1!',
      confirmPassword: 'NewPass1!',
    }

    it('requires current password and a different matching new password', () => {
      expect(changePasswordSchema.safeParse(valid).success).toBe(true)

      expect(changePasswordSchema.safeParse({ ...valid, currentPassword: '' }).success).toBe(false)

      expect(
        changePasswordSchema.safeParse({ ...valid, confirmPassword: 'OtherPass1' }).success
      ).toBe(false)

      expect(
        changePasswordSchema.safeParse({
          currentPassword: 'SamePass1!',
          password: 'SamePass1!',
          confirmPassword: 'SamePass1!',
        }).success
      ).toBe(false)
    })
  })
})
