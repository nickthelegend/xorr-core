// XORR Buy-Now-Pay-Never transaction builders, wired to the published
// xorr-contracts package on Sui testnet. Call shapes validated end-to-end by
// scripts/e2e-bnpl.mjs.
import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { USDT_PACKAGE_ID, USDT_FAUCET_ID, USDT_DECIMALS, CONFIDENTIAL_PKG, ATTESTED_ORACLE_ID } from "./sui";

const PKG = USDT_PACKAGE_ID;
// Functions ADDED by package upgrades (e.g. lending_pool::withdraw_amount) live
// at the latest version id; types + v1 functions stay resolvable at PKG.
const LATEST_PKG =
  process.env.NEXT_PUBLIC_LATEST_PKG ?? "0xffbc99cca6437bcd05e23e8bc290b968b83074ab36da6ad1938b5b96517b8310";
const T = `${PKG}::usdc::USDC`;
const SCALE = 10 ** USDT_DECIMALS;

// Canonical, pre-funded demo objects (override via env). The pool already has
// supplied liquidity so purchases can be fronted immediately.
export const BNPL_POOL_ID =
  process.env.NEXT_PUBLIC_BNPL_POOL_ID ?? "0x2763f2907909d2aade0224bad144d4497df741d01c500d781c7abd2331cb9993";
export const BNPL_ESCROW_ID =
  process.env.NEXT_PUBLIC_BNPL_ESCROW_ID ?? "0x44945bd13ef548fd3beb77c6d111bdfd88e549a3650a9caa7213d527d4e59c0c";

const u64 = (usdt: number) => BigInt(Math.floor(usdt * SCALE));

/** Mint test USDT straight to the connected wallet (capped by the Move faucet). */
export function faucetTx(amountUsdt: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: `${PKG}::usdc::faucet_to_sender`, arguments: [tx.object(USDT_FAUCET_ID), tx.pure.u64(u64(amountUsdt))] });
  return tx;
}

/** Open (share) a credit profile for the caller. Starter limit 50 USDT. */
export function openProfileTx(): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: `${PKG}::credit::open_profile` });
  return tx;
}

/** Buy now: lock `collateralUsdt` of USDT, borrow `amountUsdt`, pay the merchant. */
export function openPurchaseTx(p: {
  profileId: string;
  primaryCoinId: string;
  amountUsdt: number;
  collateralUsdt: number;
  termEpochs?: number;
  orderId?: string;
  escrowId?: string; // merchant's MerchantEscrow<USDC>; defaults to the demo escrow
}): Transaction {
  const tx = new Transaction();
  const [collat] = tx.splitCoins(tx.object(p.primaryCoinId), [tx.pure.u64(u64(p.collateralUsdt))]);
  tx.moveCall({
    target: `${PKG}::bnpl::open_purchase`,
    typeArguments: [T, T],
    arguments: [
      tx.object(BNPL_POOL_ID),
      tx.object(p.profileId),
      tx.object(p.escrowId ?? BNPL_ESCROW_ID),
      collat,
      tx.pure.u64(u64(p.amountUsdt)),
      tx.pure.u64(BigInt(p.termEpochs ?? 30)),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(p.orderId ?? "xorr-order"))),
    ],
  });
  return tx;
}

/** Repay a loan (principal + interest). Overpayment is refunded to the sender. */
export function repayTx(p: { loanId: string; profileId: string; primaryCoinId: string; amountUsdt: number; sender: string }): Transaction {
  const tx = new Transaction();
  const [pay] = tx.splitCoins(tx.object(p.primaryCoinId), [tx.pure.u64(u64(p.amountUsdt))]);
  const refund = tx.moveCall({
    target: `${PKG}::bnpl::repay`,
    typeArguments: [T, T],
    arguments: [tx.object(p.loanId), tx.object(BNPL_POOL_ID), tx.object(p.profileId), pay],
  });
  tx.transferObjects([refund], p.sender);
  return tx;
}

/** Pay-Never engine: route realized yield (e.g. from collateral deployed to
 * DeepBook) in to auto-repay a loan. Returns leftover to the sender. */
export function autoRepayFromYieldTx(p: { loanId: string; profileId: string; primaryCoinId: string; yieldUsdt: number; sender: string }): Transaction {
  const tx = new Transaction();
  const [yieldCoin] = tx.splitCoins(tx.object(p.primaryCoinId), [tx.pure.u64(u64(p.yieldUsdt))]);
  const refund = tx.moveCall({
    target: `${PKG}::bnpl::auto_repay_from_yield`,
    typeArguments: [T, T],
    arguments: [tx.object(p.loanId), tx.object(BNPL_POOL_ID), tx.object(p.profileId), yieldCoin],
  });
  tx.transferObjects([refund], p.sender);
  return tx;
}

export type CreditProfileView = {
  creditLimit: number;
  outstanding: number;
  repaidTotal: number;
  score: number;
  available: number;
};

/** Read a CreditProfile object and return its fields in USDT units. */
export async function readCreditProfile(client: SuiJsonRpcClient, profileId: string): Promise<CreditProfileView | null> {
  const obj = await client.getObject({ id: profileId, options: { showContent: true } });
  const content = obj.data?.content;
  if (!content || content.dataType !== "moveObject") return null;
  const f = content.fields as Record<string, string>;
  const creditLimit = Number(f.credit_limit) / SCALE;
  const outstanding = Number(f.outstanding) / SCALE;
  return {
    creditLimit,
    outstanding,
    repaidTotal: Number(f.repaid_total) / SCALE,
    score: Number(f.score),
    available: Math.max(0, creditLimit - outstanding),
  };
}

/** USDC coin type, for client.getCoins({ owner, coinType }). */
export const USDT_COIN_TYPE = T;

export type LoanView = {
  outstanding: number;
  principal: number;
  principalRepaid: number;
  dueEpoch: number;
  openedEpoch: number;
  status: number; // 0 active, 1 repaid, 2 defaulted
  collateralLockId: string;
};

/** Read a bnpl::Loan object's fields (outstanding, due epoch, status, …). */
export async function readLoan(client: SuiJsonRpcClient, loanId: string): Promise<LoanView | null> {
  const obj = await client.getObject({ id: loanId, options: { showContent: true } });
  const c = obj.data?.content;
  if (!c || c.dataType !== "moveObject") return null;
  const f = c.fields as Record<string, string>;
  return {
    outstanding: Number(f.outstanding) / SCALE,
    principal: Number(f.principal) / SCALE,
    principalRepaid: Number(f.principal_repaid) / SCALE,
    dueEpoch: Number(f.due_epoch),
    openedEpoch: Number(f.opened_epoch),
    status: Number(f.status),
    collateralLockId: String(f.collateral_lock_id ?? ""),
  };
}

/** Repay a loan using the caller's lending-pool position: withdraw the
 * SupplyReceipt for USDC and route it straight into the loan. Leftover (the
 * yield earned beyond the debt) is returned to the sender. One transaction. */
export function repayFromLpTx(p: { loanId: string; profileId: string; receiptId: string; amountUsdt: number; sender: string }): Transaction {
  const tx = new Transaction();
  // Partial withdraw — pull just enough liquidity to cover the loan, leaving the
  // rest of the LP position intact (full withdraw would fail while funds are lent).
  const coin = tx.moveCall({
    target: `${LATEST_PKG}::lending_pool::withdraw_amount`,
    typeArguments: [T],
    arguments: [tx.object(BNPL_POOL_ID), tx.object(p.receiptId), tx.pure.u64(u64(p.amountUsdt))],
  });
  const refund = tx.moveCall({
    target: `${PKG}::bnpl::repay`,
    typeArguments: [T, T],
    arguments: [tx.object(p.loanId), tx.object(BNPL_POOL_ID), tx.object(p.profileId), coin],
  });
  tx.transferObjects([refund], p.sender);
  return tx;
}

const hexToBytes = (hex: string): number[] => {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.substr(i, 2), 16));
  return out;
};

/** Verify a TEE-signed credit attestation on-chain and apply the score to the
 * borrower's CreditProfile (unlocks unsecured borrowing). Uses the ATTESTED
 * oracle — the enclave key was bound to a verified on-chain AWS Nitro attestation
 * (PCR-gated), so the signature is provably from the audited enclave image. All
 * numeric args are passed verbatim — they must match what the enclave signed. */
export function applyTeeScoreTx(p: {
  profileId: string;
  score: number;
  approvedLimit: number; // raw u64 (6-dp units), as signed by the enclave
  nonce: number;
  timestampMs: number;
  signatureHex: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONFIDENTIAL_PKG}::confidential_credit::verify_and_apply_score_attested_v2`,
    arguments: [
      tx.object(ATTESTED_ORACLE_ID),
      tx.object(p.profileId),
      tx.object("0x6"), // Clock — enforces attestation freshness (replay-safe)
      tx.pure.u64(BigInt(p.score)),
      tx.pure.u64(BigInt(p.approvedLimit)),
      tx.pure.u64(BigInt(p.nonce)),
      tx.pure.u64(BigInt(p.timestampMs)),
      tx.pure.vector("u8", hexToBytes(p.signatureHex)),
    ],
  });
  return tx;
}
