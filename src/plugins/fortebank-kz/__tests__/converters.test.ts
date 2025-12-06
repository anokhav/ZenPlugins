import { AccountReferenceById, AccountType } from '../../../types/zenmoney'
import { convertAccount, convertTransaction } from '../converters'

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
  })

  describe('convertTransaction', () => {
    it('should convert parsed expense transaction', () => {
      const pt = {
        date: '01.01.2023',
        amount: -100.00,
        description: 'Purchase Shop'
      }
      const transaction = convertTransaction(pt, 'acc1')
      expect(transaction.date).toEqual(new Date(2023, 0, 1))
      expect(transaction.movements[0].sum).toBe(-100.00)
      expect((transaction.movements[0].account as AccountReferenceById).id).toBe('acc1')
      expect(transaction.merchant).toEqual({
        title: 'Purchase Shop',
        country: null,
        city: null,
        mcc: null,
        location: null
      })
      expect(transaction.comment).toBe('Purchase Shop')
    })

    it('should convert parsed income transaction', () => {
      const pt = {
        date: '02.01.2023',
        amount: 1000.00,
        description: 'Transfer'
      }
      const transaction = convertTransaction(pt, 'acc1')
      expect(transaction.date).toEqual(new Date(2023, 0, 2))
      expect(transaction.movements[0].sum).toBe(1000.00)
      expect(transaction.merchant).toBeNull()
      expect(transaction.comment).toBe('Transfer')
    })
  })
})
