import { Banner } from '@scoutreport/ui'
import { NAMES } from '../copy/names'

export function LegalNotice({
  heading,
  sections,
  details,
  children,
}: {
  heading: string
  sections: readonly { heading: string; text: string }[]
  details: { controller: string; contact: string }
  children?: React.ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">{heading}</h1>
      <Banner variant="warning">{NAMES.legal.draft}</Banner>
      <dl className="space-y-2">
        <dt className="font-semibold">{NAMES.legal.controller}</dt>
        <dd>{details.controller}</dd>
        <dt className="font-semibold">{NAMES.legal.contact}</dt>
        <dd>{details.contact}</dd>
      </dl>
      {sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h2 className="text-xl font-semibold">{section.heading}</h2>
          <p className="text-sr-muted">{section.text}</p>
        </section>
      ))}
      {children}
    </main>
  )
}
