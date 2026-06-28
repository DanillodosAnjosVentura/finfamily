import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const MESES: Record<string, string> = {
  jan:'01',fev:'02',mar:'03',abr:'04',mai:'05',jun:'06',
  jul:'07',ago:'08',set:'09',out:'10',nov:'11',dez:'12',
  'jan.':'01','fev.':'02','mar.':'03','abr.':'04','mai.':'05','jun.':'06',
  'jul.':'07','ago.':'08','set.':'09','out.':'10','nov.':'11','dez.':'12',
}

function parseBRValue(val: string): number {
  return parseFloat(val.replace(/\./g, '').replace(',', '.'))
}

// Parser regex para Nubank (gratuito, sem IA)
function parseNubank(text: string): { transacoes: object[]; total_fatura: number } | null {
  // Detectar se é Nubank
  if (!/nubank/i.test(text)) return null

  const year = new Date().getFullYear()
  const transacoes: object[] = []

  // Formato Nubank: "12 Jan Descrição do gasto R$ 123,45" ou "12 Jan Descrição 123,45"
  const regex = /(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?\s+(.+?)\s+(?:R\$\s*)?([\d\.]+,\d{2})/gi
  let match
  while ((match = regex.exec(text)) !== null) {
    const dia = match[1].padStart(2, '0')
    const mes = MESES[match[2].toLowerCase().replace('.', '')] || '01'
    const descricao = match[3].trim()
    const valor = parseBRValue(match[4])

    // Ignorar linhas que são totais/resumos
    if (/total|fatura|pagamento|saldo|limite|crédito/i.test(descricao)) continue
    if (valor <= 0 || valor > 50000) continue

    transacoes.push({
      data: `${year}-${mes}-${dia}`,
      descricao,
      valor,
      categoria_sugerida: guessCategory(descricao),
    })
  }

  if (transacoes.length === 0) return null

  // Total da fatura
  const totalMatch = text.match(/total\s+(?:da\s+)?fatura[\s\S]*?([\d\.]+,\d{2})/i)
  const total_fatura = totalMatch ? parseBRValue(totalMatch[1]) : 0

  return { transacoes, total_fatura }
}

function guessCategory(desc: string): string {
  const d = desc.toLowerCase()
  if (/ifood|rappi|uber.?eats|delivery|restaurante|lanche|pizza|burguer|cafe|padaria|sushi/.test(d)) return 'Alimentação'
  if (/uber|99|taxi|combustivel|gasolina|posto|shell|ipiranga|petrobras|estacion/.test(d)) return 'Transporte'
  if (/netflix|spotify|cinema|teatro|show|steam|playstation|xbox|amazon.?prime/.test(d)) return 'Lazer'
  if (/farmacia|drogaria|medico|consulta|hospital|clinica|laboratorio|exame/.test(d)) return 'Saúde'
  if (/mercado|supermercado|carrefour|extra|pao.?de.?acucar|atacadao|hortifruti/.test(d)) return 'Mercado'
  if (/amazon|magazine|casas.?bahia|americanas|shopee|aliexpress/.test(d)) return 'Outros'
  if (/tim|vivo|claro|oi|nextel|net\s|sky\s/.test(d)) return 'Telefonia'
  if (/claude|openai|chatgpt|github|google.?workspace|microsoft|adobe/.test(d)) return 'Ferramentas de Trabalho'
  return 'Outros'
}

async function extractText(buffer: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  })
  const pdf = await loadingTask.promise
  const texts: string[] = []
  for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    texts.push(content.items.map((x: any) => x.str).join(' '))
  }
  return texts.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    // 1. Extrair texto do PDF (gratuito)
    let text = ''
    try {
      text = await extractText(buffer)
    } catch (e) {
      console.error('pdfjs error:', e)
    }

    // 2. Tentar parser Nubank (gratuito, sem IA)
    if (text) {
      const nubank = parseNubank(text)
      if (nubank && nubank.transacoes.length > 0) {
        return NextResponse.json(nubank)
      }
    }

    // 3. Fallback: Claude com texto limitado (custo mínimo)
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Não foi possível processar o PDF. Configure ANTHROPIC_API_KEY.' }, { status: 500 })

    // Enviar no máximo 3000 chars ao Claude
    const shortText = text
      ? text.replace(/\s+/g, ' ').substring(0, 3000)
      : ''

    if (!shortText || shortText.length < 50) {
      return NextResponse.json({ error: 'PDF sem texto legível (pode ser imagem escaneada).' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Extraia lançamentos de fatura de cartão brasileira. Retorne APENAS JSON válido:
{"transacoes":[{"data":"YYYY-MM-DD","descricao":"nome","valor":99.90,"categoria_sugerida":"Alimentação"}],"total_fatura":0.00}
Ano: ${new Date().getFullYear()}. Categorias: Alimentação,Transporte,Lazer,Saúde,Mercado,Educação,Ferramentas de Trabalho,Telefonia,Internet,Outros

${shortText}`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Resposta inválida')

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Nenhuma transação encontrada')

    let jsonStr = jsonMatch[0]
    let result
    try {
      result = JSON.parse(jsonStr)
    } catch {
      const lastComplete = jsonStr.lastIndexOf('},')
      if (lastComplete > 0) {
        jsonStr = jsonStr.substring(0, lastComplete + 1) + ']}'
      }
      result = JSON.parse(jsonStr)
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Erro:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro desconhecido' }, { status: 500 })
  }
}
