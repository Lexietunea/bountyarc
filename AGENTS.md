# BountyArc

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

BountyArc is a many-to-many onchain bounty marketplace on Arc. Anyone can post a bounty by staking USDC (as native gas), anyone can submit work with a proof link, and the poster picks a winner — USDC releases instantly onchain.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.20 + Foundry. Sources in `contracts/`, build with `forge build`.
- Wallet: WalletConnect, injected, Coinbase Wallet
- Chain: Arc Mainnet (Chain ID: 5042, `arc` from `viem/chains`)
- Token: USDC native gas (18 decimals in msg.value view)
- Toasts: Sonner

## Deployed Contracts

| Contract | Chain | Address |
|---|---|---|
| BountyMarket | Arc Mainnet (5042) | 0x098f0BD99Fe7b568db86120ce03D6927FaD69712 |
| BountyMarket | Arc Testnet (5042002) | 0xb04b6f3f47908d89362710b69cc05f9a6d0132a9 |

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
