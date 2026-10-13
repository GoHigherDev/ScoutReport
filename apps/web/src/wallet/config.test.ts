import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createAppKit, adapter, createConfig } = vi.hoisted(() => ({
  createAppKit: vi.fn(() => ({ open: vi.fn() })),
  adapter: vi.fn(),
  createConfig: vi.fn(() => ({ fallback: true })),
}))
vi.mock('@reown/appkit/react', () => ({ createAppKit }))
vi.mock('@reown/appkit-adapter-wagmi', () => ({
  WagmiAdapter: class {
    wagmiConfig = { adapter: true }
    constructor(options: unknown) {
      adapter(options)
    }
  },
}))
vi.mock('wagmi', () => ({ createConfig }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_REOWN_PROJECT_ID', '')
  vi.stubEnv('NEXT_PUBLIC_APP_CHAIN_ID', '88882')
})

afterEach(() => vi.unstubAllEnvs())

describe('wallet configuration', () => {
  it('does not initialise AppKit without a project ID', async () => {
    const config = await import('./config')
    expect(config.getWalletConfig()).toEqual({ fallback: true })
    expect(config.initialiseAppKit()).toBeUndefined()
    expect(adapter).not.toHaveBeenCalled()
    expect(createAppKit).not.toHaveBeenCalled()
    expect(createConfig).toHaveBeenCalledWith(
      expect.objectContaining({ ssr: true, connectors: [] }),
    )
  })

  it.each(['88882', '88888'])(
    'uses both chains and APP_CHAIN %s with the sourced Socios wallet ID',
    async (chainId) => {
      vi.stubEnv('NEXT_PUBLIC_REOWN_PROJECT_ID', 'test-project-id')
      vi.stubEnv('NEXT_PUBLIC_APP_CHAIN_ID', chainId)
      const config = await import('./config')
      expect(config.getWalletConfig()).toEqual({ adapter: true })
      config.initialiseAppKit()
      config.initialiseAppKit()
      expect(adapter).toHaveBeenCalledTimes(1)
      expect(createAppKit).toHaveBeenCalledTimes(1)
      const options = createAppKit.mock.calls[0] as unknown as [
        Record<string, unknown>,
      ]
      expect(options[0]).toMatchObject({
        defaultNetwork: { id: Number(chainId) },
        networks: [{ id: 88882 }, { id: 88888 }],
        projectId: 'test-project-id',
        featuredWalletIds: [
          '56843177b5e89d4bcb19a27dab7c49e0f33d8d3a6c8c4c7e5274f605e92befd6',
        ],
        features: { analytics: false, email: false, socials: false },
      })
    },
  )
})
