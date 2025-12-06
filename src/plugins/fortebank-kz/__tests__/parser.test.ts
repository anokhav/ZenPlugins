import { normalizeText, detectLocale, splitSections, parseHeader, parseTransactions } from '../parser'

const EN_TEXT = `
Statement
K Z 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8
K Z T
D a t e S u m D e s c r i p t i o n D e t a i l s
0 1 . 0 1 . 2 0 2 3   - 1 0 0 . 0 0   P u r c h a s e
S o m e   S h o p
0 2 . 0 1 . 2 0 2 3   1 0 0 0 . 0 0   T r a n s f e r
D a t e S u m D e s c r i p t i o n D e t a i l s
Attic text
`

describe('Fortebank Parser', () => {
  describe('normalizeText', () => {
    it('should normalize spaced out text', () => {
      expect(normalizeText('T E X T')).toBe('TEXT')
      expect(normalizeText('D a t e')).toBe('Date')
      expect(normalizeText('1 0 0 . 0 0')).toBe('100.00')
      expect(normalizeText('K Z 1 2')).toBe('KZ12')
    })

    it('should preserve newlines', () => {
      expect(normalizeText('A\nB')).toBe('A\nB')
    })
  })

  describe('detectLocale', () => {
    it('should detect EN', () => {
      expect(detectLocale('Statement')).toBe('en')
      expect(detectLocale('S t a t e m e n t')).toBe('en')
    })
    it('should detect RU', () => {
      expect(detectLocale('В ы п и с к а')).toBe('ru')
    })
    it('should detect KZ', () => {
      expect(detectLocale('К ө ш і р м е')).toBe('kz')
    })
  })

  describe('splitSections', () => {
    it('should split sections correctly for EN', () => {
      const sections = splitSections(EN_TEXT, 'en')
      expect(sections.header).toContain('K Z 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8')
      expect(sections.transactions).toContain('0 1 . 0 1 . 2 0 2 3')
      expect(sections.attic).toContain('Attic text')
    })
  })

  describe('parseHeader', () => {
    it('should parse account number and currency', () => {
      const headerText = `
      K Z 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8
      K Z T
      `
      const header = parseHeader(headerText)
      expect(header.accountNumber).toBe('KZ123456789012345678')
      expect(header.currency).toBe('KZT')
    })
  })

  describe('parseTransactions', () => {
    it('should parse transactions from spaced text', () => {
      const transText = `
0 1 . 0 1 . 2 0 2 3   - 1 0 0 . 0 0   P u r c h a s e
S o m e   S h o p
0 2 . 0 1 . 2 0 2 3   1 0 0 0 . 0 0   T r a n s f e r
      `
      const transactions = parseTransactions(transText)
      expect(transactions).toHaveLength(2)

      expect(transactions[0].date).toBe('01.01.2023')
      expect(transactions[0].amount).toBe(-100.00)
      expect(transactions[0].description).toContain('Purchase')
      expect(transactions[0].description).toContain('Some Shop')

      expect(transactions[1].date).toBe('02.01.2023')
      expect(transactions[1].amount).toBe(1000.00)
      expect(transactions[1].description).toContain('Transfer')
    })
  })
})
