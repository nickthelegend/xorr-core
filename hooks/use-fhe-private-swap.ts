// MIGRATED EVM/FHE → Sui. Sui has NO FHE, so the Fhenix CoFHE encrypted-swap
// flow is gone. Return shape preserved so amm-swap-widget compiles; both
// actions throw until ported to a Sui Move swap module.
import { useState, useCallback } from 'react';

export function useFhePrivateSwap() {
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  // TODO(xorr): port to Sui — no encrypted deposits; use a plaintext Move call.
  const depositEncrypted = useCallback(
    async (_swapContractAddress: string, _amount: bigint): Promise<string> => {
      throw new Error('TODO(xorr): port to Sui');
    },
    [],
  );

  // TODO(xorr): port to Sui — no encrypted swaps; use a plaintext Move call.
  const swapEncrypted = useCallback(
    async (_swapContractAddress: string, _amountIn: bigint, _targetToken: string): Promise<string> => {
      throw new Error('TODO(xorr): port to Sui');
    },
    [],
  );

  return {
    depositEncrypted,
    swapEncrypted,
    loading,
    error,
  };
}
