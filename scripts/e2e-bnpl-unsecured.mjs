// Verify TRUE unsecured BNPL: attest a TEE score, then in ONE PTB borrow
// unsecured (no collateral) and settle the merchant escrow with the borrowed
// funds. Asserts the buyer's USDC balance is UNCHANGED (only the loan is owed).
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

const PKG = "0xa105190b2218938815920010957f7adf856940452e304a63e195e132f14713b9"; // base (borrow_uncollat, settle, open_profile)
const CONF = "0x2f3761b5b891d14834269c48b732e68ea29824234117a43871f47848bd5e9982"; // verify_and_apply_score_attested_v2
const AO = "0xe8d3e3baf92ad7ab86d57ae55aedaf2be15fdff6000881f85aa0c489cc6753a8"; // AttestedOracle
const POOL = "0x2763f2907909d2aade0224bad144d4497df741d01c500d781c7abd2331cb9993";
const ESCROW = "0x44945bd13ef548fd3beb77c6d111bdfd88e549a3650a9caa7213d527d4e59c0c";
const ENCLAVE = "http://98.81.188.34:3000/process_data";
const T = `${PKG}::usdc::USDC`;
const M = 1_000_000;

const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });
const kp = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVATE_KEY);
const me = kp.toSuiAddress();
const link = (d) => `https://suiscan.xyz/testnet/tx/${d}`;
const hexToBytes = (h) => { const o = []; for (let i = 0; i < h.length; i += 2) o.push(parseInt(h.substr(i, 2), 16)); return o; };

async function usdcBal() {
  const c = await client.getCoins({ owner: me, coinType: T });
  let t = 0n; for (const x of c.data) t += BigInt(x.balance); return Number(t) / M;
}
async function run(label, build) {
  const tx = new Transaction(); build(tx);
  const res = await client.signAndExecuteTransaction({ signer: kp, transaction: tx, options: { showEffects: true, showObjectChanges: true } });
  await client.waitForTransaction({ digest: res.digest });
  if (res.effects?.status?.status !== "success") throw new Error(`${label} FAILED: ${JSON.stringify(res.effects?.status)}`);
  console.log(`✓ ${label}  ${link(res.digest)}`);
  return res;
}

(async () => {
  console.log("buyer:", me);
  const c1 = await run("open credit profile", (tx) => tx.moveCall({ target: `${PKG}::credit::open_profile` }));
  const profile = c1.objectChanges.find((o) => o.type === "created" && (o.objectType || "").includes("::credit::CreditProfile")).objectId;

  const score = 720, limit = 200 * M, nonce = Date.now();
  const r = await fetch(ENCLAVE, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload: { credit_score: { borrower: me, score, approved_limit: limit, nonce } } }) });
  const resp = await r.json();
  if (!resp.credit_signature) throw new Error("enclave: " + JSON.stringify(resp));
  await run("attest TEE score (v2)", (tx) => tx.moveCall({
    target: `${CONF}::confidential_credit::verify_and_apply_score_attested_v2`,
    arguments: [tx.object(AO), tx.object(profile), tx.object("0x6"), tx.pure.u64(score), tx.pure.u64(limit), tx.pure.u64(nonce), tx.pure.u64(BigInt(resp.timestamp_ms)), tx.pure.vector("u8", hexToBytes(resp.credit_signature))],
  }));

  const before = await usdcBal();
  const buy = await run("BNPL: borrow_uncollateralized 30 + settle merchant (1 PTB, no collateral)", (tx) => {
    const coin = tx.moveCall({ target: `${PKG}::market::borrow_uncollateralized`, typeArguments: [T], arguments: [tx.object(POOL), tx.object(profile), tx.pure.u64(30 * M), tx.pure.u64(30n)] });
    tx.moveCall({ target: `${PKG}::merchant_escrow::settle_payment`, typeArguments: [T], arguments: [tx.object(ESCROW), coin, tx.pure.vector("u8", Array.from(new TextEncoder().encode("demo")))] });
  });
  const pos = buy.objectChanges.find((o) => o.type === "created" && (o.objectType || "").includes("::market::UnsecuredPosition"))?.objectId;
  const after = await usdcBal();

  console.log("\n--- RESULT ---");
  console.log(`USDC balance: before ${before} -> after ${after}  (delta ${(after - before).toFixed(2)} — should be 0: NO collateral taken)`);
  console.log(`UnsecuredPosition (the debt you owe): ${pos}`);
  console.log(before === after
    ? "\n✅ TRUE BNPL VERIFIED — buyer paid nothing; the pool fronted the merchant; buyer owes the loan."
    : "\n⚠️ balance changed — investigate.");
})().catch((e) => { console.error("E2E ERROR:", e.message); process.exit(1); });
