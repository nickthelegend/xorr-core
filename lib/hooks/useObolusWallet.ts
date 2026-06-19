// Thin wrapper over usePolarisWallet (@mysten/dapp-kit) so consumers
// (sidebar-drawer, footer, connect-gate) keep a stable shape.
import { useDisconnectWallet } from '@mysten/dapp-kit';
import { usePolarisWallet } from '@/lib/hooks/usePolarisWallet';

export function useObolusWallet() {
  const { address, connected, connecting, networkId } = usePolarisWallet();
  const { mutate: disconnect } = useDisconnectWallet();
  return {
    address,
    connected,
    connecting,
    networkId,
    disconnect: () => disconnect(),
  };
}
