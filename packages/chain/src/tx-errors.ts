import { decodeErrorResult, type Abi, type Hex } from 'viem'
import predictionsAbi from '../../contracts/abis/ScoutReportPredictions.json' with { type: 'json' }

export const SCOUTREPORT_ABIS: readonly Abi[] = [predictionsAbi as Abi]

// Copy is supplied by the application; neither revert arguments nor raw errors
// are returned to the interface.
export function decodeTxError(
  error: unknown,
  messages: Readonly<Record<string, string>>,
  fallback: string,
): string {
  const seen = new Set<unknown>()
  let current = error
  for (let depth = 0; depth < 12 && current && !seen.has(current); depth++) {
    seen.add(current)
    const data =
      typeof current === 'string'
        ? current
        : typeof current === 'object' && 'raw' in current
          ? current.raw
          : typeof current === 'object' && 'data' in current
            ? current.data
            : undefined
    if (typeof data === 'string' && /^0x[0-9a-f]+$/i.test(data)) {
      for (const abi of SCOUTREPORT_ABIS) {
        try {
          const decoded = decodeErrorResult({ abi, data: data as Hex })
          return Object.hasOwn(messages, decoded.errorName)
            ? messages[decoded.errorName]
            : fallback
        } catch {
          // Try the next ABI, then any nested RPC cause.
        }
      }
    }
    current =
      typeof current === 'object' && 'cause' in current
        ? current.cause
        : undefined
  }
  return fallback
}
