// Prove the attested path end-to-end: open profile -> TEE signs a score ->
// verify_and_apply_score_attested checks it against the ATTESTATION-BOUND key
// (registered via on-chain Nitro attestation) and applies it.
//   SUI_PRIVATE_KEY=$(sui keytool export --key-identity xorr-deployer --json | grep -oE 'suiprivkey1[a-z0-9]+') node scripts/e2e-attested-credit.mjs
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

const PKG = "0xd74650b76c2a22ad331b7c55b96d72449145ecd6ff8a3b278047c7a76ed577ac"; // upgraded
const AO = "0xe8d3e3baf92ad7ab86d57ae55aedaf2be15fdff6000881f85aa0c489cc6753a8"; // AttestedOracle
const ENCLAVE = "http://98.81.188.34:3000/process_data";
const M = 1_000_000;
const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });
const kp = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVATE_KEY);
const me = kp.toSuiAddress();
const link = (d) => `https://suiscan.xyz/testnet/tx/${d}`;
const hexToBytes = (h) => { const o = []; for (let i = 0; i < h.length; i += 2) o.push(parseInt(h.substr(i, 2), 16)); return o; };

async function run(label, build) {
  const tx = new Transaction(); build(tx);
  const res = await client.signAndExecuteTransaction({ signer: kp, transaction: tx, options: { showEffects: true, showObjectChanges: true } });
  await client.waitForTransaction({ digest: res.digest });
  if (res.effects?.status?.status !== "success") throw new Error(`${label} FAILED: ${JSON.stringify(res.effects?.status)}`);
  console.log(`✓ ${label}  ${link(res.digest)}`); return res;
}

(async () => {
  const c1 = await run("open credit profile", (tx) => tx.moveCall({ target: `${PKG}::credit::open_profile` }));
  const profile = c1.objectChanges.find((o) => o.type === "created" && (o.objectType || "").endsWith("::credit::CreditProfile")).objectId;

  const score = 780, approved_limit = 200 * M, nonce = Date.now();
  const r = await fetch(ENCLAVE, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload: { credit_score: { borrower: me, score, approved_limit, nonce } } }) });
  const resp = await r.json();
  if (!resp.credit_signature) throw new Error("enclave returned no signature: " + JSON.stringify(resp));
  console.log(`✓ TEE signed score=${score} (key 0x${resp.enclave_pubkey.slice(0, 12)}…)`);

  await run("verify_and_apply_score_attested (against attestation-bound key)", (tx) => {
    tx.moveCall({
      target: `${PKG}::confidential_credit::verify_and_apply_score_attested`,
      arguments: [tx.object(AO), tx.object(profile), tx.pure.u64(score), tx.pure.u64(approved_limit), tx.pure.u64(nonce), tx.pure.u64(BigInt(resp.timestamp_ms)), tx.pure.vector("u8", hexToBytes(resp.credit_signature))],
    });
  });
  const o = await client.getObject({ id: profile, options: { showContent: true } });
  const f = o.data.content.fields;
  console.log(`\nprofile: score=${f.score}, credit_limit=${Number(f.credit_limit) / M} USDC`);
  console.log("✅ TEE-signed score verified against the on-chain ATTESTED enclave key and applied.");
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
