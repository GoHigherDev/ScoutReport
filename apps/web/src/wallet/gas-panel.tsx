import { getAppChain, spicy } from '@scoutreport/chain'
import { Banner } from '@scoutreport/ui'
import { NAMES, SPICY_FAUCETS } from '../copy/names'

export function InsufficientGasPanel() {
  const isSpicy = getAppChain().id === spicy.id
  return (
    <Banner variant="warning" className="space-y-2 text-sm">
      <h3 className="font-semibold">{NAMES.gas.panelHeading}</h3>
      <p>
        {isSpicy ? NAMES.gas.spicyExplanation : NAMES.gas.mainnetExplanation}
      </p>
      {isSpicy && (
        <ul className="space-y-1">
          {SPICY_FAUCETS.map(({ label, href }) => (
            <li key={href}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sr-warning"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Banner>
  )
}
