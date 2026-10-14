const externalWalletCaveat =
  'Staking from an external wallet does not earn Socios Reward Points. We cannot reliably verify whether this address is a Socios Wallet or qualifies for RP.'

export const LEGAL_DETAILS = {
  contact: '[PRIVACY CONTACT — TO BE CONFIRMED]',
  controller: '[DATA CONTROLLER — TO BE CONFIRMED]',
  retention: '[RETENTION PERIOD — TO BE CONFIRMED]',
} as const

export const NAMES = {
  product: 'ScoutReport',
  legal: {
    draft: 'Draft, pending legal review',
    controller: 'Data controller',
    contact: 'Privacy contact',
    privacyHeading: 'Privacy notice',
    termsHeading: 'Terms',
    revision: 'Last updated: 14 October 2026 · Version: 0.2',
    ageNotice:
      "For users 18 or over; we do not knowingly process children's data.",
    privacySections: [
      {
        heading: 'Data collected and purposes',
        text: 'ScoutReport uses a wallet address to identify a profile and verify sign-in. Off-chain profile fields include an optional public name, a holdings-display preference, claim chain and time, and the latest update time. A wallet signature is required to sign in; signing in costs no gas and does not move funds. Sign-in uses a single-use nonce and message; sign-in signatures and messages are not logged. Public Chiliz Chain records are the source of wallet balances and staking history used to display holdings and estimates; they are not stored in the profile database.',
      },
      {
        heading: 'Wallet addresses and public history',
        text: 'A wallet address can be personal data when linked to a person, as discussed in ICO guidance on distributed ledger technology. Truncating an address does not make it anonymous. Chiliz Chain history is public and cannot be erased by ScoutReport. Erasure deletes off-chain profile fields, picks, prediction points, terms-acceptance records and stored signatures; audit-log entries are pseudonymised and kept. Transactions and history on-chain cannot be deleted.',
      },
      {
        heading: 'Lawful bases',
        text: '[LAWFUL BASIS FOR PROFILES AND SIGN-IN — TO BE CONFIRMED]. [LAWFUL BASIS FOR PUBLIC CHAIN READS — TO BE CONFIRMED]. These are review placeholders, not legal conclusions or regulator approval.',
      },
      {
        heading: 'Off-chain Predict',
        text: 'Picks are free and wallet-signed using EIP-712: a wallet signature is required, with no gas and no on-chain transaction. Postgres stores the wallet address, pick, signature and timestamps to verify the submission, enforce pick deadlines and calculate non-transferable prediction points. An append-only audit log records picks and signatures for accountability. [LAWFUL BASIS FOR PREDICT — TO BE CONFIRMED]. On erasure, we delete your picks, prediction points, terms-acceptance records and stored signatures, and pseudonymise your audit-log entries, which are kept. Contact the privacy contact to request erasure.',
      },
      {
        heading: 'Retention',
        text: 'Profile fields remain until deleted or replaced. Sign-in nonces expire after ten minutes; expired records are deleted when another nonce is issued. The session cookie expires after seven days or is cleared on logout. Predict aggregates are anonymised after 24 months. Retention periods for picks, signatures, terms-acceptance records and kept pseudonymised audit-log entries await confirmation. Backup disposal and hosting-log retention also await confirmation. Contact the privacy contact for retention questions.',
      },
      {
        heading: 'Profile display',
        text: 'Addresses are truncated by default. Public names are shown only for claimed, visible profiles. Public holdings display requires an explicit opt-in. The connected-wallet portfolio is a private view, not a public profile. Contact the privacy contact to request a change to your profile or holdings-display preference.',
      },
      {
        heading: 'Cookies and browser storage',
        text: "ScoutReport uses only an essential sign-in session cookie, with httpOnly, Secure and SameSite=Lax settings. No analytics or tracking is enabled; any future non-essential tracking would require prior consent. Wallet connection libraries may use browser storage to maintain a connection. If you declare a Socios Wallet, that choice is saved in this browser's local storage until you change it or clear site storage. Read caches last only for the browser context or until evicted.",
      },
      {
        heading: 'Reported RP and estimates',
        text: 'Reported RP is sent only with your consent. You can withdraw consent at any time by contacting the privacy contact. The RP Estimate panel uses your holdings only. It assumes this wallet is a Socios Wallet based on your declaration; that declaration is not verification.',
      },
      {
        heading: 'Terms acceptance and country check',
        text: 'The terms-acceptance record contains your wallet address, the terms version, the UTC time and the country-check result. We use it to record which terms you accepted and to check eligibility. The IP country check is done on our server; raw IP is not stored. [LAWFUL BASIS FOR TERMS ACCEPTANCE AND COUNTRY CHECK — TO BE CONFIRMED]. Contact the privacy contact for questions about these records.',
      },
      {
        heading: 'Automated decisions',
        text: 'We make no solely automated decisions with legal or similarly significant effects.',
      },
      {
        heading: 'Recipients and infrastructure',
        text: 'Hosting and database providers process off-chain data. RPC providers receive wallet addresses used in public chain reads, and wallet connection providers support connections. [PROVIDER IDENTITIES, PROCESSING LOCATIONS AND TRANSFER SAFEGUARDS — TO BE CONFIRMED]. No private keys are collected by ScoutReport.',
      },
      {
        heading: 'Your rights and requests',
        text: 'You can contact the privacy contact to request access, correction, erasure, restriction or portability of your personal data. You have the right to object to processing, subject to the applicable lawful basis and limits. Where processing relies on consent, you can withdraw it. The applicable rights and any limits depend on the processing and lawful basis, which remain under review. A wallet signature is required to verify wallet control when handling your request; we never request private keys.',
      },
      {
        heading: 'Complaints',
        text: 'You can raise a privacy concern with the privacy contact and can complain to the UK Information Commissioner’s Office (ICO). This draft does not claim ICO approval.',
      },
    ],
    predictRetention: 'Predict retention period',
    icoLink: 'ICO: make a data protection complaint',
    termsSections: [
      {
        heading: 'Independent service',
        text: 'ScoutReport is a third-party dapp on Chiliz Chain, not affiliated with Socios.com.',
      },
      {
        heading: 'No financial advice',
        text: 'Information shown is for general information only, not financial or investment advice. Figures and estimates may be incomplete or unavailable. You are responsible for checking information before making decisions; no rewards or returns are promised.',
      },
      {
        heading: 'Draft scope',
        text: 'These terms are a draft pending legal review. [SERVICE TERMS, ELIGIBILITY AND GOVERNING LAW — TO BE CONFIRMED]. A wallet signature is required to sign in; signing in costs no gas and does not move funds. Predict picks are free, off-chain and wallet-signed with no gas. When you accept the terms, we record your wallet address, the terms version, the UTC time and the country-check result. The IP country check is done on our server; raw IP is not stored. Contact the privacy contact with questions about the terms or your records.',
      },
      {
        heading: '18+ eligibility',
        text: 'You must be 18 or over to use ScoutReport.',
      },
    ],
  },
  admin: {
    heading: 'Admin matches',
    accessRequired: 'Sign in with an approved admin wallet to manage matches.',
    forbidden: 'This session does not have admin access.',
    refresh: 'Refresh matches',
    reopen: 'Sign in, then open the console',
    findMatch: 'Match ID',
    find: 'Find match',
    latest: 'Latest 100 matches',
    invalidMatchId: 'Enter a valid match ID.',
    notFound: 'No match found for this ID.',
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
    save: 'Save match',
    saved: 'Match saved.',
    edit: 'Edit match',
    saveChanges: 'Save changes',
    empty: 'No matches saved.',
    error: 'Unable to complete this action. Check the input and try again.',
    invalidInput: 'Check the match details and UK times before saving.',
    create: 'Create match',
    settle: 'Settle match',
    void: 'Void match',
    credit: 'Credit or recalculate points',
    result: 'Result',
    confirmHeading: 'Confirm match action',
    confirmHelp:
      'Check the match and result against an official source before you confirm. Settlement is final, so a settled match cannot be corrected or voided.',
    voidHelp: 'Enter the official postponement or abandonment reason.',
    creditHelp: 'Recalculate points from picks stored before the match lock.',
    voidReason: 'Reason',
    cancel: 'Cancel',
    loading: 'Loading matches…',
    open: 'Open',
    settled: 'Settled',
    voided: 'Voided',
    locked: 'Locked',
    lockedEdit: 'Locked matches cannot be edited.',
    creditedCount: 'Correct picks',
    totalPoints: 'Total points credited',
    externalRef: 'Official fixture reference (optional)',
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
      researchLink: 'Research, route evidence and limitations',
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
    unavailable: 'Wallet connection is unavailable. Please try again later.',
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
