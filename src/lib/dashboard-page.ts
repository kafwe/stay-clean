import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getDashboardSnapshot } from '#/lib/dashboard'

export const weekSearchSchema = z.object({
  week: z.string().optional(),
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
    throw new Error(payload?.error ?? 'Request failed')
  }
}
