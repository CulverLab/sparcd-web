import './globals.css'
import { Inter } from 'next/font/google'

import ResizeObserver from 'resize-observer-polyfill';

if (typeof window !== 'undefined') {
  global.ResizeObserver = ResizeObserver;
}

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata = {
  title: 'SPARCd',
  description: 'Scientific Photo Analysis for Research & Conservation database',
  icons: {
    icon: '/favicon.ico',
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body id="my-body" className={inter.className}>{children}</body>
    </html>
  )
}
