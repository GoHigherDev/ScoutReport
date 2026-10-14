import { LEGAL_DETAILS, NAMES } from '../../copy/names'
import { LegalNotice } from '../legal-notice'

export const dynamic = 'force-static'
export const metadata = { title: NAMES.legal.privacyHeading }

export default function PrivacyPage() {
  return (
    <LegalNotice
      heading={NAMES.legal.privacyHeading}
      sections={NAMES.legal.privacySections}
      details={LEGAL_DETAILS}
    >
      <p>
        {NAMES.legal.predictRetention}: {LEGAL_DETAILS.retention}
      </p>
      <a
        className="underline"
        href="https://ico.org.uk/make-a-complaint/data-protection-complaints/"
      >
        {NAMES.legal.icoLink}
      </a>
    </LegalNotice>
  )
}
