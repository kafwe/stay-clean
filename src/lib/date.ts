import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from 'date-fns'

export function getWeekRange(input = new Date()) {
  const weekStart = startOfWeek(input, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(input, { weekStartsOn: 1 })

  return {
    weekStart,
    weekEnd,
    weekStartIso: toIsoDate(weekStart),
    weekEndIso: toIsoDate(weekEnd),
  }
}

export function getNextWeekStartIso(input = new Date()) {
  return toIsoDate(addDays(startOfWeek(input, { weekStartsOn: 1 }), 7))
}

export function shiftWeek(weekStartIso: string, amount: number) {
  return toIsoDate(addDays(parseISO(weekStartIso), amount * 7))
}

export function toIsoDate(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export function weekDates(weekStartIso: string) {
  const start = parseISO(weekStartIso)
  return eachDayOfInterval({ start, end: addDays(start, 6) }).map(toIsoDate)
}

export function formatWeekLabel(weekStartIso: string) {
  const start = parseISO(weekStartIso)
  const end = addDays(start, 6)
  return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`
}

export function formatDayLabel(dateIso: string) {
  return format(parseISO(dateIso), 'EEEE, d MMM')
}

export function weekdayIndex(dateIso: string) {
  const jsDay = parseISO(dateIso).getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

export function isoInWeek(dateIso: string, weekStartIso: string) {
  const { weekStart, weekEnd } = getWeekRange(parseISO(weekStartIso))
  return isWithinInterval(parseISO(dateIso), { start: weekStart, end: weekEnd })
}

export function getTodayIsoInTimezone(timeZone = 'Africa/Johannesburg') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    return toIsoDate(new Date())
  }

  return `${year}-${month}-${day}`
}
