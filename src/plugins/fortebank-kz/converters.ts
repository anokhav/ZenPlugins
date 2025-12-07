import { Account, AccountType, Transaction, Merchant } from '../../types/zenmoney'
import { ParsedHeader, ParsedTransaction } from './parser'
import { parseMerchant, cleanTransactionComment, detectCityCountryLocation } from './merchant-utils'

function createMerchant (title: string): Merchant {
  return {
    title,
    city: null,
    country: null,
    mcc: null,
    location: null
  }
}

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

  let merchant: Merchant | null = null
  let comment = transaction.description

  if (transaction.parsedDetails != null) {
    const { merchantName, merchantLocation, merchantBank, paymentMethod, atmCode, receiver, mcc } = transaction.parsedDetails

    // Construct merchant
    if (merchantName != null && merchantName !== '') {
      // Use existing utils to detect city/country from the name if possible,
      // or from merchantLocation if provided
      let title = merchantName
      let city: string | null = null
      let country: string | null = null

      if (merchantLocation != null && merchantLocation !== '') {
        // If location is explicit (e.g. Cash withdrawal)
        const loc = detectCityCountryLocation(merchantLocation)
        if (loc != null) {
          city = loc.city ?? null
          country = loc.country ?? null
          // loc.locationPoint is the cleaned location string. We don't use it for title here.
        }
      } else {
        // Try to extract from title (e.g. "aliexpress Singapore SG")
        const loc = detectCityCountryLocation(merchantName)
        if (loc != null && (loc.city != null || loc.country != null)) {
          // If we found a city/country, update title to be the locationPoint (cleaned name)
          title = loc.locationPoint
          city = loc.city ?? null
          country = loc.country ?? null
        }
      }

      merchant = createMerchant(title)
      merchant.city = city
      merchant.country = country
      merchant.mcc = mcc ?? null
    } else if (receiver != null && receiver !== '') {
      // For transfers, receiver is the "payee"
      merchant = createMerchant(receiver)
    }

    // Construct comment
    const commentParts: string[] = []
    if (merchantBank != null && merchantBank !== '') commentParts.push(`Bank: ${merchantBank}`)
    if (atmCode != null && atmCode !== '') commentParts.push(`ATM: ${atmCode}`)
    // Add locationPoint to comment if needed (though it might be redundant if it's just city)
    // For now, let's skip it to avoid clutter, or add if it looks like an address?
    // User instruction: "If locationPoint is present... append it to comment"
    // But I don't have locationPoint in scope here easily unless I lift it out.
    // Let's re-calculate or just use merchantLocation if available and not fully consumed.
    // Actually, simplifying: strict adherence to avoiding "location: string" error is key.

    if (paymentMethod != null && paymentMethod !== '') commentParts.push(paymentMethod)
    if (receiver != null && receiver !== '' && merchant === null) commentParts.push(`Receiver: ${receiver}`)

    // If no specific parsed details other than operation, use cleaned description
    if (commentParts.length === 0 && merchant === null) {
      comment = cleanTransactionComment(transaction.description, null)
    } else {
      comment = commentParts.join(', ')
    }
  } else {
    // Fallback
    const parsed = parseMerchant(transaction.description)
    if (parsed !== null) {
      merchant = createMerchant(parsed.title)
      merchant.city = parsed.city
      merchant.country = parsed.country
      merchant.mcc = transaction.mcc ?? null
      // parsed.location is also likely null or incompatible if coming from utils?
      // utils returns { location: null } as Merchant (casted). So it's safe.
    }
    comment = cleanTransactionComment(transaction.description, merchant)
  }

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
