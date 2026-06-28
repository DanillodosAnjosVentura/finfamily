'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category } from '@/types'
import { formatCurrency } from '@/lib/format'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileText, CheckCircle, Loader2, Trash2 } from 'lucide-react'

interface ParsedTransaction {
  data: string
  descricao: string
  valor: number
  categoria_sugerida: string
  category_id?: string
  incluir: boolean
}

interface ParseResult {
  transacoes: ParsedTransaction[]
  total_fatura?: number
  vencimento?: string
}

interface Props {
  categories: Category[]
  userId: string
}

const CATEGORY_MAP: Record<string, string> = {
  'Alimentação': 'Alimentação',
  'Transporte': 'Transporte',
  'Lazer': 'Lazer',
  'Saúde': 'Saúde',
  'Mercado': 'Mercado',
  'Farmácia': 'Saúde',
  'Vestuário': 'Lazer',
  'Educação': 'Educação',
  'Ferramentas de Trabalho': 'Ferramentas de Trabalho',
  'Telefonia': 'Telefonia',
  'Internet': 'Internet',
}

export function ImportClient({ categories, userId }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([])
  const [saving, setSaving] = useState(false)

  function matchCategory(sugestao: string): string {
    const mapped = CATEGORY_MAP[sugestao] || sugestao
    const cat = categories.find(c =>
      c.name.toLowerCase().includes(mapped.toLowerCase()) ||
      mapped.toLowerCase().includes(c.name.toLowerCase())
    )
    return cat?.id || categories.find(c => c.name === 'Outros')?.id || categories[0]?.id || ''
  }

  async function processFile(file: File) {
    if (!file.name.endsWith('.pdf')) {
      toast.error('Por favor, envie um arquivo PDF')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao processar PDF')

      const parsed: ParseResult = data
      const txs = (parsed.transacoes || []).map(t => ({
        ...t,
        category_id: matchCategory(t.categoria_sugerida),
        incluir: t.valor > 0,
      }))
      setResult(parsed)
      setTransactions(txs)
      toast.success(`${txs.length} lançamentos encontrados!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao processar PDF')
    } finally {
      setLoading(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [categories])

  async function handleSave() {
    const toSave = transactions.filter(t => t.incluir && t.valor > 0)
    if (toSave.length === 0) { toast.error('Selecione pelo menos um lançamento'); return }
    setSaving(true)
    try {
      const supabase = createClient()
      const rows = toSave.map(t => ({
        user_id: userId,
        category_id: t.category_id || null,
        amount: t.valor,
        type: 'expense' as const,
        description: t.descricao,
        date: t.data,
        recurring: false,
      }))
      const { error } = await supabase.from('transactions').insert(rows)
      if (error) throw error
      toast.success(`${toSave.length} lançamentos importados com sucesso!`)
      setResult(null)
      setTransactions([])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const selectedCount = transactions.filter(t => t.incluir && t.valor > 0).length

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Importar Fatura PDF</h1>
        <p className="text-sm text-gray-500 mt-1">Envie o PDF da sua fatura de cartão de crédito para importar os lançamentos automaticamente</p>
      </div>

      {/* Upload area */}
      {!result && (
        <Card>
          <CardContent className="pt-6">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                dragging ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
              }`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById('pdf-input')?.click()}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
                  <p className="text-gray-600 font-medium">Analisando fatura com IA...</p>
                  <p className="text-xs text-gray-400">Isso pode levar alguns segundos</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="w-10 h-10 text-gray-400" />
                  <p className="text-gray-700 font-medium">Arraste o PDF aqui ou clique para selecionar</p>
                  <p className="text-xs text-gray-400">Faturas Nubank, Itaú, Bradesco, Inter, C6, XP e outras</p>
                </div>
              )}
            </div>
            <input
              id="pdf-input"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
            />
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && transactions.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-600" />
                  {transactions.length} lançamentos encontrados
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setResult(null); setTransactions([]) }}>
                    Novo PDF
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleSave}
                    disabled={saving || selectedCount === 0}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                    Importar {selectedCount} selecionados
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Button variant="outline" size="sm" onClick={() => setTransactions(ts => ts.map(t => ({ ...t, incluir: t.valor > 0 })))}>
                  Selecionar todos
                </Button>
                <Button variant="outline" size="sm" onClick={() => setTransactions(ts => ts.map(t => ({ ...t, incluir: false })))}>
                  Desmarcar todos
                </Button>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {transactions.map((t, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      t.incluir ? 'bg-white border-green-200' : 'bg-gray-50 border-gray-100 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={t.incluir}
                      disabled={t.valor <= 0}
                      onChange={e => setTransactions(ts => ts.map((x, j) => j === i ? { ...x, incluir: e.target.checked } : x))}
                      className="w-4 h-4 accent-green-600 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{t.descricao}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{t.data}</span>
                        <select
                          value={t.category_id}
                          onChange={e => setTransactions(ts => ts.map((x, j) => j === i ? { ...x, category_id: e.target.value } : x))}
                          className="text-xs text-gray-500 bg-transparent border-none outline-none cursor-pointer max-w-[120px]"
                        >
                          {categories.filter(c => c.type === 'expense').map(c => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <span className={`text-sm font-bold flex-shrink-0 ${t.valor > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {t.valor < 0 ? '+' : ''}{formatCurrency(Math.abs(t.valor))}
                    </span>
                    <button
                      onClick={() => setTransactions(ts => ts.filter((_, j) => j !== i))}
                      className="text-gray-300 hover:text-red-400 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {result.total_fatura && (
                <div className="mt-4 pt-3 border-t flex justify-between text-sm">
                  <span className="text-gray-500">Total da fatura</span>
                  <span className="font-bold text-red-500">{formatCurrency(result.total_fatura)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
