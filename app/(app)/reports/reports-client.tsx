'use client'

import { useState, useMemo } from 'react'
import { Transaction, effectivePeriod } from '@/types'
import { formatCurrency } from '@/lib/format'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'

interface Props {
  transactions: Transaction[]
}

export function ReportsClient({ transactions }: Props) {
  const currentYear = new Date().getFullYear()
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`)
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`)

  const filtered = useMemo(() =>
    transactions.filter(t => {
      const period = effectivePeriod(t)
      return period >= startDate.substring(0, 7) && period <= endDate.substring(0, 7)
    }),
    [transactions, startDate, endDate]
  )

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  // Evolução do saldo mês a mês
  const monthlyBalance: Record<string, { month: string; receitas: number; despesas: number; saldo: number }> = {}
  filtered.forEach(t => {
    const key = effectivePeriod(t)
    if (!monthlyBalance[key]) {
      const label = format(parseISO(key + '-01'), 'MMM/yy', { locale: ptBR })
      monthlyBalance[key] = { month: label, receitas: 0, despesas: 0, saldo: 0 }
    }
    if (t.type === 'income') monthlyBalance[key].receitas += Number(t.amount)
    else monthlyBalance[key].despesas += Number(t.amount)
  })
  const lineData = Object.entries(monthlyBalance)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ ...v, saldo: v.receitas - v.despesas }))

  // Gastos por categoria
  const byCat: Record<string, { name: string; value: number; color: string; icon: string }> = {}
  filtered.filter(t => t.type === 'expense' && t.category).forEach(t => {
    const key = t.category!.id
    if (!byCat[key]) byCat[key] = { name: t.category!.name, value: 0, color: t.category!.color, icon: t.category!.icon }
    byCat[key].value += Number(t.amount)
  })
  const catData = Object.values(byCat).sort((a, b) => b.value - a.value)

  function setYear(year: number) {
    setStartDate(`${year}-01-01`)
    setEndDate(`${year}-12-31`)
  }

  function setMonth(month: string) {
    setStartDate(`${month}-01`)
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    setEndDate(`${month}-${String(lastDay).padStart(2, '0')}`)
  }

  function exportCSV() {
    const rows = [
      ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor'],
      ...filtered.map(t => [
        t.date,
        t.type === 'income' ? 'Receita' : 'Despesa',
        t.category?.name || '',
        t.description || '',
        String(t.amount),
      ])
    ]
    const csv = rows.map(r => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finfamily-${startDate}-${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-sm text-gray-500">Análise detalhada por período</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2">
          ⬇️ Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex gap-2">
              {[currentYear - 1, currentYear].map(y => (
                <Button key={y} variant="outline" size="sm" onClick={() => setYear(y)}>{y}</Button>
              ))}
              <Button variant="outline" size="sm" onClick={() => setMonth(`${currentYear}-${currentMonth}`)}>Mês Atual</Button>
            </div>
            <div className="flex gap-3 items-end ml-auto">
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Total Receitas</p><p className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Total Despesas</p><p className="text-xl font-bold text-red-500">{formatCurrency(totalExpense)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Resultado</p><p className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatCurrency(totalIncome - totalExpense)}</p></CardContent></Card>
      </div>

      {/* Evolução do saldo */}
      <Card>
        <CardHeader><CardTitle className="text-base">Evolução Mensal — Receitas vs Despesas</CardTitle></CardHeader>
        <CardContent>
          {lineData.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">Sem dados no período</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="receitas" name="Receitas" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gastos por categoria */}
        <Card>
          <CardHeader><CardTitle className="text-base">Despesas por Categoria</CardTitle></CardHeader>
          <CardContent>
            {catData.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">Sem despesas no período</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                      {catData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 max-h-52 overflow-y-auto mt-2">
                  {catData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-600">{item.icon} {item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs">{((item.value / totalExpense) * 100).toFixed(0)}%</span>
                        <span className="font-medium">{formatCurrency(item.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Barras por categoria */}
        <Card>
          <CardHeader><CardTitle className="text-base">Ranking de Gastos</CardTitle></CardHeader>
          <CardContent>
            {catData.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={catData.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Bar dataKey="value" name="Valor" radius={[0, 4, 4, 0]}>
                    {catData.slice(0, 8).map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
