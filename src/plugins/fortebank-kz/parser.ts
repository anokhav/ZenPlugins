export type Locale = 'ru' | 'en' | 'kz'

export interface ParsedSections {
  header: string
  transactions: string
  attic: string
}

export interface ParsedHeader {
  accountNumber?: string
  currency?: string
  balance?: number
}

export interface ParsedTransactionDetails {
  merchantName?: string
  merchantLocation?: string
  merchantBank?: string
  paymentMethod?: string
  atmCode?: string
  receiver?: string
  mcc?: number
}

export interface ParsedTransaction {
  date: string
  amount: number
  description: string // Raw description for fallback/debugging
  operation: string
  details: string
  parsedDetails?: ParsedTransactionDetails
  mcc?: number // Kept for backward compatibility, but should be in parsedDetails
}

const HEADERS: Record<Locale, string> = {
  en: 'D a t e S u m D e s c r i p t i o n D e t a i l s',
  ru: 'Д а т а С у м м а О п и с а н и е Д е т а л и з а ц и я',
  kz: 'К ү н і С о м а C и п а т т а м а с ы Т а л д а м а'
}

const BALANCE_REGEXES: Record<Locale, RegExp> = {
  en: /Available\s*as\s*of\s*\d{2}\.\d{2}\.\d{4}:?\s*([-+]?[\d]+[.,]\d{2})/,
  ru: /Доступно\s*на\s*\d{2}\.\d{2}\.\d{4}:?\s*([-+]?[\d]+[.,]\d{2})/,
  kz: /Қолжетімді\s*\d{2}\.\d{2}\.\d{4}:?\s*([-+]?[\d]+[.,]\d{2})/
}

const KNOWN_OPERATIONS = [
  // English
  'Cash withdrawal',
  'Account replenishment',
  'Debit',
  'Transfer',
  'Refund',
  'Purchase with bonuses',
  'Purchase',
  // Russian
  'Снятие наличных', 'Снятие',
  'Пополнение счета', 'Пополнение',
  'Перевод',
  'Возврат',
  'Покупка с бонусами', 'Покупка',
  'Оплата',
  // Kazakh
  'Ақша алу',
  'Шотты толықтыру', 'Толықтыру',
  'Аударым',
  'Қайтару',
  'Сатып алу',
  'Төлем'
]

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

export function parseHeader (text: string, locale: Locale): ParsedHeader {
  const normalized = normalizeText(text)

  const ibanMatch = normalized.match(/KZ[0-9A-Z]{18}/)
  const accountNumber = ibanMatch !== null ? ibanMatch[0] : undefined

  const currencyMatch = normalized.match(/\b(KZT|USD|EUR|RUB|GBP)\b/)
  const currency = currencyMatch !== null ? currencyMatch[0] : undefined

  const balanceMatch = normalized.match(BALANCE_REGEXES[locale])
  let balance: number | undefined
  if (balanceMatch !== null) {
    balance = parseFloat(balanceMatch[1].replace(',', '.'))
  }

  return {
    accountNumber,
    currency,
    balance
  }
}

function detectOperation (fullDescription: string, amount: number): { operation: string, details: string } {
  // Sort by length desc to match longest first (e.g. "Purchase with bonuses" before "Purchase")
  const sortedOps = [...KNOWN_OPERATIONS].sort((a, b) => b.length - a.length)

  for (const op of sortedOps) {
    if (fullDescription.startsWith(op)) {
      return {
        operation: op,
        details: fullDescription.substring(op.length).trim()
      }
    }
  }

  // Fallback based on sign
  if (amount < 0) {
    return { operation: 'Purchase', details: fullDescription }
  } else {
    return { operation: 'Account replenishment', details: fullDescription }
  }
}

function parseTransactionDetails (operation: string, details: string): ParsedTransactionDetails {
  const res: ParsedTransactionDetails = {}

  // Normalize operation to EN for easier matching if needed, or just list all variants
  // For now, check against list or generic logic
  const isPurchase = ['Purchase', 'Purchase with bonuses', 'Refund', 'Покупка', 'Покупка с бонусами', 'Возврат', 'Оплата', 'Сатып алу', 'Қайтару', 'Төлем'].includes(operation)
  const isWithdrawal = ['Cash withdrawal', 'Снятие наличных', 'Снятие', 'Ақша алу'].includes(operation)
  const isTransfer = ['Transfer', 'Перевод', 'Аударым'].includes(operation)

  if (isWithdrawal) {
    // Expected: bank name, ATM code, Location
    const parts = details.split(',').map(s => s.trim())
    if (parts.length >= 1) res.merchantBank = parts[0]
    if (parts.length >= 2) res.atmCode = parts[1]
    if (parts.length >= 3) res.merchantLocation = parts.slice(2).join(', ')
  } else if (isTransfer) {
    res.receiver = details
  } else if (isPurchase) {
    // Expected: title, location, bank, mcc, payment method
    // But fields are optional and variable. Anchor is "MCC:".
    // "aliexpress Singapore SG, Bank not specified, MCC: 5734"
    // "MIRZO BOBUR TOSHKENT UZ, JSC Bank Orient Finans, MCC: 5812, GOOGLE PAY"

    const parts = details.split(',').map(s => s.trim())
    const mccIndex = parts.findIndex(p => p.toUpperCase().startsWith('MCC:'))

    if (mccIndex !== -1) {
      // MCC found
      const mccPart = parts[mccIndex]
      const mccMatch = mccPart.match(/MCC:?\s*(\d{4})/i)
      if (mccMatch !== null) {
        res.mcc = parseInt(mccMatch[1], 10)
      }

      // Fields before MCC
      const beforeMcc = parts.slice(0, mccIndex)
      // Fields after MCC
      const afterMcc = parts.slice(mccIndex + 1)

      // Heuristic for Bank in beforeMcc
      // Usually the last element before MCC is Bank, unless there is only 1 element
      if (beforeMcc.length > 0) {
        if (beforeMcc.length === 1) {
          res.merchantName = beforeMcc[0]
        } else {
          // Assume last one is Bank if it looks like a bank or if we assume specific order
          // Prompt says: "title, location, bank"
          // If 2 items: Title, Bank? Or Title, Location?
          // Example: "aliexpress Singapore SG, Bank not specified" -> Title, Bank
          // Example: "MIRZO BOBUR TOSHKENT UZ, JSC Bank Orient Finans" -> Title, Bank
          // It seems the structure is [Title (+Location?), Bank]

          res.merchantBank = beforeMcc[beforeMcc.length - 1]
          res.merchantName = beforeMcc.slice(0, beforeMcc.length - 1).join(', ')
        }
      }

      // After MCC: Payment Method
      if (afterMcc.length > 0) {
        res.paymentMethod = afterMcc.join(', ')
      }
    } else {
      // No MCC found. Fallback to simple split?
      // Or just treat everything as Title
      res.merchantName = details
    }
  } else {
    // Account replenishment, Debit, etc.
    // Just description
    res.merchantName = details
  }

  return res
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

  const finalizeTransaction = (t: ParsedTransaction): void => {
    // Clean up description newlines
    let fullDesc = t.description.trim()

    // Strip currency code from start if present (e.g. "KZT Purchase...")
    const currencyMatch = fullDesc.match(/^(KZT|USD|EUR|RUB|GBP)\s+/)
    if (currencyMatch !== null) {
      fullDesc = fullDesc.substring(currencyMatch[0].length)
    }

    const { operation, details } = detectOperation(fullDesc, t.amount)
    t.operation = operation
    t.details = details
    t.parsedDetails = parseTransactionDetails(operation, details)

    // Fallback MCC if not parsed in details but present in text (for safety)
    if (t.parsedDetails.mcc == null) {
      const mccMatch = fullDesc.match(/MCC:?\s*(\d{4})/i)
      if (mccMatch !== null) {
        t.parsedDetails.mcc = parseInt(mccMatch[1], 10)
      }
    }
    t.mcc = t.parsedDetails.mcc

    transactions.push(t)
  }

  for (const line of lines) {
    const match = line.trim().match(rowStartRegex)
    if (match !== null) {
      if (currentTransaction !== null) {
        finalizeTransaction(currentTransaction)
      }

      const date = match[1]
      const amountStr = match[2].replace(/\s/g, '').replace(',', '.')
      const amount = parseFloat(amountStr)
      const description = match[3].trim()

      currentTransaction = {
        date,
        amount,
        description,
        operation: '',
        details: ''
      }
    } else {
      if (currentTransaction !== null && line.trim() !== '') {
        currentTransaction.description += '\n' + line.trim()
      }
    }
  }

  if (currentTransaction !== null) {
    finalizeTransaction(currentTransaction)
  }

  return transactions
}
