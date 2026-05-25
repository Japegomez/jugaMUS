import { z } from 'zod'

/**
 * Valida formato E.164 genérico: + seguido de 7 a 15 dígitos.
 * Ref: ITU-T E.164 — máximo 15 dígitos incluyendo el prefijo de país.
 */
export const phoneE164Schema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Teléfono inválido. Formato esperado: +34612345678')

export type PhoneE164 = z.infer<typeof phoneE164Schema>
