import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPluggyApiKey, createConnectToken } from '@/lib/pluggy'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { itemId } = await req.json().catch(() => ({}))

    const apiKey = await getPluggyApiKey()
    const connectToken = await createConnectToken(apiKey, itemId)

    return NextResponse.json({ connectToken })
  } catch (err) {
    console.error('Pluggy connect-token error:', err)
    return NextResponse.json({ error: 'Falha ao gerar token de conexão' }, { status: 500 })
  }
}
