import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getDashboardSnapshot } from '#/lib/dashboard'

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

function normalizeWeekSearch(value: string | undefined) {
  if (!value || !isoDatePattern.test(value)) {
    return undefined
  }

  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  return parsed.toISOString().slice(0, 10) === value ? value : undefined
}

export const weekSearchSchema = z.object({
  week: z.preprocess(
    (value) => (typeof value === 'string' ? value : undefined),
    z.string().optional().transform(normalizeWeekSearch),
  ),
})

export const loadDashboard = createServerFn({ method: 'GET' })
  .inputValidator((data: { weekStart?: string }) => data)
  .handler(({ data }) => getDashboardSnapshot(data.weekStart))

export async function postJson(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? 'Something went wrong. Please try again.')
  }
}
