export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CardsClient } from './cards-client'

export default async function CardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cards } = await supabase
    .from('credit_cards')
    .select('*')
    .eq('user_id', user.id)
    .order('name')

  return <CardsClient initialCards={cards || []} userId={user.id} />
}
