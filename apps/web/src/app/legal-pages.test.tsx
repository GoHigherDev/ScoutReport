import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LEGAL_DETAILS, NAMES } from '../copy/names'
import PrivacyPage, { dynamic as privacyDynamic } from './privacy/page'
import TermsPage, { dynamic as termsDynamic } from './terms/page'

afterEach(cleanup)

describe('static legal drafts', () => {
  it.each([PrivacyPage, TermsPage])(
    'shows shared details and the draft banner',
    (Page) => {
      render(<Page />)
      expect(screen.getByRole('status')).toHaveTextContent(NAMES.legal.draft)
      expect(screen.getByText(LEGAL_DETAILS.controller)).toBeInTheDocument()
      expect(screen.getByText(LEGAL_DETAILS.contact)).toBeInTheDocument()
      expect(screen.getByText(NAMES.legal.ageNotice)).toHaveTextContent(
        "For users 18 or over; we do not knowingly process children's data.",
      )
      expect(screen.getByText(NAMES.legal.revision)).toHaveTextContent(
        'Last updated: 14 October 2026 · Version: 0.3',
      )
      const text = screen.getByRole('main').textContent
      expect(text).not.toMatch(
        /SR-\d+|R-\d+|S-05|P-01|schema|DELETE \/api\/profile/,
      )
    },
  )

  it('uses static routes with no request-time data work', () => {
    expect(privacyDynamic).toBe('force-static')
    expect(termsDynamic).toBe('force-static')
  })

  it('covers Predict signatures, retention, erasure and the ICO complaint route', () => {
    render(<PrivacyPage />)
    expect(
      screen.getByText(NAMES.legal.privacySections[3].text),
    ).toHaveTextContent(
      'we delete your picks, prediction points, terms-acceptance and 18+ records, wallet-linked nonces and stored signatures, and pseudonymise your audit-log entries, which are kept.',
    )
    expect(
      screen.getByText(NAMES.legal.privacySections[1].text),
    ).toHaveTextContent(
      'Erasure deletes off-chain profile fields, picks, prediction points, terms-acceptance records and stored signatures;',
    )
    expect(
      screen.getByText((text) => text.includes(LEGAL_DETAILS.retention)),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: NAMES.legal.icoLink }),
    ).toHaveAttribute(
      'href',
      'https://ico.org.uk/make-a-complaint/data-protection-complaints/',
    )
  })

  it('covers the revised processing, retention, consent and rights wording', () => {
    render(<PrivacyPage />)
    const text = screen.getByRole('main').textContent
    for (const phrase of [
      'An append-only audit log records picks and signatures',
      'Predict aggregates are anonymised after 24 months.',
      'The terms-acceptance record contains your wallet address, the terms version, the UTC time, the country code where available and the country-check result.',
      'We also record your 18+ confirmation and its UTC time, not your date of birth.',
      'The country check is done on our server; raw IP is not stored.',
      'Reported RP is sent only with your consent.',
      'You can withdraw consent at any time by contacting the privacy contact.',
      'The RP Estimate panel uses your holdings only.',
      'It assumes this wallet is a Socios Wallet based on your declaration; that declaration is not verification.',
      'no solely automated decisions with legal or similarly significant effects',
      'Public Chiliz Chain records',
      'You have the right to object to processing',
      'A wallet signature is required',
      'signing in costs no gas and does not move funds',
    ]) {
      expect(text).toContain(phrase)
    }
    expect(text).not.toMatch(/never transmitted|not transmitted/)
  })

  it('separates reported RP from browser storage in the requested order', () => {
    const sections = NAMES.legal.privacySections
    const cookiesIndex = sections.findIndex(
      (section) => section.heading === 'Cookies and browser storage',
    )
    expect(sections[cookiesIndex + 1]).toEqual({
      heading: 'Reported RP and estimates',
      text: 'Reported RP is sent only with your consent. You can withdraw consent at any time by contacting the privacy contact. The RP Estimate panel uses your holdings only. It assumes this wallet is a Socios Wallet based on your declaration; that declaration is not verification.',
    })
    expect(sections[cookiesIndex].text).toContain(
      "If you declare a Socios Wallet, that choice is saved in this browser's local storage until you change it or clear site storage.",
    )
    expect(sections[cookiesIndex].text).toContain(
      'until you change it or clear site storage. Read caches last',
    )
    expect(sections[cookiesIndex].text).not.toContain(
      'Your Socios Wallet declaration is stored in your browser.',
    )
    expect(sections[cookiesIndex].text).not.toMatch(
      /Reported RP is sent|RP Estimate panel/,
    )
    render(<PrivacyPage />)
    expect(
      screen.getByRole('heading', { name: 'Reported RP and estimates' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(sections[cookiesIndex + 1].text),
    ).toBeInTheDocument()
  })

  it('includes independence and no-financial-advice terms', () => {
    render(<TermsPage />)
    expect(
      screen.getByText(NAMES.legal.termsSections[0].text),
    ).toHaveTextContent('not affiliated with Socios.com')
    expect(
      screen.getByText(NAMES.legal.termsSections[1].text),
    ).toHaveTextContent('not financial or investment advice')
    expect(screen.getByRole('main')).toHaveTextContent(
      'You must be 18 or over to use ScoutReport.',
    )
    expect(screen.getByRole('main')).toHaveTextContent(
      'When you accept the terms, we record your wallet address, the terms version, the UTC time and the country-check result.',
    )
    expect(screen.getByRole('main')).toHaveTextContent(
      'The IP country check is done on our server; raw IP is not stored.',
    )
  })

  it('shows the approved free-to-play banner and valueless, non-transferable points', () => {
    render(<TermsPage />)
    expect(screen.getByText(NAMES.predict.freeToPlayBanner)).toHaveTextContent(
      "Predict is free to play. You don't need CHZ, Fan Tokens or Reward Points. Prediction points have no cash value and can't be transferred or redeemed. No prizes are offered.",
    )
    expect(screen.getByRole('main')).toHaveTextContent(
      'No CHZ, Fan Tokens or Reward Points are required.',
    )
    expect(screen.getByRole('main')).toHaveTextContent(
      'Prediction points have no cash value, are non-transferable and cannot be redeemed.',
    )
    expect(screen.getByRole('main')).toHaveTextContent('No prizes are offered.')
  })
})
