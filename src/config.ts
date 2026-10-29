/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig, fallback } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arc } from 'viem/chains'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Arc Mainnet RPC endpoints — explicit list so wagmi never falls back to undefined
const ARC_RPCS = arc.rpcUrls.default.http

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arc.id, ARC_RPCS[0])

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string

export const config = createConfig({
  chains: [arc, mainnet],
  connectors: [
    injected(),
    walletConnect({
      projectId,
      metadata: {
        name: 'BountyArc',
        description: 'Onchain bounty marketplace on Arc',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://bountyarc-4d5c62.netlify.app',
        icons: [],
      },
    }),
    coinbaseWallet({ appName: 'BountyArc' }),
  ],
  transports: {
    // Explicit RPC URLs with fallback — never resolves to undefined
    [arc.id]: fallback(ARC_RPCS.map(url => http(url))),
    [mainnet.id]: http(),
  },
})
