import { format, parseISO } from 'date-fns'
import { getTodayIsoInTimezone, isoInWeek, weekDates } from '#/lib/date'
import type { CleanerWeekAvailability, DashboardData, ScheduleDayGroup } from '#/lib/types'

export interface AnnotatedDayGroup {
  group: ScheduleDayGroup
  badges: string[]
  priority: number
  tone: 'default' | 'attention' | 'changed'
}

export interface WeekPageModel {
  todayIso: string
  activeGroups: AnnotatedDayGroup[]
  emptyGroups: AnnotatedDayGroup[]
  availableDates: string[]
  defaultOpenDay: string
  cleansLeft: number
  pendingReviewCount: number
  availabilityWeekLabel: string
  nextStepLabel: string
}

export function buildWeekPageModel(data: DashboardData): WeekPageModel {
  const todayIso = getTodayIsoInTimezone()
  const isCurrentWeek = isoInWeek(todayIso, data.weekStart)
  const changedDates = new Set(
    data.changeSets.flatMap((changeSet) => changeSet.payload.changes.map((change) => change.date)),
  )
  const reviewDates = new Set(data.manualReviews.map((item) => item.checkOut))

  const annotatedGroups: AnnotatedDayGroup[] = data.dayGroups.map((group) => {
    const badges: string[] = []
    let priority = 4
    let tone: 'default' | 'attention' | 'changed' = 'default'

    if (changedDates.has(group.date)) {
      badges.push('Review changes')
      priority = 0
      tone = 'changed'
    }

    if (reviewDates.has(group.date)) {
      badges.push('Check long stay')
      priority = 0
      tone = 'changed'
    }

    if (isCurrentWeek && group.date < todayIso && group.rows.length > 0) {
      badges.push('Past due')
      priority = Math.min(priority, 1)
      tone = tone === 'changed' ? 'changed' : 'attention'
    }

    if (group.date === todayIso) {
      priority = Math.min(priority, 2)
    }

    if (group.date > todayIso && group.rows.length > 0) {
      priority = Math.min(priority, 3)
    }

    if (group.rows.length === 0 && badges.length === 0) {
      priority = 5
    }

    return {
      group,
      badges,
      priority,
      tone,
    }
  })

  const activeGroups = annotatedGroups
    .filter((item) => item.group.rows.length > 0 || item.badges.length > 0)
    .sort((left, right) => {
      if (!isCurrentWeek) {
        return left.group.date.localeCompare(right.group.date)
      }

      if (left.priority === right.priority) {
        return left.group.date.localeCompare(right.group.date)
      }

      return left.priority - right.priority
    })

  const emptyGroups = annotatedGroups.filter(
    (item) => item.group.rows.length === 0 && item.badges.length === 0,
  )
  const availableDates = annotatedGroups.map((item) => item.group.date)
  const cleansLeft = activeGroups.reduce((total, item) => total + item.group.rows.length, 0)
  const defaultOpenDay = activeGroups.find((item) => !item.group.isEmpty)?.group.date ?? data.weekStart
  const pendingReviewCount = data.changeSets.length + data.manualReviews.length
  const availabilityWeekLabel = formatWeekLabelWithoutYear(data.weekStart)
  const nextStepLabel =
    pendingReviewCount > 0
      ? `Review ${pendingReviewCount} item${pendingReviewCount === 1 ? '' : 's'} before you confirm the week`
      : data.weekStatus === 'confirmed'
        ? 'Week confirmed and ready to share with the team.'
        : 'Everything looks good. Confirm the week when you are ready.'

  return {
    todayIso,
    activeGroups,
    emptyGroups,
    availableDates,
    defaultOpenDay,
    cleansLeft,
    pendingReviewCount,
    availabilityWeekLabel,
    nextStepLabel,
  }
}

export function formatWeekLabelWithoutYear(weekStartIso: string) {
  const [startIso, ...rest] = weekDates(weekStartIso)
  const endIso = rest.length ? rest[rest.length - 1] : startIso
  return `${format(parseISO(startIso), 'd MMM')} - ${format(parseISO(endIso), 'd MMM')}`
}

export function getAvailabilityPresentation(status: CleanerWeekAvailability['status']) {
  if (status === 'off') {
    return {
      tone: 'off' as const,
      shortLabel: 'Off all week',
      summary: 'Not scheduled this week.',
      tooltip: 'Off all week',
    }
  }

  if (status === 'partial') {
    return {
      tone: 'partial' as const,
      shortLabel: 'Partial week',
      summary: 'Available on some days this week.',
      tooltip: 'Partial week availability',
    }
  }

  return {
    tone: 'on' as const,
    shortLabel: 'Available all week',
    summary: 'Available every day this week.',
    tooltip: 'Available all week',
  }
}
