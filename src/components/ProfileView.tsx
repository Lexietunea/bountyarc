import { useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { ArrowLeft, Trophy, Clock } from 'lucide-react'
import {
  BOUNTY_MARKET_ADDRESS,
  BOUNTY_MARKET_ABI,
  ARC_TESTNET_CHAIN_ID,
  BountyStatus,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_BG,
  formatReward,
  formatAddress,
} from '../lib/bountyMarket'
import { useCountdown } from '../hooks/useCountdown'
import { buildAddressExplorerUrl } from '../onchain-facts'

interface Props {
  onBack: () => void
  onSelectBounty: (id: bigint) => void
  onCancelBounty?: (id: bigint) => void
}

function ProfileBountyRow({ bountyId, onSelect }: { bountyId: bigint; onSelect: (id: bigint) => void }) {
  const { data: raw } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS,
    abi: BOUNTY_MARKET_ABI,
    functionName: 'getBounty',
    args: [bountyId],
    chainId: ARC_TESTNET_CHAIN_ID,
  })
  const bounty = raw as { title: string; reward: bigint; deadline: bigint; status: number; submissionCount: bigint } | undefined
  const countdown = useCountdown(bounty?.deadline ?? 0n)
  const status = bounty ? (Number(bounty.status) as BountyStatus) : BountyStatus.Open

  if (!bounty) return (
    <div className="h-14 rounded-2xl animate-pulse" style={{ background: 'rgba(18,45,69,0.05)' }} />
  )

  return (
    <button
      onClick={() => onSelect(bountyId)}
      className="w-full text-left rounded-2xl px-4 py-3 flex items-center justify-between gap-3 transition-all hover:scale-[1.005]"
      style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(18,45,69,0.08)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{bounty.title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
          {formatReward(bounty.reward)} · {Number(bounty.submissionCount)} submission{Number(bounty.submissionCount) !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: STATUS_BG[status], color: STATUS_COLORS[status] }}>
          {STATUS_LABELS[status]}
        </span>
        {status === BountyStatus.Open && (
          <span className="text-xs tabular-nums" style={{ color: countdown.urgent ? 'var(--danger)' : 'var(--subtle)' }}>
            <Clock className="size-2.5 inline mr-0.5" />{countdown.expired ? 'Expired' : countdown.label}
          </span>
        )}
      </div>
    </button>
  )
}

function SubmissionRow({ submissionId, onSelect }: { submissionId: bigint; onSelect: (id: bigint) => void }) {
  const { data: raw } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS,
    abi: BOUNTY_MARKET_ABI,
    functionName: 'getSubmission',
    args: [submissionId],
    chainId: ARC_TESTNET_CHAIN_ID,
  })
  const sub = raw as { bountyId: bigint; proofUri: string; isWinner: boolean } | undefined
  if (!sub) return null

  return (
    <button
      onClick={() => onSelect(sub.bountyId)}
      className="w-full text-left rounded-2xl px-4 py-3 flex items-center justify-between gap-3 transition-all hover:scale-[1.005]"
      style={{
        background: sub.isWinner ? 'rgba(26,128,71,0.06)' : 'rgba(255,255,255,0.8)',
        border: sub.isWinner ? '1.5px solid rgba(26,128,71,0.2)' : '1px solid rgba(18,45,69,0.08)',
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Bounty #{String(sub.bountyId)}</p>
        <p className="text-xs mono truncate mt-0.5" style={{ color: 'var(--subtle)' }}>{sub.proofUri}</p>
      </div>
      {sub.isWinner && (
        <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(26,128,71,0.12)', color: '#1a8047' }}>
          <Trophy className="size-3" /> Won
        </span>
      )}
    </button>
  )
}

// Filters a bounty to only show if poster matches
function PostedFilter({ bountyId, address, onSelect }: { bountyId: bigint; address: string; onSelect: (id: bigint) => void }) {
  const { data: raw } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS,
    abi: BOUNTY_MARKET_ABI,
    functionName: 'getBounty',
    args: [bountyId],
    chainId: ARC_TESTNET_CHAIN_ID,
  })
  const bounty = raw as { poster: `0x${string}` } | undefined
  if (!bounty) return null
  if (bounty.poster.toLowerCase() !== address.toLowerCase()) return null
  return <ProfileBountyRow bountyId={bountyId} onSelect={onSelect} />
}

// Filters a bounty's submissions to find ones from this address
function SubmittedFilter({ bountyId, address, onSelect }: { bountyId: bigint; address: string; onSelect: (id: bigint) => void }) {
  const { data: subIdRaw } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS,
    abi: BOUNTY_MARKET_ABI,
    functionName: 'submitterToSubmission',
    args: [bountyId, address as `0x${string}`],
    chainId: ARC_TESTNET_CHAIN_ID,
  })
  const subId = subIdRaw
  if (!subId || subId === 0n) return null
  return <SubmissionRow submissionId={subId} onSelect={onSelect} />
}

export default function ProfileView({ onBack, onSelectBounty }: Props) {
  const { address } = useAccount()
  const [tab, setTab] = useState<'posted' | 'submitted'>('posted')

  const { data: countRaw } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS,
    abi: BOUNTY_MARKET_ABI,
    functionName: 'bountyCount',
    chainId: ARC_TESTNET_CHAIN_ID,
  })
  const count = Number(countRaw ?? 0n)
  const allIds = Array.from({ length: count }, (_, i) => BigInt(count - i))

  if (!address) {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-2xl">👤</p>
        <p className="font-semibold" style={{ color: 'var(--ink)' }}>Connect your wallet</p>
        <p className="text-sm" style={{ color: 'var(--subtle)' }}>Your profile shows bounties you posted and work you submitted.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-8">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium transition-all hover:opacity-70"
        style={{ color: 'var(--ink-2)' }}
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      {/* Profile header */}
      <div
        className="rounded-3xl p-5 space-y-3"
        style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(18,45,69,0.09)', backdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="size-12 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {address.slice(2, 4).toUpperCase()}
          </div>
          <div>
            <a
              href={buildAddressExplorerUrl(ARC_TESTNET_CHAIN_ID, address)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold mono text-sm hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              {formatAddress(address)}
            </a>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>Arc Mainnet</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['posted', 'submitted'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 rounded-2xl text-sm font-semibold capitalize transition-all"
            style={{
              background: tab === t ? 'var(--accent)' : 'rgba(255,255,255,0.7)',
              color: tab === t ? '#fff' : 'var(--muted)',
              border: tab === t ? 'none' : '1px solid rgba(18,45,69,0.10)',
            }}
          >
            {t === 'posted' ? 'My Bounties' : 'My Submissions'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-2">
        {count === 0 ? (
          <p className="text-center text-sm py-8" style={{ color: 'var(--subtle)' }}>No activity yet.</p>
        ) : tab === 'posted' ? (
          allIds.map(id => (
            <PostedFilter key={String(id)} bountyId={id} address={address} onSelect={onSelectBounty} />
          ))
        ) : (
          allIds.map(id => (
            <SubmittedFilter key={String(id)} bountyId={id} address={address} onSelect={onSelectBounty} />
          ))
        )}
      </div>
    </div>
  )
}
