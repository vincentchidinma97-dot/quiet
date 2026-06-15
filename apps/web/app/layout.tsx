import type { Metadata } from 'next'
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google'
import { Providers }    from '@/components/Providers'
import { ThemeScript }  from '@/components/ThemeScript'
import '../styles/globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['SOFT', 'WONK'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})


export const metadata: Metadata = {
  title: 'quiet.',
  description: 'encrypted correspondence between wallets. live token intelligence in every thread.',
  openGraph: {
    title: 'quiet.',
    description: "the market is loud. your edge isn't.",
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="paper"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
