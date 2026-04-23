import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LocalNow',
  description: '여행 중 실시간 현지 가이드 매칭 플랫폼',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className="dark">
      <body className="bg-neutral-950 text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}
