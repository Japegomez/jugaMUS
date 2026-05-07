import { z } from 'zod'

/**
 * Valida formato E.164 para España: +34 seguido de 9 dígitos.
 */
export const phoneE164Schema = z
  .string()
  .regex(/^\+34[6789]\d{8}$/, 'Teléfono inválido. Formato esperado: +34612345678')

export type PhoneE164 = z.infer<typeof phoneE164Schema>
