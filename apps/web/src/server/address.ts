import { getAddress } from 'viem'
import { z } from 'zod'

export const addressSchema = z.string().transform((address, context) => {
  try {
    return getAddress(address)
  } catch {
    context.addIssue({ code: 'custom', message: 'Invalid wallet address' })
    return z.NEVER
  }
})

export const toStoredAddress = (address: string): string =>
  addressSchema.parse(address).toLowerCase()

export const toChecksumAddress = (address: string): string =>
  addressSchema.parse(address)
