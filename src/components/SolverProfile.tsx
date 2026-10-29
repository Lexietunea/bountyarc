import { useState } from 'react'
import { useReadContracts, useReadContract } from 'wagmi'
import { ArrowLeft, Trophy, Star, ExternalLink, Copy, Check, Search } from 'lucide-react'
import {
  BOUNTY_MARKET_ADDRESS, BOUNTY_MARKET_ABI, ARC_CHAIN_ID,
  formatAddress, formatReward, formatDeadline, BountyStatus,
  STATUS_LABELS, STATUS_COLORS, STATUS_BG,
} from '../lib/bountyMarket'
import { buildAddressExplorerUrl } from '../onchain-facts'

interface Props {
  address?: string
  onBack: () => void
  onSelectBounty: (id: bigint) => void
}

function useAllBounties() {
  const { data: count } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
    functionName: 'bountyCount', chainId: ARC_CHAIN_ID,
  })
  const total = count ? Number(count) : 0
  const ids = Array.from({ length: Math.min(total, 200) }, (_, i) => BigInt(i + 1))
  const { data: bounties } = useReadContracts({
    contracts: ids.map(id => ({
      address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
      functionName: 'getBounty' as const, args: [id] as const, chainId: ARC_CHAIN_ID,
    })),
    query: { enabled: ids.length > 0 },
  })
  return { bounties: bounties?.map(r => r.result) ?? [], ids }
}

function useAllSubmissionsForBounties(ids: bigint[]) {
  const { data } = useReadContracts({
    contracts: ids.map(id => ({
      address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
      functionName: 'getBountySubmissions' as const, args: [id] as const, chainId: ARC_CHAIN_ID,
    })),
    query: { enabled: ids.length > 0 },
  })
  // Flatten: { bountyId, submissionId }[]
  const flat: { bountyId: bigint; submissionId: bigint }[] = []
  data?.forEach((r, i) => {
    const sids = r.result as bigint[] | undefined
    sids?.forEach(sid => flat.push({ bountyId: ids[i], submissionId: sid }))
  })
  return flat
}

function useSubmissions(pairs: { bountyId: bigint; submissionId: bigint }[]) {
  const { data } = useReadContracts({
    contracts: pairs.map(p => ({
      address: BOUNTY_MARKET_ADDRESS, abi: BOUNTY_MARKET_ABI,
      functionName: 'getSubmission' as const, args: [p.submissionId] as const, chainId: ARC_CHAIN_ID,
    })),
    query: { enabled: pairs.length > 0 },
  })
  return data?.map((r, i) => ({ ...r.result as { id: bigint; bountyId: bigint; submitter: string; proofUri: string; submittedAt: bigint; isWinner: boolean }, _bountyId: pairs[i].bountyId })) ?? []
}

export default function SolverProfile({ address: propAddress, onBack, onSelectBounty }: Props) {
  const [searchInput, setSearchInput] = useState(propAddress ?? '')
  const [activeAddress, setActiveAddress] = useState(propAddress ?? '')
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'wins' | 'submissions' | 'posted'>('wins')

  const { bounties, ids } = useAllBounties()
  const subPairs = useAllSubmissionsForBounties(ids)
  const allSubmissions = useSubmissions(subPairs)

  const addr = activeAddress.toLowerCase()

  // Stats
  const mySubmissions = allSubmissions.filter(s => s.submitter?.toLowerCase() === addr)
  const myWins = mySubmissions.filter(s => s.isWinner)
  const myPosted = bounties.filter(b => (b as { poster?: string })?.poster?.toLowerCase() === addr)
  const totalEarned = myWins.reduce((acc, s) => {
    const b = bounties.find(x => x && (x as { id?: bigint }).id === s._bountyId)
    return acc + ((b as { reward?: bigint })?.reward ?? 0n)
  }, 0n)
  const winRate = mySubmissions.length > 0 ? Math.round((myWins.length / mySubmissions.length) * 100) : 0

  function handleSearch() {
    const trimmed = searchInput.trim()
    if (trimmed.match(/^0x[0-9a-fA-F]{40}$/)) setActiveAddress(trimmed)
  }

  function copyAddress() {
    void navigator.clipboard.writeText(activeAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const isEmpty = !activeAddress.match(/^0x[0-9a-fA-F]{40}$/)

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
          <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>Solver Profile</h1>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>Public reputation on Arc Mainnet</p>
        </div>
      </div>

      {/* Address search */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(18,45,69,0.09)' }}
      >
        <label className="text-xs font-semibold uppercase tracking-wide block" style={{ color: 'var(--muted)' }}>
          Wallet Address
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="0x..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none mono"
            style={{ background: 'var(--surface-muted)', border: '1.5px solid transparent', color: 'var(--ink)' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--focus)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
          />
          <button
            onClick={handleSearch}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white transition-all hover:scale-105"
            style={{ background: 'var(--accent)' }}
          >
            <Search className="size-4" />
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="text-center py-12" style={{ color: 'var(--subtle)' }}>
          <Trophy className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Enter a wallet address to view their profile</p>
        </div>
      ) : (
        <>
          {/* Profile card */}
          <div
            className="rounded-3xl p-5 space-y-4"
            style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(18,45,69,0.09)' }}
          >
            {/* Identity */}
            <div className="flex items-center gap-3">
              <div
                className="size-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0"
                style={{ background: `hsl(${parseInt(activeAddress.slice(2, 8), 16) % 360}, 60%, 45%)` }}
              >
                {activeAddress.slice(2, 4).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold mono text-sm truncate" style={{ color: 'var(--ink)' }}>
                    {formatAddress(activeAddress)}
                  </p>
                  <button
                    onClick={copyAddress}
                    className="flex size-6 items-center justify-center rounded-lg transition-all hover:scale-110 shrink-0"
                    style={{ background: 'var(--surface-muted)' }}
                  >
                    {copied ? <Check className="size-3" style={{ color: 'var(--success)' }} /> : <Copy className="size-3" style={{ color: 'var(--subtle)' }} />}
                  </button>
                  <a
                    href={buildAddressExplorerUrl(ARC_CHAIN_ID, activeAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex size-6 items-center justify-center rounded-lg shrink-0 transition-all hover:scale-110"
                    style={{ background: 'var(--surface-muted)' }}
                  >
                    <ExternalLink className="size-3" style={{ color: 'var(--subtle)' }} />
                  </a>
                </div>
                <p className="text-xs mono mt-0.5 truncate" style={{ color: 'var(--subtle)' }}>{activeAddress}</p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Wins', value: myWins.length, color: '#1a8047', bg: 'rgba(26,128,71,0.08)' },
                { label: 'Submissions', value: mySubmissions.length, color: 'var(--accent)', bg: 'rgba(18,45,69,0.06)' },
                { label: 'Win rate', value: `${winRate}%`, color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
                { label: 'Posted', value: myPosted.length, color: '#b45309', bg: 'rgba(180,83,10,0.08)' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-3 text-center" style={{ background: s.bg }}>
                  <p className="display text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* USDC earned */}
            <div
              className="rounded-2xl px-4 py-3 flex items-center justify-between"
              style={{ background: 'rgba(26,128,71,0.06)', border: '1px solid rgba(26,128,71,0.14)' }}
            >
              <div className="flex items-center gap-2">
                <Star className="size-4 fill-current" style={{ color: '#1a8047' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Total USDC earned</span>
              </div>
              <span className="display text-lg font-black" style={{ color: '#1a8047' }}>
                {formatReward(totalEarned)}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div
            className="flex rounded-2xl p-1 gap-1"
            style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(18,45,69,0.08)' }}
          >
            {([['wins', '🏆 Wins'], ['submissions', '📝 Submissions'], ['posted', '📌 Posted']] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 rounded-xl py-2 text-xs font-semibold transition-all"
                style={{
                  background: tab === t ? 'var(--accent)' : 'transparent',
                  color: tab === t ? '#fff' : 'var(--muted)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Wins tab */}
          {tab === 'wins' && (
            <div className="space-y-3">
              {myWins.length === 0 ? (
                <div className="text-center py-10" style={{ color: 'var(--subtle)' }}>
                  <Trophy className="size-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No wins yet</p>
                </div>
              ) : myWins.map(s => {
                const b = bounties.find(x => x && (x as { id?: bigint }).id === s._bountyId) as { id: bigint; title: string; reward: bigint; status: number; deadline: bigint } | undefined
                return (
                  <button
                    key={String(s.id)}
                    onClick={() => onSelectBounty(s._bountyId)}
                    className="w-full rounded-2xl p-4 text-left transition-all hover:scale-[1.01]"
                    style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(26,128,71,0.20)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(26,128,71,0.10)', color: '#1a8047' }}>🏆 Winner</span>
                        </div>
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{b?.title ?? `Bounty #${s._bountyId}`}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
                          {b ? formatDeadline(b.deadline) : ''}
                        </p>
                      </div>
                      <span className="display text-base font-black shrink-0" style={{ color: '#1a8047' }}>
                        {b ? formatReward(b.reward) : '—'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Submissions tab */}
          {tab === 'submissions' && (
            <div className="space-y-3">
              {mySubmissions.length === 0 ? (
                <div className="text-center py-10" style={{ color: 'var(--subtle)' }}>
                  <p className="text-sm">No submissions yet</p>
                </div>
              ) : mySubmissions.map(s => {
                const b = bounties.find(x => x && (x as { id?: bigint }).id === s._bountyId) as { id: bigint; title: string; reward: bigint; status: number; deadline: bigint } | undefined
                const status = b?.status as BountyStatus | undefined
                return (
                  <button
                    key={String(s.id)}
                    onClick={() => onSelectBounty(s._bountyId)}
                    className="w-full rounded-2xl p-4 text-left transition-all hover:scale-[1.01]"
                    style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(18,45,69,0.09)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          {s.isWinner && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(26,128,71,0.10)', color: '#1a8047' }}>🏆 Winner</span>
                          )}
                          {status !== undefined && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: STATUS_BG[status] ?? 'rgba(18,45,69,0.06)', color: STATUS_COLORS[status] ?? 'var(--muted)' }}>
                              {STATUS_LABELS[status] ?? 'Unknown'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{b?.title ?? `Bounty #${s._bountyId}`}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--subtle)' }}>
                          Proof: {s.proofUri.slice(0, 40)}{s.proofUri.length > 40 ? '…' : ''}
                        </p>
                      </div>
                      <span className="display text-sm font-black shrink-0" style={{ color: 'var(--ink-2)' }}>
                        {b ? formatReward(b.reward) : '—'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Posted tab */}
          {tab === 'posted' && (
            <div className="space-y-3">
              {myPosted.length === 0 ? (
                <div className="text-center py-10" style={{ color: 'var(--subtle)' }}>
                  <p className="text-sm">No bounties posted yet</p>
                </div>
              ) : myPosted.map(b => {
                const bTyped = b as { id: bigint; title: string; reward: bigint; status: number; submissionCount: bigint; deadline: bigint }
                const status = bTyped.status as BountyStatus
                return (
                  <button
                    key={String(bTyped.id)}
                    onClick={() => onSelectBounty(bTyped.id)}
                    className="w-full rounded-2xl p-4 text-left transition-all hover:scale-[1.01]"
                    style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(18,45,69,0.09)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: STATUS_BG[status], color: STATUS_COLORS[status] }}>
                            {STATUS_LABELS[status]}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                            {Number(bTyped.submissionCount)} submission{Number(bTyped.submissionCount) !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{bTyped.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>{formatDeadline(bTyped.deadline)}</p>
                      </div>
                      <span className="display text-sm font-black shrink-0" style={{ color: 'var(--accent)' }}>
                        {formatReward(bTyped.reward)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
