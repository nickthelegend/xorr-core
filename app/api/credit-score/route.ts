import { NextResponse } from "next/server";

// The credit-scoring enclave (AWS Nitro) endpoint. Plain HTTP on testnet — this
// route runs server-side so the browser never makes a mixed-content call to it.
const ENCLAVE = process.env.CREDIT_ENCLAVE_URL || "http://98.81.188.34:3000/process_data";

/**
 * Request a TEE-signed credit attestation for a borrower.
 *
 * Honest note on the trust model: in the current build the enclave SIGNS the
 * score it is handed (an attestation/notary oracle). The score here is derived
 * from the borrower's on-chain repayment history (a transparent heuristic);
 * moving the scoring computation itself inside the enclave is the next step.
 * The signature still proves the attestation came from the registered enclave
 * key, which is what `confidential_credit::verify_and_apply_score` checks.
 */
export async function POST(req: Request) {
  const { borrower, repaidTotal = 0 } = await req.json().catch(() => ({}));
  if (!borrower || typeof borrower !== "string") {
    return NextResponse.json({ error: "borrower address required" }, { status: 400 });
  }

  // Transparent demo scoring: base 660 + on-chain repayment history, capped 850.
  const score = Math.min(850, 660 + Math.round(Number(repaidTotal) || 0) * 3);
  const approvedLimitRaw = 200_000_000; // 200 USDC at 6 decimals — the value the enclave signs
  const nonce = Date.now();

  try {
    const r = await fetch(ENCLAVE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: { credit_score: { borrower, score, approved_limit: approvedLimitRaw, nonce } } }),
    });
    const resp = await r.json().catch(() => null);
    if (!resp?.credit_signature) {
      return NextResponse.json({ error: "Enclave did not return a signature", detail: resp }, { status: 502 });
    }
    // The on-chain message must use the EXACT values the enclave signed.
    return NextResponse.json({
      score,
      approvedLimit: approvedLimitRaw, // raw u64, passed verbatim to the verifier
      nonce,
      timestampMs: Number(resp.timestamp_ms),
      signatureHex: resp.credit_signature,
      enclavePubkey: resp.enclave_pubkey ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Enclave unreachable: " + msg }, { status: 502 });
  }
}
