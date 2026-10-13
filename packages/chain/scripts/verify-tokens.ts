import { getDataChain, verifyTokens } from '../src/index.ts'

try {
  const chain = getDataChain()
  const results = await verifyTokens(chain.id)
  console.log(`Fan Token verification on ${chain.name} (${chain.id})`)
  results.forEach((result) => console.log(result))
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Fan Token verification failed.',
  )
  process.exitCode = 1
}
