import { readFileSync } from 'fs'
import { getDocument, GlobalWorkerOptions } from './node_modules/pdfjs-dist/legacy/build/pdf.mjs'
import { fileURLToPath } from 'url'
import { resolve } from 'path'

const workerPath = resolve('./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
GlobalWorkerOptions.workerSrc = new URL('file://' + workerPath).href

const buf = readFileSync('C:/Users/JALES/Downloads/PicPay_Fatura_062026 (1).pdf')
const pdf = await getDocument({ data: new Uint8Array(buf), useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise

let text = ''
for (let i = 1; i <= Math.min(pdf.numPages, 4); i++) {
  const page = await pdf.getPage(i)
  const c = await page.getTextContent()
  text += c.items.map(x => x.str).join('\n') + '\n===PAGE ' + i + '===\n'
}
// Show all pages
console.log(text)
