// Lend/borrow market transaction builders (over- and under-collateralized),
// wired to the published xorr-contracts `market` + `lending_pool` modules.
// Collateral is USDT for the demo (C = T).
import { Transaction } from "@mysten/sui/transactions";
import { USDT_PACKAGE_ID, USDT_DECIMALS } from "./sui";
import { BNPL_POOL_ID } from "./bnpl";

const PKG = USDT_PACKAGE_ID;
const T = `${PKG}::usdc::USDC`;
const SCALE = 10 ** USDT_DECIMALS;
const u64 = (usdt: number) => BigInt(Math.floor(usdt * SCALE));
const TERM_EPOCHS = BigInt(30);

export { BNPL_POOL_ID as MARKET_POOL_ID };

/** Supply USDT liquidity to the pool (earns yield); receipt sent to sender. */
export function supplyTx(primaryCoinId: string, amountUsdt: number, sender: string): Transaction {
  const tx = new Transaction();
  const [part] = tx.splitCoins(tx.object(primaryCoinId), [tx.pure.u64(u64(amountUsdt))]);
  const receipt = tx.moveCall({ target: `${PKG}::lending_pool::supply`, typeArguments: [T], arguments: [tx.object(BNPL_POOL_ID), part] });
  tx.transferObjects([receipt], sender);
  return tx;
}

/** Over-collateralized borrow: lock `collateralUsdt` (>=150% of amount), receive `amountUsdt`. */
export function borrowCollateralizedTx(primaryCoinId: string, amountUsdt: number, collateralUsdt: number, sender: string): Transaction {
  const tx = new Transaction();
  const [collat] = tx.splitCoins(tx.object(primaryCoinId), [tx.pure.u64(u64(collateralUsdt))]);
  const borrowed = tx.moveCall({
    target: `${PKG}::market::borrow_collateralized`,
    typeArguments: [T, T],
    arguments: [tx.object(BNPL_POOL_ID), collat, tx.pure.u64(u64(amountUsdt)), tx.pure.u64(TERM_EPOCHS)],
  });
  tx.transferObjects([borrowed], sender);
  return tx;
}

export function repayCollateralizedTx(positionId: string, profileId: string, primaryCoinId: string, amountUsdt: number, sender: string): Transaction {
  const tx = new Transaction();
  const [pay] = tx.splitCoins(tx.object(primaryCoinId), [tx.pure.u64(u64(amountUsdt))]);
  const refund = tx.moveCall({
    target: `${PKG}::market::repay_collateralized`,
    typeArguments: [T, T],
    arguments: [tx.object(positionId), tx.object(BNPL_POOL_ID), tx.object(profileId), pay],
  });
  tx.transferObjects([refund], sender);
  return tx;
}

export function releaseCollateralTx(positionId: string, collateralLockId: string, sender: string): Transaction {
  const tx = new Transaction();
  const back = tx.moveCall({
    target: `${PKG}::market::release_collateral`,
    typeArguments: [T, T],
    arguments: [tx.object(positionId), tx.object(collateralLockId)],
  });
  tx.transferObjects([back], sender);
  return tx;
}

/** Under-collateralized borrow: no collateral, gated by TEE score + credit line. */
export function borrowUncollateralizedTx(profileId: string, amountUsdt: number, sender: string): Transaction {
  const tx = new Transaction();
  const borrowed = tx.moveCall({
    target: `${PKG}::market::borrow_uncollateralized`,
    typeArguments: [T],
    arguments: [tx.object(BNPL_POOL_ID), tx.object(profileId), tx.pure.u64(u64(amountUsdt)), tx.pure.u64(TERM_EPOCHS)],
  });
  tx.transferObjects([borrowed], sender);
  return tx;
}

export function repayUncollateralizedTx(positionId: string, profileId: string, primaryCoinId: string, amountUsdt: number, sender: string): Transaction {
  const tx = new Transaction();
  const [pay] = tx.splitCoins(tx.object(primaryCoinId), [tx.pure.u64(u64(amountUsdt))]);
  const refund = tx.moveCall({
    target: `${PKG}::market::repay_uncollateralized`,
    typeArguments: [T],
    arguments: [tx.object(positionId), tx.object(BNPL_POOL_ID), tx.object(profileId), pay],
  });
  tx.transferObjects([refund], sender);
  return tx;
}

/** True Buy-Now-Pay-Never: borrow UNSECURED against the TEE credit line (score
 * >= 600, no collateral) and settle the merchant escrow with the borrowed funds
 * in one PTB. The buyer puts up nothing — the pool fronts the merchant — and
 * owes the resulting UnsecuredPosition. Repay anytime via repay_uncollateralized. */
export function buyNowUnsecuredTx(p: { profileId: string; escrowId: string; amountUsdt: number; termEpochs?: number; orderId?: string }): Transaction {
  const tx = new Transaction();
  const borrowed = tx.moveCall({
    target: `${PKG}::market::borrow_uncollateralized`,
    typeArguments: [T],
    arguments: [tx.object(BNPL_POOL_ID), tx.object(p.profileId), tx.pure.u64(u64(p.amountUsdt)), tx.pure.u64(BigInt(p.termEpochs ?? 30))],
  });
  tx.moveCall({
    target: `${PKG}::merchant_escrow::settle_payment`,
    typeArguments: [T],
    arguments: [tx.object(p.escrowId), borrowed, tx.pure.vector("u8", Array.from(new TextEncoder().encode(p.orderId ?? "xorr-bnpl")))],
  });
  return tx;
}
