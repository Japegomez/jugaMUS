import { z } from 'zod'

/** Shared place fields for match/tournament create & edit forms. */
export const placeFormFields = {
  place_defined: z.boolean(),
  place_text: z
    .string()
    .trim()
    .max(150, 'Texto de lugar demasiado largo')
    .optional()
    .or(z.literal('')),
}

export type PlaceFormValues = {
  place_defined: boolean
  place_text?: string | null
}

/** Requires place name when defined, or «Lugar por definir» checked. */
export function refinePlaceRequired(data: PlaceFormValues, ctx: z.RefinementCtx): void {
  if (data.place_defined && !data.place_text?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Introduce el nombre del lugar o marca «Lugar por definir»',
      path: ['place_text'],
    })
  }
}

export function placePayload(values: PlaceFormValues): {
  place_defined: boolean
  place_text: string | null
} {
  return {
    place_defined: values.place_defined,
    place_text: values.place_defined ? values.place_text?.trim() || null : null,
  }
}
