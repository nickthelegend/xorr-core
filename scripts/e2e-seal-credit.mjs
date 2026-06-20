// FULL confidential-credit-via-Seal loop, end to end, NO mocking:
//   1. client Seal-encrypts private financial inputs to the credit package
//   2. the "enclave" (this key, bound on-chain) fetches the IBE key ONLY by
//      passing confidential_credit::seal_approve, and DECRYPTS the inputs
//   3. it computes the score from the decrypted inputs and signs an attestation
//   4. verify_and_apply_score_attested_v2 applies it on-chain
// The deployer key stands in for the Nitro TEE (bound via the dev setter); the
// Seal crypto + on-chain policy + scoring + signature verification are all real.
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { toHex } from "@mysten/sui/utils";
import { SealClient, SessionKey } from "@mysten/seal";

const ORIGIN = "0xa105190b2218938815920010957f7adf856940452e304a63e195e132f14713b9"; // Seal identity namespace + credit::open_profile
const LATEST = "0x939bd445c7eae99c9a55d3afe2cb0a7fc4beb9870b9ceb6c7db4d56b043a286d"; // seal_approve / *_attested_v2 / dev setter
const KS = [{ objectId: "0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98", aggregatorUrl: "https://seal-aggregator-testnet.mystenlabs.com", weight: 1 }];
const M = 1_000_000;

const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });
const kp = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVATE_KEY);
const me = kp.toSuiAddress();
const seal = new SealClient({ suiClient: client, serverConfigs: KS, verifyKeyServers: false });
const link = (d) => `https://suiscan.xyz/testnet/tx/${d}`;

const CreditInputs = bcs.struct("CreditInputs", {
  monthly_income_usd: bcs.u64(), monthly_debt_usd: bcs.u64(),
  on_time_payments: bcs.u32(), missed_payments: bcs.u32(),
  credit_age_months: bcs.u32(), utilization_bps: bcs.u32(),
});
const CreditAttestation = bcs.struct("CreditAttestation", {
  intent: bcs.u8(), timestamp_ms: bcs.u64(), borrower: bcs.Address,
  score: bcs.u64(), approved_limit: bcs.u64(), nonce: bcs.u64(),
});

const created = (res, frag) => res.objectChanges.find((o) => o.type === "created" && (o.objectType || "").includes(frag))?.objectId;
async function run(label, build) {
  const tx = new Transaction(); build(tx);
  const res = await client.signAndExecuteTransaction({ signer: kp, transaction: tx, options: { showEffects: true, showObjectChanges: true } });
  await client.waitForTransaction({ digest: res.digest });
  if (res.effects?.status?.status !== "success") throw new Error(`${label} FAILED: ${JSON.stringify(res.effects?.status)}`);
  console.log(`✓ ${label}  ${link(res.digest)}`);
  return res;
}
function computeScore(i) {
  const income = Number(i.monthly_income_usd), debt = Number(i.monthly_debt_usd);
  const dti = income === 0 ? 10000 : Math.min(10000, Math.floor((debt * 10000) / income));
  const total = i.on_time_payments + i.missed_payments;
  const payRatio = total === 0 ? 8000 : Math.floor((i.on_time_payments * 10000) / total);
  let s = 300;
  s += Math.floor((payRatio * 350) / 10000);
  s += Math.floor(((10000 - dti) * 150) / 10000);
  s += Math.floor(((10000 - Math.min(10000, i.utilization_bps)) * 100) / 10000);
  s += Math.floor((Math.min(120, i.credit_age_months) * 50) / 120);
  s -= i.missed_payments * 20;
  return Math.max(300, Math.min(850, s));
}

(async () => {
  console.log("enclave/borrower:", me, "\n");

  // 1. Create an AttestedOracle and bind THIS key as the enclave (dev path).
  const pk = Array.from(kp.getPublicKey().toRawBytes());
  const c = await run("create AttestedOracle", (tx) => tx.moveCall({ target: `${LATEST}::confidential_credit::create_attested_oracle_entry` }));
  const oracle = created(c, "::confidential_credit::AttestedOracle");
  const cap = created(c, "::confidential_credit::AttestedOracleCap");
  await run("bind enclave key (dev)", (tx) => tx.moveCall({ target: `${LATEST}::confidential_credit::set_attested_pubkey_dev`, arguments: [tx.object(cap), tx.object(oracle), tx.pure.vector("u8", pk)] }));

  // 2. CLIENT: Seal-encrypt the private financial inputs.
  const inputs = { monthly_income_usd: 8000n, monthly_debt_usd: 1500n, on_time_payments: 36, missed_payments: 1, credit_age_months: 60, utilization_bps: 2200 };
  const plaintext = CreditInputs.serialize(inputs).toBytes();
  const id = crypto.getRandomValues(new Uint8Array(32));
  const { encryptedObject } = await seal.encrypt({ threshold: 1, packageId: ORIGIN, id: toHex(id), data: plaintext });
  console.log(`✓ client Seal-encrypted inputs -> ${encryptedObject.length} bytes ciphertext (income/debt/history never leave plaintext)`);

  // 3. ENCLAVE: fetch the IBE key ONLY by passing seal_approve, then DECRYPT.
  const sessionKey = await SessionKey.create({ address: me, packageId: ORIGIN, ttlMin: 10, signer: kp, suiClient: client });
  const sealTx = new Transaction();
  sealTx.moveCall({ target: `${LATEST}::confidential_credit::seal_approve`, arguments: [sealTx.pure.vector("u8", Array.from(id)), sealTx.object(oracle)] });
  const txBytes = await sealTx.build({ client, onlyTransactionKind: true });
  const decrypted = await seal.decrypt({ data: encryptedObject, sessionKey, txBytes });
  const dec = CreditInputs.parse(decrypted);
  console.log("✓ enclave decrypted (gated by on-chain seal_approve):", JSON.stringify(dec));

  // 4. ENCLAVE: score from decrypted inputs + sign the attestation.
  const score = computeScore(dec);
  const limit = 200 * M, ts = Date.now(), nonce = ts;
  const msg = CreditAttestation.serialize({ intent: 1, timestamp_ms: ts, borrower: me, score, approved_limit: limit, nonce }).toBytes();
  const sig = await kp.sign(msg);
  console.log(`✓ enclave computed score=${score} from the decrypted private inputs, and signed the attestation`);

  // 5. Apply on-chain (verifies the sig against the oracle's attested key).
  const p = await run("open credit profile", (tx) => tx.moveCall({ target: `${ORIGIN}::credit::open_profile` }));
  const profile = created(p, "::credit::CreditProfile");
  await run("verify_and_apply_score_attested_v2", (tx) => tx.moveCall({ target: `${LATEST}::confidential_credit::verify_and_apply_score_attested_v2`, arguments: [tx.object(oracle), tx.object(profile), tx.object("0x6"), tx.pure.u64(score), tx.pure.u64(limit), tx.pure.u64(nonce), tx.pure.u64(ts), tx.pure.vector("u8", Array.from(sig))] }));

  const o = await client.getObject({ id: profile, options: { showContent: true } });
  const f = o.data.content.fields;
  console.log(`\n✅ FULL SEAL CONFIDENTIAL-CREDIT E2E PASS`);
  console.log(`   encrypted client-side -> decrypted ONLY via on-chain seal_approve -> scored ${score} from private inputs -> applied.`);
  console.log(`   on-chain profile: score=${f.score}, credit_limit=${Number(f.credit_limit) / M} USDC`);
})().catch((e) => { console.error("E2E ERROR:", e.message); process.exit(1); });
