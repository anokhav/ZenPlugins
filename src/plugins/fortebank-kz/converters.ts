import { Account, AccountType, Transaction } from '../../types/zenmoney'
import { ParsedHeader, ParsedTransaction } from './parser'

export function convertAccount (header: ParsedHeader): Account {
  const id = (header.accountNumber != null && header.accountNumber !== '') ? header.accountNumber : 'unknown-account'
  return {
    id,
    title: (header.accountNumber != null && header.accountNumber !== '') ? header.accountNumber : 'Fortebank Account',
    type: AccountType.checking,
    instrument: (header.currency != null && header.currency !== '') ? header.currency : 'KZT',
    syncIds: (header.accountNumber != null && header.accountNumber !== '') ? [header.accountNumber] : [],
    balance: null
  }
}

export function convertTransaction (transaction: ParsedTransaction, accountId: string): Transaction {
  const [day, month, year] = transaction.date.split('.')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))

  const isExpense = transaction.amount < 0

  // Simplify merchant creation
  const merchant = isExpense
    ? {
        title: transaction.description,
        country: null,
        city: null,
        mcc: null,
        location: null
      }
    : null

  return {
    date,
    hold: false,
    merchant,
    comment: transaction.description,
    movements: [{
      account: { id: accountId },
      sum: transaction.amount,
      invoice: null,
      fee: 0,
      id: null
    }]
  }
}
