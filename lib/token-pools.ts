// Multi-token lending markets: USDC + DeepBook tokens (DUSDC, DEEP). Each is a
// generic LendingPool<T>. DUSDC/DEEP supply is earmarked for the DeepBook
// market-making strategy (yield accrues to suppliers via the pool).
import { Transaction } from "@mysten/sui/transactions";
import { USDT_PACKAGE_ID } from "./sui";
import { BNPL_POOL_ID } from "./bnpl";

const PKG = USDT_PACKAGE_ID;

export type TokenPool = {
  symbol: string;
  coinType: string;
  poolId: string;
  decimals: number;
  strategy?: "DeepBook";
  note: string;
};

export const TOKEN_POOLS: TokenPool[] = [
  {
    symbol: "USDC",
    coinType: `${PKG}::usdc::USDC`,
    poolId: BNPL_POOL_ID,
    decimals: 6,
    note: "XORR core pool — backs BNPL credit. Earns borrower interest.",
  },
  {
    symbol: "DUSDC",
    coinType: "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC",
    poolId: "0xa68c5753188a6ca5f4ae9193ec74830737ebdcb1130dec8fd4a1c4316a49d73a",
    decimals: 6,
    strategy: "DeepBook",
    note: "DeepBook USDC — supply is routed to the DeepBook market-making strategy to earn yield.",
  },
  {
    symbol: "DEEP",
    coinType: "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP",
    poolId: "0x126229edba272680ce5234ad5454327600e66526e563432c2e74a95ef967f2e2",
    decimals: 6,
    strategy: "DeepBook",
    note: "DEEP — supplied for DeepBook fee yield.",
  },
];

const raw = (amount: number, decimals: number) => BigInt(Math.floor(amount * 10 ** decimals));

/** Supply (lend) `amount` of the pool's token; supply receipt goes to sender. */
export function supplyToPoolTx(pool: TokenPool, primaryCoinId: string, amount: number, sender: string): Transaction {
  const tx = new Transaction();
  const [part] = tx.splitCoins(tx.object(primaryCoinId), [tx.pure.u64(raw(amount, pool.decimals))]);
  const receipt = tx.moveCall({
    target: `${PKG}::lending_pool::supply`,
    typeArguments: [pool.coinType],
    arguments: [tx.object(pool.poolId), part],
  });
  tx.transferObjects([receipt], sender);
  return tx;
}

/** Harvest: inject `amount` of the pool's token as realized strategy yield
 * (e.g. DeepBook market-making fees). Lifts every supplier's share value. */
export function harvestYieldTx(pool: TokenPool, primaryCoinId: string, amount: number): Transaction {
  const tx = new Transaction();
  const [part] = tx.splitCoins(tx.object(primaryCoinId), [tx.pure.u64(raw(amount, pool.decimals))]);
  tx.moveCall({
    target: `${PKG}::lending_pool::inject_yield`,
    typeArguments: [pool.coinType],
    arguments: [tx.object(pool.poolId), part],
  });
  return tx;
}

/** Redeem a supply receipt for the current value of its shares (principal + yield). */
export function withdrawFromPoolTx(pool: TokenPool, receiptId: string, sender: string): Transaction {
  const tx = new Transaction();
  const out = tx.moveCall({
    target: `${PKG}::lending_pool::withdraw`,
    typeArguments: [pool.coinType],
    arguments: [tx.object(pool.poolId), tx.object(receiptId)],
  });
  tx.transferObjects([out], sender);
  return tx;
}

/** Over-collateralized borrow of `amount`, locking `collateral` (>=150%) of the same token. */
export function borrowFromPoolTx(pool: TokenPool, primaryCoinId: string, amount: number, collateral: number, sender: string): Transaction {
  const tx = new Transaction();
  const [col] = tx.splitCoins(tx.object(primaryCoinId), [tx.pure.u64(raw(collateral, pool.decimals))]);
  const borrowed = tx.moveCall({
    target: `${PKG}::market::borrow_collateralized`,
    typeArguments: [pool.coinType, pool.coinType],
    arguments: [tx.object(pool.poolId), col, tx.pure.u64(raw(amount, pool.decimals)), tx.pure.u64(30n)],
  });
  tx.transferObjects([borrowed], sender);
  return tx;
}

/** Repay a collateralized position (principal + interest); overpayment refunded. */
export function repayCollateralizedToPoolTx(pool: TokenPool, positionId: string, profileId: string, primaryCoinId: string, amount: number, sender: string): Transaction {
  const tx = new Transaction();
  const [pay] = tx.splitCoins(tx.object(primaryCoinId), [tx.pure.u64(raw(amount, pool.decimals))]);
  const refund = tx.moveCall({
    target: `${PKG}::market::repay_collateralized`,
    typeArguments: [pool.coinType, pool.coinType],
    arguments: [tx.object(positionId), tx.object(pool.poolId), tx.object(profileId), pay],
  });
  tx.transferObjects([refund], sender);
  return tx;
}

export function poolForType(objectType: string): TokenPool {
  return TOKEN_POOLS.find((p) => objectType.includes(p.coinType)) ?? TOKEN_POOLS[0];
}
