'use client'

import { useState } from 'react'
import { CreditCard } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, CreditCard as CardIcon } from 'lucide-react'

interface Props { initialCards: CreditCard[]; userId: string }

const EMPTY = { name: '', closing_day: '', color: '#6366f1', closing_inclusive: false }
const COLORS = ['#6366f1','#22c55e','#ef4444','#f59e0b','#3b82f6','#ec4899','#8b5cf6','#14b8a6']

export function CardsClient({ initialCards, userId }: Props) {
  const [cards, setCards] = useState(initialCards)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)

  function openNew() { setForm(EMPTY); setEditingId(null); setOpen(true) }
  function openEdit(c: CreditCard) {
    setForm({ name: c.name, closing_day: String(c.closing_day), color: c.color, closing_inclusive: c.closing_inclusive })
    setEditingId(c.id); setOpen(true)
  }

  async function handleSave() {
    const day = parseInt(form.closing_day)
    if (!form.name || !day || day < 1 || day > 28) {
      toast.error('Preencha o nome e o dia de fechamento (1–28)')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const payload = { user_id: userId, name: form.name, closing_day: day, color: form.color, closing_inclusive: form.closing_inclusive }
    try {
      if (editingId) {
        const { data, error } = await supabase.from('credit_cards').update(payload).eq('id', editingId).select().single()
        if (error) throw error
        setCards(prev => prev.map(c => c.id === editingId ? data : c))
        toast.success('Cartão atualizado!')
      } else {
        const { data, error } = await supabase.from('credit_cards').insert(payload).select().single()
        if (error) throw error
        setCards(prev => [...prev, data])
        toast.success('Cartão cadastrado!')
      }
      setOpen(false)
    } catch { toast.error('Erro ao salvar') } finally { setLoading(false) }
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('credit_cards').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    setCards(prev => prev.filter(c => c.id !== id))
    toast.success('Cartão removido')
  }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cartões de Crédito</h1>
          <p className="text-sm text-gray-500">Cadastre seus cartões com o dia de fechamento para calcular o mês correto de competência</p>
        </div>
        <Button onClick={openNew} className="bg-green-600 hover:bg-green-700 gap-2">
          <Plus className="w-4 h-4" /> Novo Cartão
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Cartão</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Nome do cartão *</Label>
              <Input placeholder="Ex: Nubank, PicPay, Itaú..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Dia de fechamento * (1–28)</Label>
              <Input type="number" min={1} max={28} placeholder="Ex: 6" value={form.closing_day} onChange={e => setForm(f => ({ ...f, closing_day: e.target.value }))} />
              <p className="text-xs text-gray-400">Compras após este dia vão para a fatura do mês seguinte</p>
            </div>
            <div className="space-y-2">
              <Label>Comportamento no dia de fechamento</Label>
              <div className="space-y-1.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="closing_mode" checked={!form.closing_inclusive}
                    onChange={() => setForm(f => ({ ...f, closing_inclusive: false }))} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Apenas o dia seguinte ao fechamento (PicPay)</p>
                    <p className="text-xs text-gray-400">Compra no dia {form.closing_day || 'X'} fica na fatura atual; compra no dia {Number(form.closing_day || 0) + 1} vai para próxima</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="closing_mode" checked={form.closing_inclusive}
                    onChange={() => setForm(f => ({ ...f, closing_inclusive: true }))} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">A partir do próprio dia de fechamento (Nubank)</p>
                    <p className="text-xs text-gray-400">Compra no dia {form.closing_day || 'X'} já vai para próxima fatura; compra no dia {Number(form.closing_day || 0) - 1} fica na atual</p>
                  </div>
                </label>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <Button onClick={handleSave} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {cards.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-gray-400">
          <CardIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum cartão cadastrado</p>
          <p className="text-xs mt-1">Cadastre seus cartões para controle preciso por competência</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(c => (
            <Card key={c.id} className="border-l-4" style={{ borderLeftColor: c.color }}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CardIcon className="w-4 h-4" style={{ color: c.color }} />
                    {c.name}
                  </CardTitle>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-blue-500 p-1"><Pencil className="w-4 h-4" /></button>
                    <AlertDialog>
                      <AlertDialogTrigger className="text-gray-400 hover:text-red-500 p-1 rounded inline-flex"><Trash2 className="w-4 h-4" /></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover cartão?</AlertDialogTitle>
                          <AlertDialogDescription>As transações vinculadas não serão excluídas, mas perderão o vínculo com este cartão.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-red-500 hover:bg-red-600">Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Fecha todo dia <strong>{c.closing_day}</strong></p>
                <p className="text-xs text-gray-400 mt-1">
                  {c.closing_inclusive
                    ? `Compras a partir do dia ${c.closing_day} → mês seguinte`
                    : `Compras após o dia ${c.closing_day} → mês seguinte`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
