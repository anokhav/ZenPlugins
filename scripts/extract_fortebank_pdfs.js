const fs = require('fs')
const path = require('path')
let pdf
try {
  pdf = require('pdf-extraction')
} catch (e) {
  try {
    pdf = require('pdf-extraction/lib/pdf-extraction')
  } catch (e2) {
    console.error('Could not require pdf-extraction', e2)
    process.exit(1)
  }
}

// Logic from src/common/pdfUtils.js
async function parsePage (pageData) {
  const textContent = await pageData.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: true
  })
  let lastY = 0
  let text = ''
  for (const item of textContent.items) {
    if (!lastY) {
      text += item.str
    } else if (lastY === item.transform[5]) {
      text += ' ' + item.str
    } else {
      text += '\n' + item.str
    }
    lastY = item.transform[5]
  }
  return text
}

const sourceDir = path.join(__dirname, '../src/plugins/fortebank-kz/confidential_PDF_statements')
const destDir = path.join(__dirname, '../src/plugins/fortebank-kz/__tests__/test_data')

if (!fs.existsSync(sourceDir)) {
  console.error(`Source directory not found: ${sourceDir}`)
  process.exit(1)
}

fs.readdir(sourceDir, async (err, files) => {
  if (err) {
    console.error('Error reading directory:', err)
    return
  }

  const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'))

  if (pdfFiles.length === 0) {
    console.log('No PDF files found.')
    return
  }

  console.log(`Found ${pdfFiles.length} PDF files.`)

  for (const file of pdfFiles) {
    const filePath = path.join(sourceDir, file)
    const destPath = path.join(destDir, file.replace('.pdf', '.txt'))

    console.log(`Processing ${file}...`)

    try {
      const dataBuffer = fs.readFileSync(filePath)

      const data = await pdf(dataBuffer, { pagerender: parsePage })

      fs.writeFileSync(destPath, data.text)
      console.log(`Saved text to ${destPath}`)
    } catch (e) {
      console.error(`Error processing ${file}:`, e)
    }
  }
})
