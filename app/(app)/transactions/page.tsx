export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TransactionsClient } from './transactions-client'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: transactions }, { data: categories }, { data: creditCards }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, category:categories(*), credit_card:credit_cards(*)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(200),
    supabase
      .from('categories')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order('name'),
    supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', user.id)
      .order('name'),
  ])

  return (
    <TransactionsClient
      initialTransactions={transactions || []}
      categories={categories || []}
      creditCards={creditCards || []}
      userId={user.id}
    />
  )
}
