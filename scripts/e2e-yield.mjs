// FULL end-to-end yield + repayment loop on testnet, all on our usdc::USDC coin:
//   faucet -> create pool -> LEND (supply) -> BNPL borrow -> repay -> release
//   -> inject external yield -> BNPL borrow -> auto_repay_from_yield -> withdraw.
// The lender supplies 200 and withdraws MORE (interest + injected yield) = proof
// the pool earns. Run:
//   SUI_PRIVATE_KEY=$(sui keytool export --key-identity xorr-deployer --json | grep -oE 'suiprivkey1[a-z0-9]+') node scripts/e2e-yield.mjs
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

const PKG = "0xa105190b2218938815920010957f7adf856940452e304a63e195e132f14713b9";
const FAUCET = "0xf532e1e7f8c83d2be47a68efc6b37bde7f436b76682885e9b3dd50380e6a1d6f";
const ESCROW = "0x44945bd13ef548fd3beb77c6d111bdfd88e549a3650a9caa7213d527d4e59c0c";
const T = `${PKG}::usdc::USDC`;
const M = 1_000_000;

const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });
const kp = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVATE_KEY);
const me = kp.toSuiAddress();
const link = (d) => `https://suiscan.xyz/testnet/tx/${d}`;
const u = (n) => BigInt(Math.round(n * M));

async function run(label, build) {
  const tx = new Transaction();
  build(tx);
  const res = await client.signAndExecuteTransaction({
    signer: kp, transaction: tx,
    options: { showEffects: true, showObjectChanges: true, showBalanceChanges: true },
  });
  await client.waitForTransaction({ digest: res.digest });
  if (res.effects?.status?.status !== "success") throw new Error(`${label} FAILED: ${JSON.stringify(res.effects?.status)}`);
  const ch = (res.balanceChanges || []).find((b) => b.coinType === T && b.owner?.AddressOwner === me);
  const d = ch ? Number(ch.amount) / M : 0;
  console.log(`✓ ${label}${d ? `  [USDC ${d > 0 ? "+" : ""}${d}]` : ""}  ${link(res.digest)}`);
  return res;
}
const created = (res, frag) => res.objectChanges.find((o) => o.type === "created" && (o.objectType || "").includes(frag))?.objectId;
async function primary() {
  const c = await client.getCoins({ owner: me, coinType: T });
  let best = null, bal = 0n;
  for (const x of c.data) { const b = BigInt(x.balance); if (b > bal) { bal = b; best = x.coinObjectId; } }
  return best;
}

(async () => {
  console.log("lender/borrower:", me, "\n");

  await run("faucet: mint 500 USDC", (tx) => {
    tx.moveCall({ target: `${PKG}::usdc::faucet_to_sender`, arguments: [tx.object(FAUCET), tx.pure.u64(u(500))] });
  });

  const cp = await run("create fresh lending pool (10% term interest)", (tx) => {
    tx.moveCall({ target: `${PKG}::lending_pool::create_pool_entry`, typeArguments: [T], arguments: [tx.pure.u64(1000n)] });
  });
  const pool = created(cp, "::lending_pool::LendingPool");
  console.log("   pool:", pool);

  const pp = await run("open credit profile", (tx) => tx.moveCall({ target: `${PKG}::credit::open_profile` }));
  const profile = created(pp, "::credit::CreditProfile");
  console.log("   profile:", profile);

  let pc = await primary();
  const sup = await run("LEND: supply 200 USDC", (tx) => {
    const [d] = tx.splitCoins(tx.object(pc), [tx.pure.u64(u(200))]);
    const r = tx.moveCall({ target: `${PKG}::lending_pool::supply`, typeArguments: [T], arguments: [tx.object(pool), d] });
    tx.transferObjects([r], me);
  });
  const receipt = created(sup, "::lending_pool::SupplyReceipt");
  console.log("   supply receipt:", receipt);

  pc = await primary();
  const pa = await run("BNPL: open purchase A (lock 60, borrow 50, pay merchant)", (tx) => {
    const [col] = tx.splitCoins(tx.object(pc), [tx.pure.u64(u(60))]);
    tx.moveCall({ target: `${PKG}::bnpl::open_purchase`, typeArguments: [T, T], arguments: [tx.object(pool), tx.object(profile), tx.object(ESCROW), col, tx.pure.u64(u(50)), tx.pure.u64(30n), tx.pure.vector("u8", Array.from(new TextEncoder().encode("yield-demo-A")))] });
  });
  const loanA = created(pa, "::bnpl::Loan");
  const lockA = created(pa, "::collateral::CollateralLock");

  pc = await primary();
  await run("REPAY A: 55 USDC (50 principal + 5 interest -> suppliers)", (tx) => {
    const [pay] = tx.splitCoins(tx.object(pc), [tx.pure.u64(u(55))]);
    const refund = tx.moveCall({ target: `${PKG}::bnpl::repay`, typeArguments: [T, T], arguments: [tx.object(loanA), tx.object(pool), tx.object(profile), pay] });
    tx.transferObjects([refund], me);
  });
  await run("RELEASE A: reclaim 60 collateral", (tx) => {
    const col = tx.moveCall({ target: `${PKG}::bnpl::release_collateral`, typeArguments: [T, T], arguments: [tx.object(loanA), tx.object(lockA)] });
    tx.transferObjects([col], me);
  });

  pc = await primary();
  await run("YIELD: inject 20 USDC external yield into the pool", (tx) => {
    const [y] = tx.splitCoins(tx.object(pc), [tx.pure.u64(u(20))]);
    tx.moveCall({ target: `${PKG}::lending_pool::inject_yield`, typeArguments: [T], arguments: [tx.object(pool), y] });
  });

  pc = await primary();
  const pb = await run("BNPL: open purchase B (lock 30, borrow 25)", (tx) => {
    const [col] = tx.splitCoins(tx.object(pc), [tx.pure.u64(u(30))]);
    tx.moveCall({ target: `${PKG}::bnpl::open_purchase`, typeArguments: [T, T], arguments: [tx.object(pool), tx.object(profile), tx.object(ESCROW), col, tx.pure.u64(u(25)), tx.pure.u64(30n), tx.pure.vector("u8", Array.from(new TextEncoder().encode("pay-never-B")))] });
  });
  const loanB = created(pb, "::bnpl::Loan");
  const lockB = created(pb, "::collateral::CollateralLock");

  pc = await primary();
  await run("PAY-NEVER: auto_repay_from_yield 27.5 USDC -> loan B", (tx) => {
    const [y] = tx.splitCoins(tx.object(pc), [tx.pure.u64(u(27.5))]);
    const leftover = tx.moveCall({ target: `${PKG}::bnpl::auto_repay_from_yield`, typeArguments: [T, T], arguments: [tx.object(loanB), tx.object(pool), tx.object(profile), y] });
    tx.transferObjects([leftover], me);
  });
  await run("RELEASE B: reclaim 30 collateral", (tx) => {
    const col = tx.moveCall({ target: `${PKG}::bnpl::release_collateral`, typeArguments: [T, T], arguments: [tx.object(loanB), tx.object(lockB)] });
    tx.transferObjects([col], me);
  });

  const wd = await run("WITHDRAW: redeem supply receipt (principal + earned yield)", (tx) => {
    const out = tx.moveCall({ target: `${PKG}::lending_pool::withdraw`, typeArguments: [T], arguments: [tx.object(pool), tx.object(receipt)] });
    tx.transferObjects([out], me);
  });
  const wch = (wd.balanceChanges || []).find((b) => b.coinType === T && b.owner?.AddressOwner === me);
  const withdrawn = wch ? Number(wch.amount) / M : 0;

  const prof = await client.getObject({ id: profile, options: { showContent: true } });
  const cf = prof.data.content.fields;
  console.log("\n--- RESULT ---------------------------------------------------");
  console.log(`LENDER:  supplied 200 USDC  ->  withdrew ${withdrawn} USDC   (yield +${(withdrawn - 200).toFixed(2)} USDC = 5 interest + 20 injected + 2.5 interest)`);
  console.log(`LOANS:   A repaid directly | B repaid via auto_repay_from_yield (Pay-Never) | both collateral released`);
  console.log(`CREDIT:  limit grew to ${Number(cf.credit_limit) / M} USDC, repaid_total=${Number(cf.repaid_total) / M} USDC, score=${cf.score}`);
  console.log("\n✅ FULL E2E PASS — lend, BNPL borrow, repay, external yield, auto-repay-from-yield, withdraw-with-yield.");
})().catch((e) => { console.error("E2E ERROR:", e.message); process.exit(1); });
