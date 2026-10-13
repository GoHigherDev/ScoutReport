import { keccak256 } from 'viem'
import { cli, type Probe } from './common.ts'
import { probePolls, VOTER } from './polls.ts'
import { probeStaking, STAKERS } from './staking.ts'

export const probeWallets: Probe = async ({ client, blockNumber, record }) => {
  for (const address of new Set([...STAKERS.map(({ user }) => user), VOTER])) {
    await record(`wallet.${address}`, async () => {
      const code = await client.getCode({ address, blockNumber })
      const hasCode = code !== undefined && code !== '0x'
      return {
        hasCode,
        codeHash: hasCode ? keccak256(code) : null,
        byteLength: hasCode ? (code.length - 2) / 2 : 0,
        delegationDesignator: hasCode && code.startsWith('0xef0100'),
        sociosWallet: 'UNKNOWN',
      }
    })
  }
}

await cli(import.meta.url, [probeStaking, probePolls, probeWallets])
