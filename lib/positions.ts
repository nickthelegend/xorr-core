// On-chain read helpers for XORR positions on Sui. Reads the connected wallet's
// owned objects from the published xorr-contracts package and the demo
// LendingPool. Used by /positions, /pools, and the home dashboard.
//
// All amounts are returned in USDT units (6 decimals). Uses the same
// SuiJsonRpcClient surface that @mysten/dapp-kit's useSuiClient provides.
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { USDT_PACKAGE_ID, USDT_DECIMALS } from "./sui";
import { BNPL_POOL_ID } from "./bnpl";

const PKG = USDT_PACKAGE_ID;
const SCALE = 10 ** USDT_DECIMALS;

const num = (v: unknown) => (v == null ? 0 : Number(v as string));
const toUsdt = (v: unknown) => num(v) / SCALE;

export type PositionKind = "bnpl" | "collateralized" | "unsecured" | "supply";

export type OnChainPosition = {
  id: string;
  kind: PositionKind;
  /** Human label, e.g. "BNPL Loan" / "Collateralized Borrow". */
  label: string;
  /** Outstanding/principal owed (USDT). For supply receipts this is the supplied principal. */
  amount: number;
  /** Optional secondary figure (e.g. interest accrued or locked collateral) in USDT. */
  secondary?: number;
  /** Raw move object type for debugging / explorer linking. */
  objectType: string;
};

type MoveObj = {
  data?: {
    objectId?: string;
    type?: string;
    content?: { dataType?: string; fields?: Record<string, unknown>; type?: string };
  };
};

const KINDS: Array<{ frag: string; kind: PositionKind; label: string }> = [
  { frag: "::bnpl::Loan<", kind: "bnpl", label: "BNPL Loan" },
  { frag: "::market::CollateralizedPosition<", kind: "collateralized", label: "Collateralized Borrow" },
  { frag: "::market::UnsecuredPosition<", kind: "unsecured", label: "Unsecured Borrow (TEE)" },
  { frag: "::lending_pool::SupplyReceipt", kind: "supply", label: "Supply Receipt" },
];

function classify(type: string): { kind: PositionKind; label: string } | null {
  for (const k of KINDS) if (type.includes(k.frag)) return { kind: k.kind, label: k.label };
  return null;
}

/** Pull the first numeric field present out of a Move object's fields. */
function pickAmount(fields: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) if (fields[key] != null) return toUsdt(fields[key]);
  return 0;
}

/**
 * Read every XORR position object owned by `owner`. Paginates getOwnedObjects
 * and filters to the four XORR struct types. Returns [] when the package id is
 * not configured (keeps callers render-safe).
 */
export async function readPositions(
  client: SuiJsonRpcClient,
  owner: string,
): Promise<OnChainPosition[]> {
  if (!PKG || !owner) return [];
  const out: OnChainPosition[] = [];
  let cursor: string | null | undefined = undefined;

  // We can't server-side filter on four arbitrary struct types in one call, so
  // we page all owned objects (with type+content) and classify client-side.
  do {
    const page = await client.getOwnedObjects({
      owner,
      cursor: cursor ?? undefined,
      options: { showType: true, showContent: true },
    });
    for (const obj of page.data as MoveObj[]) {
      const type = obj.data?.type ?? "";
      if (!type.startsWith(PKG)) continue;
      const hit = classify(type);
      if (!hit) continue;
      const fields = (obj.data?.content?.fields ?? {}) as Record<string, unknown>;
      const id = obj.data?.objectId ?? "";
      const amount = pickAmount(fields, [
        "outstanding",
        "principal",
        "amount",
        "borrowed",
        "debt",
        "supplied",
        "shares",
      ]);
      const secondary = pickAmount(fields, ["interest", "interest_accrued", "collateral", "locked"]);
      out.push({ id, kind: hit.kind, label: hit.label, amount, secondary: secondary || undefined, objectType: type });
    }
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  return out;
}

export type LendingPoolStats = {
  totalBorrowed: number;
  available: number;
  totalSupplied: number;
  shares: number;
  raw: Record<string, unknown> | null;
};

/**
 * Read the demo LendingPool object and surface its public stats (USDT units).
 * Field names are matched leniently so minor Move naming differences still
 * populate the panel rather than crashing.
 */
export async function readLendingPool(
  client: SuiJsonRpcClient,
  poolId: string = BNPL_POOL_ID,
): Promise<LendingPoolStats | null> {
  if (!poolId) return null;
  try {
    const obj = await client.getObject({ id: poolId, options: { showContent: true } });
    const content = obj.data?.content;
    if (!content || content.dataType !== "moveObject") return null;
    const f = content.fields as Record<string, unknown>;
    const totalBorrowed = pickAmount(f, ["total_borrowed", "borrowed", "outstanding"]);
    const available = pickAmount(f, ["available", "liquidity", "balance", "cash"]);
    const totalSupplied = pickAmount(f, ["total_supplied", "supplied", "total_liquidity"]);
    const shares = num(f["total_shares"] ?? f["shares"]);
    return {
      totalBorrowed,
      available,
      totalSupplied: totalSupplied || available + totalBorrowed,
      shares,
      raw: f,
    };
  } catch {
    return null;
  }
}
