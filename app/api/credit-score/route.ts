import { NextResponse } from "next/server";

// The credit-scoring enclave (AWS Nitro) endpoint. Plain HTTP on testnet — this
// route runs server-side so the browser never makes a mixed-content call.
const ENCLAVE = process.env.CREDIT_ENCLAVE_URL || "http://98.81.188.34:3000/process_data";
const FULLNODE = process.env.SUI_RPC_URL || "https://fullnode.testnet.sui.io:443";

// Read repaid_total from the borrower's on-chain CreditProfile (6-dp USDC units).
// The score is derived from TRUSTED on-chain state, not a client-supplied figure.
async function onchainRepaidTotal(profileId: string): Promise<number> {
  try {
    const r = await fetch(FULLNODE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getObject", params: [profileId, { showContent: true }] }),
    });
    const j = await r.json();
    const f = j?.result?.data?.content?.fields;
    return f?.repaid_total ? Number(f.repaid_total) / 1_000_000 : 0;
  } catch {
    return 0;
  }
}

/**
 * Request a TEE-signed credit attestation. The score is computed here from the
 * borrower's on-chain repayment history and the enclave SIGNS the result (the
 * on-chain `verify_and_apply_score_attested_v2` checks the signature against the
 * attestation-bound key and enforces freshness). Moving the scoring computation
 * itself inside the enclave over private inputs is "step 1"
 * (see enclave-reference/credit_scoring.rs).
 */
export async function POST(req: Request) {
  const { borrower, profileId } = await req.json().catch(() => ({}));
  if (!borrower || typeof borrower !== "string") {
    return NextResponse.json({ error: "borrower address required" }, { status: 400 });
  }

  const repaidTotal = profileId && typeof profileId === "string" ? await onchainRepaidTotal(profileId) : 0;
  const score = Math.min(850, 660 + Math.round(repaidTotal) * 3);
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
      return NextResponse.json({ error: "Enclave did not return a signature" }, { status: 502 });
    }
    return NextResponse.json({
      score,
      approvedLimit: approvedLimitRaw,
      nonce,
      timestampMs: Number(resp.timestamp_ms),
      signatureHex: resp.credit_signature,
      enclavePubkey: resp.enclave_pubkey ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Enclave unreachable" }, { status: 502 });
  }
}
