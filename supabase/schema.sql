-- Habilitar extensão UUID
create extension if not exists "uuid-ossp";

-- Tabela de categorias
create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  icon text not null default '💰',
  color text not null default '#64748b',
  budget_limit decimal(12,2),
  created_at timestamptz default now()
);

-- Tabela de transações
create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  amount decimal(12,2) not null,
  type text not null check (type in ('income', 'expense')),
  description text,
  date date not null,
  recurring boolean default false,
  recurring_period text check (recurring_period in ('monthly', 'yearly')),
  created_at timestamptz default now()
);

-- Tabela de metas
create table public.goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  target_amount decimal(12,2) not null,
  current_amount decimal(12,2) default 0,
  deadline date,
  category text not null check (category in ('savings', 'debt_reduction', 'investment', 'expense_cut')),
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;

-- Políticas para categorias (padrão = user_id null, visível para todos autenticados)
create policy "Categorias do sistema visíveis para todos" on public.categories
  for select using (user_id is null);

create policy "Usuário vê suas categorias" on public.categories
  for select using (auth.uid() = user_id);

create policy "Usuário cria suas categorias" on public.categories
  for insert with check (auth.uid() = user_id);

create policy "Usuário edita suas categorias" on public.categories
  for update using (auth.uid() = user_id);

create policy "Usuário deleta suas categorias" on public.categories
  for delete using (auth.uid() = user_id);

-- Políticas para transações
create policy "Usuário vê suas transações" on public.transactions
  for select using (auth.uid() = user_id);

create policy "Usuário cria suas transações" on public.transactions
  for insert with check (auth.uid() = user_id);

create policy "Usuário edita suas transações" on public.transactions
  for update using (auth.uid() = user_id);

create policy "Usuário deleta suas transações" on public.transactions
  for delete using (auth.uid() = user_id);

-- Políticas para metas
create policy "Usuário vê suas metas" on public.goals
  for select using (auth.uid() = user_id);

create policy "Usuário cria suas metas" on public.goals
  for insert with check (auth.uid() = user_id);

create policy "Usuário edita suas metas" on public.goals
  for update using (auth.uid() = user_id);

create policy "Usuário deleta suas metas" on public.goals
  for delete using (auth.uid() = user_id);

-- Inserir categorias padrão do sistema (user_id = null)
insert into public.categories (user_id, name, type, icon, color) values
  (null, 'Salário', 'income', '💰', '#22c55e'),
  (null, 'Renda Extra', 'income', '💵', '#16a34a'),
  (null, 'Investimentos', 'income', '📈', '#15803d'),
  (null, 'Alimentação', 'expense', '🍔', '#f97316'),
  (null, 'Mercado', 'expense', '🛒', '#fb923c'),
  (null, 'Transporte', 'expense', '🚗', '#3b82f6'),
  (null, 'Aluguel', 'expense', '🏠', '#8b5cf6'),
  (null, 'Financiamento Veicular', 'expense', '🚙', '#7c3aed'),
  (null, 'IPVA', 'expense', '📋', '#6d28d9'),
  (null, 'Internet', 'expense', '📶', '#06b6d4'),
  (null, 'Telefonia', 'expense', '📱', '#0891b2'),
  (null, 'Consórcio', 'expense', '🤝', '#0e7490'),
  (null, 'Lazer', 'expense', '🎉', '#ec4899'),
  (null, 'Saúde', 'expense', '💊', '#ef4444'),
  (null, 'Educação', 'expense', '📚', '#f59e0b'),
  (null, 'Ferramentas de Trabalho', 'expense', '🛠️', '#64748b');
