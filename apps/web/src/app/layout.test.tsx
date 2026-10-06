import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import RootLayout, { metadata } from './layout'

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
    expect(markup).toContain('disabled="" aria-disabled="true"')
    expect(markup).toContain('>Connect wallet</button>')
    expect(markup).toContain('aria-label="Legal"')
    expect(markup).toContain(
      'ScoutReport is an independent project and is not affiliated with Socios.com or Chiliz.',
    )
  })

  it('sets an absolute base URL for Open Graph image metadata', () => {
    expect(metadata.metadataBase).toBeInstanceOf(URL)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    expect(metadata.openGraph?.images).toEqual([
      '/brand/scoutreport-x-avatar.png',
    ])
    expect(
      new URL('/brand/scoutreport-x-avatar.png', metadata.metadataBase as URL)
        .href,
    ).toBe(new URL('/brand/scoutreport-x-avatar.png', baseUrl).href)
  })
})
