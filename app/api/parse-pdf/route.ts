import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const MESES: Record<string, string> = {
  jan:'01',fev:'02',mar:'03',abr:'04',mai:'05',jun:'06',
  jul:'07',ago:'08',set:'09',out:'10',nov:'11',dez:'12',
}

function parseBRValue(val: string): number {
  return parseFloat(val.replace(/\./g, '').replace(',', '.'))
}

function guessCategory(desc: string): string {
  const d = desc.toLowerCase()
  if (/ifood|rappi|uber.?eat|delivery|restaurante|lanche|pizza|burguer|cafe|padaria|sushi|divino|fogao|fast/.test(d)) return 'Alimentação'
  if (/uber|99|taxi|combustivel|gasolina|posto|shell|ipiranga|petrobras|estacion|ônibus|bus|metro|dl\*uber/.test(d)) return 'Transporte'
  if (/netflix|spotify|cinema|teatro|show|steam|playstation|xbox|amazon.?prime|disney/.test(d)) return 'Lazer'
  if (/farmacia|drogaria|medico|consulta|hospital|clinica|laboratorio|exame/.test(d)) return 'Saúde'
  if (/mercado|supermercado|carrefour|extra|pao.?de.?acucar|atacadao|hortifruti|tatico/.test(d)) return 'Mercado'
  if (/tim|vivo|claro|oi|net\s|sky\s/.test(d)) return 'Telefonia'
  if (/claude|openai|chatgpt|github|google.?workspace|microsoft|adobe|amazon.?ad/.test(d)) return 'Ferramentas de Trabalho'
  return 'Outros'
}

// Parser PicPay: formato "DD/MM\nEstabelecimento\nValor"
function parsePicPay(text: string): { transacoes: object[]; total_fatura: number } | null {
  if (!/picpay/i.test(text)) return null

  const yearMatch = text.match(/20\d{2}/)
  const year = yearMatch ? yearMatch[0] : String(new Date().getFullYear())
  const transacoes: object[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  let i = 0
  while (i < lines.length) {
    const dateMatch = lines[i].match(/^(\d{2})\/(\d{2})$/)
    if (dateMatch) {
      const dia = dateMatch[1]
      const mes = dateMatch[2]
      let desc = ''
      let valor = 0
      let j = i + 1
      while (j < lines.length && j < i + 5) {
        const v = lines[j].match(/^([\d\.]+,\d{2})$/)
        if (v) { valor = parseBRValue(v[1]); j++; break }
        if (!/^\s*$/.test(lines[j])) desc += (desc ? ' ' : '') + lines[j]
        j++
      }
      if (desc && valor > 0 && !/total|pagamento|saldo|limite|crédito|encargo/i.test(desc)) {
        const mesNum = parseInt(mes)
        const anoNum = parseInt(year)
        const ano = mesNum > (new Date().getMonth() + 2) ? String(anoNum - 1) : year
        transacoes.push({ data: `${ano}-${mes}-${dia}`, descricao: desc, valor, categoria_sugerida: guessCategory(desc) })
      }
      i = j; continue
    }
    i++
  }

  if (transacoes.length === 0) return null
  const totalMatch = text.match(/Total da(?:\s+sua)?\s+fatura\s*\n?\s*R\$\s*([\d\.]+,\d{2})/i)
  return { transacoes, total_fatura: totalMatch ? parseBRValue(totalMatch[1]) : 0 }
}

// Parser Nubank: formato "DD Jan Descrição R$ XX,XX"
function parseNubank(text: string): { transacoes: object[]; total_fatura: number } | null {
  if (!/nubank/i.test(text)) return null
  const year = new Date().getFullYear()
  const transacoes: object[] = []
  const regex = /(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?\s+(.+?)\s+(?:R\$\s*)?([\d\.]+,\d{2})/gi
  let match
  while ((match = regex.exec(text)) !== null) {
    const dia = match[1].padStart(2, '0')
    const mes = MESES[match[2].toLowerCase()] || '01'
    const descricao = match[3].trim()
    const valor = parseBRValue(match[4])
    if (/total|fatura|pagamento|saldo|limite/i.test(descricao) || valor <= 0 || valor > 50000) continue
    transacoes.push({ data: `${year}-${mes}-${dia}`, descricao, valor, categoria_sugerida: guessCategory(descricao) })
  }
  if (transacoes.length === 0) return null
  const totalMatch = text.match(/total\s+(?:da\s+)?fatura[\s\S]*?([\d\.]+,\d{2})/i)
  return { transacoes, total_fatura: totalMatch ? parseBRValue(totalMatch[1]) : 0 }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    // Enviar PDF ao Claude para extrair texto primeiro
    const client = new Anthropic({ apiKey })

    // Passo 1: extrair texto bruto do PDF (barato - resposta curta)
    const textMsg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Extraia APENAS a lista de transações desta fatura de cartão. Para cada transação, uma linha no formato: DATA|DESCRIÇÃO|VALOR. Exemplo: 05/05|UBER RIDES|14,84. Não inclua totais, resumos ou outras informações. Apenas as linhas de transação.' }
        ]
      }]
    })

    const rawText = textMsg.content[0].type === 'text' ? textMsg.content[0].text : ''

    // Tentar parsers locais com o texto extraído pelo Claude
    if (rawText.length > 20) {
      // Parser PicPay com texto do Claude
      const picpay = parsePicPay(rawText)
      if (picpay && picpay.transacoes.length > 0) return NextResponse.json(picpay)

      const nubank = parseNubank(rawText)
      if (nubank && nubank.transacoes.length > 0) return NextResponse.json(nubank)

      // Parser genérico: formato DATA|DESCRICAO|VALOR
      const lines = rawText.split('\n').filter(l => l.includes('|'))
      if (lines.length > 0) {
        const transacoes = lines.map(line => {
          const parts = line.split('|').map(p => p.trim())
          if (parts.length < 3) return null
          const [data, descricao, valorStr] = parts
          const valor = parseBRValue(valorStr.replace(/[^0-9,]/g, ''))
          if (!valor || valor <= 0) return null
          // Converter data DD/MM para YYYY-MM-DD
          const dm = data.match(/(\d{1,2})[\/\-](\d{1,2})/)
          if (!dm) return null
          const year = new Date().getFullYear()
          const dateStr = `${year}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`
          return { data: dateStr, descricao, valor, categoria_sugerida: guessCategory(descricao) }
        }).filter(Boolean)

        if (transacoes.length > 0) {
          return NextResponse.json({ transacoes, total_fatura: 0 })
        }
      }
    }

    return NextResponse.json({ error: 'Não foi possível extrair transações desta fatura.' }, { status: 400 })

  } catch (err) {
    console.error('Erro:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro desconhecido' }, { status: 500 })
  }
}
