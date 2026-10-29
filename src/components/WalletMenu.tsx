import { useState, useRef, useEffect } from 'react'
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi'
import { arc, arcTestnet } from 'viem/chains'
import { LogOut, ChevronDown, Radio, ArrowLeftRight, ShieldCheck } from 'lucide-react'
import { useUsdcBalance } from '../hooks/useUsdcBalance'

const MAINNET_ID = arc.id          // 5042
const TESTNET_ID = arcTestnet.id   // 5042002

function formatAddr(a: string) {
  return `${a.slice(0, 6)}...${a.slice(-4)}`
}

export default function WalletMenu({ onAdmin }: { onAdmin?: () => void }) {
  const { address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switching } = useSwitchChain()
  const { formatted: balance } = useUsdcBalance(address)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!address) return null

  const isMainnet = chainId === MAINNET_ID
  const isTestnet = chainId === TESTNET_ID
  const networkLabel = isMainnet ? 'Arc Mainnet' : isTestnet ? 'Arc Testnet' : `Chain ${chainId}`
  const networkColor = isMainnet ? '#0ea05a' : isTestnet ? '#f59e0b' : '#94a3b8'

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(18,45,69,0.12)',
          boxShadow: '0 1px 4px rgba(18,45,69,0.06)',
        }}
      >
        {/* Network dot */}
        <span className="size-2 rounded-full shrink-0" style={{ background: networkColor }} />
        {/* Address */}
        <span className="text-sm font-semibold mono" style={{ color: 'var(--ink)' }}>
          {formatAddr(address)}
        </span>
        <ChevronDown
          className="size-3.5 transition-transform"
          style={{ color: 'var(--ink-2)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-2xl overflow-hidden z-50"
          style={{
            background: 'rgba(255,255,255,0.97)',
            border: '1px solid rgba(18,45,69,0.10)',
            boxShadow: '0 8px 32px rgba(18,45,69,0.14)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Wallet info */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(18,45,69,0.07)' }}>
            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--subtle)' }}>Connected wallet</p>
            <p className="text-sm font-semibold mono break-all" style={{ color: 'var(--ink)' }}>{address}</p>
            {balance !== null && (
              <p className="text-xs font-semibold mt-1" style={{ color: 'var(--accent)' }}>
                ${balance} USDC
              </p>
            )}
          </div>

          {/* Network */}
          <div className="px-4 py-2.5 border-b" style={{ borderColor: 'rgba(18,45,69,0.07)' }}>
            <div className="flex items-center gap-2">
              <Radio className="size-3.5 shrink-0" style={{ color: networkColor }} />
              <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{networkLabel}</span>
            </div>
          </div>

          {/* Switch network */}
          <div className="p-2 border-b" style={{ borderColor: 'rgba(18,45,69,0.07)' }}>
            <p className="text-xs px-2 mb-1.5 font-medium" style={{ color: 'var(--subtle)' }}>Switch network</p>
            <button
              onClick={() => { switchChain({ chainId: MAINNET_ID }); setOpen(false) }}
              disabled={isMainnet || switching}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:bg-black/5 disabled:opacity-40"
              style={{ color: 'var(--ink)' }}
            >
              <span className="size-2 rounded-full shrink-0" style={{ background: '#0ea05a' }} />
              Arc Mainnet
              {isMainnet && <span className="ml-auto text-xs font-semibold" style={{ color: '#0ea05a' }}>Active</span>}
            </button>
            <button
              onClick={() => { switchChain({ chainId: TESTNET_ID }); setOpen(false) }}
              disabled={isTestnet || switching}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:bg-black/5 disabled:opacity-40"
              style={{ color: 'var(--ink)' }}
            >
              <span className="size-2 rounded-full shrink-0" style={{ background: '#f59e0b' }} />
              Arc Testnet
              {isTestnet && <span className="ml-auto text-xs font-semibold" style={{ color: '#f59e0b' }}>Active</span>}
            </button>
          </div>

          {/* Admin */}
          {onAdmin && (
            <div className="p-2 border-b" style={{ borderColor: 'rgba(18,45,69,0.07)' }}>
              <button
                onClick={() => { onAdmin(); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-black/5"
                style={{ color: 'var(--accent)' }}
              >
                <ShieldCheck className="size-4" />
                Admin Dashboard
              </button>
            </div>
          )}

          {/* Disconnect */}
          <div className="p-2">
            <button
              onClick={() => { disconnect(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-red-50"
              style={{ color: '#ef4444' }}
            >
              <LogOut className="size-4" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact network-switch banner (shown when on wrong chain for the active contract)
export function WrongChainBanner({ targetChainId }: { targetChainId: number }) {
  const { chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  if (!chainId || chainId === targetChainId) return null
  const targetName = targetChainId === MAINNET_ID ? 'Arc Mainnet' : 'Arc Testnet'
  return (
    <div
      className="mx-4 mt-3 px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3"
      style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' }}
    >
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="size-4 shrink-0" style={{ color: '#f59e0b' }} />
        <span className="text-sm font-medium" style={{ color: '#92400e' }}>
          Switch to {targetName} to transact
        </span>
      </div>
      <button
        onClick={() => switchChain({ chainId: targetChainId })}
        disabled={isPending}
        className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all hover:scale-105 disabled:opacity-50 shrink-0"
        style={{ background: '#f59e0b', color: '#fff' }}
      >
        {isPending ? 'Switching…' : 'Switch'}
      </button>
    </div>
  )
}
