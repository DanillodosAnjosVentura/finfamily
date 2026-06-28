import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' }, { status: 500 })

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Você é um assistente especializado em extrair lançamentos de faturas de cartão de crédito brasileiras.

Analise esta fatura de cartão de crédito e extraia TODOS os lançamentos/transações.

Para cada transação, extraia:
- data: formato YYYY-MM-DD (se o ano não estiver explícito, use ${new Date().getFullYear()})
- descricao: descrição do estabelecimento/lançamento (limpa e legível)
- valor: valor em número decimal positivo para compras/débitos, negativo para créditos/estornos
- categoria_sugerida: uma das categorias: Alimentação, Transporte, Lazer, Saúde, Mercado, Educação, Ferramentas de Trabalho, Telefonia, Internet, Outros

Retorne APENAS um JSON válido no formato:
{
  "transacoes": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "Nome do estabelecimento",
      "valor": 99.90,
      "categoria_sugerida": "Alimentação"
    }
  ],
  "total_fatura": 0.00,
  "vencimento": "YYYY-MM-DD"
}`,
            },
          ],
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Resposta inválida da IA')

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Não foi possível extrair transações do PDF')

    // Tentar reparar JSON truncado fechando arrays/objetos abertos
    let jsonStr = jsonMatch[0]
    let result
    try {
      result = JSON.parse(jsonStr)
    } catch {
      // Tentar fechar JSON incompleto
      const openBrackets = (jsonStr.match(/\[/g) || []).length - (jsonStr.match(/\]/g) || []).length
      const openBraces = (jsonStr.match(/\{/g) || []).length - (jsonStr.match(/\}/g) || []).length
      // Remover vírgula/linha incompleta do final
      jsonStr = jsonStr.replace(/,\s*$/, '').replace(/,\s*\{[^}]*$/, '')
      for (let i = 0; i < openBrackets; i++) jsonStr += ']'
      for (let i = 0; i < openBraces; i++) jsonStr += '}'
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
