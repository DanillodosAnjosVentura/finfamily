'use client'

import { useState } from 'react'
import { Transaction, Category, CreditCard, getBillingPeriod, effectivePeriod } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/format'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Pencil, CreditCard as CardIcon, CheckSquare, Square, X, Layers } from 'lucide-react'

interface Props {
  initialTransactions: Transaction[]
  categories: Category[]
  creditCards: CreditCard[]
  userId: string
}

const EMPTY_FORM = {
  amount: '',
  type: 'expense' as 'income' | 'expense',
  category_id: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  recurring: false,
  recurring_period: '' as '' | 'monthly' | 'yearly',
  credit_card_id: '',
  // parcelas
  launch_mode: 'single' as 'single' | 'installments' | 'recurring',
  installment_total: '',
  is_credit_card_installment: false,
}

export function TransactionsClient({ initialTransactions, categories, creditCards, userId }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filterType, setFilterType] = useState('all')
  const [filterMonth, setFilterMonth] = useState('')
  const [loading, setLoading] = useState(false)
  // Seleção múltipla
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchCategory, setBatchCategory] = useState('')
  const [batchCardId, setBatchCardId] = useState('__unchanged__')
  const [batchSaving, setBatchSaving] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const filteredCategories = categories.filter(c => c.type === form.type)

  const selectedCard = creditCards.find(c => c.id === form.credit_card_id)
  const computedBillingPeriod = selectedCard && form.date
    ? getBillingPeriod(form.date, selectedCard.closing_day, selectedCard.closing_inclusive)
    : null

  const filteredTransactions = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterMonth && effectivePeriod(t) !== filterMonth) return false
    return true
  })

  function openNew() { setForm(EMPTY_FORM); setEditingId(null); setOpen(true) }

  function openEdit(t: Transaction) {
    const launch_mode = t.installment_total ? 'installments' : t.recurring ? 'recurring' : 'single'
    setForm({
      amount: String(t.amount),
      type: t.type,
      category_id: t.category_id || '',
      description: t.description || '',
      date: t.date,
      recurring: t.recurring,
      recurring_period: t.recurring_period || '',
      credit_card_id: t.credit_card_id || '',
      launch_mode,
      installment_total: t.installment_total ? String(t.installment_total) : '',
      is_credit_card_installment: t.is_credit_card_installment || false,
    })
    setEditingId(t.id)
    setOpen(true)
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filteredTransactions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredTransactions.map(t => t.id)))
    }
  }

  function exitSelecting() { setSelecting(false); setSelected(new Set()) }

  async function handleBatchSave() {
    if (selected.size === 0) return
    if (!batchCategory && batchCardId === '__unchanged__') {
      toast.error('Selecione ao menos uma alteração')
      return
    }
    setBatchSaving(true)

    const ids = Array.from(selected)
    const updates: Record<string, unknown> = {}
    if (batchCategory) updates.category_id = batchCategory

    if (batchCardId !== '__unchanged__') {
      if (batchCardId === 'none') {
        updates.credit_card_id = null
        updates.billing_period = null
      } else {
        const card = creditCards.find(c => c.id === batchCardId)
        updates.credit_card_id = batchCardId
        // Recalcula billing_period para cada transação individualmente
        const affected = transactions.filter(t => ids.includes(t.id))
        if (card) {
          for (const t of affected) {
            const bp = getBillingPeriod(t.date, card.closing_day, card.closing_inclusive)
            await supabase.from('transactions').update({ ...updates, billing_period: bp }).eq('id', t.id)
          }
          // Atualiza estado local
          if (batchCategory) {
            const cat = categories.find(c => c.id === batchCategory)
            setTransactions(prev => prev.map(t =>
              ids.includes(t.id)
                ? { ...t, category_id: batchCategory, category: cat || t.category, credit_card_id: batchCardId, credit_card: card, billing_period: getBillingPeriod(t.date, card.closing_day, card.closing_inclusive) }
                : t
            ))
          } else {
            setTransactions(prev => prev.map(t =>
              ids.includes(t.id)
                ? { ...t, credit_card_id: batchCardId, credit_card: card, billing_period: getBillingPeriod(t.date, card.closing_day, card.closing_inclusive) }
                : t
            ))
          }
          toast.success(`${ids.length} transações atualizadas!`)
          setBatchOpen(false)
          exitSelecting()
          setBatchSaving(false)
          router.refresh()
          return
        }
      }
    }

    // Atualização simples (só categoria ou remoção de cartão)
    const { error } = await supabase.from('transactions').update(updates).in('id', ids)
    if (error) { toast.error('Erro ao atualizar'); setBatchSaving(false); return }

    const cat = batchCategory ? categories.find(c => c.id === batchCategory) : undefined
    setTransactions(prev => prev.map(t => {
      if (!ids.includes(t.id)) return t
      return {
        ...t,
        ...(batchCategory ? { category_id: batchCategory, category: cat || t.category } : {}),
        ...(batchCardId === 'none' ? { credit_card_id: null, credit_card: undefined, billing_period: null } : {}),
      }
    }))

    toast.success(`${ids.length} transações atualizadas!`)
    setBatchOpen(false)
    exitSelecting()
    setBatchSaving(false)
    router.refresh()
  }

  function addMonths(dateStr: string, months: number): string {
    const d = new Date(dateStr + 'T12:00:00')
    const day = d.getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + months)
    // clamp para o último dia do mês destino
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(day, maxDay))
    return d.toISOString().split('T')[0]
  }

  async function handleSave() {
    if (!form.amount || !form.category_id || !form.date) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    setLoading(true)

    const isInstallments = form.launch_mode === 'installments'
    const isRecurring = form.launch_mode === 'recurring'
    const installTotal = isInstallments && form.installment_total ? parseInt(form.installment_total) : null

    const card = creditCards.find(c => c.id === form.credit_card_id)

    const basePayload = {
      user_id: userId,
      amount: parseFloat(form.amount),
      type: form.type,
      category_id: form.category_id,
      recurring: isRecurring,
      recurring_period: isRecurring ? (form.recurring_period || null) : null,
      credit_card_id: form.credit_card_id || null,
      is_credit_card_installment: form.is_credit_card_installment,
      installment_total: installTotal,
    }

    try {
      if (editingId) {
        const billing_period = card ? getBillingPeriod(form.date, card.closing_day, card.closing_inclusive) : null
        const payload = {
          ...basePayload,
          description: form.description || null,
          date: form.date,
          billing_period,
          installment_current: null as number | null,
          installment_group_id: null as string | null,
        }
        const { data, error } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', editingId)
          .select('*, category:categories(*), credit_card:credit_cards(*)')
          .single()
        if (error) throw error
        setTransactions(prev => prev.map(t => t.id === editingId ? data : t))
        toast.success('Transação atualizada!')
        setOpen(false)
        router.refresh()
        return
      }

      // — Novo lançamento —

      // Parcelado no cartão: salva só 1 (as transações virão pela importação da fatura)
      if (isInstallments && form.is_credit_card_installment) {
        const billing_period = card ? getBillingPeriod(form.date, card.closing_day, card.closing_inclusive) : null
        const { data, error } = await supabase
          .from('transactions')
          .insert({
            ...basePayload,
            description: form.description ? `${form.description} 1/${installTotal}` : `Parcela 1/${installTotal}`,
            date: form.date,
            billing_period,
            installment_current: 1,
            installment_group_id: crypto.randomUUID(),
          })
          .select('*, category:categories(*), credit_card:credit_cards(*)')
          .single()
        if (error) throw error
        setTransactions(prev => [data, ...prev])
        toast.success(`Parcela 1/${installTotal} registrada. Demais parcelas virão pela fatura do cartão.`)
        setOpen(false)
        router.refresh()
        return
      }

      // Parcelado sem cartão (ou parcelado no cartão mas criando todas): cria N transações
      if (isInstallments && installTotal && installTotal > 1) {
        const groupId = crypto.randomUUID()
        const rows = []
        for (let i = 1; i <= installTotal; i++) {
          const dateStr = addMonths(form.date, i - 1)
          const billing_period = card ? getBillingPeriod(dateStr, card.closing_day, card.closing_inclusive) : null
          const baseDesc = form.description || ''
          rows.push({
            ...basePayload,
            description: baseDesc ? `${baseDesc} ${i}/${installTotal}` : `Parcela ${i}/${installTotal}`,
            date: dateStr,
            billing_period,
            installment_current: i,
            installment_group_id: groupId,
          })
        }
        const { error } = await supabase.from('transactions').insert(rows)
        if (error) throw error
        toast.success(`${installTotal} parcelas lançadas!`)
        setOpen(false)
        router.refresh()
        return
      }

      // Lançamento único ou recorrente simples
      const billing_period = card ? getBillingPeriod(form.date, card.closing_day, card.closing_inclusive) : null
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          ...basePayload,
          description: form.description || null,
          date: form.date,
          billing_period,
          installment_current: null,
          installment_group_id: null,
        })
        .select('*, category:categories(*), credit_card:credit_cards(*)')
        .single()
      if (error) throw error
      setTransactions(prev => [data, ...prev])
      toast.success('Transação lançada!')
      setOpen(false)
      router.refresh()
    } catch { toast.error('Erro ao salvar transação') }
    finally { setLoading(false) }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    setTransactions(prev => prev.filter(t => t.id !== id))
    toast.success('Transação excluída')
    router.refresh()
  }

  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  const allSelected = selected.size > 0 && selected.size === filteredTransactions.length

  return (
    <div className="p-4 md:p-6 space-y-5 pb-24 md:pb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transações</h1>
          <p className="text-sm text-gray-500">Receitas e despesas</p>
        </div>
        <div className="flex gap-2">
          {!selecting ? (
            <>
              <Button variant="outline" onClick={() => setSelecting(true)} className="gap-2">
                <Layers className="w-4 h-4" /> Editar em lote
              </Button>
              <Button onClick={openNew} className="bg-green-600 hover:bg-green-700 gap-2">
                <Plus className="w-4 h-4" /> Nova
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={exitSelecting} className="gap-2">
                <X className="w-4 h-4" /> Cancelar
              </Button>
              <Button
                disabled={selected.size === 0}
                onClick={() => { setBatchCategory(''); setBatchCardId('__unchanged__'); setBatchOpen(true) }}
                className="bg-indigo-600 hover:bg-indigo-700 gap-2"
              >
                <Layers className="w-4 h-4" /> Editar {selected.size > 0 ? `${selected.size} selecionados` : 'selecionados'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Dialog edição individual */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <Button variant={form.type === 'expense' ? 'default' : 'outline'}
                className={form.type === 'expense' ? 'bg-red-500 hover:bg-red-600' : ''}
                onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: '', credit_card_id: '' }))}>
                Despesa
              </Button>
              <Button variant={form.type === 'income' ? 'default' : 'outline'}
                className={form.type === 'income' ? 'bg-green-600 hover:bg-green-700' : ''}
                onClick={() => setForm(f => ({ ...f, type: 'income', category_id: '', credit_card_id: '' }))}>
                Receita
              </Button>
            </div>

            <div className="space-y-1">
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00"
                value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label>Categoria *</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {filteredCategories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input placeholder="Ex: Almoço, salário..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label>Data da compra *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>

            {form.type === 'expense' && (
              <div className="space-y-1">
                <Label>Cartão de crédito</Label>
                <Select value={form.credit_card_id} onValueChange={v => setForm(f => ({ ...f, credit_card_id: v === 'none' ? '' : (v ?? '') }))}>
                  <SelectTrigger><SelectValue placeholder="Despesa direta (sem cartão)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Despesa direta (aluguel, IPVA...)</SelectItem>
                    {creditCards.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                          {c.name} (fecha dia {c.closing_day})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {computedBillingPeriod && (
                  <p className="text-xs text-indigo-600 mt-1">
                    📅 Competência: <strong>{computedBillingPeriod}</strong> — fatura de {new Date(computedBillingPeriod + '-15').toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label>Tipo de lançamento</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['single', 'installments', 'recurring'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, launch_mode: mode, recurring: mode === 'recurring', installment_total: '', is_credit_card_installment: false }))}
                    className={`py-2 px-2 rounded-lg border text-xs font-medium transition-colors ${form.launch_mode === mode ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}
                  >
                    {mode === 'single' ? '🔹 Único' : mode === 'installments' ? '📆 Parcelado' : '🔁 Recorrente'}
                  </button>
                ))}
              </div>
            </div>

            {form.launch_mode === 'recurring' && (
              <div className="space-y-1">
                <Label>Periodicidade</Label>
                <Select value={form.recurring_period} onValueChange={v => setForm(f => ({ ...f, recurring_period: (v ?? '') as '' | 'monthly' | 'yearly' }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.launch_mode === 'installments' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Número de parcelas *</Label>
                  <Input
                    type="number" min="2" max="360" placeholder="Ex: 40"
                    value={form.installment_total}
                    onChange={e => setForm(f => ({ ...f, installment_total: e.target.value }))}
                  />
                  {form.installment_total && form.amount && (
                    <p className="text-xs text-gray-500">
                      {parseInt(form.installment_total)}x de {formatCurrency(parseFloat(form.amount))} = {formatCurrency(parseFloat(form.amount) * parseInt(form.installment_total))}
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <Label className="text-amber-800 text-xs font-semibold">Onde são lançadas as parcelas?</Label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio" name="installment_mode" className="mt-0.5"
                        checked={!form.is_credit_card_installment}
                        onChange={() => setForm(f => ({ ...f, is_credit_card_installment: false }))}
                      />
                      <div>
                        <p className="text-xs font-medium text-gray-800">Débito direto / boleto</p>
                        <p className="text-xs text-gray-500">Cria {form.installment_total || 'N'} lançamentos mensais automaticamente (ex: consórcio, financiamento)</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio" name="installment_mode" className="mt-0.5"
                        checked={form.is_credit_card_installment}
                        onChange={() => setForm(f => ({ ...f, is_credit_card_installment: true }))}
                      />
                      <div>
                        <p className="text-xs font-medium text-gray-800">Cartão de crédito</p>
                        <p className="text-xs text-gray-500">Registra apenas a 1ª parcela — as demais virão pela importação da fatura, sem duplicar</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <Button onClick={handleSave} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog edição em lote */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar {selected.size} transações</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-gray-500">Deixe em branco os campos que não deseja alterar.</p>

            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={batchCategory} onValueChange={v => setBatchCategory(v === '__keep__' ? '' : (v ?? ''))}>
                <SelectTrigger><SelectValue placeholder="— Manter categoria atual —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">— Manter categoria atual —</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Cartão de crédito</Label>
              <Select value={batchCardId} onValueChange={v => setBatchCardId(v ?? '__unchanged__')}>
                <SelectTrigger><SelectValue placeholder="— Manter cartão atual —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unchanged__">— Manter cartão atual —</SelectItem>
                  <SelectItem value="none">— Remover cartão (despesa direta) —</SelectItem>
                  {creditCards.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                        {c.name} (fecha dia {c.closing_day})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {batchCardId !== '__unchanged__' && batchCardId !== 'none' && (
                <p className="text-xs text-indigo-600 mt-1">A competência de cada lançamento será recalculada automaticamente.</p>
              )}
            </div>

            <Button onClick={handleBatchSave} disabled={batchSaving} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {batchSaving ? 'Salvando...' : `Aplicar a ${selected.size} transações`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Receitas</p><p className="font-bold text-green-600 text-sm">{formatCurrency(totalIncome)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Despesas</p><p className="font-bold text-red-500 text-sm">{formatCurrency(totalExpense)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Saldo</p><p className={`font-bold text-sm ${totalIncome - totalExpense >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatCurrency(totalIncome - totalExpense)}</p></CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterType} onValueChange={v => setFilterType(v ?? 'all')}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Input type="month" className="w-44" value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)} />
        {(filterType !== 'all' || filterMonth) && (
          <Button variant="outline" onClick={() => { setFilterType('all'); setFilterMonth('') }}>Limpar</Button>
        )}
      </div>

      {/* Lista */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Histórico ({filteredTransactions.length})</CardTitle>
            {selecting && (
              <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800">
                {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">Nenhuma transação encontrada</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTransactions.map(t => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${selecting && selected.has(t.id) ? 'bg-indigo-50' : ''}`}
                  onClick={selecting ? () => toggleSelect(t.id) : undefined}
                >
                  {selecting && (
                    <div className="mr-3 flex-shrink-0">
                      {selected.has(t.id)
                        ? <CheckSquare className="w-5 h-5 text-indigo-600" />
                        : <Square className="w-5 h-5 text-gray-300" />}
                    </div>
                  )}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xl flex-shrink-0">{t.category?.icon ?? '💳'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {t.description || t.category?.name || 'Sem descrição'}
                        {t.installment_total && t.installment_current && (
                          <Badge variant="outline" className="ml-2 text-xs py-0 text-indigo-600 border-indigo-300">
                            {t.installment_current}/{t.installment_total}
                          </Badge>
                        )}
                        {t.recurring && !t.installment_total && <Badge variant="outline" className="ml-2 text-xs py-0">{t.recurring_period === 'monthly' ? 'mensal' : 'anual'}</Badge>}
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 flex-wrap">
                        <span>{format(parseISO(t.date), 'dd/MM/yy', { locale: ptBR })}</span>
                        {t.billing_period && t.billing_period !== t.date.substring(0, 7) && (
                          <span className="text-indigo-500 flex items-center gap-0.5">
                            <CardIcon className="w-3 h-3" /> fatura {t.billing_period}
                          </span>
                        )}
                        <span>· {t.category?.name}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                    </span>
                    {!selecting && (
                      <>
                        <button onClick={() => openEdit(t)} className="text-gray-400 hover:text-blue-500 p-1">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger className="text-gray-400 hover:text-red-500 p-1 rounded inline-flex">
                            <Trash2 className="w-4 h-4" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(t.id)} className="bg-red-500 hover:bg-red-600">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Barra flutuante de seleção */}
      {selecting && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white rounded-xl shadow-xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">{selected.size} selecionados</span>
          <Button size="sm" variant="secondary" onClick={() => { setBatchCategory(''); setBatchCardId('__unchanged__'); setBatchOpen(true) }}>
            Editar em lote
          </Button>
          <button onClick={exitSelecting} className="text-white/70 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
