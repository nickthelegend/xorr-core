// End-to-end CONFIDENTIAL CREDIT loop on testnet:
//   open profile -> TEE enclave signs a private credit score -> verify_and_apply_score
//   on-chain -> under-collateralized (unsecured) borrow unlocks.
// Run: SUI_PRIVATE_KEY=$(sui keytool export --key-identity xorr-deployer --json | grep -oE 'suiprivkey1[a-z0-9]+') node scripts/e2e-credit.mjs
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

const PKG = "0xa105190b2218938815920010957f7adf856940452e304a63e195e132f14713b9";
const ORACLE = "0xe4cf3ea3060adab8a42406a7344471eb76002e93c5bb14578e35c578223b7e88";
const POOL = "0x2763f2907909d2aade0224bad144d4497df741d01c500d781c7abd2331cb9993";
const ENCLAVE = "http://98.81.188.34:3000/process_data";
const T = `${PKG}::usdc::USDC`;
const M = 1_000_000;

const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });
const kp = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVATE_KEY);
const me = kp.toSuiAddress();
const link = (d) => `https://suiscan.xyz/testnet/tx/${d}`;

async function run(label, build) {
  const tx = new Transaction();
  build(tx);
  const res = await client.signAndExecuteTransaction({ signer: kp, transaction: tx, options: { showEffects: true, showObjectChanges: true } });
  await client.waitForTransaction({ digest: res.digest });
  if (res.effects?.status?.status !== "success") throw new Error(`${label} FAILED: ${JSON.stringify(res.effects?.status)}`);
  console.log(`✓ ${label}  ${link(res.digest)}`);
  return res;
}

(async () => {
  console.log("borrower:", me);
  // 1. open a credit profile
  const c1 = await run("open credit profile", (tx) => { tx.moveCall({ target: `${PKG}::credit::open_profile` }); });
  const profile = c1.objectChanges.find((o) => o.type === "created" && (o.objectType || "").includes("::credit::CreditProfile")).objectId;
  console.log("profile:", profile);

  // 2. ask the TEE enclave to sign a private credit score
  const score = 750, approved_limit = 200 * M, nonce = 1;
  const r = await fetch(ENCLAVE, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload: { credit_score: { borrower: me, score, approved_limit, nonce } } }) });
  const resp = await r.json();
  if (!resp.credit_signature) throw new Error("enclave did not return a signature: " + JSON.stringify(resp));
  console.log(`✓ TEE signed score=${score} limit=${approved_limit / M} (pk ${resp.enclave_pubkey.slice(0, 12)}…, ts ${resp.timestamp_ms})`);
  const sig = []; for (let i = 0; i < resp.credit_signature.length; i += 2) sig.push(parseInt(resp.credit_signature.substr(i, 2), 16));

  // 3. verify the TEE signature on-chain and apply the score
  await run("verify_and_apply_score (TEE)", (tx) => {
    tx.moveCall({
      target: `${PKG}::confidential_credit::verify_and_apply_score`,
      arguments: [tx.object(ORACLE), tx.object(profile), tx.pure.u64(score), tx.pure.u64(approved_limit), tx.pure.u64(nonce), tx.pure.u64(BigInt(resp.timestamp_ms)), tx.pure.vector("u8", sig)],
    });
  });
  const o = await client.getObject({ id: profile, options: { showContent: true } });
  const f = o.data.content.fields;
  console.log(`profile after attestation: score=${f.score} credit_limit=${Number(f.credit_limit) / M} USDC`);

  // 4. under-collateralized borrow now unlocks (score >= 600, amount <= line)
  await run("borrow_uncollateralized 50 USDC (no collateral)", (tx) => {
    const coin = tx.moveCall({ target: `${PKG}::market::borrow_uncollateralized`, typeArguments: [T], arguments: [tx.object(POOL), tx.object(profile), tx.pure.u64(50 * M), tx.pure.u64(BigInt(30))] });
    tx.transferObjects([coin], me);
  });
  console.log("\n✅ CONFIDENTIAL CREDIT E2E PASS — TEE-signed private score verified on-chain, unsecured loan disbursed.");
})().catch((e) => { console.error("E2E ERROR:", e.message); process.exit(1); });
