import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().email('Email no válido'),
  password: z.string().min(1, 'Introduce la contraseña'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: z.string().trim().email('Email no válido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
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
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>
