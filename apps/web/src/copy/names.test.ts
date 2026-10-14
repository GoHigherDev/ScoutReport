import { expect, it } from 'vitest'
import { NAMES } from './names'

it('uses the approved off-chain settlement confirmation wording', () => {
  expect(NAMES.admin.confirmHelp).toBe(
    'Check the match and result against an official source before you confirm. Settlement is final, so a settled match cannot be corrected or voided.',
  )
  expect(NAMES.admin).not.toHaveProperty('unavailable')
  expect(Object.values(NAMES.admin).join(' ')).not.toMatch(
    /Spicy|wallet batch/i,
  )
})

it('preserves the approved SIWE statement and sign-in error wording', () => {
  expect(NAMES.auth).toEqual({
    statement: 'Sign in to ScoutReport. This does not cost gas or move funds.',
    sessionRequired: 'A session is required',
    unexpectedError: 'An unexpected error occurred',
  })
})

it('uses the final approved SR-18 copy', () => {
  expect(NAMES.gas).toMatchObject({
    insufficient_gas:
      "You don't have enough CHZ to cover this transaction and its gas fee.",
    unknown: 'The transaction could not be completed. Please try again.',
    spicyExplanation:
      'Spicy testnet transactions need test CHZ for gas. Test CHZ has no value. You can request it from a faucet.',
    errors: {
      MatchLocked:
        'This match is locked, so predictions can no longer be changed.',
      AccessControlBadConfirmation:
        'The confirming account does not match this wallet.',
    },
  })
})

const bannedPhrases = [
  'buy',
  'cheapest',
  'cost per point',
  'best value',
  'earn up to',
  'yield',
  'APY',
  'guaranteed',
  'return',
]
const bannedCopy = new RegExp(`\\b(?:${bannedPhrases.join('|')})\\b`, 'i')

it.each(bannedPhrases)('detects banned panel wording: %s', (phrase) => {
  for (const variation of [
    phrase,
    phrase.toUpperCase(),
    phrase.toLowerCase(),
    [...phrase]
      .map((letter, index) =>
        index % 2 ? letter.toUpperCase() : letter.toLowerCase(),
      )
      .join(''),
  ]) {
    expect(`Panel: ${variation}.`).toMatch(bannedCopy)
  }
})

it('matches whole words, not the approved guarantee wording or substrings', () => {
  expect('guarantee buyer cheapestness yields returns').not.toMatch(bannedCopy)
})

it('keeps every RP panel copy string, including templates and all caveats, clean', () => {
  expect(NAMES.optimiserCopy.caveats).toHaveLength(4)
  const strings = [
    ...Object.values(NAMES.optimiserCopy.rpEstimate),
    ...NAMES.optimiserCopy.caveats,
    NAMES.wallet.empty,
  ]
  for (const text of strings) {
    expect(text).not.toMatch(bannedCopy)
  }
})

it('keeps all gas and transaction copy neutral', () => {
  const { errors, ...copy } = NAMES.gas
  for (const text of [...Object.values(copy), ...Object.values(errors)]) {
    expect(text).not.toMatch(bannedCopy)
  }
})
