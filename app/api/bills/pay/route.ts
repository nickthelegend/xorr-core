import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const MERCHANT_APP_URL = process.env.MERCHANT_APP_URL || "http://localhost:3002";
const FULLNODE = process.env.SUI_RPC_URL || "https://fullnode.testnet.sui.io:443";

// Verify the referenced tx actually settled on-chain before marking a bill paid.
async function txSucceeded(digest: string): Promise<boolean> {
  try {
    const r = await fetch(FULLNODE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getTransactionBlock", params: [digest, { showEffects: true }] }),
    });
    const j = await r.json();
    return j?.result?.effects?.status?.status === "success";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { billHash, txHash, userAddress, paymentMode, loanId } = body;

  if (!billHash) {
    return NextResponse.json({ error: "Missing billHash" }, { status: 400 });
  }
  // Require a real, settled on-chain tx — stops anyone marking a bill paid with a
  // fabricated hash (bill hashes are public in the checkout URL).
  if (!txHash || typeof txHash !== "string" || !(await txSucceeded(txHash))) {
    return NextResponse.json({ error: "txHash missing or not a successful on-chain transaction" }, { status: 400 });
  }

  try {
    const db = await getDb();
    // Idempotent: only flip a bill that isn't already paid.
    const localResult = await db.collection("bills").updateOne(
      { hash: billHash, status: { $ne: "paid" } },
      {
        $set: {
          status: "paid",
          payment_mode: paymentMode || "bnpl",
          loan_id: loanId,
          tx_hash: txHash,
          paid_at: new Date(),
          paid_by: userAddress,
        },
      }
    );

    // Best-effort sync to the merchant app (its route is also idempotent).
    try {
      await fetch(`${MERCHANT_APP_URL}/api/bills/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billHash, txHash, userAddress, paymentMode, loanId }),
      });
    } catch (e) {
      console.warn("[BILLS] Merchant app sync failed (non-critical):", e);
    }

    return NextResponse.json({ success: true, updated: localResult.modifiedCount > 0 });
  } catch (e) {
    console.error("Bill Pay Error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
