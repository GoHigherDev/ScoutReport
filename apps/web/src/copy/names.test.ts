import { expect, it } from 'vitest'
import { NAMES } from './names'

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
