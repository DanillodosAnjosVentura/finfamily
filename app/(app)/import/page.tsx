export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImportClient } from './import-client'

export default async function ImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: categories }, { data: creditCards }] = await Promise.all([
    supabase.from('categories').select('*').or(`user_id.is.null,user_id.eq.${user.id}`).order('name'),
    supabase.from('credit_cards').select('*').eq('user_id', user.id).order('name'),
  ])

  return <ImportClient categories={categories || []} creditCards={creditCards || []} userId={user.id} />
}
