/**
 * SolverReputation — shows how many bounties a given address has won.
 * Reads submitterToSubmission + getSubmission for each of the last N bounties.
 * We use a hook-safe approach: render N child components, each returning a
 * boolean, and pass a win-count callback up.
 */
import { useReadContract } from 'wagmi'
import { Trophy } from 'lucide-react'
import {
  BOUNTY_MARKET_ADDRESS,
  BOUNTY_MARKET_ABI,
  ARC_TESTNET_CHAIN_ID,
} from '../lib/bountyMarket'

interface Props {
  address: `0x${string}`
  totalBounties: number
  /** If true renders a compact pill. Otherwise just a text label. */
  compact?: boolean
}

// Check one bounty — renders a hidden span that contributes +1 if won
function BountyWinCheck({
  bountyId,
  address,
  onWin,
}: {
  bountyId: bigint
  address: `0x${string}`
  onWin: (id: bigint) => void
}) {
  const { data: submissionId } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS,
    abi: BOUNTY_MARKET_ABI,
    functionName: 'submitterToSubmission',
    args: [bountyId, address],
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  const sid = submissionId

  const { data: subRaw } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS,
    abi: BOUNTY_MARKET_ABI,
    functionName: 'getSubmission',
    args: [sid ?? 0n],
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!sid && sid > 0n },
  })

  const sub = subRaw as { isWinner: boolean } | undefined
  if (sub?.isWinner) {
    // Signal win to parent once
    onWin(bountyId)
  }
  return null
}

export default function SolverReputation({ address, totalBounties, compact }: Props) {
  const checkCount = Math.min(totalBounties, 30)
  const bountyIds = Array.from({ length: checkCount }, (_, i) => BigInt(i + 1))

  // Track wins in a Set to avoid double-counting
  const wins = new Set<string>()
  function handleWin(id: bigint) { wins.add(String(id)) }

  const winCount = wins.size

  return (
    <>
      {/* Hidden checkers */}
      {bountyIds.map(id => (
        <BountyWinCheck key={String(id)} bountyId={id} address={address} onWin={handleWin} />
      ))}
      {/* Badge */}
      {winCount > 0 && (
        compact ? (
          <span
            className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(26,128,71,0.10)', color: '#1a8047' }}
          >
            <Trophy className="size-2.5" /> {winCount} win{winCount !== 1 ? 's' : ''}
          </span>
        ) : (
          <p className="text-xs font-semibold" style={{ color: '#1a8047' }}>
            🏆 {winCount} bounty win{winCount !== 1 ? 's' : ''}
          </p>
        )
      )}
    </>
  )
}
