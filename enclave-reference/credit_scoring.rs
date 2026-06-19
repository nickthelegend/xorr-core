// REFERENCE — credit scoring INSIDE the enclave (XORR "step 1").
//
// WHY: today the credit enclave SIGNS a score it is handed (see
// xorr-core/app/api/credit-score/route.ts), so the score is an input, not
// computed from private data. This module moves the SCORING COMPUTATION INSIDE
// the enclave: the caller sends private financial inputs, the enclave computes
// the score and signs only the result. The raw inputs never leave the enclave
// (dropped after scoring) and never touch the chain — that is the data-privacy
// half of "confidential credit". The on-chain verifier is unchanged: it already
// checks the signature against the attestation-bound key (AttestedOracle).
//
// NOTE: the running credit enclave's handler source is NOT committed in this
// repo (it lives on the EC2 instance). This is a drop-in reference — adapt the
// `AppState`/`EnclaveError`/crypto imports to your enclave's exact types.
//
// ACTIVATION (your AWS):
//   1. Add `mod credit_scoring;` and route `.route("/score_credit", post(credit_scoring::score_credit))`.
//   2. Rebuild the enclave image (`make ENCLAVE_APP=<app>`, `nitro-cli build-enclave`, `run-enclave`).
//   3. The image hash changes => PCR0 changes => re-pin + re-register on-chain:
//      `node xorr-core/scripts/register-attestation.mjs` (verifies the fresh
//      attestation, re-binds the key to the new PCRs).
//   4. Point /api/credit-score at `POST /score_credit` with the `CreditInputs` body
//      (send the user's private inputs; stop computing the score server-side).
//
// The signed message MUST match Move `confidential_credit::CreditAttestation`
// EXACTLY (BCS, field order): intent:u8, timestamp_ms:u64, borrower:address(32B),
// score:u64, approved_limit:u64, nonce:u64. The frontend already calls the
// replay-safe `verify_and_apply_score_attested_v2`, which enforces freshness.

use axum::{extract::State, Json};
use fastcrypto::encoding::{Encoding, Hex};
use fastcrypto::traits::{Signer, ToFromBytes};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::common::{AppState, EnclaveError}; // adapt to your enclave's modules

const CREDIT_INTENT: u8 = 1;

/// PRIVATE financial inputs — sent to the enclave, never persisted, never
/// returned, never put on-chain.
#[derive(Deserialize)]
pub struct CreditInputs {
    pub borrower: String, // 0x-hex Sui address (32 bytes)
    pub monthly_income_usd: u64,
    pub monthly_debt_usd: u64,
    pub on_time_payments: u32,
    pub missed_payments: u32,
    pub credit_age_months: u32,
    pub utilization_bps: u32, // 0..=10_000
    pub nonce: u64,
}

/// Exactly the struct BCS-serialized and signed (matches the Move side).
#[derive(Serialize)]
struct CreditAttestation {
    intent: u8,
    timestamp_ms: u64,
    borrower: [u8; 32],
    score: u64,
    approved_limit: u64,
    nonce: u64,
}

#[derive(Serialize)]
pub struct CreditScoreResponse {
    pub borrower: String,
    pub score: u64,
    pub approved_limit: u64, // 6-dp USDC units
    pub nonce: u64,
    pub timestamp_ms: u64,
    pub credit_signature: String, // hex ed25519 over the BCS CreditAttestation
    pub enclave_pubkey: String,   // hex
}

/// Transparent FICO-like score (300..=850), computed entirely in-enclave.
fn compute_score(i: &CreditInputs) -> (u64, u64) {
    let dti = if i.monthly_income_usd == 0 {
        10_000
    } else {
        (i.monthly_debt_usd as u128 * 10_000 / i.monthly_income_usd as u128).min(10_000) as u64
    };
    let total = i.on_time_payments + i.missed_payments;
    let pay_ratio = if total == 0 { 8_000 } else { (i.on_time_payments as u64 * 10_000) / total as u64 };

    let mut score: i64 = 300;
    score += (pay_ratio as i64 * 350) / 10_000; // payment history (max +350)
    score += ((10_000 - dti) as i64 * 150) / 10_000; // debt-to-income (max +150)
    score += ((10_000 - i.utilization_bps.min(10_000)) as i64 * 100) / 10_000; // utilization (max +100)
    score += (i.credit_age_months.min(120) as i64 * 50) / 120; // age (max +50)
    score -= i.missed_payments as i64 * 20; // penalty
    let score = score.clamp(300, 850) as u64;

    // Unsecured limit scales with score above the 600 gate, capped at 500 USDC.
    let approved_limit = if score < 600 {
        0
    } else {
        (((score - 600) as u128) * 2_000_000).min(500_000_000) as u64
    };
    (score, approved_limit)
}

pub async fn score_credit(
    State(state): State<Arc<AppState>>,
    Json(inputs): Json<CreditInputs>,
) -> Result<Json<CreditScoreResponse>, EnclaveError> {
    let (score, approved_limit) = compute_score(&inputs); // <-- computed IN the enclave

    let timestamp_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| EnclaveError::GenericError(format!("clock: {e}")))?
        .as_millis() as u64;

    let raw = Hex::decode(&inputs.borrower).map_err(|e| EnclaveError::GenericError(format!("addr: {e}")))?;
    if raw.len() != 32 {
        return Err(EnclaveError::GenericError("borrower must be a 32-byte address".into()));
    }
    let mut borrower = [0u8; 32];
    borrower.copy_from_slice(&raw);

    let msg = CreditAttestation { intent: CREDIT_INTENT, timestamp_ms, borrower, score, approved_limit, nonce: inputs.nonce };
    let bytes = bcs::to_bytes(&msg).map_err(|e| EnclaveError::GenericError(format!("bcs: {e}")))?;
    let sig = state.eph_kp.sign(&bytes);

    // `inputs` is dropped at end of scope — raw financial data never leaves here.
    Ok(Json(CreditScoreResponse {
        borrower: inputs.borrower,
        score,
        approved_limit,
        nonce: inputs.nonce,
        timestamp_ms,
        credit_signature: Hex::encode(sig.as_bytes()),
        enclave_pubkey: Hex::encode(state.eph_kp.public().as_bytes()),
    }))
}
