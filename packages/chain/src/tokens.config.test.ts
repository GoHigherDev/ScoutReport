import { getAddress, zeroAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { FAN_TOKENS, validateTokenConfig } from './tokens.config.ts'

describe('official V2 Fan Token catalogue', () => {
  it('contains exactly the 81 approved tickers with unique Mainnet addresses', () => {
    const tickers =
      'ACM AFC ALA ALL AM APL ARG ASM ASR ATLAS ATM AVL BAHIA BAR BELG BENFICA BFC BUFC CAI CHVS CITY CPFC DAVIS DOJO DZG EFC ENDCEX FLU FOR GAL GALO GFK GOZ HASHTAG IBFK INTER ITA JDT JUV LEG LEV LUFC MENGO MFC MIBR NAP NAVI OG PERSIB PERSIJA PFL POR PSG QUINS RACING ROUSH RSO SACI SAFA SAM SAN SARRIES SAUBER SCCP SEVILLA SFA SFP SHARKS SPAIN SPFC SPURS STV TH TIGERS TRA UCH UFC VASCO VCF VERDAO YBO'.split(
        ' ',
      )
    expect(FAN_TOKENS).toHaveLength(81)
    expect(FAN_TOKENS.map((token) => token.key).sort()).toEqual(tickers.sort())
    expect(
      new Set(FAN_TOKENS.map((token) => token.addresses[88888])).size,
    ).toBe(81)
    expect(() => validateTokenConfig()).not.toThrow()
  })

  it.each(FAN_TOKENS)(
    '$key records checksummed Mainnet V2 data and provenance',
    (token) => {
      const address = token.addresses[88888]!
      expect(address).toBe(getAddress(address))
      expect(address).not.toBe(zeroAddress)
      expect(token.symbol).toBe(token.key)
      expect(token.expectedDecimals).toBe(18)
      expect(token.addresses[88882]).toBeUndefined()
      expect(token.sourceUrl).toBe(
        'https://docs.chiliz.com/quick-start/token-contract-addresses',
      )
      expect(token.retrievedAt).toBe('2026-10-13')
    },
  )

  it('uses the approved sport mapping, including other for Davis Cup', () => {
    const nonFootball = {
      esports: ['ALL', 'DOJO', 'ENDCEX', 'MIBR', 'NAVI', 'OG', 'TH'],
      motorsport: ['AM', 'ROUSH', 'SAUBER'],
      mma: ['PFL', 'UFC'],
      rugby: ['QUINS', 'SARRIES', 'SFP', 'SHARKS', 'TIGERS'],
      other: ['DAVIS'],
    }
    for (const [sport, tickers] of Object.entries(nonFootball)) {
      expect(
        FAN_TOKENS.filter((token) => token.sport === sport)
          .map((token) => token.key)
          .sort(),
      ).toEqual(tickers.sort())
    }
    const otherTickers = new Set(Object.values(nonFootball).flat())
    expect(
      FAN_TOKENS.filter((token) => !otherTickers.has(token.key)).every(
        (token) => token.sport === 'football',
      ),
    ).toBe(true)
  })

  it('preserves NAVI and V2 AFC and includes the approved DOJO contract', () => {
    expect(FAN_TOKENS[0]).toMatchObject({
      key: 'NAVI',
      name: 'Natus Vincere',
      sport: 'esports',
      addresses: { 88888: '0x02728748392F1875682940681F4C936Fc683A68e' },
    })
    expect(FAN_TOKENS[1]).toMatchObject({
      key: 'AFC',
      name: 'Arsenal FC',
      sport: 'football',
      addresses: { 88888: '0x76088F3eD5dC655De9295D93868ec1EeC654A615' },
    })
    expect(FAN_TOKENS.find((token) => token.key === 'DOJO')).toMatchObject({
      symbol: 'DOJO',
      name: 'DOJO',
      sport: 'esports',
      addresses: { 88888: '0xb66D72efc5fD77A8F9Dc2E7c0f14304828956644' },
    })
    expect(
      FAN_TOKENS.some((token) =>
        token.addresses[88888]?.toLowerCase().startsWith('0x1d43'),
      ),
    ).toBe(false)
  })
})
