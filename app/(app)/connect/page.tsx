export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ConnectClient } from './connect-client'

export default async function ConnectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: items } = await supabase
    .from('pluggy_items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return <ConnectClient initialItems={items || []} />
}
