// MIGRATED EVM/FHE → Sui. The legacy private credit score lived in an FHE
// ScoreManager contract (encrypted euint32). Sui has NO FHE; the credit score
// is a plaintext field on the Move `credit::CreditProfile` object. This hook
// keeps its return shape so the credit page compiles; reads return defaults and
// the on-chain mutation is stubbed.
import { useState, useCallback } from 'react';

interface PrivateScoreState {
  decryptedScore: number | null;
  decryptedLimit: number | null;
  isInitialized: boolean | null;
  loading: boolean;
  decrypting: boolean;
  error: string | null;
}

export function usePrivateScore() {
  const [state, setState] = useState<PrivateScoreState>({
    decryptedScore: null, decryptedLimit: null,
    isInitialized: null, loading: false, decrypting: false, error: null,
  });

  // TODO(xorr): read from Sui — does the caller own a credit::CreditProfile?
  const checkInitialized = useCallback(async (): Promise<boolean> => {
    setState((s) => ({ ...s, isInitialized: false, error: null }));
    return false;
  }, []);

  // TODO(xorr): port to Sui — see lib/bnpl.ts openProfileTx (credit::open_profile).
  const initializeScore = useCallback(async () => {
    setState((s) => ({ ...s, loading: false, error: 'TODO(xorr): port to Sui' }));
  }, []);

  // TODO(xorr): read from Sui — CreditProfile.score / .credit_limit are plaintext.
  const decryptAll = useCallback(async (): Promise<{ score: number | null; limit: number | null }> => {
    setState((s) => ({ ...s, decrypting: false }));
    return { score: null, limit: null };
  }, []);

  return {
    ...state,
    checkInitialized,
    initializeScore,
    decryptScore: decryptAll,
    decryptAll,
    contractAddress: '',
  };
}
