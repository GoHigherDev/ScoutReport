import { LEGAL_DETAILS, NAMES } from '../../copy/names'
import { LegalNotice } from '../legal-notice'

export const dynamic = 'force-static'
export const metadata = { title: NAMES.legal.termsHeading }

export default function TermsPage() {
  return (
    <LegalNotice
      heading={NAMES.legal.termsHeading}
      sections={NAMES.legal.termsSections}
      details={LEGAL_DETAILS}
    >
      <p>{NAMES.predict.freeToPlayBanner}</p>
    </LegalNotice>
  )
}
