import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Badge, Button } from '@scoutreport/ui'
import { NAMES } from '../copy/names'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  ),
  title: NAMES.product,
  description: NAMES.description,
  openGraph: {
    title: NAMES.product,
    description: NAMES.description,
    images: ['/brand/scoutreport-x-avatar.png'],
  },
  icons: {
    icon: [
      {
        url: '/brand/scoutreport-icon-32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/brand/scoutreport-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/brand/scoutreport-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: '/brand/scoutreport-apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-GB">
      <body className="flex min-h-screen flex-col">
        <header className="border-b border-sr-border bg-sr-bg">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link
              className="flex items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-sr-accent"
              href="/"
              aria-label={NAMES.product}
            >
              <Image
                src="/brand/scoutreport-x-avatar.png"
                alt=""
                width={40}
                height={40}
                priority
                className="rounded-md"
              />
              <span className="text-lg font-bold text-sr-text">
                {NAMES.product}
              </span>
            </Link>
            <nav
              aria-label={NAMES.mainNavigation}
              className="order-3 flex w-full flex-wrap gap-x-5 gap-y-2 text-sm text-sr-muted sm:order-none sm:w-auto"
            >
              <a className="rounded-sm hover:text-sr-text" href="#leaderboards">
                {NAMES.nav.leaderboards}
              </a>
              <a className="rounded-sm hover:text-sr-text" href="#predict">
                {NAMES.nav.predict}
              </a>
              <a className="rounded-sm hover:text-sr-text" href="#optimiser">
                {NAMES.optimiser}
              </a>
              <a className="rounded-sm hover:text-sr-text" href="#chat">
                {NAMES.nav.chat}
              </a>
            </nav>
            <div className="ml-auto flex items-center gap-2 sm:ml-0">
              <Badge variant="secondary">{NAMES.network}</Badge>
              <Button type="button" disabled aria-disabled="true">
                {NAMES.connectWallet}
              </Button>
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-sr-border bg-sr-bg">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-sr-muted sm:px-6">
            <nav aria-label={NAMES.legalNavigation} className="flex gap-5">
              <a className="hover:text-sr-text" href="/privacy">
                {NAMES.privacy}
              </a>
              <a className="hover:text-sr-text" href="/terms">
                {NAMES.terms}
              </a>
            </nav>
            <p>{NAMES.disclaimer}</p>
          </div>
        </footer>
      </body>
    </html>
  )
}
