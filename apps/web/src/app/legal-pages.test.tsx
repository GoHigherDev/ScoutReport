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
    ).toHaveTextContent('Erasure deletes stored picks and their signatures.')
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

  it('includes independence and no-financial-advice terms', () => {
    render(<TermsPage />)
    expect(
      screen.getByText(NAMES.legal.termsSections[0].text),
    ).toHaveTextContent('not affiliated with Socios.com')
    expect(
      screen.getByText(NAMES.legal.termsSections[1].text),
    ).toHaveTextContent('not financial or investment advice')
  })
})
