import { z } from 'zod'

export const apartmentSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(4),
  bookingIcalUrl: z.string().url().optional().or(z.literal('')).optional(),
  airbnbIcalUrl: z.string().url().optional().or(z.literal('')).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})

export const weekSchema = z.object({
  weekStart: z.string().optional(),
})

export const cleanerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .or(z.literal(''))
    .optional(),
})

export const cleanerUpdateSchema = z.object({
  name: z.string().trim().min(2).max(60),
})

export const manualSchema = z.object({
  label: z.string().min(2).optional(),
  apartmentId: z.string().optional(),
  taskDate: z.string().optional(),
  weekday: z.number().min(0).max(6).nullable().optional(),
  isRecurring: z.boolean().default(false),
  notes: z.string().optional(),
  weekStart: z.string().optional(),
})

export const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

export const quickEditSchema = z.object({
  weekStart: z.string().optional(),
  assignmentId: z.string().min(1),
  cleanerId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  taskDate: z.string().optional(),
})

export const deleteAssignmentSchema = z.object({
  weekStart: z.string().optional(),
  assignmentId: z.string().min(1),
})

export const loginSchema = z.object({
  password: z.string().min(1),
})

export function getFieldErrors<TField extends string>(
  error: z.ZodError,
): Partial<Record<TField, string>> {
  const fieldErrors = error.flatten().fieldErrors as Partial<Record<TField, string[] | undefined>>

  return Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([field, messages]) => [field, Array.isArray(messages) ? messages[0] : undefined])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  ) as Partial<Record<TField, string>>
}
