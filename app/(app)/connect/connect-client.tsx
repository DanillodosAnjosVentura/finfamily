'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, RefreshCw, Trash2, Building2, CheckCircle2, AlertTriangle, Link } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface PluggyItem {
  id: string
  item_id: string
  connector_name: string
  connector_logo: string | null
  status: string
  last_synced_at: string | null
  created_at: string
}

interface Props {
  initialItems: PluggyItem[]
}

declare global {
  interface Window {
    PluggyConnect: new (config: {
      connectToken: string
      onSuccess: (data: { item: { id: string } }) => void
      onError: (error: unknown) => void
      onClose: () => void
    }) => { init: () => void }
  }
}

export function ConnectClient({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems)
  const [loadingWidget, setLoadingWidget] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  // Carrega o script do widget Pluggy
  useEffect(() => {
    if (document.getElementById('pluggy-script')) { setScriptLoaded(true); return }
    const script = document.createElement('script')
    script.id = 'pluggy-script'
    script.src = 'https://cdn.pluggy.ai/pluggy-connect/v2.3.0/pluggy-connect.js'
    script.onload = () => setScriptLoaded(true)
    document.head.appendChild(script)
  }, [])

  async function openWidget(reconnectItemId?: string) {
    setLoadingWidget(true)
    try {
      const res = await fetch('/api/pluggy/connect-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: reconnectItemId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const widget = new window.PluggyConnect({
        connectToken: data.connectToken,
        onSuccess: async ({ item }) => {
          toast.loading('Salvando conexão...')
          const saveRes = await fetch('/api/pluggy/item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: item.id }),
          })
          const saved = await saveRes.json()
          toast.dismiss()
          if (!saveRes.ok) { toast.error(saved.error); return }
          toast.success(`${saved.connectorName} conectado!`)

          // Atualiza lista localmente
          if (reconnectItemId) {
            setItems(prev => prev.map(i => i.item_id === reconnectItemId
              ? { ...i, status: 'UPDATED' } : i))
          } else {
            // Recarrega a página para buscar o novo item do banco
            window.location.reload()
          }
        },
        onError: (err) => {
          console.error('Pluggy widget error:', err)
          toast.error('Erro ao conectar banco')
        },
        onClose: () => {},
      })
      widget.init()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao abrir widget')
    } finally {
      setLoadingWidget(false)
    }
  }

  async function syncItem(itemId: string) {
    setSyncingId(itemId)
    try {
      const res = await fetch('/api/pluggy/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, daysBack: 90 }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.status === 'LOGIN_ERROR' || data.status === 'OUTDATED') {
          toast.error('Reconexão necessária. Clique em Reconectar.')
          setItems(prev => prev.map(i => i.item_id === itemId ? { ...i, status: data.status } : i))
        } else {
          toast.error(data.error)
        }
        return
      }
      toast.success(`${data.imported} transações importadas, ${data.skipped} já existentes`)
      setItems(prev => prev.map(i => i.item_id === itemId
        ? { ...i, last_synced_at: new Date().toISOString(), status: 'UPDATED' } : i))
    } catch {
      toast.error('Erro ao sincronizar')
    } finally {
      setSyncingId(null)
    }
  }

  async function removeItem(itemId: string) {
    const res = await fetch('/api/pluggy/item', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    })
    if (!res.ok) { toast.error('Erro ao remover'); return }
    setItems(prev => prev.filter(i => i.item_id !== itemId))
    toast.success('Banco desconectado')
  }

  function statusBadge(status: string) {
    if (status === 'UPDATED') return <Badge className="bg-green-100 text-green-700 border-0"><CheckCircle2 className="w-3 h-3 mr-1" />Conectado</Badge>
    if (status === 'LOGIN_ERROR') return <Badge className="bg-red-100 text-red-700 border-0"><AlertTriangle className="w-3 h-3 mr-1" />Reconexão necessária</Badge>
    if (status === 'OUTDATED') return <Badge className="bg-amber-100 text-amber-700 border-0"><AlertTriangle className="w-3 h-3 mr-1" />Desatualizado</Badge>
    return <Badge variant="outline">{status}</Badge>
  }

  const needsReconnect = (status: string) => status === 'LOGIN_ERROR' || status === 'OUTDATED'

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conectar Bancos</h1>
          <p className="text-sm text-gray-500">Sincronize transações automaticamente via Open Finance</p>
        </div>
        <Button
          onClick={() => openWidget()}
          disabled={loadingWidget || !scriptLoaded}
          className="bg-indigo-600 hover:bg-indigo-700 gap-2"
        >
          {loadingWidget ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Conectar banco
        </Button>
      </div>

      {/* Info box */}
      <Card className="border-indigo-200 bg-indigo-50">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Link className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-indigo-800 space-y-1">
              <p className="font-semibold">Como funciona</p>
              <p>Clique em "Conectar banco", escolha sua instituição e autorize o acesso. Suas credenciais vão direto ao banco — o FinFamily nunca as vê. Powered by <strong>Pluggy</strong> (Open Finance certificado pelo Banco Central).</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de bancos conectados */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Nenhum banco conectado</p>
            <p className="text-xs text-gray-400 mt-1">Conecte sua conta para importar transações automaticamente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id} className={needsReconnect(item.status) ? 'border-amber-300' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {item.connector_logo ? (
                      <img src={item.connector_logo} alt={item.connector_name} className="w-10 h-10 rounded-lg object-contain border border-gray-100 p-1" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{item.connector_name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {statusBadge(item.status)}
                        {item.last_synced_at && (
                          <span className="text-xs text-gray-400">
                            Última sync: {format(parseISO(item.last_synced_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {needsReconnect(item.status) ? (
                      <Button size="sm" variant="outline" className="border-amber-400 text-amber-700"
                        onClick={() => openWidget(item.item_id)} disabled={loadingWidget}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Reconectar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline"
                        onClick={() => syncItem(item.item_id)}
                        disabled={syncingId === item.item_id}>
                        {syncingId === item.item_id
                          ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          : <RefreshCw className="w-3 h-3 mr-1" />}
                        Sincronizar
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Desconectar {item.connector_name}?</AlertDialogTitle>
                          <AlertDialogDescription>As transações já importadas não serão excluídas.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeItem(item.item_id)} className="bg-red-500 hover:bg-red-600">Desconectar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bancos suportados */}
      <Card>
        <CardHeader><CardTitle className="text-sm text-gray-500">Algumas instituições suportadas</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['Nubank', 'Itaú', 'Bradesco', 'Santander', 'Caixa', 'Banco do Brasil', 'Inter', 'C6 Bank', 'PicPay', 'XP', 'BTG', 'Sicoob', 'Sicredi'].map(b => (
              <span key={b} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{b}</span>
            ))}
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-400">+200 mais</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
