import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPluggyApiKey, getItem } from '@/lib/pluggy'

// POST — salva um item após conexão bem-sucedida no widget
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { itemId } = await req.json()
    if (!itemId) return NextResponse.json({ error: 'itemId obrigatório' }, { status: 400 })

    const apiKey = await getPluggyApiKey()
    const item = await getItem(apiKey, itemId)

    const { error } = await supabase.from('pluggy_items').upsert({
      user_id: user.id,
      item_id: itemId,
      connector_name: item.connector?.name || 'Banco',
      connector_logo: item.connector?.imageUrl || null,
      status: item.status,
      last_synced_at: null,
    }, { onConflict: 'item_id' })

    if (error) throw error

    return NextResponse.json({ ok: true, connectorName: item.connector?.name })
  } catch (err) {
    console.error('Pluggy item save error:', err)
    return NextResponse.json({ error: 'Erro ao salvar conexão' }, { status: 500 })
  }
}

// DELETE — remove um item
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { itemId } = await req.json()

    const { error } = await supabase.from('pluggy_items')
      .delete()
      .eq('item_id', itemId)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao remover conexão' }, { status: 500 })
  }
}
