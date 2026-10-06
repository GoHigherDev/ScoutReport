import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import RootLayout from './layout'

describe('app shell', () => {
  it('renders brand navigation, wallet slot, and legal footer', () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <main>Page content</main>
      </RootLayout>,
    )

    expect(markup).toContain('aria-label="ScoutReport"')
    expect(markup).toContain('>Leaderboards</a>')
    expect(markup).toContain('>[OPTIMISER_NAME]</a>')
    expect(markup).toContain('>Connect wallet</button>')
    expect(markup).toContain('aria-label="Legal"')
    expect(markup).toContain(
      'ScoutReport is an independent project and is not affiliated with Socios.com or Chiliz.',
    )
  })
})
