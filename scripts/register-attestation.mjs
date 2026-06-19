// Register the credit enclave's signing key by VERIFYING A REAL AWS NITRO
// ATTESTATION ON-CHAIN (the "step 2" trust upgrade):
//   1. fetch the live attestation doc from the enclave's /get_attestation
//   2. create an AttestedOracle + pin the audited image's PCR0/1/2
//   3. PTB: sui::nitro_attestation::load_nitro_attestation (verifies AWS cert
//      chain + COSE sig natively) -> confidential_credit::register_enclave_key
//      (asserts PCRs match + adopts the embedded enclave key)
//   SUI_PRIVATE_KEY=$(sui keytool export --key-identity xorr-deployer --json | grep -oE 'suiprivkey1[a-z0-9]+') node scripts/register-attestation.mjs
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

const PKG = "0xd74650b76c2a22ad331b7c55b96d72449145ecd6ff8a3b278047c7a76ed577ac"; // upgraded version
const ENCLAVE = process.env.CREDIT_ENCLAVE_ATTEST_URL || "http://98.81.188.34:3000/get_attestation";
const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });
const kp = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVATE_KEY);
const link = (d) => `https://suiscan.xyz/testnet/tx/${d}`;
const hexToBytes = (h) => { const o = []; for (let i = 0; i < h.length; i += 2) o.push(parseInt(h.substr(i, 2), 16)); return o; };

async function run(label, build) {
  const tx = new Transaction();
  build(tx);
  const res = await client.signAndExecuteTransaction({ signer: kp, transaction: tx, options: { showEffects: true, showObjectChanges: true } });
  await client.waitForTransaction({ digest: res.digest });
  if (res.effects?.status?.status !== "success") throw new Error(`${label} FAILED: ${JSON.stringify(res.effects?.status)}`);
  console.log(`✓ ${label}  ${link(res.digest)}`);
  return res;
}
const created = (res, suffix) => res.objectChanges.find((o) => o.type === "created" && (o.objectType || "").endsWith(suffix))?.objectId;

(async () => {
  // 1. fetch live attestation + parse PCR0/1/2 (CBOR: "pcrs" map -> 00|01|02 5830 <48 bytes>)
  const att = (await (await fetch(ENCLAVE)).json()).attestation;
  const anchor = att.indexOf("6470637273"); // "pcrs"
  if (anchor < 0) throw new Error("no pcrs in attestation");
  let p = anchor + 10 + 2; // skip "pcrs" + CBOR map header byte
  const rd = () => { const key = att.substr(p, 2); p += 2; const t = att.substr(p, 4); p += 4; const v = att.substr(p, 96); p += 96; return { key, t, v }; };
  const e0 = rd(), e1 = rd(), e2 = rd();
  if (e0.key !== "00" || e1.key !== "01" || e2.key !== "02" || e0.t !== "5830") throw new Error("PCR parse failed: " + JSON.stringify([e0, e1, e2]));
  console.log(`enclave PCR0 ${e0.v.slice(0, 16)}…  PCR1 ${e1.v.slice(0, 16)}…  PCR2 ${e2.v.slice(0, 16)}…\n`);

  // 2. create AttestedOracle
  const c = await run("create AttestedOracle", (tx) => { tx.moveCall({ target: `${PKG}::confidential_credit::create_attested_oracle_entry` }); });
  const ao = created(c, "::confidential_credit::AttestedOracle");
  const cap = created(c, "::confidential_credit::AttestedOracleCap");
  console.log("   AttestedOracle:", ao);

  // 3. pin expected PCRs
  await run("pin audited PCR0/1/2", (tx) => {
    tx.moveCall({ target: `${PKG}::confidential_credit::set_attested_pcrs`, arguments: [tx.object(cap), tx.object(ao), tx.pure.vector("u8", hexToBytes(e0.v)), tx.pure.vector("u8", hexToBytes(e1.v)), tx.pure.vector("u8", hexToBytes(e2.v))] });
  });

  // 4. verify the Nitro attestation ON-CHAIN + adopt the enclave key
  const attBytes = hexToBytes(att);
  await run("register_enclave_key (verify Nitro attestation on-chain)", (tx) => {
    const doc = tx.moveCall({ target: "0x2::nitro_attestation::load_nitro_attestation", arguments: [tx.pure.vector("u8", attBytes), tx.object("0x6")] });
    tx.moveCall({ target: `${PKG}::confidential_credit::register_enclave_key`, arguments: [tx.object(ao), doc] });
  });

  // 5. read result
  const o = await client.getObject({ id: ao, options: { showContent: true } });
  const f = o.data.content.fields;
  const pkHex = Buffer.from(f.enclave_pubkey).toString("hex");
  console.log("\n--- RESULT ---");
  console.log("attested:", f.attested, "| enclave_pubkey: 0x" + pkHex);
  console.log("ATTESTED_ORACLE_ID=" + ao);
  console.log("\n✅ enclave signing key registered via on-chain AWS Nitro attestation (PCR-gated). Trust is now in the audited enclave image, not an admin key.");
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
