import { linkOptions } from '@tanstack/react-router'

export function plannerNavOptions(weekStart: string) {
  return {
    week: linkOptions({
      to: '/',
      search: (prev) => ({ ...prev, week: weekStart }),
    }),
    changes: linkOptions({
      to: '/review',
      search: (prev) => ({ ...prev, week: weekStart }),
    }),
    more: linkOptions({
      to: '/setup',
      search: (prev) => ({ ...prev, week: weekStart }),
    }),
  }
}