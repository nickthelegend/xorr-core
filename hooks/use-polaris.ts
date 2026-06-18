// MIGRATED EVM → Sui. This was the central ethers/wagmi + Fhenix CoFHE hook for
// the legacy EVM build. XORR now settles on Sui (@mysten/dapp-kit). To keep the
// many legacy pages/components that destructure this hook compiling, every
// method is preserved by signature: contract READS return safe defaults and
// WRITES throw. Port each to the published xorr-contracts Move modules (see
// lib/market.ts / lib/bnpl.ts for the real Sui call shapes).
import { useState, useCallback } from 'react';
import { usePolarisWallet } from '@/lib/hooks/usePolarisWallet';

export function usePolaris() {
    const { address, connected } = usePolarisWallet();
    // Sui has a single network selected at the provider level; keep a string
    // chainId for legacy callers that split "ns:id".
    const chainId: string | undefined = undefined;
    const [loading] = useState(false);
    const [txHash] = useState<string | null>(null);

    // Legacy EVM contract config shape. Kept so `getMasterConfig().config.X`
    // destructures still typecheck. All addresses are empty on Sui.
    const getMasterConfig = useCallback(() => {
        return {
            config: {
                POOL_MANAGER: '',
                LOAN_ENGINE: '',
                SCORE_MANAGER: '',
                MERCHANT_ROUTER: '',
                CREDIT_ORACLE: '',
                USDC: '',
                USDT: '',
            },
            id: 0,
        };
    }, []);

    // TODO(xorr): port to Sui — there are no ethers Contract objects on Sui.
    const getContract = useCallback(async (_addr: string, _abi: any, _net: number, _useSigner = true): Promise<any> => {
        throw new Error('TODO(xorr): port to Sui — getContract is EVM-only');
    }, []);

    // ── Reads: safe defaults ──────────────────────────────────────────────
    // TODO(xorr): read from Sui
    const getPoolLiquidity = useCallback(async (_tokenAddress: string): Promise<string> => "0", []);
    // TODO(xorr): read from Sui
    const getTokenBalance = useCallback(async (_tokenAddress: string, _networkId: number): Promise<string> => "0", []);
    // TODO(xorr): read from Sui
    const getLPBalance = useCallback(async (_tokenAddress: string): Promise<string> => "0", []);
    // TODO(xorr): read from Sui
    const getUserTotalCollateral = useCallback(async (): Promise<string> => "0", []);
    // TODO(xorr): read from Sui (CreditProfile.score)
    const getScore = useCallback(async (): Promise<string> => "300", []);
    // TODO(xorr): read from Sui (CreditProfile.credit_limit)
    const getCreditLimit = useCallback(async (): Promise<string> => "0", []);
    // TODO(xorr): read from Sui
    const getExternalNetValue = useCallback(async (): Promise<string> => "0", []);
    // TODO(xorr): read from Sui — legacy returned an FHE handle; no analog on Sui.
    const getLPBalanceHandle = useCallback(async (_tokenAddress: string): Promise<string> => "0x", []);
    // TODO(xorr): read from Sui
    const getUserTotalCollateralHandle = useCallback(async (): Promise<string> => "0x", []);
    // TODO(xorr): read from Sui
    const getScoreHandle = useCallback(async (): Promise<string> => "0x", []);
    // TODO(xorr): read from Sui
    const getCreditLimitHandle = useCallback(async (): Promise<string> => "0x", []);
    // TODO(xorr): read from Sui (list owned loan/position objects)
    const getLoans = useCallback(async (): Promise<any[]> => [], []);

    // TODO(xorr): no client-side FHE on Sui; pass plaintext u64 to Move instead.
    const encryptAmount = useCallback(
        async (_amount: bigint, _contractAddress: string): Promise<{ handle: string; proof: string; encryptedInput: any }> => {
            throw new Error('TODO(xorr): port to Sui — no client-side encryption');
        },
        [],
    );

    // ── Writes: stubbed (callers still typecheck) ─────────────────────────
    const depositLiquidity = useCallback(async (_tokenAddress: string, _amount: string, _networkId: number): Promise<any> => {
        throw new Error('TODO(xorr): port to Sui');
    }, []);
    const addLiquidityFromProof = useCallback(async (_proof: any): Promise<any> => {
        throw new Error('TODO(xorr): port to Sui');
    }, []);
    const createLoan = useCallback(async (_amount: string, _tokenAddress: string): Promise<any> => {
        throw new Error('TODO(xorr): port to Sui — see lib/market.ts borrow builders');
    }, []);
    const repayLoan = useCallback(async (_loanId: number, _amount: string): Promise<any> => {
        throw new Error('TODO(xorr): port to Sui — see lib/market.ts repay builders');
    }, []);
    const requestWithdrawal = useCallback(async (_tokenAddress: string, _amount: string, _destChainId: number): Promise<any> => {
        throw new Error('TODO(xorr): port to Sui');
    }, []);
    const finalizeWithdrawal = useCallback(async (_nonce: number, _clearResult: string, _proof: string): Promise<any> => {
        throw new Error('TODO(xorr): port to Sui');
    }, []);
    const payWithCredit = useCallback(async (_merchantAddress: string, _amount: string, _tokenAddress: string): Promise<any> => {
        throw new Error('TODO(xorr): port to Sui — see lib/bnpl.ts openPurchaseTx');
    }, []);
    const updateCreditProfile = useCallback(async (_attestation: any): Promise<any> => {
        throw new Error('TODO(xorr): port to Sui');
    }, []);

    return {
        loading, txHash,
        depositLiquidity, addLiquidityFromProof, getPoolLiquidity,
        getTokenBalance, getLPBalance, getUserTotalCollateral, getExternalNetValue,
        getLPBalanceHandle, getUserTotalCollateralHandle,
        getScoreHandle, getCreditLimitHandle,
        getScore, getCreditLimit,
        createLoan, payWithCredit, repayLoan, getLoans,
        requestWithdrawal, finalizeWithdrawal, updateCreditProfile,
        getMasterConfig, getContract,
        authenticated: connected, address, chainId,
        encryptAmount,
    };
}
