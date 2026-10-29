import { useBalance } from 'wagmi'
import { ARC_TESTNET_CHAIN_ID } from '../lib/bountyMarket'
import { formatUnitsFixed } from '../onchain-money'

export function useUsdcBalance(address: `0x${string}` | undefined) {
  // On Arc the native token IS USDC (18 decimals in the gas view).
  // useBalance with no token address reads the native balance.
  const { data, isLoading } = useBalance({
    address,
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  if (!data || !address) return { formatted: null, isLoading }

  // data.value is in 18-decimal native units — format to 2 dp
  const formatted = formatUnitsFixed(data.value, 18, 2)
  return { formatted, isLoading }
}
