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
      action: z.enum(['reassign_day', 'reassign_apartment', 'unassign_day']),
      weekday: z.number().min(0).max(6).optional(),
      date: z.string().optional(),
      apartmentName: z.string().optional(),
      fromCleaner: z.string().optional(),
      toCleaner: z.string().optional(),
    }),
  ),
})

function fallbackParse(message: string): ChatPatchProposal {
  const normalized = message.toLowerCase()
  const weekdays = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]
  const day = weekdays.find((weekday) => normalized.includes(weekday))
  const moveMatch = normalized.match(/move .* to (?<to>[\w\s]+)/i)
  const giveOffMatch = normalized.match(/give (?<from>[\w\s]+?) .* off/i)

  return {
    title: 'Manual reassignment suggestion',
    summary:
      'Created from the built-in parser because no OpenAI key is configured yet.',
    operations: [
      {
        action: 'reassign_day',
        weekday: day ? weekdays.indexOf(day) : undefined,
        fromCleaner: giveOffMatch?.groups?.from?.trim(),
        toCleaner: moveMatch?.groups?.to?.trim(),
      },
    ].filter((operation) => operation.weekday !== undefined) as ChatPatchProposal['operations'],
  }
}

export async function generateChatProposal(input: {
  message: string
  currentAssignments: ScheduleAssignment[]
}) {
  if (!env.OPENAI_API_KEY) {
    return fallbackParse(input.message)
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

  const result = await generateObject({
    model: openai(env.OPENAI_MODEL ?? 'gpt-4.1-mini'),
    schema: chatSchema,
    system:
      'Convert schedule-editing requests into structured operations only. Keep operations conservative and never invent cleaners or apartments not present in the provided schedule context.',
    prompt: `Schedule rows:\n${context}\n\nManager request:\n${input.message}`,
  })

  return result.object
}

export function applyChatProposal(input: {
  proposal: ChatPatchProposal
  assignments: ScheduleAssignment[]
}) {
  let nextAssignments = [...input.assignments]

  for (const operation of input.proposal.operations) {
    if (operation.action === 'reassign_day' && operation.weekday !== undefined) {
      nextAssignments = nextAssignments.map((assignment) => {
        if (
          weekdayIndex(assignment.taskDate) === operation.weekday &&
          (!operation.fromCleaner ||
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

    if (operation.action === 'unassign_day' && operation.weekday !== undefined) {
      nextAssignments = nextAssignments.map((assignment) => {
        if (weekdayIndex(assignment.taskDate) === operation.weekday) {
          return { ...assignment, cleanerName: null }
        }
        return assignment
      })
    }
  }

  return nextAssignments
}
