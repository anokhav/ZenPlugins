import { ScrapeFunc, Account, Transaction } from '../../types/zenmoney'
import { parsePdf } from '../../common/pdfUtils'
import { Preferences } from './models'
import { detectLocale, splitSections, parseHeader, parseTransactions } from './parser'
import { convertAccount, convertTransaction } from './converters'

export const scrape: ScrapeFunc<Preferences> = async () => {
  const blobs = await ZenMoney.pickDocuments(['application/pdf'], true)

  const accounts: Account[] = []
  const transactions: Transaction[] = []

  for (const blob of blobs) {
    try {
      const { text } = await parsePdf(blob)

      const locale = detectLocale(text)
      const sections = splitSections(text, locale)

      const parsedHeader = parseHeader(sections.header, locale)
      const parsedTransactions = parseTransactions(sections.transactions)

      const account = convertAccount(parsedHeader)

      const existingAccountIndex = accounts.findIndex(a => a.id === account.id)
      if (existingAccountIndex === -1) {
        accounts.push(account)
      }

      const accountTransactions = parsedTransactions.map(pt => convertTransaction(pt, account.id))
      transactions.push(...accountTransactions)
    } catch (error) {
      console.error('Failed to parse PDF', error)
    }
  }

  return {
    accounts,
    transactions
  }
}
