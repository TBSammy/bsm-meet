import type { Metadata } from 'next'
import './globals.css'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AnnouncerProvider } from '@/components/AnnouncerContext'

export const metadata: Metadata = {
  title: 'Brisbane Southside Masters SC Meet 2025',
  description: 'Brisbane Southside Masters Short Course Meet — Sleeman Sports Complex, Chandler',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex flex-col bg-white">
        <AnnouncerProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </AnnouncerProvider>
      </body>
    </html>
  )
}
