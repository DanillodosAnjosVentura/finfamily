'use client'

import { useState } from 'react'
import { Category } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Pencil, Lock } from 'lucide-react'

const COLORS = ['#22c55e','#16a34a','#ef4444','#f97316','#fb923c','#3b82f6','#8b5cf6','#7c3aed','#06b6d4','#ec4899','#f59e0b','#64748b','#0891b2','#15803d']
const ICONS = ['💰','💵','📈','🍔','🛒','🚗','🏠','🚙','📋','📶','📱','🤝','🎉','💊','📚','🛠️','✈️','🎮','🏋️','🐾','👔','🎓','🏥','⚡','🌊']

interface Props {
  initialCategories: Category[]
  userId: string
}

const EMPTY = { name: '', type: 'expense' as 'income' | 'expense', icon: '💰', color: '#64748b', budget_limit: '' }

export function CategoriesClient({ initialCategories, userId }: Props) {
  const [categories, setCategories] = useState(initialCategories)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const systemCats = categories.filter(c => c.user_id === null)
  const userCats = categories.filter(c => c.user_id === userId)

  function openNew() {
    setForm(EMPTY)
    setEditingId(null)
    setOpen(true)
  }

  function openEdit(c: Category) {
    setForm({ name: c.name, type: c.type, icon: c.icon, color: c.color, budget_limit: c.budget_limit ? String(c.budget_limit) : '' })
    setEditingId(c.id)
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Nome obrigatório'); return }
    setLoading(true)
    const payload = {
      user_id: userId,
      name: form.name.trim(),
      type: form.type,
      icon: form.icon,
      color: form.color,
      budget_limit: form.budget_limit ? parseFloat(form.budget_limit) : null,
    }
    try {
      if (editingId) {
        const { data, error } = await supabase.from('categories').update(payload).eq('id', editingId).select().single()
        if (error) throw error
        setCategories(prev => prev.map(c => c.id === editingId ? data : c))
        toast.success('Categoria atualizada!')
      } else {
        const { data, error } = await supabase.from('categories').insert(payload).select().single()
        if (error) throw error
        setCategories(prev => [...prev, data])
        toast.success('Categoria criada!')
      }
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Erro ao salvar categoria')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    setCategories(prev => prev.filter(c => c.id !== id))
    toast.success('Categoria excluída')
    router.refresh()
  }

  const CategoryCard = ({ c, editable }: { c: Category; editable: boolean }) => (
    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: c.color + '22' }}>
          {c.icon}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">{c.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className={`text-xs py-0 ${c.type === 'income' ? 'text-green-600 border-green-200' : 'text-red-500 border-red-200'}`}>
              {c.type === 'income' ? 'Receita' : 'Despesa'}
            </Badge>
            {c.budget_limit && <span className="text-xs text-gray-400">Limite: R$ {c.budget_limit}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {editable ? (
          <>
            <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-blue-500 p-1"><Pencil className="w-4 h-4" /></button>
            <AlertDialog>
              <AlertDialogTrigger className="text-gray-400 hover:text-red-500 p-1 rounded inline-flex">
                <Trash2 className="w-4 h-4" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                  <AlertDialogDescription>Transações vinculadas perderão a categoria.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-red-500 hover:bg-red-600">Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <Lock className="w-4 h-4 text-gray-300" />
        )}
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
          <p className="text-sm text-gray-500">Padrão e personalizadas</p>
        </div>
        <Button onClick={openNew} className="bg-green-600 hover:bg-green-700 gap-2">
          <Plus className="w-4 h-4" /> Nova Categoria
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar' : 'Nova'} Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input placeholder="Ex: Academia, Streaming..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant={form.type === 'expense' ? 'default' : 'outline'} className={form.type === 'expense' ? 'bg-red-500 hover:bg-red-600' : ''} onClick={() => setForm(f => ({ ...f, type: 'expense' }))}>Despesa</Button>
                <Button variant={form.type === 'income' ? 'default' : 'outline'} className={form.type === 'income' ? 'bg-green-600 hover:bg-green-700' : ''} onClick={() => setForm(f => ({ ...f, type: 'income' }))}>Receita</Button>
              </div>

              <div className="space-y-1">
                <Label>Ícone</Label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(ic => (
                    <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))} className={`text-xl p-1.5 rounded-lg transition-colors ${form.icon === ic ? 'bg-green-100 ring-2 ring-green-500' : 'hover:bg-gray-100'}`}>{ic}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(color => (
                    <button key={color} onClick={() => setForm(f => ({ ...f, color }))} className={`w-7 h-7 rounded-full transition-transform ${form.color === color ? 'ring-2 ring-offset-1 ring-gray-600 scale-110' : ''}`} style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label>Limite Mensal (R$) — opcional</Label>
                <Input type="number" step="0.01" min="0" placeholder="Ex: 500,00" value={form.budget_limit} onChange={e => setForm(f => ({ ...f, budget_limit: e.target.value }))} />
              </div>

              <Button onClick={handleSave} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {userCats.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Minhas Categorias ({userCats.length})</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {userCats.map(c => <CategoryCard key={c.id} c={c} editable={true} />)}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Categorias Padrão ({systemCats.length})</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {systemCats.map(c => <CategoryCard key={c.id} c={c} editable={false} />)}
        </CardContent>
      </Card>
    </div>
  )
}
