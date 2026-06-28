import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FinFamily - Controle Financeiro Familiar',
  description: 'Gerencie as finanças da sua família com facilidade',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className={`${geist.className} h-full`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
