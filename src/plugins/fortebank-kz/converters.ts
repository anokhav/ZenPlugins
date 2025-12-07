import { Account, AccountType, Transaction } from '../../types/zenmoney'
import { ParsedHeader, ParsedTransaction } from './parser'
import { parseMerchant, cleanTransactionComment } from './merchant-utils'

export function convertAccount (header: ParsedHeader): Account {
  const id = (header.accountNumber != null && header.accountNumber !== '') ? header.accountNumber : 'unknown-account'
  return {
    id,
    title: (header.accountNumber != null && header.accountNumber !== '') ? header.accountNumber : 'Fortebank Account',
    type: AccountType.checking,
    instrument: (header.currency != null && header.currency !== '') ? header.currency : 'KZT',
    syncIds: (header.accountNumber != null && header.accountNumber !== '') ? [header.accountNumber] : [],
    balance: header.balance ?? null
  }
}

export function convertTransaction (transaction: ParsedTransaction, accountId: string): Transaction {
  const [day, month, year] = transaction.date.split('.')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))

  let merchant: any = parseMerchant(transaction.description)

  if (merchant !== null) {
    merchant.mcc = transaction.mcc ?? null
  } else {
    merchant = {
      fullTitle: transaction.description,
      mcc: transaction.mcc ?? null,
      location: null
    }
  }

  const comment = cleanTransactionComment(transaction.description, merchant)

  return {
    date,
    hold: false,
    merchant,
    comment,
    movements: [{
      account: { id: accountId },
      sum: transaction.amount,
      invoice: null,
      fee: 0,
      id: null
    }]
  }
}
