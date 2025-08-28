import { Inter } from 'next/font/google'
import './globals.css'
import { APP_CONFIG } from '../config'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: APP_CONFIG.tabTitle,
  description: APP_CONFIG.tabDescription,
  icons: {
    icon: APP_CONFIG.favicon
  }
}

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <head>
        {/* Favicon wird jetzt über metadata gesetzt */}
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
