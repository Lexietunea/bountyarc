import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId } from 'wagmi'
import { Loader2, ArrowLeft, ExternalLink, ChevronRight } from 'lucide-react'
import {
  BOUNTY_MARKET_ADDRESS,
  BOUNTY_MARKET_ABI,
  ARC_TESTNET_CHAIN_ID,
  Category,
  CATEGORY_LABELS,
  CATEGORY_EMOJI,
  CATEGORY_COLORS,
  CATEGORY_BG,
  formatReward,
} from '../lib/bountyMarket'
import { arc as arcChain } from 'viem/chains'
import { parseGasAmount } from '../onchain-money'
import { buildTxExplorerUrl } from '../onchain-facts'

interface Props {
  onBack: () => void
  onPosted: () => void
}

const QUICK_AMOUNTS = ['5', '10', '50', '100', '500']
const DEADLINE_OPTIONS = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
]

function nowSecs() { return Date.now() / 1000 }

export default function PostBounty({ onBack, onPosted }: Props) {
  const { address } = useAccount()
  const currentChainId = useChainId()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<Category>(Category.General)
  const [rewardStr, setRewardStr] = useState('')
  const [deadlineDays, setDeadlineDays] = useState(7)
  const [switching, setSwitching] = useState(false)
  const pendingPostRef = useRef(false)
  const deadlineTsRef = useRef(0n)

  const { switchChainAsync } = useSwitchChain()
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const rewardAmount = parseFloat(rewardStr) || 0
  const rewardRaw = rewardStr ? parseGasAmount(ARC_TESTNET_CHAIN_ID, rewardStr).raw : 0n

  const canPost =
    title.trim().length > 0 &&
    title.length <= 100 &&
    description.trim().length > 0 &&
    description.length <= 1000 &&
    rewardAmount > 0

  // After a successful chain switch, fire the writeContract if a post was pending
  useEffect(() => {
    if (pendingPostRef.current && currentChainId === ARC_TESTNET_CHAIN_ID) {
      pendingPostRef.current = false
      setSwitching(false)
      writeContract({
        address: BOUNTY_MARKET_ADDRESS,
        abi: BOUNTY_MARKET_ABI,
        functionName: 'createBounty',
        args: [title.trim(), description.trim(), deadlineTsRef.current],
        value: rewardRaw,
        chainId: ARC_TESTNET_CHAIN_ID,
        chain: arcChain,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChainId])

  const handlePost = useCallback(async () => {
    reset()
    deadlineTsRef.current = BigInt(Math.floor(nowSecs()) + deadlineDays * 86400)

    // Already on the right chain — fire directly
    if (currentChainId === ARC_TESTNET_CHAIN_ID) {
      writeContract({
        address: BOUNTY_MARKET_ADDRESS,
        abi: BOUNTY_MARKET_ABI,
        functionName: 'createBounty',
        args: [title.trim(), description.trim(), deadlineTsRef.current],
        value: rewardRaw,
        chainId: ARC_TESTNET_CHAIN_ID,
        chain: arcChain,
      })
      return
    }

    // Wrong chain — request switch first, then the useEffect above fires writeContract
    try {
      setSwitching(true)
      pendingPostRef.current = true
      await switchChainAsync({ chainId: ARC_TESTNET_CHAIN_ID })
    } catch {
      // User rejected the chain switch — cancel the pending post
      pendingPostRef.current = false
      setSwitching(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, deadlineDays, rewardRaw, currentChainId, writeContract, switchChainAsync, reset])

  if (isSuccess) setTimeout(() => onPosted(), 1500)

  const isBusy = switching || isPending || isConfirming

  function statusLabel() {
    if (switching) return 'Switching to Arc Testnet…'
    if (isPending) return 'Confirm in wallet…'
    if (isConfirming) return 'Posting on Arc…'
    if (rewardAmount > 0) return `Post bounty for ${formatReward(rewardRaw)}`
    return 'Post bounty for $0'
  }

  function errorMsg(e: Error | null) {
    if (!e) return null
    const m = e.message.toLowerCase()
    if (m.includes('insufficient')) return 'Insufficient USDC balance.'
    if (m.includes('deadlinetooson')) return 'Deadline must be at least 1 hour from now.'
    if (m.includes('zeroreward')) return 'Reward must be greater than 0.'
    const match = e.message.match(/reason:\s*(.+?)(?:\n|$)/i)
    if (match) return `Failed: ${match[1].trim()}`
    return `Error: ${e.message.slice(0, 120)}`
  }

  const onWrongChain = !!address && currentChainId !== ARC_TESTNET_CHAIN_ID

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-full transition-all hover:scale-110"
          style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(18,45,69,0.10)' }}
        >
          <ArrowLeft className="size-4" style={{ color: 'var(--ink-2)' }} />
        </button>
        <div>
          <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>Post a Bounty</h1>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            One transaction · USDC locked until you pick a winner
          </p>
        </div>
      </div>

      {/* Wrong chain banner */}
      {onWrongChain && (
        <div
          className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
          style={{ background: 'rgba(180,83,10,0.07)', border: '1px solid rgba(180,83,10,0.18)' }}
        >
          <p className="text-xs font-medium" style={{ color: '#b45309' }}>
            Switch to Arc Testnet to post a bounty
          </p>
          <button
            onClick={() => void switchChainAsync({ chainId: ARC_TESTNET_CHAIN_ID })}
            className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg text-white"
            style={{ background: '#b45309' }}
          >
            Switch
          </button>
        </div>
      )}

      {/* Form card */}
      <div
        className="rounded-3xl p-5 space-y-5"
        style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(18,45,69,0.09)', backdropFilter: 'blur(16px)' }}
      >
        {/* Title */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Title</label>
            <span className="text-xs tabular-nums" style={{ color: title.length > 90 ? 'var(--danger)' : 'var(--subtle)' }}>
              {title.length}/100
            </span>
          </div>
          <input
            type="text"
            maxLength={100}
            placeholder="What needs to be done?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
            style={{ background: 'var(--surface-muted)', border: '1.5px solid transparent', color: 'var(--ink)' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--focus)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Description</label>
            <span className="text-xs tabular-nums" style={{ color: description.length > 900 ? 'var(--danger)' : 'var(--subtle)' }}>
              {description.length}/1000
            </span>
          </div>
          <textarea
            maxLength={1000}
            rows={4}
            placeholder="Describe the task, deliverables, and what success looks like…"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none transition-all"
            style={{ background: 'var(--surface-muted)', border: '1.5px solid transparent', color: 'var(--ink)' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--focus)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide block" style={{ color: 'var(--muted)' }}>Category</label>
          <div className="flex flex-wrap gap-2">
            {(Object.values(Category).filter(v => typeof v === 'number') as Category[]).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: category === cat ? CATEGORY_BG[cat] : 'var(--surface-muted)',
                  color: category === cat ? CATEGORY_COLORS[cat] : 'var(--muted)',
                  border: category === cat ? `1px solid ${CATEGORY_COLORS[cat]}40` : '1px solid rgba(18,45,69,0.08)',
                }}
              >
                {CATEGORY_EMOJI[cat]} {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Reward */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide block" style={{ color: 'var(--muted)' }}>USDC Reward</label>
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-3"
            style={{ background: 'var(--surface-muted)', border: '1px solid rgba(18,45,69,0.08)' }}
          >
            <span className="font-bold" style={{ color: 'var(--subtle)' }}>$</span>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={rewardStr}
              onChange={e => setRewardStr(e.target.value)}
              className="flex-1 bg-transparent text-xl font-bold outline-none tabular-nums"
              style={{ color: 'var(--ink)' }}
            />
            <span className="text-sm font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
          </div>
          <div className="flex gap-2">
            {QUICK_AMOUNTS.map(a => (
              <button
                key={a}
                type="button"
                onClick={() => setRewardStr(a)}
                className="flex-1 rounded-xl py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: rewardStr === a ? 'var(--accent)' : 'var(--surface-muted)',
                  color: rewardStr === a ? '#fff' : 'var(--muted)',
                  border: rewardStr === a ? 'none' : '1px solid rgba(18,45,69,0.08)',
                }}
              >
                ${a}
              </button>
            ))}
          </div>
        </div>

        {/* Deadline */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide block" style={{ color: 'var(--muted)' }}>Deadline</label>
          <div className="grid grid-cols-4 gap-2">
            {DEADLINE_OPTIONS.map(({ label, days }) => (
              <button
                key={days}
                type="button"
                onClick={() => setDeadlineDays(days)}
                className="rounded-xl py-2.5 text-xs font-semibold transition-all"
                style={{
                  background: deadlineDays === days ? 'var(--accent)' : 'var(--surface-muted)',
                  color: deadlineDays === days ? '#fff' : 'var(--muted)',
                  border: deadlineDays === days ? 'none' : '1px solid rgba(18,45,69,0.08)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        {rewardAmount > 0 && (
          <div
            className="rounded-2xl px-4 py-3 space-y-1.5"
            style={{ background: 'rgba(16,97,166,0.05)', border: '1px solid rgba(16,97,166,0.12)' }}
          >
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--muted)' }}>You stake</span>
              <span className="font-bold" style={{ color: 'var(--accent)' }}>{formatReward(rewardRaw)} USDC</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--muted)' }}>Platform fee (2.5%)</span>
              <span className="font-semibold" style={{ color: 'var(--muted)' }}>
                −${(rewardAmount * 0.025).toFixed(3)} USDC
              </span>
            </div>
            <div className="flex justify-between text-xs border-t pt-1.5" style={{ borderColor: 'rgba(16,97,166,0.12)' }}>
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>Winner receives</span>
              <span className="font-bold" style={{ color: 'var(--success)' }}>
                ${(rewardAmount * 0.975).toFixed(3)} USDC
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--muted)' }}>Deadline</span>
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>{deadlineDays} days from now</span>
            </div>
            <p className="text-xs pt-0.5" style={{ color: 'var(--subtle)' }}>
              USDC locks onchain instantly. Fee only charged when a winner is selected — refunds are fee-free.
            </p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => void handlePost()}
          disabled={!canPost || isBusy || !address || !!isSuccess}
          className="w-full rounded-2xl py-4 text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--accent)' }}
        >
          {isSuccess ? (
            '✓ Bounty posted!'
          ) : isBusy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {statusLabel()}
            </>
          ) : (
            <>
              {statusLabel()}
              <ChevronRight className="size-4" />
            </>
          )}
        </button>

        {isSuccess && txHash && (
          <a
            href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs font-medium"
            style={{ color: 'var(--success)' }}
          >
            View on Arc Explorer <ExternalLink className="size-3" />
          </a>
        )}

        {error && errorMsg(error) && (
          <p
            className="text-xs text-center rounded-xl px-3 py-2"
            style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)' }}
          >
            {errorMsg(error)}
          </p>
        )}
      </div>
    </div>
  )
}
