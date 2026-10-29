import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { MessageSquare, Loader2, Send } from 'lucide-react'
import {
  BOUNTY_MARKET_ADDRESS,
  BOUNTY_MARKET_ABI,
  ARC_TESTNET_CHAIN_ID,
  formatAddress,
} from '../lib/bountyMarket'
import { arc as arcChain } from 'viem/chains'
import { buildAddressExplorerUrl } from '../onchain-facts'

// Comments are V2-only — on V1 these calls will return empty/revert
// The component gracefully shows nothing if the contract doesn't support comments

interface Props {
  bountyId: bigint
}

function CommentItem({ commentId }: { commentId: bigint }) {
  const { data: raw } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS,
    abi: BOUNTY_MARKET_ABI,
    functionName: 'getComment',
    args: [commentId],
    chainId: ARC_TESTNET_CHAIN_ID,
  })
  const comment = raw as { author: `0x${string}`; text: string; createdAt: bigint } | undefined
  if (!comment) return null

  return (
    <div
      className="rounded-2xl p-3 space-y-1.5"
      style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(18,45,69,0.07)' }}
    >
      <div className="flex items-center gap-2">
        <a
          href={buildAddressExplorerUrl(ARC_TESTNET_CHAIN_ID, comment.author)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold mono hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          {formatAddress(comment.author)}
        </a>
        <span className="text-xs" style={{ color: 'var(--subtle)' }}>
          {new Date(Number(comment.createdAt) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>{comment.text}</p>
    </div>
  )
}

export default function CommentThread({ bountyId }: Props) {
  const { address } = useAccount()
  const [text, setText] = useState('')

  const { data: commentIds, refetch } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS,
    abi: BOUNTY_MARKET_ABI,
    functionName: 'getBountyComments',
    args: [bountyId],
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  const { writeContract, isPending, data: txHash } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  if (isSuccess) {
    setText('')
    setTimeout(() => { void refetch() }, 1000)
  }

  const ids = commentIds as bigint[] | undefined

  // V1 contract won't have getBountyComments — if it errors, ids stays undefined
  // Only render if we have comment data (V2+) or at least the input to try
  const hasComments = ids && ids.length > 0
  const busy = isPending || confirming

  function handleComment() {
    if (!text.trim()) return
    writeContract({
      address: BOUNTY_MARKET_ADDRESS,
      abi: BOUNTY_MARKET_ABI,
      functionName: 'addComment',
      args: [bountyId, text.trim()],
      chainId: ARC_TESTNET_CHAIN_ID,
      chain: arcChain,
    })
  }

  return (
    <div className="space-y-3">
      <h2 className="display font-bold text-base flex items-center gap-2" style={{ color: 'var(--ink)' }}>
        <MessageSquare className="size-4" />
        Discussion {hasComments ? `(${ids.length})` : ''}
      </h2>

      {/* Comment list */}
      {hasComments && (
        <div className="space-y-2">
          {ids.map(cid => <CommentItem key={String(cid)} commentId={cid} />)}
        </div>
      )}

      {!hasComments && (
        <p className="text-xs" style={{ color: 'var(--subtle)' }}>No comments yet. Ask a question or clarify the requirements.</p>
      )}

      {/* Add comment */}
      {address && (
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(18,45,69,0.08)' }}
        >
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Add a comment</label>
            <span className="text-xs tabular-nums" style={{ color: text.length > 450 ? 'var(--danger)' : 'var(--subtle)' }}>
              {text.length}/500
            </span>
          </div>
          <textarea
            rows={2}
            maxLength={500}
            placeholder="Ask a question, clarify requirements, share context…"
            value={text}
            onChange={e => setText(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
            style={{ background: 'var(--surface-muted)', border: '1.5px solid transparent', color: 'var(--ink)' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--focus)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
          />
          <button
            onClick={handleComment}
            disabled={!text.trim() || busy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 transition-all hover:scale-[1.02]"
            style={{ background: 'var(--accent)' }}
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
            {busy ? (isPending ? 'Confirm in wallet…' : 'Posting…') : 'Post comment'}
          </button>
        </div>
      )}
    </div>
  )
}
