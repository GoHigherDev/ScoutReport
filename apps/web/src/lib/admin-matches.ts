import { FAN_TOKENS } from '@scoutreport/chain'
import { z } from 'zod'
import { MAX_POINTS_PER_CORRECT } from './admin-match-constants'
export { MAX_POINTS_PER_CORRECT, SEASON_ID } from './admin-match-constants'

export type AdminMatch = {
  id: string
  sport: 'football' | 'cs2'
  sides: { name: string; tokenKey: string | null }[]
  kickoff: string
  lockTime: string
  outcomes: string[]
  pointsForCorrect: number
  externalRef: string | null
  status: 'open' | 'settled' | 'voided'
  result: string | null
  voidReason: string | null
  locked: boolean
}

const london = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const localTime = (date: Date) => {
  const parts = Object.fromEntries(
    london.formatToParts(date).map(({ type, value }) => [type, value]),
  )
  return `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

// Reject both missing spring times and repeated autumn times rather than
// silently choosing an offset for an administrator's datetime-local input.
export function londonToUtc(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error('Invalid London date/time')
  }
  const wall = new Date(`${value}:00.000Z`)
  if (
    !Number.isFinite(wall.getTime()) ||
    wall.toISOString().slice(0, 16) !== value
  ) {
    throw new Error('Invalid London date/time')
  }
  const candidates = new Set<string>()
  for (const shift of [-86_400_000, 0, 86_400_000]) {
    const sample = new Date(wall.getTime() + shift)
    const offset = Date.parse(`${localTime(sample)}:00.000Z`) - sample.getTime()
    const candidate = new Date(wall.getTime() - offset)
    if (localTime(candidate) === value) candidates.add(candidate.toISOString())
  }
  if (candidates.size !== 1) {
    throw new Error(
      'Non-existent or ambiguous London date/time (DST transition)',
    )
  }
  return [...candidates][0]
}

const londonInput = z.string().refine(
  (value) => {
    try {
      londonToUtc(value)
      return true
    } catch {
      return false
    }
  },
  { message: 'Invalid or ambiguous London date/time' },
)

export const matchInputSchema = z
  .object({
    sport: z.enum(['football', 'cs2']),
    sides: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(200),
            tokenKey: z.string().nullable(),
          })
          .strict(),
      )
      .length(2),
    kickoff: londonInput,
    lockTime: londonInput.optional(),
    outcomes: z.array(z.string().trim().min(1).max(200)).min(2).max(3),
    pointsForCorrect: z.number().int().min(1).max(MAX_POINTS_PER_CORRECT),
    externalRef: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (new Set(input.outcomes).size !== input.outcomes.length) {
      context.addIssue({
        code: 'custom',
        path: ['outcomes'],
        message: 'Invalid request body',
      })
    }
    input.sides.forEach((side, index) => {
      if (
        side.tokenKey !== null &&
        !FAN_TOKENS.some(
          (token) =>
            token.key === side.tokenKey &&
            token.sport === (input.sport === 'cs2' ? 'esports' : 'football'),
        )
      ) {
        context.addIssue({
          code: 'custom',
          path: ['sides', index, 'tokenKey'],
          message: 'Invalid request body',
        })
      }
    })
    try {
      if (
        input.lockTime &&
        londonToUtc(input.lockTime) > londonToUtc(input.kickoff)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['lockTime'],
          message: 'Invalid request body',
        })
      }
    } catch {
      // Individual datetime fields report malformed input.
    }
  })

export type MatchInput = z.infer<typeof matchInputSchema>
