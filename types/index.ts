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
  created_at: string
  category?: Category
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
