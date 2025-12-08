import { AccountReferenceById, AccountType } from '../../../types/zenmoney'
import { convertAccount, convertTransaction } from '../converters'
import { ParsedTransaction } from '../parser'

describe('Fortebank Converters', () => {
  describe('convertAccount', () => {
    it('should convert parsed header to account', () => {
      const header = {
        accountNumber: 'KZ1234567890',
        currency: 'KZT'
      }
      const account = convertAccount(header)
      expect(account).toEqual({
        id: 'KZ1234567890',
        title: 'KZ1234567890',
        type: AccountType.checking,
        instrument: 'KZT',
        syncIds: ['KZ1234567890'],
        balance: null
      })
    })

    it('should handle missing header fields', () => {
      const account = convertAccount({})
      expect(account.id).toBe('unknown-account')
      expect(account.instrument).toBe('KZT')
    })

    it('should convert header with balance', () => {
      const header = {
        accountNumber: 'KZ123',
        currency: 'KZT',
        balance: 123.45
      }
      const account = convertAccount(header)
      expect(account.balance).toBe(123.45)
    })
  })

  describe('convertTransaction', () => {
    it('should convert parsed expense transaction', () => {
      const pt: ParsedTransaction = {
        date: '01.01.2023',
        amount: -100.00,
        description: 'Purchase SuperStore',
        mcc: 5411,
        operation: 'Purchase',
        details: 'SuperStore',
        originString: ''
      }
      const transaction = convertTransaction(pt, 'acc1')
      expect(transaction.date).toEqual(new Date(2023, 0, 1))
      expect(transaction.movements[0].sum).toBe(-100.00)
      expect((transaction.movements[0].account as AccountReferenceById).id).toBe('acc1')
      // Expect parsed merchant (fallback logic)
      expect(transaction.merchant).toEqual({
        title: 'SuperStore',
        city: null,
        country: null,
        mcc: 5411,
        location: null
      })
      expect(transaction.comment).toBe('Purchase SuperStore')
    })

    it('should convert transaction with location', () => {
      const pt: ParsedTransaction = {
        date: '03.01.2023',
        amount: -500.00,
        description: 'Payment Starbucks Almaty KZ',
        operation: 'Payment',
        details: 'Starbucks Almaty KZ',
        originString: ''
      }
      const transaction = convertTransaction(pt, 'acc1')
      expect(transaction.merchant).toEqual({
        title: 'Starbucks',
        city: 'Almaty',
        country: 'Kazakhstan',
        mcc: null,
        location: null
      })
      expect(transaction.comment).toBe('Payment Starbucks')
    })

    it('should convert parsed income transaction', () => {
      const pt: ParsedTransaction = {
        date: '02.01.2023',
        amount: 1000.00,
        description: 'Transfer',
        operation: 'Transfer',
        details: '',
        originString: ''
      }
      const transaction = convertTransaction(pt, 'acc1')
      expect(transaction.date).toEqual(new Date(2023, 0, 2))
      expect(transaction.movements[0].sum).toBe(1000.00)
      expect(transaction.merchant).toBeNull()
      expect(transaction.comment).toBe('Transfer')
    })

    it('should use parsedDetails when available', () => {
      const pt: ParsedTransaction = {
        date: '04.01.2023',
        amount: -5000.00,
        description: 'Cash withdrawal Halyk Bank, ATM 12345, Almaty',
        operation: 'Cash withdrawal',
        details: 'Halyk Bank, ATM 12345, Almaty',
        parsedDetails: {
          merchantBank: 'Halyk Bank',
          atmCode: 'ATM 12345',
          merchantLocation: 'Almaty, KZ'
        },
        originString: ''
      }

      const transaction = convertTransaction(pt, 'acc1')
      expect(transaction.merchant).toBeNull()
      expect(transaction.comment).toContain('Bank: Halyk Bank')
      expect(transaction.comment).toContain('ATM: ATM 12345')
    })

    it('should use parsedDetails for Purchase', () => {
      const pt: ParsedTransaction = {
        date: '05.01.2023',
        amount: -200.00,
        description: 'Purchase Apple Services, Bank X, MCC: 1234',
        operation: 'Purchase',
        details: 'Apple Services, Bank X, MCC: 1234',
        parsedDetails: {
          merchantName: 'Apple Services',
          merchantBank: 'Bank X',
          mcc: 1234
        },
        originString: ''
      }

      const transaction = convertTransaction(pt, 'acc1')
      expect(transaction.merchant).toEqual({
        title: 'Apple Services',
        city: null,
        country: null,
        mcc: 1234,
        location: null
      })
      expect(transaction.comment).toBe('Bank: Bank X')
    })
  })
})
