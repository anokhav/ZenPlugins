export type Locale = 'ru' | 'en' | 'kz'

export interface ParsedSections {
  header: string
  transactions: string
  attic: string
}

export interface ParsedHeader {
  accountNumber?: string
  currency?: string
}

export interface ParsedTransaction {
  date: string
  amount: number
  description: string
}

const HEADERS: Record<Locale, string> = {
  en: 'D a t e S u m D e s c r i p t i o n D e t a i l s',
  ru: 'Д а т а С у м м а О п и с а н и е Д е т а л и з а ц и я',
  kz: 'К ү н і С о м а C и п а т т а м а с ы Т а л д а м а'
}

export function normalizeText (text: string): string {
  return text
    .replace(/["']/g, '')
    .replace(/(.) (?=.)/g, '$1') // Remove single spaces between characters (e.g., "T E X T" -> "TEXT")
    .replace(/\r\n/g, '\n')
    .trim()
}

export function detectLocale (text: string): Locale {
  if (text.includes('S t a t e m e n t') || text.includes('Statement')) {
    return 'en'
  }
  if (text.includes('В ы п и с к а') || text.includes('Выписка')) {
    return 'ru'
  }
  if (text.includes('К ө ш і р м е') || text.includes('Көшірме')) {
    return 'kz'
  }

  if (text.includes('D a t e') && text.includes('S u m')) {
    return 'en'
  }
  if (text.includes('Д а т а') && text.includes('С у м м а')) {
    return 'ru'
  }
  if (text.includes('К ү н і') && text.includes('С о м а')) {
    return 'kz'
  }

  throw new Error('Unknown locale')
}

export function splitSections (text: string, locale: Locale): ParsedSections {
  const headerString = HEADERS[locale]
  const parts = text.split(headerString)

  if (parts.length < 3) {
    console.warn(`Header string "${headerString}" found ${parts.length - 1} times. Expected at least 2.`)
    if (parts.length === 2) {
      return {
        header: parts[0],
        transactions: parts[1],
        attic: ''
      }
    }
    return {
      header: text,
      transactions: '',
      attic: ''
    }
  }

  const header = parts[0]
  const attic = parts[parts.length - 1]
  const transactions = parts.slice(1, parts.length - 1).join('\n')

  return {
    header,
    transactions,
    attic
  }
}

export function parseHeader (text: string): ParsedHeader {
  const normalized = normalizeText(text)

  const ibanMatch = normalized.match(/KZ[0-9A-Z]{18}/)
  const accountNumber = ibanMatch !== null ? ibanMatch[0] : undefined

  const currencyMatch = normalized.match(/\b(KZT|USD|EUR|RUB|GBP)\b/)
  const currency = currencyMatch !== null ? currencyMatch[0] : undefined

  return {
    accountNumber,
    currency
  }
}

export function parseTransactions (text: string): ParsedTransaction[] {
  const normalized = normalizeText(text)
  let lines = normalized.split('\n')
  const transactions: ParsedTransaction[] = []

  const rowStartRegex = /^(\d{2}\.\d{2}\.\d{4})\s*([-+]?[\d]+[.,]\d{2})(.*)$/
  const dateOnlyRegex = /^\d{2}\.\d{2}\.\d{4}$/
  const amountStartRegex = /^[-+]?[\d]+[.,]\d{2}/

  // Pre-process to merge split date and amount lines
  const mergedLines: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i]
    const trimmedLine = currentLine.trim()

    if (dateOnlyRegex.test(trimmedLine) && i + 1 < lines.length) {
      const nextLine = lines[i + 1]
      const trimmedNextLine = nextLine.trim()

      if (amountStartRegex.test(trimmedNextLine)) {
        mergedLines.push(`${trimmedLine} ${trimmedNextLine}`)
        i++
        continue
      }
    }
    mergedLines.push(currentLine)
  }
  lines = mergedLines

  let currentTransaction: ParsedTransaction | null = null

  for (const line of lines) {
    const match = line.trim().match(rowStartRegex)
    if (match !== null) {
      if (currentTransaction !== null) {
        transactions.push(currentTransaction)
      }

      const date = match[1]
      const amountStr = match[2].replace(/\s/g, '').replace(',', '.')
      const amount = parseFloat(amountStr)
      const description = match[3].trim()

      currentTransaction = {
        date,
        amount,
        description
      }
    } else {
      if (currentTransaction !== null && line.trim() !== '') {
        currentTransaction.description += '\n' + line.trim()
      }
    }
  }

  if (currentTransaction !== null) {
    transactions.push(currentTransaction)
  }

  return transactions
}
