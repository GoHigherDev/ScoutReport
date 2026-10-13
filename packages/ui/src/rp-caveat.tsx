import { Banner } from './components'

export type RpCaveatProps = {
  caveat: string
  sociosWalletLine: string
  walletTypeNote?: string
  links: readonly { label: string; href: string }[]
}

export function RpCaveat({
  caveat,
  sociosWalletLine,
  walletTypeNote,
  links,
}: RpCaveatProps) {
  return (
    <Banner variant="warning" className="space-y-2 text-sm">
      <p>{caveat}</p>
      <p>{sociosWalletLine}</p>
      {walletTypeNote && <p>{walletTypeNote}</p>}
      <ul className="space-y-1">
        {links.map(({ label, href }) => (
          <li key={href}>
            <a
              className="rounded-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sr-warning"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </Banner>
  )
}
