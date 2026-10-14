import { keccak256, stringToHex } from 'viem'
import { NAMES } from '../copy/names'

export const pickTypes = {
  Pick: [
    { name: 'matchId', type: 'string' },
    { name: 'outcome', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
} as const

export function pickTypedData(
  origin: string,
  chainId: number,
  message: { matchId: string; outcome: string; nonce: string },
) {
  return {
    domain: {
      name: NAMES.predict.signatureDomain,
      version: '1',
      chainId,
      salt: keccak256(stringToHex(origin)),
    },
    types: pickTypes,
    primaryType: 'Pick' as const,
    message,
  }
}

export type PredictMatch = {
  id: string
  sport: 'football' | 'cs2'
  homeLabel: string
  awayLabel: string
  kickoff: string
  lockTime: string
  outcomes: string[]
  pointsForCorrect: number
  status: 'upcoming' | 'locked' | 'settled' | 'voided'
  result: string | null
  voidReason: string | null
  outcome?: string | null
}

export type MyPrediction = PredictMatch & {
  outcome: string
  points: number
}

export type PredictEligibility = {
  address: string
  chainId: number
  ageConfirmed: boolean
  termsAccepted: boolean
  termsVersion: string
  countryAllowed: boolean
}

export type PredictPage<T> = { matches: T[]; nextCursor: string | null }
