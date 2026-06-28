'use client'

import { useState } from 'react'
import { Goal } from '@/types'
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
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Pencil, CheckCircle2, PauseCircle, Target } from 'lucide-react'

const GOAL_CATEGORIES = {
  savings: { label: 'Guardar Dinheiro', icon: '🐷' },
  debt_reduction: { label: 'Reduzir Dívidas', icon: '📉' },
  investment: { label: 'Investir', icon: '📈' },
  expense_cut: { label: 'Reduzir Gastos', icon: '✂️' },
}

const STATUS_CONFIG = {
  active: { label: 'Ativa', color: 'bg-green-100 text-green-700', icon: Target },
  completed: { label: 'Concluída', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  paused: { label: 'Pausada', color: 'bg-yellow-100 text-yellow-700', icon: PauseCircle },
}

interface Props {
  initialGoals: Goal[]
  userId: string
}

const EMPTY = { title: '', description: '', target_amount: '', current_amount: '', deadline: '', category: 'savings' as Goal['category'], status: 'active' as Goal['status'] }

export function GoalsClient({ initialGoals, userId }: Props) {
  const [goals, setGoals] = useState(initialGoals)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  function openNew() { setForm(EMPTY); setEditingId(null); setOpen(true) }

  function openEdit(g: Goal) {
    setForm({
      title: g.title,
      description: g.description || '',
      target_amount: String(g.target_amount),
      current_amount: String(g.current_amount),
      deadline: g.deadline || '',
      category: g.category,
      status: g.status,
    })
    setEditingId(g.id)
    setOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.target_amount) { toast.error('Preencha os campos obrigatórios'); return }
    setLoading(true)
    const payload = {
      user_id: userId,
      title: form.title.trim(),
      description: form.description || null,
      target_amount: parseFloat(form.target_amount),
      current_amount: parseFloat(form.current_amount || '0'),
      deadline: form.deadline || null,
      category: form.category,
      status: form.status,
    }
    try {
      if (editingId) {
        const { data, error } = await supabase.from('goals').update(payload).eq('id', editingId).select().single()
        if (error) throw error
        setGoals(prev => prev.map(g => g.id === editingId ? data : g))
        toast.success('Meta atualizada!')
      } else {
        const { data, error } = await supabase.from('goals').insert(payload).select().single()
        if (error) throw error
        setGoals(prev => [data, ...prev])
        toast.success('Meta criada!')
      }
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Erro ao salvar meta')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    setGoals(prev => prev.filter(g => g.id !== id))
    toast.success('Meta excluída')
    router.refresh()
  }

  const active = goals.filter(g => g.status === 'active')
  const completed = goals.filter(g => g.status === 'completed')
  const paused = goals.filter(g => g.status === 'paused')

  const GoalCard = ({ g }: { g: Goal }) => {
    const pct = Math.min((g.current_amount / g.target_amount) * 100, 100)
    const remaining = g.target_amount - g.current_amount
    const sc = STATUS_CONFIG[g.status]
    const gc = GOAL_CATEGORIES[g.category]

    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{gc.icon}</span>
              <div>
                <p className="font-semibold text-gray-800">{g.title}</p>
                <p className="text-xs text-gray-400">{gc.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Badge className={`text-xs ${sc.color} border-0`}>{sc.label}</Badge>
              <button onClick={() => openEdit(g)} className="text-gray-400 hover:text-blue-500 p-1"><Pencil className="w-3.5 h-3.5" /></button>
              <AlertDialog>
                <AlertDialogTrigger className="text-gray-400 hover:text-red-500 p-1 rounded inline-flex">
                  <Trash2 className="w-3.5 h-3.5" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir meta?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(g.id)} className="bg-red-500 hover:bg-red-600">Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {g.description && <p className="text-xs text-gray-500">{g.description}</p>}

          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{formatCurrency(g.current_amount)} de {formatCurrency(g.target_amount)}</span>
              <span className="font-medium">{pct.toFixed(0)}%</span>
            </div>
            <Progress value={pct} className="h-2" />
            {remaining > 0 && <p className="text-xs text-gray-400 mt-1">Faltam {formatCurrency(remaining)}</p>}
          </div>

          {g.deadline && (
            <p className="text-xs text-gray-400">
              Prazo: {format(parseISO(g.deadline), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  const GoalSection = ({ title, items }: { title: string; items: Goal[] }) => items.length === 0 ? null : (
    <div>
      <h2 className="font-semibold text-gray-700 mb-3">{title} ({items.length})</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map(g => <GoalCard key={g.id} g={g} />)}
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Metas Financeiras</h1>
          <p className="text-sm text-gray-500">Acompanhe seu progresso</p>
        </div>
        <Button onClick={openNew} className="bg-green-600 hover:bg-green-700 gap-2">
          <Plus className="w-4 h-4" /> Nova Meta
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar' : 'Nova'} Meta</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>Título *</Label>
                <Input placeholder="Ex: Reduzir gastos com lazer" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              <div className="space-y-1">
                <Label>Descrição</Label>
                <Input placeholder="Descreva sua meta..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div className="space-y-1">
                <Label>Tipo de Meta</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: (v ?? 'savings') as Goal['category'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(GOAL_CATEGORIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Valor Alvo (R$) *</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0,00" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Valor Atual (R$)</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0,00" value={form.current_amount} onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Prazo</Label>
                <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>

              {editingId && (
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: (v ?? 'active') as Goal['status'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                      <SelectItem value="paused">Pausada</SelectItem>
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

      {goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-5xl mb-4">🎯</span>
            <h3 className="font-semibold text-gray-700 mb-2">Nenhuma meta ainda</h3>
            <p className="text-sm text-gray-400 mb-4">Crie sua primeira meta financeira e comece a acompanhar seu progresso</p>
            <Button onClick={openNew} className="bg-green-600 hover:bg-green-700 gap-2"><Plus className="w-4 h-4" /> Criar Meta</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <GoalSection title="Metas Ativas" items={active} />
          <GoalSection title="Metas Concluídas" items={completed} />
          <GoalSection title="Metas Pausadas" items={paused} />
        </div>
      )}
    </div>
  )
}
