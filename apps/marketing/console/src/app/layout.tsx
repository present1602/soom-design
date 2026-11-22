import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import './globals.css'

const noto = Noto_Sans_KR({ variable: '--font-noto-sans-kr', subsets: ['latin'], weight: ['400', '500', '700'], preload: false })

export const metadata: Metadata = {
  title: { default: '마케팅 콘솔', template: '%s · 마케팅 콘솔' },
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={noto.variable}>
      <body className="font-sans text-[14px] antialiased">{children}</body>
    </html>
  )
}
