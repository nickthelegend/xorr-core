// Prove "repay a BNPL loan from your LP position" in ONE transaction:
//   supply -> open_purchase (loan) -> [withdraw SupplyReceipt -> repay loan] PTB.
// Run: SUI_PRIVATE_KEY=$(sui keytool export --key-identity xorr-deployer --json | grep -oE 'suiprivkey1[a-z0-9]+') node scripts/e2e-repay-from-lp.mjs
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
const created = (res, frag) => res.objectChanges.find((o) => o.type === "created" && (o.objectType || "").includes(frag))?.objectId;
async function primary() { const c = await client.getCoins({ owner: me, coinType: T }); let b = null, m = 0n; for (const x of c.data) { const v = BigInt(x.balance); if (v > m) { m = v; b = x.coinObjectId; } } return b; }
async function run(label, build) {
  const tx = new Transaction(); build(tx);
  const res = await client.signAndExecuteTransaction({ signer: kp, transaction: tx, options: { showEffects: true, showObjectChanges: true } });
  await client.waitForTransaction({ digest: res.digest });
  if (res.effects?.status?.status !== "success") throw new Error(`${label} FAILED: ${JSON.stringify(res.effects?.status)}`);
  console.log(`✓ ${label}  ${link(res.digest)}`); return res;
}

(async () => {
  await run("faucet 300 USDC", (tx) => tx.moveCall({ target: `${PKG}::usdc::faucet_to_sender`, arguments: [tx.object(FAUCET), tx.pure.u64(u(300))] }));
  const cp = await run("create pool (10%)", (tx) => tx.moveCall({ target: `${PKG}::lending_pool::create_pool_entry`, typeArguments: [T], arguments: [tx.pure.u64(1000n)] }));
  const pool = created(cp, "::lending_pool::LendingPool");
  const pp = await run("open profile", (tx) => tx.moveCall({ target: `${PKG}::credit::open_profile` }));
  const profile = created(pp, "::credit::CreditProfile");

  let pc = await primary();
  const sup = await run("supply 100 USDC (LP position)", (tx) => {
    const [d] = tx.splitCoins(tx.object(pc), [tx.pure.u64(u(100))]);
    const r = tx.moveCall({ target: `${PKG}::lending_pool::supply`, typeArguments: [T], arguments: [tx.object(pool), d] });
    tx.transferObjects([r], me);
  });
  const receipt = created(sup, "::lending_pool::SupplyReceipt");

  pc = await primary();
  const pb = await run("BNPL buy 30 (borrow from pool, owe loan)", (tx) => {
    const [col] = tx.splitCoins(tx.object(pc), [tx.pure.u64(u(30))]);
    tx.moveCall({ target: `${PKG}::bnpl::open_purchase`, typeArguments: [T, T], arguments: [tx.object(pool), tx.object(profile), tx.object(ESCROW), col, tx.pure.u64(u(30)), tx.pure.u64(30n), tx.pure.vector("u8", Array.from(new TextEncoder().encode("lp-repay-demo")))] });
  });
  const loan = created(pb, "::bnpl::Loan");
  const before = await readLoanOutstanding(loan);
  console.log(`   loan outstanding before: ${before} USDC`);

  const LATEST = "0xffbc99cca6437bcd05e23e8bc290b968b83074ab36da6ad1938b5b96517b8310"; // upgraded pkg with withdraw_amount
  await run("REPAY FROM LP (partial withdraw -> repay loan, one PTB)", (tx) => {
    const coin = tx.moveCall({ target: `${LATEST}::lending_pool::withdraw_amount`, typeArguments: [T], arguments: [tx.object(pool), tx.object(receipt), tx.pure.u64(u(before))] });
    const refund = tx.moveCall({ target: `${PKG}::bnpl::repay`, typeArguments: [T, T], arguments: [tx.object(loan), tx.object(pool), tx.object(profile), coin] });
    tx.transferObjects([refund], me);
  });
  const after = await readLoanOutstanding(loan);
  console.log(`   loan outstanding after:  ${after} USDC`);
  if (after !== 0) throw new Error("loan not fully repaid");
  console.log("\n✅ REPAY-FROM-LP E2E PASS — LP position withdrawn and routed into the loan in one tx; loan repaid, yield returned.");
})().catch((e) => { console.error("E2E ERROR:", e.message); process.exit(1); });

async function readLoanOutstanding(id) {
  const o = await client.getObject({ id, options: { showContent: true } });
  return Number(o.data.content.fields.outstanding) / M;
}
