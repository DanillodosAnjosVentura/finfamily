'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Tag,
  Target,
  BarChart3,
  LogOut,
  Menu,
  X,
  Upload,
  CreditCard,
} from 'lucide-react'

export const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { href: '/import', label: 'Importar PDF', icon: Upload },
  { href: '/cards', label: 'Cartões', icon: CreditCard },
  { href: '/categories', label: 'Categorias', icon: Tag },
  { href: '/goals', label: 'Metas', icon: Target },
  { href: '/reports', label: 'Relatórios', icon: BarChart3 },
]

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            pathname === href
              ? 'bg-green-50 text-green-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          )}
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          {label}
        </Link>
      ))}
    </>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
    toast.success('Até logo!')
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col h-full flex-shrink-0">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <h1 className="font-bold text-gray-900 text-lg leading-tight">FinFamily</h1>
              <p className="text-xs text-gray-500">Controle Financeiro</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <span className="text-xl">💰</span>
          <span className="font-bold text-gray-900">FinFamily</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="relative w-72 bg-white flex flex-col h-full shadow-xl">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💰</span>
                <div>
                  <h1 className="font-bold text-gray-900 text-lg leading-tight">FinFamily</h1>
                  <p className="text-xs text-gray-500">Controle Financeiro</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            </nav>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
