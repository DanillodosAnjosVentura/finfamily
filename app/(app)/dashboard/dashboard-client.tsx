'use client'

import { Transaction, effectivePeriod } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/format'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from 'lucide-react'

interface Props {
  transactions: Transaction[]
  historicalTransactions: { amount: number; type: string; date: string }[]
}

export function DashboardClient({ transactions, historicalTransactions }: Props) {
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const balance = totalIncome - totalExpense
  const savings = balance > 0 ? balance : 0

  // Gastos por categoria para o PieChart
  const expenseByCategory: Record<string, { name: string; value: number; color: string; icon: string }> = {}
  transactions
    .filter(t => t.type === 'expense' && t.category)
    .forEach(t => {
      const key = t.category!.id
      if (!expenseByCategory[key]) {
        expenseByCategory[key] = {
          name: t.category!.name,
          value: 0,
          color: t.category!.color,
          icon: t.category!.icon,
        }
      }
      expenseByCategory[key].value += Number(t.amount)
    })
  const pieData = Object.values(expenseByCategory).sort((a, b) => b.value - a.value)

  // Evolução mensal para BarChart
  const monthlyData: Record<string, { month: string; receitas: number; despesas: number }> = {}
  historicalTransactions.forEach(t => {
    const monthKey = (t as Transaction).billing_period ?? t.date.substring(0, 7)
    if (!monthlyData[monthKey]) {
        const label = format(parseISO(monthKey + '-01'), 'MMM/yy', { locale: ptBR })
      monthlyData[monthKey] = { month: label, receitas: 0, despesas: 0 }
    }
    if (t.type === 'income') monthlyData[monthKey].receitas += Number(t.amount)
    else monthlyData[monthKey].despesas += Number(t.amount)
  })
  const barData = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)

  const currentMonth = format(new Date(), 'MMMM yyyy', { locale: ptBR })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm capitalize">{currentMonth}</p>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Receitas"
          value={totalIncome}
          icon={<TrendingUp className="w-5 h-5 text-green-600" />}
          valueClass="text-green-600"
          bg="bg-green-50"
        />
        <SummaryCard
          title="Despesas"
          value={totalExpense}
          icon={<TrendingDown className="w-5 h-5 text-red-500" />}
          valueClass="text-red-500"
          bg="bg-red-50"
        />
        <SummaryCard
          title="Saldo"
          value={balance}
          icon={<Wallet className="w-5 h-5 text-blue-600" />}
          valueClass={balance >= 0 ? 'text-blue-600' : 'text-red-500'}
          bg="bg-blue-50"
        />
        <SummaryCard
          title="Economia"
          value={savings}
          icon={<PiggyBank className="w-5 h-5 text-purple-600" />}
          valueClass="text-purple-600"
          bg="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico pizza por categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gastos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">Nenhuma despesa no mês</p>
            ) : (
              <div className="flex flex-col gap-4">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {pieData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-600">{item.icon} {item.name}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de barras evolução mensal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução dos Últimos 6 Meses</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">Sem dados históricos</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                  <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimas transações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas Transações do Mês</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Nenhuma transação este mês</p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 8).map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{t.category?.icon ?? '💳'}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t.description || t.category?.name || 'Sem descrição'}</p>
                      <p className="text-xs text-gray-400">{t.date ? format(parseISO(t.date), 'dd/MM/yyyy') : ''} · {t.category?.name}</p>
                    </div>
                  </div>
                  <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ title, value, icon, valueClass, bg }: {
  title: string
  value: number
  icon: React.ReactNode
  valueClass: string
  bg: string
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
        </div>
        <p className={`text-2xl font-bold ${valueClass}`}>{formatCurrency(value)}</p>
      </CardContent>
    </Card>
  )
}
