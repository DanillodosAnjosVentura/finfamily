export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  // Busca 2 meses para capturar compras do mês anterior que têm billing_period no mês atual
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const { data: allRecentTransactions } = await supabase
    .from('transactions')
    .select('*, category:categories(*)')
    .eq('user_id', user.id)
    .gte('date', twoMonthsAgo)
    .lte('date', lastDay)
    .order('date', { ascending: false })

  // Filtra pelo mês de competência (billing_period ou date)
  const transactions = (allRecentTransactions || []).filter(t => {
    const period = t.billing_period ?? t.date.substring(0, 7)
    return period === currentPeriod
  })

  // Últimos 6 meses para o gráfico de evolução
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0]
  const { data: historicalTransactions } = await supabase
    .from('transactions')
    .select('amount, type, date')
    .eq('user_id', user.id)
    .gte('date', sixMonthsAgo)

  return (
    <DashboardClient
      transactions={transactions || []}
      historicalTransactions={historicalTransactions || []}
    />
  )
}
