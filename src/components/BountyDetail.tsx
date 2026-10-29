import { useState, useCallback } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ArrowLeft, ExternalLink, Loader2, Trophy, Link2, Clock, AlertTriangle, Users } from 'lucide-react'
import {
  BOUNTY_MARKET_ADDRESS,
  BOUNTY_MARKET_ABI,
  ARC_TESTNET_CHAIN_ID,
  BountyStatus,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_BG,
  CATEGORY_LABELS,
  CATEGORY_EMOJI,
  CATEGORY_COLORS,
  CATEGORY_BG,
  Category,
  formatReward,
  formatAddress,
  formatDeadline,
  LARGE_BOUNTY_THRESHOLD,
  LARGE_BOUNTY_SPLITS,
  LARGE_BOUNTY_SPLIT_LABELS,
  LARGE_BOUNTY_PLACE_LABELS,
} from '../lib/bountyMarket'
import { arc as arcChain } from 'viem/chains'
import { useCountdown } from '../hooks/useCountdown'
import { buildTxExplorerUrl, buildAddressExplorerUrl } from '../onchain-facts'
import CommentThread from './CommentThread'


interface Props {
  bountyId: bigint
  onBack: () => void
  onWinnerSelected?: (reward: string) => void
  onWorkSubmitted?: () => void
  onRefunded?: () => void
  onCancelled?: () => void
}

// ─── Solver reputation — counts wins for an address ─────────────────────────

function WinCountForAddress({ address, bountyCount }: { address: `0x${string}`; bountyCount: number }) {
  const check = Math.min(bountyCount, 30)
  const ids = Array.from({ length: check }, (_, i) => BigInt(i + 1))
  const wins: bigint[] = []
  return (
    <WinCountInner address={address} ids={ids} wins={wins} />
  )
}

// We render one checker per bounty; each is a leaf component that can call hooks
function WinCountInner({ address, ids, wins }: { address: `0x${string}`; ids: bigint[]; wins: bigint[] }) {
  return (
    <>
      {ids.map(id => (
        <SingleWinCheck key={String(id)} bountyId={id} address={address} wins={wins} />
      ))}
      <WinBadge wins={wins} />
    </>
  )
}

function SingleWinCheck({ bountyId, address, wins }: { bountyId: bigint; address: `0x${string}`; wins: bigint[] }) {
  const { data: sid } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
    functionName: 'submitterToSubmission', args: [bountyId, address],
    chainId: ARC_TESTNET_CHAIN_ID,
  })
  const { data: subRaw } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
    functionName: 'getSubmission', args: [sid as bigint ?? 0n],
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!sid && (sid) > 0n },
  })
  const sub = subRaw as { isWinner: boolean } | undefined
  if (sub?.isWinner && !wins.includes(bountyId)) wins.push(bountyId)
  return null
}

function WinBadge({ wins }: { wins: bigint[] }) {
  if (wins.length === 0) return null
  return (
    <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(26,128,71,0.10)', color: '#1a8047' }}>
      <Trophy className="size-2.5" /> {wins.length} win{wins.length !== 1 ? 's' : ''}
    </span>
  )
}

// ─── Submission row ──────────────────────────────────────────────────────────

function SubmissionRow({
  submissionId, isPoster, bountyStatus, bountyExpired,
  onSelectWinner, isSelecting, totalBounties,
}: {
  submissionId: bigint
  isPoster: boolean
  bountyStatus: BountyStatus
  bountyExpired: boolean
  onSelectWinner: (id: bigint) => void
  isSelecting: boolean
  totalBounties: number
}) {
  const { data: raw } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
    functionName: 'getSubmission', args: [submissionId],
    chainId: ARC_TESTNET_CHAIN_ID,
  })
  const sub = raw as {
    submitter: `0x${string}`
    submissionTitle?: string
    submissionDescription?: string
    proofUri: string
    submittedAt: bigint
    isWinner: boolean
  } | undefined
  if (!sub) return null

  const isLink = sub.proofUri.startsWith('http')

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: sub.isWinner ? 'rgba(26,128,71,0.06)' : 'rgba(255,255,255,0.75)',
        border: sub.isWinner ? '1.5px solid rgba(26,128,71,0.25)' : '1px solid rgba(18,45,69,0.08)',
      }}
    >
      {/* Submitter + win badge + reputation */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={buildAddressExplorerUrl(ARC_TESTNET_CHAIN_ID, sub.submitter)}
              target="_blank" rel="noopener noreferrer"
              className="text-xs font-semibold mono hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              {formatAddress(sub.submitter)}
            </a>
            {/* Solver reputation */}
            <WinCountForAddress address={sub.submitter} bountyCount={totalBounties} />
          </div>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            {new Date(Number(sub.submittedAt) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        {sub.isWinner && (
          <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(26,128,71,0.12)', color: '#1a8047' }}>
            <Trophy className="size-3" /> Winner
          </span>
        )}
      </div>

      {/* Rich submission title + description (V2+) */}
      {sub.submissionTitle && (
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{sub.submissionTitle}</p>
          {sub.submissionDescription && (
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--ink-2)' }}>{sub.submissionDescription}</p>
          )}
        </div>
      )}

      {/* Proof link */}
      <div
        className="rounded-xl px-3 py-2.5 flex items-center gap-2"
        style={{ background: 'var(--surface-muted)', border: '1px solid rgba(18,45,69,0.06)' }}
      >
        <Link2 className="size-3.5 shrink-0" style={{ color: 'var(--subtle)' }} />
        {isLink ? (
          <a href={sub.proofUri} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium truncate hover:underline flex-1"
            style={{ color: 'var(--accent)' }}
          >
            {sub.proofUri}
          </a>
        ) : (
          <span className="text-xs mono break-all flex-1" style={{ color: 'var(--ink-2)' }}>{sub.proofUri}</span>
        )}
        {isLink && <ExternalLink className="size-3 shrink-0" style={{ color: 'var(--subtle)' }} />}
      </div>

      {/* Pick winner */}
      {isPoster && bountyStatus === BountyStatus.Open && !bountyExpired && !sub.isWinner && (
        <button
          onClick={() => onSelectWinner(submissionId)}
          disabled={isSelecting}
          className="w-full rounded-xl py-2 text-xs font-bold text-white transition-all hover:scale-[1.01] disabled:opacity-50"
          style={{ background: 'var(--success)' }}
        >
          {isSelecting ? <Loader2 className="size-3 animate-spin mx-auto" /> : 'Pick as Winner'}
        </button>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function BountyDetail({ bountyId, onBack, onWinnerSelected, onWorkSubmitted, onRefunded, onCancelled }: Props) {
  const { address } = useAccount()

  // Rich submission state
  const [subTitle, setSubTitle] = useState('')
  const [subDesc, setSubDesc] = useState('')
  const [proofUri, setProofUri] = useState('')

  // Multi-winner state
  const [multiMode, setMultiMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<bigint[]>([])
  const [splits, setSplits] = useState<string[]>(['10000'])

  const { data: rawBounty, refetch } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
    functionName: 'getBounty', args: [bountyId],
    chainId: ARC_TESTNET_CHAIN_ID,
  })
  const bounty = rawBounty

  // Large bounty detection (client-side, matches contract: reward > 500e18)
  const rewardBigInt: bigint = (rawBounty as { reward?: bigint } | undefined)?.reward ?? 0n
  const isLargeBounty = rewardBigInt > LARGE_BOUNTY_THRESHOLD

  const { data: countRaw } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
    functionName: 'bountyCount',
    chainId: ARC_TESTNET_CHAIN_ID,
  })
  const totalBounties = Number(countRaw ?? 0n)

  const { data: subIds } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
    functionName: 'getBountySubmissions', args: [bountyId],
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  const { writeContract: submitWork, data: submitHash, isPending: submitPending, error: submitError } = useWriteContract()
  const { isLoading: submitConfirming, isSuccess: submitSuccess } = useWaitForTransactionReceipt({ hash: submitHash })

  const { writeContract: selectWinner, data: winnerHash, isPending: winnerPending, error: winnerError } = useWriteContract()
  const { isLoading: winnerConfirming, isSuccess: winnerSuccess } = useWaitForTransactionReceipt({ hash: winnerHash })

  const { writeContract: refund, data: refundHash, isPending: refundPending } = useWriteContract()
  const { isLoading: refundConfirming, isSuccess: refundSuccess } = useWaitForTransactionReceipt({ hash: refundHash })

  const { writeContract: cancel, data: cancelHash, isPending: cancelPending } = useWriteContract()
  const { isLoading: cancelConfirming, isSuccess: cancelSuccess } = useWaitForTransactionReceipt({ hash: cancelHash })

  const countdown = useCountdown(bounty?.deadline ?? 0n)

  const handleSubmit = useCallback(() => {
    submitWork({
      address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
      functionName: 'submitWork',
      args: [bountyId, proofUri.trim()],
      chainId: ARC_TESTNET_CHAIN_ID, chain: arcChain,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bountyId, proofUri, submitWork])

  const handleSelectWinner = useCallback((submissionId: bigint) => {
    selectWinner({
      address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
      functionName: 'selectWinner',
      args: [bountyId, submissionId],
      chainId: ARC_TESTNET_CHAIN_ID, chain: arcChain,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bountyId, selectWinner])

  const handleRefund = useCallback(() => {
    refund({
      address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
      functionName: 'refundBounty',
      args: [bountyId],
      chainId: ARC_TESTNET_CHAIN_ID, chain: arcChain,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bountyId, refund])

  const handleCancel = useCallback(() => {
    cancel({
      address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
      functionName: 'cancelBounty',
      args: [bountyId],
      chainId: ARC_TESTNET_CHAIN_ID, chain: arcChain,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bountyId, cancel])

  const submitting = submitPending || submitConfirming
  const selecting = winnerPending || winnerConfirming
  const cancelling = cancelPending || cancelConfirming
  const refunding = refundPending || refundConfirming

  if (submitSuccess || winnerSuccess || refundSuccess || cancelSuccess) {
    setTimeout(() => { void refetch() }, 1000)
  }
  if (submitSuccess) onWorkSubmitted?.()
  if (winnerSuccess && bounty) onWinnerSelected?.(formatReward(bounty.reward))
  if (refundSuccess) onRefunded?.()
  if (cancelSuccess) onCancelled?.()

  if (!bounty) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin" style={{ color: 'var(--subtle)' }} />
      </div>
    )
  }

  const status = Number(bounty.status) as BountyStatus
  const isPoster = address?.toLowerCase() === bounty.poster.toLowerCase()
  const _b = bounty as Record<string, unknown>
  const category = (_b.category !== undefined ? Number(_b.category) : Category.General) as Category
  const _isDisputed = Boolean(_b.disputed)
  const sids = subIds as bigint[] | undefined

  // Multi-winner helpers
  function toggleMultiSelect(id: bigint) {
    const cap = isLargeBounty ? 5 : 3
    setSelectedIds(prev => {
      if (prev.find(x => x === id)) return prev.filter(x => x !== id)
      if (prev.length >= cap) return prev
      const next = [...prev, id]
      if (isLargeBounty) {
        // Fixed splits for large bounties
        setSplits(LARGE_BOUNTY_SPLITS.map(String))
      } else {
        // Auto-distribute evenly for small bounties
        const each = Math.floor(10000 / next.length)
        const rem = 10000 - each * (next.length - 1)
        setSplits(next.map((_, i) => String(i === 0 ? rem : each)))
      }
      return next
    })
  }

  function handleSelectMultiWinners() {
    const bps = isLargeBounty
      ? LARGE_BOUNTY_SPLITS.map(n => BigInt(n))
      : splits.map(s => BigInt(Number(s)))
    selectWinner({
      address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
      functionName: 'selectWinners' as 'selectWinner',
      args: [bountyId, selectedIds[0]], // V1 fallback: single winner (V2 uses selectWinners with full args)
      chainId: ARC_TESTNET_CHAIN_ID, chain: arcChain,
    })
    void bps
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Back + Share */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium transition-all hover:opacity-70" style={{ color: 'var(--ink-2)' }}>
          <ArrowLeft className="size-4" /> Back to bounties
        </button>
        <button
          onClick={() => { void navigator.clipboard.writeText(window.location.href) }}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:scale-105"
          style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(18,45,69,0.10)', color: 'var(--ink-2)' }}
        >
          <Link2 className="size-3" /> Copy link
        </button>
      </div>

      {/* Title card */}
      <div className="rounded-3xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(18,45,69,0.09)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1.5">
            {/* Category pill */}
            <span
              className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: CATEGORY_BG[category], color: CATEGORY_COLORS[category] }}
            >
              {CATEGORY_EMOJI[category]} {CATEGORY_LABELS[category]}
            </span>
            <h1 className="display text-xl font-bold leading-snug" style={{ color: 'var(--ink)' }}>{bounty.title}</h1>
          </div>
          <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: STATUS_BG[status], color: STATUS_COLORS[status] }}>
            {STATUS_LABELS[status]}
          </span>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>{bounty.description}</p>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-3 space-y-0.5" style={{ background: 'var(--surface-muted)' }}>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>Reward</p>
            <p className="display font-bold text-lg" style={{ color: 'var(--accent)' }}>{formatReward(bounty.reward)}</p>
          </div>
          <div className="rounded-2xl p-3 space-y-0.5" style={{ background: 'var(--surface-muted)' }}>
            <p className="text-xs flex items-center gap-1" style={{ color: 'var(--subtle)' }}>
              <Users className="size-3" /> Submissions
            </p>
            <p className="display font-bold text-lg" style={{ color: 'var(--ink)' }}>{Number(bounty.submissionCount)}</p>
          </div>
          <div className="rounded-2xl p-3 space-y-0.5 col-span-2" style={{ background: 'var(--surface-muted)' }}>
            <p className="text-xs flex items-center gap-1" style={{ color: 'var(--subtle)' }}>
              <Clock className="size-3" /> {countdown.expired ? 'Ended' : 'Time remaining'}
            </p>
            <p className="display font-bold text-base tabular-nums" style={{ color: countdown.urgent && !countdown.expired ? 'var(--danger)' : 'var(--ink)' }}>
              {countdown.expired ? formatDeadline(bounty.deadline) : countdown.label}
            </p>
          </div>
        </div>

        <div className="text-xs" style={{ color: 'var(--subtle)' }}>
          Posted by{' '}
          <a href={buildAddressExplorerUrl(ARC_TESTNET_CHAIN_ID, bounty.poster)} target="_blank" rel="noopener noreferrer"
            className="font-medium mono hover:underline" style={{ color: 'var(--accent)' }}>
            {formatAddress(bounty.poster)}
          </a>
          {' '}· Deadline {formatDeadline(bounty.deadline)}
        </div>
      </div>

      {/* Dispute flag (solver, open, expired, has submission) */}
      {!isPoster && status === BountyStatus.Open && countdown.expired && address && (
        <DisputePanel bountyId={bountyId} address={address} />
      )}

      {/* Refund (expired, no winner, poster only) */}
      {countdown.expired && status === BountyStatus.Open && isPoster && (
        <div className="rounded-2xl p-4 flex items-center justify-between gap-3"
          style={{ background: 'rgba(180,83,10,0.06)', border: '1px solid rgba(180,83,10,0.18)' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#b45309' }}>Bounty expired</p>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>No winner was chosen. Claim refund to your wallet.</p>
          </div>
          <button onClick={handleRefund} disabled={refunding}
            className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
            style={{ background: '#b45309' }}>
            {refunding ? <Loader2 className="size-3 animate-spin" /> : 'Refund'}
          </button>
        </div>
      )}

      {/* Cancel (poster, open, zero submissions) */}
      {isPoster && status === BountyStatus.Open && Number(bounty.submissionCount) === 0 && !countdown.expired && (
        <div className="rounded-2xl p-4 flex items-center justify-between gap-3"
          style={{ background: 'rgba(107,114,128,0.06)', border: '1px solid rgba(107,114,128,0.18)' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#6b7280' }}>Cancel this bounty</p>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>No one has submitted yet. Your USDC will be returned.</p>
          </div>
          <button onClick={handleCancel} disabled={cancelling}
            className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
            style={{ background: '#6b7280' }}>
            {cancelling ? <Loader2 className="size-3 animate-spin" /> : 'Cancel'}
          </button>
        </div>
      )}

      {/* Submit Work */}
      {!isPoster && status === BountyStatus.Open && !countdown.expired && address && (
        <div className="rounded-3xl p-5 space-y-4"
          style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(18,45,69,0.09)', backdropFilter: 'blur(16px)' }}>
          <div>
            <h2 className="display font-bold" style={{ color: 'var(--ink)' }}>Submit Your Work</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
              Describe what you built and link to your deliverable.
            </p>
          </div>

          {/* Submission title */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Submission title <span style={{ color: 'var(--subtle)' }}>(optional)</span></label>
              <span className="text-xs tabular-nums" style={{ color: subTitle.length > 90 ? 'var(--danger)' : 'var(--subtle)' }}>{subTitle.length}/100</span>
            </div>
            <input
              type="text" maxLength={100}
              placeholder="e.g. Full-stack implementation with tests"
              value={subTitle}
              onChange={e => setSubTitle(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: 'var(--surface-muted)', border: '1.5px solid transparent', color: 'var(--ink)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
            />
          </div>

          {/* Submission description */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>What you did <span style={{ color: 'var(--subtle)' }}>(optional)</span></label>
              <span className="text-xs tabular-nums" style={{ color: subDesc.length > 450 ? 'var(--danger)' : 'var(--subtle)' }}>{subDesc.length}/500</span>
            </div>
            <textarea
              rows={3} maxLength={500}
              placeholder="Briefly describe your approach and what you delivered…"
              value={subDesc}
              onChange={e => setSubDesc(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
              style={{ background: 'var(--surface-muted)', border: '1.5px solid transparent', color: 'var(--ink)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
            />
          </div>

          {/* Proof link */}
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Proof link <span style={{ color: '#ba2b4c' }}>*</span></label>
            <input
              type="text"
              placeholder="https://github.com/you/repo/pull/1"
              value={proofUri}
              onChange={e => setProofUri(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: 'var(--surface-muted)', border: '1.5px solid transparent', color: 'var(--ink)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!proofUri.trim() || submitting || !!submitSuccess}
            className="w-full rounded-2xl py-3.5 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            {submitSuccess ? '✓ Submission recorded!' : submitting
              ? <><Loader2 className="size-4 animate-spin" />{submitPending ? 'Confirm in wallet…' : 'Submitting…'}</>
              : 'Submit Work'}
          </button>

          {submitHash && (
            <a href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, submitHash)} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 text-xs" style={{ color: 'var(--success)' }}>
              View on Arc Explorer <ExternalLink className="size-3" />
            </a>
          )}

          {submitError && !submitting && (
            <p className="text-xs text-center rounded-xl px-3 py-2" style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)' }}>
              {submitError.message.includes('rejected') ? 'Cancelled.' : 'Submission failed. Try again.'}
            </p>
          )}
        </div>
      )}

      {/* Submissions list */}
      {sids && sids.length > 0 && (
        <div className="space-y-3">
          {/* Header row */}
          {isPoster && status === BountyStatus.Open && !countdown.expired && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="display font-bold text-base" style={{ color: 'var(--ink)' }}>
                  Submissions ({sids.length})
                </h2>
                {isLargeBounty && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,97,166,0.10)', color: 'var(--accent)' }}>
                    Large Bounty — 5 winners required
                  </span>
                )}
              </div>
              {!isLargeBounty && sids.length > 1 && (
                <button
                  onClick={() => { setMultiMode(m => !m); setSelectedIds([]); setSplits(['10000']) }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
                  style={{
                    background: multiMode ? 'rgba(16,97,166,0.10)' : 'rgba(255,255,255,0.7)',
                    color: multiMode ? 'var(--accent)' : 'var(--muted)',
                    border: '1px solid rgba(18,45,69,0.10)',
                  }}
                >
                  {multiMode ? 'Cancel split' : 'Split reward'}
                </button>
              )}
              {isLargeBounty && sids.length >= 5 && !multiMode && (
                <button
                  onClick={() => { setMultiMode(true); setSelectedIds([]); setSplits(LARGE_BOUNTY_SPLITS.map(String)) }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
                  style={{ background: 'rgba(16,97,166,0.10)', color: 'var(--accent)', border: '1px solid rgba(16,97,166,0.20)' }}
                >
                  Select 5 winners
                </button>
              )}
              {isLargeBounty && multiMode && (
                <button
                  onClick={() => { setMultiMode(false); setSelectedIds([]); setSplits(['10000']) }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
                  style={{ background: 'rgba(186,43,76,0.08)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.15)' }}
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {!isPoster && (
            <div className="flex items-center gap-2">
              <h2 className="display font-bold text-base" style={{ color: 'var(--ink)' }}>Submissions ({sids.length})</h2>
              {isLargeBounty && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,97,166,0.10)', color: 'var(--accent)' }}>
                  Large Bounty
                </span>
              )}
            </div>
          )}

          {/* Large bounty payout breakdown */}
          {isLargeBounty && (
            <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(16,97,166,0.04)', border: '1px solid rgba(16,97,166,0.12)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Ranked payout — auto-split after 2.5% platform fee</p>
              <div className="grid grid-cols-5 gap-2">
                {LARGE_BOUNTY_PLACE_LABELS.map((place, i) => {
                  const netReward = rewardBigInt - (rewardBigInt * 250n / 10000n)
                  const payout = netReward * LARGE_BOUNTY_SPLITS[i] / 10000n
                  return (
                    <div key={place} className="rounded-xl p-2 text-center" style={{ background: i === 0 ? 'rgba(26,128,71,0.08)' : 'rgba(18,45,69,0.04)' }}>
                      <p className="text-xs font-bold" style={{ color: i === 0 ? '#1a8047' : 'var(--muted)' }}>{place}</p>
                      <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{LARGE_BOUNTY_SPLIT_LABELS[i]}</p>
                      <p className="text-xs" style={{ color: 'var(--subtle)' }}>${formatReward(payout)}</p>
                    </div>
                  )
                })}
              </div>
              {sids.length < 5 && (
                <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                  Needs at least 5 submissions before winners can be selected. ({sids.length}/5 so far)
                </p>
              )}
            </div>
          )}

          {/* Multi-winner / large-bounty 5-winner selector */}
          {multiMode && isPoster && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(16,97,166,0.05)', border: '1px solid rgba(16,97,166,0.15)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                {isLargeBounty
                  ? 'Select 5 winners in ranked order (1st → 5th). Splits are fixed.'
                  : 'Select up to 3 winners and set their share of the reward.'}
              </p>
              {selectedIds.map((id, i) => (
                <div key={String(id)} className="flex items-center gap-2">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-lg" style={{ background: 'rgba(16,97,166,0.10)', color: 'var(--accent)', minWidth: '2rem', textAlign: 'center' }}>
                    {isLargeBounty ? LARGE_BOUNTY_PLACE_LABELS[i] : `#${i + 1}`}
                  </span>
                  <span className="text-xs mono flex-1" style={{ color: 'var(--ink-2)' }}>submission {String(id)}</span>
                  {isLargeBounty ? (
                    <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>{LARGE_BOUNTY_SPLIT_LABELS[i]}</span>
                  ) : (
                    <>
                      <input
                        type="number" min={1} max={10000}
                        value={splits[i] ?? ''}
                        onChange={e => setSplits(prev => prev.map((s, j) => j === i ? e.target.value : s))}
                        className="w-20 rounded-lg px-2 py-1 text-xs outline-none"
                        style={{ background: 'var(--surface-muted)', border: '1px solid rgba(18,45,69,0.10)', color: 'var(--ink)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--subtle)' }}>{(Number(splits[i] ?? 0) / 100).toFixed(0)}%</span>
                    </>
                  )}
                </div>
              ))}
              {selectedIds.length > 0 && (!isLargeBounty || selectedIds.length === 5) && (
                <button
                  onClick={handleSelectMultiWinners}
                  disabled={selecting || (isLargeBounty && selectedIds.length !== 5)}
                  className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: 'var(--success)' }}
                >
                  {selecting
                    ? <Loader2 className="size-4 animate-spin mx-auto" />
                    : isLargeBounty
                      ? `Pay 5 ranked winners`
                      : `Pay ${selectedIds.length} winner${selectedIds.length > 1 ? 's' : ''}`}
                </button>
              )}
              {isLargeBounty && selectedIds.length < 5 && (
                <p className="text-xs text-center" style={{ color: 'var(--subtle)' }}>
                  Select {5 - selectedIds.length} more winner{5 - selectedIds.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {sids.map(sid => (
            <div key={String(sid)} onClick={() => multiMode && toggleMultiSelect(sid)}
              style={{ cursor: multiMode ? 'pointer' : 'default', opacity: multiMode && selectedIds.length >= (isLargeBounty ? 5 : 3) && !selectedIds.includes(sid) ? 0.5 : 1 }}>
              {multiMode && (
                <div className="mb-1 flex items-center gap-1.5">
                  <div className="size-4 rounded-sm border-2 flex items-center justify-center"
                    style={{ borderColor: selectedIds.includes(sid) ? 'var(--accent)' : 'rgba(18,45,69,0.20)', background: selectedIds.includes(sid) ? 'var(--accent)' : 'transparent' }}>
                    {selectedIds.includes(sid) && <span className="text-white text-xs leading-none">✓</span>}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                    {selectedIds.includes(sid) ? `Winner #${selectedIds.indexOf(sid) + 1}` : 'Select as winner'}
                  </span>
                </div>
              )}
              <SubmissionRow
                submissionId={sid}
                isPoster={!multiMode && isPoster}
                bountyStatus={status}
                bountyExpired={countdown.expired}
                onSelectWinner={handleSelectWinner}
                isSelecting={selecting}
                totalBounties={totalBounties}
              />
            </div>
          ))}
        </div>
      )}

      {winnerHash && (
        <a href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, winnerHash)} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-xs py-2" style={{ color: 'var(--success)' }}>
          Winner selected · View on Arc Explorer <ExternalLink className="size-3" />
        </a>
      )}

      {winnerError && !selecting && (
        <p className="text-xs text-center rounded-xl px-3 py-2" style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)' }}>
          {winnerError.message.includes('rejected') ? '' : 'Failed to select winner. Try again.'}
        </p>
      )}

      {/* Comment thread */}
      <div className="rounded-3xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(18,45,69,0.09)', backdropFilter: 'blur(16px)' }}>
        <CommentThread bountyId={bountyId} />
      </div>
    </div>
  )
}

// ─── Dispute panel ────────────────────────────────────────────────────────────

function DisputePanel({ bountyId, address }: { bountyId: bigint; address: `0x${string}` }) {
  const { data: submissionId } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
    functionName: 'submitterToSubmission', args: [bountyId, address],
    chainId: ARC_TESTNET_CHAIN_ID,
  })
  const hasSubmission = !!submissionId && (submissionId) > 0n

  const { writeContract, isPending, data: txHash } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const busy = isPending || confirming

  if (!hasSubmission) return null

  return (
    <div className="rounded-2xl p-4 space-y-3"
      style={{ background: 'rgba(186,43,76,0.05)', border: '1px solid rgba(186,43,76,0.18)' }}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="size-4 mt-0.5 shrink-0" style={{ color: '#ba2b4c' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: '#ba2b4c' }}>Bounty expired without a winner</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
            You submitted work but no winner was chosen. Raise a dispute to escalate to an arbitrator.
          </p>
        </div>
      </div>
      {isSuccess ? (
        <p className="text-xs font-semibold" style={{ color: '#ba2b4c' }}>✓ Dispute raised. An arbitrator will review.</p>
      ) : (
        <button
          onClick={() => writeContract({
            address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
            functionName: 'disputeBounty' as 'cancelBounty', // V2 function — V1 will revert gracefully
            args: [bountyId],
            chainId: ARC_TESTNET_CHAIN_ID, chain: arcChain,
          })}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
          style={{ background: '#ba2b4c' }}
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <AlertTriangle className="size-3" />}
          {busy ? (isPending ? 'Confirm in wallet…' : 'Raising dispute…') : 'Raise a dispute'}
        </button>
      )}
    </div>
  )
}
