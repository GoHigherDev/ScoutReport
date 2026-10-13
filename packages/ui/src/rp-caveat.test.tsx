import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RpCaveat } from './index'

afterEach(cleanup)

describe('RpCaveat', () => {
  it.each([undefined, 'Account context'])(
    'renders a warning with optional context %s and safe source links',
    (walletTypeNote) => {
      const { asFragment } = render(
        <RpCaveat
          caveat="Caveat text"
          sociosWalletLine="App staking context"
          walletTypeNote={walletTypeNote}
          links={[{ label: 'Source', href: 'https://example.com/staking' }]}
        />,
      )
      expect(asFragment()).toMatchSnapshot()
      expect(screen.getByRole('status').className).toContain('text-sr-warning')
      const link = screen.getByRole('link', { name: 'Source' })
      expect(link.getAttribute('href')).toBe('https://example.com/staking')
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
      expect(screen.queryByText('Account context') !== null).toBe(
        walletTypeNote !== undefined,
      )
      expect(screen.queryByRole('button')).toBeNull()
    },
  )
})
