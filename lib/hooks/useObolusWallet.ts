// MIGRATED wagmi → Sui. Thin wrapper over usePolarisWallet (@mysten/dapp-kit)
// so legacy consumers (sidebar-drawer, footer, connect-gate, algorand hooks)
// keep compiling. `disconnect` is a stub.
import { usePolarisWallet } from '@/lib/hooks/usePolarisWallet';

export function useObolusWallet() {
  const { address, connected, connecting, networkId } = usePolarisWallet();
  return {
    address,
    connected,
    connecting,
    networkId,
    // TODO(xorr): wire to @mysten/dapp-kit useDisconnectWallet().mutate.
    disconnect: () => {},
  };
}
