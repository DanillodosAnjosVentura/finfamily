const PLUGGY_API = 'https://api.pluggy.ai'

// Obtém um apiKey temporário do Pluggy (válido por 2h)
export async function getPluggyApiKey(): Promise<string> {
  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pluggy auth failed: ${err}`)
  }
  const data = await res.json()
  return data.apiKey
}

// Gera um connect token para abrir o widget no navegador
export async function createConnectToken(apiKey: string, itemId?: string): Promise<string> {
  const body: Record<string, unknown> = {}
  if (itemId) body.itemId = itemId  // para reconectar um item existente

  const res = await fetch(`${PLUGGY_API}/connect_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Falha ao gerar connect token')
  const data = await res.json()
  return data.accessToken
}

// Busca detalhes de um item (conexão bancária)
export async function getItem(apiKey: string, itemId: string) {
  const res = await fetch(`${PLUGGY_API}/items/${itemId}`, {
    headers: { 'X-API-KEY': apiKey },
  })
  if (!res.ok) throw new Error('Item não encontrado')
  return res.json()
}

// Busca contas de um item
export async function getAccounts(apiKey: string, itemId: string) {
  const res = await fetch(`${PLUGGY_API}/accounts?itemId=${itemId}`, {
    headers: { 'X-API-KEY': apiKey },
  })
  if (!res.ok) throw new Error('Falha ao buscar contas')
  const data = await res.json()
  return data.results as PluggyAccount[]
}

// Busca transações de uma conta com paginação
export async function getTransactions(
  apiKey: string,
  accountId: string,
  from?: string,
  to?: string,
): Promise<PluggyTransaction[]> {
  const params = new URLSearchParams({ accountId, pageSize: '500' })
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const res = await fetch(`${PLUGGY_API}/transactions?${params}`, {
    headers: { 'X-API-KEY': apiKey },
  })
  if (!res.ok) throw new Error('Falha ao buscar transações')
  const data = await res.json()
  return data.results as PluggyTransaction[]
}

// Mapeia categoria Pluggy → categoria FinFamily (por nome)
export function mapPluggyCategory(pluggyCategory: string): string {
  const map: Record<string, string> = {
    'Alimentação e bebidas': 'Alimentação',
    'Restaurante': 'Alimentação',
    'Supermercado': 'Mercado',
    'Transporte': 'Transporte',
    'Combustível': 'Transporte',
    'Saúde': 'Saúde',
    'Farmácia': 'Saúde',
    'Educação': 'Educação',
    'Entretenimento': 'Lazer',
    'Assinaturas': 'Internet',
    'Telecomunicações': 'Telefonia',
    'Salário': 'Salário',
    'Transferência recebida': 'Renda Extra',
  }
  for (const [key, value] of Object.entries(map)) {
    if (pluggyCategory?.toLowerCase().includes(key.toLowerCase())) return value
  }
  return 'Outros'
}

export interface PluggyAccount {
  id: string
  name: string
  type: 'BANK' | 'CREDIT'
  subtype: string
  balance: number
  currencyCode: string
  itemId: string
}

export interface PluggyTransaction {
  id: string
  description: string
  descriptionRaw: string | null
  date: string        // ISO date string
  amount: number      // positivo = crédito, negativo = débito
  type: 'DEBIT' | 'CREDIT'
  category: string | null
  accountId: string
  paymentData?: { payer?: { name?: string }; receiver?: { name?: string } }
}
