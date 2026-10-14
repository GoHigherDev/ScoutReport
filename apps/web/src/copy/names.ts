const externalWalletCaveat =
  'Staking from an external wallet does not earn Socios Reward Points. We cannot reliably verify whether this address is a Socios Wallet or qualifies for RP.'

export const NAMES = {
  product: 'ScoutReport',
  admin: {
    heading: 'Admin matches',
    accessRequired: 'Sign in with an approved admin wallet to manage matches.',
    forbidden: 'This session does not have admin access.',
    refresh: 'Refresh matches',
    reopen: 'Open the console after signing in',
    findMatch: 'Match ID',
    find: 'Find match',
    latest: 'Latest 100 matches',
    invalidMatchId: 'Enter a valid bytes32 match ID.',
    notFound: 'No match found for this ID.',
    unavailable:
      'On-chain match actions and settlement are unavailable until an approved Spicy deployment is recorded.',
    walletMismatch: 'Connect the wallet used for this admin session.',
    newMatch: 'New match',
    sport: 'Sport',
    football: 'Football',
    cs2: 'CS2',
    sideOne: 'First side',
    sideTwo: 'Second side',
    tokenKey: 'Fan Token key',
    noToken: 'No Fan Token mapping',
    kickoff: 'Kickoff (Europe/London)',
    lockTime: 'Lock time (Europe/London; defaults to kickoff)',
    timeHelp:
      'Times are stored in UTC. Invalid or ambiguous UK clock-change times are not accepted.',
    outcomes: 'Outcomes (one per line; two or three)',
    points: 'Non-transferable points for a correct pick (1–100)',
    save: 'Save match metadata',
    saved: 'Metadata saved. The match is not on-chain until creation confirms.',
    empty: 'No matches saved.',
    error: 'Unable to complete this action. Check the input and try again.',
    invalidInput: 'Check the match details and UK times before saving.',
    create: 'Create match on Spicy',
    settle: 'Settle match',
    void: 'Void match',
    credit: 'Credit next batch',
    result: 'Result',
    confirmHeading: 'Confirm match action',
    confirmHelp:
      'Check the match and result against an official source. Settlement is final and cannot be corrected or voided.',
    voidHelp: 'Voiding an open match is final. No points will be credited.',
    creditHelp:
      'Credit batches process up to 50 predictors. Confirm each batch in your wallet until complete.',
    cancel: 'Cancel',
    retryAudit: 'Retry audit recording',
    auditError:
      'Audit recording failed. Check the transaction receipt, then retry recording before continuing.',
    receiptPending:
      'A transaction was sent. Wait for its receipt and record its audit before continuing. If it was cancelled, check the explorer and refresh.',
    resumeHelp:
      'Refresh to recover on-chain state. If a transaction is still pending, wait for its receipt before retrying.',
    recoveryHash: 'Transaction hash to recover',
    recoverAudit: 'Record a previous transaction',
    recoveryHelp:
      'Choose the action and enter its transaction hash. The server verifies the transaction before recording it.',
    action: 'Action',
    loading: 'Loading match state…',
    draft: 'Metadata only',
    open: 'Open',
    settled: 'Settled',
    voided: 'Voided',
    complete: 'Crediting complete',
    progress: 'Predictors processed',
    lockedUntil: 'Lock time (UTC)',
    kickoffUtc: 'Kickoff (UTC)',
  },
  auth: {
    statement: 'Sign in to ScoutReport. This does not cost gas or move funds.',
    sessionRequired: 'A session is required',
    unexpectedError: 'An unexpected error occurred',
  },
  gas: {
    idle: 'Submit transaction',
    checking: 'Checking CHZ gas…',
    awaiting_signature: 'Awaiting your wallet signature…',
    pending: 'Transaction pending…',
    confirmed: 'Transaction confirmed',
    failed: 'Transaction not confirmed',
    explorer: 'View transaction in explorer',
    insufficient_gas:
      "You don't have enough CHZ to cover this transaction and its gas fee.",
    wrong_network:
      'Switch your wallet to the app network before submitting a transaction.',
    unknown: 'The transaction could not be completed. Please try again.',
    panelHeading: 'CHZ for gas',
    spicyExplanation:
      'Spicy testnet transactions need test CHZ for gas. Test CHZ has no value. You can request it from a faucet.',
    mainnetExplanation:
      'A small amount of CHZ is needed to pay gas fees on Chiliz Mainnet.',
    spicyFaucet: 'Spicy Faucet',
    tatumFaucet: 'Tatum Chiliz testnet faucet',
    signIn: 'Sign in',
    signingIn: 'Awaiting sign-in signature…',
    signedIn: 'Signed in',
    errors: {
      ZeroAdmin: 'An administrator address is required.',
      MatchAlreadyExists: 'This match already exists.',
      UnknownMatch: 'This match could not be found.',
      InvalidLockTime: 'The lock time must be in the future.',
      InvalidOutcomeCount: 'A match must have two or three outcomes.',
      InvalidPointsForCorrect: 'The match points setting is not valid.',
      InvalidOutcome: 'Choose one of the available outcomes.',
      MatchNotOpen: 'This match is not open.',
      MatchLocked:
        'This match is locked, so predictions can no longer be changed.',
      MatchNotLocked: 'This match cannot be settled before its lock time.',
      MatchNotSettled: 'This match has not been settled.',
      UnexpectedCall: 'This action is not supported by the contract.',
      AccessControlUnauthorizedAccount:
        'This wallet does not have permission for this action.',
      AccessControlBadConfirmation:
        'The confirming account does not match this wallet.',
      EnforcedPause: 'Contract transactions are paused.',
      ExpectedPause: 'The contract is not paused.',
    },
  },
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

export const SPICY_FAUCETS = [
  { label: NAMES.gas.spicyFaucet, href: 'https://spicy-faucet.chiliz.com/' },
  { label: NAMES.gas.tatumFaucet, href: 'https://tatum.io/faucets/chiliz' },
] as const

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
