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
    apple: '/icon-192.png',
  }
}
export const viewport = {
  width: 'device-width',
  initialScale: 1,
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0C234B" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .catch(function(err) {
                      console.error('Service worker registration failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body id="my-body" className={inter.className}>{children}</body>
    </html>
  )
}
