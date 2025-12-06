import * as fs from 'fs'
import * as path from 'path'
import { detectLocale, splitSections, parseHeader, parseTransactions, normalizeText } from '../parser'

const TEST_DATA_DIR = path.join(__dirname, 'test_data')

describe('Fortebank KZ E2E Parsing', () => {
  const filePath = path.join(TEST_DATA_DIR, 'statementKZT-RU.txt')
  const fileContent = fs.readFileSync(filePath, 'utf-8')

  it('should recognize RU locale', () => {
    const locale = detectLocale(fileContent)
    expect(locale).toBe('ru')
  })

  it('should normalize text correctly', () => {
    const raw = 'П о к у п к а'
    const normalized = normalizeText(raw)
    expect(normalized).toBe('Покупка')
  })

  it('should parse sections correctly', () => {
    const locale = detectLocale(fileContent)
    const sections = splitSections(fileContent, locale)

    expect(sections.header).toBeDefined()
    expect(sections.transactions).toBeDefined()
    expect(sections.attic).toBeDefined()

    // Check that header contains account info raw text
    expect(sections.header).toContain('Н о м е р   с ч е т а')
    expect(sections.header).toContain('K Z 9 9 9 9 9 9 9 9 9 9 9 9 9 9 9 9 9 9')

    // Check that transactions section contains some transaction data
    expect(sections.transactions).toContain('3 0 . 1 1 . 2 0 2 5')
    expect(sections.transactions).toContain('- 5 5 5 0 . 0 0')
  })

  it('should parse header details correctly', () => {
    const locale = detectLocale(fileContent)
    const sections = splitSections(fileContent, locale)
    const header = parseHeader(sections.header)

    expect(header.accountNumber).toBe('KZ999999999999999999')
    expect(header.currency).toBe('KZT')
  })

  it('should parse all transactions correctly', () => {
    const locale = detectLocale(fileContent)
    const sections = splitSections(fileContent, locale)
    const transactions = parseTransactions(sections.transactions)

    expect(transactions).toHaveLength(10)

    // Transaction 1
    expect(transactions[0]).toEqual({
      date: '30.11.2025',
      amount: -5550.00,
      description: expect.stringContaining('Покупка\nIP ZOKIROV')
    })

    // Transaction 7 (Multicurrency/Conversion case?)
    // Original: - 1 4 7 3 . 4 5   K Z T\n( 2 . 8 2   U S D )
    // Normalized should handle this.
    expect(transactions[6].date).toBe('26.11.2025')
    expect(transactions[6].amount).toBe(-1473.45)
    // Check description contains normalized text
    expect(transactions[6].description).toContain('(2.82 USD)')
    expect(transactions[6].description).toContain('aliexpress Singapore SG')
  })
})
