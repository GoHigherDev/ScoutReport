const externalWalletCaveat =
  'Staking from an external wallet does not earn Socios Reward Points. We cannot reliably verify whether this address is a Socios Wallet or qualifies for RP.'

export const NAMES = {
  product: 'ScoutReport',
  xHandle: '@xScoutReport',
  scoreLabel: 'Scout Rating',
  tiers: {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
  },
  optimiser: 'Rewards Optimizer',
  optimiserCopy: {
    token: 'Token',
    unstaked: 'Unstaked',
    actionHint: 'Action hint',
    notStaked: 'Held but not staked; Reward Point eligibility is not verified.',
    dataNetwork: 'Reading Chiliz Mainnet data',
    connect: 'Connect your wallet to view your Fan Token checklist.',
    unavailable: 'Unavailable',
    noAction: '—',
    captureBlock: 'Capture block',
    coolingDown: 'Cooling down',
    readyToClaim: 'Ready to claim',
    availableFrom: 'available from',
    ukTime: '(UK time)',
    releaseUnavailable: 'Release time unavailable',
    pendingUnstakes: 'pending unstakes; earliest release shown',
    defaultUnstakePeriod: 'Contract-wide default cooldown (seconds)',
    tokenPeriodUnknown: 'Per-token override unknown',
    dashboard: {
      heading: 'Your staking coverage',
      coverage: 'Staked on {n} of {m} Fan Tokens you hold',
      incomplete: 'Coverage unavailable: some token reads failed.',
      actions: 'Your checklist',
      unstaked: '{token}: held but not staked',
      allStaked:
        'All Fan Tokens you hold have at least one whole token staked.',
      noPolls: 'No polls watched.',
      watchPrompt: 'Poll watchlists are not available yet.',
      checklist: 'Open your Fan Token checklist',
      creditTime:
        'Socios credits staking RP daily at midnight UTC ({time} UK time).',
    },
    rpEstimate: {
      title: 'RP Estimate',
      subtitle:
        'Estimated Reward Points for the tokens you already hold in this wallet.',
      perToken: 'Estimated points per token you hold',
      total: 'Estimated total for your current holdings',
      range: 'Estimate: {low}–{high} RP (central {central})',
      footnote: 'Based on {n} user reports, calibrated {date}.',
      empty: 'Not enough reported data to estimate',
      ineligible: 'Not eligible for an estimate',
      declaration: 'This address is my Socios Wallet',
      disclaimer:
        "Estimate. This figure is ScoutReport's estimate, not data from Socios. It is calibrated from Reward Points that ScoutReport users reported, and assumes this address is a Socios Wallet. Your actual Reward Points may differ or be zero. Not financial advice.",
      undeclared:
        'Declare this address only if it is your Socios Wallet. This is not verification.',
      localOnly:
        'Your declaration stays in this browser only and is not sent anywhere.',
      unavailable: 'Estimate unavailable: snapshot or verification failed.',
      widened:
        'Estimate recalibrating: the range is wider because calibration or snapshot reads are stale, a drift alert is open, or pool stake has changed.',
      basis:
        'The daily estimate uses stake at the last block before midnight UTC, excluding pending unstake. Per-token figures divide that estimate by your current held plus staked tokens; liquid holdings alone do not earn staking RP.',
      totalUnavailable:
        'A total is unavailable unless every current holding has a valid estimate.',
      refresh: 'Refresh estimate',
    },
    earnRoutes: {
      heading: 'Socios Reward Point routes',
      description:
        'Source-confirmed routes are not confirmation of your eligibility or points received. Other activities remain unconfirmed as RP routes.',
      confirmed: 'Source-confirmed',
      unconfirmed: 'Unconfirmed',
      researchLink: 'R-01 research, route evidence and limitations',
      staking: {
        name: 'Fan Token staking via the Socios app',
        howTo:
          'In the Socios.com app (Socios Wallet), review Fan Token staking and the app’s eligibility requirements.',
      },
      fanZone: { name: 'Fan Zone tasks' },
      polls: { name: 'Polls' },
      quizzes: { name: 'Quizzes' },
      checkIns: { name: 'Check-ins' },
    },
    rpCaveat: {
      externalWalletCaveat,
      sociosWalletLine:
        'Staking through the Socios.com app (Socios Wallet) is what earns Socios Reward Points.',
      eoa: 'Externally owned account detected. Account type does not verify whether this is a Socios Wallet or qualifies for Reward Points.',
      contract:
        "Smart account detected (may be a Socios Wallet). If it is your Socios.com Wallet, staking through the Socios app earns Reward Points. We can't confirm this from the address.",
      stakingLink: 'Socios Connect, Working with Staking',
      rewardPointsLink: 'Socios Help Centre, How do I earn Reward Points?',
      votingLink: 'Socios Help Centre, Do I need Fan Tokens to vote?',
    },
    caveats: [
      'ScoutReport is not affiliated with Socios. Rewards Optimizer shows on-chain data and clearly labelled RP estimates. It cannot verify your Socios Reward Points, and your actual Reward Points may differ from any estimate or be zero.',
      externalWalletCaveat,
      "To vote, you must own and stake at least one Fan Token of that team. Some polls require more or have additional conditions. Check the poll's requirements in Socios; an on-chain balance does not guarantee eligibility.",
      'Poll coverage may be incomplete. Times and balances reflect the stated capture block and may change. Pending unstake is not a liquid wallet balance.',
    ],
  },
  portfolioPage: '[PORTFOLIO_PAGE_NAME]',
  badgeShelf: '[BADGE_SHELF_NAME]',
  description: 'ScoutReport on Chiliz Chain',
  mainNavigation: 'Main navigation',
  legalNavigation: 'Legal',
  nav: {
    leaderboards: 'Leaderboards',
    predict: 'Predict',
    chat: 'Chat',
  },
  privacy: 'Privacy',
  terms: 'Terms',
  connectWallet: 'Connect wallet',
  wallet: {
    disconnect: 'Disconnect',
    unavailable:
      'Wallet connection is unavailable. Set NEXT_PUBLIC_REOWN_PROJECT_ID.',
    connectionError: 'Unable to open wallet connection. Please try again.',
    disconnectError: 'Unable to disconnect. Please try again.',
    spicy: 'Spicy',
    mainnet: 'Mainnet',
    unsupportedNetwork: 'Unsupported network',
    wrongNetwork: 'Your wallet is on a different network.',
    switchSpicy: 'Switch to Spicy',
    switchMainnet: 'Switch to Mainnet',
    switching: 'Switching network…',
    switchRejected:
      'Network change rejected. Please approve the change in your wallet.',
    switchError: 'Unable to change network. Please try again.',
    holdings: 'Your Fan Tokens',
    held: 'Held',
    staked: 'Staked',
    loading: 'Loading Fan Token holdings…',
    empty: 'No Fan Token holdings or stakes found on Mainnet.',
    rpcError: 'Unable to load Fan Token holdings from Mainnet.',
    retry: 'Try again',
    stakingCaveat:
      'Staked amounts are not Reward Points. External-wallet staking does not earn Socios Reward Points.',
  },
  network: 'Network',
  disclaimer:
    'ScoutReport is an independent project and is not affiliated with Socios.com or Chiliz.',
} as const

export const OPTIMISER_SOURCE_LINKS = [
  {
    label: NAMES.optimiserCopy.rpCaveat.stakingLink,
    href: 'https://connect.socios.com/interact-with-chiliz-chain/working-with-staking',
  },
  {
    label: NAMES.optimiserCopy.rpCaveat.rewardPointsLink,
    href: 'https://helpcenter.socios.com/en/articles/472518-how-do-i-earn-reward-points',
  },
  {
    label: NAMES.optimiserCopy.rpCaveat.votingLink,
    href: 'https://helpcenter.socios.com/en/articles/472529-do-i-need-fan-tokens-to-vote',
  },
] as const

type OptimiserEarnRoute = {
  id: 'staking' | 'fanZone' | 'polls' | 'quizzes' | 'checkIns'
  name: string
  source: { label: string; href: string }
} & (
  | { status: 'confirmed'; howTo: string }
  | { status: 'unconfirmed'; howTo?: never }
)

export const OPTIMISER_EARN_ROUTES: readonly OptimiserEarnRoute[] = [
  {
    id: 'staking',
    name: NAMES.optimiserCopy.earnRoutes.staking.name,
    status: 'confirmed',
    howTo: NAMES.optimiserCopy.earnRoutes.staking.howTo,
    source: OPTIMISER_SOURCE_LINKS[0],
  },
  {
    id: 'fanZone',
    name: NAMES.optimiserCopy.earnRoutes.fanZone.name,
    status: 'unconfirmed',
    source: {
      label: NAMES.optimiserCopy.earnRoutes.researchLink,
      href: 'https://github.com/GoHigherDev/ScoutReport/blob/main/docs/research/optimiser-data-access.md',
    },
  },
  {
    id: 'polls',
    name: NAMES.optimiserCopy.earnRoutes.polls.name,
    status: 'unconfirmed',
    source: {
      label: NAMES.optimiserCopy.earnRoutes.researchLink,
      href: 'https://github.com/GoHigherDev/ScoutReport/blob/main/docs/research/optimiser-data-access.md#rp-and-other-app-side-data',
    },
  },
  {
    id: 'quizzes',
    name: NAMES.optimiserCopy.earnRoutes.quizzes.name,
    status: 'unconfirmed',
    source: {
      label: NAMES.optimiserCopy.earnRoutes.researchLink,
      href: 'https://github.com/GoHigherDev/ScoutReport/blob/main/docs/research/optimiser-data-access.md#rp-and-other-app-side-data',
    },
  },
  {
    id: 'checkIns',
    name: NAMES.optimiserCopy.earnRoutes.checkIns.name,
    status: 'unconfirmed',
    source: {
      label: NAMES.optimiserCopy.earnRoutes.researchLink,
      href: 'https://github.com/GoHigherDev/ScoutReport/blob/main/docs/research/optimiser-data-access.md#rp-and-other-app-side-data',
    },
  },
]
