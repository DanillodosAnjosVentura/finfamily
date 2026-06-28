import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
  pdfjsLib.GlobalWorkerOptions.workerSrc = false

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise
  const texts: string[] = []

  for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => item.str)
      .join(' ')
    texts.push(pageText)
  }

  return texts.join('\n')
}

// Filtra apenas linhas com padrão de transação (data + valor)
function filterTransactionLines(text: string): string {
  const lines = text.split(/[\n\r]+/)
  const relevant = lines.filter(line => {
    const hasDate = /\d{2}[\/\-]\d{2}/.test(line)
    const hasValue = /R?\$?\s*\d+[.,]\d{2}/.test(line) || /\d+,\d{2}/.test(line)
    const hasMerchant = line.trim().length > 5
    return (hasDate || hasValue) && hasMerchant
  })
  // Retorna no máximo 400 linhas relevantes (~8000 tokens)
  return relevant.slice(0, 400).join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

    const buffer = Buffer.from(await file.arrayBuffer())

    // Extrair texto localmente (gratuito, sem IA)
    let text: string
    try {
      text = await extractTextFromPDF(buffer)
    } catch {
      return NextResponse.json({ error: 'Não foi possível ler o PDF. Tente um PDF com texto selecionável.' }, { status: 400 })
    }

    if (!text || text.trim().length < 30) {
      return NextResponse.json({ error: 'PDF não contém texto legível (pode ser imagem escaneada).' }, { status: 400 })
    }

    // Filtrar apenas linhas de transação — reduz tokens em ~70%
    const filteredText = filterTransactionLines(text)
    const textToSend = filteredText.length > 200 ? filteredText : text.substring(0, 6000)

    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Extraia lançamentos de fatura de cartão de crédito brasileira do texto abaixo.

Retorne APENAS JSON válido:
{"transacoes":[{"data":"YYYY-MM-DD","descricao":"estabelecimento","valor":99.90,"categoria_sugerida":"Alimentação"}],"total_fatura":0.00}

Categorias possíveis: Alimentação, Transporte, Lazer, Saúde, Mercado, Educação, Ferramentas de Trabalho, Telefonia, Internet, Outros
Ano padrão se não explícito: ${new Date().getFullYear()}
Valor positivo = compra, negativo = estorno/crédito.

Texto:
${textToSend}`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Resposta inválida')

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Não foi possível extrair transações')

    let jsonStr = jsonMatch[0]
    let result
    try {
      result = JSON.parse(jsonStr)
    } catch {
      // Tentar reparar JSON truncado
      jsonStr = jsonStr.replace(/,\s*$/, '').replace(/,\s*\{[^}]*$/, '')
      const ob = (jsonStr.match(/\[/g) || []).length - (jsonStr.match(/\]/g) || []).length
      const oc = (jsonStr.match(/\{/g) || []).length - (jsonStr.match(/\}/g) || []).length
      for (let i = 0; i < ob; i++) jsonStr += ']'
      for (let i = 0; i < oc; i++) jsonStr += '}'
      result = JSON.parse(jsonStr)
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Erro ao processar PDF:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
