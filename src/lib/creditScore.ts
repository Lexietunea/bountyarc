import artifact from '../../contracts/out/CreditScore.sol/CreditScore.json'

export const CREDIT_SCORE_ADDRESS =
  '0xaf2c8fd676fe0889c4e8aaf861c23b94424cb49a' as const

export const CREDIT_SCORE_ABI = artifact.abi

export const ARC_TESTNET_CHAIN_ID = 5042002

// EventType enum matches the Solidity order
export enum EventType {
  OnTimePayment = 0,
  LatePayment = 1,
  Default = 2,
  LoanRepaid = 3,
  LoanOpened = 4,
  CreditUtilizationUpdate = 5,
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  [EventType.OnTimePayment]: 'On-Time Payment',
  [EventType.LatePayment]: 'Late Payment',
  [EventType.Default]: 'Default',
  [EventType.LoanRepaid]: 'Loan Repaid',
  [EventType.LoanOpened]: 'Loan Opened',
  [EventType.CreditUtilizationUpdate]: 'Utilization Update',
}

export const EVENT_TYPE_IMPACT: Record<EventType, 'positive' | 'negative' | 'neutral'> = {
  [EventType.OnTimePayment]: 'positive',
  [EventType.LatePayment]: 'negative',
  [EventType.Default]: 'negative',
  [EventType.LoanRepaid]: 'positive',
  [EventType.LoanOpened]: 'neutral',
  [EventType.CreditUtilizationUpdate]: 'neutral',
}

export interface CreditProfile {
  score: number
  totalEvents: number
  onTimePayments: number
  latePayments: number
  defaults: number
  loansRepaid: number
  loansOpened: number
  lowUtilizationUpdates: number
  highUtilizationUpdates: number
  totalAmountUsdc: bigint
  lastUpdatedAt: number
}

export interface CreditEvent {
  wallet: string
  eventType: EventType
  amountUsdc: bigint
  reporter: string
  timestamp: bigint
}

export type ScoreTier = 'Poor' | 'Fair' | 'Good' | 'Very Good' | 'Excellent'

export function scoreTier(score: number): ScoreTier {
  if (score <= 579) return 'Poor'
  if (score <= 669) return 'Fair'
  if (score <= 739) return 'Good'
  if (score <= 799) return 'Very Good'
  return 'Excellent'
}

export function tierColor(tier: ScoreTier): string {
  switch (tier) {
    case 'Poor': return 'var(--score-poor)'
    case 'Fair': return 'var(--score-fair)'
    case 'Good': return 'var(--score-good)'
    case 'Very Good': return 'var(--score-vg)'
    case 'Excellent': return 'var(--score-excellent)'
  }
}

export function tierBg(tier: ScoreTier): string {
  switch (tier) {
    case 'Poor': return 'rgba(186,43,76,0.08)'
    case 'Fair': return 'rgba(217,119,6,0.08)'
    case 'Good': return 'rgba(37,99,235,0.08)'
    case 'Very Good': return 'rgba(5,150,105,0.08)'
    case 'Excellent': return 'rgba(124,58,237,0.08)'
  }
}

// Returns 0-100 normalized position for the score gauge
export function scorePercent(score: number): number {
  return Math.round((score / 850) * 100)
}

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function formatAmount(amount: bigint): string {
  // amounts in 6-decimal USDC
  const n = Number(amount) / 1_000_000
  if (n === 0) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n)
}
