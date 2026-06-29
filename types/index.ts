export type TransactionType = 'income' | 'expense'
export type RecurringPeriod = 'monthly' | 'yearly'
export type GoalCategory = 'savings' | 'debt_reduction' | 'investment' | 'expense_cut'
export type GoalStatus = 'active' | 'completed' | 'paused'

export interface Category {
  id: string
  user_id: string | null
  name: string
  type: TransactionType
  icon: string
  color: string
  budget_limit: number | null
  created_at: string
}

export interface CreditCard {
  id: string
  user_id: string
  name: string
  closing_day: number
  color: string
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  category_id: string
  amount: number
  type: TransactionType
  description: string | null
  date: string
  recurring: boolean
  recurring_period: RecurringPeriod | null
  billing_period: string | null   // YYYY-MM — mês de competência da fatura
  credit_card_id: string | null
  created_at: string
  category?: Category
  credit_card?: CreditCard
}

export interface Goal {
  id: string
  user_id: string
  title: string
  description: string | null
  target_amount: number
  current_amount: number
  deadline: string | null
  category: GoalCategory
  status: GoalStatus
  created_at: string
}

// Retorna o mês de competência de uma compra dado o dia de fechamento do cartão
export function getBillingPeriod(purchaseDate: string, closingDay: number): string {
  const d = new Date(purchaseDate + 'T12:00:00')
  const day = d.getDate()
  const month = d.getMonth()
  const year = d.getFullYear()
  if (day > closingDay) {
    const next = new Date(year, month + 1, 1)
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
  }
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

// Período efetivo para filtros: usa billing_period se existir, senão mês da data
export function effectivePeriod(t: Transaction): string {
  return t.billing_period ?? t.date.substring(0, 7)
}
