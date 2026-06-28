'use client'

import { useState } from 'react'
import { Transaction, Category } from '@/types'
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
import { Plus, Trash2, Pencil } from 'lucide-react'

interface Props {
  initialTransactions: Transaction[]
  categories: Category[]
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
}

export function TransactionsClient({ initialTransactions, categories, userId }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filter, setFilter] = useState({ type: 'all', month: '' })
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const filteredCategories = categories.filter(c => c.type === form.type)

  const filteredTransactions = transactions.filter(t => {
    if (filter.type !== 'all' && t.type !== filter.type) return false
    if (filter.month && !t.date.startsWith(filter.month)) return false
    return true
  })

  function openNew() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setOpen(true)
  }

  function openEdit(t: Transaction) {
    setForm({
      amount: String(t.amount),
      type: t.type,
      category_id: t.category_id || '',
      description: t.description || '',
      date: t.date,
      recurring: t.recurring,
      recurring_period: t.recurring_period || '',
    })
    setEditingId(t.id)
    setOpen(true)
  }

  async function handleSave() {
    if (!form.amount || !form.category_id || !form.date) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    setLoading(true)
    const payload = {
      user_id: userId,
      amount: parseFloat(form.amount),
      type: form.type,
      category_id: form.category_id,
      description: form.description || null,
      date: form.date,
      recurring: form.recurring,
      recurring_period: form.recurring_period || null,
    }

    try {
      if (editingId) {
        const { data, error } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', editingId)
          .select('*, category:categories(*)')
          .single()
        if (error) throw error
        setTransactions(prev => prev.map(t => t.id === editingId ? data : t))
        toast.success('Transação atualizada!')
      } else {
        const { data, error } = await supabase
          .from('transactions')
          .insert(payload)
          .select('*, category:categories(*)')
          .single()
        if (error) throw error
        setTransactions(prev => [data, ...prev])
        toast.success('Transação lançada!')
      }
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Erro ao salvar transação')
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transações</h1>
          <p className="text-sm text-gray-500">Receitas e despesas</p>
        </div>
        <Button onClick={openNew} className="bg-green-600 hover:bg-green-700 gap-2">
          <Plus className="w-4 h-4" /> Nova Transação
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar' : 'Nova'} Transação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={form.type === 'expense' ? 'default' : 'outline'}
                  className={form.type === 'expense' ? 'bg-red-500 hover:bg-red-600' : ''}
                  onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: '' }))}
                >Despesa</Button>
                <Button
                  variant={form.type === 'income' ? 'default' : 'outline'}
                  className={form.type === 'income' ? 'bg-green-600 hover:bg-green-700' : ''}
                  onClick={() => setForm(f => ({ ...f, type: 'income', category_id: '' }))}
                >Receita</Button>
              </div>

              <div className="space-y-1">
                <Label>Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label>Categoria *</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm(f => ({ ...f, category_id: v ?? '' }))}>
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
                <Input
                  placeholder="Ex: Almoço, salário..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={form.recurring}
                  onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))}
                  className="w-4 h-4"
                />
                <Label htmlFor="recurring">Lançamento recorrente</Label>
              </div>

              {form.recurring && (
                <div className="space-y-1">
                  <Label>Periodicidade</Label>
                  <Select value={form.recurring_period} onValueChange={(v) => setForm(f => ({ ...f, recurring_period: (v ?? '') as '' | 'monthly' | 'yearly' }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button onClick={handleSave} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Receitas</p><p className="font-bold text-green-600">{formatCurrency(totalIncome)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Despesas</p><p className="font-bold text-red-500">{formatCurrency(totalExpense)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Saldo</p><p className={`font-bold ${totalIncome - totalExpense >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatCurrency(totalIncome - totalExpense)}</p></CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filter.type} onValueChange={(v) => setFilter(f => ({ ...f, type: v ?? 'all' }))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="month"
          className="w-44"
          value={filter.month}
          onChange={e => setFilter(f => ({ ...f, month: e.target.value }))}
        />
        {(filter.type !== 'all' || filter.month) && (
          <Button variant="outline" onClick={() => setFilter({ type: 'all', month: '' })}>Limpar</Button>
        )}
      </div>

      {/* Lista */}
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico ({filteredTransactions.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">Nenhuma transação encontrada</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTransactions.map(t => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{t.category?.icon ?? '💳'}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {t.description || t.category?.name || 'Sem descrição'}
                        {t.recurring && <Badge variant="outline" className="ml-2 text-xs py-0">{t.recurring_period === 'monthly' ? 'mensal' : 'anual'}</Badge>}
                      </p>
                      <p className="text-xs text-gray-400">
                        {format(parseISO(t.date), 'dd/MM/yyyy', { locale: ptBR })} · {t.category?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                    </span>
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
