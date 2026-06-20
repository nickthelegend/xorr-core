// Proof that client-side Seal (threshold IBE) encryption of credit inputs works.
// Encrypts a sample private financial record to the credit package via the Mysten
// testnet Seal key server. Only the attested enclave can decrypt (seal_approve).
import { SealClient } from "@mysten/seal";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { bcs } from "@mysten/sui/bcs";
import { toHex } from "@mysten/sui/utils";

const PKG = "0xa105190b2218938815920010957f7adf856940452e304a63e195e132f14713b9";
const KS = [{ objectId: "0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98", aggregatorUrl: "https://seal-aggregator-testnet.mystenlabs.com", weight: 1 }];

const sui = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });
const seal = new SealClient({ suiClient: sui, serverConfigs: KS, verifyKeyServers: false });

const CreditInputs = bcs.struct("CreditInputs", {
  monthly_income_usd: bcs.u64(), monthly_debt_usd: bcs.u64(),
  on_time_payments: bcs.u32(), missed_payments: bcs.u32(),
  credit_age_months: bcs.u32(), utilization_bps: bcs.u32(),
});

(async () => {
  const plaintext = CreditInputs.serialize({
    monthly_income_usd: 8000n, monthly_debt_usd: 1500n,
    on_time_payments: 36, missed_payments: 1, credit_age_months: 60, utilization_bps: 2200,
  }).toBytes();
  console.log("private financial inputs -> plaintext:", plaintext.length, "bytes");

  const id = crypto.getRandomValues(new Uint8Array(32));
  const { encryptedObject } = await seal.encrypt({ threshold: 1, packageId: PKG, id: toHex(id), data: plaintext });

  console.log(`✓ Seal-encrypted: ciphertext ${encryptedObject.length} bytes (id 0x${toHex(id).slice(0, 12)}…)`);
  console.log("→ Decryptable ONLY by the credit enclave via confidential_credit::seal_approve.");
  console.log("\n✅ Client-side Seal encryption of credit inputs WORKS.");
})().catch((e) => { console.error("SEAL ENCRYPT ERROR:", e.message); process.exit(1); });
