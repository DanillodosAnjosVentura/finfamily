import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPluggyApiKey, getItem, getAccounts, getTransactions, mapPluggyCategory } from '@/lib/pluggy'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { itemId, daysBack = 90 } = await req.json()
    if (!itemId) return NextResponse.json({ error: 'itemId obrigatório' }, { status: 400 })

    // Verifica que o item pertence ao usuário
    const { data: pluggyItem } = await supabase
      .from('pluggy_items')
      .select('*')
      .eq('item_id', itemId)
      .eq('user_id', user.id)
      .single()
    if (!pluggyItem) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })

    // Busca categorias do usuário para mapear
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .or(`user_id.is.null,user_id.eq.${user.id}`)

    function findCategoryId(pluggyCategory: string | null): string | null {
      if (!categories) return null
      const mapped = mapPluggyCategory(pluggyCategory || '')
      return categories.find(c => c.name === mapped)?.id
        ?? categories.find(c => c.name === 'Outros')?.id
        ?? null
    }

    const apiKey = await getPluggyApiKey()

    // Verifica status do item
    const item = await getItem(apiKey, itemId)
    if (item.status === 'LOGIN_ERROR' || item.status === 'OUTDATED') {
      return NextResponse.json({ error: 'Reconexão necessária', status: item.status }, { status: 422 })
    }

    // Define janela de datas
    const to = new Date().toISOString().split('T')[0]
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - daysBack)
    const from = fromDate.toISOString().split('T')[0]

    // Busca contas e transações
    const accounts = await getAccounts(apiKey, itemId)
    let imported = 0
    let skipped = 0

    for (const account of accounts) {
      const transactions = await getTransactions(apiKey, account.id, from, to)

      for (const tx of transactions) {
        const amount = Math.abs(tx.amount)
        const type = tx.type === 'CREDIT' ? 'income' : 'expense'
        const date = tx.date.split('T')[0]
        const description = tx.description || tx.descriptionRaw || 'Sem descrição'

        const { error } = await supabase.from('transactions').insert({
          user_id: user.id,
          amount,
          type,
          description,
          date,
          category_id: findCategoryId(tx.category),
          recurring: false,
          pluggy_transaction_id: tx.id,
          billing_period: null,
          credit_card_id: null,
        })

        if (error) {
          // Código 23505 = unique violation (já importado)
          if (error.code === '23505') skipped++
          else console.error('Insert error:', error.message)
        } else {
          imported++
        }
      }
    }

    // Atualiza last_synced_at
    await supabase.from('pluggy_items')
      .update({ last_synced_at: new Date().toISOString(), status: item.status })
      .eq('item_id', itemId)

    return NextResponse.json({ imported, skipped, accounts: accounts.length })
  } catch (err) {
    console.error('Pluggy sync error:', err)
    return NextResponse.json({ error: 'Erro ao sincronizar' }, { status: 500 })
  }
}
