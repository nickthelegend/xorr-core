import { useCurrentAccount } from "@mysten/dapp-kit";

// Migrated from wagmi (EVM) to Sui (@mysten/dapp-kit). Returns the connected
// Sui account so address-consuming UI keeps working through the pivot.
export function usePolarisWallet() {
  const account = useCurrentAccount();
  return {
    address: account?.address,
    connected: !!account,
    connecting: false,
    networkId: undefined as number | undefined,
  };
}
