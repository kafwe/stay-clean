import { env } from 'cloudflare:workers'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import { weekdayIndex } from './date'
import type { ChatPatchProposal, ScheduleAssignment } from './types'

const chatSchema = z.object({
  title: z.string(),
  summary: z.string(),
  operations: z.array(
    z.object({
      action: z.enum([
        'reassign_day',
        'reassign_apartment',
        'set_day_off',
        'assign_unassigned_day',
      ]),
      weekday: z.number().min(0).max(6).optional(),
      date: z.string().optional(),
      apartmentName: z.string().optional(),
      fromCleaner: z.string().optional(),
      toCleaner: z.string().optional(),
    }),
  ),
})

function resolveName(value: string | undefined, validValues: string[]) {
  if (!value) {
    return undefined
  }

  const lowerValue = value.toLowerCase().trim()
  return (
    validValues.find((candidate) => candidate.toLowerCase() === lowerValue) ??
    validValues.find(
      (candidate) =>
        candidate.toLowerCase().includes(lowerValue) ||
        lowerValue.includes(candidate.toLowerCase()),
    )
  )
}

function fallbackParse(input: {
  message: string
  cleaners: string[]
  apartments: string[]
}): ChatPatchProposal {
  const normalized = input.message.toLowerCase()
  const cleanerByLower = new Map(input.cleaners.map((cleaner) => [cleaner.toLowerCase(), cleaner]))
  const apartmentByLower = new Map(input.apartments.map((apartment) => [apartment.toLowerCase(), apartment]))
  const weekdays = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]
  const day = weekdays.find((weekday) => normalized.includes(weekday)) ?? undefined
  const dayIndex = day ? weekdays.indexOf(day) : undefined
  const matchedCleaner =
    [...cleanerByLower.keys()].find((candidate) => normalized.includes(candidate)) ?? undefined
  const targetCleaner = matchedCleaner
    ? input.cleaners.find((cleaner) => cleaner.toLowerCase() !== matchedCleaner)
    : undefined
  const matchedApartment =
    [...apartmentByLower.keys()].find((candidate) => normalized.includes(candidate)) ?? undefined

  if (/day off|off/.test(normalized) && matchedCleaner && dayIndex !== undefined) {
    return {
      title: 'Day off suggestion',
      summary: 'Parsed with the built-in deterministic parser.',
      operations: [
        {
          action: 'set_day_off',
          weekday: dayIndex,
          fromCleaner: cleanerByLower.get(matchedCleaner),
          toCleaner: targetCleaner,
        },
      ],
    }
  }

  if (/move|reassign/.test(normalized) && matchedApartment && targetCleaner) {
    return {
      title: 'Apartment reassignment suggestion',
      summary: 'Parsed with the built-in deterministic parser.',
      operations: [
        {
          action: 'reassign_apartment',
          apartmentName: apartmentByLower.get(matchedApartment),
          toCleaner: targetCleaner,
        },
      ],
    }
  }

  return {
    title: 'Manual reassignment suggestion',
    summary: 'Created from the built-in parser because no OpenAI key is configured yet.',
    operations: [
      {
        action: 'reassign_day',
        weekday: dayIndex,
        fromCleaner: matchedCleaner ? cleanerByLower.get(matchedCleaner) : undefined,
        toCleaner: targetCleaner,
      },
    ].filter((operation) => operation.weekday !== undefined) as ChatPatchProposal['operations'],
  }
}

export async function generateChatProposal(input: {
  message: string
  currentAssignments: ScheduleAssignment[]
  cleaners: string[]
  apartments: string[]
  weekStart: string
}) {
  if (!env.OPENAI_API_KEY) {
    return fallbackParse(input)
  }

  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })
  const context = input.currentAssignments
    .map(
      (assignment) =>
        `${assignment.taskDate} | ${assignment.apartmentName} | ${
          assignment.cleanerName ?? 'Unassigned'
        }`,
    )
    .join('\n')
  const validDates = [...new Set(input.currentAssignments.map((assignment) => assignment.taskDate))]
  const validCleaners = input.cleaners.join(', ')
  const validApartments = input.apartments.join(', ')

  const result = await generateObject({
    model: openai(env.OPENAI_MODEL ?? 'gpt-4.1-mini'),
    schema: chatSchema,
    system:
      'Convert schedule-editing requests into structured operations only. Never invent cleaners, apartments, or dates outside the provided valid values. Prefer exact names from the valid lists.',
    prompt: `Week start: ${input.weekStart}

Valid cleaners: ${validCleaners}
Valid apartments: ${validApartments}
Valid dates: ${validDates.join(', ')}

Schedule rows:
${context}

Manager request:
${input.message}`,
  })

  return {
    ...result.object,
    operations: result.object.operations.map((operation) => ({
      ...operation,
      apartmentName: resolveName(operation.apartmentName, input.apartments),
      fromCleaner: resolveName(operation.fromCleaner, input.cleaners),
      toCleaner: resolveName(operation.toCleaner, input.cleaners),
    })),
  }
}

export function applyChatProposal(input: {
  proposal: ChatPatchProposal
  assignments: ScheduleAssignment[]
}) {
  let nextAssignments = [...input.assignments]

  for (const operation of input.proposal.operations) {
    if (
      (operation.action === 'reassign_day' ||
        operation.action === 'set_day_off' ||
        operation.action === 'assign_unassigned_day') &&
      (operation.weekday !== undefined || operation.date)
    ) {
      nextAssignments = nextAssignments.map((assignment) => {
        const matchesDate =
          operation.date ? assignment.taskDate === operation.date : weekdayIndex(assignment.taskDate) === operation.weekday
        if (
          matchesDate &&
          (operation.action === 'assign_unassigned_day'
            ? !assignment.cleanerName
            : !operation.fromCleaner ||
              assignment.cleanerName?.toLowerCase() === operation.fromCleaner.toLowerCase())
        ) {
          return {
            ...assignment,
            cleanerName: operation.toCleaner ?? null,
          }
        }
        return assignment
      })
    }

    if (operation.action === 'reassign_apartment' && operation.apartmentName) {
      nextAssignments = nextAssignments.map((assignment) => {
        if (assignment.apartmentName.toLowerCase() === operation.apartmentName?.toLowerCase()) {
          return {
            ...assignment,
            cleanerName: operation.toCleaner ?? null,
          }
        }
        return assignment
      })
    }
  }

  return nextAssignments
}
