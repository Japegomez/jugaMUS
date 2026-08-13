import { z } from 'zod'

/** Matches Supabase Auth: min 8 + lowercase + uppercase + digits + symbols. */
export const AUTH_PASSWORD_HINT =
  'Mínimo 8 caracteres, con mayúscula, minúscula, un número y un símbolo.'

const authPasswordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[a-z]/, AUTH_PASSWORD_HINT)
  .regex(/[A-Z]/, AUTH_PASSWORD_HINT)
  .regex(/[0-9]/, AUTH_PASSWORD_HINT)
  .regex(/[^A-Za-z0-9]/, AUTH_PASSWORD_HINT)

export const loginSchema = z.object({
  email: z.string().trim().email('Email no válido'),
  password: z.string().min(1, 'Introduce la contraseña'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: z.string().trim().email('Email no válido'),
    password: authPasswordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v === true, {
      message: 'Debes aceptar los términos y la política de privacidad',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export type RegisterFormValues = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Email no válido'),
})

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

export const updatePasswordSchema = z
  .object({
    password: authPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Introduce tu contraseña actual'),
    password: authPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: 'La nueva contraseña debe ser distinta de la actual',
    path: ['password'],
  })

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
