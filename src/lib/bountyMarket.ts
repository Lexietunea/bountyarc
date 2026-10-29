import { getUsdc, requireChain } from '../onchain-facts'

export const ARC_CHAIN_ID = 5042
// Keep testnet alias so nothing else breaks
export const ARC_TESTNET_CHAIN_ID = ARC_CHAIN_ID
export const chain = requireChain(ARC_CHAIN_ID)
export const USDC = getUsdc(ARC_CHAIN_ID)!

export const BOUNTY_MARKET_ADDRESS = '0x098f0BD99Fe7b568db86120ce03D6927FaD69712' as const

// Large bounty threshold: $500 in 18-decimal native Arc USDC
export const LARGE_BOUNTY_THRESHOLD = 500n * 10n ** 18n

// Fixed basis-point splits for large bounties: 35/25/20/12/8%
export const LARGE_BOUNTY_SPLITS = [3500n, 2500n, 2000n, 1200n, 800n] as const
export const LARGE_BOUNTY_SPLIT_LABELS = ['35%', '25%', '20%', '12%', '8%'] as const
export const LARGE_BOUNTY_PLACE_LABELS = ['1st', '2nd', '3rd', '4th', '5th'] as const

// ─── Categories ───────────────────────────────────────────────────────────────

export enum Category {
  General = 0,
  Code = 1,
  Design = 2,
  Research = 3,
  Writing = 4,
  Data = 5,
  AITask = 6,
}

export const CATEGORY_LABELS: Record<Category, string> = {
  [Category.General]: 'General',
  [Category.Code]: 'Code',
  [Category.Design]: 'Design',
  [Category.Research]: 'Research',
  [Category.Writing]: 'Writing',
  [Category.Data]: 'Data',
  [Category.AITask]: 'AI Task',
}

export const CATEGORY_EMOJI: Record<Category, string> = {
  [Category.General]: '🌐',
  [Category.Code]: '💻',
  [Category.Design]: '🎨',
  [Category.Research]: '🔬',
  [Category.Writing]: '✍️',
  [Category.Data]: '📊',
  [Category.AITask]: '🤖',
}

export const CATEGORY_COLORS: Record<Category, string> = {
  [Category.General]: '#6b7280',
  [Category.Code]: '#1e4fc2',
  [Category.Design]: '#7c3aed',
  [Category.Research]: '#0891b2',
  [Category.Writing]: '#b45309',
  [Category.Data]: '#047857',
  [Category.AITask]: '#be185d',
}

export const CATEGORY_BG: Record<Category, string> = {
  [Category.General]: 'rgba(107,114,128,0.10)',
  [Category.Code]: 'rgba(30,79,194,0.10)',
  [Category.Design]: 'rgba(124,58,237,0.10)',
  [Category.Research]: 'rgba(8,145,178,0.10)',
  [Category.Writing]: 'rgba(180,83,10,0.10)',
  [Category.Data]: 'rgba(4,120,87,0.10)',
  [Category.AITask]: 'rgba(190,24,93,0.10)',
}

export enum BountyStatus {
  Open = 0,
  Completed = 1,
  Refunded = 2,
  Cancelled = 3,
}

export const STATUS_LABELS: Record<BountyStatus, string> = {
  [BountyStatus.Open]: 'Open',
  [BountyStatus.Completed]: 'Completed',
  [BountyStatus.Refunded]: 'Refunded',
  [BountyStatus.Cancelled]: 'Cancelled',
}

export const STATUS_COLORS: Record<BountyStatus, string> = {
  [BountyStatus.Open]: '#1a8047',
  [BountyStatus.Completed]: '#1e4fc2',
  [BountyStatus.Refunded]: '#b4530a',
  [BountyStatus.Cancelled]: '#6b7280',
}

export const STATUS_BG: Record<BountyStatus, string> = {
  [BountyStatus.Open]: 'rgba(26,128,71,0.10)',
  [BountyStatus.Completed]: 'rgba(30,79,194,0.10)',
  [BountyStatus.Refunded]: 'rgba(180,83,10,0.10)',
  [BountyStatus.Cancelled]: 'rgba(107,114,128,0.08)',
}

export interface Bounty {
  id: bigint
  poster: `0x${string}`
  title: string
  description: string
  category?: Category       // V2+
  reward: bigint
  deadline: bigint
  status: BountyStatus
  winnerSubmissionId: bigint
  submissionCount: bigint
  createdAt: bigint
  disputed?: boolean        // V2+
  disputeInitiator?: `0x${string}` // V2+
}

export interface Submission {
  id: bigint
  bountyId: bigint
  submitter: `0x${string}`
  submissionTitle?: string      // V2+
  submissionDescription?: string // V2+
  proofUri: string
  submittedAt: bigint
  isWinner: boolean
}

export interface Comment {
  id: bigint
  bountyId: bigint
  author: `0x${string}`
  text: string
  createdAt: bigint
}

export function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// Rewards are stored as native Arc USDC (18 decimals, the gas-token view).
export function formatReward(raw: bigint): string {
  const n = Number(raw) / 1e18
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatDeadline(ts: bigint): string {
  const d = new Date(Number(ts) * 1000)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function isExpired(deadline: bigint): boolean {
  return Date.now() / 1000 > Number(deadline)
}

export function timeLeft(deadline: bigint): string {
  const diff = Number(deadline) - Date.now() / 1000
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d}d ${h}h left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

export const BOUNTY_MARKET_ABI = [
  // Write functions
  {
    name: 'createBounty',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'bountyId', type: 'uint256' }],
  },
  {
    name: 'submitWork',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'proofUri', type: 'string' },
    ],
    outputs: [{ name: 'submissionId', type: 'uint256' }],
  },
  {
    name: 'selectWinner',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'submissionId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'refundBounty',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'bountyId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'cancelBounty',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'bountyId', type: 'uint256' }],
    outputs: [],
  },
  // View functions
  {
    name: 'getBounty',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'bountyId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'poster', type: 'address' },
          { name: 'title', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'reward', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'winnerSubmissionId', type: 'uint256' },
          { name: 'submissionCount', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'getSubmission',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'bountyId', type: 'uint256' },
          { name: 'submitter', type: 'address' },
          { name: 'proofUri', type: 'string' },
          { name: 'submittedAt', type: 'uint256' },
          { name: 'isWinner', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'getBountySubmissions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'bountyId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'getActiveBounties',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'bountyCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'submitterToSubmission',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'submitter', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // V2+ functions (gracefully unused on V1)
  {
    name: 'addComment',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'text', type: 'string' },
    ],
    outputs: [{ name: 'commentId', type: 'uint256' }],
  },
  {
    name: 'getBountyComments',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'bountyId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'getComment',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'commentId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'bountyId', type: 'uint256' },
          { name: 'author', type: 'address' },
          { name: 'text', type: 'string' },
          { name: 'createdAt', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'disputeBounty',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'bountyId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'selectWinners',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'submissionIds', type: 'uint256[]' },
      { name: 'basisPoints', type: 'uint256[]' },
    ],
    outputs: [],
  },
  // Events
  {
    name: 'BountyCreated',
    type: 'event',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true },
      { name: 'poster', type: 'address', indexed: true },
      { name: 'reward', type: 'uint256', indexed: false },
      { name: 'deadline', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'WorkSubmitted',
    type: 'event',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true },
      { name: 'submissionId', type: 'uint256', indexed: true },
      { name: 'submitter', type: 'address', indexed: true },
      { name: 'proofUri', type: 'string', indexed: false },
    ],
  },
  {
    name: 'WinnerSelected',
    type: 'event',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true },
      { name: 'submissionId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'reward', type: 'uint256', indexed: false },
    ],
  },
] as const
