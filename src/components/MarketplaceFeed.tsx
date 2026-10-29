import { useReadContract } from 'wagmi'
import { PlusCircle, Search } from 'lucide-react'
import { useState } from 'react'
import {
  BOUNTY_MARKET_ADDRESS,
  BOUNTY_MARKET_ABI,
  ARC_TESTNET_CHAIN_ID,
  BountyStatus,
  Category,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_BG,
  CATEGORY_LABELS,
  CATEGORY_EMOJI,
  CATEGORY_COLORS,
  CATEGORY_BG,
  formatReward,
  formatAddress,
  LARGE_BOUNTY_THRESHOLD,
} from '../lib/bountyMarket'
import { useCountdown } from '../hooks/useCountdown'

interface Props {
  onSelectBounty: (id: bigint) => void
  onPost: () => void
}

type Filter = 'all' | 'open' | 'completed'

const ALL_CATEGORIES = Object.values(Category).filter(v => typeof v === 'number') as Category[]

function CountdownPill({ deadline, status }: { deadline: bigint; status: number }) {
  const cd = useCountdown(deadline)
  if (Number(status) !== Number(BountyStatus.Open)) return null
  if (cd.expired) return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(107,114,128,0.10)', color: '#6b7280' }}>
      Expired
    </span>
  )
  return (
    <span
      className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full"
      style={{
        background: cd.urgent ? 'rgba(186,43,76,0.10)' : 'rgba(16,97,166,0.08)',
        color: cd.urgent ? '#ba2b4c' : '#1061a6',
      }}
    >
      {cd.label}
    </span>
  )
}

function BountyCard({ bountyId, onSelect }: { bountyId: bigint; onSelect: (id: bigint) => void }) {
  const { data: raw, isLoading } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS,
    abi: BOUNTY_MARKET_ABI,
    functionName: 'getBounty',
    args: [bountyId],
    chainId: ARC_TESTNET_CHAIN_ID,
  })
  const bounty = raw as { title: string; reward: bigint; deadline: bigint; status: number; submissionCount: bigint; poster: `0x${string}`; category?: number } | undefined

  if (isLoading || !bounty) {
    return (
      <div className="rounded-2xl p-4 animate-pulse" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(18,45,69,0.08)' }}>
        <div className="h-4 w-2/3 rounded bg-slate-200 mb-2" />
        <div className="h-3 w-1/3 rounded bg-slate-100" />
      </div>
    )
  }

  const status = Number(bounty.status) as BountyStatus
  const category = (bounty.category !== undefined ? Number(bounty.category) : Category.General) as Category

  return (
    <button
      onClick={() => onSelect(bountyId)}
      className="w-full text-left rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99] hover:shadow-md"
      style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(18,45,69,0.08)', backdropFilter: 'blur(12px)' }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-sm leading-snug flex-1 line-clamp-2" style={{ color: 'var(--ink)' }}>
          {bounty.title}
        </h3>
        <span
          className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: STATUS_BG[status], color: STATUS_COLORS[status] }}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* Category pill */}
      <div className="mb-3">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: CATEGORY_BG[category], color: CATEGORY_COLORS[category] }}
        >
          {CATEGORY_EMOJI[category]} {CATEGORY_LABELS[category]}
        </span>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="display text-base font-bold" style={{ color: 'var(--accent)' }}>
            {formatReward(bounty.reward)}
          </span>
          {bounty.reward > LARGE_BOUNTY_THRESHOLD && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,97,166,0.10)', color: 'var(--accent)' }}>
              🏆 5 winners
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--subtle)' }}>
            {Number(bounty.submissionCount)} submission{Number(bounty.submissionCount) !== 1 ? 's' : ''}
          </span>
        </div>
        <CountdownPill deadline={bounty.deadline} status={bounty.status} />
      </div>

      <div className="mt-2 text-xs" style={{ color: 'var(--subtle)' }}>
        by {formatAddress(bounty.poster)}
      </div>
    </button>
  )
}

export default function MarketplaceFeed({ onSelectBounty, onPost }: Props) {
  const [filter, setFilter] = useState<Filter>('open')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<Category | null>(null)

  const { data: countRaw } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS,
    abi: BOUNTY_MARKET_ABI,
    functionName: 'bountyCount',
    chainId: ARC_TESTNET_CHAIN_ID,
  })
  const count = Number(countRaw ?? 0n)
  const allIds = Array.from({ length: count }, (_, i) => BigInt(count - i))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>Bounties</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
            {count} total · stake USDC, pay on delivery
          </p>
        </div>
        <button
          onClick={onPost}
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'var(--accent)' }}
        >
          <PlusCircle className="size-4" />
          Post
        </button>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2 rounded-2xl px-4 py-2.5"
        style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(18,45,69,0.10)' }}
      >
        <Search className="size-4 shrink-0" style={{ color: 'var(--subtle)' }} />
        <input
          type="text"
          placeholder="Search bounties…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--ink)' }}
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs" style={{ color: 'var(--subtle)' }}>Clear</button>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2">
        {(['open', 'all', 'completed'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all"
            style={{
              background: filter === f ? 'var(--accent)' : 'rgba(255,255,255,0.7)',
              color: filter === f ? '#fff' : 'var(--muted)',
              border: filter === f ? 'none' : '1px solid rgba(18,45,69,0.10)',
            }}
          >
            {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'Completed'}
          </button>
        ))}
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCategoryFilter(null)}
          className="px-3 py-1 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: categoryFilter === null ? 'rgba(18,45,69,0.12)' : 'rgba(255,255,255,0.7)',
            color: categoryFilter === null ? 'var(--ink)' : 'var(--muted)',
            border: categoryFilter === null ? 'none' : '1px solid rgba(18,45,69,0.10)',
          }}
        >
          All categories
        </button>
        {ALL_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            className="px-3 py-1 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: categoryFilter === cat ? CATEGORY_BG[cat] : 'rgba(255,255,255,0.7)',
              color: categoryFilter === cat ? CATEGORY_COLORS[cat] : 'var(--muted)',
              border: categoryFilter === cat ? `1px solid ${CATEGORY_COLORS[cat]}40` : '1px solid rgba(18,45,69,0.10)',
            }}
          >
            {CATEGORY_EMOJI[cat]} {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Cards */}
      {count === 0 ? (
        <div className="py-16 text-center space-y-2">
          <p className="text-2xl">🏆</p>
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>No bounties yet</p>
          <p className="text-sm" style={{ color: 'var(--subtle)' }}>Be the first to post one</p>
          <button
            onClick={onPost}
            className="mt-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            Post a bounty
          </button>
        </div>
      ) : (
        <BountyList
          allIds={allIds}
          filter={filter}
          search={search}
          categoryFilter={categoryFilter}
          onSelect={onSelectBounty}
        />
      )}
    </div>
  )
}

function BountyList({
  allIds, filter, search, categoryFilter, onSelect,
}: {
  allIds: bigint[]
  filter: Filter
  search: string
  categoryFilter: Category | null
  onSelect: (id: bigint) => void
}) {
  if (allIds.length === 0) return <p className="text-center text-sm py-8" style={{ color: 'var(--subtle)' }}>No bounties found.</p>
  return (
    <div className="space-y-3 pb-4">
      {allIds.map(id => (
        <BountyCardFilter key={String(id)} bountyId={id} filter={filter} search={search} categoryFilter={categoryFilter} onSelect={onSelect} />
      ))}
    </div>
  )
}

function BountyCardFilter({
  bountyId, filter, search, categoryFilter, onSelect,
}: {
  bountyId: bigint
  filter: Filter
  search: string
  categoryFilter: Category | null
  onSelect: (id: bigint) => void
}) {
  const { data: raw } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS,
    abi: BOUNTY_MARKET_ABI,
    functionName: 'getBounty',
    args: [bountyId],
    chainId: ARC_TESTNET_CHAIN_ID,
  })
  const bounty = raw as { title: string; status: number; category?: number } | undefined
  if (!bounty) return <BountyCard bountyId={bountyId} onSelect={onSelect} />

  const status = Number(bounty.status) as BountyStatus
  const category = (bounty.category !== undefined ? Number(bounty.category) : Category.General) as Category

  if (filter === 'open' && status !== BountyStatus.Open) return null
  if (filter === 'completed' && status !== BountyStatus.Completed) return null
  if (search && !bounty.title.toLowerCase().includes(search.toLowerCase())) return null
  if (categoryFilter !== null && category !== categoryFilter) return null

  return <BountyCard bountyId={bountyId} onSelect={onSelect} />
}
