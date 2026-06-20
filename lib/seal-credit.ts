// Seal (threshold IBE) encryption of a borrower's PRIVATE financial inputs.
// Mirrors Shell Finance's dark-pool order sealing (@shell-finance/sdk encrypt.ts),
// applied to credit data: the borrower encrypts client-side, and ONLY the attested
// credit enclave can decrypt — gated on-chain by confidential_credit::seal_approve.
// The chain and our servers only ever see ciphertext.
import { SealClient } from "@mysten/seal";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { bcs } from "@mysten/sui/bcs";
import { toHex } from "@mysten/sui/utils";
import { USDT_PACKAGE_ID } from "./sui";

// Mysten testnet Seal key server. threshold = 1 here (single key server, demo);
// add more serverConfigs + raise the threshold for distributed t-of-n in prod.
const SEAL_KEY_SERVERS = [
  {
    objectId: "0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98",
    aggregatorUrl: "https://seal-aggregator-testnet.mystenlabs.com",
    weight: 1,
  },
];

let _seal: SealClient | null = null;
export function getSealClient(suiClient: SuiJsonRpcClient): SealClient {
  if (!_seal) _seal = new SealClient({ suiClient, serverConfigs: SEAL_KEY_SERVERS, verifyKeyServers: false });
  return _seal;
}

export type CreditInputs = {
  monthlyIncomeUsd: number;
  monthlyDebtUsd: number;
  onTimePayments: number;
  missedPayments: number;
  creditAgeMonths: number;
  utilizationBps: number; // 0..10000
};

// BCS layout MUST match the enclave's Rust `CreditInputs`
// (enclave-reference/credit_scoring.rs) so the enclave can decode after decrypt.
export const CreditInputsBCS = bcs.struct("CreditInputs", {
  monthly_income_usd: bcs.u64(),
  monthly_debt_usd: bcs.u64(),
  on_time_payments: bcs.u32(),
  missed_payments: bcs.u32(),
  credit_age_months: bcs.u32(),
  utilization_bps: bcs.u32(),
});

export type SealedCreditInputs = { sealedEnvelopeHex: string; idHex: string; bytes: number };

/**
 * Seal-encrypt the borrower's private financial inputs to the credit package.
 * Returns the sealed envelope (`id ‖ ciphertext`). Only the attested credit
 * enclave can fetch the IBE key (seal_approve gates it), so only it can decrypt.
 */
export async function encryptCreditInputs(seal: SealClient, inputs: CreditInputs): Promise<SealedCreditInputs> {
  const plaintext = CreditInputsBCS.serialize({
    monthly_income_usd: BigInt(Math.max(0, Math.floor(inputs.monthlyIncomeUsd))),
    monthly_debt_usd: BigInt(Math.max(0, Math.floor(inputs.monthlyDebtUsd))),
    on_time_payments: Math.max(0, Math.floor(inputs.onTimePayments)),
    missed_payments: Math.max(0, Math.floor(inputs.missedPayments)),
    credit_age_months: Math.max(0, Math.floor(inputs.creditAgeMonths)),
    utilization_bps: Math.min(10000, Math.max(0, Math.floor(inputs.utilizationBps))),
  }).toBytes();

  const id = crypto.getRandomValues(new Uint8Array(32));
  const { encryptedObject } = await seal.encrypt({
    threshold: 1,
    packageId: USDT_PACKAGE_ID, // credit package = Seal identity namespace (seal_approve lives here)
    id: toHex(id),
    data: plaintext,
  });

  const envelope = new Uint8Array(id.length + encryptedObject.length);
  envelope.set(id, 0);
  envelope.set(encryptedObject, id.length);
  return { sealedEnvelopeHex: toHex(envelope), idHex: toHex(id), bytes: envelope.length };
}
