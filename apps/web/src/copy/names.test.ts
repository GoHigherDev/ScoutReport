import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, it } from 'vitest'
import { pickTypedData } from '../lib/predict'
import { NAMES } from './names'

it('keeps research and wallet-unavailable copy free of internal references', () => {
  expect(NAMES.optimiserCopy.earnRoutes.researchLink).toBe(
    'Research, route evidence and limitations',
  )
  expect(NAMES.optimiserCopy.earnRoutes.researchLink).not.toMatch(/R-\d+/)
  expect(NAMES.wallet.unavailable).toBe(
    'Wallet connection is unavailable. Please try again later.',
  )
  expect(NAMES.wallet.unavailable).not.toMatch(/NEXT_PUBLIC_/)
})

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
it('centralises Predict copy and its signing domain with the approved tab and retry wording', () => {
  expect(NAMES.predict.predictionsTab).toBe('My predictions')
  expect(NAMES.predict.rateLimited).toBe(
    'Too many requests. Wait a moment, then try again.',
  )
  expect(NAMES.predict.retryAfter).toBe('Seconds until you can try again')
  expect(NAMES.predict.signatureHelp).toMatch(/no funds are moved/i)
  expect(
    pickTypedData('https://scoutreport.test', 88882, {
      matchId: 'fixture',
      outcome: 'HOME',
      nonce: 'fixture',
    }).domain.name,
  ).toBe(NAMES.predict.signatureDomain)
  for (const value of Object.values(NAMES.predict)) {
    expect(typeof value).toBe('string')
    expect(value.trim()).not.toBe('')
  }
  for (const file of ['../wallet/predictions.tsx', '../app/predict/page.tsx']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    const inlineCopy: string[] = []
    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text))
        inlineCopy.push(node.text.trim())
      ts.forEachChild(node, visit)
    }
    visit(
      ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      ),
    )
    expect(inlineCopy, file).toEqual([])
  }
})
