// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { londonToUtc, matchInputSchema } from './admin-matches'

vi.mock('@scoutreport/chain', async () => {
  const { FAN_TOKENS } =
    await vi.importActual<typeof import('@scoutreport/chain')>(
      '@scoutreport/chain',
    )
  return { FAN_TOKENS }
})

const input = {
  sport: 'football',
  sides: [
    { name: 'Arsenal', tokenKey: 'AFC' },
    { name: 'Other', tokenKey: null },
  ],
  kickoff: '2026-07-10T20:00',
  outcomes: ['Home', 'Away'],
  pointsForCorrect: 12,
}

describe('London match input', () => {
  it('converts winter and summer London times into UTC', () => {
    expect(londonToUtc('2026-01-10T20:00')).toBe('2026-01-10T20:00:00.000Z')
    expect(londonToUtc('2026-07-10T20:00')).toBe('2026-07-10T19:00:00.000Z')
  })

  it.each([
    '2026-03-29T01:30',
    '2026-10-25T01:30',
    '2026-02-30T12:00',
    '2026-01-01T24:00',
    '2026-01-01T12:00Z',
    'not a date',
  ])('rejects invalid, missing or ambiguous local time %s', (value) => {
    expect(() => londonToUtc(value)).toThrow()
    expect(
      matchInputSchema.safeParse({ ...input, kickoff: value }).success,
    ).toBe(false)
  })

  it('accepts manual sides and known sport-appropriate tokens', () => {
    expect(matchInputSchema.parse(input)).toEqual(input)
    expect(
      matchInputSchema.safeParse({
        ...input,
        sport: 'cs2',
        sides: [
          { name: 'Natus Vincere', tokenKey: 'NAVI' },
          { name: 'Other', tokenKey: null },
        ],
      }).success,
    ).toBe(true)
    expect(
      matchInputSchema.safeParse({
        ...input,
        lockTime: input.kickoff,
        outcomes: ['Home', 'Draw', 'Away'],
      }).success,
    ).toBe(true)
  })

  it.each([
    { sport: 'esports' },
    { sides: [input.sides[0]] },
    { sides: [...input.sides, input.sides[0]] },
    { sides: [{ name: '', tokenKey: null }, input.sides[1]] },
    { sides: [{ name: 'Unknown', tokenKey: 'UNVERIFIED' }, input.sides[1]] },
    { sides: [{ name: 'Wrong sport', tokenKey: 'NAVI' }, input.sides[1]] },
    { sport: 'cs2', sides: input.sides },
    { outcomes: ['Home'] },
    { outcomes: ['Home', 'Home'] },
    { outcomes: ['Home', ' Home '] },
    { outcomes: ['Home', 'Draw', 'Away', 'Other'] },
    { pointsForCorrect: undefined },
    { pointsForCorrect: 0 },
    { pointsForCorrect: 101 },
    { pointsForCorrect: 1.5 },
    { lockTime: '2026-07-10T20:01' },
  ])('rejects invalid match configuration %j', (change) => {
    expect(matchInputSchema.safeParse({ ...input, ...change }).success).toBe(
      false,
    )
  })
})
