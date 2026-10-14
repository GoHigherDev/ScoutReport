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
        'Last updated: 14 October 2026 · Version: 0.2',
      )
      const text = screen.getByRole('main').textContent
      expect(text).not.toMatch(/SR-\d+|S-05|P-01|schema|DELETE \/api\/profile/)
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
      'we delete your picks, terms-acceptance records and stored signatures, and pseudonymise your audit-log entries, which are kept.',
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
      'wallet address, terms version, UTC time, country-check result',
      'The IP country check is done on our server; raw IP is not stored.',
      'Reported RP is sent only with your consent, which you can withdraw',
      'The RP Estimate panel shows holdings only and assumes a Socios Wallet based on your declaration',
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
      'wallet address, terms version, UTC time, country-check result',
    )
    expect(screen.getByRole('main')).toHaveTextContent(
      'The IP country check is done on our server; raw IP is not stored.',
    )
  })
})
