import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'TightSpotHelper', template: '%s · TightSpotHelper' },
  description: 'On-demand expert help to fix anything — via live video session.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com'),
  icons: {
    icon: [
      { url: '/icon.svg?v=3', type: 'image/svg+xml' },
    ],
    shortcut: ['/icon.svg?v=3'],
    apple: ['/icon.svg?v=3'],
  },
  openGraph: {
    siteName: 'TightSpotHelper',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Tabler Icons — used across all portal navigation and components */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"
        />
        <link rel="icon" href="/icon.svg?v=3" type="image/svg+xml" />
        <link rel="shortcut icon" href="/icon.svg?v=3" />
      </head>
      <body>{children}</body>
    </html>
  )
}
