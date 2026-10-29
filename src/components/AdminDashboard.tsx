import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId } from 'wagmi'
import { ArrowLeft, DollarSign, Settings, Loader2, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { arc as arcChain } from 'viem/chains'
import {
  BOUNTY_MARKET_ADDRESS, BOUNTY_MARKET_ABI, ARC_CHAIN_ID,
  formatAddress, formatReward,
} from '../lib/bountyMarket'
import { buildAddressExplorerUrl, buildTxExplorerUrl } from '../onchain-facts'

// V2 ABI additions for admin functions
const ADMIN_ABI = [
  {
    name: 'feeBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'feeRecipient',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'totalFeesCollected',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'pendingWithdrawals',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalEscrowed',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'setFeeBps',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newFeeBps', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'setFeeRecipient',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newRecipient', type: 'address' }],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'pause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'unpause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'paused',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

interface Props {
  onBack: () => void
}

export default function AdminDashboard({ onBack }: Props) {
  const { address } = useAccount()
  const currentChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const [newFeeBps, setNewFeeBps] = useState('')
  const [newRecipient, setNewRecipient] = useState('')
  const [activeAction, setActiveAction] = useState<string | null>(null)

  // Reads
  const { data: owner, refetch: refetchOwner } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: ADMIN_ABI,
    functionName: 'owner', chainId: ARC_CHAIN_ID,
  })
  const { data: feeBps, refetch: refetchFee } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: ADMIN_ABI,
    functionName: 'feeBps', chainId: ARC_CHAIN_ID,
  })
  const { data: feeRecipient, refetch: refetchRecipient } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: ADMIN_ABI,
    functionName: 'feeRecipient', chainId: ARC_CHAIN_ID,
  })
  const { data: totalFees, refetch: refetchTotal } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: ADMIN_ABI,
    functionName: 'totalFeesCollected', chainId: ARC_CHAIN_ID,
  })
  const { data: pendingWithdrawal, refetch: refetchPending } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: ADMIN_ABI,
    functionName: 'pendingWithdrawals',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: ARC_CHAIN_ID,
    query: { enabled: !!address },
  })
  const { data: totalEscrowed, refetch: refetchEscrowed } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: ADMIN_ABI,
    functionName: 'totalEscrowed', chainId: ARC_CHAIN_ID,
  })
  const { data: bountyCount } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
    functionName: 'bountyCount', chainId: ARC_CHAIN_ID,
  })
  const { data: isPaused, refetch: refetchPaused } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: ADMIN_ABI,
    functionName: 'paused', chainId: ARC_CHAIN_ID,
  })

  const { writeContract, data: txHash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const isOwner = address && owner && address.toLowerCase() === (owner as string).toLowerCase()
  const onWrongChain = !!address && currentChainId !== ARC_CHAIN_ID
  const isBusy = isPending || isConfirming

  useEffect(() => {
    if (isSuccess) {
      void refetchFee(); void refetchRecipient(); void refetchTotal()
      void refetchPending(); void refetchPaused(); void refetchEscrowed()
      void refetchOwner()
    }
  }, [isSuccess, refetchFee, refetchRecipient, refetchTotal, refetchPending, refetchPaused, refetchEscrowed, refetchOwner])

  async function ensureChain() {
    if (currentChainId !== ARC_CHAIN_ID) {
      await switchChainAsync({ chainId: ARC_CHAIN_ID })
    }
  }

  async function handleWithdraw() {
    reset(); setActiveAction('withdraw')
    await ensureChain()
    writeContract({ address: BOUNTY_MARKET_ADDRESS, abi: ADMIN_ABI, functionName: 'withdraw', chainId: ARC_CHAIN_ID, chain: arcChain })
  }

  async function handleSetFee() {
    const bps = Math.round(parseFloat(newFeeBps) * 100)
    if (isNaN(bps) || bps < 0 || bps > 1000) return
    reset(); setActiveAction('setFee')
    await ensureChain()
    writeContract({ address: BOUNTY_MARKET_ADDRESS, abi: ADMIN_ABI, functionName: 'setFeeBps', args: [BigInt(bps)], chainId: ARC_CHAIN_ID, chain: arcChain })
  }

  async function handleSetRecipient() {
    if (!newRecipient.match(/^0x[0-9a-fA-F]{40}$/)) return
    reset(); setActiveAction('setRecipient')
    await ensureChain()
    writeContract({ address: BOUNTY_MARKET_ADDRESS, abi: ADMIN_ABI, functionName: 'setFeeRecipient', args: [newRecipient as `0x${string}`], chainId: ARC_CHAIN_ID, chain: arcChain })
  }

  async function handlePauseToggle() {
    reset(); setActiveAction('pause')
    await ensureChain()
    writeContract({ address: BOUNTY_MARKET_ADDRESS, abi: ADMIN_ABI, functionName: isPaused ? 'unpause' : 'pause', chainId: ARC_CHAIN_ID, chain: arcChain })
  }

  if (!address) {
    return (
      <div className="space-y-5 pb-8">
        <div className="flex items-center gap-3 pt-1">
          <button onClick={onBack} className="flex size-9 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(18,45,69,0.10)' }}>
            <ArrowLeft className="size-4" style={{ color: 'var(--ink-2)' }} />
          </button>
          <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>Admin</h1>
        </div>
        <div className="text-center py-16" style={{ color: 'var(--subtle)' }}>
          <ShieldCheck className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Connect your wallet to access the admin dashboard</p>
        </div>
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="space-y-5 pb-8">
        <div className="flex items-center gap-3 pt-1">
          <button onClick={onBack} className="flex size-9 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(18,45,69,0.10)' }}>
            <ArrowLeft className="size-4" style={{ color: 'var(--ink-2)' }} />
          </button>
          <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>Admin</h1>
        </div>
        <div
          className="rounded-2xl p-5 text-center space-y-2"
          style={{ background: 'rgba(186,43,76,0.06)', border: '1px solid rgba(186,43,76,0.15)' }}
        >
          <AlertTriangle className="size-8 mx-auto" style={{ color: 'var(--danger)' }} />
          <p className="font-semibold text-sm" style={{ color: 'var(--danger)' }}>Access denied</p>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            Connected as {formatAddress(address)}<br />
            Only the contract owner can access this page.
          </p>
          {owner && (
            <p className="text-xs mono pt-1" style={{ color: 'var(--subtle)' }}>
              Owner: {formatAddress(owner)}
            </p>
          )}
        </div>
      </div>
    )
  }

  const feePercent = feeBps ? (Number(feeBps) / 100).toFixed(2) : '—'
  const hasPendingFees = pendingWithdrawal && pendingWithdrawal > 0n

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={onBack} className="flex size-9 items-center justify-center rounded-full transition-all hover:scale-110" style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(18,45,69,0.10)' }}>
          <ArrowLeft className="size-4" style={{ color: 'var(--ink-2)' }} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>Admin Dashboard</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: 'var(--accent)' }}>Owner</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>BountyArc contract controls</p>
        </div>
      </div>

      {onWrongChain && (
        <div className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3" style={{ background: 'rgba(180,83,10,0.07)', border: '1px solid rgba(180,83,10,0.18)' }}>
          <p className="text-xs font-medium" style={{ color: '#b45309' }}>Switch to Arc Mainnet to use admin controls</p>
          <button onClick={() => void switchChainAsync({ chainId: ARC_CHAIN_ID })} className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: '#b45309' }}>Switch</button>
        </div>
      )}

      {/* Platform stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total bounties', value: bountyCount ? Number(bountyCount).toString() : '—', icon: '📋', color: 'var(--accent)' },
          { label: 'Active escrow', value: totalEscrowed ? formatReward(totalEscrowed) : '—', icon: '🔒', color: '#1e4fc2' },
          { label: 'Lifetime fees', value: totalFees ? formatReward(totalFees) : '—', icon: '💰', color: '#1a8047' },
          { label: 'Platform fee', value: `${feePercent}%`, icon: '⚙️', color: '#7c3aed' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 space-y-1" style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(18,45,69,0.09)' }}>
            <p className="text-lg">{s.icon}</p>
            <p className="display text-lg font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Withdraw fees */}
      <div
        className="rounded-3xl p-5 space-y-4"
        style={{ background: 'rgba(255,255,255,0.88)', border: `1px solid ${hasPendingFees ? 'rgba(26,128,71,0.20)' : 'rgba(18,45,69,0.09)'}` }}
      >
        <div className="flex items-center gap-2">
          <DollarSign className="size-5" style={{ color: '#1a8047' }} />
          <h2 className="font-bold text-sm" style={{ color: 'var(--ink)' }}>Your Pending Fees</h2>
        </div>
        <div
          className="rounded-2xl px-4 py-4 flex items-center justify-between"
          style={{ background: hasPendingFees ? 'rgba(26,128,71,0.07)' : 'var(--surface-muted)' }}
        >
          <div>
            <p className="display text-2xl font-black" style={{ color: hasPendingFees ? '#1a8047' : 'var(--muted)' }}>
              {pendingWithdrawal !== undefined ? formatReward(pendingWithdrawal) : '—'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>Ready to withdraw to your wallet</p>
          </div>
          <button
            onClick={() => void handleWithdraw()}
            disabled={!hasPendingFees || isBusy || onWrongChain}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#1a8047' }}
          >
            {isBusy && activeAction === 'withdraw' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : 'Withdraw'}
          </button>
        </div>
        {isSuccess && activeAction === null && txHash && (
          <a href={buildTxExplorerUrl(ARC_CHAIN_ID, txHash)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--success)' }}>
            ✓ Transaction confirmed <ExternalLink className="size-3" />
          </a>
        )}
      </div>

      {/* Fee settings */}
      <div className="rounded-3xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(18,45,69,0.09)' }}>
        <div className="flex items-center gap-2">
          <Settings className="size-5" style={{ color: 'var(--ink-2)' }} />
          <h2 className="font-bold text-sm" style={{ color: 'var(--ink)' }}>Fee Settings</h2>
        </div>

        {/* Current config */}
        <div className="space-y-2 rounded-2xl p-3" style={{ background: 'var(--surface-muted)' }}>
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--muted)' }}>Current fee</span>
            <span className="font-bold" style={{ color: 'var(--ink)' }}>{feePercent}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--muted)' }}>Fee recipient</span>
            <span className="font-semibold mono" style={{ color: 'var(--ink)' }}>
              {feeRecipient ? formatAddress(feeRecipient) : '—'}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--muted)' }}>Contract</span>
            <a
              href={buildAddressExplorerUrl(ARC_CHAIN_ID, BOUNTY_MARKET_ADDRESS)}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 font-semibold mono"
              style={{ color: 'var(--accent)' }}
            >
              {formatAddress(BOUNTY_MARKET_ADDRESS)} <ExternalLink className="size-3" />
            </a>
          </div>
        </div>

        {/* Update fee */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide block" style={{ color: 'var(--muted)' }}>
            Update fee % (max 10%)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              placeholder="e.g. 2.5"
              value={newFeeBps}
              onChange={e => setNewFeeBps(e.target.value)}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: 'var(--surface-muted)', border: '1.5px solid transparent', color: 'var(--ink)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
            />
            <button
              onClick={() => void handleSetFee()}
              disabled={!newFeeBps || isBusy || onWrongChain}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent)' }}
            >
              {isBusy && activeAction === 'setFee' ? <Loader2 className="size-4 animate-spin" /> : 'Update'}
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>Enter as percentage, e.g. 2.5 = 2.5%</p>
        </div>

        {/* Update fee recipient */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide block" style={{ color: 'var(--muted)' }}>
            Update fee recipient
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="0x..."
              value={newRecipient}
              onChange={e => setNewRecipient(e.target.value)}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none mono"
              style={{ background: 'var(--surface-muted)', border: '1.5px solid transparent', color: 'var(--ink)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
            />
            <button
              onClick={() => void handleSetRecipient()}
              disabled={!newRecipient.match(/^0x[0-9a-fA-F]{40}$/) || isBusy || onWrongChain}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent)' }}
            >
              {isBusy && activeAction === 'setRecipient' ? <Loader2 className="size-4 animate-spin" /> : 'Update'}
            </button>
          </div>
        </div>
      </div>

      {/* Emergency controls */}
      <div className="rounded-3xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(186,43,76,0.12)' }}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5" style={{ color: 'var(--danger)' }} />
          <h2 className="font-bold text-sm" style={{ color: 'var(--danger)' }}>Emergency Controls</h2>
        </div>
        <p className="text-xs" style={{ color: 'var(--subtle)' }}>
          Pausing blocks new bounty creation and submissions. Existing bounties and withdrawals are unaffected.
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Contract status</p>
            <p className="text-xs mt-0.5" style={{ color: isPaused ? 'var(--danger)' : 'var(--success)' }}>
              {isPaused ? '⏸ Paused' : '▶ Active'}
            </p>
          </div>
          <button
            onClick={() => void handlePauseToggle()}
            disabled={isBusy || onWrongChain}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
            style={{ background: isPaused ? '#1a8047' : 'var(--danger)' }}
          >
            {isBusy && activeAction === 'pause' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>
    </div>
  )
}
