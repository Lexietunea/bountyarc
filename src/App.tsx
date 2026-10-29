import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { UserCircle2 } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import MarketplaceFeed from './components/MarketplaceFeed'
import PostBounty from './components/PostBounty'
import BountyDetail from './components/BountyDetail'
import ProfileView from './components/ProfileView'
import WalletMenu, { WrongChainBanner } from './components/WalletMenu'
import HomePage from './components/HomePage'
import SolverProfile from './components/SolverProfile'
import AdminDashboard from './components/AdminDashboard'
import { BOUNTY_MARKET_ADDRESS, ARC_CHAIN_ID } from './lib/bountyMarket'
import { buildAddressExplorerUrl } from './onchain-facts'

void BOUNTY_MARKET_ADDRESS
void buildAddressExplorerUrl

type View = 'home' | 'feed' | 'post' | { detail: bigint } | 'profile' | { solver: string } | 'admin'

function parseHash(): View {
  const hash = window.location.hash
  const bountyMatch = hash.match(/^#\/bounty\/(\d+)$/)
  if (bountyMatch) return { detail: BigInt(bountyMatch[1]) }
  const solverMatch = hash.match(/^#\/solver\/(0x[0-9a-fA-F]{40})$/)
  if (solverMatch) return { solver: solverMatch[1] }
  if (hash === '#/post') return 'post'
  if (hash === '#/profile') return 'profile'
  if (hash === '#/admin') return 'admin'
  if (hash === '#/app' || hash === '#/feed') return 'feed'
  return 'home'
}

function setHash(view: View) {
  if (view === 'home') { window.location.hash = ''; return }
  if (view === 'feed') { window.location.hash = '#/app'; return }
  if (view === 'post') { window.location.hash = '#/post'; return }
  if (view === 'profile') { window.location.hash = '#/profile'; return }
  if (view === 'admin') { window.location.hash = '#/admin'; return }
  if (typeof view === 'object' && 'detail' in view) {
    window.location.hash = `#/bounty/${view.detail}`; return
  }
  if (typeof view === 'object' && 'solver' in view) {
    window.location.hash = `#/solver/${view.solver}`
  }
}

export default function App() {
  const { address } = useAccount()
  const [view, setView] = useState<View>(parseHash)

  // Sync view → hash
  function navigate(v: View) {
    setView(v)
    setHash(v)
  }

  // Sync hash → view on back/forward navigation
  useEffect(() => {
    const handler = () => setView(parseHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  if (view === 'home') {
    return (
      <>
        <Toaster position="top-center" richColors closeButton />
        <HomePage onEnter={() => navigate('feed')} />
      </>
    )
  }

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      <Toaster position="top-center" richColors closeButton />

      {/* Header */}
      <header
        className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between gap-3"
        style={{
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid rgba(18,45,69,0.08)',
        }}
      >
        <button
          onClick={() => navigate('home')}
          className="flex items-center gap-2 transition-all hover:opacity-80"
        >
          <div
            className="size-8 rounded-xl flex items-center justify-center text-white text-sm font-black"
            style={{ background: 'var(--accent)' }}
          >
            B
          </div>
          <span className="display font-bold text-base" style={{ color: 'var(--ink)' }}>BountyArc</span>
        </button>

        <div className="flex items-center gap-2">
          {address && (
            <>
              <button
                onClick={() => navigate('profile')}
                className="flex size-9 items-center justify-center rounded-full transition-all hover:scale-105"
                style={{
                  background: view === 'profile' ? 'var(--accent)' : 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(18,45,69,0.10)',
                }}
              >
                <UserCircle2
                  className="size-5"
                  style={{ color: view === 'profile' ? '#fff' : 'var(--ink-2)' }}
                />
              </button>
            </>
          )}
          {address ? <WalletMenu onAdmin={() => navigate('admin')} /> : <ConnectKitButton />}
        </div>
      </header>

      {/* Wrong chain banner */}
      <WrongChainBanner targetChainId={ARC_CHAIN_ID} />

      {/* Body */}
      <main className="max-w-md mx-auto px-4 py-5">
        {view === 'feed' && (
          <MarketplaceFeed
            onSelectBounty={id => navigate({ detail: id })}
            onPost={() => navigate('post')}
          />
        )}

        {view === 'post' && (
          <PostBounty
            onBack={() => navigate('feed')}
            onPosted={() => {
              toast.success('Bounty posted!', { description: 'Your USDC is locked onchain. Share the link to attract solvers.' })
              navigate('feed')
            }}
          />
        )}

        {typeof view === 'object' && 'detail' in view && (
          <BountyDetail
            bountyId={view.detail}
            onBack={() => navigate('feed')}
            onWinnerSelected={(reward) => toast.success('Winner selected!', { description: `${reward} released to the winner.` })}
            onWorkSubmitted={() => toast.success('Work submitted!', { description: 'The poster will review your submission.' })}
            onRefunded={() => toast.success('Refund claimed!', { description: 'USDC returned to the poster.' })}
            onCancelled={() => {
              toast.success('Bounty cancelled', { description: 'Your USDC has been returned.' })
              navigate('feed')
            }}
          />
        )}

        {view === 'profile' && (
          <ProfileView
            onBack={() => navigate('feed')}
            onSelectBounty={id => navigate({ detail: id })}
            onCancelBounty={(id) => navigate({ detail: id })}
          />
        )}

        {typeof view === 'object' && 'solver' in view && (
          <SolverProfile
            address={view.solver}
            onBack={() => navigate('feed')}
            onSelectBounty={id => navigate({ detail: id })}
          />
        )}

        {view === 'admin' && (
          <AdminDashboard onBack={() => navigate('feed')} />
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 px-4">
        <a
          href={buildAddressExplorerUrl(ARC_CHAIN_ID, BOUNTY_MARKET_ADDRESS)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs mono"
          style={{ color: 'var(--subtle)' }}
        >
          BountyArc contract on Arc · {BOUNTY_MARKET_ADDRESS.slice(0, 10)}…{BOUNTY_MARKET_ADDRESS.slice(-8)}
        </a>
      </footer>
    </div>
  )
}
