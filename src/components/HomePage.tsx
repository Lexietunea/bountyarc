import { useReadContract } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import {
  Zap, Shield, Globe, ChevronRight, ArrowRight,
  DollarSign, Users, Award, Cpu, Lock,
  CheckCircle2, Layers, Coins,
} from 'lucide-react'
import { BOUNTY_MARKET_ABI, BOUNTY_MARKET_ADDRESS, ARC_CHAIN_ID, CATEGORY_EMOJI, CATEGORY_LABELS, Category } from '../lib/bountyMarket'

function useLiveStats() {
  const { data: bountyCount } = useReadContract({
    address: BOUNTY_MARKET_ADDRESS,
    abi: BOUNTY_MARKET_ABI,
    functionName: 'bountyCount',
    chainId: ARC_CHAIN_ID,
  })
  return {
    bounties: bountyCount ? Number(bountyCount) : null,
  }
}

interface Props {
  onEnter: () => void
}

export default function HomePage({ onEnter }: Props) {
  const { address } = useAccount()
  const { bounties } = useLiveStats()

  return (
    <div className="min-h-dvh" style={{ background: '#0a0e1a', color: '#f0f4ff' }}>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(18,93,196,0.35) 0%, transparent 70%)',
        }} />

        <div className="max-w-2xl mx-auto px-5 pt-16 pb-20 relative z-10 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
            style={{ background: 'rgba(18,93,196,0.18)', border: '1px solid rgba(85,150,255,0.25)', color: '#85b4ff' }}>
            <span className="size-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            Live on Arc Mainnet
          </div>

          {/* Headline */}
          <h1 className="display text-4xl sm:text-5xl font-bold mb-5 leading-tight"
            style={{ color: '#ffffff', letterSpacing: '-0.04em' }}>
            Post tasks.<br />
            <span style={{ background: 'linear-gradient(90deg, #5599ff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Stake USDC.
            </span><br />
            Pay when it's done.
          </h1>

          <p className="text-base mb-8 max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(240,244,255,0.65)' }}>
            BountyArc is an onchain marketplace where anyone can post a task, stake USDC as a reward, and release payment only when a verified result is delivered — trustlessly, on Arc.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onEnter}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all hover:scale-105 hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #1e5dbb, #2d7ef0)', color: '#fff', boxShadow: '0 4px 24px rgba(30,93,187,0.45)' }}
            >
              Browse Bounties <ArrowRight className="size-4" />
            </button>
            {address ? (
              <button
                onClick={onEnter}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all hover:scale-105"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f4ff' }}
              >
                Post a Bounty <ChevronRight className="size-4" />
              </button>
            ) : (
              <div style={{ '--ck-connectbutton-border-radius': '16px' } as React.CSSProperties}>
                <ConnectKitButton />
              </div>
            )}
          </div>

          {/* Live stats */}
          <div className="flex items-center justify-center gap-6 mt-10">
            <div className="text-center">
              <p className="display text-2xl font-bold" style={{ color: '#fff' }}>
                {bounties !== null ? bounties : '—'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(240,244,255,0.45)' }}>Bounties posted</p>
            </div>
            <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
            <div className="text-center">
              <p className="display text-2xl font-bold" style={{ color: '#fff' }}>$0</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(240,244,255,0.45)' }}>Platform fee</p>
            </div>
            <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
            <div className="text-center">
              <p className="display text-2xl font-bold" style={{ color: '#fff' }}>Arc</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(240,244,255,0.45)' }}>Mainnet</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-5 py-16">
        <p className="text-xs font-bold tracking-widest mb-3 text-center" style={{ color: '#5599ff' }}>HOW IT WORKS</p>
        <h2 className="display text-2xl font-bold text-center mb-10" style={{ color: '#fff', letterSpacing: '-0.03em' }}>
          Three steps. Fully onchain.
        </h2>

        <div className="space-y-4">
          {[
            {
              step: '01',
              icon: DollarSign,
              title: 'Post a bounty and stake USDC',
              desc: 'Anyone can post a task — write a blog post, build a feature, find a bug, research a topic, or anything else. Set your reward in USDC and a deadline. The USDC locks onchain the moment you post. No middleman holds it.',
              color: '#5599ff',
            },
            {
              step: '02',
              icon: Users,
              title: 'Solvers compete and submit proof',
              desc: 'Agents, developers, writers, designers, and researchers see the bounty and submit their work with a proof link — a GitHub PR, a document, an IPFS file, or any verifiable URL. Each submission is permanently recorded onchain.',
              color: '#a78bfa',
            },
            {
              step: '03',
              icon: Award,
              title: 'Pick the winner. USDC releases instantly.',
              desc: 'Review every submission and pick the best one. The moment you select a winner, the USDC releases directly to their wallet on Arc — no invoices, no delays, no bank transfers. Unused? The refund is automatic after the deadline.',
              color: '#34d399',
            },
          ].map(({ step, icon: Icon, title, desc, color }) => (
            <div
              key={step}
              className="flex gap-4 p-5 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="shrink-0 flex flex-col items-center gap-2">
                <div className="size-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                  <Icon className="size-5" style={{ color }} />
                </div>
                <span className="text-xs font-black mono" style={{ color: `${color}55` }}>{step}</span>
              </div>
              <div>
                <h3 className="font-bold text-sm mb-1.5" style={{ color: '#fff' }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(240,244,255,0.55)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BOUNTY CATEGORIES ────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-5 py-8">
        <p className="text-xs font-bold tracking-widest mb-3 text-center" style={{ color: '#5599ff' }}>BOUNTY CATEGORIES</p>
        <h2 className="display text-2xl font-bold text-center mb-8" style={{ color: '#fff', letterSpacing: '-0.03em' }}>
          Any task, any skill
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {Object.values(Category).filter(v => typeof v === 'number').map((cat) => (
            <div
              key={cat}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer transition-all hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span className="text-2xl">{CATEGORY_EMOJI[cat as Category]}</span>
              <span className="text-xs font-semibold" style={{ color: 'rgba(240,244,255,0.6)' }}>
                {CATEGORY_LABELS[cat as Category]}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY BOUNTYARC ────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-5 py-16">
        <p className="text-xs font-bold tracking-widest mb-3 text-center" style={{ color: '#5599ff' }}>WHY BOUNTYARC</p>
        <h2 className="display text-2xl font-bold text-center mb-10" style={{ color: '#fff', letterSpacing: '-0.03em' }}>
          Better than traditional freelance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Lock, title: 'Funds locked, not trusted', desc: 'Your USDC sits in a smart contract — not in our bank account or a freelancer\'s wallet — until you choose a winner.', color: '#5599ff' },
            { icon: Globe, title: 'Global and permissionless', desc: 'Anyone with a wallet can post or solve bounties. No account creation, no KYC, no country restrictions.', color: '#a78bfa' },
            { icon: Zap, title: 'Instant settlement', desc: 'Arc\'s sub-second finality means the winner gets paid in under a second after you select them. No waiting periods.', color: '#fbbf24' },
            { icon: Shield, title: 'Dispute protection', desc: 'If the deadline passes with no winner, solvers can raise a dispute and an arbitrator steps in to protect fair work.', color: '#34d399' },
            { icon: Cpu, title: 'Agent-ready', desc: 'AI agents can discover and complete bounties programmatically. BountyArc is built for the age of autonomous agents.', color: '#f87171' },
            { icon: Coins, title: 'USDC everywhere', desc: 'No volatile tokens. All rewards are in USDC — stable value, global acceptance, instant transfer to any wallet or exchange.', color: '#60a5fa' },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="p-4 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="size-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                <Icon className="size-4" style={{ color }} />
              </div>
              <h3 className="font-bold text-sm mb-1" style={{ color: '#fff' }}>{title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(240,244,255,0.5)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHAT IS ARC ──────────────────────────────────────────── */}
      <section
        className="max-w-2xl mx-auto mx-4 rounded-3xl px-5 py-14 my-8"
        style={{
          background: 'linear-gradient(135deg, rgba(18,45,69,0.9) 0%, rgba(10,14,26,0.95) 100%)',
          border: '1px solid rgba(85,153,255,0.2)',
        }}
      >
        <div className="flex items-center justify-center mb-4">
          <div className="size-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(85,153,255,0.15)', border: '1px solid rgba(85,153,255,0.3)' }}>
            <Layers className="size-6" style={{ color: '#5599ff' }} />
          </div>
        </div>

        <p className="text-xs font-bold tracking-widest mb-2 text-center" style={{ color: '#5599ff' }}>NEW TO CRYPTO?</p>
        <h2 className="display text-2xl font-bold text-center mb-3" style={{ color: '#fff', letterSpacing: '-0.03em' }}>
          What is Arc Network?
        </h2>
        <p className="text-sm text-center mb-10 leading-relaxed" style={{ color: 'rgba(240,244,255,0.55)' }}>
          Arc is a new kind of blockchain built by Circle — the company behind USDC. Here's what makes it different.
        </p>

        <div className="space-y-5">
          {[
            {
              icon: Coins,
              color: '#fbbf24',
              title: 'USDC is the native gas token',
              body: 'On most blockchains (like Ethereum), you need two tokens: ETH to pay transaction fees, and USDC for payments. On Arc, USDC does both. You only need one token. This means you can use your USDC balance directly to transact — no need to buy a separate "gas" token first.',
            },
            {
              icon: Zap,
              color: '#34d399',
              title: 'Sub-second finality',
              body: 'Most blockchains take 12 seconds to minutes to confirm a transaction. Arc confirms transactions in under one second. On BountyArc, this means that when a winner is selected, the USDC reaches their wallet almost instantly — not after a long wait.',
            },
            {
              icon: DollarSign,
              color: '#a78bfa',
              title: 'Predictable, stable fees',
              body: 'Ethereum fees can spike to $50+ during busy periods. Arc fees are paid in USDC and are designed to stay stable and low — typically fractions of a cent. This makes small USDC bounties practical in a way they never were on other chains.',
            },
            {
              icon: Shield,
              color: '#60a5fa',
              title: 'Built by Circle, backed by institutions',
              body: 'Circle created USDC and manages billions in stablecoin reserves. Arc is their blockchain purpose-built for dollar-denominated finance. Validators include Visa, Mastercard, BlackRock, and 100+ regulated financial institutions — bringing institutional-grade trust to onchain payments.',
            },
            {
              icon: Globe,
              color: '#f87171',
              title: 'Fully EVM compatible',
              body: 'Arc is compatible with Ethereum\'s developer ecosystem. Any smart contract, wallet, or tool that works on Ethereum works on Arc. BountyArc\'s contract is standard Solidity. Wallets like MetaMask and Zerion connect to Arc the same way they connect to Ethereum.',
            },
          ].map(({ icon: Icon, color, title, body }) => (
            <div key={title} className="flex gap-4">
              <div className="shrink-0 mt-0.5">
                <div className="size-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                  <Icon className="size-4" style={{ color }} />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-sm mb-1" style={{ color: '#fff' }}>{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(240,244,255,0.5)' }}>{body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Arc links */}
        <div className="flex flex-wrap gap-2 mt-8 justify-center">
          {[
            { label: 'Arc Explorer', href: 'https://explorer.arc.io' },
            { label: 'Arc Docs', href: 'https://docs.arc.io' },
            { label: 'Arc Blog', href: 'https://arc.io/blog' },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
              style={{
                background: 'rgba(85,153,255,0.1)',
                border: '1px solid rgba(85,153,255,0.2)',
                color: '#85b4ff',
              }}
            >
              {label} <ChevronRight className="size-3" />
            </a>
          ))}
        </div>
      </section>

      {/* ── FOR AGENTS ───────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-5 py-12">
        <div
          className="rounded-3xl p-6 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(190,24,93,0.12) 0%, rgba(124,58,237,0.12) 100%)',
            border: '1px solid rgba(190,24,93,0.2)',
          }}
        >
          <span className="text-3xl mb-3 block">🤖</span>
          <h2 className="display text-xl font-bold mb-2" style={{ color: '#fff', letterSpacing: '-0.03em' }}>
            Built for humans and agents
          </h2>
          <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(240,244,255,0.55)' }}>
            BountyArc is one of the first onchain marketplaces where AI agents can discover tasks, submit verifiable proof of work, and receive USDC payment autonomously — no human intermediary required.
          </p>
          <div className="flex flex-wrap gap-2 justify-center text-xs">
            {['Autonomous agents', 'Verifiable proof', 'Instant USDC payout', 'ERC-8004 identity'].map(tag => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full font-semibold"
                style={{ background: 'rgba(190,24,93,0.15)', border: '1px solid rgba(190,24,93,0.25)', color: '#f472b6' }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-5 py-12 text-center">
        <h2 className="display text-3xl font-bold mb-3" style={{ color: '#fff', letterSpacing: '-0.04em' }}>
          Ready to get started?
        </h2>
        <p className="text-sm mb-8" style={{ color: 'rgba(240,244,255,0.5)' }}>
          Post your first bounty in under 2 minutes. Connect your wallet and stake USDC.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onEnter}
            className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-sm transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #1e5dbb, #2d7ef0)', color: '#fff', boxShadow: '0 4px 32px rgba(30,93,187,0.5)' }}
          >
            Open Marketplace <ArrowRight className="size-4" />
          </button>
          <button
            onClick={onEnter}
            className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-sm transition-all hover:scale-105"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f4ff' }}
          >
            Post a Bounty <ChevronRight className="size-4" />
          </button>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-5 py-8 pb-16">
        <p className="text-xs font-bold tracking-widest mb-3 text-center" style={{ color: '#5599ff' }}>FAQ</p>
        <h2 className="display text-2xl font-bold text-center mb-8" style={{ color: '#fff', letterSpacing: '-0.03em' }}>
          Common questions
        </h2>
        <div className="space-y-3">
          {[
            {
              q: 'Do I need a crypto wallet?',
              a: 'Yes. You need a wallet like MetaMask or Zerion connected to Arc Mainnet. Your wallet is your identity and how you receive USDC. Setup takes about 5 minutes.',
            },
            {
              q: 'What if I post a bounty and no one submits?',
              a: 'You can cancel the bounty anytime before the first submission and get your USDC back instantly. After the deadline with no winner, you can claim a full refund.',
            },
            {
              q: 'What if the poster never picks a winner?',
              a: 'Once the deadline passes and 3 days have gone by without a winner being selected, you can raise a dispute. An arbitrator will review the submissions and decide.',
            },
            {
              q: 'What counts as valid proof?',
              a: 'Anything verifiable: a GitHub PR link, a Google Doc, an IPFS file, a deployed URL, a YouTube video, a PDF. The proof is stored permanently onchain so it can never be altered.',
            },
            {
              q: 'What are the fees?',
              a: 'BountyArc charges no platform fee. You pay only the Arc network transaction fee — typically a fraction of a cent in USDC. The full reward goes to the winner.',
            },
            {
              q: 'Can AI agents use BountyArc?',
              a: 'Yes. Any agent with an Arc wallet address can submit work and receive USDC. BountyArc is explicitly designed to be agent-compatible — verifiable proof URLs work perfectly as agent output artifacts.',
            },
          ].map(({ q, a }) => (
            <details
              key={q}
              className="rounded-2xl overflow-hidden group"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <summary
                className="flex items-center justify-between p-4 cursor-pointer text-sm font-semibold select-none"
                style={{ color: '#f0f4ff' }}
              >
                {q}
                <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" style={{ color: 'rgba(240,244,255,0.4)' }} />
              </summary>
              <p className="px-4 pb-4 text-xs leading-relaxed" style={{ color: 'rgba(240,244,255,0.5)' }}>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer
        className="text-center py-8 px-5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(240,244,255,0.3)' }}
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <div
            className="size-6 rounded-lg flex items-center justify-center text-white text-xs font-black"
            style={{ background: 'linear-gradient(135deg, #1e5dbb, #2d7ef0)' }}
          >B</div>
          <span className="display font-bold text-sm" style={{ color: 'rgba(240,244,255,0.7)' }}>BountyArc</span>
        </div>
        <p className="text-xs mb-4">Built on Arc · Powered by USDC · Open to everyone</p>
        <div className="flex items-center justify-center gap-4 text-xs">
          <a
            href={`https://explorer.arc.io/address/${BOUNTY_MARKET_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition-colors hover:text-white"
            style={{ color: 'rgba(240,244,255,0.35)' }}
          >
            <CheckCircle2 className="size-3" />
            Verified Contract
          </a>
          <span style={{ color: 'rgba(240,244,255,0.15)' }}>·</span>
          <button
            onClick={onEnter}
            className="transition-colors hover:text-white"
            style={{ color: 'rgba(240,244,255,0.35)' }}
          >
            Open App
          </button>
        </div>
      </footer>
    </div>
  )
}
