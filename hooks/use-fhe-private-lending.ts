// MIGRATED EVM/FHE → Sui. Sui has NO FHE, so the Fhenix CoFHE encrypt/decrypt
// flow is gone. This hook keeps its full return shape (balances + actions) so
// the legacy pages (borrow, positions, vaults, lending-action-modal) compile.
// Balances default to plaintext null; every write throws until ported to the
// xorr-contracts Move modules (see lib/market.ts for the real call shapes).
import { useState, useCallback } from 'react';

interface FhePrivateLendingState {
  collateralBalance: bigint | null;
  debtBalance: bigint | null;
  suppliedBalance: bigint | null;
  creditScore: number | null;
  creditLimit: bigint | null;
  loading: boolean;
  error: string | null;
}

export function useFhePrivateLending() {
  const [state, setState] = useState<FhePrivateLendingState>({
    collateralBalance: null,
    debtBalance: null,
    suppliedBalance: null,
    creditScore: null,
    creditLimit: null,
    loading: false,
    error: null,
  });

  // TODO(xorr): read positions from Sui (owned loan/supply objects + CreditProfile).
  // Accepts the legacy 1- or 3-address signatures; args are ignored.
  const decryptAllPositions = useCallback(async (..._addrs: string[]) => {
    setState((s) => ({ ...s, loading: false, error: null }));
  }, []);

  // TODO(xorr): port to Sui — see lib/market.ts supplyTx.
  const supply = useCallback(async (_amount: bigint, _tokenAddress?: string): Promise<string> => {
    throw new Error('TODO(xorr): port to Sui');
  }, []);

  // TODO(xorr): port to Sui — see lib/market.ts borrow builders.
  const borrow = useCallback(async (_amount: bigint, _tokenAddress?: string): Promise<string> => {
    throw new Error('TODO(xorr): port to Sui');
  }, []);

  // TODO(xorr): port to Sui — collateral lock lives in market::borrow_collateralized.
  const depositCollateral = useCallback(async (_amount: bigint): Promise<string> => {
    throw new Error('TODO(xorr): port to Sui');
  }, []);

  // TODO(xorr): port to Sui — see lib/market.ts release/repay builders.
  const withdraw = useCallback(async (_amount: bigint, _tokenAddress: string): Promise<string> => {
    throw new Error('TODO(xorr): port to Sui');
  }, []);

  // TODO(xorr): port to Sui — see lib/market.ts repay builders.
  const repay = useCallback(async (_loanId: number, _amount: bigint): Promise<string> => {
    throw new Error('TODO(xorr): port to Sui');
  }, []);

  // TODO(xorr): port to Sui — the FHE audit-reveal flow has no Sui analog.
  const repayLoan = useCallback(async (_loanId: number): Promise<string> => {
    throw new Error('TODO(xorr): port to Sui');
  }, []);

  // TODO(xorr): port to Sui — no FHE relayer/withdrawal-nonce flow on Sui.
  const requestWithdrawal = useCallback(async (_tokenAddress: string, _amount: bigint, _destChainId: number): Promise<string> => {
    throw new Error('TODO(xorr): port to Sui');
  }, []);

  // TODO(xorr): port to Sui — no FHE relayer/withdrawal-nonce flow on Sui.
  const finalizeWithdrawal = useCallback(async (_nonce: number, _clearResult: string, _proof: string): Promise<string> => {
    throw new Error('TODO(xorr): port to Sui');
  }, []);

  // TODO(xorr): no client-side FHE on Sui; pass plaintext u64 to Move instead.
  const encryptAmount = useCallback(async (_amount: bigint, _contractAddress: string): Promise<{ handle: string; proof: string; encryptedInput: any }> => {
    throw new Error('TODO(xorr): port to Sui — no client-side encryption');
  }, []);

  return {
    ...state,
    decryptAllPositions,
    supply,
    borrow,
    depositCollateral,
    withdraw,
    repay,
    repayLoan,
    requestWithdrawal,
    finalizeWithdrawal,
    encryptAmount,
  };
}
