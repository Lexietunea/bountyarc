import { type Abi } from 'viem'

export const BOUNTY_MARKET_ADDRESS = '0x9a9ac3b8eab2bc7e88066c042c20165d994afba3' as const
export const ARC_TESTNET_CHAIN_ID = 5042002

export enum BountyStatus {
  Open = 0,
  Completed = 1,
  Refunded = 2,
}

export interface Bounty {
  id: bigint
  poster: string
  title: string
  description: string
  rewardUsdc: bigint
  deadline: bigint
  status: BountyStatus
  winnerSubmissionId: bigint
  submissionCount: bigint
}

export interface Submission {
  id: bigint
  bountyId: bigint
  solver: string
  proofUri: string
  submittedAt: bigint
  isWinner: boolean
}

export function formatUsdc(raw: bigint): string {
  const n = Number(raw) / 1_000_000
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}

export function parseUsdc(s: string): bigint {
  const n = parseFloat(s)
  if (isNaN(n) || n <= 0) return 0n
  return BigInt(Math.round(n * 1_000_000))
}

export function formatDeadline(ts: bigint): string {
  const d = new Date(Number(ts) * 1000)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function deadlineLabel(ts: bigint): { text: string; expired: boolean } {
  const now = Date.now() / 1000
  const diff = Number(ts) - now
  if (diff <= 0) return { text: 'Expired', expired: true }
  if (diff < 3600) return { text: `${Math.floor(diff / 60)}m left`, expired: false }
  if (diff < 86400) return { text: `${Math.floor(diff / 3600)}h left`, expired: false }
  return { text: `${Math.floor(diff / 86400)}d left`, expired: false }
}

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function statusLabel(status: BountyStatus): string {
  if (status === BountyStatus.Open) return 'Open'
  if (status === BountyStatus.Completed) return 'Completed'
  return 'Refunded'
}

export function statusColor(status: BountyStatus): string {
  if (status === BountyStatus.Open) return '#1061a6'
  if (status === BountyStatus.Completed) return '#1a8047'
  return '#6b6580'
}

export function statusBg(status: BountyStatus): string {
  if (status === BountyStatus.Open) return 'rgba(16,97,166,0.08)'
  if (status === BountyStatus.Completed) return 'rgba(26,128,71,0.08)'
  return 'rgba(107,101,128,0.08)'
}

export const BOUNTY_MARKET_ABI = [
  {
    name: 'createBounty',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'rewardUsdc', type: 'uint256' },
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
          { name: 'rewardUsdc', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'winnerSubmissionId', type: 'uint256' },
          { name: 'submissionCount', type: 'uint256' },
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
          { name: 'solver', type: 'address' },
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
    name: 'getPosterBounties',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poster', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'getSolverSubmissions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'solver', type: 'address' }],
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
    name: 'hasSubmitted',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'solver', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const satisfies Abi

export const USDC_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const satisfies Abi

export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const
