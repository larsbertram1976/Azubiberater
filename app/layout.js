import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Mölders Azubi Berater',
  description: 'Sprachassistent für Azubi-Beratung bei Mölders',
}

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <head>
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
