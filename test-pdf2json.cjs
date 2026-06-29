const PDFParser = require('pdf2json')
const fs = require('fs')

const parser = new PDFParser(null, true)
const buf = fs.readFileSync('C:/Users/JALES/Downloads/PicPay_Fatura_062026 (1).pdf')

parser.on('pdfParser_dataError', (e) => console.error('ERROR:', e))
parser.on('pdfParser_dataReady', (data) => {
  console.log('Pages:', data?.Pages?.length)
  if (data?.Pages?.[0]) {
    const page = data.Pages[0]
    console.log('Texts count:', page?.Texts?.length)
    // Show first 20 text items
    const texts = page?.Texts?.slice(0, 20).map(t =>
      decodeURIComponent(t?.R?.map(r => r?.T || '').join(''))
    )
    console.log('First texts:', JSON.stringify(texts, null, 2))
  }
  // Also try getRawTextContent
  try {
    console.log('\nRaw text (first 500):')
    console.log(parser.getRawTextContent().substring(0, 500))
  } catch(e) { console.log('no getRawTextContent') }
})

parser.parseBuffer(buf)
